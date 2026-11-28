'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createReportCache,identity}=require('../services/adsReportCache');
const {parseReport}=require('../services/adsCanonicalReport');
const user={Id:'u1',role:{Name:'brand_manager'},assignedSellers:['s1','s2'],permissions:['adsreport_view']};
const query={startDate:'2026-04-01',endDate:'2026-04-30',sellerId:'s1'};
function fixture(){
 let revision='r1',calls=0,enabled=true,fail=false;
 const entries=new Map(),cache={key:(...parts)=>parts.join(':'),isEnabled:async()=>enabled,get:async k=>{if(fail)throw Error('redis down');return entries.get(k);},set:async(k,v,ttl)=>{assert.equal(ttl,60);entries.set(k,structuredClone(v));}};
 const run=createReportCache({cache,read:async()=>revision});
 const read=(extra={})=>run({pool:{},user,parsed:parseReport(user,query),mode:'report',load:async()=>({current:[++calls],previous:[],rows:[],series:[]}),...extra});
 return {read,entries,setRevision:v=>revision=v,disable:()=>enabled=false,fail:()=>fail=true,calls:()=>calls};
}
test('same authorized query hits; revision, filter, user and permissions invalidate',async()=>{
 const f=fixture();assert.equal((await f.read()).status,'miss');assert.equal((await f.read()).status,'hit');assert.equal(f.calls(),1);
 f.setRevision('r2');assert.equal((await f.read()).status,'miss');assert.equal(f.calls(),2);
 assert.equal((await f.read({parsed:parseReport(user,{...query,page:'2'})})).status,'miss');
 const other={...user,Id:'u2'};assert.equal((await f.read({user:other,parsed:parseReport(other,query)})).status,'miss');
 assert.equal((await f.read({user:{...user,permissions:['adsreport_view','adsreport_export']}})).status,'miss');
 assert.throws(()=>parseReport({...user,assignedSellers:['s2']},query),{code:'forbidden_seller'});
});
test('refresh forces live read; changing revision during load is not cached',async()=>{
 const f=fixture();await f.read();assert.equal((await f.read({refresh:true})).status,'refresh');assert.equal(f.calls(),2);
 f.setRevision('r2');const result=await f.read({load:async()=>{f.setRevision('r3');return {current:[3],previous:[],rows:[],series:[]};}});
 assert.equal(result.status,'revision-changed');assert.equal((await f.read()).status,'miss');
});
test('missing revision, unavailable Redis and large windows fall back to live SQL',async()=>{
 const f=fixture();await f.read();f.setRevision(null);assert.equal((await f.read()).status,'no-revision');
 f.disable();assert.equal((await f.read()).status,'bypass');
 const g=fixture();g.fail();assert.equal((await g.read()).status,'miss');
 const wide=parseReport(user,{...query,endDate:'2026-08-01'});assert.equal(identity(user,wide,'report'),null);
 assert.equal((await g.read({mode:'insights'})).status,'bypass');
});
