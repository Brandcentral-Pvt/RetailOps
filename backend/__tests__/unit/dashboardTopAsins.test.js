/**
 * Unit regression tests for dashboardController.getDashboardData.
 *
 * Focus:
 *  (a) the top-products ranking is defined by the ASIN's GMS (ordered
 *      revenue from GmsDailyPerformance) — NOT by AdsPerformance — with ads
 *      only LEFT JOINed as context (ad share / TACoS / ACoS);
 *  (b) every ranged query binds the @dashSeller_* params and is restricted
 *      to the selected window (AdsPerformance additionally to ReportType
 *      'daily');
 *  (c) the response carries honest series (actual orders, no ×1.48) plus
 *      the additive deep-data blocks (gms / ads / previous / gmsBySeller)
 *      with period-over-period deltas computed from the preceding window.
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
const daysAgo = (n) => {
    const d = new Date(NOW);
    d.setDate(d.getDate() - n);
    return d;
};

const buildPool = () => makeFakePool([
    { match: /SUM\(CASE WHEN Status IN/, rows: [{ Total: 10, Active: 8, OutOfStock: 1, NewThisMonth: 2, PortfolioValue: 5000 }] },
    { match: /COUNT\(\*\) as Total/, rows: [{ Total: 3, Active: 2 }] },
    { match: /TOP 5/, rows: [] },
    { match: /FROM Actions/, rows: [{ Status: 'Pending', Count: 2 }] },
    {
        // Per-day ads aggregate over current + previous window.
        match: /FROM AdsPerformance AP\s+JOIN Asins A/,
        rows: [
            { Date: NOW, AdSales: 100, AdSpend: 25, Orders: 5, OrganicSales: 150, Impressions: 900, Clicks: 40 },
            // previous-window row (must NOT leak into current KPIs / series)
            { Date: daysAgo(45), AdSales: 80, AdSpend: 40, Orders: 9, OrganicSales: 20, Impressions: 500, Clicks: 10 },
        ],
    },
    {
        // Per-day GMS aggregate over current + previous window.
        match: /FROM GmsDailyPerformance g\s+WHERE g\.Date BETWEEN @prevStart AND @endDate\s+AND EXISTS/,
        rows: [
            { Date: NOW, Revenue: 1000, Units: 10, ShippedRevenue: 900, Returns: 1 },
            { Date: daysAgo(45), Revenue: 800, Units: 8, ShippedRevenue: 700, Returns: 0 },
        ],
    },
    { match: /SELECT COUNT\(DISTINCT g\.Asin\) AS AsinsWithSales/, rows: [{ AsinsWithSales: 2 }] },
    { match: /SELECT SellerId, COUNT\(\*\) as Count/, rows: [{ SellerId: 's1', Count: 4 }] },
    { match: /SELECT Id, Marketplace FROM Sellers/, rows: [{ Id: 's1', Marketplace: 'Amazon' }] },
    {
        // GMS-ranked top products (already ordered by GmsRevenue DESC).
        match: /TOP 200/,
        rows: [
            {
                Id: 'a2', AsinCode: 'B0GMSKING', Sku: 'SKU-2', Title: 'Best seller (no ads)',
                Category: 'Home', Brand: 'ACME', ParentAsin: null, CurrentPrice: 4999, ImageUrl: null,
                Status: 'Active', AvailabilityStatus: 'In Stock', SellerId: 's1', SellerName: 'ACME', Marketplace: 'Amazon',
                GmsRevenue: 700, GmsUnits: 7, ShippedRevenue: 650, Returns: 1,
                PrevGmsRevenue: 350, PrevGmsUnits: 4, ActiveDays: 3,
                AdSales: 0, AdSpend: 0, AdOrders: 0,
            },
            {
                Id: 'a1', AsinCode: 'B0TEST0001', Sku: 'SKU-1', Title: 'Widget',
                Category: 'Home', Brand: 'ACME', ParentAsin: 'P1', CurrentPrice: 999, ImageUrl: null,
                Status: 'Active', AvailabilityStatus: 'In Stock', SellerId: 's1', SellerName: 'ACME', Marketplace: 'Amazon',
                GmsRevenue: 300, GmsUnits: 3, ShippedRevenue: 250, Returns: 0,
                PrevGmsRevenue: 0, PrevGmsUnits: 0, ActiveDays: 2,
                AdSales: 100, AdSpend: 25, AdOrders: 5,
            },
        ],
    },
    {
        // Per-ASIN sparkline rows for the leaders.
        match: /AND g\.Asin IN \(/,
        rows: [
            { Asin: 'B0GMSKING', Date: NOW, Revenue: 400, Units: 4 },
            { Asin: 'B0GMSKING', Date: daysAgo(1), Revenue: 300, Units: 3 },
        ],
    },
    {
        match: /GROUP BY A\.SellerId, S\.Name, S\.Marketplace/,
        rows: [{ SellerId: 's1', SellerName: 'ACME', Marketplace: 'Amazon', Revenue: 1000, Units: 10, PrevRevenue: 800, AsinsWithSales: 2 }],
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

describe('getDashboardData — top products are ranked by GMS, not ads', () => {
    test('binds @dashSeller_* params on the TOP 200 request (SQL-error regression)', async () => {
        const { payload, statusCode } = await invoke({
            query: { period: '30d' },
            user: bmUser('u-unit-bind'),
        });

        expect(statusCode).toBeUndefined(); // 200 path — res.json called without status()
        expect(payload.tableData).toBeDefined();

        const topAsins = mockState.pool.callWhere(/TOP 200/);
        expect(topAsins).not.toBeNull();
        expect(topAsins.inputs.dashSeller_0).toBe('s1');
        expect(topAsins.inputs.startDate).toBeDefined();
        expect(topAsins.inputs.endDate).toBeDefined();
        expect(topAsins.inputs.prevStart).toBeDefined();
    });

    test('ranking source is GmsDailyPerformance ordered by GMS revenue; ads is context only', async () => {
        await invoke({ query: { period: '14d' }, user: bmUser('u-unit-source') });

        const topAsins = mockState.pool.callWhere(/TOP 200/);
        // GMS aggregate is the driving table…
        expect(topAsins.sql).toMatch(/WITH GmsAgg AS \([\s\S]*FROM GmsDailyPerformance g[\s\S]*GROUP BY g\.Asin/);
        expect(topAsins.sql).toMatch(/FROM GmsAgg G\s+JOIN Asins A ON A\.AsinCode = G\.Asin/);
        expect(topAsins.sql).toMatch(/ORDER BY G\.GmsRevenue DESC, G\.GmsUnits DESC/);
        // …ads is only LEFT JOINed, window + daily restricted.
        expect(topAsins.sql).toMatch(/LEFT JOIN AdsAgg AD ON AD\.Asin = G\.Asin/);
        expect(topAsins.sql).toMatch(/AP\.Date BETWEEN @startDate AND @endDate\s+AND AP\.ReportType = 'daily'/);
        // Never ordered by ad orders again.
        expect(topAsins.sql).not.toMatch(/ORDER BY TotalOrders/);
        // Seller scope is applied on the aliased Asins table.
        expect(topAsins.sql).toMatch(/AND A\.SellerId IN \(@dashSeller_0\)/);
    });

    test('revenue/units are the ASIN GMS (ordered revenue/units) — no CurrentPrice or ad-sales leak', async () => {
        const { payload } = await invoke({ query: { period: '30d' }, user: bmUser('u-unit-rev') });

        expect(payload.tableData.map(r => r.asin)).toEqual(['B0GMSKING', 'B0TEST0001']);

        const king = payload.tableData[0];
        expect(king.rank).toBe(1);
        expect(king.revenue).toBe(700);        // legacy key = GMS
        expect(king.gmsRevenue).toBe(700);
        expect(king.units).toBe(7);
        expect(king.asp).toBe(100);
        expect(king.deltaPct).toBe(100);       // 700 vs 350
        expect(king.adSales).toBe(0);
        expect(king.tacos).toBe(0);
        expect(king.acos).toBe('0.0%');
        expect(king.returnRate).toBeCloseTo(14.29, 1);
        expect(king.sellerName).toBe('ACME');
        expect(king.marketplace).toBe('Amazon');
        expect(Array.isArray(king.trend)).toBe(true);
        expect(king.trend.reduce((a, b) => a + b, 0)).toBe(700);

        const widget = payload.tableData[1];
        // CurrentPrice (999) and ad sales (100) must NOT define revenue.
        expect(widget.revenue).toBe(300);
        expect(widget.deltaPct).toBeNull();    // no previous-period GMS → no fake 0%
        expect(widget.acos).toBe('25.0%');
        expect(widget.acosPct).toBe(25);
        expect(widget.tacos).toBeCloseTo(8.33, 2);
        expect(widget.adShare).toBeCloseTo(33.33, 2);
        expect(widget.share).toBe(30);         // 300 of the 1000 period GMS
    });

    test('sparkline query is restricted to the leaders and the current window', async () => {
        await invoke({ query: { period: '30d' }, user: bmUser('u-unit-spark') });

        const spark = mockState.pool.callWhere(/AND g\.Asin IN \(/);
        expect(spark).not.toBeNull();
        expect(spark.sql).toMatch(/WHERE g\.Date BETWEEN @startDate AND @endDate/);
        expect(spark.inputs.sparkAsin_0).toBe('B0GMSKING');
        expect(spark.inputs.sparkAsin_1).toBe('B0TEST0001');
    });

    test('returns orders/units/ACoS series with actual order counts from the current window only', async () => {
        const { payload } = await invoke({ query: { period: '30d' }, user: bmUser('u-unit-series') });

        expect(Array.isArray(payload.ordersSeries)).toBe(true);
        expect(Array.isArray(payload.unitsSeries)).toBe(true);
        expect(Array.isArray(payload.acosSeries)).toBe(true);

        // Current-window orders (5) only — the previous-window row (9) is
        // excluded from the series, and no ×1.48 estimate is applied.
        expect(payload.ordersSeries.reduce((a, b) => a + b, 0)).toBe(5);
        expect(payload.unitsSeries.reduce((a, b) => a + b, 0)).toBe(5);
        expect(payload.gms.series.reduce((a, b) => a + b, 0)).toBe(1000);
        expect(payload.gms.series.length).toBe(payload.labels.length);
    });

    test('deep-data blocks: gms / ads / previous carry period-over-period deltas', async () => {
        const { payload } = await invoke({ query: { period: '30d' }, user: bmUser('u-unit-deep') });

        expect(payload.gms.revenue).toBe(1000);
        expect(payload.gms.units).toBe(10);
        expect(payload.gms.prevRevenue).toBe(800);
        expect(payload.gms.deltaPct).toBe(25);
        expect(payload.gms.tacos).toBe(2.5);      // 25 spend ÷ 1000 GMS
        expect(payload.gms.adShare).toBe(10);     // 100 ad sales ÷ 1000 GMS
        expect(payload.gms.asinsWithSales).toBe(2);

        expect(payload.ads.adSales).toBe(100);
        expect(payload.ads.adSpend).toBe(25);
        expect(payload.ads.acos).toBe(25);
        expect(payload.ads.roas).toBe(4);

        expect(payload.previous.adSales).toBe(80);
        expect(payload.previous.adSpend).toBe(40);
        expect(payload.previous.orders).toBe(9);
        expect(payload.previous.gmsRevenue).toBe(800);

        expect(payload.period.days).toBe(30);
        expect(payload.period.granularity).toBe('day');
        expect(payload.period.prevEndDate < payload.period.startDate).toBe(true);

        expect(payload.gmsBySeller).toEqual([
            expect.objectContaining({ sellerId: 's1', sellerName: 'ACME', revenue: 1000, prevRevenue: 800, deltaPct: 25, share: 100 }),
        ]);
        expect(payload.gmsByMarketplace[0]).toEqual(expect.objectContaining({ name: 'Amazon', revenue: 1000 }));
    });

    test('explicit yyyy-mm-dd range is parsed as local dates (no off-by-one) and previous window precedes it', async () => {
        const { payload, statusCode } = await invoke({
            query: { startDate: '2026-08-20', endDate: '2026-09-18' },
            user: bmUser('u-unit-range'),
        });

        expect(statusCode).toBeUndefined();
        expect(payload.period).toEqual(expect.objectContaining({
            startDate: '2026-08-20',
            endDate: '2026-09-18',
            days: 30,
            prevStartDate: '2026-07-21',
            prevEndDate: '2026-08-19',
        }));
        // 30 daily buckets, last label is the end date.
        expect(payload.labels.length).toBe(30);
        expect(payload.period.bucketKeys[0]).toBe('2026-08-20');
        expect(payload.period.bucketKeys[29]).toBe('2026-09-18');
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
        // The GMS daily series is scoped to the same sellers via EXISTS.
        const gmsDaily = mockState.pool.callWhere(/FROM GmsDailyPerformance g\s+WHERE g\.Date BETWEEN @prevStart AND @endDate\s+AND EXISTS/);
        expect(gmsDaily.sql).toMatch(/AND A\.SellerId IN \(@dashSeller_0,@dashSeller_1\)/);
        expect(gmsDaily.inputs.dashSeller_1).toBe('s2');
    });
});
