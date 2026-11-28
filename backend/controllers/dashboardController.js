const { isGlobalUserRole } = require('../utils/roleUtils');
const { sql, getPool } = require('../database/db');
const { buildInClause } = require('../utils/sqlHelpers');
const { dateWindow,gmsCatalogApplySql,unambiguousSellerSql }=require('../utils/gmsPhase1');
const {exactSum,metricProjection,percentage:pct,change:deltaPct,rounded:round2,periodCoverage}=require('../services/dashboardFinancialMetrics');
const { AdsScopeError } = require('../services/adsCanonicalScope');
const dashboardScope=require('../services/dashboardScope');
const { projection:adsProjection, summarize:adsSummary, rounded:adsRound } = require('../services/adsConsumerMetrics');

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

function parseDashboardWindow(start,end,period){
  try{
    let startDate,endDate,days;
    if(start!==undefined||end!==undefined){
      const w=dateWindow(start,end,{required:true});
      startDate=parseLocalDate(w.from);endDate=parseLocalDate(w.to);
      days=Math.round((Date.parse(w.to)-Date.parse(w.from))/86400000)+1;
    }else{
      if(typeof period!=='string'||!/^\d+(d|w|m|mo|mon|q|y)?$/i.test(period))throw Error('Invalid reporting period');
      days=parsePeriod(period);endDate=parseLocalDate(toDateKey(new Date()));startDate=new Date(endDate);startDate.setDate(startDate.getDate()-days+1);
    }
    if(!Number.isSafeInteger(days)||days<1||days>366)throw Error('Reporting range must be between 1 and 366 days');
    return {startDate,endDate,days};
  }catch(e){throw new AdsScopeError('invalid_dashboard_range',e.message,400);}
}

/**
 * Get dashboard summary data (SQL Version)
 */
exports.getDashboardData = async (req, res) => {
  try {
    res.set?.('Cache-Control','private, no-store');
    const { period = '30d', startDate: startQuery, endDate: endQuery, sellerId,managerId } = req.query;
    const userId = req.user?.Id || req.user?._id?.toString() || '';

    const range=parseDashboardWindow(startQuery,endQuery,period);
    const pool=await getPool();
    const canonicalScope=await dashboardScope.resolveDashboardScope({pool,sql,user:req.user,sellerId,managerId});

    const isGlobalUser=canonicalScope.isGlobal;
    const safeSellerIds=canonicalScope.sellerIds;
    const useWideFilters = canonicalScope.unrestricted;

    let sellerFilter = '';
    let asinFilter = '';
    let alertFilter = '';
    let sellerParams = [];

    if(canonicalScope.empty){sellerFilter='WHERE 1=0';asinFilter='WHERE 1=0';alertFilter='WHERE 1=0';}
    else if (!useWideFilters && safeSellerIds.length > 0) {
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
    const hasExplicitFilter=canonicalScope.managerId!==null||canonicalScope.requested.length>0||canonicalScope.empty;
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
      hasExplicitFilter?Promise.resolve({recordset:[]}):pool.request()
        .input('userId', sql.VarChar, req.user.Id || req.user._id.toString())
        .query(`
          SELECT Status, COUNT(*) as Count 
          FROM Actions 
          WHERE AssignedTo = @userId 
          GROUP BY Status
        `),
      isGlobalUser&&!hasExplicitFilter
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

    const {startDate,endDate,days}=range;

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
    const ownerExpr='COALESCE(g.SellerId,a.SellerId)';
    // Match the GMS Tracker's conservative restricted-user ownership policy.
    // Global views retain unresolved history once, under an unmatched group.
    const scopedOwners=sellerParams.map((_,i)=>'@dashSeller_'+i).join(',');
    const gmsScopeFilter=canonicalScope.empty?'AND 1=0':useWideFilters?'':canonicalScope.isGlobal?`AND ${ownerExpr} IN (${scopedOwners})`:`AND a.SellerId IN (${scopedOwners}) AND ${unambiguousSellerSql('a')}`;
    const gmsFrom=`FROM GmsDailyPerformance g ${gmsCatalogApplySql}`;

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
          ${adsProjection('AP')}
        FROM dbo.AdsProductDailyFacts AP
        WHERE AP.Date BETWEEN @prevStart AND @endDate
        AND AP.ReportType = 'daily' AND AP.Currency = 'INR'
        ${asinJoinFilter.replace(/A\.SellerId/g,'AP.SellerId')}
        GROUP BY AP.Date
      `);

    const allAdsRows = adsDataResult.recordset || [];
    const adsData = allAdsRows.filter(isCurrentRow);
    const prevAdsData = allAdsRows.filter(r => !isCurrentRow(r));
    const currentAds=adsSummary(adsData),priorAds=adsSummary(prevAdsData);
    const {AdSales:totalAdSales,AdSpend:totalAdSpend,Orders:totalOrders,OrganicSales:totalOrganicSales,Impressions:totalImpressions,Clicks:totalClicks}=currentAds.totals;
    const totalCatalogValue = (asinCounts.recordset && asinCounts.recordset[0]) ? asinCounts.recordset[0].PortfolioValue || 0 : 0;

    // 6b. GMS (ordered revenue / units) per day — the merchandise truth the
    // top-products table and the GMS KPIs are built on. Same 2× window.
    const gmsDailyResult = await buildRangeReq()
      .query(`
        SELECT
          g.Date,
          ${metricProjection('g.OrderedRevenue','Revenue')},
          ${metricProjection('g.OrderedUnits','Units',{scale:0})},
          ${metricProjection('g.ShippedRevenue','ShippedRevenue')},
          ${metricProjection('g.CustomerReturns','Returns',{scale:0})}
        ${gmsFrom}
        WHERE g.Date BETWEEN @prevStart AND @endDate
        ${gmsScopeFilter}
        GROUP BY g.Date
      `);

    const allGmsRows = gmsDailyResult.recordset || [];
    const gmsRows = allGmsRows.filter(isCurrentRow);
    const prevGmsRows = allGmsRows.filter(r => !isCurrentRow(r));
    const gmsRevenue = exactSum(gmsRows, 'Revenue');
    const gmsUnits = exactSum(gmsRows, 'Units',0);
    const gmsShipped = exactSum(gmsRows, 'ShippedRevenue');
    const gmsReturns = exactSum(gmsRows, 'Returns',0);
    const prevGmsRevenue = exactSum(prevGmsRows, 'Revenue');
    const prevGmsUnits = exactSum(prevGmsRows, 'Units',0);
    const coverage=periodCoverage(gmsRows,days),previousCoverage=periodCoverage(prevGmsRows,days);
    const comparable=coverage.complete&&previousCoverage.complete;

    const activeAsinCount = (asinCounts.recordset && asinCounts.recordset[0]) ? asinCounts.recordset[0].Active || 0 : 0;
    const kpi = [
      { id: 1, title: 'Total Ad Sales', value: totalAdSales==null?'N/A':`₹${totalAdSales.toLocaleString()}`, icon: 'bi-graph-up-arrow', trend: totalOrders, trendType: 'positive' },
      { id: 2, title: 'Total Ad Spend', value: totalAdSpend==null?'N/A':`₹${totalAdSpend.toLocaleString()}`, icon: 'bi-cash-stack', trend: 0, trendType: 'neutral' },
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
          g.Asin, ${ownerExpr} AS SellerId,
          ${metricProjection('g.OrderedRevenue','GmsRevenue',{condition:'g.Date >= @startDate',scale:2})},
          ${metricProjection('g.OrderedUnits','GmsUnits',{condition:'g.Date >= @startDate',scale:0})},
          ${metricProjection('g.ShippedRevenue','ShippedRevenue',{condition:'g.Date >= @startDate',scale:2})},
          ${metricProjection('g.CustomerReturns','Returns',{condition:'g.Date >= @startDate',scale:0})},
          ${metricProjection('g.OrderedRevenue','PrevGmsRevenue',{condition:'g.Date < @startDate',scale:2})},
          ${metricProjection('g.OrderedUnits','PrevGmsUnits',{condition:'g.Date < @startDate',scale:0})},
          COUNT(DISTINCT CASE WHEN g.Date >= @startDate AND g.OrderedRevenue > 0 THEN g.Date END) AS ActiveDays,
          COUNT(DISTINCT CASE WHEN g.Date >= @startDate THEN g.Date END) AS CurrentDays,
          COUNT(DISTINCT CASE WHEN g.Date < @startDate THEN g.Date END) AS PreviousDays
        ${gmsFrom}
        WHERE g.Date BETWEEN @prevStart AND @endDate
        ${gmsScopeFilter}
        GROUP BY g.Asin, ${ownerExpr}
      ),
      AdsAgg AS (
        SELECT
          AP.Asin,AP.SellerId,
          ${adsProjection('AP')}
        FROM dbo.AdsProductDailyFacts AP
        WHERE AP.Date BETWEEN @startDate AND @endDate
          AND AP.ReportType = 'daily' AND AP.Currency = 'INR'
          ${asinJoinFilter.replace(/A\.SellerId/g,'AP.SellerId')}
        GROUP BY AP.Asin,AP.SellerId
      )
      SELECT TOP 200
        A.Id, A.AsinCode, A.Sku, A.Title, A.Category, A.Brand, A.ParentAsin,
        A.CurrentPrice, A.ImageUrl, A.Status, A.AvailabilityStatus, A.SellerId,
        S.Name AS SellerName, S.Marketplace,
        G.GmsRevenue, G.GmsUnits, G.ShippedRevenue, G.Returns,
        G.PrevGmsRevenue, G.PrevGmsUnits, G.ActiveDays,G.CurrentDays,G.PreviousDays,
        AD.[FactRows],AD.[AdSales],AD.[AdSalesCount],AD.[AdSpend],AD.[AdSpendCount],AD.[TotalSales],AD.[TotalSalesCount],AD.[OrganicSales],AD.[OrganicSalesCount],AD.[Orders],AD.[OrdersCount],AD.[Impressions],AD.[ImpressionsCount],AD.[Clicks],AD.[ClicksCount],AD.[acosPairCount],AD.[tacosPairCount],AD.[adSharePairCount],AD.[roasPairCount],AD.[ctrPairCount],AD.[cpcPairCount]
      FROM GmsAgg G
      CROSS APPLY (SELECT TOP(1) c.* FROM Asins c WHERE UPPER(LTRIM(RTRIM(c.AsinCode)))=UPPER(LTRIM(RTRIM(G.Asin))) AND c.SellerId=G.SellerId ORDER BY c.Id) A
      JOIN Sellers S ON G.SellerId = S.Id
      LEFT JOIN AdsAgg AD ON AD.Asin = G.Asin AND AD.SellerId = G.SellerId
      WHERE (TRY_CONVERT(decimal(38,2),G.GmsRevenue)>0 OR TRY_CONVERT(bigint,G.GmsUnits)>0)
      ${asinJoinFilter}
      ORDER BY TRY_CONVERT(decimal(38,2),G.GmsRevenue) DESC, TRY_CONVERT(bigint,G.GmsUnits) DESC,A.Id
    `);

    // 9. GMS by seller (brand leaderboard) — current + previous window.
    const gmsBySellerPromise = buildRangeReq()
      .query(`
        SELECT
          ${ownerExpr} AS SellerId, S.Name AS SellerName, S.Marketplace,
          ${metricProjection('g.OrderedRevenue','Revenue',{condition:'g.Date >= @startDate',scale:2})},
          ${metricProjection('g.OrderedUnits','Units',{condition:'g.Date >= @startDate',scale:0})},
          ${metricProjection('g.OrderedRevenue','PrevRevenue',{condition:'g.Date < @startDate',scale:2})},
          COUNT(DISTINCT CASE WHEN g.Date >= @startDate AND g.OrderedRevenue > 0 THEN g.Asin END) AS AsinsWithSales,
          COUNT(DISTINCT CASE WHEN g.Date >= @startDate THEN g.Date END) AS CurrentDays,
          COUNT(DISTINCT CASE WHEN g.Date < @startDate THEN g.Date END) AS PreviousDays
        ${gmsFrom}
        LEFT JOIN Sellers S ON S.Id = ${ownerExpr}
        WHERE g.Date BETWEEN @prevStart AND @endDate
        ${gmsScopeFilter}
        GROUP BY ${ownerExpr}, S.Name, S.Marketplace
        ORDER BY TRY_CONVERT(decimal(38,2),CASE WHEN COUNT_BIG(CASE WHEN g.Date >= @startDate THEN 1 END)>0 AND COUNT_BIG(CASE WHEN g.Date >= @startDate THEN 1 END)=COUNT_BIG(CASE WHEN g.Date >= @startDate AND g.OrderedRevenue IS NOT NULL THEN 1 END) THEN SUM(CASE WHEN g.Date >= @startDate THEN CONVERT(decimal(38,2),g.OrderedRevenue) END) END) DESC
      `);

    // Distinct ASINs with ordered revenue in the current window (scoped).
    const sellingAsinsPromise = buildRangeReq()
      .query(`
        SELECT COUNT(DISTINCT g.Asin) AS AsinsWithSales
        ${gmsFrom}
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
        SELECT g.Asin, ${ownerExpr} AS SellerId, g.Date,
          ${metricProjection('g.OrderedRevenue','Revenue')},
          ${metricProjection('g.OrderedUnits','Units',{scale:0})}
        ${gmsFrom}
        WHERE g.Date BETWEEN @startDate AND @endDate
          AND g.Asin IN (${sparkClause}) ${gmsScopeFilter}
        GROUP BY g.Asin, ${ownerExpr}, g.Date
      `);
      (sparkResult.recordset || []).forEach(row => {
        const key=JSON.stringify([row.SellerId,row.Asin]);
        if (!trendByAsin[key]) {
          trendByAsin[key] = bucketKeys.map(()=>[]);
        }
        const idx = bucketize(row.Date);
        if (idx >= 0) {
          trendByAsin[key][idx].push(row);
        }
      });
    }

    const rankedTotal = exactSum(topRows,'GmsRevenue');
    const shareBase = gmsRevenue;

    const tableData = topRows.map((asin, i) => {
      const revenue=exactSum([asin],'GmsRevenue'),units=exactSum([asin],'GmsUnits',0);
      const prevRevenue=exactSum([asin],'PrevGmsRevenue'),prevUnits=exactSum([asin],'PrevGmsUnits',0);
      const rowComparable=Number(asin.CurrentDays)===days&&Number(asin.PreviousDays)===days;
      const ad=adsSummary([asin]);
      const adSales=ad.totals.AdSales,adSpend=ad.totals.AdSpend;
      const returns=exactSum([asin],'Returns',0);
      const acos=ad.ratios.acos;
      const trend = trendByAsin[JSON.stringify([asin.SellerId,asin.AsinCode])] || null;
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
        acos: acos==null?'N/A':acos.toFixed(1)+'%',
        // GMS block
        gmsRevenue: round2(revenue),
        gmsUnits: units,
        shippedRevenue: exactSum([asin],'ShippedRevenue'),
        returns,
        returnRate: round2(pct(returns, units)),
        prevGmsRevenue: round2(prevRevenue),
        prevGmsUnits: prevUnits,
        deltaPct: round2(deltaPct(revenue,prevRevenue,rowComparable)),
        unitsDeltaPct: round2(deltaPct(units,prevUnits,rowComparable)),
        asp: units>0&&revenue!=null?round2(revenue/units):null,
        share: round2(pct(revenue, shareBase)),
        activeDays: Number(asin.ActiveDays) || 0,
        // Ads context (never the ranking basis)
        adSales:adsRound(adSales),adSpend:adsRound(adSpend),adOrders:ad.totals.Orders,
        adTotalSales:adsRound(ad.totals.TotalSales),adsCoverage:ad.coverage,adsRatioCoverage:ad.ratioCoverage,
        acosPct:adsRound(acos),tacos:adsRound(ad.ratios.tacos),adShare:adsRound(ad.ratios.adShare),
        trend: trend?trend.map(rows=>exactSum(rows,'Revenue')):null,
        unitsTrend: trend?trend.map(rows=>exactSum(rows,'Units',0)):null,
      };
    });

    const gmsBySeller = (gmsBySellerResult.recordset || [])
      .map(r => {
        const revenue=exactSum([r],'Revenue'),prevRevenue=exactSum([r],'PrevRevenue');
        const rowComparable=Number(r.CurrentDays)===days&&Number(r.PreviousDays)===days;
        return {
          sellerId: r.SellerId,
          sellerName: r.SellerName || r.SellerId || 'Unmatched ownership',
          marketplace: r.Marketplace || 'Other',
          revenue: round2(revenue),
          units: exactSum([r],'Units',0),
          prevRevenue: round2(prevRevenue),
          deltaPct: round2(deltaPct(revenue,prevRevenue,rowComparable)),
          share: round2(pct(revenue, shareBase)),
          asinsWithSales: Number(r.AsinsWithSales) || 0,
        };
      })
      .filter(r => r.revenue!==0 || r.prevRevenue!==0);

    const marketplaceGroups=new Map();
    for(const row of gmsBySellerResult.recordset||[]){
      const key=row.Marketplace||'Other';
      if(!marketplaceGroups.has(key))marketplaceGroups.set(key,[]);
      marketplaceGroups.get(key).push(row);
    }
    const gmsByMarketplace=[...marketplaceGroups].map(([name,rows])=>{
      const revenue=exactSum(rows,'Revenue');
      return {name,revenue,units:exactSum(rows,'Units',0),prevRevenue:exactSum(rows,'PrevRevenue'),share:round2(pct(revenue,shareBase)),sellers:rows.filter(r=>r.SellerId!=null).length};
    }).sort((a,b)=>(b.revenue??-Infinity)-(a.revenue??-Infinity));

    const {AdSales:prevAdSales,AdSpend:prevAdSpend,Orders:prevOrders,OrganicSales:prevOrganicSales}=priorAds.totals;
    const asinsWithSales = Number((sellingAsinsResult.recordset || [])[0]?.AsinsWithSales) || 0;

    const response = {
      scope:dashboardScope.publicScope(canonicalScope),
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
      roas: currentAds.ratios.roas==null?null:currentAds.ratios.roas.toFixed(2),
      dailySpend: days>0&&totalAdSpend!=null?(totalAdSpend/days).toFixed(0):null,
      userStats:hasExplicitFilter?null:userStats,
      teamStats:hasExplicitFilter?null:teamStats,
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
        asp: gmsUnits>0&&gmsRevenue!=null?round2(gmsRevenue/gmsUnits):null,
        prevRevenue: round2(prevGmsRevenue),
        prevUnits: prevGmsUnits,
        deltaPct: round2(deltaPct(gmsRevenue,prevGmsRevenue,comparable)),
        unitsDeltaPct: round2(deltaPct(gmsUnits,prevGmsUnits,comparable)),
        tacos:adsRound(currentAds.ratios.tacos),adShare:adsRound(currentAds.ratios.adShare),
        asinsWithSales,
        activeDays: gmsRows.filter(r => (Number(r.Revenue) || 0) > 0).length,
        series: gmsSeries,
        unitsSeries: gmsUnitsSeries,
        tacosSeries,
        dailyAverage: coverage.complete&&gmsRevenue!=null?round2(gmsRevenue/days):null,
        coverage,previousCoverage,source:'gms_owner_aware_v1',
        rankedAsins: topRows.length,
        rankedRevenue: round2(rankedTotal),
      },
      ads: {
        source:'canonical_v1',currency:'INR',coverage:currentAds.coverage,ratioCoverage:currentAds.ratioCoverage,
        adSales:adsRound(totalAdSales),adSpend:adsRound(totalAdSpend),totalSales:adsRound(currentAds.totals.TotalSales),
        orders:totalOrders,organicSales:adsRound(totalOrganicSales),impressions:totalImpressions,clicks:totalClicks,
        ctr:adsRound(currentAds.ratios.ctr),cpc:adsRound(currentAds.ratios.cpc),acos:adsRound(currentAds.ratios.acos),
        roas:adsRound(currentAds.ratios.roas),tacos:adsRound(currentAds.ratios.tacos),adShare:adsRound(currentAds.ratios.adShare),
      },
      previous: {
        startDate: prevStartKey,
        endDate: prevEndKey,
        days,
        adSales:adsRound(prevAdSales),adSpend:adsRound(prevAdSpend),orders:prevOrders,organicSales:adsRound(prevOrganicSales),
        adsCoverage:priorAds.coverage,adsRatioCoverage:priorAds.ratioCoverage,
        acos:adsRound(priorAds.ratios.acos),roas:adsRound(priorAds.ratios.roas),
        gmsRevenue: round2(prevGmsRevenue),
        gmsUnits: prevGmsUnits,
        tacos:adsRound(priorAds.ratios.tacos),
      },
      gmsBySeller,
      gmsByMarketplace,
    };

    res.json(response);
  } catch (error) {
    if (!res.headersSent) {
      res.status(error instanceof AdsScopeError?error.status:500).json({error:error instanceof AdsScopeError?error.message:'Dashboard data unavailable',code:error instanceof AdsScopeError?error.code:'dashboard_unavailable'});
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
      adsRows:[],
      gmsRows:[]
    };
    buckets.push(bucket);
    bucketMap[dateStr] = bucket;
  }

  const findBucket = (adDateStr) => {
    if (bucketMap[adDateStr]) return bucketMap[adDateStr];
    // Buckets are trailing seven-day intervals ending at their label.
    return buckets.find(b=>b.key>=adDateStr)||buckets[buckets.length-1];
  };

  const rowKey = (row) => toDateKey(row.Date) || toDateKey(row);

  adsData.forEach(ad => {
    const b = findBucket(rowKey(ad));
    b.adsRows.push(ad);
  });

  gmsRows.forEach(g => {
    const b = findBucket(rowKey(g));
    b.gmsRows.push(g);
  });

  const adsBuckets=buckets.map(b=>adsSummary(b.adsRows));
  const values=k=>adsBuckets.map(b=>adsRound(b.totals[k]));
  const ratios=k=>adsBuckets.map(b=>adsRound(b.ratios[k]));
  const labels = buckets.map(b => {
    const date = parseLocalDate(b.key);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  });

  return {
    revenueData: [{ name: 'Revenue', data: values('TotalSales') }],
    stackedBarSeries: [
      { name: 'Total Sales', data: values('TotalSales') },
      { name: 'Ad Sales', data: values('AdSales') },
      { name: 'Organic Sales', data: values('OrganicSales') }
    ],
    areaSeries: [
      { name: 'Organic Sales', data: values('OrganicSales') },
      { name: 'Ad Sales', data: values('AdSales') }
    ],
    adsPerformanceSeries: [
      { name: 'Ad Revenue', data: values('AdSales') },
      { name: 'Ad Spend', data: values('AdSpend') }
    ],
    ordersSeries: values('Orders'),
    // ✅ Fix: units were estimated as orders * 1.48 — report actual orders
    // instead of fabricating a conversion multiplier.
    unitsSeries: values('Orders'),
    acosSeries: ratios('acos'),
    // GMS (merchandise) series, bucket-aligned with the ads series above.
    gmsSeries: buckets.map(b=>exactSum(b.gmsRows,'Revenue')),
    gmsUnitsSeries: buckets.map(b=>exactSum(b.gmsRows,'Units',0)),
    tacosSeries: ratios('tacos'),
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

exports.getDashboardOptions=async(req,res)=>{
 res.set('Cache-Control','private, no-store');
 try{return res.json({success:true,data:await dashboardScope.options({pool:await getPool(),sql,user:req.user})});}
 catch(e){return res.status(e instanceof AdsScopeError?e.status:500).json({success:false,code:e.code||'dashboard_options_unavailable',message:e instanceof AdsScopeError?e.message:'Dashboard options unavailable.'});}
};

exports.getDashboardTasks=async(req,res)=>{
 res.set('Cache-Control','private, no-store');
 try{
  const pool=await getPool();
  const scope=await dashboardScope.resolveDashboardScope({pool,sql,user:req.user,sellerId:req.query.sellerId,managerId:req.query.managerId});
  if(scope.empty)return res.json({success:true,instances:[],total:0,scope:dashboardScope.publicScope(scope)});
  const filters={limit:200,page:1,...(scope.unrestricted?{}:{sellerId:scope.sellerIds.join(',')})};
  const data=await require('../services/pems/pemsService').getInstances(filters,req.user);
  return res.json({success:true,...data,scope:dashboardScope.publicScope(scope)});
 }catch(e){return res.status(e instanceof AdsScopeError?e.status:500).json({success:false,message:e instanceof AdsScopeError?e.message:'Dashboard tasks unavailable.'});}
};
