/**
 * ASIN Manager — HTTP seller-scope tests (docs/asin-manager-deep-dive.md → F1/F2/F3).
 *
 * Mounts the *real* `/api/asins` router (and the real `checkSellerAccess`) behind
 * mocks of `authenticate` / `requirePermission` and the database, so the wiring
 * is what is being pinned:
 *
 *   - anonymous → 401; missing `asinmanager_view` → 403;
 *   - a scoped user addressing another seller's ASIN id → 403 and *no* write;
 *   - a foreign seller carried in the request body → 403 (the pre-fix hole:
 *     `checkSellerAccess` never looked at `req.body`);
 *   - the ledger endpoint `/api/asins-table` requires a permission and filters
 *     by the caller's sellers instead of dumping the catalogue;
 *   - an assigned seller still succeeds (the guard does not over-block).
 */

// The app's config module exits the process when these are unset; tests must not
// depend on a local .env (same reason the CI job needs them for a real run).
process.env.DB_USER = process.env.DB_USER || 'test-user';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'test-password';
process.env.DB_SERVER = process.env.DB_SERVER || 'localhost';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
const express = require('express');
const request = require('supertest');

let mockState = { user: null, pool: null, asinSeller: 'S1', rolledBack: 0 };

jest.mock('../../services/marketDataSyncService', () => ({
    isConfigured: () => false,
    syncSellerAsinsToOctoparse: jest.fn(() => Promise.resolve()),
    syncSellerAsins: jest.fn(() => Promise.resolve()),
    processBatchResults: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../database/db', () => {
    const { FAKE_SQL } = require('../../testUtils/fakePool');
    class FakeTransaction {
        constructor(pool) { this.pool = pool; }
        async begin() {}
        async commit() {}
        async rollback() { mockState.rolledBack += 1; }
        request() { return mockState.pool.request(); }
    }
    return {
        sql: { ...FAKE_SQL, Transaction: FakeTransaction },
        getPool: async () => mockState.pool,
        generateId: () => 'gen-id-1',
        executeWithRetry: async (fn) => fn(),
    };
});

jest.mock('../../middleware/auth', () => {
    const actual = jest.requireActual('../../middleware/auth');
    const deny = (res, message, status) => res.status(status).json({ success: false, message });
    const roleOf = (req) => req.user?.role?.name || req.user?.role?.Name || req.user?.role;
    const needsAuth = (req, res, next) => {
        if (!mockState.user) return deny(res, 'Authentication required', 401);
        req.user = mockState.user;
        next();
    };
    return {
        authenticate: needsAuth,
        requirePermission: (permissionName) => (req, res, next) => {
            if (!mockState.user) return deny(res, 'Authentication required', 401);
            req.user = mockState.user;
            if (['admin', 'super_admin'].includes(roleOf(req))) return next();
            if (!(req.user.permissions || []).includes(permissionName)) {
                return deny(res, `Missing permission: ${permissionName}`, 403);
            }
            next();
        },
        requireAnyPermission: (names) => (req, res, next) => {
            if (!mockState.user) return deny(res, 'Authentication required', 401);
            req.user = mockState.user;
            if (['admin', 'super_admin'].includes(roleOf(req))) return next();
            if (!names.some((n) => (req.user.permissions || []).includes(n))) return deny(res, 'Forbidden', 403);
            next();
        },
        // The real implementation is the thing under test for F3.
        checkSellerAccess: actual.checkSellerAccess,
    };
});

const { makeFakePool } = require('../../testUtils/fakePool');
const asinRoutes = require('../../routes/asinRoutes');
const asinTableRoutes = require('../../routes/asinTableRoutes');
const { checkSellerAccess } = require('../../middleware/auth');

const SCOPED_USER = {
    Id: 'U1',
    role: { name: 'brand_manager', Name: 'brand_manager' },
    permissions: ['asinmanager_view', 'asinmanager_manage', 'asinmanager_import', 'asinmanager_export'],
    assignedSellers: ['S1'],
};

beforeEach(() => {
    mockState = { user: SCOPED_USER, pool: null, asinSeller: 'S1', rolledBack: 0 };
    mockState.pool = makeFakePool([
        { match: /FROM Asins WHERE Id = @id/, rows: () => ([{
            Id: 'A1', AsinCode: 'B0TEST', SellerId: mockState.asinSeller, Tags: '[]', SubBSRs: '[]',
            CurrentPrice: 100, BSR: 10, Rating: 4.5, ReviewCount: 5, LQS: 60,
        }]) },
        { match: /SELECT DISTINCT SellerId FROM Asins WHERE Id IN/, rows: () => ([{ SellerId: mockState.asinSeller }]) },
        { match: /FROM AsinWeekHistory/, rows: () => [] },
        { match: /FROM SubBsrHistory/, rows: () => [] },
        { match: /SELECT DISTINCT\s+SellerId FROM Asins/, rows: () => ([{ SellerId: mockState.asinSeller }]) },
    ]);
});

const app = () => {
    const a = express();
    a.use(express.json());
    a.use('/api/asins', asinRoutes);
    a.use('/api/asins-table', asinTableRoutes);
    return a;
};

describe('authentication and permissions', () => {
    test('anonymous is rejected on a read route', async () => {
        mockState.user = null;
        const res = await request(app()).get('/api/asins/stats');
        expect(res.status).toBe(401);
    });

    test('a user without asinmanager_view cannot read trends', async () => {
        mockState.user = { ...SCOPED_USER, permissions: [] };
        const res = await request(app()).get('/api/asins/A1/trends');
        expect(res.status).toBe(403);
    });

    test('the ledger endpoint needs asinmanager_view (previously needed nothing)', async () => {
        mockState.user = { ...SCOPED_USER, permissions: [] };
        const res = await request(app()).get('/api/asins-table');
        expect(res.status).toBe(403);
    });
});

describe('id-addressed reads are scoped', () => {
    test("trends for another seller's ASIN → 403 and no history query", async () => {
        mockState.asinSeller = 'S2';
        const res = await request(app()).get('/api/asins/A1/trends');
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('forbidden_seller');
        expect(mockState.pool.callsWhere(/FROM AsinWeekHistory/)).toHaveLength(0);
    });

    test("sub-BSR trend for another seller's ASIN → 403", async () => {
        mockState.asinSeller = 'S2';
        const res = await request(app()).get('/api/asins/A1/subbsr-trend');
        expect(res.status).toBe(403);
    });

    test('an assigned seller still succeeds', async () => {
        const res = await request(app()).get('/api/asins/A1/trends');
        expect(res.status).toBe(200);
        expect(res.body.current).toBeDefined();
    });

    test('parent-view children are filtered by the caller scope', async () => {
        const res = await request(app()).get('/api/asins/parent-view/children/B0PARENT');
        expect(res.status).toBe(200);
        const query = mockState.pool.callWhere(/FROM Asins a\s+LEFT JOIN Sellers/);
        expect(query.sql).toMatch(/AND a\.SellerId IN \(@parentScope_0\)/);
        expect(query.inputs.parentScope_0).toBe('S1');
    });
});

describe('id-addressed writes are scoped', () => {
    test("week-history write for another seller's ASIN → 403 and no upsert", async () => {
        mockState.asinSeller = 'S2';
        const res = await request(app()).put('/api/asins/A1/week-history').send({ date: '2026-01-01', price: 10 });
        expect(res.status).toBe(403);
        expect(mockState.pool.callsWhere(/INSERT INTO AsinWeekHistory/)).toHaveLength(0);
    });

    test('bulk week-history refuses a batch containing a foreign ASIN', async () => {
        mockState.asinSeller = 'S2';
        const res = await request(app()).post('/api/asins/bulk-week-history')
            .send({ updates: [{ asinId: 'A1', weekData: { date: '2026-01-01', price: 10 } }] });
        expect(res.status).toBe(403);
        expect(mockState.pool.callsWhere(/INSERT INTO AsinWeekHistory/)).toHaveLength(0);
    });

    test('bulk update rolls back when any id belongs to another seller', async () => {
        mockState.asinSeller = 'S2';
        const res = await request(app()).post('/api/asins/bulk-update').send({ ids: ['A1'], updates: { status: 'Inactive' } });
        expect(res.status).toBe(403);
        expect(mockState.rolledBack).toBe(1);
        expect(mockState.pool.callsWhere(/UPDATE Asins SET/)).toHaveLength(0);
    });

    test("tag write on another seller's ASIN → 403", async () => {
        mockState.asinSeller = 'S2';
        const res = await request(app()).put('/api/asins/A1/tags').send({ tags: ['X'] });
        expect(res.status).toBe(403);
        expect(mockState.pool.callsWhere(/UPDATE Asins SET Tags/)).toHaveLength(0);
    });

    test('bulk tag update refuses foreign ASIN ids', async () => {
        mockState.asinSeller = 'S2';
        const res = await request(app()).post('/api/asins/bulk-tags').send({ asinIds: ['A1'], tags: ['X'] });
        expect(res.status).toBe(403);
    });
});

describe('body-carried sellers (the checkSellerAccess hole)', () => {
    test('import-csv into a foreign seller → 403 before any query', async () => {
        const res = await request(app()).post('/api/asins/import-csv').field('sellerId', 'S2');
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('forbidden_seller');
        expect(mockState.pool.callsWhere(/FROM Sellers WHERE Id = @sellerId/)).toHaveLength(0);
    });

    test('raw upload into a foreign seller → 403', async () => {
        const res = await request(app()).post('/api/asins/upload-raw')
            .send({ sellerId: 'S2', data: ['raw text'] });
        expect(res.status).toBe(403);
    });

    test('match against a foreign seller → 403', async () => {
        const res = await request(app()).post('/api/asins/match')
            .send({ sellerId: 'S2', asinCodes: ['B0TEST'] });
        expect(res.status).toBe(403);
    });

    test('all-sellers import is global-only', async () => {
        const res = await request(app()).post('/api/asins/bulk-upload-all-sellers');
        expect(res.status).toBe(403);
        expect(mockState.pool.callsWhere(/FROM Sellers$/)).toHaveLength(0);
    });

    test('full export with a foreign seller → 403', async () => {
        const res = await request(app()).get('/api/asins/full-export?sellerId=S2');
        expect(res.status).toBe(403);
    });

    test('checkSellerAccess itself now sees body sellers (unit)', async () => {
        const probe = express();
        probe.use(express.json());
        probe.post('/probe', (req, res, next) => { req.user = mockState.user; next(); }, checkSellerAccess, (_req, res) => res.json({ ok: true }));

        const foreign = await request(probe).post('/probe').send({ sellerId: 'S2' });
        expect(foreign.status).toBe(403);

        const mine = await request(probe).post('/probe').send({ sellerId: 'S1' });
        expect(mine.status).toBe(200);

        mockState.user = { ...SCOPED_USER, role: { name: 'admin', Name: 'admin' } };
        const asGlobal = await request(probe).post('/probe').send({ sellerId: 'S2' });
        expect(asGlobal.status).toBe(200);
    });
});

describe('ledger endpoint (/api/asins-table)', () => {
    test('scoped user cannot widen the ledger to another seller', async () => {
        const res = await request(app()).get('/api/asins-table?sellerId=S2');
        expect(res.status).toBe(403);
        expect(mockState.pool.callsWhere(/FROM Asins a/)).toHaveLength(0);
    });

    test('scoped user gets only their sellers in the SQL', async () => {
        const res = await request(app()).get('/api/asins-table');
        expect(res.status).toBe(200);
        const countQuery = mockState.pool.callWhere(/SELECT COUNT\(\*\) as total FROM Asins a/);
        expect(countQuery.sql).toMatch(/AND a\.SellerId IN \(@tableScope_0\)/);
        expect(countQuery.inputs.tableScope_0).toBe('S1');
    });
});
