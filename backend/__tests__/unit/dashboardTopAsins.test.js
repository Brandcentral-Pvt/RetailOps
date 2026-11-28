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

const { makeDashboardPool } = require('../../testUtils/dashboardBatchFixture');
const dashboardController = require('../../controllers/dashboardController');

const NOW = new Date();
const daysAgo = (n) => {
    const d = new Date(NOW);
    d.setDate(d.getDate() - n);
    return d;
};

const buildPool = () => makeDashboardPool([
    { match: /SUM\(CASE WHEN Status IN/, rows: [{ Total: 10, Active: 8, OutOfStock: 1, NewThisMonth: 2, PortfolioValue: 5000 }] },
    { match: /COUNT\(\*\) as Total/, rows: [{ Total: 3, Active: 2 }] },
    { match: /TOP 5/, rows: [] },
    { match: /FROM Actions/, rows: [{ Status: 'Pending', Count: 2 }] },
    {
        // Per-day ads aggregate over current + previous window.
        section: 'ads',
        rows: [
            { Date: NOW, AdSales: 100, AdSpend: 25, Orders: 5, TotalUnits:7,TotalUnitsCount:1,Conversions:2,ConversionsCount:1,cvrPairCount:1, OrganicSales: 150, Impressions: 900, Clicks:40,FactRows:1,AdSalesCount:1,AdSpendCount:1,TotalSalesCount:1,OrganicSalesCount:1,OrdersCount:1,ImpressionsCount:1,ClicksCount:1,acosPairCount:1,tacosPairCount:1,adSharePairCount:1,roasPairCount:1,ctrPairCount:1,cpcPairCount:1,TotalSales:500 },
            // previous-window row (must NOT leak into current KPIs / series)
            { Date: daysAgo(45), AdSales: 80, AdSpend: 40, Orders: 9, OrganicSales: 20, Impressions: 500, Clicks:10,FactRows:1,AdSalesCount:1,AdSpendCount:1,TotalSalesCount:1,OrganicSalesCount:1,OrdersCount:1,ImpressionsCount:1,ClicksCount:1,acosPairCount:1,tacosPairCount:1,adSharePairCount:1,roasPairCount:1,ctrPairCount:1,cpcPairCount:1,TotalSales:500 },
        ],
    },
    {
        // Per-day GMS aggregate over current + previous window.
        section: 'daily',
        rows: [
            { Date: NOW, Revenue: 1000, Units: 10, ShippedRevenue: 900, Returns: 1 },
            { Date: daysAgo(45), Revenue: 800, Units: 8, ShippedRevenue: 700, Returns: 0 },
        ],
    },
    { section: 'selling', rows: [{ AsinsWithSales: 2 }] },
    { match: /SELECT SellerId, COUNT\(\*\) as Count/, rows: [{ SellerId: 's1', Count: 4 }] },
    { match: /SELECT Id, Marketplace FROM Sellers/, rows: [{ Id: 's1', Marketplace: 'Amazon' }] },
    {
        // GMS-ranked top products (already ordered by GmsRevenue DESC).
        section: 'products',
        rows: [
            {
                Id: 'a2', AsinCode: 'B0GMSKING', Sku: 'SKU-2', Title: 'Best seller (no ads)',
                Category: 'Home', Brand: 'ACME', ParentAsin: null, CurrentPrice: 4999, ImageUrl: null,
                Status: 'Active', AvailabilityStatus: 'In Stock', SellerId: 's1', SellerName: 'ACME', Marketplace: 'Amazon',
                GmsRevenue: 700, GmsUnits: 7, ShippedRevenue: 650, Returns: 1,
                PrevGmsRevenue: 350, PrevGmsUnits: 4, ActiveDays: 3,
                AdSales:null,AdSpend:null,Orders:null,FactRows:0,
            },
            {
                Id: 'a1', AsinCode: 'B0TEST0001', Sku: 'SKU-1', Title: 'Widget',
                Category: 'Home', Brand: 'ACME', ParentAsin: 'P1', CurrentPrice: 999, ImageUrl: null,
                Status: 'Active', AvailabilityStatus: 'In Stock', SellerId: 's1', SellerName: 'ACME', Marketplace: 'Amazon',
                GmsRevenue: 300, GmsUnits: 3, ShippedRevenue: 250, Returns: 0,
                PrevGmsRevenue: 0, PrevGmsUnits: 0, ActiveDays: 2,
                AdSales:100,AdSpend:25,Orders:5,TotalUnits:7,TotalUnitsCount:1,Conversions:2,ConversionsCount:1,cvrPairCount:1,FactRows:1,AdSalesCount:1,AdSpendCount:1,TotalSalesCount:1,OrganicSalesCount:1,OrdersCount:1,ImpressionsCount:1,ClicksCount:1,acosPairCount:1,tacosPairCount:1,adSharePairCount:1,roasPairCount:1,ctrPairCount:1,cpcPairCount:1,TotalSales:500,
            },
        ],
    },
    {
        // Per-ASIN sparkline rows for the leaders.
        section: 'spark',
        rows: [
            { Asin: 'B0GMSKING', SellerId: 's1', Date: NOW, Revenue: 400, Units: 4 },
            { Asin: 'B0GMSKING', SellerId: 's1', Date: daysAgo(1), Revenue: 300, Units: 3 },
        ],
    },
    {
        section: 'sellers',
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

        const topAsins = mockState.pool.callWhere(/INTO #DashLeaders/);
        expect(topAsins).not.toBeNull();
        expect(topAsins.inputs.dashSeller_0).toBe('s1');
        expect(topAsins.inputs.startDate).toBeDefined();
        expect(topAsins.inputs.endDate).toBeDefined();
        expect(topAsins.inputs.prevStart).toBeDefined();
    });

    test('ranking source is GmsDailyPerformance ordered by GMS revenue; ads is context only', async () => {
        await invoke({ query: { period: '14d' }, user: bmUser('u-unit-source') });

        const topAsins = mockState.pool.callWhere(/INTO #DashLeaders/);
        // GMS aggregate is the driving table…
        expect(topAsins.sql).toMatch(/INTO #DashProductAgg FROM #DashGms g GROUP BY g\.Asin,g\.SellerId,g\.CatalogId/);
        expect(topAsins.sql).toMatch(/FROM #DashProductAgg G JOIN dbo\.Sellers S ON G\.SellerId=S\.Id/);
        expect(topAsins.sql).toMatch(/ORDER BY TRY_CONVERT\(decimal\(38,2\),G\.GmsRevenue\) DESC,TRY_CONVERT\(bigint,G\.GmsUnits\) DESC/);
        // …ads is only LEFT JOINed, window + daily restricted.
        expect(topAsins.sql).toMatch(/LEFT JOIN AdsAgg AD ON AD\.Asin=L\.Asin AND AD\.SellerId=L\.SellerId/);
        expect(topAsins.sql).toMatch(/AP\.Date>=@startDate AND AP\.Date<DATEADD\(day,1,@endDate\) AND AP\.ReportType='daily'/);
        // Never ordered by ad orders again.
        expect(topAsins.sql).not.toMatch(/ORDER BY TotalOrders/);
        // Seller scope is applied on the aliased Asins table.
        expect(topAsins.sql).toMatch(/AND u\.SellerId IN \(@dashSeller_0\)/i);
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
        expect(king.deltaPct).toBeNull(); // sparse coverage: suppress incomparable changes
        expect(king.adSales).toBeNull();
        expect(king.tacos).toBeNull();
        expect(king.acos).toBe('N/A');
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
        expect(widget.tacos).toBeCloseTo(5,2);
        expect(widget.adShare).toBeCloseTo(20,2);
        expect(widget.share).toBe(30);         // 300 of the 1000 period GMS
    });

    test('sparkline query is restricted to the leaders and the current window', async () => {
        await invoke({ query: { period: '30d' }, user: bmUser('u-unit-spark') });

        const spark = mockState.pool.callWhere(/L\.RankNumber<=25/);
        expect(spark).not.toBeNull();
        expect(spark.sql).toMatch(/WHERE g\.Date>=@startDate AND L\.RankNumber<=25/);
        expect(spark.sql).toContain('L.Asin=g.Asin AND L.SellerId=g.SellerId');
        expect(spark.inputs.dashSeller_0).toBe('s1');
    });

    test('returns orders/units/ACoS series with actual order counts from the current window only', async () => {
        const { payload } = await invoke({ query: { period: '30d' }, user: bmUser('u-unit-series') });

        expect(Array.isArray(payload.ordersSeries)).toBe(true);
        expect(Array.isArray(payload.unitsSeries)).toBe(true);
        expect(Array.isArray(payload.acosSeries)).toBe(true);

        // Current-window orders (5) only — the previous-window row (9) is
        // excluded from the series, and no ×1.48 estimate is applied.
        expect(payload.ordersSeries.reduce((a, b) => a + b, 0)).toBe(5);
        expect(payload.unitsSeries.reduce((a, b) => a + b, 0)).toBe(7);
        expect(payload.gms.series.reduce((a, b) => a + b, 0)).toBe(1000);
        expect(payload.gms.series).toContain(null);
        expect(payload.gms.coverage).toEqual({observedDays:1,expectedDays:30,complete:false});
        expect(payload.gms.series.length).toBe(payload.labels.length);
    });

    test('deep-data blocks: gms / ads / previous carry period-over-period deltas', async () => {
        const { payload } = await invoke({ query: { period: '30d' }, user: bmUser('u-unit-deep') });

        expect(payload.gms.revenue).toBe(1000);
        expect(payload.gms.units).toBe(10);
        expect(payload.gms.prevRevenue).toBe(800);
        expect(payload.gms.deltaPct).toBeNull(); // incomplete coverage in both windows
        expect(payload.gms.tacos).toBe(5);      // 25 spend ÷ 1000 GMS
        expect(payload.gms.adShare).toBe(20);     // 100 ad sales ÷ 1000 GMS
        expect(payload.gms.asinsWithSales).toBe(2);

        expect(payload.ads.adSales).toBe(100);
        expect(payload.ads.adSpend).toBe(25);
        expect(payload.ads.acos).toBe(25);
        expect(payload.ads.roas).toBe(4);
        expect(payload.ads.exactTotals.AdSales).toBe('100');
        expect(payload.ads.comparison.metrics.AdSales).toBeNull();
        expect(payload.ads.cvr).toBe(5);
        expect(payload.roasSeries.filter(v=>v!=null)).toEqual([4]);

        expect(payload.previous.adSales).toBe(80);
        expect(payload.previous.adSpend).toBe(40);
        expect(payload.previous.orders).toBe(9);
        expect(payload.previous.gmsRevenue).toBe(800);

        expect(payload.period.days).toBe(30);
        expect(payload.period.granularity).toBe('day');
        expect(payload.period.prevEndDate < payload.period.startDate).toBe(true);

        expect(payload.gmsBySeller).toEqual([
            expect.objectContaining({ sellerId: 's1', sellerName: 'ACME', revenue: 1000, prevRevenue: 800, deltaPct: null, share: 100 }),
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
        const topAsins = mockState.pool.callWhere(/INTO #DashLeaders/);
        expect(topAsins.inputs.dashSeller_0).toBe('s1');
        expect(topAsins.inputs.dashSeller_1).toBe('s2');
        // The GMS daily series is scoped to the same sellers via EXISTS.
        const gmsDaily = mockState.pool.callWhere(/GROUP BY g\.Date\b/);
        expect(gmsDaily.sql).toMatch(/AND u\.SellerId IN \(@dashSeller_0,@dashSeller_1\)/);
        expect(gmsDaily.inputs.dashSeller_1).toBe('s2');
    });
});

describe('Phase 1 date and GMS coverage regressions',()=>{
    test.each([{period:'0d'},{period:'999d'},{period:'bad'},{startDate:'2026-02-30',endDate:'2026-03-01'},{startDate:'2026-03-02',endDate:'2026-03-01'},{startDate:'2026-03-01'}])('invalid window %j fails before SQL',async query=>{
        const {statusCode}=await invoke({query,user:bmUser('invalid-window')});
        expect(statusCode).toBe(400);
        expect(mockState.pool.calls).toHaveLength(0);
    });
    test('30d includes exactly 30 calendar dates',async()=>{
        const {payload}=await invoke({query:{period:'30d'},user:bmUser('range')});
        expect((Date.parse(payload.period.endDate)-Date.parse(payload.period.startDate))/86400000+1).toBe(30);
    });
    test('every GMS aggregate uses ownership resolution, including sparkline',async()=>{
        await invoke({query:{period:'30d'},user:bmUser('scope')});
        const reads=mockState.pool.calls.filter(x=>x.sql.includes('FROM dbo.GmsDailyPerformance g'));
        expect(reads).toHaveLength(1);
        for(const q of reads){
            expect(q.sql).toMatch(/INTO #DashMap/);
            expect(q.sql).toMatch(/u\.SellerId IN \(@dashSeller_0\)/i);
            expect(q.sql).toMatch(/COUNT_BIG\(DISTINCT SellerId\)=1/);
            expect(q.inputs.dashSeller_0).toBe('s1');
        }
    });
});

describe('Dashboard range loading hotfix',()=>{
 test('overview excludes heavy rankings, products are separate',async()=>{
  const user=bmUser('range');
  const a=await invoke({user,query:{mode:'overview',period:'30d'}});
  expect(a.payload.productsIncluded).toBe(false);
  expect(a.payload.gms.revenue).toBe(1000);
  expect(a.payload.tableData).toEqual([]);
  expect(mockState.pool.callWhere(/INTO #DashLeaders/)).toBeNull();
  const b=await invoke({user,query:{mode:'products',period:'30d'}});
  expect(b.payload.tableData).toHaveLength(2);
  expect(b.payload.gmsRevenue).toBe(a.payload.gms.revenue);
  expect(b.payload.period).toEqual(a.payload.period);
 });
});
