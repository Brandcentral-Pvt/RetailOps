'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {issueConfirmation,verifyConfirmation,importsEnabled,TTL_MS}=require('../services/adsImportConfirmation');
const {chooseTargets,targetResult}=require('../services/adsCanonicalTargets');
const {numericCell}=require('../services/adsCanonicalExport');
test('confirmation is signed, actor/seller/hash bound, expiring, and tamper resistant',()=>{
 const saved=process.env.JWT_SECRET;process.env.JWT_SECRET='disposable-confirmation-unit-test';
 try{
 const user={Id:'u1'},hash='a'.repeat(64),now=1700000000000;
 const token=issueConfirmation({user,sellerId:'s1',marketplace:'amazon.in',currency:'INR',sourceFileSha256:hash,now});
 const args={token,user,sellerId:'s1',sourceFileSha256:hash,now};
 assert.deepEqual(verifyConfirmation(args),{marketplace:'amazon.in',currency:'INR'});
 for(const bad of [{sellerId:'s2'},{user:{Id:'u2'}},{sourceFileSha256:'b'.repeat(64)},{now:now+TTL_MS},{token:token.slice(0,-2)+'XX'}])assert.throws(()=>verifyConfirmation({...args,...bad}),{code:'invalid_confirmation'});
 }finally{if(saved===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=saved;}
});
test('target precedence, duplicate rejection and coverage-aware comparison',()=>{
 const common={sellerId:'s1',sellerName:'One',catalogMarketplace:'amazon.in',month:'2026-04',goalType:'ADS'};
 const chosen=chooseTargets([{...common,targetType:'YEARLY',target:'200'},{...common,targetType:'MONTHLY',target:'100'}])[0];
 assert.equal(chosen.target,'100');
 assert.equal(chooseTargets([chosen,chosen])[0].target,null);
 const actual={totals:{spend:'25'},coverage:{spend:{status:'complete'}},coveredDays:30};
 const period={startDate:'2026-04-01',endDate:'2026-04-30'};
 assert.equal(targetResult(chosen,actual,period).attainmentPct,'25');
 assert.equal(targetResult(chosen,{...actual,coveredDays:1},period).attainmentPct,null);
 assert.equal(targetResult(chosen,actual,{...period,endDate:'2026-04-29'}).status,'partial_month');
 assert.equal(targetResult(chosen,{...actual,coverage:{spend:{status:'partial'}}},period).attainmentPct,null);
});
test('export preserves null, numeric ratios and values beyond Excel precision',()=>{
 assert.equal(numericCell(null).value,null);assert.equal(numericCell('0').value,0);
 assert.equal(numericCell('12.5',true).value,.125);assert.equal(numericCell('-1.25').value,-1.25);
 assert.equal(numericCell('123456789012345678.123456789').value,'123456789012345678.123456789');
 assert.throws(()=>numericCell('=1+2'));
});

// Missing or mismatched populations never become zero in dashboard consumers.
test('dashboard consumer aggregates preserve unknown metrics and matched ratios',()=>{
 const {summarize}=require('../services/adsConsumerMetrics');
 const unknown=summarize([]); assert.equal(unknown.totals.AdSpend,null);assert.equal(unknown.ratios.tacos,null);
 const actual=summarize([{FactRows:2,AdSpend:20,AdSpendCount:2,AdSales:100,AdSalesCount:1,acosPairCount:1,TotalSales:250,TotalSalesCount:2,tacosPairCount:2}]);
 assert.equal(actual.ratios.acos,null);assert.equal(actual.ratios.tacos,8);assert.equal(actual.coverage.AdSales.status,'partial');
});

test('Ads confirmation defaults on but honors explicit pause and rejects invalid configuration',()=>{
 assert.equal(importsEnabled({}),true);
 assert.equal(importsEnabled({ADS_CANONICAL_IMPORT_ENABLED:'true'}),true);
 assert.equal(importsEnabled({ADS_CANONICAL_IMPORT_ENABLED:' TRUE '}),true);
 for(const value of ['false','FALSE','0','','yes'])assert.equal(importsEnabled({ADS_CANONICAL_IMPORT_ENABLED:value}),false);
});
