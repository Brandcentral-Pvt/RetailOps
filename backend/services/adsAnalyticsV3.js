'use strict';
// All comparisons are over observed canonical facts, not inferred missing days,
// not reconstructed business revenue, and not an average of daily ratios.
const {METRICS,RATIOS,difference,ratio}=require('./adsCanonicalMetrics');
const SAMPLE_LIMIT=10;
const MIN_REVIEW_CLICKS=20;
const RATIO_UNITS={acos:'pp',tacos:'pp',ctr:'pp',cvr:'pp',orderRate:'pp',adSharePct:'pp',roas:'x',cpc:'currency',cpm:'currency',costPerOrder:'currency',aov:'currency',revenuePerOrder:'currency'};
function compareValue(current,previous,{kind,key,days}){
 const a=kind==='metric'?current?.totals?.[key]:current?.ratios?.[key]?.value;
 const b=kind==='metric'?previous?.totals?.[key]:previous?.ratios?.[key]?.value;
 const ac=kind==='metric'?current?.coverage?.[key]:current?.ratios?.[key];
 const bc=kind==='metric'?previous?.coverage?.[key]:previous?.ratios?.[key];
 const unit=kind==='metric'?'absolute':RATIO_UNITS[key];
 let status='comparable';
 if(!current)status='missing_current';
 else if(!previous)status='missing_previous';
 else if(current.currency!==previous.currency)status='currency_mismatch';
 else if(a==null||b==null)status=ac?.status==='incompatible_coverage'||bc?.status==='incompatible_coverage'?'incompatible_coverage':'unknown_value';
 else if(current.coveredDays!==days||previous.coveredDays!==days)status='incomplete_calendar';
 else if(ac?.status!=='complete'||bc?.status!=='complete')status='partial_coverage';
 const observedDelta=status==='currency_mismatch'||a==null||b==null?null:difference(a,b);
 // Percent growth is meaningful only against a positive baseline. Ratios use
 // their natural unit (percentage points, multiplier or currency).
 const relative=kind==='metric'&&observedDelta!==null?ratio(observedDelta,b,100):null;
 return {status,unit,delta:status==='comparable'?observedDelta:null,percentChange:status==='comparable'?relative:null,
   observedDelta,observedPercentChange:relative,percentageStatus:kind==='ratio'?'not_applicable':observedDelta===null?'unknown':relative===null?'nonpositive_baseline':status==='comparable'?'comparable':'observed_only'};
}
function comparePeriods(current,previous,days){
 if(!Number.isInteger(days)||days<1||days>36600||(days>366&&previous!=null))throw Error('Invalid comparison window');
 return {expectedDays:days,currentDays:current?.coveredDays??null,previousDays:previous?.coveredDays??null,
   metrics:Object.fromEntries(Object.keys(METRICS).map(key=>[key,compareValue(current,previous,{kind:'metric',key,days})])),
   ratios:Object.fromEntries(Object.keys(RATIOS).map(key=>[key,compareValue(current,previous,{kind:'ratio',key,days})]))};
}
function compareCurrencies(current,previous,days){
 const a=new Map(current.map(r=>[r.currency,r])),b=new Map(previous.map(r=>[r.currency,r]));
 return [...new Set([...a.keys(),...b.keys()])].sort().map(currency=>({currency,...comparePeriods(a.get(currency),b.get(currency),days)}));
}
// Signals are deterministic review prompts. No campaign/keyword claims,
// profitability claims, ROAS promises, or automatic bid/budget changes.
const RULES=Object.freeze([
 {code:'spend_zero_sales',label:'Spend with zero net ad sales',description:'Explicit positive spend and zero net attributed sales on the same observed rows.',action:'Inspect attribution timing, listing conversion and advertising delivery before changing spend.'},
 {code:'clicks_zero_conversions',label:'Clicks with zero net conversions',description:'At least '+MIN_REVIEW_CLICKS+' observed clicks and explicit zero net conversions on compatible rows.',action:'Review product relevance, listing quality and conversion evidence.'},
 {code:'spend_up_sales_down',label:'Spend up, ad sales down',description:'Compared with the equal-length prior period, spend increased and net ad sales decreased; both periods have complete stored day and field coverage.',action:'Investigate the performance change before changing campaign budgets.'},
 {code:'sales_up_spend_down',label:'Ad sales up, spend down',description:'Compared with the equal-length prior period, net ad sales increased while spend decreased; both periods have complete stored day and field coverage.',action:'Review the efficiency improvement alongside profitability, stock and campaign reports.'},
 {code:'missing_ad_sales',label:'Spend with missing ad sales',description:'Positive observed spend but no populated attributed-sales fields.',action:'Verify source completeness. Missing sales are not zero sales.'},
 {code:'tacos_coverage_mismatch',label:'TACoS coverage mismatch',description:'Spend and explicit total sales are populated on different observed rows.',action:'Review source coverage before interpreting portfolio TACoS.'},
 {code:'prior_only',label:'No current records',description:'The product has prior-period facts but no current-period facts.',action:'Check report dates and source availability. Do not interpret absence as stopped advertising.'}
]);
function emptyReview(){return {ruleVersion:'v1',minimumReviewClicks:MIN_REVIEW_CLICKS,sampleLimit:SAMPLE_LIMIT,populations:[],signals:[],empty:true};}
const keys=['SellerId','Marketplace','Currency','EntityKey'];
const eq=(a,b)=>keys.map(k=>a+'.['+k+']='+b+'.['+k+']').join(' AND ');
const num=(a,k)=>'CONVERT(decimal(38,10),'+a+'.['+k+'])';
const count=(a,k)=>'CONVERT(bigint,'+a+'.['+k+'])';
const full=(a,fields)=>'('+a+'.[coveredDays]=@days AND '+fields.map(k=>a+'.['+k+'Count]='+a+'.[rowCount]').join(' AND ')+')';
const aligned=(a,n,d,r)=>'('+count(a,r+'PairCount')+'>0 AND '+a+'.['+n+'Count]='+a+'.['+d+'Count] AND '+a+'.['+n+'Count]='+a+'.['+r+'PairCount])';
const fullBoth='('+full('c',['spend','sales'])+' AND '+full('p',['spend','sales'])+')';
const statusFor=(a,fields)=>"CASE WHEN "+full(a,fields)+" THEN 'complete_observed' ELSE 'observed_partial' END";
const join=' FROM #AdsEntities e LEFT JOIN #AdsGroups c ON '+eq('e','c')+" AND c.[periodKey]='current' LEFT JOIN #AdsGroups p ON "+eq('e','p')+" AND p.[periodKey]='previous'";
function reviewRulesSql(){
 const spend=num('c','spend'),sales=num('c','sales'),priorSpend=num('p','spend'),priorSales=num('p','sales');
 const rule=(code,condition,rank,confidence)=>"('"+code+"',CASE WHEN "+condition+" THEN 1 ELSE 0 END,"+rank+","+confidence+")";
 const dataGap="'data_gap'",complete="'complete_observed'";
 return [
  rule('spend_zero_sales',aligned('c','spend','sales','roas')+' AND '+spend+'>0 AND '+sales+'=0',spend,statusFor('c',['spend','sales'])),
  rule('clicks_zero_conversions',aligned('c','clicks','conversions','cvr')+' AND '+num('c','clicks')+'>=@minClicks AND '+num('c','conversions')+'=0',num('c','clicks'),statusFor('c',['clicks','conversions'])),
  rule('spend_up_sales_down',fullBoth+' AND '+priorSpend+'>0 AND '+priorSales+'>0 AND '+spend+'>'+priorSpend+' AND '+sales+'>=0 AND '+sales+'<'+priorSales,spend,complete),
  rule('sales_up_spend_down',fullBoth+' AND '+priorSpend+'>0 AND '+priorSales+'>=0 AND '+spend+'>=0 AND '+spend+'<'+priorSpend+' AND '+sales+'>'+priorSales,sales,complete),
  rule('missing_ad_sales',spend+'>0 AND '+count('c','salesCount')+'=0',spend,dataGap),
  rule('tacos_coverage_mismatch',count('c','spendCount')+'>0 AND '+count('c','totalSalesCount')+'>0 AND NOT '+aligned('c','spend','totalSales','tacos'),spend,dataGap),
  rule('prior_only',"c.[periodKey] IS NULL AND p.[periodKey] IS NOT NULL",priorSales,dataGap)
 ].join(',');
}
// Materialized groups are already owner-scoped and filtered. Count/rank every
// entity in SQL; only a bounded sample per currency and rule leaves SQL Server.
async function readReviewSignals({tx,sql,days,full=false}){
 const populations=await tx.request().input('days',sql.Int,days).query(
  "SELECT e.[Currency] AS [currency],CONVERT(varchar(30),COUNT_BIG(*)) AS [totalEntities],"+
  "CONVERT(varchar(30),COUNT_BIG(c.[periodKey])) AS [currentEntities],CONVERT(varchar(30),COUNT_BIG(p.[periodKey])) AS [previousEntities],"+
  "CONVERT(varchar(30),COUNT_BIG(CASE WHEN c.[coveredDays]=@days THEN 1 END)) AS [currentFullCalendar],"+
  "CONVERT(varchar(30),COUNT_BIG(CASE WHEN p.[coveredDays]=@days THEN 1 END)) AS [previousFullCalendar],"+
  "CONVERT(varchar(30),COUNT_BIG(CASE WHEN "+aligned('c','spend','sales','roas')+" THEN 1 END)) AS [alignedSpendSales]"+
  join+" GROUP BY e.[Currency] ORDER BY e.[Currency];");
 if(!populations.recordset.length)return emptyReview();
 await tx.request().batch('SELECT TOP(0) '+keys.map(k=>'e.['+k+']').join(',')+',CAST(NULL AS varchar(40)) AS [code],CAST(NULL AS decimal(38,10)) AS [rankValue],CAST(NULL AS varchar(24)) AS [evidenceStatus] INTO #AdsReviewSignals FROM #AdsEntities e;');
 await tx.request().input('days',sql.Int,days).input('minClicks',sql.Int,MIN_REVIEW_CLICKS).query(
  'INSERT #AdsReviewSignals ('+keys.map(k=>'['+k+']').join(',')+',[code],[rankValue],[evidenceStatus]) SELECT '+keys.map(k=>'e.['+k+']').join(',')+',sig.[code],sig.[rankValue],sig.[evidenceStatus]'+join+
  ' CROSS APPLY(VALUES '+reviewRulesSql()+') sig([code],[matched],[rankValue],[evidenceStatus]) WHERE sig.[matched]=1;');
 const counts=await tx.request().query("SELECT [Currency] AS [currency],[code],CONVERT(varchar(30),COUNT_BIG(*)) AS [total] FROM #AdsReviewSignals GROUP BY [Currency],[code] ORDER BY [Currency],[code];");
 if(full){
  const count=counts.recordset.reduce((n,r)=>n+Number(r.total),0);
  await tx.request().batch("SELECT ROW_NUMBER() OVER(ORDER BY [Currency],[code],CASE WHEN [rankValue] IS NULL THEN 1 ELSE 0 END,[rankValue] DESC,[SellerId],[Marketplace],[EntityKey]) AS [exportRank],* INTO #AdsReviewExport FROM #AdsReviewSignals; CREATE UNIQUE CLUSTERED INDEX IX_AdsReviewExport_Rank ON #AdsReviewExport([exportRank]); DROP TABLE #AdsReviewSignals;");
  const rows=async function*(){
   let after=0;
   try{
    while(true){
     const r=await tx.request().input('after',sql.BigInt,after).input('size',sql.Int,500).query(
      "SELECT TOP(@size) e.[exportRank],e.[Currency] AS [currency],e.[SellerId] AS [sellerId],e.[Marketplace] AS [marketplace],e.[EntityKey] AS [entityKey],e.[code],e.[evidenceStatus],COALESCE(c.[SellerName],p.[SellerName],e.[SellerId]) AS [sellerName],COALESCE(c.[CatalogTitle],p.[CatalogTitle]) AS [title],c.[spend],c.[sales],c.[totalSales],c.[clicks],c.[conversions],p.[spend] AS [priorSpend],p.[sales] AS [priorSales],c.[coveredDays] AS [currentDays],p.[coveredDays] AS [previousDays] FROM #AdsReviewExport e LEFT JOIN #AdsGroups c ON "+eq('e','c')+" AND c.[periodKey]='current' LEFT JOIN #AdsGroups p ON "+eq('e','p')+" AND p.[periodKey]='previous' WHERE e.[exportRank]>@after ORDER BY e.[exportRank];");
     if(!r.recordset.length)break;
     for(const row of r.recordset){if(Number(row.exportRank)!==after+1)throw Error('Review export cursor mismatch');after++;yield row;}
    }
    if(after!==count)throw Error('Review export count mismatch');
   }finally{await tx.request().batch('DROP TABLE IF EXISTS #AdsReviewExport;');}
  };
  return {count,rows};
 }
 const sampled=await tx.request().input('sample',sql.Int,SAMPLE_LIMIT).query(
  ";WITH ranked AS (SELECT *,ROW_NUMBER() OVER(PARTITION BY [Currency],[code] ORDER BY CASE WHEN [rankValue] IS NULL THEN 1 ELSE 0 END,[rankValue] DESC,[SellerId],[Marketplace],[EntityKey]) AS [sampleRank] FROM #AdsReviewSignals) "+
  "SELECT e.[Currency] AS [currency],e.[SellerId] AS [sellerId],e.[Marketplace] AS [marketplace],e.[EntityKey] AS [entityKey],e.[code],e.[evidenceStatus],"+
  "COALESCE(c.[SellerName],p.[SellerName],e.[SellerId]) AS [sellerName],COALESCE(c.[CatalogTitle],p.[CatalogTitle]) AS [title],"+
  "c.[spend] AS [spend],c.[sales] AS [sales],c.[totalSales] AS [totalSales],c.[clicks] AS [clicks],c.[conversions] AS [conversions],"+
  "p.[spend] AS [priorSpend],p.[sales] AS [priorSales],c.[coveredDays] AS [currentDays],p.[coveredDays] AS [previousDays],"+
  "c.[rowCount] AS [currentRows],c.[spendCount] AS [spendRows],c.[salesCount] AS [salesRows],c.[clicksCount] AS [clickRows],c.[conversionsCount] AS [conversionRows]"+
  " FROM ranked e LEFT JOIN #AdsGroups c ON "+eq('e','c')+" AND c.[periodKey]='current' LEFT JOIN #AdsGroups p ON "+eq('e','p')+
  " AND p.[periodKey]='previous' WHERE e.[sampleRank]<=@sample ORDER BY e.[Currency],e.[code],e.[sampleRank];");
 const key=(currency,code)=>JSON.stringify([currency,code]);
 const totals=new Map(counts.recordset.map(r=>[key(r.currency,r.code),r.total]));
 const samples=new Map();
 for(const r of sampled.recordset){
  const k=key(r.currency,r.code);if(!samples.has(k))samples.set(k,[]);
  samples.get(k).push({...r,key:JSON.stringify([r.sellerId,r.marketplace,r.currency,r.entityKey])});
 }
 const signals=populations.recordset.flatMap(p=>RULES.map(rule=>{
  const k=key(p.currency,rule.code),items=samples.get(k)||[];
  return {currency:p.currency,...rule,count:totals.get(k)||'0',items,sampleCount:items.length};
 }));
 await tx.request().batch('DROP TABLE #AdsReviewSignals;');
 return {...emptyReview(),populations:populations.recordset,signals,empty:false};
}
module.exports={compareValue,comparePeriods,compareCurrencies,readReviewSignals,emptyReview,RULES,SAMPLE_LIMIT,MIN_REVIEW_CLICKS};
