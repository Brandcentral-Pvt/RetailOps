/**
 * Regression tests for dashboard data access & permission alignment.
 *
 * Acceptance criteria covered:
 *   - Authorized admins and brand managers can load the dashboard
 *     (brand managers hold `targets_view`, not `dashboard_view`).
 *   - Seller selection does not cause SQL errors — every /dashboard query
 *     that embeds the seller IN-clause must have the @dashSeller_* params
 *     BOUND on that same request (the top-ASINs query used to miss them).
 *   - Top products are ranked by the ASIN's GMS (GmsDailyPerformance ordered
 *     revenue), respect the selected period, and only LEFT JOIN the
 *     daily-report-restricted ads aggregate for context columns.
 */
const express = require('express');
const request = require('supertest');

let mockState = { user: null, pool: null };

jest.mock('../../database/db', () => {
    const { FAKE_SQL } = require('../../testUtils/fakePool');
    return {
        sql: FAKE_SQL,
        getPool: async () => mockState.pool,
        generateId: () => 'gen-id-1',
    };
});

// Mirrors the semantics of middleware/auth.js requirePermission /
// requireAnyPermission (admin & super_admin bypass, then the user's
// hasPermission/hasAnyPermission), without importing redis/jwt side effects.
jest.mock('../../middleware/auth', () => {
    const deny = (res, message, status) => res.status(status).json({ success: false, message });
    return {
        authenticate: (req, res, next) => {
            if (!mockState.user) return deny(res, 'Authentication required', 401);
            req.user = mockState.user;
            next();
        },
        requirePermission: (permissionName) => async (req, res, next) => {
            if (!mockState.user) return deny(res, 'Authentication required', 401);
            const roleName = req.user.role?.name || req.user.role;
            if (roleName === 'admin' || roleName === 'super_admin') return next();
            if (!(await req.user.hasPermission(permissionName))) {
                return deny(res, 'Missing required permission', 403);
            }
            next();
        },
        requireAnyPermission: (permissionNames) => async (req, res, next) => {
            if (!mockState.user) return deny(res, 'Authentication required', 401);
            const roleName = req.user.role?.name || req.user.role;
            if (roleName === 'admin' || roleName === 'super_admin') return next();
            if (!(await req.user.hasAnyPermission(permissionNames))) {
                return deny(res, 'Missing required permissions', 403);
            }
            next();
        },
    };
});

const dataRoutes = require('../../routes/dataRoutes');
const alertsRoutes = require('../../routes/alertsRoutes');
const { makeDashboardPool } = require('../../testUtils/dashboardBatchFixture');

const NOW = new Date();

const dashboardPool = () => makeDashboardPool([
    { match: /SUM\(CASE WHEN Status IN/, rows: [{ Total: 10, Active: 8, OutOfStock: 1, NewThisMonth: 2, PortfolioValue: 5000 }] },
    { match: /COUNT\(\*\) as Total/, rows: [{ Total: 3, Active: 2 }] },
    { match: /TOP 5/, rows: [] },
    { match: /FROM Actions/, rows: [{ Status: 'Pending', Count: 2 }] },
    {
        section: 'ads',
        rows: [{
            AsinCode: 'B0TEST0001',
            Date: NOW,
            AdSales: 100,
            AdSpend: 25,
            Orders: 5, TotalUnits:7,TotalUnitsCount:1,Conversions:2,ConversionsCount:1,cvrPairCount:1,
            OrganicSales: 150,
            Impressions: 900,
            Clicks:40,FactRows:1,AdSalesCount:1,AdSpendCount:1,TotalSalesCount:1,OrganicSalesCount:1,OrdersCount:1,ImpressionsCount:1,ClicksCount:1,acosPairCount:1,tacosPairCount:1,adSharePairCount:1,roasPairCount:1,ctrPairCount:1,cpcPairCount:1,TotalSales:500,
        }],
    },
    { match: /SELECT SellerId, COUNT\(\*\) as Count/, rows: [{ SellerId: 's1', Count: 4 }] },
    { match: /SELECT Id, Marketplace FROM Sellers/, rows: [{ Id: 's1', Marketplace: 'Amazon' }] },
    {
        // GMS-ranked top products: revenue/units come from GmsDailyPerformance.
        section: 'products',
        rows: [{
            Id: 'a1', AsinCode: 'B0TEST0001', Sku: 'SKU-1', Title: 'Widget',
            Category: 'Home', CurrentPrice: 4999, SellerId: 's1', SellerName: 'ACME', Marketplace: 'Amazon',
            GmsRevenue: 250, GmsUnits: 5, ShippedRevenue: 200, Returns: 0,
            PrevGmsRevenue: 0, PrevGmsUnits: 0, ActiveDays: 1,
            AdSales:100,AdSpend:25,Orders:5,TotalUnits:7,TotalUnitsCount:1,Conversions:2,ConversionsCount:1,cvrPairCount:1,FactRows:1,AdSalesCount:1,AdSpendCount:1,TotalSalesCount:1,OrganicSalesCount:1,OrdersCount:1,ImpressionsCount:1,ClicksCount:1,acosPairCount:1,tacosPairCount:1,adSharePairCount:1,roasPairCount:1,ctrPairCount:1,cpcPairCount:1,TotalSales:500,
        }],
    },
    // Manager assignments are looked up from the authoritative junction.
    {match:/SELECT DISTINCT us\.SellerId FROM dbo\.UserSellers/,rows:entry=>entry.inputs.managerId==='m1'?[{SellerId:'s1'}]:entry.inputs.managerId==='m2'?[{SellerId:'s2'}]:[]},
    // /alerts endpoint
    { match: /FROM Alerts a/, rows: [] },
]);

const mkUser = ({ id, role = 'brand_manager', permissions = [], assignedSellers = [] }) => ({
    Id: id,
    _id: id,
    role: { name: role },
    assignedSellers,
    hasPermission: async (p) => permissions.includes(p),
    hasAnyPermission: async (ps) => ps.some(p => permissions.includes(p)),
});

const buildApp = () => {
    const app = express();
    app.use(express.json());
    app.use('/api', dataRoutes);
    app.use('/api', alertsRoutes);
    return app;
};

beforeEach(() => {
    mockState.user = null;
    mockState.pool = dashboardPool();
});

describe('GET /api/dashboard — permission alignment', () => {
    test('admin can load the dashboard', async () => {
        mockState.user = mkUser({ id: 'u-admin-1', role: 'admin' });
        const res = await request(buildApp()).get('/api/dashboard');
        expect(res.status).toBe(200);
        expect(res.body.kpi).toBeDefined();
    });

    test('brand manager with only targets_view can load the dashboard', async () => {
        mockState.user = mkUser({ id: 'u-bm-dash', permissions: ['targets_view'], assignedSellers: ['s1'] });
        const res = await request(buildApp()).get('/api/dashboard');
        expect(res.status).toBe(200);
        expect(res.body.tableData).toBeDefined();
    });

    test('brand manager with only targets_view can load dashboard alerts', async () => {
        mockState.user = mkUser({ id: 'u-bm-alerts', permissions: ['targets_view'], assignedSellers: ['s1'] });
        const res = await request(buildApp()).get('/api/alerts');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    test('user without dashboard_view or targets_view is rejected', async () => {
        mockState.user = mkUser({ id: 'u-other-1', permissions: ['skureport_view'], assignedSellers: ['s1'] });
        const dash = await request(buildApp()).get('/api/dashboard');
        expect(dash.status).toBe(403);

        const alerts = await request(buildApp()).get('/api/alerts');
        expect(alerts.status).toBe(403);
    });

    test('unauthenticated request is rejected', async () => {
        const res = await request(buildApp()).get('/api/dashboard');
        expect(res.status).toBe(401);
    });
});

describe('GET /api/dashboard — SQL binding & period correctness', () => {
    test('seller selection binds @dashSeller_* params on every scoped query', async () => {
        mockState.user = mkUser({ id: 'u-bind-1', permissions: ['targets_view'], assignedSellers: ['s1', 's2'] });
        const res = await request(buildApp()).get('/api/dashboard?sellerId=s1');
        expect(res.status).toBe(200);

        // THE regression: the top-ASINs query used pool.request() (no params
        // bound) while its SQL referenced @dashSeller_0 → MSSQL error.
        const topAsins = mockState.pool.callWhere(/INTO #DashLeaders/);
        expect(topAsins).not.toBeNull();
        expect(topAsins.inputs.dashSeller_0).toBe('s1');

        const adsQuery = mockState.pool.callWhere(/FROM dbo\.AdsProductDailyFacts AP[\s\S]*GROUP BY AP\.Date/);
        expect(adsQuery.inputs.dashSeller_0).toBe('s1');

        const asinCounts = mockState.pool.callWhere(/SUM\(CASE WHEN Status IN/);
        expect(asinCounts.inputs.dashSeller_0).toBe('s1');
    });

    test('top-products query is GMS-ranked, restricted to the selected period and daily ad reports', async () => {
        mockState.user = mkUser({ id: 'u-period-1', permissions: ['targets_view'], assignedSellers: ['s1'] });
        const res = await request(buildApp()).get('/api/dashboard?period=7d');
        expect(res.status).toBe(200);

        const topAsins = mockState.pool.callWhere(/INTO #DashLeaders/);
        // Ranking is driven by GMS (ordered revenue), not by AdsPerformance.
        expect(topAsins.sql).toMatch(/FROM dbo\.GmsDailyPerformance g[\s\S]*WHERE g\.Date>=@prevStart AND g\.Date<DATEADD\(day,1,@endDate\)/);
        expect(topAsins.sql).toMatch(/ORDER BY TRY_CONVERT\(decimal\(38,2\),G\.GmsRevenue\) DESC/);
        // Ads is context only: LEFT JOIN of a window + daily restricted aggregate.
        expect(topAsins.sql).toMatch(/LEFT JOIN AdsAgg AD ON AD\.Asin=L\.Asin AND AD\.SellerId=L\.SellerId/);
        expect(topAsins.sql).toMatch(/AP\.Date>=@startDate AND AP\.Date<DATEADD\(day,1,@endDate\) AND AP\.ReportType='daily'/);
        expect(topAsins.inputs.startDate).toBeDefined();
        expect(topAsins.inputs.endDate).toBeDefined();

        // 7d period → ~7-day window between the bound dates.
        const spanDays = Math.round(
            (new Date(topAsins.inputs.endDate) - new Date(topAsins.inputs.startDate)) / 86_400_000
        );
        expect(spanDays).toBeGreaterThanOrEqual(6);
        expect(spanDays).toBeLessThanOrEqual(8);
    });

    test('revenue is the ASIN GMS (no CurrentPrice / ad-sales fallback) and series are returned', async () => {
        mockState.user = mkUser({ id: 'u-rev-1', permissions: ['targets_view'], assignedSellers: ['s1'] });
        const res = await request(buildApp()).get('/api/dashboard');
        expect(res.status).toBe(200);

        // CurrentPrice is 4999 and ad sales 100 — revenue must be the GMS
        // ordered revenue (250) and units the GMS ordered units (5).
        expect(res.body.tableData[0].revenue).toBe(250);
        expect(res.body.tableData[0].gmsRevenue).toBe(250);
        expect(res.body.tableData[0].units).toBe(5);
        expect(res.body.tableData[0].adSales).toBe(100);
        expect(res.body.gms).toBeDefined();
        expect(res.body.previous).toBeDefined();

        // Chart series that used to be computed but never returned.
        expect(Array.isArray(res.body.ordersSeries)).toBe(true);
        expect(Array.isArray(res.body.unitsSeries)).toBe(true);
        expect(Array.isArray(res.body.acosSeries)).toBe(true);
        expect(res.body.unitsSeries.reduce((a, b) => a + b, 0)).toBe(7);
    });
});

describe('Dashboard Phase 2: manager intersections and route permissions',()=>{
    test('manager scope is resolved on the server, not from client targets',async()=>{
        mockState.user=mkUser({id:'admin',role:'admin'});
        const response=await request(buildApp()).get('/api/dashboard?managerId=m1');
        expect(response.status).toBe(200);
        expect(response.body.scope).toEqual({sellerIds:['s1'],unrestricted:false,empty:false,managerId:'m1'});
        expect(mockState.pool.callWhere(/INTO #DashLeaders/).inputs.dashSeller_0).toBe('s1');
    });
    test('an empty manager intersection never becomes all sellers',async()=>{
        mockState.user=mkUser({id:'admin',role:'admin'});
        const response=await request(buildApp()).get('/api/dashboard?managerId=m2&sellerId=s1');
        expect(response.status).toBe(200);
        expect(response.body.scope.empty).toBe(true);
        expect(response.body.scope.unrestricted).toBe(false);
        expect(mockState.pool.callWhere(/FROM dbo\.AdsProductDailyFacts AP[\s\S]*GROUP BY AP\.Date/).sql).toMatch(/AND 1=0/);
    });
    test('unauthorized seller is rejected before resolving manager',async()=>{
        mockState.user=mkUser({id:'restricted',permissions:['dashboard_view'],assignedSellers:['s1']});
        const response=await request(buildApp()).get('/api/dashboard?managerId=m1&sellerId=s2');
        expect(response.status).toBe(403);
        expect(mockState.pool.calls).toHaveLength(0);
    });
    test('dashboard tasks require task permission',async()=>{
        mockState.user=mkUser({id:'restricted',permissions:['dashboard_view'],assignedSellers:['s1']});
        const response=await request(buildApp()).get('/api/dashboard/tasks');
        expect(response.status).toBe(403);
    });
    test('alerts honor manager and seller filters and reject foreign seller',async()=>{
        mockState.user=mkUser({id:'restricted',permissions:['dashboard_view'],assignedSellers:['s1']});
        const empty=await request(buildApp()).get('/api/alerts?managerId=m2');
        expect(empty.status).toBe(200);
        expect(empty.body.data).toEqual([]);
        expect(mockState.pool.callWhere(/FROM Alerts a/)).toBeNull();
        expect((await request(buildApp()).get('/api/alerts?sellerId=s2')).status).toBe(403);
    });
});
