// All displayed values come from the server analytics response. Formatting
// must never coerce unknown metrics to zero or discard signed adjustments.
const money=new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',minimumFractionDigits:2,maximumFractionDigits:2});
const count=new Intl.NumberFormat('en-IN',{maximumFractionDigits:0});
export const isKnown=value=>value!=null&&typeof value==='number'&&Number.isFinite(value);
export const formatMoney=value=>isKnown(value)?money.format(value):'N/A';
export const formatCount=value=>isKnown(value)?count.format(value):'N/A';
export const formatRatio=value=>isKnown(value)?value.toFixed(2)+'%':'N/A';
export function compactMoney(value){
  if(!isKnown(value))return 'N/A';
  const a=Math.abs(value),sign=value<0?'-':'';
  if(a>=1e7)return sign+'₹'+(a/1e7).toFixed(2)+'Cr';
  if(a>=1e5)return sign+'₹'+(a/1e5).toFixed(2)+'L';
  if(a>=1e3)return sign+'₹'+(a/1e3).toFixed(1)+'k';
  return formatMoney(value);
}
export const METRICS=[
  {key:'orderedRevenue',label:'Ordered Revenue',kind:'money'},
  {key:'orderedUnits',label:'Ordered Units',kind:'count'},
  {key:'shippedRevenue',label:'Shipped Revenue',kind:'money'},
  {key:'shippedUnits',label:'Shipped Units',kind:'count'},
  {key:'shippedCOGS',label:'Shipped COGS',kind:'money',neutral:true},
  {key:'profit',label:'Gross Profit',kind:'money'},
  {key:'marginPct',label:'Gross Margin',kind:'ratio'},
  {key:'customerReturns',label:'Customer Returns',kind:'count',neutral:true},
  {key:'returnRatio',label:'Return Ratio',kind:'ratio',invert:true},
];
export function metricValue(metric,value,{compact=false}={}){
  return metric.kind==='money'?(compact?compactMoney(value):formatMoney(value)):metric.kind==='ratio'?formatRatio(value):formatCount(value);
}
export function changeLabel(metric,value){
  if(!isKnown(value))return null;
  return (value>0?'+':'')+value.toFixed(2)+(metric.kind==='ratio'?' pp':'%');
}
export function changeTone(metric,value){
  if(!isKnown(value)||value===0||metric.neutral)return 'default';
  return (metric.invert?value<0:value>0)?'success':'error';
}
// Use explicit calendar-day gaps rather than charting missing days as zeros.
export function dailySeries(daily,metric,window){
  const map=new Map((daily||[]).map(r=>[r.date,r[metric]]));
  const observed=[...map.keys()].sort();
  const from=window?.from||observed[0],to=window?.to||observed.at(-1);
  if(!from||!to)return [];
  const a=Date.parse(from+'T00:00:00Z'),b=Date.parse(to+'T00:00:00Z');
  if(!Number.isFinite(a)||!Number.isFinite(b)||a>b||b-a>3660*86400000)return [];
  const out=[];
  for(let d=a;d<=b;d+=86400000){
    const key=new Date(d).toISOString().slice(0,10),v=map.get(key);
    out.push({x:d,y:isKnown(v)?v:null});
  }
  return out;
}
export function monthKeys(groups){return Object.keys(groups||{}).sort();}
export function visibleMonth(groups,requested){
  const keys=monthKeys(groups);
  return keys.includes(requested)?requested:keys.at(-1)||null;
}
export function matrixPeriods(groups,granularity,requested){
  const month=visibleMonth(groups,requested);
  if(granularity==='summary')return [];
  const months=granularity==='month'?monthKeys(groups):month?[month]:[];
  return months.flatMap(key=>{
    const m=groups[key];
    if(granularity==='month')return [{key:m.key,label:m.label,type:'month',revenueMap:'monthlyRev',trendMap:'_momTrends',sortKey:'month-total-'+m.key,trendLabel:'MoM'}];
    return Object.values(m.weeks||{}).sort((a,b)=>a.key.localeCompare(b.key)).flatMap(w=>{
      if(granularity==='week')return [{key:w.key,label:w.label,type:'week',revenueMap:'weeklyRev',trendMap:'_wowTrends',sortKey:'week-total-'+w.key,trendLabel:'WoW'}];
      return [...(w.days||[])].sort().map(day=>({key:day,label:day,type:'day',revenueMap:'dailyRev',trendMap:'_dodTrends',sortKey:'day-'+day,trendLabel:'DoD'}));
    });
  });
}
