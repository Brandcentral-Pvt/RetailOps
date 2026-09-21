/**
 * GET /api/asins — pagination contract (docs/asin-manager-deep-dive.md → F6).
 *
 * The response used to report `pagination.total` from a count that ignored every
 * filter, so the header ("Managing N ASINs") and the pager lied as soon as a
 * filter, search or status was applied. Now:
 *
 *   total      → the count matching the applied filters (drives the pager)
 *   scopeTotal → the unfiltered count for the caller's scope (drives the header)
 */

// The app's config module exits the process when these are unset; tests must not
// depend on a local .env (same reason the CI job needs them for a real run).
process.env.DB_USER = process.env.DB_USER || 'test-user';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'test-password';
process.env.DB_SERVER = process.env.DB_SERVER || 'localhost';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
let mockState = { pool: null };

jest.mock('../../services/marketDataSyncService', () => ({
    isConfigured: () => false,
    syncSellerAsinsToOctoparse: jest.fn(() => Promise.resolve()),
    syncSellerAsins: jest.fn(() => Promise.resolve()),
    processBatchResults: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../database/db', () => {
    const { FAKE_SQL } = require('../../testUtils/fakePool');
    return {
        sql: FAKE_SQL,
        getPool: async () => mockState.pool,
        generateId: () => 'gen-id-1',
        executeWithRetry: async (fn) => fn(),
    };
});

const { makeFakePool } = require('../../testUtils/fakePool');
const asinController = require('../../controllers/asinController');

const SCOPED_USER = {
    Id: 'U1',
    role: { name: 'brand_manager', Name: 'brand_manager' },
    permissions: ['asinmanager_view'],
    assignedSellers: ['S1'],
};

const makeRes = () => {
    const res = {
        statusCode: 200,
        headersSent: false,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; },
    };
    return res;
};

const ROW = {
    Id: 'A1',
    AsinCode: 'B0TEST0001',
    SellerId: 'S1',
    Status: 'Active',
    ScrapeStatus: 'COMPLETED',
    CurrentPrice: 499,
    BSR: 1200,
    Rating: 4.2,
    ReviewCount: 31,
    LQS: 68,
    Title: 'Test product',
    sellerName: 'Acme',
    sellerMarketplace: 'amazon.in',
    TotalOrders: 12,
};

beforeEach(() => {
    mockState.pool = makeFakePool([
        // [5] filtered count + unfiltered scope count, one aggregate
        { match: /COUNT\(\*\) as scopeTotal/, rows: [{ total: 7, scopeTotal: 99 }] },
        // [6] page
        { match: /SELECT a\.\*, s\.Name as sellerName/, rows: [ROW] },
    ]);
});

describe('getAsins pagination', () => {
    test('total reflects the filters, scopeTotal reflects the scope', async () => {
        const req = {
            query: { status: 'Active', page: '2', limit: '25' },
            params: {},
            user: SCOPED_USER,
            app: { get: () => null },
        };
        const res = makeRes();

        await asinController.getAsins(req, res);

        expect(res.body.pagination.total).toBe(7);
        expect(res.body.pagination.scopeTotal).toBe(99);
        expect(res.body.pagination.page).toBe(2);
        expect(res.body.pagination.totalPages).toBe(Math.ceil(7 / 25));
        expect(res.body.asins).toHaveLength(1);
    });

    test('one aggregate carries the filters and stays inside the caller scope', async () => {
        const req = { query: { status: 'Active', limit: '25' }, params: {}, user: SCOPED_USER, app: { get: () => null } };
        const res = makeRes();

        await asinController.getAsins(req, res);

        const countQueries = mockState.pool.callsWhere(/COUNT\(\*/);
        expect(countQueries).toHaveLength(1);
        const count = countQueries[0];

        // the applied filters are the aggregate's CASE predicate…
        expect(count.sql).toMatch(/SUM\(CASE WHEN 1=1[\s\S]*a\.Status = @status[\s\S]*THEN 1 ELSE 0 END\)/);
        // …while the seller scope is the query's own WHERE clause
        const outsideFrom = count.sql.split('FROM Asins a WITH (NOLOCK)')[1];
        expect(outsideFrom).toMatch(/WHERE 1=1 AND a\.SellerId IN \(@allowedSeller_0\)/);
        expect(outsideFrom).not.toMatch(/a\.Status = @status/);
        expect(count.inputs.allowedSeller_0).toBe('S1');
    });

    test('an empty page still reports honest numbers', async () => {
        mockState.pool = makeFakePool([
            { match: /COUNT\(\*\) as scopeTotal/, rows: [{ total: 0, scopeTotal: 42 }] },
            { match: /SELECT a\.\*, s\.Name as sellerName/, rows: [] },
        ]);
        const req = { query: { limit: '25' }, params: {}, user: SCOPED_USER, app: { get: () => null } };
        const res = makeRes();

        await asinController.getAsins(req, res);

        expect(res.body.asins).toEqual([]);
        expect(res.body.pagination.total).toBe(0);
        expect(res.body.pagination.scopeTotal).toBe(42);
        expect(res.body.pagination.totalPages).toBe(0);
    });
});
