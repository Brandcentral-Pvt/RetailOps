/**
 * Shared fixtures for the ads module tests.
 *
 * The fake pool routes mirror the real query shapes in
 * backend/services/adsAnalytics.js, so the aggregate maths, the scoping and the
 * pagination are all exercised against realistic row payloads.
 */
const { makeFakePool } = require('./fakePool');

/** Row shape returned by the current/previous window SUM(CASE …) selects. */
const metricRow = (over = {}) => ({
    cur_spend: 100000, cur_sales: 400000, cur_organicSales: 200000, cur_orders: 400, cur_organicOrders: 200,
    cur_impressions: 1000000, cur_clicks: 8000, cur_pageViews: 5000, cur_units: 500, cur_sameSkuSales: 10000,
    prev_spend: 80000, prev_sales: 300000, prev_organicSales: 150000, prev_orders: 300, prev_organicOrders: 150,
    prev_impressions: 900000, prev_clicks: 7000, prev_pageViews: 4000, prev_units: 400, prev_sameSkuSales: 9000,
    ...over,
});

const keyRow = (key, over = {}) => ({
    key, sku: `SKU-${key}`, title: `Title ${key}`, imageUrl: null, brand: 'BrandA', category: 'Cat1',
    sellerId: 'S1', sellerName: 'Seller One', marketplace: 'IN', childCount: 1,
    ...metricRow(over),
});

function buildAdsPool() {
    return makeFakePool([
        // Ads Manager queries
        { match: /THEN 'cur' ELSE 'prev' END AS win/, rows: [
            { ...metricRow(), bucket: '2026-08-01', win: 'cur', totalCount: undefined },
            { ...metricRow({ cur_spend: 0, cur_sales: 0, cur_organicSales: 0, cur_orders: 0, cur_impressions: 0, cur_clicks: 0 }), bucket: '2026-08-08', win: 'cur' },
        ] },
        { match: /CONVERT\(varchar\(7\), p\.Date, 23\) AS bucket/, rows: [
            { ...metricRow(), bucket: '2026-07' },
            { ...metricRow({ cur_spend: 120000 }), bucket: '2026-08' },
        ] },
        { match: /GROUPING SETS/, rows: [
            { dim: 'seller', name: 'S1', sellerName: 'Seller One', marketplace: 'IN', ...metricRow() },
            { dim: 'brand', name: 'BrandA', sellerName: null, marketplace: null, ...metricRow({ cur_sales: 250000 }) },
            { dim: 'category', name: 'Cat1', sellerName: null, marketplace: null, ...metricRow({ cur_sales: 150000 }) },
        ] },
        { match: /FROM GmsTargets/, rows: [
            { SellerId: 'S1', GoalType: 'ADS', Month: 8, Year: 2026, TotalTargetValue: 200000 },
            { SellerId: 'S1', GoalType: 'ACOS', Month: 8, Year: 2026, TotalTargetValue: 25 },
        ] },
        { match: /AS lastDate/, rows: [{ lastDate: '2026-08-31', lastUpload: '2026-09-01 04:00:00', rowCount: 5000, asinCount: 300 }] },
        { match: /AS d\b/, rows: [{ d: '2026-08-01' }, { d: '2026-08-02' }] },
        { match: /SELECT DISTINCT a\.SellerId/, rows: [
            { SellerId: 'S1', sellerName: 'Seller One', Marketplace: 'IN', Brand: 'BrandA', Category: 'Cat1' },
        ] },
        { match: /OFFSET @offset ROWS/, rows: [keyRow('B001', { totalCount: 3 }), keyRow('B002')] },
        { match: /SUM\(prevSpend\) AS prevSpend/, rows: [
            { keyCount: 3, spend: 300000, sales: 1200000, organicSales: 600000, orders: 1200, impressions: 3000000, clicks: 24000, units: 1500, pageViews: 15000, prevSpend: 240000, prevSales: 900000, prevOrganicSales: 450000 },
        ] },
        { match: /COUNT\(\*\) AS keys_count/, rows: [
            { bucket: 'acos_le_15', keys_count: 10, spend: 50000, sales: 400000, totalSales: 500000, orders: 300 },
            { bucket: 'no_sales', keys_count: 4, spend: 80000, sales: 0, totalSales: 0, orders: 0 },
        ] },
        { match: /zeroSalesKeys/, rows: [{ zeroSalesKeys: 4, zeroSalesSpend: 80000, highAcosKeys: 2, highAcosSpend: 60000, highAcosSales: 120000 }] },
        { match: /'zero_sales' AS reason/, rows: [keyRow('B009', { cur_sales: 0, cur_organicSales: 0, cur_spend: 60000 })] },
        { match: /ORDER BY spend DESC/, rows: [keyRow('B001'), keyRow('B002')] },
        { match: /TOP \(@topN\)/, rows: [keyRow('B001'), keyRow('B002')] },
        { match: /ORDER BY deltaTotalSales ASC/, rows: [keyRow('B003', { cur_spend: 20000, cur_sales: 10000, cur_organicSales: 0, prev_sales: 40000, prev_organicSales: 10000 })] },
        { match: /@sparkKey_0/, rows: [
            { key: 'B001', date: '2026-08-01', ...metricRow() },
            { key: 'B002', date: '2026-08-01', ...metricRow({ cur_spend: 10000 }) },
        ] },
        { match: /drillKey/, rows: [{ date: '2026-08-01', ...metricRow() }] },
        { match: /GROUP BY CONVERT\(varchar\(10\), p\.Date, 23\)/, rows: [{ d: '2026-08-01' }] },
        // Export insert
        { match: /INSERT INTO Downloads/, rows: [] },
    ]);
}


module.exports = { buildAdsPool, metricRow, keyRow };
