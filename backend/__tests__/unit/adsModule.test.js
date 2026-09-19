/**
 * Ads module regression tests.
 *
 * These pin the behaviours the upgrade was built to guarantee (see
 * docs/ads-module-deep-dive.md):
 *
 *  F1  every ads read is scoped to the caller's assigned sellers — a request
 *      for a foreign seller is 403, never "some other seller's numbers";
 *  F2  export/upload carry their own permission + scope, and Downloads row is
 *      owned by the acting user;
 *  F3  the table paginates in SQL (`OFFSET … FETCH NEXT`) with a real total;
 *  F11 `ReportType` is always part of the WHERE clause;
 *  and the deterministic insight layer never invents a metric.
 *
 * The pool is mocked with the shared fake (`testUtils/fakePool`), so no
 * database is required.
 */

// Redirect generated workbooks into the OS temp dir: the export test starts the
// real background job, which writes a real .xlsx.
process.env.ADS_EXPORTS_DIR = require('path').join(require('os').tmpdir(), 'retailops-ads-export-test');

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

const { buildAdsPool } = require('../../testUtils/adsFixtures');
const { resolveSellerScope, bindSellerFilter, parseSellerIds } = require('../../utils/sellerScope');
const analytics = require('../../services/adsAnalytics');
const { buildInsights, buildAiDigest } = require('../../services/adsInsights');
const { normaliseNarrative, extractJson } = require('../../services/adsAiService');

const adsController = require('../../controllers/adsController');
const exportAds = require('../../controllers/exportAdsController');

/* ─────────────────────────────── fixtures ─────────────────────────────── */

const GLOBAL_USER = { Id: 'u-admin', role: { Name: 'admin' }, assignedSellers: [] };
const SCOPED_USER = { Id: 'u-bm', role: { Name: 'brand_manager' }, assignedSellers: ['S1', 'S2'] };
const EMPTY_USER = { Id: 'u-none', role: { Name: 'listing_team' }, assignedSellers: [] };

/** Minimal express-style response double. */
function makeRes() {
    const res = {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; },
    };
    return res;
}

beforeEach(() => {
    mockState.pool = buildAdsPool();
});

/* ─────────────────────────── seller scope (F1) ─────────────────────────── */

describe('seller scope', () => {
    test('a scoped user without a selection is filtered to their assigned sellers', () => {
        const scope = resolveSellerScope(SCOPED_USER, undefined);
        expect(scope.denied).toBe(false);
        expect(scope.empty).toBe(false);
        expect(scope.sellerIds).toEqual(['S1', 'S2']);
    });

    test('requesting a foreign seller is denied (never silently widened)', () => {
        const scope = resolveSellerScope(SCOPED_USER, 'S9');
        expect(scope.denied).toBe(true);
        expect(scope.sellerIds).toEqual([]);
    });

    test('a user with no assignments resolves to empty → the query must return nothing', () => {
        const scope = resolveSellerScope(EMPTY_USER, undefined);
        expect(scope.empty).toBe(true);
        const inputs = {};
        const sqlText = bindSellerFilter({ input: (n, t, v) => { inputs[n] = v; return this; } }, scope, { alias: 'a' });
        expect(sqlText).toContain('1 = 0');
    });

    test('global roles are unrestricted unless they pick a seller', () => {
        expect(bindSellerFilter({ input: () => {} }, resolveSellerScope(GLOBAL_USER, undefined))).toBe('');
        const inputs = {};
        const req = { input(name, type, value) { inputs[name] = value; return this; } };
        const sqlText = bindSellerFilter(req, resolveSellerScope(GLOBAL_USER, 'S7'), { alias: 'a' });
        expect(sqlText).toContain('a.SellerId IN (@');
        expect(Object.values(inputs)).toEqual(['S7']);
    });

    test("'all' and '' mean no explicit selection, not a seller id", () => {
        expect(parseSellerIds('all')).toEqual([]);
        expect(parseSellerIds('')).toEqual([]);
        expect(parseSellerIds('S1,S2')).toEqual(['S1', 'S2']);
        expect(resolveSellerScope(SCOPED_USER, 'all').sellerIds).toEqual(['S1', 'S2']);
    });
});

/* ─────────────────────── window / SQL construction ─────────────────────── */

describe('AdsWindow SQL', () => {
    const request = () => {
        const inputs = {};
        return {
            inputs,
            input(name, type, value) { inputs[name] = value === undefined ? type : value; return this; },
        };
    };

    test('always filters ReportType and binds dates as strings (no JS Date drift)', () => {
        const win = new analytics.AdsWindow({
            user: SCOPED_USER,
            query: { startDate: '2026-08-01', endDate: '2026-08-31', reportType: 'daily' },
        });
        win.bind(request());
        const where = win.where();
        expect(where).toContain('p.ReportType = @reportType');
        expect(where).toContain('CAST(@startDate AS date)');
        expect(win.reportType).toBe('daily');
        expect(win.period.prevStart).toBe('2026-07-01');
        expect(win.period.prevEnd).toBe('2026-07-31');
        expect(win.period.days).toBe(31);
    });

    test('reportType defaults to daily and rejects unknown values', () => {
        const win = new analytics.AdsWindow({ user: GLOBAL_USER, query: { reportType: 'weekly' } });
        expect(win.reportType).toBe('daily');
    });

    test('a scoped window binds one parameter per assigned seller', () => {
        const req = request();
        const win = new analytics.AdsWindow({ user: SCOPED_USER, query: { startDate: '2026-08-01', endDate: '2026-08-31' } });
        win.bind(req);
        win.where();
        expect(win.sellerPredicate).toBe(' AND a.SellerId IN (@adsScope_0, @adsScope_1)');
        expect(req.inputs.adsScope_0).toBe('S1');
        expect(req.inputs.adsScope_1).toBe('S2');
    });
});

/* ───────────────────────────── metrics math ───────────────────────────── */

describe('metric derivation', () => {
    test('ratios are null, not zero, when the denominator is unknown', () => {
        const m = analytics.deriveMetrics({ spend: 0, sales: 0, organicSales: 0, impressions: 0, clicks: 0, orders: 0 });
        expect(m.acos).toBeNull();
        expect(m.tacos).toBeNull();
        expect(m.roas).toBeNull();
        expect(m.ctr).toBeNull();
        expect(m.cvr).toBeNull();
    });

    test('ACoS uses ad sales while TACoS includes organic', () => {
        const m = analytics.deriveMetrics({ spend: 1000, sales: 4000, organicSales: 6000, orders: 50 });
        expect(m.acos).toBeCloseTo(25, 5);
        expect(m.tacos).toBeCloseTo(10, 5);
        expect(m.roas).toBeCloseTo(4, 5);
        expect(m.totalSales).toBe(10000);
        expect(m.adSharePct).toBeCloseTo(40, 5);
    });

    test('pctDelta returns null rather than a fake +100% against a zero baseline', () => {
        expect(analytics.pctDelta(500, 0)).toBeNull();
        expect(analytics.pctDelta(150, 100)).toBeCloseTo(50, 5);
        expect(analytics.pctDelta(80, 100)).toBeCloseTo(-20, 5);
    });

    test('period resolution builds a previous window of identical length', () => {
        const p = analytics.resolvePeriod({ startDate: '2026-02-01', endDate: '2026-02-28' });
        expect(p.days).toBe(28);
        expect(p.prevStart).toBe('2026-01-04');
        expect(p.prevEnd).toBe('2026-01-31');
        expect(p.granularity).toBe('day');
    });

    test('granularity auto-scales with the window and the axis is dense', () => {
        expect(analytics.resolvePeriod({ startDate: '2026-01-01', endDate: '2026-08-31' }).granularity).toBe('week');
        expect(analytics.resolvePeriod({ startDate: '2026-08-01', endDate: '2026-08-31' }).granularity).toBe('day');
        expect(analytics.resolvePeriod({ startDate: '2024-01-01', endDate: '2026-08-31' }).granularity).toBe('month');
        expect(analytics.resolvePeriod({ startDate: '2026-08-01', endDate: '2026-08-31', granularity: 'week' }).granularity).toBe('week');
        const axis = analytics.buildAxis({ start: '2026-08-01', end: '2026-08-05', granularity: 'day' });
        expect(axis).toEqual(['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05']);
    });
});

/* ──────────────────────────── overview payload ────────────────────────── */

describe('fetchOverview', () => {
    test('runs one scoped query per panel and returns totals consistent with the series', async () => {
        const win = new analytics.AdsWindow({
            user: SCOPED_USER,
            query: { startDate: '2026-08-01', endDate: '2026-08-28', groupBy: 'asin' },
            pool: mockState.pool,
        });
        const overview = await analytics.fetchOverview(win, { groupBy: 'asin' });

        expect(overview.totals.spend).toBeGreaterThan(0);
        expect(overview.totals.acos).toBeCloseTo((overview.totals.spend / overview.totals.sales) * 100, 6);
        expect(overview.series.keys.length).toBe(28);
        expect(overview.series.current.spend.length).toBe(28);

        // Every AdsPerformance query must filter ReportType and be scoped;
        // the GmsTargets lookup is scoped separately (it has no ReportType).
        const adsQueries = mockState.pool.calls.filter((c) => String(c.sql).includes('FROM AdsPerformance'));
        expect(adsQueries.length).toBeGreaterThan(5);
        for (const call of adsQueries) {
            expect(call.sql).toMatch(/ReportType = @reportType/);
            expect(String(call.inputs.reportType)).toBe('daily');
        }
        const scoped = mockState.pool.calls.filter((c) => String(c.sql).includes('SellerId IN (@adsScope_'));
        expect(scoped.length).toBeGreaterThan(5);
    });

    test('target attainment is derived from GmsTargets, not invented', async () => {
        const win = new analytics.AdsWindow({
            user: SCOPED_USER,
            query: { startDate: '2026-08-01', endDate: '2026-08-28' },
            pool: mockState.pool,
        });
        const overview = await analytics.fetchOverview(win, {});
        expect(overview.targets.ads.target).toBe(200000);
        expect(overview.targets.ads.attainmentPct).toBeCloseTo((overview.totals.spend / 200000) * 100, 6);
        expect(overview.targets.acos.target).toBe(25);
        expect(overview.targets.acos.onTarget).toBe(overview.totals.acos <= 25);
    });
});

/* ─────────────────────────── pagination (F3) ──────────────────────────── */

describe('server-side pagination', () => {
    test('the table query paginates in SQL and reports a real total', async () => {
        const win = new analytics.AdsWindow({
            user: SCOPED_USER,
            query: { startDate: '2026-08-01', endDate: '2026-08-28' },
            pool: mockState.pool,
        });
        const page = await analytics.fetchRows(win, { page: 3, limit: 25, sortBy: 'acos', sortOrder: 'desc' });

        const paged = mockState.pool.callWhere(/OFFSET @offset ROWS/);
        expect(paged).toBeTruthy();
        expect(paged.inputs.offset).toBe(50);
        expect(paged.inputs.limit).toBe(25);
        expect(paged.sql).toContain('COUNT(*) OVER ()');
        expect(paged.sql).toMatch(/ORDER BY CASE WHEN sales > 0 THEN spend \/ sales ELSE NULL END DESC/);
        expect(page.page).toBe(3);
        expect(page.limit).toBe(25);
        expect(page.total).toBe(3);
        expect(page.totalPages).toBe(1);
        expect(page.rows).toHaveLength(2);
    });

    test('limit is clamped and unknown sort fields fall back safely', async () => {
        const win = new analytics.AdsWindow({ user: GLOBAL_USER, query: { startDate: '2026-08-01', endDate: '2026-08-02' }, pool: mockState.pool });
        const page = await analytics.fetchRows(win, { limit: 9999, sortBy: 'spend; DROP TABLE Users', sortOrder: 'sideways' });
        expect(page.limit).toBe(200);
        const paged = mockState.pool.callWhere(/OFFSET @offset ROWS/);
        expect(paged.sql).not.toMatch(/DROP TABLE/);
        expect(paged.sql).toMatch(/ORDER BY totalSales DESC/);
    });

    test('sparklines are chunked below the SQL Server parameter ceiling', async () => {
        const win = new analytics.AdsWindow({ user: GLOBAL_USER, query: { startDate: '2026-08-01', endDate: '2026-08-02' }, pool: mockState.pool });
        const keys = Array.from({ length: 1000 }, (_, i) => `B${String(i).padStart(4, '0')}`);
        await analytics.fetchSparklines(win, keys, 'asin');
        const sparkCalls = mockState.pool.callsWhere(/sparkKey_/);
        expect(sparkCalls.length).toBe(2); // 400 + 100 (keys are capped at 500 per request)
        let total = 0;
        for (const call of sparkCalls) {
            const params = Object.keys(call.inputs).filter((k) => k.startsWith('sparkKey_'));
            expect(params.length).toBeLessThanOrEqual(400);
            total += params.length;
        }
        expect(total).toBe(500);
    });
});

/* ────────────────────────── insights (rules layer) ────────────────────── */

describe('deterministic insights', () => {
    test('flags zero-sales spend, ACoS target misses and stale data with real figures', () => {
        const overview = {
            period: { start: '2026-08-01', end: '2026-08-31', days: 31, granularity: 'day', label: '2026-08-01 → 2026-08-31' },
            reportType: 'daily',
            totals: analytics.deriveMetrics({ spend: 300000, sales: 900000, organicSales: 600000, orders: 900, impressions: 3000000, clicks: 24000 }),
            previous: analytics.deriveMetrics({ spend: 240000, sales: 900000, organicSales: 450000, orders: 900, impressions: 3000000, clicks: 24000 }),
            delta: {},
            previousAvailable: true,
            freshness: { lastDate: '2026-08-20', rowCount: 100, daysCovered: 20, daysInWindow: 31, gapDays: ['2026-08-21'] },
            targets: { ads: { target: 400000, attainmentPct: 75, months: 1, actual: 300000 }, acos: { target: 25, actual: 33.3, gapPoints: 8.3, onTarget: false } },
            efficiency: {
                buckets: [{ key: 'no_sales', label: 'Spend · no sales', keys: 4, spend: 80000, sales: 0, totalSales: 0, orders: 0, spendShare: 26 }],
                waste: { spendFloor: 1000, zeroSales: { keys: 4, spend: 80000, rows: [{ key: 'B009', spend: 60000 }] }, highAcos: { keys: 2, spend: 60000, sales: 120000, thresholdPct: 40 } },
            },
            mix: { seller: [{ name: 'Seller One', share: 100, acos: 33.3, totalSales: 1500000 }], brand: [{ name: 'BrandA', share: 80, acos: 30, totalSales: 1200000 }], category: [] },
            movers: { gainers: [{ key: 'B001', deltaTotalSales: 50000, deltaTotalSalesPct: 20, acos: 22, spend: 20000, prevAcos: 25 }], decliners: [{ key: 'B003', deltaTotalSales: -40000, deltaTotalSalesPct: -60, acos: 46, spend: 20000, prevAcos: 30, totalSales: 26000 }], spendSpikes: [] },
            scope: { isGlobal: false, assignedSellers: ['S1'] },
        };

        const out = buildInsights(overview);
        const ids = out.insights.map((i) => i.id);

        expect(ids).toContain('zero-sales-waste');
        expect(ids).toContain('stale-data');
        expect(ids).toContain('acos-target-miss');
        expect(ids).toContain('coverage-gaps');
        expect(ids).toContain('top-decliner');

        const waste = out.insights.find((i) => i.id === 'zero-sales-waste');
        expect(waste.text).toContain('₹80.0 K');
        expect(waste.tone).toBe('neg');
        expect(waste.metrics.Spend).toBe('₹80.0 K');

        // Sorted by priority so the most important read is first.
        const priorities = out.insights.map((i) => i.priority);
        expect([...priorities].sort((a, b) => b - a)).toEqual(priorities);
        expect(out.headline).toBe(out.insights[0].text);
    });

    test('suppresses business insights when there is no data (no fabricated narrative)', () => {
        const out = buildInsights({
            period: { start: '2026-08-01', end: '2026-08-31', days: 31, label: 'x' },
            totals: analytics.deriveMetrics({}),
            previous: analytics.deriveMetrics({}),
            delta: {},
            freshness: { lastDate: null, rowCount: 0, gapDays: [], daysCovered: 0, daysInWindow: 31 },
            efficiency: {}, mix: {}, movers: {}, targets: {},
        });
        expect(out.insights).toHaveLength(1);
        expect(out.insights[0].id).toBe('no-data');
        expect(out.insights[0].tone).toBe('warn');
    });

    test('AI digest contains numbers only and trims row payloads', () => {
        const overview = {
            period: { start: '2026-08-01', end: '2026-08-28', days: 28, prevStart: '2026-07-04', prevEnd: '2026-07-31', label: 'x' },
            totals: analytics.deriveMetrics({ spend: 100, sales: 400 }),
            previous: analytics.deriveMetrics({ spend: 80, sales: 300 }),
            delta: analytics.deltaSet(analytics.deriveMetrics({ spend: 100, sales: 400 }), analytics.deriveMetrics({ spend: 80, sales: 300 })),
            freshness: { lastDate: '2026-08-28', rowCount: 10, daysCovered: 28, daysInWindow: 28, gapDays: [], asinCount: 3 },
            efficiency: { buckets: [], waste: {} },
            mix: { brand: [{ name: 'BrandA', totalSales: 100, acos: 20, share: 90, deltaTotalSalesPct: 5 }], seller: [], category: [] },
            movers: { gainers: [], decliners: [], spendSpikes: [] },
        };
        const digest = buildAiDigest(overview, [{ id: 'x', tone: 'neg', text: 't' }]);
        expect(digest.totals.spend).toBe(100);
        expect(digest.window.days).toBe(28);
        expect(digest.mix.brands[0].brand).toBe('BrandA');
        expect(JSON.stringify(digest)).not.toMatch(/imageUrl|title|sku/i);
    });
});

/* ───────────────────────────── AI narrative ───────────────────────────── */

describe('AI narrative parsing', () => {
    test('accepts fenced JSON and rejects junk', () => {
        const parsed = extractJson('```json\n{"headline":"H"}\n```');
        expect(parsed).toEqual({ headline: 'H' });
        expect(extractJson('not json at all')).toBeNull();
    });

    test('normalises a model response and drops malformed entries', () => {
        const narrative = normaliseNarrative({
            headline: 'ACoS is over target',
            summary: 'Spend grew faster than sales.',
            findings: [{ title: 'ACoS +8 pts', detail: 'Blended ACoS 33.3% vs 25% target', impact: 'HIGH', evidence: 'ACoS' }, { detail: 'no title' }],
            risks: [{ title: 'Margin', detail: 'Cost per order rising', severity: 'unexpected' }],
            actions: [{ action: 'Cut the >40% ACoS band', rationale: '₹60.0 K spend', effort: 'low', expectedImpact: '-2 pts ACoS' }],
            confidence: { level: 'medium', reason: 'one gap day' },
        });
        expect(narrative.findings).toHaveLength(1);
        expect(narrative.findings[0].impact).toBe('high');
        expect(narrative.risks[0].severity).toBe('medium');
        expect(narrative.actions).toHaveLength(1);
        expect(narrative.confidence.level).toBe('medium');
    });
});

/* ───────────────────────────── controllers ───────────────────────────── */

describe('ads controller authorisation', () => {
    test('a scoped user asking for a foreign seller gets 403 with context', async () => {
        const res = makeRes();
        await adsController.getOverview({ user: SCOPED_USER, query: { sellerId: 'S9' } }, res);
        expect(res.statusCode).toBe(403);
        expect(res.body.code).toBe('forbidden_seller');
        expect(res.body.assignedSellers).toEqual(['S1', 'S2']);
        expect(res.body.requestedSellers).toEqual(['S9']);
    });

    test('a user with no assignments gets an empty payload, never global data', async () => {
        const res = makeRes();
        await adsController.getOverview({ user: EMPTY_USER, query: {} }, res);
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.empty).toBe(true);
        expect(res.body.data.totals.spend).toBe(0);
        expect(mockState.pool.calls).toHaveLength(0);
    });

    test('overview exposes insights alongside data for a legitimately scoped caller', async () => {
        const res = makeRes();
        await adsController.getOverview({ user: SCOPED_USER, query: { startDate: '2026-08-01', endDate: '2026-08-28' } }, res);
        expect(res.statusCode).toBe(200);
        expect(res.body.data.insights.insights.length).toBeGreaterThan(0);
        expect(res.body.data.period.days).toBe(28);
    });

    test('ai-review returns rules as a fallback when the provider fails', async () => {
        const res = makeRes();
        await adsController.postAiReview({ user: SCOPED_USER, query: { startDate: '2026-08-01', endDate: '2026-08-28' }, body: {} }, res);
        // No AI credentials in the test env → the deterministic layer must survive.
        expect(res.statusCode).toBe(502);
        expect(res.body.code).toBe('ai_unavailable');
        expect(Array.isArray(res.body.fallback.insights)).toBe(true);
    });

    test('ads report aggregates months and per-seller attainment against targets', async () => {
        const res = makeRes();
        await adsController.getReport({ user: SCOPED_USER, query: { months: '6' } }, res);
        expect(res.statusCode).toBe(200);
        expect(res.body.data.months.length).toBeGreaterThan(0);
        expect(res.body.data.sellers[0].adsTarget).toBe(200000);
        expect(res.body.data.sellers[0].attainmentPct).toBeCloseTo((res.body.data.sellers[0].spend / 200000) * 100, 6);
        expect(res.body.data.totals.adsTarget).toBe(200000);
    });
});

describe('legacy /api/data ads endpoints (F1)', () => {
    const dataController = require('../../controllers/dataController');

    test('refuse a foreign seller before touching the database', async () => {
        const res = makeRes();
        await dataController.getAdsManagerData({ user: SCOPED_USER, query: { sellerId: 'S9' } }, res);
        expect(res.statusCode).toBe(403);
        expect(res.body.code).toBe('forbidden_seller');
        expect(mockState.pool.calls).toHaveLength(0);
    });

    test('bind the caller scope into every query they run', async () => {
        const res = makeRes();
        await dataController.getAdsManagerData({ user: SCOPED_USER, query: {} }, res);
        const adsQueries = mockState.pool.calls.filter((c) => String(c.sql).includes('AdsPerformance'));
        expect(adsQueries.length).toBeGreaterThan(0);
        for (const call of adsQueries) {
            expect(call.sql).toContain('a.SellerId IN (@legacyMgrScope_');
            expect(Object.values(call.inputs)).toEqual(expect.arrayContaining(['S1', 'S2']));
        }
    });

    test('a user with no sellers is failure-closed rather than unfiltered', async () => {
        const res = makeRes();
        await dataController.getAdsManagerData({ user: EMPTY_USER, query: {} }, res);
        const adsQueries = mockState.pool.calls.filter((c) => String(c.sql).includes('AdsPerformance'));
        expect(adsQueries.length).toBeGreaterThan(0);
        for (const call of adsQueries) {
            expect(call.sql).toContain('1 = 0');
        }
    });
});

describe('ads export (F2)', () => {
    test('records the acting user and the resolved scope on the job', async () => {
        const res = makeRes();
        await exportAds.startAdsExport(
            { user: SCOPED_USER, body: { sellerId: 'S1', startDate: '2026-08-01', endDate: '2026-08-31', groupBy: 'asin' } },
            res,
        );
        expect(res.body.success).toBe(true);
        const insert = mockState.pool.callWhere(/INSERT INTO Downloads/);
        expect(insert.inputs.userId).toBe('u-bm');
        const params = JSON.parse(insert.inputs.params);
        // An explicit (allowed) seller narrows the job to that subset…
        expect(params.allowedSellerIds).toEqual(['S1']);
        expect(params.reportType).toBe('daily');

        // …while no seller selection expands to every assigned seller.
        mockState.pool = buildAdsPool();
        const res2 = makeRes();
        await exportAds.startAdsExport({ user: SCOPED_USER, body: { groupBy: 'parent' } }, res2);
        const insert2 = mockState.pool.callWhere(/INSERT INTO Downloads/);
        expect(JSON.parse(insert2.inputs.params).allowedSellerIds).toEqual(['S1', 'S2']);
    });

    test('refuses to queue an export for a seller outside the caller scope', async () => {
        const res = makeRes();
        await exportAds.startAdsExport({ user: SCOPED_USER, body: { sellerId: 'S9' } }, res);
        expect(res.statusCode).toBe(403);
        expect(res.body.code).toBe('forbidden_seller');
        expect(mockState.pool.calls).toHaveLength(0);
    });
});
