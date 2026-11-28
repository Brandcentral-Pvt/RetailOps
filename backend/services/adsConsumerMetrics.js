'use strict';
// Compatibility projection for INR-only dashboard and legacy target consumers.
const FIELDS=['AdSales','AdSpend','TotalSales','OrganicSales','Orders','Impressions','Clicks'];
const PAIRS={acos:['AdSpend','AdSales',100],tacos:['AdSpend','TotalSales',100],adShare:['AdSales','TotalSales',100],roas:['AdSales','AdSpend',1],ctr:['Clicks','Impressions',100],cpc:['AdSpend','Clicks',1]};
function projection(alias='p'){
  return ['COUNT_BIG(*) AS FactRows',...FIELDS.flatMap(k=>['SUM('+alias+'.['+k+']) AS ['+k+']','COUNT_BIG('+alias+'.['+k+']) AS ['+k+'Count]']),...Object.entries(PAIRS).map(([k,[n,d]])=>'COUNT_BIG(CASE WHEN '+alias+'.['+n+'] IS NOT NULL AND '+alias+'.['+d+'] IS NOT NULL THEN 1 END) AS ['+k+'PairCount]')].join(',\n          ');
}
function summarize(rows){
  const rowCount=rows.reduce((a,r)=>a+Number(r.FactRows||0),0);
  const totals={},coverage={},ratios={},ratioCoverage={};
  for(const k of FIELDS){
    const count=rows.reduce((a,r)=>a+Number(r[k+'Count']||0),0);
    totals[k]=count?rows.reduce((a,r)=>a+Number(r[k]??0),0):null;
    coverage[k]={populated:count,missing:rowCount-count,status:!count?'unknown':count===rowCount?'complete':'partial'};
  }
  for(const [k,[n,d,m]] of Object.entries(PAIRS)){
    const count=rows.reduce((a,r)=>a+Number(r[k+'PairCount']||0),0);
    const compatible=count>0&&count===coverage[n].populated&&count===coverage[d].populated;
    ratios[k]=compatible&&totals[d]>0?totals[n]/totals[d]*m:null;
    ratioCoverage[k]=ratios[k]===null?(compatible?'unknown':'incompatible_coverage'):count===rowCount?'complete':'partial';
  }
  return {rowCount,totals,coverage,ratios,ratioCoverage};
}
const rounded=v=>v==null?null:Math.round(v*100)/100;
module.exports={FIELDS,PAIRS,projection,summarize,rounded};
