'use strict';
// Dashboard-specific exact aggregation of the canonical INR fact population.
// The old compatibility consumer stays unchanged for other modules.
const {toFixedUnits,fromFixedUnits,ratio}=require('./adsCanonicalMetrics');
const FIELDS=['AdSales','AdSpend','TotalSales','OrganicSales','Orders','Impressions','Clicks','Conversions','TotalUnits'];
const RATIOS={acos:['AdSpend','AdSales',100],tacos:['AdSpend','TotalSales',100],adShare:['AdSales','TotalSales',100],roas:['AdSales','AdSpend',1],ctr:['Clicks','Impressions',100],cpc:['AdSpend','Clicks',1],cvr:['Conversions','Clicks',100]};
const count=(v)=>{const n=Number(v??0);if(!Number.isSafeInteger(n)||n<0)throw Error('Invalid dashboard count');return n;};
function projection(alias='p'){
 const col=k=>alias+'.['+k+']';
 return ['COUNT_BIG(*) AS FactRows',...FIELDS.flatMap(k=>['CONVERT(varchar(80),SUM(CONVERT(decimal(38,10),'+col(k)+'))) AS ['+k+']','COUNT_BIG('+col(k)+') AS ['+k+'Count]']),...Object.entries(RATIOS).map(([k,[n,d]])=>'COUNT_BIG(CASE WHEN '+col(n)+' IS NOT NULL AND '+col(d)+' IS NOT NULL THEN 1 END) AS ['+k+'PairCount]')].join(',\n');
}
function displayNumber(v){
 if(v==null)return null;
 const n=Number(v);
 // Keep exact totals separately; reject numbers that cannot be displayed safely.
 if(!Number.isFinite(n)||Math.abs(n)>Number.MAX_SAFE_INTEGER/100)return null;
 return n;
}
function summarize(rows){
 const rowCount=rows.reduce((a,r)=>a+count(r.FactRows),0);
 const totals={},exactTotals={},coverage={},ratios={},exactRatios={},ratioCoverage={};
 for(const k of FIELDS){
  let sum=0n,populated=0;
  for(const r of rows){
   const n=count(r[k+'Count']);
   if(n>count(r.FactRows))throw Error('Invalid dashboard metric coverage');
   if(n){if(r[k]==null)throw Error('Missing aggregate for observed dashboard metric');sum+=toFixedUnits(String(r[k]));}
   populated+=n;
  }
  const value=populated?fromFixedUnits(sum):null;
  exactTotals[k]=value;totals[k]=displayNumber(value);
  coverage[k]={populated,missing:rowCount-populated,status:!populated?'unknown':populated===rowCount?'complete':'partial'};
 }
 for(const [k,[n,d,m]] of Object.entries(RATIOS)){
  const pairs=rows.reduce((a,r)=>a+count(r[k+'PairCount']),0);
  if(pairs>coverage[n].populated||pairs>coverage[d].populated)throw Error('Invalid dashboard ratio coverage');
  const compatible=pairs>0&&pairs===coverage[n].populated&&pairs===coverage[d].populated;
  const value=compatible?ratio(exactTotals[n],exactTotals[d],m):null;
  exactRatios[k]=value;ratios[k]=displayNumber(value);
  ratioCoverage[k]=!coverage[n].populated||!coverage[d].populated?'unknown':!compatible?'incompatible_coverage':value==null?'unknown':pairs===rowCount?'complete':'partial';
 }
 return {rowCount,totals,exactTotals,coverage,ratios,exactRatios,ratioCoverage};
}
const rounded=v=>v==null?null:Math.round(v*100)/100;
function periodComparison(current,previous,days,observedCurrent,observedPrevious){
 const comparable=observedCurrent===days&&observedPrevious===days;
 const metrics={},ratios={};
 for(const k of FIELDS){
  const a=current.totals[k],b=previous.totals[k];
  metrics[k]=comparable&&current.coverage[k].status==='complete'&&previous.coverage[k].status==='complete'&&a!=null&&b!=null&&b!==0?(a-b)/Math.abs(b)*100:null;
 }
 for(const k of Object.keys(RATIOS)){
  const a=current.ratios[k],b=previous.ratios[k];
  const ok=comparable&&current.ratioCoverage[k]==='complete'&&previous.ratioCoverage[k]==='complete'&&a!=null&&b!=null;
  ratios[k]=ok?rounded(k==='roas'||k==='cpc'?(b!==0?(a-b)/Math.abs(b)*100:null):a-b):null;
 }
 return {metrics,ratios,coverage:{currentDays:observedCurrent,previousDays:observedPrevious,expectedDays:days,comparable}};
}
module.exports={FIELDS,RATIOS,projection,summarize,rounded,periodComparison};
