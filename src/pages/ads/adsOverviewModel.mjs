// Expected actual calendar buckets; absent observations remain null.
const shift=(date,n)=>{const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
function bucketOf(date,granularity){
 if(granularity==='month')return date.slice(0,7);
 if(granularity==='week')return shift(date,-((new Date(date+'T00:00:00Z').getUTCDay()+6)%7));
 return date;
}
export function calendarBuckets(period,periodKey,granularity){
 const start=periodKey==='previous'?period?.prevStart:period?.startDate,end=periodKey==='previous'?period?.prevEnd:period?.endDate;
 if(!start||!end||!Number.isFinite(Date.parse(start))||!Number.isFinite(Date.parse(end))||start>end)return [];
 const out=new Map();
 for(let date=start,n=0;date<=end&&n<366;date=shift(date,1),n++){
  const bucket=bucketOf(date,granularity);if(!out.has(bucket))out.set(bucket,{bucket,start:date,end:date,days:0});
  const b=out.get(bucket);b.end=date;b.days++;
 }
 return [...out.values()];
}
export const ratioMetric=k=>['acos','tacos','roas','ctr','cvr','cpc','costPerOrder'].includes(k);
export const metricValue=(s,k)=>ratioMetric(k)?s?.ratios?.[k]?.value??null:s?.totals?.[k]??null;
export const metricCoverage=(s,k)=>(ratioMetric(k)?s?.ratios:s?.coverage)?.[k]?.status??'unknown';
export function buildOverviewTrend({report,currency,periodKey,granularity,keys}){
 const records=new Map((report?.series||[]).filter(r=>r.currency===currency&&r.periodKey===periodKey).map(r=>[r.bucket,r]));
 return calendarBuckets(report?.period,periodKey,granularity).map(b=>{
  const source=records.get(b.bucket)||null,exact=Object.fromEntries(keys.map(k=>[k,metricValue(source,k)]));
  return {...b,source,exact,...Object.fromEntries(keys.map(k=>[k,exact[k]==null||!Number.isFinite(Number(exact[k]))?null:Number(exact[k])]))};
 });
}
export function reportCurrencies(report){
 return [...new Set([...(report?.current||[]),...(report?.previous||[])].map(s=>s.currency).filter(Boolean))].sort();
}
