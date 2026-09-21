/**
 * POST /api/asins/bulk — seller attribution (docs/asin-manager-deep-dive.md → F4).
 *
 * Every caller nests the seller per item (`sellerId`, or `seller` as the older
 * seller modals do) while the controller only read a *top-level* `sellerId`, so
 * node-mssql coerced the undefined value to NULL and the rows could not be
 * attributed to a seller — the list query (which joins Sellers) never showed
 * them. These tests pin the new contract:
 *
 *   - per-item `sellerId` / `seller`, with a top-level id still honoured as a default;
 *   - unknown/absent seller → 400; a seller outside the caller's scope → 403, no writes;
 *   - duplicates are counted rather than failing the batch;
 *   - the response carries `insertedCount` (what SellerAsinsModal reads) and
 *     `createdCount` (the older shape);
 *   - rows are inserted with the seller and the seller's marketplace.
 */

// The app's config module exits the process when these are unset; tests must not
// depend on a local .env (same reason the CI job needs them for a real run).
process.env.DB_USER = process.env.DB_USER || 'test-user';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'test-password';
process.env.DB_SERVER = process.env.DB_SERVER || 'localhost';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
let mockState = { pool: null, synced: [] };

jest.mock('../../database/db', () => {
    const { FAKE_SQL } = require('../../testUtils/fakePool');
    class FakeTransaction {
        constructor(pool) { this.pool = pool; }
        async begin() {}
        async commit() {}
        async rollback() { mockState.rolledBack = (mockState.rolledBack || 0) + 1; }
        request() { return mockState.pool.request(); }
    }
    return {
        sql: { ...FAKE_SQL, Transaction: FakeTransaction },
        getPool: async () => mockState.pool,
        generateId: () => `gen-${Math.random().toString(36).slice(2, 8)}`,
        executeWithRetry: async (fn) => fn(),
    };
});

jest.mock('../../services/marketDataSyncService', () => ({
    isConfigured: () => true,
    syncSellerAsinsToOctoparse: (sellerId) => { mockState.synced.push(sellerId); return Promise.resolve(); },
    syncSellerAsins: () => Promise.resolve(),
}));

const { makeFakePool } = require('../../testUtils/fakePool');
const asinController = require('../../controllers/asinController');

const SCOPED_USER = {
    Id: 'U1',
    role: { name: 'brand_manager', Name: 'brand_manager' },
    permissions: ['asinmanager_manage'],
    assignedSellers: ['S1'],
};

const makeRes = () => ({
    statusCode: 200,
    headersSent: false,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
});

beforeEach(() => {
    mockState = { pool: null, synced: [], rolledBack: 0 };
    mockState.pool = makeFakePool([
        { match: /SELECT Id, Marketplace FROM Sellers WHERE Id IN/, rows: [{ Id: 'S1', Marketplace: 'amazon.in' }] },
        { match: /SELECT UPPER\(AsinCode\) as code, SellerId FROM Asins WHERE UPPER\(AsinCode\) IN/,
          rows: [{ code: 'B0DUPLICATE', SellerId: 'S1' }] },
        { match: /SELECT\s+COUNT\(\*\) as total/, rows: [{ total: 3, active: 3 }] },
    ]);
});

const call = async (body, user = SCOPED_USER) => {
    const req = { body, params: {}, query: {}, user, app: { get: () => ({ emit: () => {} }) } };
    const res = makeRes();
    await asinController.createAsins(req, res);
    return res;
};

describe('createAsins seller attribution', () => {
    test('reads the seller from each item and reports the counts the UI expects', async () => {
        const res = await call({
            asins: [
                { asinCode: 'B0NEW00001', sku: 'SKU-1', sellerId: 'S1' },
                { asin: 'B0NEW00002', seller: 'S1' },
                { asinCode: 'B0DUPLICATE', sellerId: 'S1' },
            ],
        });

        expect(res.statusCode).toBe(201);
        expect(res.body.insertedCount).toBe(2);
        expect(res.body.createdCount).toBe(2);
        expect(res.body.duplicatesCount).toBe(1);

        const inserts = mockState.pool.callsWhere(/INSERT INTO Asins/);
        expect(inserts).toHaveLength(2);
        for (const insert of inserts) {
            expect(insert.inputs.sellerId).toBe('S1');
            expect(insert.inputs.marketplace).toBe('amazon.in');
        }
        expect(mockState.synced).toEqual(['S1']);
    });

    test('a top-level sellerId still works as the batch default', async () => {
        const res = await call({ sellerId: 'S1', asins: [{ asinCode: 'B0NEW00003' }] });
        expect(res.statusCode).toBe(201);
        expect(mockState.pool.callsWhere(/INSERT INTO Asins/)[0].inputs.sellerId).toBe('S1');
    });

    test('a seller outside the caller scope → 403 with no writes', async () => {
        const res = await call({ asins: [{ asinCode: 'B0NEW00004', sellerId: 'S2' }] });
        expect(res.statusCode).toBe(403);
        expect(res.body.code).toBe('forbidden_seller');
        expect(mockState.pool.callsWhere(/INSERT INTO Asins/)).toHaveLength(0);
        expect(mockState.synced).toEqual([]);
    });

    test('an item without a seller → 400 rather than a NULL SellerId row', async () => {
        const res = await call({ asins: [{ asinCode: 'B0NEW00005' }] });
        expect(res.statusCode).toBe(400);
        expect(mockState.pool.callsWhere(/INSERT INTO Asins/)).toHaveLength(0);
    });

    test('an item without an ASIN code → 400', async () => {
        const res = await call({ asins: [{ sellerId: 'S1' }] });
        expect(res.statusCode).toBe(400);
    });
});
