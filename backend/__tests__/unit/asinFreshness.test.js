/**
 * Data freshness (Step 2 of docs/asin-manager-upgrade.md).
 *
 * Freshness is derived from `LastScrapedAt` against an SLA in days — never
 * stored — and the six-hourly cron that used to log "skipped" now reports real
 * numbers and can hand the worst sellers to the existing repair job.
 */
process.env.DB_USER = process.env.DB_USER || 'test-user';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'test-password';
process.env.DB_SERVER = process.env.DB_SERVER || 'localhost';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

let mockState = { pool: null, started: [] };

jest.mock('../../database/db', () => {
    const { FAKE_SQL } = require('../../testUtils/fakePool');
    return {
        sql: FAKE_SQL,
        getPool: async () => mockState.pool,
        generateId: () => 'gen-id-1',
        executeWithRetry: async (fn) => fn(),
    };
});

jest.mock('../../services/scraperRunner', () => ({
    startRepairJob: jest.fn(async (sellerId) => {
        mockState.started.push(sellerId);
        return { jobId: `repair-${sellerId}`, total: 3 };
    }),
}));

const { makeFakePool } = require('../../testUtils/fakePool');
const freshness = require('../../services/dataFreshnessService');

const SCOPED_USER = {
    Id: 'U1',
    role: { name: 'brand_manager', Name: 'brand_manager' },
    assignedSellers: ['S1'],
};

const REPORT_ROWS = [
    { SellerId: 'S1', sellerName: 'Acme', total: 100, fresh: 40, stale: 50, never: 10, oldestScrape: null },
    { SellerId: 'S2', sellerName: 'Beta', total: 20, fresh: 20, stale: 0, never: 0, oldestScrape: new Date() },
];

beforeEach(() => {
    mockState = { pool: null, started: [] };
    mockState.pool = makeFakePool([
        { match: /FROM Asins a WITH \(NOLOCK\)\s+LEFT JOIN Sellers/, rows: REPORT_ROWS.map((r) => ({ ...r })) },
        { match: /SELECT TOP \(@limit\)/, rows: [{ Id: 'A1', AsinCode: 'B0STALE', SellerId: 'S1' }] },
    ]);
    jest.clearAllMocks();
});

describe('normalizeSlaDays', () => {
    test('defaults, clamps and rejects junk', () => {
        expect(freshness.normalizeSlaDays(undefined)).toBe(freshness.DEFAULT_SLA_DAYS);
        expect(freshness.normalizeSlaDays('14')).toBe(14);
        expect(freshness.normalizeSlaDays(9999)).toBe(freshness.MAX_SLA_DAYS);
        expect(freshness.normalizeSlaDays(0)).toBe(freshness.DEFAULT_SLA_DAYS);
        expect(freshness.normalizeSlaDays('abc')).toBe(freshness.DEFAULT_SLA_DAYS);
    });
});

describe('getFreshnessReport', () => {
    test('aggregates per-seller rows and totals, scoped to the caller', async () => {
        const report = await freshness.getFreshnessReport(mockState.pool, { user: SCOPED_USER });

        expect(report).toMatchObject({ slaDays: 7, total: 120, fresh: 60, stale: 50, never: 10 });
        expect(report.sellers).toHaveLength(2);

        const query = mockState.pool.callWhere(/FROM Asins a WITH \(NOLOCK\)\s+LEFT JOIN Sellers/);
        expect(query.inputs.slaDays).toBe(7);
        expect(query.sql).toMatch(/AND a\.SellerId IN \(@freshScope_0\)/);
        expect(query.inputs.freshScope_0).toBe('S1');
    });

    test('a foreign seller is denied, not silently unscoped', async () => {
        const report = await freshness.getFreshnessReport(mockState.pool, { user: SCOPED_USER, sellerId: 'S9' });
        expect(report.denied).toBe(true);
        expect(mockState.pool.calls).toHaveLength(0);
    });

    test('a global user is not filtered by seller', async () => {
        const admin = { Id: 'A', role: { name: 'admin', Name: 'admin' } };
        await freshness.getFreshnessReport(mockState.pool, { user: admin });
        const query = mockState.pool.callWhere(/FROM Asins a WITH \(NOLOCK\)\s+LEFT JOIN Sellers/);
        expect(query.sql).not.toContain('a.SellerId IN');
    });
});

describe('findStaleAsins', () => {
    test('asks the database for the oldest first, inside the scope', async () => {
        const rows = await freshness.findStaleAsins(mockState.pool, { user: SCOPED_USER, slaDays: 30, limit: 10 });
        expect(rows).toHaveLength(1);

        const query = mockState.pool.callWhere(/SELECT TOP \(@limit\)/);
        expect(query.inputs.slaDays).toBe(30);
        expect(query.inputs.limit).toBe(10);
        expect(query.sql).toContain('ORDER BY CASE WHEN a.LastScrapedAt IS NULL THEN 0 ELSE 1 END, a.LastScrapedAt ASC');
        expect(query.sql).toMatch(/AND a\.SellerId IN \(@staleScope_0\)/);
    });
});

describe('runStaleRepairCycle', () => {
    test('dry run reports candidates and starts nothing', async () => {
        const result = await freshness.runStaleRepairCycle(mockState.pool, { dryRun: true, minStale: 25 });
        expect(result.ran).toBe(false);
        expect(result.dryRun).toBe(true);
        expect(result.candidates.map((c) => c.sellerId)).toEqual(['S1']);   // 50 + 10 ≥ 25, S2 has 0
        expect(mockState.started).toEqual([]);
    });

    test('starts a repair job per candidate seller when armed', async () => {
        const result = await freshness.runStaleRepairCycle(mockState.pool, { dryRun: false, minStale: 25 });
        expect(result.ran).toBe(true);
        expect(mockState.started).toEqual(['S1']);
    });

    test('does nothing when no seller is above the threshold', async () => {
        const result = await freshness.runStaleRepairCycle(mockState.pool, { dryRun: false, minStale: 5000 });
        expect(result.ran).toBe(false);
        expect(result.reason).toMatch(/threshold/);
        expect(mockState.started).toEqual([]);
    });
});
