'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {summarizePortfolio,trendBuckets,pairTrends,classify}=require('../services/adsPortfolioAnalytics');
const {METRICS,RATIOS}=require('../services/adsCanonicalMetrics');
const base={currency:'INR',sellerId:'s1',marketplace:'amazon.in',sellerName:'One',currentDays:2,currentRows:'2',spendRows:'2',salesRows:'2',totalSalesRows:'2',roasRows:'2',tacosRows:'2'};
const row=(id,values)=>({...base,rowNo:id,entityKey:'B'+String(id).padStart(9,'0'),...values});
const summarize=(rows,days=2)=>summarizePortfolio({days,entities:async function*(){yield* rows;},ranked:async function*(){
 for(const currency of [...new Set(rows.map(r=>r.currency))].sort())for(const metric of ['sales','spend','totalSales']){
  const list=rows.filter(r=>r.currency===currency&&r[metric]!=null&&Number(r[metric])>0).sort((a,b)=>Number(b[metric])-Number(a[metric])||a.rowNo-b.rowNo);
  for(const r of list)yield {...r,metric,amount:r[metric]};
 }
}});
test('positive-only Pareto includes crossing entity and keeps adjustments, unknowns and prior-only separate',async()=>{
 const rows=[row(1,{totalSales:'60',spend:'10',sales:'30'}),row(2,{totalSales:'20',spend:'10',sales:'10'}),row(3,{totalSales:'20',spend:'0',sales:'0'}),row(4,{totalSales:'-10',spend:'-1',sales:'-2'}),row(5,{totalSales:'0',spend:'0',sales:'0'}),row(6,{totalSales:null,spend:null,sales:null,spendRows:'0',salesRows:'0',totalSalesRows:'0',roasRows:'0',tacosRows:'0'}),row(7,{currentRows:null,currentDays:null,spend:null,sales:null,totalSales:null,priorSales:'9'}),row(8,{currency:'USD',totalSales:'900',spend:'10',sales:'20'})];
 const groups=await summarize(rows);assert.equal(groups.length,2);
 const g=groups[0],p=g.concentration.find(x=>x.metric==='totalSales');
 assert.equal(g.totalEntities,7);assert.equal(g.currentEntities,6);assert.equal(p.positiveTotal,'100');assert.equal(p.netObserved,'90');
 assert.equal(p.leadingCount,2);assert.equal(p.leadingSharePct,'80');assert.equal(p.remainingCount,1);assert.equal(p.remainingSharePct,'20');
 assert.deepEqual(p.samples.map(x=>[x.entityKey,x.tier]),[[rows[0].entityKey,'leading_80'],[rows[1].entityKey,'leading_80'],[rows[2].entityKey,'remaining_positive']]);
 assert.deepEqual([p.positiveEntities,p.zeroEntities,p.negativeEntities,p.unknownEntities,p.priorOnlyEntities],[3,1,1,1,1]);
 assert.equal(g.reference.roas,'2');assert.equal(g.segments.find(s=>s.code==='above_reference').count,1);
 assert.equal(g.segments.find(s=>s.code==='below_reference').count,1);assert.equal(g.segments.find(s=>s.code==='zero_spend_business_sales').count,1);
 assert.equal(g.segments.find(s=>s.code==='signed_adjustment').count,1);
 assert.equal(g.segments.reduce((n,s)=>n+s.count,0),7);
 assert.equal(groups[1].concentration.find(x=>x.metric==='totalSales').positiveTotal,'900');
});
test('exact threshold crossing, tiny values and no-positive case',async()=>{
 const rows=[row(1,{totalSales:'0.0000000003'}),row(2,{totalSales:'0.0000000001'}),row(3,{totalSales:'0.0000000001'})];
 const [g]=await summarize(rows),p=g.concentration.find(x=>x.metric==='totalSales');
 assert.equal(p.positiveTotal,'0.0000000005');assert.equal(p.leadingCount,2);assert.equal(p.leadingSharePct,'80');
 const none=g.concentration.find(x=>x.metric==='spend');assert.equal(none.positiveTotal,null);assert.equal(none.leadingSharePct,null);
 const crossing=(await summarize([row(1,{totalSales:'81'}),row(2,{totalSales:'19'})]))[0].concentration[0];
 assert.equal(crossing.leadingCount,1);assert.equal(crossing.leadingSharePct,'81');
});
test('segment reference compares exact ratios, preserves sparse compatible data and rejects unmatched coverage',()=>{
 const reference={spend:100000000000000000000000000000n,sales:200000000000000000000000000000n};
 const big=row(1,{spend:'9007199254740993.123456789',sales:'18014398509481986.2469135781',totalSales:'9'});
 assert.equal(classify(big,reference,2).code,'above_reference');
 assert.equal(classify({...big,currentDays:1},reference,2).evidence,'observed_partial');
 assert.equal(classify({...big,roasRows:'1'},reference,2).code,'insufficient_coverage');
 assert.equal(classify(row(2,{spend:'0',sales:'20',totalSales:'80'}),reference,2).code,'sales_without_spend');
 assert.equal(classify(row(3,{spend:'0',sales:null,totalSales:'80',salesRows:'0',roasRows:'0'}),reference,2).code,'zero_spend_business_sales');
});
test('aligned trend buckets clip current calendar weeks/months and preserve equal prior length',()=>{
 const period={startDate:'2026-04-29',endDate:'2026-05-05',prevStart:'2026-04-22',prevEnd:'2026-04-28',days:7};
 assert.deepEqual(trendBuckets(period,'month'),[
  {bucket:'2026-04',currentStart:'2026-04-29',currentEnd:'2026-04-30',previousStart:'2026-04-22',previousEnd:'2026-04-23',days:2},
  {bucket:'2026-05',currentStart:'2026-05-01',currentEnd:'2026-05-05',previousStart:'2026-04-24',previousEnd:'2026-04-28',days:5}
 ]);
 assert.deepEqual(trendBuckets(period,'week').map(x=>x.days),[5,2]);
 const missing=pairTrends([],[{currency:'INR'}],period,'day');
 assert.equal(missing.length,7);assert.equal(missing[0].current,null);assert.equal(missing[0].previous,null);
 assert.equal(missing[0].comparison.metrics.spend.delta,null);
});
test('aligned trends use weighted source aggregates and missing buckets remain null',()=>{
 const period={startDate:'2026-05-01',endDate:'2026-05-02',prevStart:'2026-04-29',prevEnd:'2026-04-30',days:2};
 function raw(periodKey,bucket,spend,sales){
  const r={currency:'INR',periodKey,bucket,coveredDays:1,rowCount:'1'};
  for(const k of Object.keys(METRICS)){r[k]=null;r[k+'Count']='0';}
  for(const k of Object.keys(RATIOS)){r[k+'PairCount']='0';r[k+'PairNumerator']=null;r[k+'PairDenominator']=null;}
  return {...r,spend,sales,spendCount:'1',salesCount:'1',roasPairCount:'1',roasPairNumerator:sales,roasPairDenominator:spend};
 }
 const trends=pairTrends([raw('current','2026-05-01','2','8'),raw('previous','2026-05-01','1','2')],[{currency:'INR'}],period,'day');
 assert.equal(trends[0].previousStart,'2026-04-29');assert.equal(trends[0].comparison.metrics.sales.percentChange,'300');assert.equal(trends[0].comparison.ratios.roas.delta,'2');
 assert.equal(trends[1].current,null);assert.equal(trends[1].previous,null);
});
