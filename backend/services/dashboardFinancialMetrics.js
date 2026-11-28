'use strict';

// GMS money is persisted at two decimal places. Read SQL aggregates as text
// and accumulate minor units, never floating-point monetary subtotals.
function exactSum(rows,key,scale=2){
 if(!rows.length)return null;
 const divisor=10n**BigInt(scale);
 let sum=0n;
 for(const row of rows){
  if(row[key]==null)return null;
  const s=String(row[key]);
  if(!/^[+-]?\d+(?:\.\d+)?$/.test(s))throw Error('Invalid dashboard metric');
  const [whole,fraction='']=s.replace(/^[+-]/,'').split('.');
  if(fraction.slice(scale).replace(/0/g,'').length)throw Error('Unexpected dashboard metric precision');
  sum+=(s.startsWith('-')?-1n:1n)*(BigInt(whole)*divisor+BigInt(fraction.slice(0,scale).padEnd(scale,'0')||'0'));
 }
 if(sum>BigInt(Number.MAX_SAFE_INTEGER)||sum<BigInt(Number.MIN_SAFE_INTEGER))throw Error('Dashboard metric exceeds safe display precision');
 return Number(sum)/Number(divisor);
}
// Trusted SQL identifiers/conditions only; no user text reaches this helper.
// Null facts and empty windows are unknown, not observed zero.
function metricProjection(column,alias,{condition,scale=2}={}){
 const cast=scale===0?'bigint':'decimal(38,2)';
 const value='CONVERT('+cast+','+column+')';
 const count=condition?'COUNT_BIG(CASE WHEN '+condition+' THEN 1 END)':'COUNT_BIG(*)';
 const populated=condition?'COUNT_BIG(CASE WHEN '+condition+' AND '+column+' IS NOT NULL THEN 1 END)':'COUNT_BIG('+column+')';
 return 'CASE WHEN '+count+'>0 AND '+count+'='+populated+' THEN CONVERT(varchar(50),SUM('+(condition?'CASE WHEN '+condition+' THEN '+value+' END':value)+')) END AS ['+alias+']';
}
const percentage=(n,d)=>n!=null&&d!=null&&d>0?n/d*100:null;
const change=(n,d,comparable=true)=>comparable&&n!=null&&d!=null&&d!==0?(n-d)/Math.abs(d)*100:null;
const rounded=n=>n==null?null:Math.round(n*100)/100;
function periodCoverage(rows,days){
 return {observedDays:rows.length,expectedDays:days,complete:rows.length===days};
}
module.exports={exactSum,metricProjection,percentage,change,rounded,periodCoverage};
