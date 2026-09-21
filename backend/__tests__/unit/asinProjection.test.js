/**
 * Server-side column projection (Step 3).
 *
 * The list payload used to be `SELECT a.*` — every row carried the product
 * description, the bullet-point HTML, the offers/buy-box JSON, the image array,
 * the legacy history blob and twelve per-component quality issue arrays that the
 * table never renders. A client that names its visible columns
 * (`?columns=asinCode,title,…`, the keys of the frontend column selector) gets
 * the base columns plus only the heavy columns it actually asked for.
 *
 * The base set stays broad on purpose: the row mapper derives price-dispute,
 * buy-box, deal and trend values from those columns, and it derives them even
 * when the corresponding column is hidden.
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

const fs = require('fs');
const path = require('path');
const { makeFakePool } = require('../../testUtils/fakePool');
const asinController = require('../../controllers/asinController');

const SCOPED_USER = { Id: 'U1', role: { name: 'brand_manager' }, permissions: ['asinmanager_view'], assignedSellers: ['S1'] };

const ROW = { Id: 'A1', AsinCode: 'B0TEST0001', SellerId: 'S1', Status: 'Active', Title: 'Test', CurrentPrice: 499, LastScrapedAt: null };

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

/** Column keys the page's column selector can show (src/hooks/useColumnVisibility.js). */
const UI_COLUMN_KEYS = [
    'checkbox', 'asinCode', 'sellerBrand', 'parentAsin', 'sku', 'title', 'category', 'tags', 'releaseDate',
    'price', 'priceDispute', 'mrp', 'dealBadge', 'discountPercentage',
    'priceTrend', 'mainBsr', 'subBsr', 'video', 'bsrTrendStatus', 'bsrTrend',
    'rating', 'reviewCount', 'ratingTrendStatus', 'ratingTrend', 'reviewTrend',
    'totalOrders', 'availability', 'availabilityStatus', 'manufacturer',
    'dealStartTime', 'dealEndTime', 'dealAccessType', 'currentBuybox', 'otherBuybox',
    'imagesCount', 'imageTrend', 'bulletPoints', 'hasAplus', 'aplusDays',
];

beforeEach(() => {
    asinController.clearAsinMonthsCache();
    mockState.pool = makeFakePool([
        { match: /COUNT\(\*\) as scopeTotal/, rows: [{ total: 1, scopeTotal: 1 }] },
        { match: /SELECT a\.\*, s\.Name as sellerName/, rows: [ROW] },
        { match: /SELECT a\.Id, a\.AsinCode/, rows: [ROW] },
        { match: /-- \[7\.1\] Daily History/, recordsets: [[], [], []] },
    ]);
});

describe('buildAsinProjection', () => {
    test('no columns parameter keeps the legacy full row', () => {
        expect(asinController.buildAsinProjection(undefined)).toBeNull();
        expect(asinController.buildAsinProjection('')).toBeNull();
    });

    test('a request without heavy columns gets the base set only', () => {
        const sqlText = asinController.buildAsinProjection('asinCode,title,price,mainBsr,freshness');
        expect(sqlText).toContain('a.AsinCode');
        expect(sqlText).toContain('a.CurrentPrice');
        expect(sqlText).not.toContain('a.ProductDescription');
        expect(sqlText).not.toContain('a.AllOffers');
        expect(sqlText).not.toContain('a.BulletPointsText');
        expect(sqlText).not.toContain('a.History');
    });

    test('heavy columns are added back only when asked for', () => {
        const sqlText = asinController.buildAsinProjection('title,allOffers,productDescription,images');
        expect(sqlText).toContain('a.AllOffers');
        expect(sqlText).toContain('a.ProductDescription');
        expect(sqlText).toContain('a.Images');
        expect(sqlText).not.toContain('a.BuyBoxes');
    });

    test('the quality-issues bundle is one switch', () => {
        const sqlText = asinController.buildAsinProjection('title,qualityIssues');
        expect(sqlText).toContain('a.TitleIssues');
        expect(sqlText).toContain('a.DescriptionRecommendations');
    });

    test('UI keys whose cell renders from a heavy blob are aliased', () => {
        // BuyBox is visible by default and renders from `BuyBoxes`; SUB BSR reads
        // `SubBSRs`. Without these aliases the default layout would lose them.
        const sqlText = asinController.buildAsinProjection('currentBuybox,otherBuybox,subBsr');
        expect(sqlText).toContain('a.BuyBoxes');
        expect(sqlText).toContain('a.SubBSRs');
        expect(sqlText).toContain('a.SubBsrCategories');
    });

    test('the default visible layout still selects the buy-box blob', () => {
        const hookSource = fs.readFileSync(path.join(__dirname, '../../../src/hooks/useColumnVisibility.js'), 'utf8');
        const defaultKeys = hookSource
            .split('\n')
            .filter((line) => !line.trim().startsWith('//') && line.includes('defaultVisible: true'))
            .flatMap((line) => [...line.matchAll(/key: '([^']+)'/g)].map((m) => m[1]));

        expect(defaultKeys).toContain('currentBuybox');
        expect(asinController.buildAsinProjection(defaultKeys.join(','))).toContain('a.BuyBoxes');
    });

    test('every column the UI can show is known to the server', () => {
        const heavy = Object.keys(asinController.ASIN_HEAVY_FIELDS);
        const hookSource = fs.readFileSync(path.join(__dirname, '../../../src/hooks/useColumnVisibility.js'), 'utf8');
        // Commented-out entries (the disabled LQS/CDQ columns) are not columns.
        const keys = hookSource
            .split('\n')
            .filter((line) => !line.trim().startsWith('//'))
            .flatMap((line) => [...line.matchAll(/key: '([^']+)'/g)].map((m) => m[1]));

        expect(keys.length).toBeGreaterThan(30);
        for (const key of keys) {
            const known = UI_COLUMN_KEYS.includes(key) || heavy.includes(key);
            expect(`${key}:${known}`).toBe(`${key}:true`);
        }
        // …and the list in this test is not stale either
        for (const key of UI_COLUMN_KEYS) {
            expect(`${key}:${keys.includes(key)}`).toBe(`${key}:true`);
        }
    });
});

describe('getAsins projection', () => {
    test('without columns the page query stays as it was', async () => {
        const res = await run();
        const page = mockState.pool.callWhere(/SELECT a\.\*, s\.Name as sellerName/);
        expect(page).toBeTruthy();
        expect(res.body.projection).toBe('full');
    });

    test('with columns only the requested heavy data is selected', async () => {
        const res = await run({ columns: 'asinCode,title,price,allOffers' });

        const page = mockState.pool.callWhere(/SELECT a\.Id, a\.AsinCode/);
        expect(page).toBeTruthy();
        expect(page.sql).toContain('a.AllOffers');
        expect(page.sql).not.toContain('a.ProductDescription');
        expect(page.sql).toContain('s.Name as sellerName');
        expect(res.body.projection).toBe('light');
        // the page still returns rows, with the same shape
        expect(res.body.asins).toHaveLength(1);
        expect(res.body.asins[0].asinCode).toBe('B0TEST0001');
    });
});
