'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {compareValue,comparePeriods,compareCurrencies,emptyReview,RULES}=require('../services/adsAnalyticsV3');
const {readCanonicalReport}=require('../services/adsCanonicalReport');
const {difference}=require('../services/adsCanonicalMetrics');
function summary(value,{days=2,status='complete',currency='INR',rate='25'}={}){
 return {currency,coveredDays:days,totals:{spend:value},coverage:{spend:{status}},ratios:{acos:{value:rate,status}}};
}
test('exact signed differences and positive baseline relative changes',()=>{
 assert.equal(difference('9007199254740993.1234567891','9007199254740993.123456789'),'0.0000000001');
 assert.equal(difference('-1.25','2.5'),'-3.75');
 const a=comparePeriods(summary('125',{rate:'20'}),summary('100',{rate:'25'}),2);
 assert.deepEqual(a.metrics.spend,{status:'comparable',unit:'absolute',delta:'25',percentChange:'25',observedDelta:'25',observedPercentChange:'25',percentageStatus:'comparable'});
 assert.equal(a.ratios.acos.delta,'-5');assert.equal(a.ratios.acos.unit,'pp');assert.equal(a.ratios.acos.percentChange,null);
 assert.equal(comparePeriods(summary('4'),summary('0'),2).metrics.spend.percentageStatus,'nonpositive_baseline');
 assert.equal(comparePeriods(summary('4'),summary('-2'),2).metrics.spend.percentChange,null);
});
test('partial, missing and cross-currency comparisons never become comparable',()=>{
 for(const [a,b,status] of [[summary('25',{days:1}),summary('10'),'incomplete_calendar'],[summary('25',{status:'partial'}),summary('10'),'partial_coverage'],[null,summary('10'),'missing_current'],[summary('25'),null,'missing_previous'],[summary(null),summary('10'),'unknown_value'],[summary('25',{currency:'USD'}),summary('10'),'currency_mismatch']]){
  const c=compareValue(a,b,{kind:'metric',key:'spend',days:2});assert.equal(c.status,status);assert.equal(c.delta,null);assert.equal(c.percentChange,null);
 }
 const partial=comparePeriods(summary('25',{status:'partial'}),summary('10'),2).metrics.spend;
 assert.equal(partial.observedDelta,'15');assert.equal(partial.observedPercentChange,'150');
 const ratio=comparePeriods(summary('25',{status:'incompatible_coverage',rate:null}),summary('10'),2).ratios.acos;
 assert.equal(ratio.status,'incompatible_coverage');assert.equal(ratio.observedDelta,null);
 const groups=compareCurrencies([summary('1',{currency:'USD'})],[summary('2')],2);
 assert.deepEqual(groups.map(g=>[g.currency,g.metrics.spend.status]),[['INR','missing_current'],['USD','missing_previous']]);
});
test('insights no-scope and invalid drill reject before SQL',async()=>{
 const args={pool:{request(){throw Error('Unexpected SQL');}},sql:{},user:{Id:'u',role:{Name:'brand_manager'},assignedSellers:[]},query:{startDate:'2026-04-01',endDate:'2026-04-02'},insightsOnly:true};
 const r=await readCanonicalReport(args);assert.equal(r.empty,true);assert.deepEqual(r.signals,[]);assert.equal(emptyReview().sampleLimit,10);
 await assert.rejects(()=>readCanonicalReport({...args,query:{...args.query,groupBy:'seller'}}),{code:'invalid_ads_filter'});
 await assert.rejects(()=>readCanonicalReport({...args,query:{...args.query,sellerId:'foreign'}}),{code:'forbidden_seller'});
 assert.equal(new Set(RULES.map(x=>x.code)).size,RULES.length);
});
