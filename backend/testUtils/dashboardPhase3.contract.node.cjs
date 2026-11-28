'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {summarize,projection,periodComparison}=require('../services/dashboardAdsMetrics');
const {shapePortfolio}=require('../services/dashboardIntelligence');
const db=require.resolve('../database/db');
require.cache[db]={id:db,filename:db,loaded:true,exports:{sql:{VarChar:()=>{},DateTime2:()=>{}}}};
const {shapeTarget,targetPeriod}=require('../services/dashboardTargets');
const {readTaskSnapshot}=require('../services/dashboardTaskIntelligence');
const ad=(sales,spend,total='10',extra={})=>({FactRows:1,AdSales:sales,AdSalesCount:sales==null?0:1,AdSpend:spend,AdSpendCount:spend==null?0:1,TotalSales:total,TotalSalesCount:total==null?0:1,acosPairCount:sales!=null&&spend!=null?1:0,roasPairCount:sales!=null&&spend!=null?1:0,tacosPairCount:spend!=null&&total!=null?1:0,adSharePairCount:sales!=null&&total!=null?1:0,...extra});
test('exact ten-place SQL decimals and weighted ratios',()=>{
 const result=summarize([ad('0.1000000001','0.2'),ad('0.2000000002','0.1')]);
 assert.equal(result.exactTotals.AdSales,'0.3000000003');
 assert.equal(result.exactTotals.AdSpend,'0.3');
 assert.equal(result.ratios.roas,1);
 assert.equal(result.ratios.tacos,1.5);
 assert.equal(result.totals.TotalUnits,null);
 assert.match(projection('AP'),/CONVERT\(varchar\(80\),SUM\(CONVERT\(decimal\(38,10\)/);
 const zero=summarize([ad('0','2')]);
 assert.equal(zero.ratios.roas,0);assert.equal(zero.ratios.acos,null);
 const partial=summarize([ad('10',null),ad(null,'2')]);
 assert.equal(partial.ratios.roas,null);assert.equal(partial.ratioCoverage.roas,'incompatible_coverage');
});
test('financial comparisons require complete date and metric coverage',()=>{
 const a=summarize([ad('20','2')]),b=summarize([ad('10','2')]);
 assert.equal(periodComparison(a,b,2,1,1).metrics.AdSales,null);
 const c=periodComparison(a,b,1,1,1);
 assert.equal(c.metrics.AdSales,100);
 assert.equal(c.ratios.roas,100);
 assert.equal(c.ratios.acos,-10);
});
test('portfolio denominator is explicit, head count is not a fixed top twenty percent',()=>{
 const p=shapePortfolio([{ObservedProducts:210,PositiveProducts:207,HeadProducts:12,UnknownProducts:1,UnmatchedProducts:1,ZeroProducts:1,NegativeProducts:0,PositiveRevenue:'1000.00',HeadRevenue:'803.00',Top3Revenue:'500.00'}],{observedDays:5,expectedDays:7,complete:false});
 assert.equal(p.tailProducts,195);assert.equal(p.headRevenueShare,80.3);assert.equal(p.top3RevenueShare,50);assert.equal(p.status,'observed_partial');
});
test('targets preserve future and unknown data, zero actuals and distinct goal directions',()=>{
 const base={Id:'t',SellerId:'s1',TargetType:'MONTHLY',Year:2026,Month:4,GoalType:'GMS',TotalTargetValue:'100'};
 assert.deepEqual(targetPeriod(base),{start:'2026-04-01',end:'2026-04-30'});
 const row={SellerId:'s1',Date:'2026-04-01',Revenue:'0'};
 const build=(t,over={})=>shapeTarget({...base,...t},{today:'2026-04-01',gmsRows:[row],adsRows:[],...over});
 assert.equal(build({}).overallAchieved,0);
 assert.equal(build({}).status,'in_progress');
 assert.equal(build({},{today:'2026-04-02'}).overallAchieved,null);
 assert.equal(build({},{today:'2026-03-31'}).status,'not_started');
 assert.equal(build({GoalType:'ADS',TotalTargetValue:'1'},{adsRows:[{SellerId:'s1',Date:'2026-04-01',...ad('5','2')}]}).status,'over_limit');
 assert.equal(build({GoalType:'ACOS',TotalTargetValue:'50'},{adsRows:[{SellerId:'s1',Date:'2026-04-01',...ad('10','2')}]}).status,'within_limit');
});
test('task summary reads all scoped rows and returns a bounded sample',async()=>{
 let query,params={};
 const pool={request:()=>({input(k,t,v){params[k]=v;return this;},async query(q){query=q;return {recordsets:[[{DashboardStatus:'PENDING',Total:205,Overdue:40,Breached:2,AtRisk:3}],Array.from({length:5},(_,i)=>({Id:String(i)}))]};}})};
 const r=await readTaskSnapshot({pool,sql:{VarChar:()=>{},DateTime2:()=>{}},scope:{unrestricted:false,empty:false,sellerIds:['s1']}});
 assert.equal(r.summary.total,205);assert.equal(r.summary.overdue,40);assert.equal(r.instances.length,5);
 assert.equal(params.taskSeller_0,'s1');assert.match(query,/SellerId IN \(@taskSeller_0\)/);assert.match(query,/rn<=5/);
 const empty=await readTaskSnapshot({pool:{request(){throw Error('Must not query empty scope');}},sql:{},scope:{empty:true}});
 assert.equal(empty.summary.total,0);
});
