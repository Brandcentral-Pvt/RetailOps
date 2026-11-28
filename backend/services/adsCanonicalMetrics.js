'use strict';
// Exact fixed-scale arithmetic; no JS Number conversion of SQL DECIMAL/BIGINT values.
const {validDate}=require('./adsProductContract');
const {strictScope,AdsScopeError}=require('./adsCanonicalScope');
const SCALE=10n**10n;
const METRICS={
  spend:'AdSpend',sales:'AdSales',organicSales:'OrganicSales',totalSales:'TotalSales',
  orders:'Orders',conversions:'Conversions',organicOrders:'OrganicOrders',totalOrders:'TotalOrders',
  impressions:'Impressions',clicks:'Clicks',units:'TotalUnits',pageViews:'PageViews',sessions:'Sessions',
  sameSkuSales:'SameSkuSales',sameSkuOrders:'SameSkuOrders',newToBrandSales:'NewToBrandSales',
  newToBrandOrders:'NewToBrandOrders',newToBrandUnits:'NewToBrandUnits',
  orderedRevenue:'OrderedRevenue',orderedOrders:'OrderedOrders',unitsOrdered:'UnitsOrdered',
  shippedRevenue:'ShippedRevenue',shippedCogs:'ShippedCogs',shippedUnits:'ShippedUnits'
};
const RATIOS={
  acos:['spend','sales',100],tacos:['spend','totalSales',100],roas:['sales','spend',1],
  ctr:['clicks','impressions',100],cvr:['conversions','clicks',100],orderRate:['orders','clicks',100],
  cpc:['spend','clicks',1],cpm:['spend','impressions',1000],costPerOrder:['spend','orders',1],
  aov:['sales','conversions',1],revenuePerOrder:['sales','orders',1],adSharePct:['sales','totalSales',100]
};
function fixed(value){
  if(value===null||value===undefined)return null;
  if(typeof value!=='string'||!/^[-+]?\d+(?:\.\d{1,10})?$/.test(value))throw new Error('Canonical SQL numeric text required.');
  const [w,d='']=value.replace(/^[-+]/,'').split('.');
  return (value.startsWith('-')?-1n:1n)*(BigInt(w)*SCALE+BigInt(d.padEnd(10,'0')));
}
function display(n,digits){
  if(n===null)return null;
  const neg=n<0n;const s=(neg?-n:n).toString().padStart(digits+1,'0');
  const d=digits?s.slice(-digits).replace(/0+$/,''):'';
  return (neg?'-':'')+(digits?s.slice(0,-digits):s)+(d?'.'+d:'');
}
function canonicalValue(value){return display(fixed(value),10);}
function difference(current,previous){
  const a=fixed(current),b=fixed(previous);
  return a===null||b===null?null:display(a-b,10);
}
function ratio(numerator,denominator,multiplier){
  const n=fixed(numerator),d=fixed(denominator);
  if(n===null||d===null||d<=0n)return null;
  const a=(n<0n?-n:n)*BigInt(multiplier)*1000000n;
  const rounded=(a+d/2n)/d;
  return display(n<0n?-rounded:rounded,6);
}
function countText(value){
  if(typeof value!=='string'||!/^\d+$/.test(value))throw new Error('Canonical SQL count text required.');
  return BigInt(value);
}
function shapeSummary(row){
  const rows=countText(row.rowCount),totals={},coverage={},ratios={};
  for(const [key] of Object.entries(METRICS)){
    const count=countText(row[key+'Count']);
    if(count>rows)throw new Error('Metric coverage exceeds fact count.');
    totals[key]=canonicalValue(row[key]);
    if((count===0n)!==(totals[key]===null))throw new Error('Metric aggregate and coverage disagree.');
    coverage[key]={populated:count.toString(),missing:(rows-count).toString(),
      status:count===0n?'unknown':count===rows?'complete':'partial'};
  }
  for(const [key,[n,d,m]] of Object.entries(RATIOS)){
    const pair=countText(row[key+'PairCount']),nc=countText(row[n+'Count']),dc=countText(row[d+'Count']);
    if(pair>nc||pair>dc)throw new Error('Ratio paired coverage exceeds marginal coverage.');
    const observed=ratio(totals[n],totals[d],m);
    const matched=ratio(row[key+'PairNumerator'],row[key+'PairDenominator'],m);
    const samePopulation=nc===dc&&dc===pair&&pair>0n;
    // A ratio of mismatched observed populations is exposed as a provisional
    // diagnostic, not a decision-ready metric. Paired-row ratios are also
    // diagnostic and may omit organic-only business revenue (not portfolio TACoS).
    const value=samePopulation?observed:null;
    ratios[key]={value,observedValue:observed,matchedValue:matched,pairedRows:pair.toString(),
      status:observed===null?'unknown':!samePopulation?'incompatible_coverage':pair===rows?'complete':'partial'};
  }
  return {currency:row.currency,rowCount:rows.toString(),totals,coverage,ratios};
}
function validateWindow(start,end){
  if(typeof start!=='string'||typeof end!=='string'||!validDate(start)||!validDate(end)||start>end)
    throw new AdsScopeError('invalid_date_range','Provide valid ordered YYYY-MM-DD dates.');
  const days=(Date.parse(end+'T00:00:00Z')-Date.parse(start+'T00:00:00Z'))/86400000+1;
  if(!Number.isFinite(days)||days>366)throw new AdsScopeError('invalid_date_range','A maximum of 366 days is supported in this diagnostic.');
  return {startDate:start,endDate:end,days};
}
const sumText=(col)=>'CONVERT(varchar(80),SUM(CONVERT(decimal(38,10),'+col+')))';
const count=(col)=>'CONVERT(varchar(30),COUNT_BIG('+col+'))';
const metricSelect=Object.entries(METRICS).flatMap(([key,c])=>[
  sumText('p.['+c+']')+' AS ['+key+']',count('p.['+c+']')+' AS ['+key+'Count]'
]);
const pairSelect=Object.entries(RATIOS).flatMap(([key,[n,d]])=>{
  const a='p.['+METRICS[n]+']',b='p.['+METRICS[d]+']',condition=a+' IS NOT NULL AND '+b+' IS NOT NULL';
  return [count('CASE WHEN '+condition+' THEN 1 END')+' AS ['+key+'PairCount]',
    sumText('CASE WHEN '+condition+' THEN '+a+' END')+' AS ['+key+'PairNumerator]',
    sumText('CASE WHEN '+condition+' THEN '+b+' END')+' AS ['+key+'PairDenominator]'];
});
const aggregateProjection=[count('*')+' AS [rowCount]',...metricSelect,...pairSelect].join(',');
async function readCanonicalSummary({pool,sql,user,sellerId,startDate,endDate}){
  const scope=strictScope(user,sellerId),period=validateWindow(startDate,endDate);
  if(scope.empty)return {period,reportType:'daily',currencies:[],empty:true,source:'canonical_v1'};
  const request=pool.request().input('startDate',sql.VarChar(10),startDate).input('endDate',sql.VarChar(10),endDate);
  let predicate='';
  if(!scope.unrestricted){
    request.input('sellerIds',sql.NVarChar(sql.MAX),JSON.stringify(scope.sellerIds));
    predicate=" AND EXISTS (SELECT 1 FROM OPENJSON(@sellerIds) WITH (id varchar(50) '$') x WHERE x.id=p.SellerId)";
  }
  let result;
  try { result=await request.query("SELECT p.Currency AS [currency],"+count('*')+" AS [rowCount],"+
    [...metricSelect,...pairSelect].join(',')+" FROM dbo.AdsProductDailyFacts p WHERE p.ReportType='daily' AND p.[Date]>=CONVERT(date,@startDate,23) AND p.[Date]<=CONVERT(date,@endDate,23)"+predicate+" GROUP BY p.Currency ORDER BY p.Currency;"); }
  catch(error){throw new Error('Canonical currency summary SQL failed: '+error.message,{cause:error});}
  const currencies=result.recordset.map(shapeSummary);
  return {period,reportType:'daily',currencies,empty:currencies.length===0,source:'canonical_v1'};
}
module.exports={METRICS,RATIOS,ratio,difference,toFixedUnits:fixed,fromFixedUnits:n=>display(n,10),shapeSummary,validateWindow,readCanonicalSummary,aggregateProjection};
