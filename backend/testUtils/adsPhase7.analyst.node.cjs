'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {parseAnalystRequest,buildEvidence}=require('../services/adsAnalystEvidence');
const {reviewSnapshot,validateSelection}=require('../services/adsAnalystReview');
const user={Id:'u1',role:{Name:'brand_manager'},assignedSellers:['s1'],permissions:['adsreport_view']};
const filters={sellerId:'s1',startDate:'2026-04-01',endDate:'2026-04-30'};
test('analyst accepts only authorized report filters, bounded date range and no injected evidence',()=>{
 assert.equal(parseAnalystRequest(user,{filters}).groupBy,'asin');
 assert.throws(()=>parseAnalystRequest(user,{filters:{...filters,sellerId:'s2'}}),{code:'forbidden_seller'});
 assert.throws(()=>parseAnalystRequest(user,{filters,evidence:[]}),{code:'invalid_analyst_request'});
 assert.throws(()=>parseAnalystRequest(user,{filters:{...filters,groupBy:'seller'}}),{code:'invalid_analyst_request'});
 assert.throws(()=>parseAnalystRequest(user,{filters:{...filters,endDate:'2026-08-01'}}),{code:'analyst_range_too_large'});
});
const snapshot=()=>buildEvidence({period:{days:30,startDate:'2026-04-01',endDate:'2026-04-30'},empty:false,current:[{currency:'INR',coveredDays:30,totals:{spend:'5000',sales:'20000',totalSales:'50000'},coverage:{spend:{status:'complete'},sales:{status:'complete'},totalSales:{status:'complete'}},ratios:{tacos:{value:'10',status:'complete'},acos:{value:'25',status:'complete'},roas:{value:'4',status:'complete'}}}],previous:[],review:{signals:[{code:'spend_zero_sales',currency:'INR',count:'1',label:'Spend without sales',action:'Review attribution.',items:[{sellerId:'private-seller',sellerName:'Private seller',entityKey:'B000000001',marketplace:'amazon.in',currency:'INR',spend:'100',sales:'0'}]}]}});
test('evidence preserves exact canonical ratios and consolidates gaps',()=>{
 const data=snapshot();assert.equal(data.evidence.find(e=>e.metric==='tacos').value,'10');
 assert.equal(data.findings.filter(f=>f.code==='coverage_review').length,1);
 assert.equal(data.findings.find(f=>f.code==='spend_zero_sales').products[0].key,JSON.stringify(['private-seller','amazon.in','INR','B000000001']));
});
test('AI receives no seller identifiers and can only select approved findings',async()=>{
 const data=snapshot(),f=data.findings.find(f=>f.code==='spend_zero_sales');
 const out=await reviewSnapshot(data,{enabled:true,useAI:true,rank:async messages=>{const serialized=JSON.stringify(messages);assert.ok(!serialized.includes('private-seller'));assert.ok(!serialized.includes('B000000001'));return JSON.stringify({findingIds:[f.id]});}});
 assert.equal(out.mode,'ai_ranked');assert.deepEqual(out.recommendations,[f]);
 for(const raw of ['{}','{"findingIds":["fake"]}','{"findingIds":["'+f.id+'","'+f.id+'"]}','{"findingIds":["'+f.id+'"],"sales":999}'])assert.throws(()=>validateSelection(raw,data.findings));
 for(const rank of [async()=>'{bad',async()=>{throw Error('provider unavailable');}])assert.equal((await reviewSnapshot(data,{enabled:true,useAI:true,rank})).mode,'rules');
 assert.equal((await reviewSnapshot(data,{enabled:false,useAI:true,rank:async()=>{throw Error('must not call');}})).reason,'ai_disabled');
});

test('analyst activation distinguishes explicit opt-in and configured provider',()=>{
 const {analystAvailability}=require('../services/adsAnalystReview');
 assert.equal(analystAvailability({}),'ai_disabled');
 assert.equal(analystAvailability({ADS_ANALYST_AI_ENABLED:'false',NVIDIA_NIM_API_KEY:'test'}),'ai_disabled');
 assert.equal(analystAvailability({ADS_ANALYST_AI_ENABLED:'true',NIM_API_KEY:'legacy'}),'provider_not_configured');
 assert.equal(analystAvailability({ADS_ANALYST_AI_ENABLED:'true',NVIDIA_NIM_API_KEY:'  '}),'provider_not_configured');
 assert.equal(analystAvailability({ADS_ANALYST_AI_ENABLED:'true',NVIDIA_NIM_API_KEY:'test'}),null);
});
