'use strict';
const {metricProjection}=require('./dashboardFinancialMetrics');
const {projection:adsProjection}=require('./adsConsumerMetrics');
const {AdsScopeError}=require('./adsCanonicalScope');

// The owner map is built once per bounded reporting request. Never filter the
// catalog before resolving ambiguity: another seller's mapping must still count.
function buildFinancialBatch(scope,mode='full'){
 if(!['full','overview','products'].includes(mode))throw new AdsScopeError('invalid_dashboard_mode','Invalid dashboard section.',400);
 const placeholders=scope.sellerIds.map((_,i)=>'@dashSeller_'+i).join(',');
 const pre=scope.empty?' AND 1=0':scope.unrestricted?'':" AND (g.SellerId IS NULL OR g.SellerId IN ("+placeholders+"))";
 const owner=scope.empty?' AND 1=0':scope.unrestricted?'':scope.isGlobal?" AND COALESCE(k.StoredSellerId,u.SellerId) IN ("+placeholders+")":" AND u.SellerId IN ("+placeholders+") AND p.CatalogId IS NOT NULL AND (k.StoredSellerId IS NULL OR k.StoredSellerId=u.SellerId)";
 const adScope=scope.empty?' AND 1=0':scope.unrestricted?'':" AND AP.SellerId IN ("+placeholders+")";
 const p=(column,alias,condition,scale=2)=>metricProjection('g.'+column,alias,{condition,scale});
 const current='g.Date >= @startDate',prior='g.Date < @startDate';
 const counts="COUNT(DISTINCT CASE WHEN "+current+" THEN g.Date END) AS CurrentDays, COUNT(DISTINCT CASE WHEN "+prior+" THEN g.Date END) AS PreviousDays";
 const base=`
 SET NOCOUNT ON;
 SELECT g.Asin,g.SellerId AS StoredSellerId,CONVERT(date,g.Date) AS [Date],
        g.OrderedRevenue,g.OrderedUnits,g.ShippedRevenue,g.CustomerReturns
 INTO #DashSource FROM dbo.GmsDailyPerformance g
 WHERE g.Date>=@prevStart AND g.Date<DATEADD(day,1,@endDate) ${pre};
 SELECT DISTINCT Asin,StoredSellerId,UPPER(LTRIM(RTRIM(Asin))) AS NormalizedAsin INTO #DashKeys FROM #DashSource;
 SELECT DISTINCT NormalizedAsin INTO #DashNormalized FROM #DashKeys WHERE NormalizedAsin IS NOT NULL;
 CREATE UNIQUE CLUSTERED INDEX IX_DashNormalized ON #DashNormalized(NormalizedAsin);
 SELECT c.Id,c.SellerId,n.NormalizedAsin INTO #DashCatalog
 FROM dbo.Asins c JOIN #DashNormalized n ON UPPER(LTRIM(RTRIM(c.AsinCode)))=n.NormalizedAsin OPTION(HASH JOIN);
 SELECT NormalizedAsin,MIN(SellerId) AS SellerId INTO #DashUnique FROM #DashCatalog
 GROUP BY NormalizedAsin HAVING COUNT_BIG(DISTINCT SellerId)=1 AND COUNT_BIG(*)=COUNT_BIG(NULLIF(LTRIM(RTRIM(SellerId)),''));
 CREATE UNIQUE CLUSTERED INDEX IX_DashUnique ON #DashUnique(NormalizedAsin);
 SELECT NormalizedAsin,SellerId,MIN(Id) AS CatalogId INTO #DashPick FROM #DashCatalog
 WHERE NULLIF(LTRIM(RTRIM(SellerId)),'') IS NOT NULL GROUP BY NormalizedAsin,SellerId;
 CREATE UNIQUE CLUSTERED INDEX IX_DashPick ON #DashPick(NormalizedAsin,SellerId);
 SELECT k.Asin,k.StoredSellerId,COALESCE(k.StoredSellerId,u.SellerId) AS SellerId,p.CatalogId
 INTO #DashMap FROM #DashKeys k LEFT JOIN #DashUnique u ON u.NormalizedAsin=k.NormalizedAsin
 LEFT JOIN #DashPick p ON p.NormalizedAsin=k.NormalizedAsin AND p.SellerId=COALESCE(k.StoredSellerId,u.SellerId)
 WHERE 1=1 ${owner};
 CREATE UNIQUE CLUSTERED INDEX IX_DashMap ON #DashMap(Asin,StoredSellerId);
 SELECT g.Asin,m.SellerId,m.CatalogId,g.Date,g.OrderedRevenue,g.OrderedUnits,g.ShippedRevenue,g.CustomerReturns
 INTO #DashGms FROM #DashSource g JOIN #DashMap m ON m.Asin=g.Asin AND (m.StoredSellerId=g.StoredSellerId OR (m.StoredSellerId IS NULL AND g.StoredSellerId IS NULL));
 DROP TABLE #DashSource,#DashKeys,#DashNormalized,#DashCatalog,#DashUnique,#DashPick,#DashMap;
 CREATE CLUSTERED INDEX IX_DashGms ON #DashGms(Asin,SellerId,Date);
 `;
 // The products response includes daily GMS totals for the exact same
 // snapshot/denominator, not a client-supplied total.
 const daily=`
 SELECT g.Date,${p('OrderedRevenue','Revenue')},${p('OrderedUnits','Units',undefined,0)},${p('ShippedRevenue','ShippedRevenue')},${p('CustomerReturns','Returns',undefined,0)}
 FROM #DashGms g GROUP BY g.Date ORDER BY g.Date;
 `;
 const overview=mode==='products'?'':`
 SELECT AP.Date,${adsProjection('AP')} FROM dbo.AdsProductDailyFacts AP
 WHERE AP.Date>=@prevStart AND AP.Date<DATEADD(day,1,@endDate) AND AP.ReportType='daily' AND AP.Currency='INR' ${adScope} GROUP BY AP.Date;
 SELECT g.SellerId,S.Name AS SellerName,S.Marketplace,
 ${p('OrderedRevenue','Revenue',current)},${p('OrderedUnits','Units',current,0)},${p('OrderedRevenue','PrevRevenue',prior)},
 COUNT(DISTINCT CASE WHEN ${current} AND g.OrderedRevenue>0 THEN g.Asin END) AS AsinsWithSales,${counts}
 FROM #DashGms g LEFT JOIN dbo.Sellers S ON S.Id=g.SellerId GROUP BY g.SellerId,S.Name,S.Marketplace
 ORDER BY TRY_CONVERT(decimal(38,2),CASE WHEN COUNT_BIG(CASE WHEN ${current} THEN 1 END)=COUNT_BIG(CASE WHEN ${current} AND g.OrderedRevenue IS NOT NULL THEN 1 END) THEN SUM(CASE WHEN ${current} THEN CONVERT(decimal(38,2),g.OrderedRevenue) END) END) DESC;
 SELECT COUNT(DISTINCT g.Asin) AS AsinsWithSales FROM #DashGms g WHERE ${current} AND g.OrderedRevenue>0;
 `;
 const products=mode==='overview'?'':`
 WITH GmsAgg AS (
 SELECT g.Asin,g.SellerId,g.CatalogId,${p('OrderedRevenue','GmsRevenue',current)},${p('OrderedUnits','GmsUnits',current,0)},
 ${p('ShippedRevenue','ShippedRevenue',current)},${p('CustomerReturns','Returns',current,0)},
 ${p('OrderedRevenue','PrevGmsRevenue',prior)},${p('OrderedUnits','PrevGmsUnits',prior,0)},
 COUNT(DISTINCT CASE WHEN ${current} AND g.OrderedRevenue>0 THEN g.Date END) AS ActiveDays,${counts}
 FROM #DashGms g WHERE g.CatalogId IS NOT NULL GROUP BY g.Asin,g.SellerId,g.CatalogId
 )
 SELECT TOP (200) G.*,ROW_NUMBER() OVER(ORDER BY TRY_CONVERT(decimal(38,2),G.GmsRevenue) DESC,TRY_CONVERT(bigint,G.GmsUnits) DESC,G.CatalogId,G.Asin) AS RankNumber
 INTO #DashLeaders FROM GmsAgg G JOIN dbo.Sellers S ON G.SellerId=S.Id
 WHERE TRY_CONVERT(decimal(38,2),G.GmsRevenue)>0 OR TRY_CONVERT(bigint,G.GmsUnits)>0
 ORDER BY TRY_CONVERT(decimal(38,2),G.GmsRevenue) DESC,TRY_CONVERT(bigint,G.GmsUnits) DESC,G.CatalogId,G.Asin;
 -- Ads context reads only selected leaders, not every advertised ASIN.
 WITH AdsAgg AS (
 SELECT AP.Asin,AP.SellerId,${adsProjection('AP')} FROM dbo.AdsProductDailyFacts AP
 JOIN #DashLeaders L ON L.Asin=AP.Asin AND L.SellerId=AP.SellerId
 WHERE AP.Date>=@startDate AND AP.Date<DATEADD(day,1,@endDate) AND AP.ReportType='daily' AND AP.Currency='INR' ${adScope}
 GROUP BY AP.Asin,AP.SellerId
 )
 SELECT A.Id,L.Asin AS AsinCode,A.Sku,A.Title,A.Category,A.Brand,A.ParentAsin,A.CurrentPrice,A.ImageUrl,A.Status,A.AvailabilityStatus,L.SellerId,
 S.Name AS SellerName,S.Marketplace,L.GmsRevenue,L.GmsUnits,L.ShippedRevenue,L.Returns,L.PrevGmsRevenue,L.PrevGmsUnits,L.ActiveDays,L.CurrentDays,L.PreviousDays,
 AD.FactRows,AD.AdSales,AD.AdSalesCount,AD.AdSpend,AD.AdSpendCount,AD.TotalSales,AD.TotalSalesCount,AD.OrganicSales,AD.OrganicSalesCount,AD.Orders,AD.OrdersCount,AD.Impressions,AD.ImpressionsCount,AD.Clicks,AD.ClicksCount,AD.acosPairCount,AD.tacosPairCount,AD.adSharePairCount,AD.roasPairCount,AD.ctrPairCount,AD.cpcPairCount
 FROM #DashLeaders L JOIN dbo.Asins A ON A.Id=L.CatalogId JOIN dbo.Sellers S ON S.Id=L.SellerId
 LEFT JOIN AdsAgg AD ON AD.Asin=L.Asin AND AD.SellerId=L.SellerId ORDER BY L.RankNumber;
 SELECT g.Asin,g.SellerId,g.Date,${p('OrderedRevenue','Revenue')},${p('OrderedUnits','Units',undefined,0)}
 FROM #DashGms g JOIN #DashLeaders L ON L.Asin=g.Asin AND L.SellerId=g.SellerId AND L.CatalogId=g.CatalogId
 WHERE g.Date>=@startDate AND L.RankNumber<=25 GROUP BY g.Asin,g.SellerId,g.Date;
 DROP TABLE #DashLeaders;
 `;
 return base+daily+overview+products+'DROP TABLE #DashGms;';
}
async function readFinancialBatch({request,scope,mode,signal}){
 if(signal?.aborted)throw new AdsScopeError('dashboard_cancelled','Dashboard request cancelled.',499);
 const cancel=()=>{try{request.cancel();}catch(_){}};
 signal?.addEventListener('abort',cancel,{once:true});
 try{
  const result=await request.query(buildFinancialBatch(scope,mode));
  const r=result.recordsets;
  const count=mode==='full'?6:mode==='overview'?4:3;
  if(!Array.isArray(r)||r.length!==count)throw Error('Unexpected dashboard result sets');
  return {gmsDaily:r[0],adsDaily:mode==='products'?[]:r[1],sellerRows:mode==='products'?[]:r[2],sellingRows:mode==='products'?[]:r[3],topRows:mode==='overview'?[]:r[mode==='full'?4:1],sparkRows:mode==='overview'?[]:r[mode==='full'?5:2]};
 }finally{signal?.removeEventListener('abort',cancel);}
}
module.exports={buildFinancialBatch,readFinancialBatch};
