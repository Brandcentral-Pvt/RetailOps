const { isGlobalUserRole } = require('../utils/roleUtils');
const { sql, getPool } = require('../database/db');
const { buildInClause } = require('../utils/sqlHelpers');
const { BoundedCache } = require('../utils/memoryMonitor');

const dashboardCache = new BoundedCache({ maxSize: 100, ttlMs: 60_000 });

// Helper to parse period strings (e.g., '30d', '3M', '1y')
const parsePeriod = (period) => {
  if (!period) return 30;
  const p = (Array.isArray(period) ? period[0] : period).toString().trim();
  const num = parseInt(p);
  if (isNaN(num)) return 30;
  const suffixMatch = p.match(/[a-zA-Z]+$/);
  const unit = suffixMatch ? suffixMatch[0].toLowerCase() : 'd';

  switch (unit) {
    case 'd': return num;
    case 'w': return num * 7;
    case 'm':
    case 'mo':
    case 'mon': return num * 30;
    case 'q': return num * 90;
    case 'y': return num * 365;
    default: return num;
  }
};

/**
 * Get dashboard summary data (SQL Version)
 */
exports.getDashboardData = async (req, res) => {
  try {
    const { period = '30d', startDate: startQuery, endDate: endQuery, sellerId } = req.query;
    const userId = req.user?.Id || req.user?._id?.toString() || '';

    // Check cache
    const cacheKey = `${userId}|${sellerId || 'all'}|${startQuery || ''}|${endQuery || ''}|${period}`;
    const cached = dashboardCache.get(cacheKey);
    if (cached) return res.json(cached);

    const pool = await getPool();

    const roleName = req.user?.role?.name || req.user?.role;
    const isGlobalUser = isGlobalUserRole(roleName);
    const assignedSellers = req.user?.assignedSellers || [];
    const sellerIds = assignedSellers.map(s => typeof s === 'string' ? s : s._id || s.Id);

    // 1. Base Filters & Merchant Selection
    let finalSellerIds = sellerIds;
    if (sellerId && sellerId !== 'all') {
      const parsedSellerIds = sellerId.split(',').map(s => s.trim()).filter(Boolean);
      const authorizedIds = parsedSellerIds.filter(id => isGlobalUser || sellerIds.includes(id));
      if (authorizedIds.length > 0) {
        finalSellerIds = authorizedIds;
      } else {
        // Unauthorized selected seller fallback
        finalSellerIds = ['000000000000000000000000'];
      }
    }

    const safeSellerIds = finalSellerIds.length > 0 ? finalSellerIds : ['000000000000000000000000'];
    const useWideFilters = isGlobalUser && (!sellerId || sellerId === 'all');

    let sellerFilter = '';
    let asinFilter = '';
    let alertFilter = '';
    let sellerParams = [];

    if (!useWideFilters && safeSellerIds.length > 0) {
      sellerParams = safeSellerIds;
      const placeholders = safeSellerIds.map((_, i) => `@dashSeller_${i}`).join(',');
      sellerFilter = 'WHERE Id IN (' + placeholders + ')';
      asinFilter = 'WHERE SellerId IN (' + placeholders + ')';
      alertFilter = 'WHERE SellerId IN (' + placeholders + ')';
    }

    const buildDashReq = () => {
      const r = pool.request();
      sellerParams.forEach((val, i) => r.input(`dashSeller_${i}`, sql.VarChar, val));
      return r;
    };

    // 2. Aggregate Counts (parallel independent queries - each with own request)
    const [
      sellerCountsResult,
      asinCountsResult,
      alertsResult,
      userActionStatsResult,
      teamActionStatsPromise
    ] = await Promise.all([
      buildDashReq().query(`
        SELECT 
          COUNT(*) as Total,
          SUM(CASE WHEN IsActive = 1 THEN 1 ELSE 0 END) as Active
        FROM Sellers ${sellerFilter}
      `),
      buildDashReq().query(`
        SELECT 
          COUNT(*) as Total,
          SUM(CASE WHEN Status IN ('Active', 'Scraping') THEN 1 ELSE 0 END) as Active,
          SUM(CASE WHEN Status IN ('Active', 'Scraping')
                   AND (AvailabilityStatus LIKE '%unavailable%' OR AvailabilityStatus LIKE '%out of stock%')
              THEN 1 ELSE 0 END) as OutOfStock,
          SUM(CASE WHEN CreatedAt >= DATEADD(month, DATEDIFF(month, 0, GETDATE()), 0) THEN 1 ELSE 0 END) as NewThisMonth,
          SUM(ISNULL(CurrentPrice, 0)) as PortfolioValue
        FROM Asins ${asinFilter}
      `),
      buildDashReq().query(`
        SELECT TOP 5 Id, Severity, Message, CreatedAt 
        FROM Alerts ${alertFilter} 
        ORDER BY CreatedAt DESC
      `),
      pool.request()
        .input('userId', sql.VarChar, req.user.Id || req.user._id.toString())
        .query(`
          SELECT Status, COUNT(*) as Count 
          FROM Actions 
          WHERE AssignedTo = @userId 
          GROUP BY Status
        `),
      isGlobalUser
        ? pool.request().query(`
            SELECT Status, COUNT(*) as Count FROM Actions GROUP BY Status
          `)
        : Promise.resolve({ recordset: [] })
    ]);

    const sellerCounts = sellerCountsResult;
    const asinCounts = asinCountsResult;
    const { recordset: userActionRows } = userActionStatsResult;

    const userStats = { pending: 0, inProgress: 0, review: 0, completed: 0, total: 0 };
    userActionRows.forEach(row => {
      const status = row.Status?.toLowerCase();
      if (status === 'pending') userStats.pending = row.Count;
      else if (status === 'in_progress') userStats.inProgress = row.Count;
      else if (status === 'review') userStats.review = row.Count;
      else if (status === 'completed') userStats.completed = row.Count;
      userStats.total += row.Count;
    });

    let teamStats = null;
    if (isGlobalUser) {
      const teamActionStats = teamActionStatsPromise;
      teamStats = { pending: 0, inProgress: 0, review: 0, completed: 0, total: 0 };
      teamActionStats.recordset.forEach(row => {
        const status = row.Status?.toLowerCase();
        if (status === 'pending') teamStats.pending = row.Count;
        else if (status === 'in_progress') teamStats.inProgress = row.Count;
        else if (status === 'review') teamStats.review = row.Count;
        else if (status === 'completed') teamStats.completed = row.Count;
        teamStats.total += row.Count;
      });
    }

    // 5. Date Range Logic
    let startDate, endDate, days;
    let cleanStart = (startQuery === 'null' || startQuery === 'undefined') ? null : startQuery;
    let cleanEnd = (endQuery === 'null' || endQuery === 'undefined') ? null : endQuery;

    if (cleanStart && cleanEnd) {
      // ✅ Parse yyyy-mm-dd as LOCAL dates: the pool runs with useUTC=false,
      // so DATE columns round-trip as local midnight. Parsing inputs as UTC
      // (new Date('yyyy-mm-dd')) shifted the window by a day in IST.
      startDate = parseLocalDate(cleanStart);
      endDate = parseLocalDate(cleanEnd);
      days = Math.max(1, Math.round(Math.abs(endDate - startDate) / (1000 * 60 * 60 * 24)) + 1);
    } else {
      days = Math.min(parsePeriod(period), 365);
      endDate = new Date();
      startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
    }

    // ✅ Period-over-period: the window immediately preceding the selected
    // range, same length. Used for every "vs previous period" delta.
    const prevEnd = new Date(startDate);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(startDate);
    prevStart.setDate(prevStart.getDate() - days);
    const startKey = toDateKey(startDate);
    const endKey = toDateKey(endDate);
    const prevStartKey = toDateKey(prevStart);
    const prevEndKey = toDateKey(prevEnd);
    const isCurrentRow = (row) => toDateKey(row.Date) >= startKey;

    // Seller restriction expressed against the aliased Asins table (A) so it
    // can be appended to any join without column ambiguity.
    const asinJoinFilter = asinFilter ? asinFilter.replace('WHERE', 'AND').replace('SellerId IN', 'A.SellerId IN') : '';
    // Seller restriction for tables that carry only an ASIN code (GMS rows):
    // an EXISTS against Asins avoids double-counting when the same ASIN is
    // tracked under more than one seller.
    const gmsScopeFilter = `AND EXISTS (SELECT 1 FROM Asins A WHERE A.AsinCode = g.Asin ${asinJoinFilter})`;

    const buildRangeReq = () => buildDashReq()
      .input('startDate', sql.Date, startDate)
      .input('endDate', sql.Date, endDate)
      .input('prevStart', sql.Date, prevStart);

    // 6. Ads Performance & Charts
    // ✅ Aggregated per day (the charts and KPIs only ever consume per-day
    // totals) across the current AND previous window in a single pass — the
    // previous window feeds the period-over-period deltas.
    const adsDataResult = await buildRangeReq()
      .query(`
        SELECT
          AP.Date,
          SUM(ISNULL(AP.AdSales, 0)) AS AdSales,
          SUM(ISNULL(AP.AdSpend, 0)) AS AdSpend,
          SUM(ISNULL(AP.Orders, 0)) AS Orders,
          SUM(ISNULL(AP.OrganicSales, 0)) AS OrganicSales,
          SUM(ISNULL(AP.Impressions, 0)) AS Impressions,
          SUM(ISNULL(AP.Clicks, 0)) AS Clicks
        FROM AdsPerformance AP
        JOIN Asins A ON AP.Asin = A.AsinCode
        WHERE AP.Date BETWEEN @prevStart AND @endDate
        AND AP.ReportType = 'daily'
        ${asinJoinFilter}
        GROUP BY AP.Date
      `);

    const allAdsRows = adsDataResult.recordset || [];
    const adsData = allAdsRows.filter(isCurrentRow);
    const prevAdsData = allAdsRows.filter(r => !isCurrentRow(r));
    const sumBy = (rows, key) => rows.reduce((sum, r) => sum + (Number(r[key]) || 0), 0);
    const totalAdSales = sumBy(adsData, 'AdSales');
    const totalAdSpend = sumBy(adsData, 'AdSpend');
    const totalOrders = sumBy(adsData, 'Orders');
    const totalOrganicSales = sumBy(adsData, 'OrganicSales');
    const totalImpressions = sumBy(adsData, 'Impressions');
    const totalClicks = sumBy(adsData, 'Clicks');
    const totalCatalogValue = (asinCounts.recordset && asinCounts.recordset[0]) ? asinCounts.recordset[0].PortfolioValue || 0 : 0;

    // 6b. GMS (ordered revenue / units) per day — the merchandise truth the
    // top-products table and the GMS KPIs are built on. Same 2× window.
    const gmsDailyResult = await buildRangeReq()
      .query(`
        SELECT
          g.Date,
          SUM(ISNULL(g.OrderedRevenue, 0)) AS Revenue,
          SUM(ISNULL(g.OrderedUnits, 0)) AS Units,
          SUM(ISNULL(g.ShippedRevenue, 0)) AS ShippedRevenue,
          SUM(ISNULL(g.CustomerReturns, 0)) AS Returns
        FROM GmsDailyPerformance g
        WHERE g.Date BETWEEN @prevStart AND @endDate
        ${gmsScopeFilter}
        GROUP BY g.Date
      `);

    const allGmsRows = gmsDailyResult.recordset || [];
    const gmsRows = allGmsRows.filter(isCurrentRow);
    const prevGmsRows = allGmsRows.filter(r => !isCurrentRow(r));
    const gmsRevenue = sumBy(gmsRows, 'Revenue');
    const gmsUnits = sumBy(gmsRows, 'Units');
    const gmsShipped = sumBy(gmsRows, 'ShippedRevenue');
    const gmsReturns = sumBy(gmsRows, 'Returns');
    const prevGmsRevenue = sumBy(prevGmsRows, 'Revenue');
    const prevGmsUnits = sumBy(prevGmsRows, 'Units');

    const activeAsinCount = (asinCounts.recordset && asinCounts.recordset[0]) ? asinCounts.recordset[0].Active || 0 : 0;
    const kpi = [
      { id: 1, title: 'Total Ad Sales', value: `₹${totalAdSales.toLocaleString()}`, icon: 'bi-graph-up-arrow', trend: totalOrders, trendType: 'positive' },
      { id: 2, title: 'Total Ad Spend', value: `₹${totalAdSpend.toLocaleString()}`, icon: 'bi-cash-stack', trend: 0, trendType: 'neutral' },
      { id: 3, title: 'Active ASINs', value: activeAsinCount.toLocaleString(), icon: 'bi-box-seam', trend: activeAsinCount, trendType: 'positive' },
      { id: 4, title: 'Catalog Value', value: `₹${totalCatalogValue.toLocaleString()}`, icon: 'bi-currency-rupee', trend: 0, trendType: 'neutral' },
    ];

    // Chart processing
    const {
      revenueData, areaSeries, stackedBarSeries, adsPerformanceSeries,
      ordersSeries, unitsSeries, acosSeries, labels, bucketKeys,
      gmsSeries, gmsUnitsSeries, tacosSeries, granularity, bucketize
    } = processChartData(days, adsData, endDate, gmsRows);

    // 7. Optimized Marketplace Distribution (Safe high-performance decouple)
    // First: Get raw counts using ONLY covering index on Asins (super fast)
    const asinsGroupedResult = await buildDashReq().query(`
      SELECT SellerId, COUNT(*) as Count 
      FROM Asins
      ${asinFilter}
      GROUP BY SellerId
    `);

    // Second: Get small Sellers map
    const sellersMapResult = await pool.request().query(`
      SELECT Id, Marketplace FROM Sellers
    `);

    // Map to hold aggregated counts per marketplace
    const marketplaceCounts = {};
    const sellersMap = {};
    
    // Build quick lookup map for sellers
    sellersMapResult.recordset.forEach(s => {
      sellersMap[s.Id] = s.Marketplace || 'Other';
    });

    // Aggregate the grouped results into marketplaces
    asinsGroupedResult.recordset.forEach(row => {
      const mkt = sellersMap[row.SellerId] || 'Other';
      marketplaceCounts[mkt] = (marketplaceCounts[mkt] || 0) + row.Count;
    });

    // Transform into expected structure
    const categoryData = Object.entries(marketplaceCounts).map(([mkt, count], idx) => ({
      name: mkt,
      data: [count],
      color: ['#3b82f6', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6'][idx % 5]
    }));

    // 8. Top ASINs Table — ranked by GMS (ordered revenue of the ASIN).
    // ✅ Definition fix: "top products" means the ASIN's merchandise sales
    // (GmsDailyPerformance.OrderedRevenue), NOT its advertising numbers.
    // AdsPerformance is only LEFT JOINed for context columns (ad share,
    // TACoS, ACoS). Both aggregates are restricted to the selected window;
    // the GMS aggregate also folds in the previous window for deltas.
    // Seller params are bound via buildDashReq() (regression: @dashSeller_*).
    const topAsinsPromise = buildRangeReq()
      .query(`
      WITH GmsAgg AS (
        SELECT
          g.Asin,
          SUM(CASE WHEN g.Date >= @startDate THEN ISNULL(g.OrderedRevenue, 0) ELSE 0 END) AS GmsRevenue,
          SUM(CASE WHEN g.Date >= @startDate THEN ISNULL(g.OrderedUnits, 0) ELSE 0 END) AS GmsUnits,
          SUM(CASE WHEN g.Date >= @startDate THEN ISNULL(g.ShippedRevenue, 0) ELSE 0 END) AS ShippedRevenue,
          SUM(CASE WHEN g.Date >= @startDate THEN ISNULL(g.CustomerReturns, 0) ELSE 0 END) AS Returns,
          SUM(CASE WHEN g.Date < @startDate THEN ISNULL(g.OrderedRevenue, 0) ELSE 0 END) AS PrevGmsRevenue,
          SUM(CASE WHEN g.Date < @startDate THEN ISNULL(g.OrderedUnits, 0) ELSE 0 END) AS PrevGmsUnits,
          COUNT(DISTINCT CASE WHEN g.Date >= @startDate AND ISNULL(g.OrderedRevenue, 0) > 0 THEN g.Date END) AS ActiveDays
        FROM GmsDailyPerformance g
        WHERE g.Date BETWEEN @prevStart AND @endDate
        GROUP BY g.Asin
      ),
      AdsAgg AS (
        SELECT
          AP.Asin,
          SUM(ISNULL(AP.AdSales, 0)) AS AdSales,
          SUM(ISNULL(AP.AdSpend, 0)) AS AdSpend,
          SUM(ISNULL(AP.Orders, 0)) AS AdOrders
        FROM AdsPerformance AP
        WHERE AP.Date BETWEEN @startDate AND @endDate
          AND AP.ReportType = 'daily'
        GROUP BY AP.Asin
      )
      SELECT TOP 200
        A.Id, A.AsinCode, A.Sku, A.Title, A.Category, A.Brand, A.ParentAsin,
        A.CurrentPrice, A.ImageUrl, A.Status, A.AvailabilityStatus, A.SellerId,
        S.Name AS SellerName, S.Marketplace,
        G.GmsRevenue, G.GmsUnits, G.ShippedRevenue, G.Returns,
        G.PrevGmsRevenue, G.PrevGmsUnits, G.ActiveDays,
        ISNULL(AD.AdSales, 0) AS AdSales,
        ISNULL(AD.AdSpend, 0) AS AdSpend,
        ISNULL(AD.AdOrders, 0) AS AdOrders
      FROM GmsAgg G
      JOIN Asins A ON A.AsinCode = G.Asin
      JOIN Sellers S ON A.SellerId = S.Id
      LEFT JOIN AdsAgg AD ON AD.Asin = G.Asin
      WHERE (G.GmsRevenue > 0 OR G.GmsUnits > 0)
      ${asinJoinFilter}
      ORDER BY G.GmsRevenue DESC, G.GmsUnits DESC
    `);

    // 9. GMS by seller (brand leaderboard) — current + previous window.
    const gmsBySellerPromise = buildRangeReq()
      .query(`
        SELECT
          A.SellerId, S.Name AS SellerName, S.Marketplace,
          SUM(CASE WHEN g.Date >= @startDate THEN ISNULL(g.OrderedRevenue, 0) ELSE 0 END) AS Revenue,
          SUM(CASE WHEN g.Date >= @startDate THEN ISNULL(g.OrderedUnits, 0) ELSE 0 END) AS Units,
          SUM(CASE WHEN g.Date < @startDate THEN ISNULL(g.OrderedRevenue, 0) ELSE 0 END) AS PrevRevenue,
          COUNT(DISTINCT CASE WHEN g.Date >= @startDate AND ISNULL(g.OrderedRevenue, 0) > 0 THEN g.Asin END) AS AsinsWithSales
        FROM GmsDailyPerformance g
        JOIN Asins A ON A.AsinCode = g.Asin
        JOIN Sellers S ON S.Id = A.SellerId
        WHERE g.Date BETWEEN @prevStart AND @endDate
        ${asinJoinFilter}
        GROUP BY A.SellerId, S.Name, S.Marketplace
        ORDER BY Revenue DESC
      `);

    // Distinct ASINs with ordered revenue in the current window (scoped).
    const sellingAsinsPromise = buildRangeReq()
      .query(`
        SELECT COUNT(DISTINCT g.Asin) AS AsinsWithSales
        FROM GmsDailyPerformance g
        WHERE g.Date BETWEEN @startDate AND @endDate
          AND ISNULL(g.OrderedRevenue, 0) > 0
        ${gmsScopeFilter}
      `);

    const [topAsinsResult, gmsBySellerResult, sellingAsinsResult] = await Promise.all([
      topAsinsPromise, gmsBySellerPromise, sellingAsinsPromise,
    ]);

    const topRows = topAsinsResult.recordset || [];

    // 8b. Per-ASIN GMS trend (bucket-aligned with `labels`) for the leaders —
    // a second, narrow query so the ranking query stays a pure aggregate.
    const SPARK_LIMIT = 25;
    const sparkAsins = Array.from(new Set(topRows.slice(0, SPARK_LIMIT).map(r => r.AsinCode).filter(Boolean)));
    const trendByAsin = {};
    if (sparkAsins.length > 0) {
      const sparkReq = buildRangeReq();
      const sparkClause = buildInClause(sparkReq, 'sparkAsin', sparkAsins);
      const sparkResult = await sparkReq.query(`
        SELECT g.Asin, g.Date,
          SUM(ISNULL(g.OrderedRevenue, 0)) AS Revenue,
          SUM(ISNULL(g.OrderedUnits, 0)) AS Units
        FROM GmsDailyPerformance g
        WHERE g.Date BETWEEN @startDate AND @endDate
          AND g.Asin IN (${sparkClause})
        GROUP BY g.Asin, g.Date
      `);
      (sparkResult.recordset || []).forEach(row => {
        if (!trendByAsin[row.Asin]) {
          trendByAsin[row.Asin] = { revenue: bucketKeys.map(() => 0), units: bucketKeys.map(() => 0) };
        }
        const idx = bucketize(row.Date);
        if (idx >= 0) {
          trendByAsin[row.Asin].revenue[idx] += Math.round(Number(row.Revenue) || 0);
          trendByAsin[row.Asin].units[idx] += Number(row.Units) || 0;
        }
      });
    }

    const pct = (num, den) => (den > 0 ? (num / den) * 100 : 0);
    const deltaPct = (cur, prev) => (prev > 0 ? ((cur - prev) / prev) * 100 : null);
    const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
    const rankedTotal = topRows.reduce((s, r) => s + (Number(r.GmsRevenue) || 0), 0);
    const shareBase = gmsRevenue > 0 ? gmsRevenue : rankedTotal;

    const tableData = topRows.map((asin, i) => {
      const revenue = Number(asin.GmsRevenue) || 0;
      const units = Number(asin.GmsUnits) || 0;
      const prevRevenue = Number(asin.PrevGmsRevenue) || 0;
      const prevUnits = Number(asin.PrevGmsUnits) || 0;
      const adSales = Number(asin.AdSales) || 0;
      const adSpend = Number(asin.AdSpend) || 0;
      const returns = Number(asin.Returns) || 0;
      const acos = pct(adSpend, adSales);
      const trend = trendByAsin[asin.AsinCode] || null;
      return {
        rank: i + 1,
        id: asin.Id,
        sku: asin.Sku || asin.AsinCode,
        asin: asin.AsinCode,
        title: asin.Title || 'Unknown Product',
        category: asin.Category || 'Uncategorized',
        brand: asin.Brand || null,
        parentAsin: asin.ParentAsin || null,
        imageUrl: asin.ImageUrl || null,
        status: asin.Status || null,
        availability: asin.AvailabilityStatus || null,
        sellerId: asin.SellerId,
        sellerName: asin.SellerName || null,
        marketplace: asin.Marketplace || null,
        currentPrice: Number(asin.CurrentPrice) || 0,
        // Legacy keys (consumed by the older dashboards) — now GMS-based.
        revenue: round2(revenue),
        units,
        acos: acos.toFixed(1) + '%',
        // GMS block
        gmsRevenue: round2(revenue),
        gmsUnits: units,
        shippedRevenue: round2(asin.ShippedRevenue),
        returns,
        returnRate: round2(pct(returns, units)),
        prevGmsRevenue: round2(prevRevenue),
        prevGmsUnits: prevUnits,
        deltaPct: deltaPct(revenue, prevRevenue) === null ? null : round2(deltaPct(revenue, prevRevenue)),
        unitsDeltaPct: deltaPct(units, prevUnits) === null ? null : round2(deltaPct(units, prevUnits)),
        asp: units > 0 ? round2(revenue / units) : 0,
        share: round2(pct(revenue, shareBase)),
        activeDays: Number(asin.ActiveDays) || 0,
        // Ads context (never the ranking basis)
        adSales: round2(adSales),
        adSpend: round2(adSpend),
        adOrders: Number(asin.AdOrders) || 0,
        acosPct: round2(acos),
        tacos: round2(pct(adSpend, revenue)),
        adShare: round2(pct(adSales, revenue)),
        trend: trend ? trend.revenue : null,
        unitsTrend: trend ? trend.units : null,
      };
    });

    const gmsBySeller = (gmsBySellerResult.recordset || [])
      .map(r => {
        const revenue = Number(r.Revenue) || 0;
        const prevRevenue = Number(r.PrevRevenue) || 0;
        return {
          sellerId: r.SellerId,
          sellerName: r.SellerName || r.SellerId,
          marketplace: r.Marketplace || 'Other',
          revenue: round2(revenue),
          units: Number(r.Units) || 0,
          prevRevenue: round2(prevRevenue),
          deltaPct: deltaPct(revenue, prevRevenue) === null ? null : round2(deltaPct(revenue, prevRevenue)),
          share: round2(pct(revenue, shareBase)),
          asinsWithSales: Number(r.AsinsWithSales) || 0,
        };
      })
      .filter(r => r.revenue > 0 || r.prevRevenue > 0);

    const gmsByMarketplaceMap = {};
    gmsBySeller.forEach(r => {
      const m = gmsByMarketplaceMap[r.marketplace] || { name: r.marketplace, revenue: 0, units: 0, prevRevenue: 0, sellers: 0 };
      m.revenue += r.revenue;
      m.units += r.units;
      m.prevRevenue += r.prevRevenue;
      m.sellers += 1;
      gmsByMarketplaceMap[r.marketplace] = m;
    });
    const gmsByMarketplace = Object.values(gmsByMarketplaceMap)
      .map(m => ({ ...m, revenue: round2(m.revenue), prevRevenue: round2(m.prevRevenue), share: round2(pct(m.revenue, shareBase)) }))
      .sort((a, b) => b.revenue - a.revenue);

    const prevAdSales = sumBy(prevAdsData, 'AdSales');
    const prevAdSpend = sumBy(prevAdsData, 'AdSpend');
    const prevOrders = sumBy(prevAdsData, 'Orders');
    const prevOrganicSales = sumBy(prevAdsData, 'OrganicSales');
    const asinsWithSales = Number((sellingAsinsResult.recordset || [])[0]?.AsinsWithSales) || 0;

    const response = {
      kpi,
      revenue: revenueData,
      areaSeries,
      stackedBarSeries,
      adsPerformanceSeries,
      // ✅ Fix: chart series were computed in processChartData but never
      // returned, leaving KPI sparklines (orders/units/ACoS) empty.
      ordersSeries,
      unitsSeries,
      acosSeries,
      labels,
      category: categoryData,
      tableData,
      roas: totalAdSpend > 0 ? (totalAdSales / totalAdSpend).toFixed(2) : '0.00',
      dailySpend: days > 0 ? (totalAdSpend / days).toFixed(0) : 0,
      userStats,
      teamStats,
      alerts: alertsResult.recordset.map(a => ({
        id: a.Id,
        type: a.Severity || 'info',
        message: a.Message || 'Alert',
        time: formatTimeAgo(a.CreatedAt),
      })),
      stats: {
        totalSellers: (sellerCounts.recordset && sellerCounts.recordset[0]) ? sellerCounts.recordset[0].Total || 0 : 0,
        activeSellers: (sellerCounts.recordset && sellerCounts.recordset[0]) ? sellerCounts.recordset[0].Active || 0 : 0,
        totalAsins: (asinCounts.recordset && asinCounts.recordset[0]) ? asinCounts.recordset[0].Total || 0 : 0,
        activeAsins: (asinCounts.recordset && asinCounts.recordset[0]) ? asinCounts.recordset[0].Active || 0 : 0,
        outOfStockAsins: (asinCounts.recordset && asinCounts.recordset[0]) ? asinCounts.recordset[0].OutOfStock || 0 : 0,
        newThisMonthAsins: (asinCounts.recordset && asinCounts.recordset[0]) ? asinCounts.recordset[0].NewThisMonth || 0 : 0,
      },
      // ── Deep-data blocks (additive; older consumers ignore them) ──────
      period: {
        startDate: startKey,
        endDate: endKey,
        days,
        granularity,
        bucketKeys,
        prevStartDate: prevStartKey,
        prevEndDate: prevEndKey,
      },
      gms: {
        revenue: round2(gmsRevenue),
        units: gmsUnits,
        shippedRevenue: round2(gmsShipped),
        returns: gmsReturns,
        returnRate: round2(pct(gmsReturns, gmsUnits)),
        asp: gmsUnits > 0 ? round2(gmsRevenue / gmsUnits) : 0,
        prevRevenue: round2(prevGmsRevenue),
        prevUnits: prevGmsUnits,
        deltaPct: deltaPct(gmsRevenue, prevGmsRevenue) === null ? null : round2(deltaPct(gmsRevenue, prevGmsRevenue)),
        unitsDeltaPct: deltaPct(gmsUnits, prevGmsUnits) === null ? null : round2(deltaPct(gmsUnits, prevGmsUnits)),
        tacos: round2(pct(totalAdSpend, gmsRevenue)),
        adShare: round2(pct(totalAdSales, gmsRevenue)),
        asinsWithSales,
        activeDays: gmsRows.filter(r => (Number(r.Revenue) || 0) > 0).length,
        series: gmsSeries,
        unitsSeries: gmsUnitsSeries,
        tacosSeries,
        dailyAverage: days > 0 ? round2(gmsRevenue / days) : 0,
        rankedAsins: topRows.length,
        rankedRevenue: round2(rankedTotal),
      },
      ads: {
        adSales: round2(totalAdSales),
        adSpend: round2(totalAdSpend),
        orders: totalOrders,
        organicSales: round2(totalOrganicSales),
        impressions: totalImpressions,
        clicks: totalClicks,
        ctr: round2(pct(totalClicks, totalImpressions)),
        cpc: totalClicks > 0 ? round2(totalAdSpend / totalClicks) : 0,
        acos: round2(pct(totalAdSpend, totalAdSales)),
        roas: totalAdSpend > 0 ? round2(totalAdSales / totalAdSpend) : 0,
      },
      previous: {
        startDate: prevStartKey,
        endDate: prevEndKey,
        days,
        adSales: round2(prevAdSales),
        adSpend: round2(prevAdSpend),
        orders: prevOrders,
        organicSales: round2(prevOrganicSales),
        acos: round2(pct(prevAdSpend, prevAdSales)),
        roas: prevAdSpend > 0 ? round2(prevAdSales / prevAdSpend) : 0,
        gmsRevenue: round2(prevGmsRevenue),
        gmsUnits: prevGmsUnits,
        tacos: round2(pct(prevAdSpend, prevGmsRevenue)),
      },
      gmsBySeller,
      gmsByMarketplace,
    };

    dashboardCache.set(cacheKey, response);
    res.json(response);
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
};

/**
 * yyyy-mm-dd in the process's LOCAL timezone. The mssql pool is configured
 * with useUTC=false (and server.js pins TZ), so DATE columns arrive as local
 * midnight — ISO/UTC keys would land on the previous day for IST.
 */
function toDateKey(value) {
  if (!value) return '';
  const str = value instanceof Date ? null : String(value);
  if (str && /^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const d = value instanceof Date ? value : new Date(str);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse yyyy-mm-dd (or any date string) as a LOCAL-midnight Date. */
function parseLocalDate(value) {
  const str = String(value);
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(str);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function processChartData(days, adsData = [], endDate, gmsRows = []) {
  const endDateObj = new Date(endDate);
  const useWeekly = days > 60;
  const bucketCount = useWeekly ? Math.ceil(days / 7) : days;
  const buckets = [];
  const bucketMap = {};

  for (let i = bucketCount - 1; i >= 0; i--) {
    const d = new Date(endDateObj);
    if (useWeekly) d.setDate(d.getDate() - i * 7);
    else d.setDate(d.getDate() - i);
    
    const dateStr = toDateKey(d);
    const bucket = {
      key: dateStr,
      ts: d.getTime(),
      index: buckets.length,
      revenue: 0,
      organic: 0,
      ppc: 0,
      adsSpend: 0,
      orders: 0,
      gms: 0,
      gmsUnits: 0
    };
    buckets.push(bucket);
    bucketMap[dateStr] = bucket;
  }

  const findBucket = (adDateStr) => {
    if (bucketMap[adDateStr]) return bucketMap[adDateStr];
    const t = parseLocalDate(adDateStr).getTime();
    let best = buckets[0];
    let bestDist = Math.abs(buckets[0].ts - t);
    for (let i = 1; i < buckets.length; i++) {
      const dist = Math.abs(buckets[i].ts - t);
      if (dist < bestDist) { bestDist = dist; best = buckets[i]; }
    }
    return best;
  };

  const rowKey = (row) => toDateKey(row.Date) || toDateKey(row);

  adsData.forEach(ad => {
    const b = findBucket(rowKey(ad));
    const rev = (Number(ad.AdSales) || 0) + (Number(ad.OrganicSales) || 0);
    b.revenue += rev;
    b.organic += Number(ad.OrganicSales) || 0;
    b.ppc += Number(ad.AdSales) || 0;
    b.adsSpend += Number(ad.AdSpend) || 0;
    b.orders += Number(ad.Orders) || 0;
  });

  gmsRows.forEach(g => {
    const b = findBucket(rowKey(g));
    b.gms += Number(g.Revenue) || 0;
    b.gmsUnits += Number(g.Units) || 0;
  });

  const labels = buckets.map(b => {
    const date = parseLocalDate(b.key);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  });

  return {
    revenueData: [{ name: 'Revenue', data: buckets.map(b => Math.round(b.revenue)) }],
    stackedBarSeries: [
      { name: 'Total Sales', data: buckets.map(b => Math.round(b.revenue)) },
      { name: 'Ad Sales', data: buckets.map(b => Math.round(b.ppc)) },
      { name: 'Organic Sales', data: buckets.map(b => Math.round(b.organic)) }
    ],
    areaSeries: [
      { name: 'Organic Sales', data: buckets.map(b => Math.round(b.organic)) },
      { name: 'Ad Sales', data: buckets.map(b => Math.round(b.ppc)) }
    ],
    adsPerformanceSeries: [
      { name: 'Ad Revenue', data: buckets.map(b => Math.round(b.ppc)) },
      { name: 'Ad Spend', data: buckets.map(b => Math.round(b.adsSpend)) }
    ],
    ordersSeries: buckets.map(b => b.orders),
    // ✅ Fix: units were estimated as orders * 1.48 — report actual orders
    // instead of fabricating a conversion multiplier.
    unitsSeries: buckets.map(b => Math.round(b.orders || 0)),
    acosSeries: buckets.map(b => b.ppc > 0 ? Math.round((b.adsSpend / b.ppc) * 100) : 0),
    // GMS (merchandise) series, bucket-aligned with the ads series above.
    gmsSeries: buckets.map(b => Math.round(b.gms)),
    gmsUnitsSeries: buckets.map(b => Math.round(b.gmsUnits)),
    tacosSeries: buckets.map(b => b.gms > 0 ? Math.round((b.adsSpend / b.gms) * 1000) / 10 : 0),
    labels,
    bucketKeys: buckets.map(b => b.key),
    granularity: useWeekly ? 'week' : 'day',
    /** Map any date-like value to its bucket index (or -1 when there are no buckets). */
    bucketize: (value) => {
      if (buckets.length === 0) return -1;
      const key = toDateKey(value);
      if (!key) return -1;
      return findBucket(key).index;
    },
  };
}

function processCategoryData(rows) {
  const colors = ['#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4'];
  return rows.map((row, idx) => ({
    name: row.Category || 'Uncategorized',
    data: [row.Count],
    color: colors[idx % colors.length],
  }));
}

function formatTimeAgo(date) {
  if (!date) return 'recently';
  const diff = new Date() - new Date(date);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}
