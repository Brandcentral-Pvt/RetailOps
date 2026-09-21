/**
 * POST /api/asins/recalculate-lqs (docs/asin-manager-deep-dive.md → F7/F8).
 *
 * Before: the handler selected `Id, Title, BulletPoints, ImagesUrls, HasAplus,
 * Category, SellerId`, then scored with `price`/`rating`/`reviews` — columns it
 * had not selected, so they were always 0 — and finally wrote
 * `TitleScore = 0, BulletScore = 0, ImageScore = 0, DescriptionScore = 0`,
 * destroying the analyzer output written by listingQualityService.
 *
 * Now: one canonical scoring path (the analyzer-weighted service the live sync
 * uses), scoped, and the component scores are left intact.
 */

// The app's config module exits the process when these are unset; tests must not
// depend on a local .env (same reason the CI job needs them for a real run).
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

jest.mock('../../services/listingQualityService', () => ({
    analyzeAndSaveFull: jest.fn(async (id) => (id === 'A-GONE' ? null : { totalScore: 82, totalGrade: 'A' })),
}));

jest.mock('../../services/marketDataSyncService', () => ({
    isConfigured: () => false,
    syncSellerAsinsToOctoparse: () => Promise.resolve(),
}));

const { makeFakePool } = require('../../testUtils/fakePool');
const listingQualityService = require('../../services/listingQualityService');
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
    jest.clearAllMocks();
    mockState.pool = makeFakePool([
        { match: /SELECT DISTINCT SellerId FROM Asins WHERE Id IN/, rows: [{ SellerId: 'S1' }] },
        { match: /SELECT a\.Id FROM Asins a/, rows: [{ Id: 'A1' }, { Id: 'A2' }, { Id: 'A-GONE' }] },
    ]);
});

describe('recalculate-lqs', () => {
    test('explicit ids go through the canonical analyzer service', async () => {
        const req = { body: { ids: ['A1', 'A2', 'A-GONE'] }, user: SCOPED_USER, params: {}, query: {} };
        const res = makeRes();

        await asinController.recalculateLqs(req, res);

        expect(listingQualityService.analyzeAndSaveFull.mock.calls.map((c) => c[0])).toEqual(['A1', 'A2', 'A-GONE']);
        expect(res.body).toEqual({ success: true, processedCount: 2 });
    });

    test('no ids → every ASIN in the caller scope', async () => {
        const req = { body: {}, user: SCOPED_USER, params: {}, query: {} };
        const res = makeRes();

        await asinController.recalculateLqs(req, res);

        const targetQuery = mockState.pool.callWhere(/SELECT a\.Id FROM Asins a/);
        expect(targetQuery.sql).toMatch(/AND a\.SellerId IN \(@lqsScope_0\)/);
        expect(targetQuery.inputs.lqsScope_0).toBe('S1');
        expect(res.body.processedCount).toBe(2);
    });

    test('ids outside the caller scope → 403 and nothing scored', async () => {
        mockState.pool = makeFakePool([
            { match: /SELECT DISTINCT SellerId FROM Asins WHERE Id IN/, rows: [{ SellerId: 'S2' }] },
        ]);
        const req = { body: { ids: ['OTHER-1'] }, user: SCOPED_USER, params: {}, query: {} };
        const res = makeRes();

        await asinController.recalculateLqs(req, res);

        expect(res.statusCode).toBe(403);
        expect(listingQualityService.analyzeAndSaveFull).not.toHaveBeenCalled();
    });

    test('regression: the component scores are never zeroed', async () => {
        const req = { body: { ids: ['A1'] }, user: SCOPED_USER, params: {}, query: {} };
        const res = makeRes();

        await asinController.recalculateLqs(req, res);

        const zeroingUpdate = mockState.pool.calls.find(
            (c) => /UPDATE Asins/i.test(c.sql) && /TitleScore = @titleScore/.test(c.sql)
        );
        expect(zeroingUpdate).toBeUndefined();
        expect(res.statusCode).toBe(200);
    });
});
