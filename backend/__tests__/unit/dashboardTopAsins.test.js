/**
 * Unit regression tests for dashboardController.getDashboardData.
 *
 * Focus: the top-ASINs query must (a) bind the @dashSeller_* parameters,
 * (b) restrict the AdsPerformance join to the selected date range and
 * ReportType='daily', and (c) the controller must return the chart series
 * with honest units (actual orders, not orders × 1.48).
 */
let mockState = { user: null, pool: null };

jest.mock('../../database/db', () => {
    const { FAKE_SQL } = require('../../testUtils/fakePool');
    return {
        sql: FAKE_SQL,
        getPool: async () => mockState.pool,
        generateId: () => 'gen-id-1',
    };
});

const { makeFakePool } = require('../../testUtils/fakePool');
const dashboardController = require('../../controllers/dashboardController');

const NOW = new Date();

const buildPool = () => makeFakePool([
    { match: /SUM\(CASE WHEN Status IN/, rows: [{ Total: 10, Active: 8, OutOfStock: 1, NewThisMonth: 2, PortfolioValue: 5000 }] },
    { match: /COUNT\(\*\) as Total/, rows: [{ Total: 3, Active: 2 }] },
    { match: /TOP 5/, rows: [] },
    { match: /FROM Actions/, rows: [{ Status: 'Pending', Count: 2 }] },
    {
        match: /FROM AdsPerformance AP\s+JOIN Asins A/,
        rows: [{ AsinCode: 'B0TEST0001', Date: NOW, AdSales: 100, AdSpend: 25, Orders: 5, OrganicSales: 150, Impressions: 900, Clicks: 40 }],
    },
    { match: /SELECT SellerId, COUNT\(\*\) as Count/, rows: [{ SellerId: 's1', Count: 4 }] },
    { match: /SELECT Id, Marketplace FROM Sellers/, rows: [{ Id: 's1', Marketplace: 'Amazon' }] },
    {
        match: /TOP 200/,
        rows: [{
            Id: 'a1', AsinCode: 'B0TEST0001', Sku: 'SKU-1', Title: 'Widget',
            Category: 'Home', CurrentPrice: 4999, SellerName: 'ACME',
            TotalAdSales: 100, TotalOrganicSales: 150, TotalAdSpend: 25, TotalOrders: 5,
        }],
    },
]);

const bmUser = (id) => ({
    Id: id,
    _id: id,
    role: { name: 'brand_manager' },
    assignedSellers: ['s1'],
});

const invoke = async (req) => {
    let payload;
    let statusCode;
    const res = {
        status(code) { statusCode = code; return this; },
        json(body) { payload = body; return this; },
    };
    await dashboardController.getDashboardData(req, res);
    return { payload, statusCode };
};

beforeEach(() => {
    mockState.pool = buildPool();
});

describe('getDashboardData — top ASINs query', () => {
    test('binds @dashSeller_* params on the TOP 200 request (SQL-error regression)', async () => {
        const { payload, statusCode } = await invoke({
            query: { period: '30d' },
            user: bmUser('u-unit-bind'),
        });

        expect(statusCode).toBeUndefined(); // 200 path — res.json called without status()
        expect(payload.tableData).toBeDefined();

        const topAsins = mockState.pool.callWhere(/TOP 200/);
        expect(topAsins).not.toBeNull();
        // Pre-fix this request had NO inputs while its SQL referenced
        // @dashSeller_0 — MSSQL "Must declare the scalar variable" error.
        expect(topAsins.inputs.dashSeller_0).toBe('s1');
    });

    test('AdsPerformance join is date-range + daily-report restricted', async () => {
        await invoke({ query: { period: '14d' }, user: bmUser('u-unit-join') });

        const topAsins = mockState.pool.callWhere(/TOP 200/);
        expect(topAsins.sql).toMatch(/LEFT JOIN AdsPerformance AP ON A\.AsinCode = AP\.Asin\s+AND AP\.Date BETWEEN @startDate AND @endDate\s+AND AP\.ReportType = 'daily'/);
        expect(topAsins.inputs.startDate).toBeDefined();
        expect(topAsins.inputs.endDate).toBeDefined();
    });

    test('revenue is Ad + Organic sales only (no CurrentPrice fallback)', async () => {
        const { payload } = await invoke({ query: { period: '30d' }, user: bmUser('u-unit-rev') });

        const row = payload.tableData.find(r => r.asin === 'B0TEST0001');
        expect(row).toBeDefined();
        // CurrentPrice = 4999 must NOT leak into revenue.
        expect(row.revenue).toBe(250);
        expect(row.units).toBe(5);
    });

    test('returns orders/units/ACoS series with actual order counts', async () => {
        const { payload } = await invoke({ query: { period: '30d' }, user: bmUser('u-unit-series') });

        expect(Array.isArray(payload.ordersSeries)).toBe(true);
        expect(Array.isArray(payload.unitsSeries)).toBe(true);
        expect(Array.isArray(payload.acosSeries)).toBe(true);

        // Total orders across buckets equals the ads rows' actual orders (5),
        // proving the orders × 1.48 estimate is gone.
        expect(payload.ordersSeries.reduce((a, b) => a + b, 0)).toBe(5);
        expect(payload.unitsSeries.reduce((a, b) => a + b, 0)).toBe(5);
    });

    test('explicit sellerId list selects the authorized intersection', async () => {
        const { statusCode } = await invoke({
            query: { period: '30d', sellerId: 's1,s2' },
            user: { Id: 'u-unit-multi', _id: 'u-unit-multi', role: { name: 'brand_manager' }, assignedSellers: ['s1', 's2'] },
        });

        expect(statusCode).toBeUndefined();
        const topAsins = mockState.pool.callWhere(/TOP 200/);
        expect(topAsins.inputs.dashSeller_0).toBe('s1');
        expect(topAsins.inputs.dashSeller_1).toBe('s2');
    });
});
