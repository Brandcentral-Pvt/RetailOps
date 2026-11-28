'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {parseReport,readCanonicalReport}=require('../services/adsCanonicalReport');
const user={Id:'u',role:{Name:'brand_manager'},assignedSellers:['s1','s2']};
const query={startDate:'2026-04-01',endDate:'2026-04-30'};
test('strict bounded filters, comparable prior dates and allowlisted sort',()=>{
 const p=parseReport(user,{...query,sellerId:'s1,s2',groupBy:'parent',granularity:'month',page:'4',limit:'25'});
 assert.equal(p.period.prevStart,'2026-03-02');assert.equal(p.period.prevEnd,'2026-03-31');
 assert.equal(p.page,4);assert.equal(p.limit,25);
 for(const q of [{sellerId:'s1,foreign'},{sortBy:'spend;DROP'},{reportType:'monthly'},{limit:'101'},{page:'0'},{currency:'inr'},{unknown:'yes'},{startDate:'2026-02-30'},{entityKey:'B000000001'}]){
  assert.throws(()=>parseReport(user,{...query,...q}));
 }
 assert.equal(parseReport(user,{...query,sellerId:'s1',marketplace:'amazon.in',currency:'INR',entityKey:'B000000001'}).entityKey,'B000000001');
});
test('empty and unauthorized scope does not touch SQL',async()=>{
 const pool={request(){throw Error('SQL should not run');}};
 const data=await readCanonicalReport({pool,sql:{},user:{...user,assignedSellers:[]},query});
 assert.equal(data.empty,true);assert.equal(data.total,0);
 await assert.rejects(()=>readCanonicalReport({pool,sql:{},user,query:{...query,sellerId:'s1,foreign'}}),{code:'forbidden_seller'});
});
test('canonical routes use view permission',()=>{
 const s=require('node:fs').readFileSync(require('node:path').join(__dirname,'../routes/adsRoutes.js'),'utf8');
 assert.match(s,/router\.get\('\/canonical-report', authenticate, canViewAds, canonicalReport\.report\)/);
 assert.match(s,/router\.get\('\/canonical-options', authenticate, canViewAds, canonicalReport\.options\)/);
});
