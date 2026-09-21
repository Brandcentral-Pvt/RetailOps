/**
 * List-request cost and freshness filtering (docs/asin-manager-deep-dive.md → F5).
 *
 * Before: every `GET /api/asins` ran a table-wide `SELECT DISTINCT
 * FORMAT(Date,'yyyy-MM') FROM GmsDailyPerformance`, an unbounded week-history
 * read, a tenant-wide `SELECT DISTINCT TOP 7 Date FROM AsinHistory` that also
 * leaked other sellers' activity dates, and two `COUNT(*)` scans — ten
 * statements in all.
 *
 * Now: one aggregate produces both counts, the three history reads share a
 * single round trip, orders and revenue are one pass, the month list is cached,
 * and the date list is derived from the rows already in memory.
 */
process.env.DB_USER = process.env.DB_USER || 'test-user';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'test-password';
process.env.DB_SERVER = process.env.DB_SERVER || 'localhost';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

let mockState = { pool: null };

jest.mock('../../database/db', () => {
    const { FAKE_SQL } = require('../../testUtils/fakePool');
    return {
        sql: FAKE_SQL,
        getPool: async () => mockState.pool,
        generateId: () => 'gen-id-1',
        executeWithRetry: async (fn) => fn(),
    };
});

jest.mock('../../services/marketDataSyncService', () => ({
    isConfigured: () => false,
    syncSellerAsinsToOctoparse: jest.fn(() => Promise.resolve()),
}));

const { makeFakePool } = require('../../testUtils/fakePool');
const asinController = require('../../controllers/asinController');

const SCOPED_USER = {
    Id: 'U1',
    role: { name: 'brand_manager', Name: 'brand_manager' },
    permissions: ['asinmanager_view'],
    assignedSellers: ['S1'],
};

const ROW = {
    Id: 'A1', AsinCode: 'B0TEST0001', SellerId: 'S1', Status: 'Active',
    CurrentPrice: 499, BSR: 1200, Rating: 4.2, ReviewCount: 31, LQS: 68,
    LastScrapedAt: null, sellerName: 'Acme', sellerMarketplace: 'amazon.in',
};

const makeRes = () => ({
    statusCode: 200,
    headersSent: false,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
});

const run = async (query = {}) => {
    const req = { query: { limit: '25', ...query }, params: {}, user: SCOPED_USER, app: { get: () => null } };
    const res = makeRes();
    await asinController.getAsins(req, res);
    return res;
};

beforeEach(() => {
    mockState = { pool: null };
    mockState.pool = makeFakePool([
        { match: /COUNT\(\*\) as scopeTotal/, rows: [{ total: 1, scopeTotal: 10 }] },
        { match: /SELECT a\.\*, s\.Name as sellerName/, rows: [ROW] },
        { match: /SELECT DISTINCT FORMAT\(Date, 'yyyy-MM'\) as Month/, rows: [{ Month: '2026-01' }] },
        // the history batch — three result sets from one round trip
        {
            match: /-- \[7\.1\] Daily History/,
            recordsets: [
                [
                    { AsinId: 'A1', dateStr: '2026-09-20', price: 499, bsr: 1200, rating: 4.2, reviews: 31, stockLevel: 4, lqs: 68 },
                    { AsinId: 'A1', dateStr: '2026-09-18', price: 489, bsr: 1300, rating: 4.2, reviews: 30, stockLevel: 4, lqs: 68 },
                ],
                [{ AsinId: 'A1', dateStr: '2026-09-15', isoWeek: 38, price: 494, bsr: 1250, rating: 4.2, reviews: 31 }],
                [],
            ],
        },
        // period aggregates — orders + revenue in one pass
        { match: /as Orders,/, rows: [{ Asin: 'B0TEST0001', Month: '2026-09', Orders: 5, Revenue: 1200 }] },
    ]);
});

describe('available months', () => {
    test('the DISTINCT scan runs once and is then served from cache', async () => {
        // Fresh module state for a deterministic assertion
        asinController.clearAsinMonthsCache();

        await run();
        const afterFirst = mockState.pool.callsWhere(/SELECT DISTINCT FORMAT\(Date, 'yyyy-MM'\) as Month/).length;
        await run();
        const afterSecond = mockState.pool.callsWhere(/SELECT DISTINCT FORMAT\(Date, 'yyyy-MM'\) as Month/).length;

        expect(afterFirst).toBe(1);
        expect(afterSecond).toBe(1);
    });
});

describe('bounded history reads', () => {
    test('week history is limited to twelve weeks and labelled with the ISO week', async () => {
        const res = await run();
        const weekQuery = mockState.pool.callWhere(/FROM AsinWeekHistory WITH \(NOLOCK\)/);
        expect(weekQuery.sql).toContain('DATEADD(week, -12, dbo.GetEnvDate())');
        expect(weekQuery.sql).toContain('DATEPART(iso_week, WeekStartDate)');
        expect(res.body.months).toEqual(['2026-01']);
    });

    test('history dates are derived from the daily rows already fetched', async () => {
        const res = await run();
        // no query is issued against the table for them at all
        expect(mockState.pool.callsWhere(/SELECT DISTINCT TOP 7 \[Date\]/)).toHaveLength(0);
        expect(res.body.globalHistoryDates).toEqual(['2026-09-18', '2026-09-20']);
    });

    test('the three history reads share one round trip', async () => {
        await run();
        const batches = mockState.pool.callsWhere(/-- \[7\.1\] Daily History/);
        expect(batches).toHaveLength(1);
        expect(batches[0].sql).toContain('FROM AsinWeekHistory WITH (NOLOCK)');
        expect(batches[0].sql).toContain('FROM SubBsrHistory WITH (NOLOCK)');
    });
});

describe('statement budget', () => {
    test('a warm list request issues at most five statements', async () => {
        asinController.clearAsinMonthsCache();
        mockState.pool = makeFakePool([
            { match: /COUNT\(\*\) as scopeTotal/, rows: [{ total: 1, scopeTotal: 10 }] },
            { match: /SELECT a\.\*, s\.Name as sellerName/, rows: [ROW] },
            { match: /-- \[7\.1\] Daily History/, recordsets: [[], [], []] },
            { match: /as Orders,/, rows: [] },
            { match: /SELECT DISTINCT FORMAT\(Date, 'yyyy-MM'\) as Month/, rows: [{ Month: '2026-01' }] },
        ]);
        await run();   // warms the months cache

        mockState.pool = makeFakePool([
            { match: /COUNT\(\*\) as scopeTotal/, rows: [{ total: 1, scopeTotal: 10 }] },
            { match: /SELECT a\.\*, s\.Name as sellerName/, rows: [ROW] },
            { match: /-- \[7\.1\] Daily History/, recordsets: [[], [], []] },
            { match: /as Orders,/, rows: [] },
        ]);
        await run();

        // count+scope, page, history batch, period batch — months served from cache
        expect(mockState.pool.calls.length).toBeLessThanOrEqual(5);
        // and nothing scans the whole table
        expect(mockState.pool.callsWhere(/FROM GmsDailyPerformance WITH \(NOLOCK\)\s+WHERE Asin IS/)).toHaveLength(0);
    });
});

describe('freshness filter and row flags', () => {
    test('?freshness=stale filters by the SLA on both the count and the page', async () => {
        const res = await run({ freshness: 'stale', slaDays: '14' });

        const count = mockState.pool.callWhere(/COUNT\(\*\) as scopeTotal/);
        expect(count.sql).toContain('a.LastScrapedAt < DATEADD(day, -14, dbo.GetEnvDate())');

        const page = mockState.pool.callWhere(/SELECT a\.\*, s\.Name as sellerName/);
        expect(page.sql).toContain('a.LastScrapedAt IS NULL OR a.LastScrapedAt < DATEADD(day, -14');

        // the row carries derived freshness so the UI never has to guess
        expect(res.body.asins[0]).toMatchObject({ isStale: true, freshnessDays: null });
    });

    test('a never-scraped filter is a straight NULL check', async () => {
        await run({ freshness: 'never' });
        const count = mockState.pool.callWhere(/COUNT\(\*\) as scopeTotal/);
        expect(count.sql).toContain('a.LastScrapedAt IS NULL');
    });

    test('an unknown freshness value is ignored rather than silently applied', async () => {
        await run({ freshness: 'banana' });
        const count = mockState.pool.callWhere(/COUNT\(\*\) as scopeTotal/);
        expect(count.sql).not.toMatch(/CASE WHEN 1=1[\s\S]*LastScrapedAt/);
    });
});
