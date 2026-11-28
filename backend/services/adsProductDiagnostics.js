'use strict';
const {METRICS,aggregateProjection,shapeSummary,ratio,difference,toFixedUnits:fixed}=require('./adsCanonicalMetrics');
const SHARE_KEYS=['spend','sales','totalSales','clicks','conversions'];
const BENCHMARK_KEYS=['acos','tacos','roas','ctr','cvr','cpc','costPerOrder'];
const UNITS={acos:'pp',tacos:'pp',ctr:'pp',cvr:'pp',roas:'x',cpc:'currency',costPerOrder:'currency'};
const complete=(s,key,kind,days)=>s?.coveredDays===days&&(kind==='ratio'?s?.ratios?.[key]?.status:s?.coverage?.[key]?.status)==='complete';
function share(product,seller,key,days){
 const a=product?.totals?.[key],b=seller?.totals?.[key];
 let status=!product?'missing_product':!seller?'missing_seller':a==null||b==null?'unknown_value':fixed(b)<=0n?'nonpositive_denominator':
  complete(product,key,'metric',days)&&complete(seller,key,'metric',days)?'complete_observed':'observed_partial';
 const value=a==null||b==null?null:ratio(a,b,100);
 return {product:a??null,seller:b??null,value,status};
}
function benchmark(product,seller,key,days){
 const a=product?.ratios?.[key],b=seller?.ratios?.[key];
 const delta=difference(a?.value,b?.value);
 const status=!product?'missing_product':!seller?'missing_seller':a?.status==='incompatible_coverage'||b?.status==='incompatible_coverage'?'incompatible_coverage':
  delta===null?'unknown_value':complete(product,key,'ratio',days)&&complete(seller,key,'ratio',days)?'complete_observed':'observed_partial';
 return {product:a?.value??null,seller:b?.value??null,observedDelta:delta,delta:status==='complete_observed'?delta:null,status,unit:UNITS[key]};
}
function shapePeriod(product,seller,activity,days){
 return {product,seller,days,shares:Object.fromEntries(SHARE_KEYS.map(k=>[k,share(product,seller,k,days)])),
  benchmarks:Object.fromEntries(BENCHMARK_KEYS.map(k=>[k,benchmark(product,seller,k,days)])),
  observations:activity?{
   daysWithFacts:Number(activity.coveredDays),positiveSpendDays:Number(activity.positiveSpendDays),zeroNetSalesSpendDays:Number(activity.zeroNetSalesSpendDays),
   missingSalesSpendDays:Number(activity.missingSalesSpendDays),clicksZeroConversionDays:Number(activity.clicksZeroConversionDays),signedAdjustmentDays:Number(activity.signedAdjustmentDays)
  }:null};
}
async function readProductDiagnostics({tx,sql,filters,totals}){
 if(!filters.entityKey||filters.groupBy!=='asin')throw Error('ASIN drill identity required');
 // #AdsScope is the exact selected product. The denominator intentionally
 // ignores brand/category/search filters and is the full same-owner, same
 // marketplace and currency portfolio for the same windows.
 const activity=await tx.request().query(
  "SELECT p.[periodKey],COUNT(DISTINCT p.[Date]) AS coveredDays,"+
  "COUNT(DISTINCT CASE WHEN p.AdSpend>0 THEN p.[Date] END) AS positiveSpendDays,"+
  "COUNT(DISTINCT CASE WHEN p.AdSpend>0 AND p.AdSales=0 THEN p.[Date] END) AS zeroNetSalesSpendDays,"+
  "COUNT(DISTINCT CASE WHEN p.AdSpend>0 AND p.AdSales IS NULL THEN p.[Date] END) AS missingSalesSpendDays,"+
  "COUNT(DISTINCT CASE WHEN p.Clicks>0 AND p.Conversions=0 THEN p.[Date] END) AS clicksZeroConversionDays,"+
  "COUNT(DISTINCT CASE WHEN p.AdSpend<0 OR p.AdSales<0 OR p.TotalSales<0 OR p.Conversions<0 OR p.Orders<0 THEN p.[Date] END) AS signedAdjustmentDays FROM #AdsScope p GROUP BY p.[periodKey];");
 // Explicit seller validated by parseReport; the selected scope contains just
 // that seller. Never join an ASIN-only catalog or reattribute a stored fact.
 const sellerId=filters.scope.sellerIds[0];
 const r=await tx.request().input('seller',sql.VarChar(50),sellerId).input('marketplace',sql.NVarChar(50),filters.marketplace).input('currency',sql.Char(3),filters.currency)
  .input('start',sql.VarChar(10),filters.period.startDate).input('prevStart',sql.VarChar(10),filters.period.prevStart).input('end',sql.VarChar(10),filters.period.endDate)
  .query("SELECT p.Currency AS currency,k.periodKey,COUNT(DISTINCT p.[Date]) AS coveredDays,"+aggregateProjection+
    " FROM dbo.AdsProductDailyFacts p CROSS APPLY(SELECT CASE WHEN p.[Date]>=CONVERT(date,@start,23) THEN 'current' ELSE 'previous' END AS periodKey) k WHERE p.SellerId=@seller AND p.Marketplace=@marketplace AND p.Currency=@currency AND p.ReportType='daily' AND p.[Date]>=CONVERT(date,@prevStart,23) AND p.[Date]<=CONVERT(date,@end,23) GROUP BY p.Currency,k.periodKey;");
 const shape=row=>row?{...shapeSummary(row),coveredDays:Number(row.coveredDays)}:null;
 const byPeriod=key=>shapePeriod(shape(totals.find(x=>x.periodKey===key)),shape(r.recordset.find(x=>x.periodKey===key)),activity.recordset.find(x=>x.periodKey===key),filters.period.days);
 return {version:'v1',sellerId,asin:filters.entityKey,marketplace:filters.marketplace,currency:filters.currency,referenceScope:'full_seller_same_marketplace_currency',current:byPeriod('current'),previous:byPeriod('previous')};
}
module.exports={share,benchmark,shapePeriod,readProductDiagnostics};
