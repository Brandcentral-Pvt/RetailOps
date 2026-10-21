/**
 * ASIN Manager — Live Sync (`POST /api/market-sync/sync-asins-live`).
 *
 * The sync ENGINE (LiveDataSyncService) is seller-scoped, while ASIN Manager
 * selects individual ASINs that can span several sellers. This route is the
 * adapter between the two: it resolves ASIN ids -> owning sellers and calls
 * syncSellerLiveData(sellerId, { asinCodes }) once per seller.
 *
 * These tests pin that contract, plus the things that are easy to get wrong:
 *   - validation (empty / oversize / unknown ids);
 *   - seller-scope enforcement for non-global users;
 *   - Ajio rows are never sent to the Creators API;
 *   - rows without an ASIN code are skipped rather than crashed on;
 *   - the response is sent BEFORE the background sync runs (fire-and-forget),
 *     so a slow/hanging sync can never block the HTTP request.
 */

const express = require('express');
const request = require('supertest');

let mockState = { user: null, pool: null };

jest.mock('../../database/db', () => {
    const { FAKE_SQL } = require('../../testUtils/fakePool');
    return {
        sql: FAKE_SQL,
        getPool: async () => mockState.pool,
        generateId: () => 'sync-id',
    };
});

jest.mock('../../middleware/auth', () => {
    const deny = (res, message, status) => res.status(status).json({ success: false, message });
    return {
        authenticate: (req, res, next) => {
            if (!mockState.user) return deny(res, 'Authentication required', 401);
            req.user = mockState.user;
            next();
        },
        requirePermission: (permissionName) => (req, res, next) => {
            if (!mockState.user) return deny(res, 'Authentication required', 401);
            const role = req.user?.role?.name || req.user?.role?.Name || req.user?.role;
            if (['admin', 'super_admin'].includes(role)) return next();
            if (!(req.user.permissions || []).includes(permissionName)) {
                return deny(res, `Missing permission: ${permissionName}`, 403);
            }
            next();
        },
        checkSellerAccess: (req, res, next) => next(),
    };
});

// Capture what the controller asks the sync engine to do, without touching
// Redis / the Creators API / SQL.
const syncCalls = [];
jest.mock('../../services/liveDataSyncService', () => ({
    activeSyncs: new Map(),
    syncSellerLiveData: async (sellerId, options) => {
        syncCalls.push({ sellerId, options });
        return { success: true };
    },
    syncAllSellers: async () => ({ success: true }),
}));

// The controller also requires these; keep them inert.
jest.mock('../../services/marketDataSyncService', () => ({
    isConfigured: () => false,
}));

const { makeFakePool } = require('../../testUtils/fakePool');
const marketSyncController = require('../../controllers/marketDataSyncController');

const buildApp = () => {
    const app = express();
    app.use(express.json());
    // Stand in for `authenticate` — the controller reads req.user, and the
    // real router always sets it before reaching the handler.
    app.use((req, res, next) => {
        req.user = mockState.user;
        next();
    });
    app.post('/api/market-sync/sync-asins-live', marketSyncController.syncAsinsLive);
    return app;
};

/** Pool that answers the ASIN lookup with `rows` and anything else emptily. */
const poolWithAsins = (rows) => makeFakePool([
    { match: /FROM Asins\s+WHERE Id IN/i, rows },
]);

const GLOBAL = { role: 'admin', permissions: [], assignedSellers: [] };

beforeEach(() => {
    syncCalls.length = 0;
    mockState.user = GLOBAL;
    mockState.pool = poolWithAsins([]);
});

describe('POST /api/market-sync/sync-asins-live', () => {
    test('rejects a missing or empty asinIds array', async () => {
        const app = buildApp();

        const missing = await request(app).post('/api/market-sync/sync-asins-live').send({});
        expect(missing.status).toBe(400);
        expect(missing.body.error).toMatch(/asinIds/i);

        const empty = await request(app).post('/api/market-sync/sync-asins-live').send({ asinIds: [] });
        expect(empty.status).toBe(400);
        expect(syncCalls).toHaveLength(0);
    });

    test('404s when none of the ids exist', async () => {
        mockState.pool = poolWithAsins([]);
        const res = await request(buildApp())
            .post('/api/market-sync/sync-asins-live')
            .send({ asinIds: ['nope'] });

        expect(res.status).toBe(404);
        expect(syncCalls).toHaveLength(0);
    });

    test('groups selected ASINs by seller and passes asinCodes through', async () => {
        mockState.pool = poolWithAsins([
            { Id: 'a1', AsinCode: 'B01', SellerId: 'S1', Marketplace: 'amazon.in' },
            { Id: 'a2', AsinCode: 'B02', SellerId: 'S1', Marketplace: 'amazon.in' },
            { Id: 'a3', AsinCode: 'B03', SellerId: 'S2', Marketplace: 'amazon.in' },
        ]);

        const res = await request(buildApp())
            .post('/api/market-sync/sync-asins-live')
            .send({ asinIds: ['a1', 'a2', 'a3'] });

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ success: true, syncing: 3, sellers: 2 });
        // The sync runs in the background; let the microtask queue drain.
        await new Promise((r) => setImmediate(r));

        expect(syncCalls).toHaveLength(2);
        const bySeller = Object.fromEntries(syncCalls.map((c) => [c.sellerId, c.options.asinCodes]));
        expect(bySeller.S1.sort()).toEqual(['B01', 'B02']);
        expect(bySeller.S2).toEqual(['B03']);
    });

    test('never sends non-Amazon (Ajio) rows to the Creators API', async () => {
        mockState.pool = poolWithAsins([
            { Id: 'a1', AsinCode: 'B01', SellerId: 'S1', Marketplace: 'amazon.in' },
            { Id: 'a2', AsinCode: 'AJ1', SellerId: 'S1', Marketplace: 'ajio' },
        ]);

        const res = await request(buildApp())
            .post('/api/market-sync/sync-asins-live')
            .send({ asinIds: ['a1', 'a2'] });

        expect(res.status).toBe(200);
        expect(res.body.skipped.notAmazon).toBe(1);
        await new Promise((r) => setImmediate(r));
        expect(syncCalls).toHaveLength(1);
        expect(syncCalls[0].options.asinCodes).toEqual(['B01']);
    });

    test('skips rows with no ASIN code instead of syncing them', async () => {
        mockState.pool = poolWithAsins([
            { Id: 'a1', AsinCode: null, SellerId: 'S1', Marketplace: 'amazon.in' },
            { Id: 'a2', AsinCode: 'B02', SellerId: 'S1', Marketplace: 'amazon.in' },
        ]);

        const res = await request(buildApp())
            .post('/api/market-sync/sync-asins-live')
            .send({ asinIds: ['a1', 'a2'] });

        expect(res.body.skipped.missingAsinCode).toBe(1);
        await new Promise((r) => setImmediate(r));
        expect(syncCalls[0].options.asinCodes).toEqual(['B02']);
    });

    test('a scoped user cannot live-sync another seller\'s ASINs', async () => {
        mockState.user = { role: 'user', permissions: ['scraping_manage'], assignedSellers: ['S1'] };
        mockState.pool = poolWithAsins([
            { Id: 'a1', AsinCode: 'B01', SellerId: 'S1', Marketplace: 'amazon.in' },
            { Id: 'a2', AsinCode: 'B02', SellerId: 'S9', Marketplace: 'amazon.in' },
        ]);

        const res = await request(buildApp())
            .post('/api/market-sync/sync-asins-live')
            .send({ asinIds: ['a1', 'a2'] });

        expect(res.status).toBe(200);
        expect(res.body.skipped.unauthorized).toBe(1);
        await new Promise((r) => setImmediate(r));
        expect(syncCalls).toHaveLength(1);
        expect(syncCalls[0].sellerId).toBe('S1');
    });

    test('refuses when the user has no access to ANY requested seller', async () => {
        mockState.user = { role: 'user', permissions: ['scraping_manage'], assignedSellers: ['S1'] };
        mockState.pool = poolWithAsins([
            { Id: 'a1', AsinCode: 'B01', SellerId: 'S9', Marketplace: 'amazon.in' },
        ]);

        const res = await request(buildApp())
            .post('/api/market-sync/sync-asins-live')
            .send({ asinIds: ['a1'] });

        expect(res.status).toBe(403);
        expect(syncCalls).toHaveLength(0);
    });
});
