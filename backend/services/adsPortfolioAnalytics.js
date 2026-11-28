'use strict';
// SQL owns the filtered snapshot and ordering. Fixed-scale BigInt owns every
// financial threshold, sum and classification; only bounded pages/samples
// leave SQL Server, never the full raw daily fact population.
const {toFixedUnits:fixed,fromFixedUnits:decimal,ratio,shapeSummary,aggregateProjection}=require('./adsCanonicalMetrics');
const {comparePeriods,compareValue}=require('./adsAnalyticsV3');
const PAGE=2000,SAMPLE_LIMIT=10,BREAKDOWN_LIMIT=20;
const PARETO_METRICS=['totalSales','sales','spend'];
const MATRIX_METRICS=['spend','sales','totalSales','clicks','conversions'];
const SEGMENTS=[
 ['above_reference','Above weighted ROAS reference','Review for further investigation; not a profit or scaling recommendation.'],
 ['at_reference','At weighted ROAS reference','Review performance against the selected portfolio.'],
 ['below_reference','Below weighted ROAS reference','Investigate efficiency, relevance and conversion before changing budgets.'],
 ['spend_zero_sales','Spend with zero net ad sales','Review attribution timing and conversion.'],
 ['zero_spend_business_sales','Zero recorded spend, positive business sales','Review whether advertising coverage is appropriate; recorded zero does not prove lack of exposure.'],
 ['sales_without_spend','Positive attributed sales, zero recorded spend','Check attribution timing and source coverage.'],
 ['zero_ad_activity','Zero recorded spend and ad sales','Explicit zeros on compatible observed rows, not proof of no delivery.'],
 ['signed_adjustment','Negative net metric','Review signed adjustments before interpreting efficiency.'],
 ['insufficient_coverage','Insufficient compatible observations','Do not treat missing data as zero or compare mismatched populations.'],
 ['prior_only','Prior-period records only','Verify current source availability.']
].map(([code,label,action])=>({code,label,action}));
const SEGMENT_MAP=new Map(SEGMENTS.map(x=>[x.code,x]));
const keys=['SellerId','Marketplace','Currency','EntityKey'];
const eq=(a,b)=>keys.map(k=>a+'.['+k+']='+b+'.['+k+']').join(' AND ');
const asDecimal=(a,k)=>'CONVERT(decimal(38,10),'+a+'.['+k+'])';
const asBig=(a,k)=>'CONVERT(bigint,'+a+'.['+k+'])';
const textNum=(a,k)=>'CONVERT(varchar(80),'+a+'.['+k+']) AS ['+k+']';
const exact=value=>value==null?null:fixed(String(value));
const pct=(n,d)=>d>0n?ratio(decimal(n),decimal(d),100):null;
const populated=(row,field)=>BigInt(row[field+'Rows']||'0');
function aligned(row,a,b,pair){
 const n=populated(row,a),d=populated(row,b),p=BigInt(row[pair+'Rows']||'0');
 return n>0n&&n===d&&n===p;
}
const complete=(row,days,fields)=>row.currentDays===days&&row.currentRows!=null&&fields.every(k=>populated(row,k)===BigInt(row.currentRows));
function eligible(row){
 const s=exact(row.spend),a=exact(row.sales);
 return row.currentRows!=null&&s!==null&&s>0n&&a!==null&&a>=0n&&aligned(row,'spend','sales','roas');
}
function classify(row,reference,days){
 const s=exact(row.spend),a=exact(row.sales),t=exact(row.totalSales);
 if(row.currentRows==null)return {code:'prior_only',evidence:'data_gap'};
 if([s,a,t].some(v=>v!==null&&v<0n))return {code:'signed_adjustment',evidence:'observed_adjustment'};
 const observed=fields=>complete(row,days,fields)?'complete_observed':'observed_partial';
 if(s===0n&&a!==null&&a>0n&&aligned(row,'spend','sales','roas'))return {code:'sales_without_spend',evidence:observed(['spend','sales'])};
 if(s===0n&&t!==null&&t>0n&&aligned(row,'spend','totalSales','tacos'))return {code:'zero_spend_business_sales',evidence:observed(['spend','totalSales'])};
 if(!aligned(row,'spend','sales','roas')||s===null||a===null)return {code:'insufficient_coverage',evidence:'data_gap'};
 if(s===0n&&a===0n)return {code:'zero_ad_activity',evidence:observed(['spend','sales'])};
 if(s>0n&&a===0n)return {code:'spend_zero_sales',evidence:observed(['spend','sales'])};
 if(s>0n&&a>0n&&reference.spend>0n){
  // Cross multiplication is exact even for values above Number.MAX_SAFE_INTEGER.
  const left=a*reference.spend,right=reference.sales*s;
  return {code:left>right?'above_reference':left<right?'below_reference':'at_reference',evidence:observed(['spend','sales'])};
 }
 return {code:'insufficient_coverage',evidence:'data_gap'};
}
function metricState(){return {positive:0,zero:0,negative:0,unknown:0,priorOnly:0,completePositive:0,positiveTotal:0n,netObserved:0n,observed:0,running:0n,seen:0,headCount:0,headAmount:0n,samples:[]};}
function currencyState(currency){
 return {currency,totalEntities:0,currentEntities:0,reference:{spend:0n,sales:0n,entities:0,complete:0},
  pareto:Object.fromEntries(PARETO_METRICS.map(k=>[k,metricState()])),
  segments:new Map(SEGMENTS.map(s=>[s.code,{...s,count:0,complete:0,items:[],observed:Object.fromEntries(MATRIX_METRICS.map(k=>[k,{sum:0n,entities:0}])),adPair:{spend:0n,sales:0n,entities:0},conversionPair:{clicks:0n,conversions:0n,entities:0}}]))};
}
function publicItem(r,days){
 const compatible=aligned(r,'spend','sales','roas');
 const usable=compatible&&exact(r.spend)!==null&&exact(r.spend)>0n;
 return {key:JSON.stringify([r.sellerId,r.marketplace,r.currency,r.entityKey]),sellerId:r.sellerId,sellerName:r.sellerName,marketplace:r.marketplace,currency:r.currency,entityKey:r.entityKey,title:r.title??null,brand:r.brand??null,
  spend:r.spend??null,sales:r.sales??null,totalSales:r.totalSales??null,priorSales:r.priorSales??null,
  clicks:r.clicks??null,conversions:r.conversions??null,roas:usable?ratio(r.sales,r.spend,1):null,
  cvr:aligned(r,'clicks','conversions','cvr')&&exact(r.clicks)>0n?ratio(r.conversions,r.clicks,100):null,
  currentDays:r.currentDays??null,currentRows:r.currentRows??null,expectedDays:days,
  spendRows:r.spendRows??null,salesRows:r.salesRows??null,totalSalesRows:r.totalSalesRows??null};
}
function addSample(segment,r,evidence,days){
 const rank=[r.spend,r.totalSales,r.priorSales].map(exact).find(v=>v!==null&&v>0n)||0n;
 const entry={rank,ordinal:r.rowNo,item:{...publicItem(r,days),evidenceStatus:evidence}};
 // Deterministic ties follow the stable SQL entity order.
 segment.items.push(entry);
 segment.items.sort((a,b)=>a.rank>b.rank?-1:a.rank<b.rank?1:a.ordinal-b.ordinal);
 if(segment.items.length>SAMPLE_LIMIT)segment.items.pop();
}
async function summarizePortfolio({entities,ranked,days}){
 const currencies=new Map();
 const state=c=>{if(!currencies.has(c))currencies.set(c,currencyState(c));return currencies.get(c);};
 for await(const row of entities()){
  const g=state(row.currency);g.totalEntities++;
  if(row.currentRows!=null)g.currentEntities++;
  for(const k of PARETO_METRICS){
   const m=g.pareto[k],v=exact(row[k]);
   if(row.currentRows==null){m.priorOnly++;continue;}
   if(v===null){m.unknown++;continue;}
   m.observed++;m.netObserved+=v;
   if(v>0n){m.positive++;m.positiveTotal+=v;if(complete(row,days,[k]))m.completePositive++;}
   else if(v===0n)m.zero++;
   else m.negative++;
  }
  if(eligible(row)&&![row.spend,row.sales,row.totalSales].map(exact).some(v=>v!==null&&v<0n)){
   g.reference.entities++;g.reference.spend+=exact(row.spend);g.reference.sales+=exact(row.sales);
   if(complete(row,days,['spend','sales']))g.reference.complete++;
  }
 }
 for await(const row of entities()){
  const g=currencies.get(row.currency),classification=classify(row,g.reference,days),s=g.segments.get(classification.code);
  s.count++;if(classification.evidence==='complete_observed')s.complete++;
  if(row.currentRows!=null){
   for(const k of MATRIX_METRICS){
    const v=exact(row[k]);if(v!==null){s.observed[k].sum+=v;s.observed[k].entities++;}
   }
   if(eligible(row)&&classification.code!=='signed_adjustment'){
    s.adPair.spend+=exact(row.spend);s.adPair.sales+=exact(row.sales);s.adPair.entities++;
   }
   const clicks=exact(row.clicks),conversions=exact(row.conversions);
   if(clicks!==null&&clicks>0n&&conversions!==null&&conversions>=0n&&aligned(row,'clicks','conversions','cvr')){
    s.conversionPair.clicks+=clicks;s.conversionPair.conversions+=conversions;s.conversionPair.entities++;
   }
  }
  addSample(s,row,classification.evidence,days);
 }
 for await(const row of ranked()){
  const g=currencies.get(row.currency),m=g?.pareto[row.metric],v=exact(row.amount);
  if(!m||v===null||v<=0n)throw Error('Invalid positive portfolio rank');
  // Include the crossing product. Exact threshold, stable ranking, no
  // assumption that the leading segment contains 20% of product count.
  const head=m.running*5n<m.positiveTotal*4n;
  m.running+=v;m.seen++;
  if(head){m.headCount++;m.headAmount+=v;}
  if(m.samples.length<SAMPLE_LIMIT)m.samples.push({...publicItem(row,days),rank:m.seen,amount:decimal(v),
   tier:head?'leading_80':'remaining_positive',sharePct:pct(v,m.positiveTotal),cumulativePct:pct(m.running,m.positiveTotal),
   coverage:complete(row,days,[row.metric])?'complete_observed':'observed_partial'});
 }
 return [...currencies.values()].sort((a,b)=>a.currency.localeCompare(b.currency)).map(g=>{
  const segments=[...g.segments.values()].map(s=>({...SEGMENT_MAP.get(s.code),count:s.count,completeObserved:s.complete,items:s.items.map(r=>r.item),
   observed:Object.fromEntries(MATRIX_METRICS.map(k=>[k,{value:s.observed[k].entities?decimal(s.observed[k].sum):null,entities:s.observed[k].entities}])),
   compatibleRoas:{value:s.adPair.entities?ratio(decimal(s.adPair.sales),decimal(s.adPair.spend),1):null,entities:s.adPair.entities},
   compatibleCvr:{value:s.conversionPair.entities?ratio(decimal(s.conversionPair.conversions),decimal(s.conversionPair.clicks),100):null,entities:s.conversionPair.entities}
  }));
  if(segments.reduce((n,s)=>n+s.count,0)!==g.totalEntities)throw Error('Portfolio segment reconciliation failed');
  const concentration=PARETO_METRICS.map(metric=>{
   const m=g.pareto[metric];
   if(m.seen!==m.positive||m.running!==m.positiveTotal||m.positive+m.zero+m.negative+m.unknown+m.priorOnly!==g.totalEntities)throw Error('Portfolio concentration reconciliation failed');
   return {metric,positiveTotal:m.positive?decimal(m.positiveTotal):null,netObserved:m.observed?decimal(m.netObserved):null,
    positiveEntities:m.positive,zeroEntities:m.zero,negativeEntities:m.negative,unknownEntities:m.unknown,priorOnlyEntities:m.priorOnly,
    completePositiveEntities:m.completePositive,partialPositiveEntities:m.positive-m.completePositive,
    leadingCount:m.headCount,leadingAmount:m.positive?decimal(m.headAmount):null,leadingSharePct:pct(m.headAmount,m.positiveTotal),
    remainingCount:m.positive-m.headCount,remainingAmount:m.positive?decimal(m.positiveTotal-m.headAmount):null,
    remainingSharePct:pct(m.positiveTotal-m.headAmount,m.positiveTotal),samples:m.samples};
  });
  return {currency:g.currency,totalEntities:g.totalEntities,currentEntities:g.currentEntities,concentration,segments,
   reference:{eligibleEntities:g.reference.entities,completeObservedEntities:g.reference.complete,
    spend:g.reference.entities?decimal(g.reference.spend):null,sales:g.reference.entities?decimal(g.reference.sales):null,
    roas:g.reference.entities?ratio(decimal(g.reference.sales),decimal(g.reference.spend),1):null}};
 });
}
const entityColumns=['spend','sales','totalSales','clicks','conversions','priorSales','currentRows','spendRows','salesRows','totalSalesRows','roasRows','tacosRows','clicksRows','conversionsRows','cvrRows'];
const compactProjection=a=>[
 a+'.[rowNo] AS [rowNo]',a+'.[SellerId] AS [sellerId]',a+'.[Marketplace] AS [marketplace]',a+'.[Currency] AS [currency]',a+'.[EntityKey] AS [entityKey]',
 a+'.[sellerName]',a+'.[title]',a+'.[brand]',a+'.[currentDays]',...entityColumns.map(k=>textNum(a,k))
].join(',');
async function* pages({tx,sql,query,cursor}){
 let after=0;
 while(true){
  const r=await tx.request().input('after',sql.BigInt,after).input('pageSize',sql.Int,PAGE).query(query);
  if(!r.recordset.length)break;
  for(const row of r.recordset){
   const next=Number(row[cursor]);
   if(!Number.isSafeInteger(next)||next<=after)throw Error('Invalid analytics page cursor');
   after=next;row.rowNo=Number(row.rowNo);
   yield row;
  }
 }
}
async function readProducts({tx,sql,days}){
 await tx.request().batch(
 "SELECT ROW_NUMBER() OVER(ORDER BY e.[Currency],e.[SellerId],e.[Marketplace],e.[EntityKey]) AS [rowNo],"+keys.map(k=>'e.['+k+']').join(',')+
 ",COALESCE(c.[SellerName],p.[SellerName],e.[SellerId]) AS [sellerName],COALESCE(c.[CatalogTitle],p.[CatalogTitle]) AS [title],COALESCE(c.[CatalogBrand],p.[CatalogBrand]) AS [brand],c.[coveredDays] AS [currentDays],"+
 ['spend','sales','totalSales','clicks','conversions'].map(k=>asDecimal('c',k)+' AS ['+k+']').join(',')+','+asDecimal('p','sales')+' AS [priorSales],'+
 [['rowCount','currentRows'],['spendCount','spendRows'],['salesCount','salesRows'],['totalSalesCount','totalSalesRows'],['roasPairCount','roasRows'],['tacosPairCount','tacosRows'],['clicksCount','clicksRows'],['conversionsCount','conversionsRows'],['cvrPairCount','cvrRows']].map(([from,to])=>asBig('c',from)+' AS ['+to+']').join(',')+
 " INTO #AdsPortfolio FROM #AdsEntities e LEFT JOIN #AdsGroups c ON "+eq('e','c')+" AND c.[periodKey]='current' LEFT JOIN #AdsGroups p ON "+eq('e','p')+" AND p.[periodKey]='previous'; "+
 "CREATE UNIQUE CLUSTERED INDEX IX_AdsPortfolio_Row ON #AdsPortfolio([rowNo]); "+
 "SELECT ROW_NUMBER() OVER(ORDER BY p.[Currency],v.[metric],v.[amount] DESC,p.[SellerId],p.[Marketplace],p.[EntityKey]) AS [rankNo],p.[rowNo],v.[metric],v.[amount] INTO #AdsPortfolioRanked FROM #AdsPortfolio p CROSS APPLY(VALUES ('totalSales',p.[totalSales]),('sales',p.[sales]),('spend',p.[spend])) v([metric],[amount]) WHERE v.[amount]>0; "+
 "CREATE UNIQUE CLUSTERED INDEX IX_AdsPortfolioRanked_Row ON #AdsPortfolioRanked([rankNo]);");
 const entities=()=>pages({tx,sql,cursor:'rowNo',query:'SELECT TOP (@pageSize) '+compactProjection('p')+' FROM #AdsPortfolio p WHERE p.[rowNo]>@after ORDER BY p.[rowNo];'});
 const ranked=()=>pages({tx,sql,cursor:'rankNo',query:'SELECT TOP (@pageSize) r.[rankNo],r.[metric],CONVERT(varchar(80),r.[amount]) AS [amount],'+compactProjection('p')+' FROM #AdsPortfolioRanked r JOIN #AdsPortfolio p ON p.[rowNo]=r.[rowNo] WHERE r.[rankNo]>@after ORDER BY r.[rankNo];'});
 const groups=await summarizePortfolio({entities,ranked,days});
 await tx.request().batch('DROP TABLE #AdsPortfolioRanked; DROP TABLE #AdsPortfolio;');
 return groups;
}
const iso=d=>d.toISOString().slice(0,10);
const shift=(value,days)=>{const d=new Date(value+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return iso(d);};
function bucketKey(date,granularity){
 if(granularity==='month')return date.slice(0,7);
 if(granularity==='week'){const day=new Date(date+'T00:00:00Z').getUTCDay();return shift(date,-((day+6)%7));}
 return date;
}
function trendBuckets(period,granularity){
 const groups=new Map();
 for(let n=0;n<period.days;n++){
  const date=shift(period.startDate,n),key=bucketKey(date,granularity);
  if(!groups.has(key))groups.set(key,{bucket:key,currentStart:date,currentEnd:date,previousStart:shift(date,-period.days),previousEnd:shift(date,-period.days),days:0});
  const b=groups.get(key);b.currentEnd=date;b.previousEnd=shift(date,-period.days);b.days++;
 }
 return [...groups.values()];
}
const TREND_METRICS=['spend','sales','totalSales','organicSales','orders','conversions','clicks','impressions'];
const TREND_RATIOS=['acos','tacos','roas','ctr','cvr','cpc'];
const pick=(o,keys)=>Object.fromEntries(keys.map(k=>[k,o[k]]));
function trendShape(r){
 if(!r)return null;
 const s=shapeSummary(r);
 return {currency:s.currency,rowCount:s.rowCount,coveredDays:Number(r.coveredDays),totals:pick(s.totals,TREND_METRICS),coverage:pick(s.coverage,TREND_METRICS),ratios:pick(s.ratios,TREND_RATIOS)};
}
function pairTrends(raw,groups,period,granularity){
 const byKey=new Map(raw.map(r=>[JSON.stringify([r.currency,r.bucket,r.periodKey]),trendShape(r)]));
 return groups.flatMap(({currency})=>trendBuckets(period,granularity).map(b=>{
  const current=byKey.get(JSON.stringify([currency,b.bucket,'current']))||null,previous=byKey.get(JSON.stringify([currency,b.bucket,'previous']))||null;
  const opts={days:b.days};
  return {currency,...b,current,previous,comparison:{
   metrics:Object.fromEntries(TREND_METRICS.map(key=>[key,compareValue(current,previous,{...opts,key,kind:'metric'})])),
   ratios:Object.fromEntries(TREND_RATIOS.map(key=>[key,compareValue(current,previous,{...opts,key,kind:'ratio'})]))}};
 }));
}
async function readAlignedTrendRows({tx,sql,period,granularity}){
 const d='a.[alignedDate]';
 const bucket=granularity==='month'?"CONVERT(varchar(7),"+d+",23)":granularity==='week'?
 "CONVERT(varchar(10),DATEADD(day,-((DATEDIFF(day,CONVERT(date,'19000101',112),"+d+")%7+7)%7),"+d+"),23)":"CONVERT(varchar(10),"+d+",23)";
 const r=await tx.request().input('days',sql.Int,period.days).query(
  "SELECT p.[Currency] AS [currency],p.[periodKey],"+bucket+" AS [bucket],COUNT(DISTINCT p.[Date]) AS [coveredDays],"+aggregateProjection+
  " FROM #AdsScope p CROSS APPLY(SELECT CASE WHEN p.[periodKey]='previous' THEN DATEADD(day,@days,p.[Date]) ELSE p.[Date] END AS [alignedDate]) a GROUP BY p.[Currency],p.[periodKey],"+bucket+";");
 return r.recordset;
}
async function readTrends({tx,sql,period,granularity,groups}){
 return pairTrends(await readAlignedTrendRows({tx,sql,period,granularity}),groups,period,granularity);
}
const breakdownKeys=['dimension','Currency','Marketplace','groupKey'];
const groupEq=(a,b)=>breakdownKeys.map(k=>k==='groupKey'?'('+a+'.[groupKey]='+b+'.[groupKey] OR ('+a+'.[groupKey] IS NULL AND '+b+'.[groupKey] IS NULL))':a+'.['+k+']='+b+'.['+k+']').join(' AND ');
async function readBreakdowns({tx,sql,days,onMaterialized,full=false}){
 const select=(kind,key,label,into='')=>"SELECT CAST('"+kind+"' AS varchar(8)) AS [dimension],p.[Currency],p.[Marketplace],CONVERT(nvarchar(255),"+key+") AS [groupKey],"+label+" AS [groupName],p.[periodKey],COUNT(DISTINCT p.[Date]) AS [coveredDays],"+aggregateProjection+into+" FROM #AdsScope p GROUP BY p.[Currency],p.[Marketplace],"+key+",p.[periodKey]";
 await tx.request().batch(select('seller','p.[SellerId]','MAX(p.[SellerName])',' INTO #AdsBreakdowns')+' UNION ALL '+select('brand','p.[CatalogBrand]','p.[CatalogBrand]')+';');
 if(onMaterialized)await onMaterialized(tx);
 if(full){
  await tx.request().batch("SELECT ROW_NUMBER() OVER(ORDER BY [Currency],[dimension],[Marketplace],[groupKey],[periodKey]) AS [exportRank],* INTO #AdsBreakdownExport FROM #AdsBreakdowns; CREATE UNIQUE CLUSTERED INDEX IX_AdsBreakdownExport_Rank ON #AdsBreakdownExport([exportRank]); DROP TABLE #AdsBreakdowns;");
  const n=await tx.request().query('SELECT CONVERT(varchar(30),COUNT_BIG(*)) AS total FROM #AdsBreakdownExport;');
  const count=Number(n.recordset[0].total);
  const rows=async function*(){
   let after=0;
   try{
    while(true){
     const result=await tx.request().input('after',sql.BigInt,after).input('size',sql.Int,500).query('SELECT TOP(@size) * FROM #AdsBreakdownExport WHERE [exportRank]>@after ORDER BY [exportRank];');
     if(!result.recordset.length)break;
     for(const row of result.recordset){
      if(Number(row.exportRank)!==after+1)throw Error('Portfolio export cursor mismatch');after++;
      yield {...row,summary:shapeSummary({...row,currency:row.Currency})};
     }
    }
    if(after!==count)throw Error('Portfolio export count mismatch');
   }finally{await tx.request().batch('DROP TABLE IF EXISTS #AdsBreakdownExport;');}
  };
  return {count,rows};
 }
 const r=await tx.request().input('limit',sql.Int,BREAKDOWN_LIMIT).query(
  ';WITH e AS (SELECT DISTINCT '+breakdownKeys.map(k=>'['+k+']').join(',')+' FROM #AdsBreakdowns), ranked AS (SELECT e.*,COUNT_BIG(*) OVER(PARTITION BY e.[Currency],e.[dimension]) AS [groupCount],ROW_NUMBER() OVER(PARTITION BY e.[Currency],e.[dimension] ORDER BY CASE WHEN c.[totalSales] IS NULL THEN 1 ELSE 0 END,CONVERT(decimal(38,10),c.[totalSales]) DESC,e.[Marketplace],e.[groupKey]) AS [rank] FROM e LEFT JOIN #AdsBreakdowns c ON '+groupEq('e','c')+" AND c.[periodKey]='current') "+
  'SELECT g.*,CONVERT(varchar(30),e.[groupCount]) AS [groupCount],e.[rank] FROM ranked e JOIN #AdsBreakdowns g ON '+groupEq('e','g')+' WHERE e.[rank]<=@limit ORDER BY e.[Currency],e.[dimension],e.[rank],g.[periodKey];');
 const out=new Map(),items=new Map();
 for(const row of r.recordset){
  const key=JSON.stringify([row.Currency,row.dimension]),itemKey=JSON.stringify([row.Currency,row.dimension,row.Marketplace,row.groupKey]);
  if(!out.has(key))out.set(key,{currency:row.Currency,dimension:row.dimension,totalGroups:row.groupCount,items:[]});
  if(!items.has(itemKey)){
   const item={key:itemKey,marketplace:row.Marketplace,groupKey:row.groupKey,label:row.groupName??(row.dimension==='brand'?'Brand unavailable':row.groupKey),current:null,previous:null};
   items.set(itemKey,item);out.get(key).items.push(item);
  }
  const shaped=shapeSummary({...row,currency:row.Currency});
  items.get(itemKey)[row.periodKey]={...shaped,coveredDays:Number(row.coveredDays)};
 }
 for(const group of out.values())for(const item of group.items)item.comparison=comparePeriods(item.current,item.previous,days);
 await tx.request().batch('DROP TABLE #AdsBreakdowns;');
 return [...out.values()];
}
function emptyPortfolio(){return {version:'v1',sampleLimit:SAMPLE_LIMIT,breakdownLimit:BREAKDOWN_LIMIT,groups:[],trends:[],breakdowns:[],empty:true};}
async function readPortfolioAnalytics({tx,sql,period,granularity,exportMode=false}){
 const groups=await readProducts({tx,sql,days:period.days});
 if(!groups.length)return emptyPortfolio();
 const trends=await readTrends({tx,sql,period,granularity,groups});
 const breakdowns=await readBreakdowns({tx,sql,days:period.days,full:exportMode});
 return {...emptyPortfolio(),groups,trends,breakdowns,empty:false};
}
module.exports={summarizePortfolio,classify,trendBuckets,pairTrends,readProducts,readAlignedTrendRows,readBreakdowns,readPortfolioAnalytics,emptyPortfolio,PARETO_METRICS,SEGMENTS,SAMPLE_LIMIT,BREAKDOWN_LIMIT};
