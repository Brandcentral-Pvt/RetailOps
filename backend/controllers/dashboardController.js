const { isGlobalUserRole } = require('../utils/roleUtils');
const { sql, getPool } = require('../database/db');
const { buildInClause } = require('../utils/sqlHelpers');
const cacheService = require('../services/cacheService');

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
 * Get dashboard summary data (Optimized SQL Version)
 */
exports.getDashboardData = async (req, res) => {
  try {
    const { period = '30d', startDate: startQuery, endDate: endQuery, sellerId } = req.query;
    const userId = req.user?.Id || req.user?._id?.toString() || '';

    const cacheKey = `${userId}|${sellerId || 'all'}|${startQuery || ''}|${endQuery || ''}|${period}`;

    // Use distributed cache with locking to prevent thundering herd
    const data = await cacheService.rememberWithLock(
      cacheKey,
      async () => {
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

        // 2. Aggregate Counts - Combined into fewer queries
        const sellerCountsResult = await buildDashReq().query(`
          SELECT 
            COUNT(*) as Total,
            SUM(CASE WHEN IsActive = 1 THEN 1 ELSE 0 END) as Active
          FROM Sellers ${sellerFilter}
        `);

        const [
          asinCountsResult,
          alertsResult,
          userActionStatsResult,
          teamActionStatsPromise,
          asinsGroupedResult,
          sellersMapResult
        ] = await Promise.all([
          buildDashReq().query(`
            SELECT 
              COUNT(*) as Total,
              SUM(CASE WHEN Status IN ('Active', 'Scraping') THEN 1 ELSE 0 END) as Active,
              SUM(CASE WHEN Status IN ('Active', 'Scraping') AND (StockLevel = 0 OR StockLevel IS NULL) THEN 1 ELSE 0 END) as OutOfStock,
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
            : Promise.resolve({ recordset: [] }),
          // Pre-fetch for marketplace distribution
          buildDashReq().query(`
            SELECT SellerId, COUNT(*) as Count 
            FROM Asins
            ${asinFilter}
            GROUP BY SellerId
          `),
          pool.request().query(`
            SELECT Id, Marketplace FROM Sellers
          `)
        ]);

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
          startDate = new Date(cleanStart);
          endDate = new Date(cleanEnd);
          days = Math.max(1, Math.ceil(Math.abs(endDate - startDate) / (1000 * 60 * 60 * 24)) + 1);
        } else {
          days = Math.min(parsePeriod(period), 365);
          endDate = new Date();
          startDate = new Date();
          startDate.setDate(startDate.getDate() - days);
        }

        // Process marketplace distribution in parallel with ads data
        const [
          adsDataResult,
          sellersMapResult2,
          topAsinsResult
        ] = await Promise.all([
          // Ads data
          buildDashReq()
            .input('startDate', sql.Date, startDate)
            .input('endDate', sql.Date, endDate)
            .query(`
              SELECT 
                A.AsinCode,
                AP.Date,
                AP.AdSales,
                AP.AdSpend,
                AP.Orders,
                AP.OrganicSales,
                AP.Impressions,
                AP.Clicks
              FROM AdsPerformance AP
              JOIN Asins A ON AP.Asin = A.AsinCode
              WHERE AP.Date BETWEEN @startDate AND @endDate
              AND AP.ReportType = 'daily'
              ${asinFilter ? asinFilter.replace('WHERE', 'AND') : ''}
            `),
          // Sellers map for marketplace distribution
          pool.request().query(`
            SELECT Id, Marketplace FROM Sellers
          `),
          // Top ASINs
          pool.request()
            .input('startDate', sql.Date, startDate)
            .input('endDate', sql.Date, endDate)
            .query(`
            SELECT TOP 200 
              A.Id, A.AsinCode, A.Sku, A.Title, A.Category, A.CurrentPrice,
              S.Name as SellerName,
              SUM(ISNULL(AP.AdSales, 0)) as TotalAdSales,
              SUM(ISNULL(AP.OrganicSales, 0)) as TotalOrganicSales,
              SUM(ISNULL(AP.AdSpend, 0)) as TotalAdSpend,
              SUM(ISNULL(AP.Orders, 0)) as TotalOrders
            FROM Asins A
            JOIN Sellers S ON A.SellerId = S.Id
            LEFT JOIN AdsPerformance AP ON A.AsinCode = AP.Asin
            ${asinFilter}
            GROUP BY A.Id, A.AsinCode, A.Sku, A.Title, A.Category, A.CurrentPrice, S.Name
            ORDER BY TotalOrders DESC
          `)
        ]);

        const adsData = adsDataResult.recordset || [];
        const totalAdSales = adsData.reduce((sum, ad) => sum + (ad.AdSales || 0), 0);
        const totalAdSpend = adsData.reduce((sum, ad) => sum + (ad.AdSpend || 0), 0);
        const totalOrders = adsData.reduce((sum, ad) => sum + (ad.Orders || 0), 0);
        const totalCatalogValue = (asinCounts.recordset && asinCounts.recordset[0]) ? asinCounts.recordset[0].PortfolioValue || 0 : 0;

        const activeAsinCount = (asinCounts.recordset && asinCounts.recordset[0]) ? asinCounts.recordset[0].Active || 0 : 0;
        const kpi = [
          { id: 1, title: 'Total Ad Sales', value: `₹${totalAdSales.toLocaleString()}`, icon: 'bi-graph-up-arrow', trend: totalOrders, trendType: 'positive' },
          { id: 2, title: 'Total Ad Spend', value: `₹${totalAdSpend.toLocaleString()}`, icon: 'bi-cash-stack', trend: 0, trendType: 'neutral' },
          { id: 3, title: 'Active ASINs', value: activeAsinCount.toLocaleString(), icon: 'bi-box-seam', trend: activeAsinCount, trendType: 'positive' },
          { id: 4, title: 'Catalog Value', value: `₹${totalCatalogValue.toLocaleString()}`, icon: 'bi-currency-rupee', trend: 0, trendType: 'neutral' },
        ];

        // Process chart data
        const { revenueData, areaSeries, stackedBarSeries, adsPerformanceSeries, labels, ordersSeries, unitsSeries, acosSeries } = processChartData(days, adsDataResult.recordset || [], endDate);

        // Marketplace distribution
        const asinsGroupedResult2 = await buildDashReq().query(`
          SELECT SellerId, COUNT(*) as Count 
          FROM Asins
          ${asinFilter}
          GROUP BY SellerId
        `);

        // Build marketplace counts
        const marketplaceCounts = {};
        const sellersMap = {};
        sellersMapResult2.recordset.forEach(s => {
          sellersMap[s.Id] = s.Marketplace || 'Other';
        });

        asinsGroupedResult2.recordset.forEach(row => {
          const mkt = sellersMap[row.SellerId] || 'Other';
          marketplaceCounts[mkt] = (marketplaceCounts[mkt] || 0) + row.Count;
        });

        const categoryData = Object.entries(marketplaceCounts).map(([mkt, count], idx) => ({
          name: mkt,
          data: [count],
          color: ['#3b82f6', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6'][idx % 5]
        }));

        const topAsinsResult2 = await pool.request()
          .input('startDate', sql.Date, startDate)
          .input('endDate', sql.Date, endDate)
          .query(`
          SELECT TOP 200 
            A.Id, A.AsinCode, A.Sku, A.Title, A.Category, A.CurrentPrice,
            S.Name as SellerName,
            SUM(ISNULL(AP.AdSales, 0)) as TotalAdSales,
            SUM(ISNULL(AP.OrganicSales, 0)) as TotalOrganicSales,
            SUM(ISNULL(AP.AdSpend, 0)) as TotalAdSpend,
            SUM(ISNULL(AP.Orders, 0)) as TotalOrders
          FROM Asins A
          JOIN Sellers S ON A.SellerId = S.Id
          LEFT JOIN AdsPerformance AP ON A.AsinCode = AP.Asin
          ${asinFilter}
          GROUP BY A.Id, A.AsinCode, A.Sku, A.Title, A.Category, A.CurrentPrice, S.Name
          ORDER BY TotalOrders DESC
        `);

        const tableData = topAsinsResult2.recordset.map(asin => {
          const totalRev = asin.TotalAdSales + asin.TotalOrganicSales;
          const acos = asin.TotalAdSales > 0 ? (asin.TotalAdSpend / asin.TotalAdSales) * 100 : 0;
          return {
            sku: asin.Sku || asin.AsinCode,
            asin: asin.AsinCode,
            title: asin.Title || 'Unknown Product',
            category: asin.Category || 'Uncategorized',
            revenue: totalRev || asin.CurrentPrice || 0,
            units: asin.TotalOrders || 0,
            acos: acos.toFixed(1) + '%',
          };
        });

        // Return the complete response object
        return {
          kpi,
          userStats,
          teamStats,
          revenueData,
          areaSeries,
          stackedBarSeries,
          adsPerformanceSeries,
          labels,
          ordersSeries,
          unitsSeries,
          acosSeries,
          categoryData,
          tableData,
          sellerCounts: sellerCountsResult.recordset[0],
          asinCounts: asinCountsResult.recordset[0],
          alerts: alertsResult.recordset,
        };
      },
      60,  // TTL: 60 seconds
      30   // Lock TTL: 30 seconds
    );

    return res.json(data);
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
};

function processChartData(days, adsData = [], endDate) {
  const endDateObj = new Date(endDate);
  const useWeekly = days > 60;
  const bucketCount = useWeekly ? Math.ceil(days / 7) : days;
  const buckets = [];
  const bucketMap = {};

  for (let i = bucketCount - 1; i >= 0; i--) {
    const d = new Date(endDateObj);
    if (useWeekly) d.setDate(d.getDate() - i * 7);
    else d.setDate(d.getDate() - i);
    
    const dateStr = d.toISOString().split('T')[0];
    const bucket = {
      key: dateStr,
      ts: d.getTime(),
      revenue: 0,
      organic: 0,
      ppc: 0,
      adsSpend: 0,
      orders: 0
    };
    buckets.push(bucket);
    bucketMap[dateStr] = bucket;
  }

  const findBucket = (adDateStr) => {
    if (bucketMap[adDateStr]) return bucketMap[adDateStr];
    let best = buckets[0];
    let bestDist = Math.abs(buckets[0].ts - new Date(adDateStr).getTime());
    for (let i = 1; i < buckets.length; i++) {
      const dist = Math.abs(buckets[i].ts - new Date(adDateStr).getTime());
      if (dist < bestDist) { bestDist = dist; best = buckets[i]; }
    }
    return best;
  };

  adsData.forEach(ad => {
    const b = findBucket(ad.Date?.toISOString?.()?.split('T')[0] || ad.Date);
    const rev = ad.AdSales + ad.OrganicSales;
    b.revenue += rev;
    b.organic += ad.OrganicSales || 0;
    b.ppc += ad.AdSales || 0;
    b.adsSpend += ad.AdSpend || 0;
    b.orders += ad.Orders || 0;
  });

  const labels = buckets.map(b => {
    const date = new Date(b.key);
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
    unitsSeries: buckets.map(b => Math.round((b.orders || 0) * 1.48)),
    acosSeries: buckets.map(b => b.ppc > 0 ? Math.round((b.adsSpend / b.ppc) * 100) : 0),
    labels
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