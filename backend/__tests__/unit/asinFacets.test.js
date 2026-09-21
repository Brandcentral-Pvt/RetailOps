/**
 * Facet counts for the workspace filter rail (Step 3).
 *
 * The rail shows how many ASINs sit behind each filter value, so a filter is
 * never a blind checkbox. Counts respect the caller's seller scope and are
 * cached for a minute — a keystroke in the search box must not re-run seven
 * aggregates — while the tag facet (which needs `OPENJSON`, i.e. SQL Server
 * 2016+) is allowed to fail without taking the rail down.
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

const FACET_SETS = [
    [{ value_count: 42 }],
    [{ value: 'Active', count: 30 }, { value: 'Archived', count: 12 }],
    [{ value: 'COMPLETED', count: 40 }, { value: 'PENDING', count: 2 }],
    [{ value: 'fresh', count: 20 }, { value: 'stale', count: 15 }, { value: 'never', count: 7 }],
    [{ value: 'Home & Kitchen', count: 10 }],
    [{ value: 'Acme', count: 42 }],
    [{ value: 'Acme', count: 42 }],
];

const makeRes = () => ({
    statusCode: 200,
    headersSent: false,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
});

const run = async (query = {}, user = SCOPED_USER) => {
    const req = { query, params: {}, user, app: { get: () => null } };
    const res = makeRes();
    await asinController.getAsinFacets(req, res);
    return res;
};

beforeEach(() => {
    asinController.clearAsinFacetsCache();
    mockState.pool = makeFakePool([
        { match: /SELECT COUNT\(\*\) as value_count/, recordsets: FACET_SETS.map((set) => set.map((row) => ({ ...row }))) },
        { match: /OPENJSON\(a\.Tags\)/, rows: [{ value: 'Fragile', count: 5 }, { value: 'New Launch', count: 3 }] },
    ]);
});

describe('getAsinFacets', () => {
    test('returns every facet bucket, scoped to the caller', async () => {
        const res = await run();

        expect(res.body.success).toBe(true);
        expect(res.body.slaDays).toBe(7);
        expect(res.body.total).toBe(42);
        expect(res.body.facets.status).toEqual([
            { value: 'Active', count: 30 },
            { value: 'Archived', count: 12 },
        ]);
        expect(res.body.facets.freshness.map((f) => f.value)).toEqual(['fresh', 'stale', 'never']);
        expect(res.body.facets.tags).toEqual([
            { value: 'Fragile', count: 5 },
            { value: 'New Launch', count: 3 },
        ]);

        const batch = mockState.pool.callWhere(/SELECT COUNT\(\*\) as value_count/);
        expect(batch.sql).toMatch(/AND a\.SellerId IN \(@facetScope_0\)/);
        expect(batch.inputs.facetScope_0).toBe('S1');
        expect(batch.inputs.facetSlaDays).toBe(7);
    });

    test('marketplace and search narrow the counts', async () => {
        await run({ marketplace: 'amazon.in', search: 'B0TEST' });
        const batch = mockState.pool.callWhere(/SELECT COUNT\(\*\) as value_count/);
        expect(batch.sql).toContain('s.Marketplace = @facetMarketplace');
        expect(batch.sql).toContain('a.Title LIKE @facetSearch');
        expect(batch.inputs.facetSearch).toBe('%B0TEST%');
    });

    test('a foreign seller is denied without querying', async () => {
        const res = await run({ seller: 'S9' });
        expect(res.statusCode).toBe(403);
        expect(res.body.error).toBe('forbidden_seller');
        expect(mockState.pool.calls).toHaveLength(0);
    });

    test('a user with no sellers gets zeroed facets, not an unscoped count', async () => {
        const res = await run({}, { Id: 'U2', role: { name: 'brand_manager' }, assignedSellers: [] });
        expect(res.body.total).toBe(0);
        expect(res.body.facets.status).toEqual([]);
        expect(mockState.pool.calls).toHaveLength(0);
    });

    test('a global user is not filtered by seller', async () => {
        await run({}, { Id: 'A', role: { name: 'admin' } });
        const batch = mockState.pool.callWhere(/SELECT COUNT\(\*\) as value_count/);
        expect(batch.sql).not.toContain('a.SellerId IN');
    });

    test('counts are served from cache inside the TTL', async () => {
        await run();
        const queriesAfterFirst = mockState.pool.calls.length;
        const res = await run();
        expect(res.body.cached).toBe(true);
        expect(mockState.pool.calls.length).toBe(queriesAfterFirst);
    });

    test('a failing tag query degrades to no tag counts', async () => {
        mockState.pool = makeFakePool([
            { match: /SELECT COUNT\(\*\) as value_count/, recordsets: FACET_SETS },
            { match: /OPENJSON\(a\.Tags\)/, rows: () => { throw new Error('OPENJSON unavailable'); } },
        ]);
        const res = await run();
        expect(res.body.success).toBe(true);
        expect(res.body.facets.tags).toEqual([]);
        expect(res.body.facets.status).toHaveLength(2);
    });
});
