'use strict';
// Reconcile the actual canonical aggregation paths inside one authorized
// immutable temp scope. No source mutation, cross-currency addition, inferred
// zero, or claim about records which are absent from the stored report.
const {METRICS,RATIOS,aggregateProjection,shapeSummary,toFixedUnits:fixed,fromFixedUnits:decimal,ratio}=require('./adsCanonicalMetrics');
const {readProducts,readAlignedTrendRows,pairTrends,trendBuckets,readBreakdowns}=require('./adsPortfolioAnalytics');
const MAX_DETAILS=30;
const METRIC_KEYS=Object.keys(METRICS),RATIO_KEYS=Object.keys(RATIOS);
const COUNTS=['rowCount',...METRIC_KEYS.map(k=>k+'Count'),...RATIO_KEYS.map(k=>k+'PairCount')];
const AMOUNTS=[...METRIC_KEYS,...RATIO_KEYS.flatMap(k=>[k+'PairNumerator',k+'PairDenominator'])];
const FIELDS=[...COUNTS,...AMOUNTS];
const keyOf=r=>JSON.stringify([r.currency??r.Currency,r.periodKey]);
const normalize=(k,v)=>v==null?null:COUNTS.includes(k)||k==='coveredDays'?BigInt(v).toString():decimal(fixed(String(v)));
const byKey=rows=>new Map(rows.map(r=>[keyOf(r),r]));
function check(code,label){
 let comparisons=0,mismatchCount=0;
 const mismatches=[];
 return {
  compare(currency,periodKey,field,expected,actual){
   comparisons++;
   if(expected===actual)return;
   mismatchCount++;
   if(mismatches.length<MAX_DETAILS)mismatches.push({currency,periodKey,field,expected,actual});
  },
  result(){return {code,label,status:comparisons===0?'not_applicable':mismatchCount?'failed':'passed',comparisons,mismatchCount,mismatches};}
 };
}
function compareAggregates({baseline,candidate,check:out,fields=FIELDS}){
 const a=byKey(baseline),b=byKey(candidate);
 for(const key of new Set([...a.keys(),...b.keys()])){
  const [currency,periodKey]=JSON.parse(key),left=a.get(key),right=b.get(key);
  out.compare(currency,periodKey,'period_present',String(!!left),String(!!right));
  if(!left||!right)continue;
  for(const k of fields)out.compare(currency,periodKey,k,normalize(k,left[k]),normalize(k,right[k]));
 }
}
function rollupRows(rows,{days=false}={}){
 const out=new Map();
 for(const r of rows){
  const key=keyOf(r);
  if(!out.has(key))out.set(key,{currency:r.currency??r.Currency,periodKey:r.periodKey,values:Object.fromEntries(FIELDS.map(k=>[k,COUNTS.includes(k)?0n:null])),coveredDays:0n});
  const g=out.get(key);
  for(const k of COUNTS)g.values[k]+=BigInt(r[k]);
  for(const k of AMOUNTS){
   if(r[k]==null)continue;
   g.values[k]=(g.values[k]??0n)+fixed(String(r[k]));
  }
  if(days)g.coveredDays+=BigInt(r.coveredDays);
 }
 return [...out.values()].map(g=>({currency:g.currency,periodKey:g.periodKey,
  ...Object.fromEntries(FIELDS.map(k=>[k,g.values[k]===null?null:COUNTS.includes(k)?g.values[k].toString():decimal(g.values[k])])),
  ...(days?{coveredDays:g.coveredDays.toString()}:{})}));
}
const sqlRollup=(table,alias='g')=>{
 const col=k=>alias+'.['+k+']';
 return "SELECT "+alias+".[Currency] AS [currency],"+alias+".[periodKey],"+
 COUNTS.map(k=>"CONVERT(varchar(30),SUM(CONVERT(bigint,"+col(k)+"))) AS ["+k+"]").concat(
 AMOUNTS.map(k=>"CONVERT(varchar(80),SUM(CONVERT(decimal(38,10),"+col(k)+"))) AS ["+k+"]")).join(',');
};
function emptyReconciliation(){return {version:'v1',scope:'same_authorized_snapshot',status:'no_data',empty:true,checks:[],quality:[],baseline:[],limitations:['Stored analytics reconciliation does not prove completeness against the original CSV or the advertising platform.']};}
function comparePortfolio({baseline,groups,population,reference,out}){
 const base=byKey(baseline),expected=new Map(population.map(r=>[r.currency,r])),ref=new Map(reference.map(r=>[r.currency,r]));
 const got=new Map(groups.map(g=>[g.currency,g]));
 for(const currency of new Set([...expected.keys(),...got.keys()])){
  const p=expected.get(currency),g=got.get(currency);
  out.compare(currency,'current','currency_present',String(!!p),String(!!g));
  if(!g||!p)continue;
  out.compare(currency,'current','total_entities',String(p.totalEntities),String(g.totalEntities));
  out.compare(currency,'current','current_entities',String(p.currentEntities),String(g.currentEntities));
  out.compare(currency,'current','segment_entity_partition',String(g.totalEntities),String(g.segments.reduce((n,s)=>n+s.count,0)));
  const cur=base.get(JSON.stringify([currency,'current']));
  for(const m of g.concentration){
   out.compare(currency,'current','concentration.'+m.metric+'.net',normalize(m.metric,cur?.[m.metric]),normalize(m.metric,m.netObserved));
   out.compare(currency,'current','concentration.'+m.metric+'.entity_partition',String(g.totalEntities),String(m.positiveEntities+m.zeroEntities+m.negativeEntities+m.unknownEntities+m.priorOnlyEntities));
   out.compare(currency,'current','concentration.'+m.metric+'.positive_partition',String(m.positiveEntities),String(m.leadingCount+m.remainingCount));
   if(m.positiveEntities){
    out.compare(currency,'current','concentration.'+m.metric+'.amount_partition',normalize(m.metric,m.positiveTotal),decimal(fixed(m.leadingAmount)+fixed(m.remainingAmount)));
    out.compare(currency,'current','concentration.'+m.metric+'.80_percent_threshold','true',String(fixed(m.leadingAmount)*5n>=fixed(m.positiveTotal)*4n));
   }
  }
  for(const metric of ['spend','sales','totalSales','clicks','conversions']){
   const present=g.segments.map(s=>s.observed?.[metric]?.value).filter(v=>v!=null);
   const sum=present.length?decimal(present.reduce((n,v)=>n+fixed(v),0n)):null;
   out.compare(currency,'current','segment.'+metric+'.net',normalize(metric,cur?.[metric]),sum);
  }
  const e=ref.get(currency);
  out.compare(currency,'current','reference.eligible_entities',String(e?.entities??0),String(g.reference.eligibleEntities));
  out.compare(currency,'current','reference.spend',normalize('spend',e?.spend),normalize('spend',g.reference.spend));
  out.compare(currency,'current','reference.sales',normalize('sales',e?.sales),normalize('sales',g.reference.sales));
  out.compare(currency,'current','reference.roas',ratio(e?.sales,e?.spend,1),g.reference.roas);
 }
}
function compareTrendOutput({baseline,raw,groups,period,granularity,out}){
 const keys=['spend','sales','totalSales','organicSales','orders','conversions','clicks','impressions'];
 const paired=pairTrends(raw,groups,period,granularity);
 const expected=trendBuckets(period,granularity).length;
 for(const g of groups){
  const rows=paired.filter(r=>r.currency===g.currency);
  out.compare(g.currency,'both','expected_buckets',String(expected),String(rows.length));
  out.compare(g.currency,'both','equal_calendar_slice_days',String(period.days),String(rows.reduce((n,r)=>n+r.days,0)));
 }
 // Independently inspect the actual shaped trend payload, not a sum of
 // rounded ratios. All emitted buckets must conserve additive totals/counts.
 const flat=[];
 for(const r of paired)for(const periodKey of ['current','previous']){
  const side=r[periodKey];if(!side)continue;
  flat.push({currency:r.currency,periodKey,coveredDays:side.coveredDays,rowCount:side.rowCount,...side.totals,
   ...Object.fromEntries(keys.map(k=>[k+'Count',side.coverage[k].populated]))});
 }
 const selected=['rowCount','coveredDays',...keys,...keys.map(k=>k+'Count')];
 const map=new Map();
 for(const r of flat){
  const k=keyOf(r);if(!map.has(k))map.set(k,{currency:r.currency,periodKey:r.periodKey,rowCount:0n,coveredDays:0n,...Object.fromEntries(keys.flatMap(k=>[[k,null],[k+'Count',0n]]))});
  const item=map.get(k);item.rowCount+=BigInt(r.rowCount);item.coveredDays+=BigInt(r.coveredDays);
  for(const field of keys){item[field+'Count']+=BigInt(r[field+'Count']);if(r[field]!=null)item[field]=(item[field]??0n)+fixed(r[field]);}
 }
 const roll=[...map.values()].map(r=>({currency:r.currency,periodKey:r.periodKey,...Object.fromEntries(selected.map(k=>[k,r[k]==null?null:keys.includes(k)?decimal(r[k]):String(r[k])]))}));
 compareAggregates({baseline,candidate:roll,check:out,fields:selected});
}
async function readReconciliation({tx,sql,period}){
 const baseline=(await tx.request().query(
  "SELECT p.[Currency] AS [currency],p.[periodKey],COUNT(DISTINCT p.[Date]) AS [coveredDays],"+aggregateProjection+" FROM #AdsScope p GROUP BY p.[Currency],p.[periodKey] ORDER BY p.[Currency],p.[periodKey];")).recordset;
 if(!baseline.length)return emptyReconciliation();
 const checks=[];
 const entity=check('entity_rollup','ASIN aggregation: all metrics and paired ratio inputs');
 const grouped=(await tx.request().query(sqlRollup('#AdsGroups')+" FROM #AdsGroups g GROUP BY g.[Currency],g.[periodKey];")).recordset;
 compareAggregates({baseline,candidate:grouped,check:entity});
 checks.push(entity.result());
 const grains=check('fact_identity','Unique persisted fact identity');
 const duplicates=(await tx.request().query(
  "SELECT d.[Currency] AS [currency],d.[periodKey],CONVERT(varchar(30),COUNT_BIG(*)) AS [duplicates] FROM (SELECT [SellerId],[Marketplace],[Currency],[Asin],[Date],[periodKey] FROM #AdsScope GROUP BY [SellerId],[Marketplace],[Currency],[Asin],[Date],[periodKey] HAVING COUNT_BIG(*)>1) d GROUP BY d.[Currency],d.[periodKey];")).recordset;
 const duplicateMap=byKey(duplicates);
 for(const r of baseline)grains.compare(r.currency,r.periodKey,'duplicate_fact_keys','0',duplicateMap.get(keyOf(r))?.duplicates||'0');
 checks.push(grains.result());
 const groups=await readProducts({tx,sql,days:period.days});
 const population=(await tx.request().query("SELECT e.[Currency] AS [currency],CONVERT(varchar(30),COUNT_BIG(*)) AS [totalEntities],CONVERT(varchar(30),COUNT_BIG(c.[periodKey])) AS [currentEntities] FROM #AdsEntities e LEFT JOIN #AdsGroups c ON c.[SellerId]=e.[SellerId] AND c.[Marketplace]=e.[Marketplace] AND c.[Currency]=e.[Currency] AND c.[EntityKey]=e.[EntityKey] AND c.[periodKey]='current' GROUP BY e.[Currency];")).recordset;
 const reference=(await tx.request().query(
  "SELECT c.[Currency] AS [currency],CONVERT(varchar(30),COUNT_BIG(*)) AS [entities],CONVERT(varchar(80),SUM(CONVERT(decimal(38,10),c.[spend]))) AS [spend],CONVERT(varchar(80),SUM(CONVERT(decimal(38,10),c.[sales]))) AS [sales] FROM #AdsGroups c WHERE c.[periodKey]='current' AND CONVERT(decimal(38,10),c.[spend])>0 AND CONVERT(decimal(38,10),c.[sales])>=0 AND (c.[totalSales] IS NULL OR CONVERT(decimal(38,10),c.[totalSales])>=0) AND c.[spendCount]=c.[salesCount] AND c.[spendCount]=c.[roasPairCount] AND CONVERT(bigint,c.[roasPairCount])>0 GROUP BY c.[Currency];")).recordset;
 const portfolio=check('portfolio_partition','Portfolio concentration, segment totals and weighted ROAS reference');
 comparePortfolio({baseline,groups,population,reference,out:portfolio});
 checks.push(portfolio.result());
 for(const granularity of ['day','week','month']){
  const trend=check('trend_'+granularity,({day:'Daily',week:'Weekly',month:'Monthly'})[granularity]+' aligned trends: exact roll-up and emitted buckets');
  const raw=await readAlignedTrendRows({tx,sql,period,granularity});
  compareAggregates({baseline,candidate:rollupRows(raw,{days:true}),check:trend,fields:[...FIELDS,'coveredDays']});
  if(!period.allHistory)compareTrendOutput({baseline,raw,groups,period,granularity,out:trend});
  checks.push(trend.result());
 }
 // Check the actual complete seller/brand aggregation before its top-20
 // response is sampled. A sample is not a financial total.
 await readBreakdowns({tx,sql,days:period.days,onMaterialized:async(db)=>{
  for(const dimension of ['seller','brand']){
   const out=check(dimension+'_rollup',(dimension==='seller'?'Seller':'Brand')+' aggregation before sampling');
   const rows=(await db.request().input('dimension',sql.VarChar(8),dimension).query(sqlRollup('#AdsBreakdowns')+" FROM #AdsBreakdowns g WHERE g.[dimension]=@dimension GROUP BY g.[Currency],g.[periodKey];")).recordset;
   compareAggregates({baseline,candidate:rows,check:out});checks.push(out.result());
  }
 }});
 const count=condition=>"CONVERT(varchar(30),COUNT_BIG(CASE WHEN "+condition+" THEN 1 END))";
 const qualityFields={
  totalSalesAliasMismatch:"p.TotalSales IS NOT NULL AND p.OrderedRevenue IS NOT NULL AND p.TotalSales<>p.OrderedRevenue",
  totalOrdersAliasMismatch:"p.TotalOrders IS NOT NULL AND p.OrderedOrders IS NOT NULL AND p.TotalOrders<>p.OrderedOrders",
  totalUnitsAliasMismatch:"p.TotalUnits IS NOT NULL AND p.UnitsOrdered IS NOT NULL AND p.TotalUnits<>p.UnitsOrdered",
  attributedRevenueOverlap:"p.AdSales IS NOT NULL AND p.TotalSales IS NOT NULL AND p.AdSales>p.TotalSales",
  nonAdditiveRevenueRows:"p.AdSales IS NOT NULL AND p.OrganicSales IS NOT NULL AND p.TotalSales IS NOT NULL AND CONVERT(decimal(29,10),p.AdSales)+CONVERT(decimal(29,10),p.OrganicSales)<>p.TotalSales",
  nonAdditiveOrderRows:"p.Orders IS NOT NULL AND p.OrganicOrders IS NOT NULL AND p.TotalOrders IS NOT NULL AND CONVERT(decimal(29,0),p.Orders)+CONVERT(decimal(29,0),p.OrganicOrders)<>p.TotalOrders",
  missingSpend:"p.AdSpend IS NULL",zeroSpend:"p.AdSpend=0",
  positiveSpendMissingSales:"p.AdSpend>0 AND p.AdSales IS NULL",
  signedAdjustments:"p.AdSpend<0 OR p.AdSales<0 OR p.TotalSales<0 OR p.TotalOrders<0 OR p.TotalUnits<0 OR p.Orders<0 OR p.Conversions<0",
  unknownKeyMetrics:"p.AdSpend IS NULL AND p.AdSales IS NULL AND p.Clicks IS NULL AND p.Impressions IS NULL AND p.TotalSales IS NULL AND p.TotalOrders IS NULL",
  catalogUnmapped:"p.CatalogMatches<>1"
 };
 const quality=(await tx.request().query("SELECT p.[Currency] AS [currency],p.[periodKey],CONVERT(varchar(30),COUNT_BIG(*)) AS [rowCount],"+Object.entries(qualityFields).map(([k,v])=>count(v)+' AS ['+k+']').join(',')+" FROM #AdsScope p GROUP BY p.[Currency],p.[periodKey] ORDER BY p.[Currency],p.[periodKey];")).recordset;
 const aliases=check('source_aliases','Explicit business alias equality on jointly populated rows');
 for(const r of quality)for(const k of ['totalSalesAliasMismatch','totalOrdersAliasMismatch','totalUnitsAliasMismatch'])aliases.compare(r.currency,r.periodKey,k,'0',r[k]);
 checks.push(aliases.result());
 return {...emptyReconciliation(),status:checks.some(c=>c.status==='failed')?'failed':'passed',empty:false,checks,quality,
  baseline:baseline.map(r=>({periodKey:r.periodKey,coveredDays:Number(r.coveredDays),...shapeSummary(r)}))};
}
module.exports={readReconciliation,emptyReconciliation,compareAggregates,rollupRows,comparePortfolio,compareTrendOutput,check,FIELDS,COUNTS,AMOUNTS};
