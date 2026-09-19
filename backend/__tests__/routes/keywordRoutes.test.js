/**
 * Keyword Research — HTTP access tests.
 *
 * Mounts the real `/api/keywords` router behind a faithful mock of
 * middleware/auth.js, so the wiring (not just the controller) is pinned:
 *
 *   - anonymous → 401, wrong permission → 403;
 *   - `keywords_view` alone cannot export (403) — `keywords_export` is required;
 *   - only `keywords_manage` may clear the shared cache;
 *   - a scoped user asking for another seller → 403 `forbidden_seller`;
 *   - the catalog read that powers "you sell this" is seller-filtered;
 *   - the upstream API is never called for a request that was refused.
 */

const express = require('express');
const request = require('supertest');

let mockState = { user: null, pool: null };

jest.mock('../../database/db', () => {
    const { FAKE_SQL } = require('../../testUtils/fakePool');
    return {
        sql: FAKE_SQL,
        getPool: async () => mockState.pool,
        generateId: () => 'kw-route-id',
    };
});

jest.mock('../../middleware/auth', () => {
    const deny = (res, message, status) => res.status(status).json({ success: false, message });
    const roleOf = (req) => req.user?.role?.name || req.user?.role?.Name || req.user?.role;
    return {
        authenticate: (req, res, next) => {
            if (!mockState.user) return deny(res, 'Authentication required', 401);
            req.user = mockState.user;
            next();
        },
        requirePermission: (permissionName) => (req, res, next) => {
            if (!mockState.user) return deny(res, 'Authentication required', 401);
            if (['admin', 'super_admin'].includes(roleOf(req))) return next();
            if (!(req.user.permissions || []).includes(permissionName)) {
                return deny(res, `Missing permission: ${permissionName}`, 403);
            }
            next();
        },
    };
});

jest.mock('../../services/keywordResearchService', () => {
    const state = { searchCalls: [], batchCalls: [] };
    const items = [
        {
            asin: 'B0OURS00001', title: 'AquaPro Insulated Water Bottle 1 Litre Steel Flask', price: 599, mrp: 999,
            discountPercent: 40, rating: 4.2, reviewCount: 730, mainBSR: 5100, brand: 'AquaPro',
            seller: 'AquaPro Retail', sellerId: 'A1AQUA', category: 'Home & Kitchen', isBuyBoxWinner: true,
            availability: 'IN_STOCK', condition: 'New', bulletPoints: [], colour: null,
        },
        {
            asin: 'B0THEIRS001', title: 'Milton Steel Water Bottle 1 Litre', price: 899, mrp: 1499,
            discountPercent: 40, rating: 4.6, reviewCount: 9000, mainBSR: 900, brand: 'Milton',
            seller: 'Milton Store', sellerId: 'A1MILTON', category: 'Home & Kitchen', isBuyBoxWinner: true,
            availability: 'IN_STOCK', condition: 'New', bulletPoints: [],
        },
    ];
    return {
        __state: state,
        searchItems: async (params) => {
            state.searchCalls.push(params);
            return { items, totalResultCount: 1200, searchRefinements: null, itemPage: 1, itemCount: params.itemCount, cached: false };
        },
        batchSearchItems: async (keywords, params) => {
            state.batchCalls.push({ keywords, params });
            return {
                results: keywords.map((k) => ({ keyword: k, items, totalResultCount: 1200, cached: false })),
                totalKeywords: keywords.length,
                meta: { requested: keywords.length, failed: 0, cached: 0, fresh: keywords.length, concurrency: 4, elapsedMs: 500 },
            };
        },
        getCacheStats: () => ({ entries: 3, hits: 5, misses: 2, hitRate: 71.4, ttlMs: 600000, maxEntries: 300 }),
        clearCache: () => 3,
        _config: { requestDelay: 1100 },
    };
});

const { makeFakePool } = require('../../testUtils/fakePool');
const research = require('../../services/keywordResearchService');
const keywordRoutes = require('../../routes/keywordRoutes');

const app = express();
app.use(express.json());
app.use('/api/keywords', keywordRoutes);

const ADMIN = { Id: 'u-admin', role: { name: 'admin' }, assignedSellers: [], permissions: [] };
const VIEWER = { Id: 'u-view', role: { name: 'catalog_manager' }, assignedSellers: ['A1AQUA'], permissions: ['keywords_view'] };
const EXPORTER = { Id: 'u-exp', role: { name: 'listing_team' }, assignedSellers: ['A1AQUA'], permissions: ['keywords_view', 'keywords_export'] };
const MANAGER = { Id: 'u-mgr', role: { name: 'operational_manager' }, assignedSellers: ['A1AQUA'], permissions: ['keywords_view', 'keywords_export', 'keywords_manage'] };
const NO_PERMISSION = { Id: 'u-np', role: { name: 'listing_team' }, assignedSellers: ['A1AQUA'], permissions: [] };

const catalogRow = {
    AsinCode: 'B0OURS00001', Sku: 'SKU-1', Title: 'AquaPro Insulated Water Bottle 1 Litre Steel Flask', Brand: 'AquaPro',
    Category: 'Home & Kitchen', SellerId: 'A1AQUA', SellerName: 'AquaPro Retail', Status: 'Active', StockLevel: 40,
    CurrentPrice: 599, BSR: 5100, Rating: 4.2, ReviewCount: 730, LQS: 80, BuyBoxWin: true, ParentAsin: null,
    ImageUrl: null, BulletPointsText: 'leak proof insulated', UpdatedAt: new Date('2026-09-01'),
};

beforeEach(() => {
    mockState.pool = makeFakePool([{ match: /FROM Asins/, rows: [catalogRow] }]);
    research.__state.searchCalls.length = 0;
    research.__state.batchCalls.length = 0;
});

describe('GET /api/keywords/search', () => {
    test('anonymous callers get 401', async () => {
        mockState.user = null;
        const res = await request(app).get('/api/keywords/search?keywords=bottle');
        expect(res.status).toBe(401);
        expect(research.__state.searchCalls).toHaveLength(0);
    });

    test('authenticated without keywords_view gets 403 before any paid call', async () => {
        mockState.user = NO_PERMISSION;
        const res = await request(app).get('/api/keywords/search?keywords=bottle');
        expect(res.status).toBe(403);
        expect(research.__state.searchCalls).toHaveLength(0);
        expect(mockState.pool.calls).toHaveLength(0);
    });

    test('a scoped viewer gets market analytics, insights and catalog flags', async () => {
        mockState.user = VIEWER;
        const res = await request(app).get('/api/keywords/search?keywords=steel water bottle&itemCount=20');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.market.sample.products).toBe(2);
        expect(res.body.insights.insights.length).toBeGreaterThan(0);
        expect(res.body.items.find((i) => i.asin === 'B0OURS00001').inCatalog).toBe(true);
        expect(res.body.items.find((i) => i.asin === 'B0THEIRS001').inCatalog).toBe(false);
        expect(res.body.scope).toEqual({ isGlobal: false, sellerIds: ['A1AQUA'] });
        expect(res.body.capabilities).toEqual({ canExport: false, canManage: false });
        expect(research.__state.searchCalls[0].itemCount).toBe(20);
    });

    test('the catalog read is restricted to the caller\'s sellers', async () => {
        mockState.user = VIEWER;
        await request(app).get('/api/keywords/search?keywords=bottle');
        const catalogCall = mockState.pool.callWhere(/FROM Asins/);
        expect(catalogCall.sql).toMatch(/AND a\.SellerId IN \(@kwScope_0\)/);
        expect(catalogCall.inputs.kwScope_0).toBe('A1AQUA');
    });

    test('requesting a foreign seller is refused with context and no upstream call', async () => {
        mockState.user = VIEWER;
        const res = await request(app).get('/api/keywords/search?keywords=bottle&sellerId=A1MILTON');
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('forbidden_seller');
        expect(res.body.assignedSellers).toEqual(['A1AQUA']);
        expect(research.__state.searchCalls).toHaveLength(0);
    });

    test('a global role may filter by any seller', async () => {
        mockState.user = ADMIN;
        const res = await request(app).get('/api/keywords/search?keywords=bottle&sellerId=A1MILTON');
        expect(res.status).toBe(200);
        const catalogCall = mockState.pool.callWhere(/FROM Asins/);
        expect(Object.values(catalogCall.inputs)).toContain('A1MILTON');
    });

    test('a missing keyword is a 400, not a paid call', async () => {
        mockState.user = VIEWER;
        const res = await request(app).get('/api/keywords/search');
        expect(res.status).toBe(400);
        expect(research.__state.searchCalls).toHaveLength(0);
    });
});

describe('POST /api/keywords/batch-search', () => {
    test('runs a batch for a viewer and reports scheduling metadata', async () => {
        mockState.user = VIEWER;
        const res = await request(app).post('/api/keywords/batch-search').send({ keywords: 'bottle\nflask\n' });
        expect(res.status).toBe(200);
        expect(res.body.results).toHaveLength(2);
        expect(res.body.meta.concurrency).toBeGreaterThan(1);
        expect(res.body.results[0].insights.insights.length).toBeGreaterThan(0);
    });

    test('rejects more keywords than one batch may carry', async () => {
        mockState.user = VIEWER;
        const keywords = Array.from({ length: 21 }, (_, i) => `kw${i}`).join('\n');
        const res = await request(app).post('/api/keywords/batch-search').send({ keywords });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Maximum 20 keywords/);
        expect(research.__state.batchCalls).toHaveLength(0);
    });
});

describe('GET /api/keywords/meta', () => {
    test('exposes limits, cache stats and the caller\'s capabilities', async () => {
        mockState.user = MANAGER;
        const res = await request(app).get('/api/keywords/meta');
        expect(res.status).toBe(200);
        expect(res.body.limits).toMatchObject({ batchMax: 20, itemCountMax: 50, rateLimitMs: 1100 });
        expect(res.body.cache.entries).toBe(3);
        expect(res.body.capabilities).toEqual({ canExport: true, canManage: true });
        expect(res.body.sortOptions.length).toBeGreaterThan(3);
    });
});

describe('POST /api/keywords/export', () => {
    const dataset = (body) => ({
        kind: 'single',
        label: 'steel water bottle',
        dataset: {
            keyword: 'steel water bottle',
            items: [{ asin: 'B0OURS00001', title: 'AquaPro Bottle', price: 599, position: 1, inCatalog: true, ourListings: [] }],
            market: { sample: { products: 1 }, price: { bands: [] }, brands: { rows: [] }, ratings: { reviewMoat: {} }, terms: {}, opportunity: {} },
            catalog: { rows: [], summary: { matchedCount: 1 } },
            insights: { insights: [] },
        },
        ...body,
    });

    test('keywords_view alone is not enough to export', async () => {
        mockState.user = VIEWER;
        const res = await request(app).post('/api/keywords/export').send(dataset());
        expect(res.status).toBe(403);
    });

    test('a keywords_export holder receives a real workbook', async () => {
        mockState.user = EXPORTER;
        const res = await request(app).post('/api/keywords/export').send(dataset())
            .buffer(true).parse((r, cb) => {
                const chunks = [];
                r.on('data', (c) => chunks.push(c));
                r.on('end', () => cb(null, Buffer.concat(chunks)));
            });

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/spreadsheetml/);
        expect(res.headers['content-disposition']).toMatch(/attachment; filename="keyword-research-steel-water-bottle-/);
        expect(res.body.slice(0, 2).toString()).toBe('PK');       // xlsx is a zip container
    });

    test('an empty dataset is rejected', async () => {
        mockState.user = EXPORTER;
        const res = await request(app).post('/api/keywords/export').send({ kind: 'single' });
        expect(res.status).toBe(400);
    });
});

describe('POST /api/keywords/cache/clear', () => {
    test('requires keywords_manage', async () => {
        mockState.user = EXPORTER;
        const res = await request(app).post('/api/keywords/cache/clear');
        expect(res.status).toBe(403);
    });

    test('a manage holder clears the shared cache', async () => {
        mockState.user = MANAGER;
        const res = await request(app).post('/api/keywords/cache/clear');
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ success: true, removed: 3 });
    });
});
