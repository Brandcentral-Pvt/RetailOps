'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const db=require.resolve('../database/db');
require.cache[db]={id:db,filename:db,loaded:true,exports:{sql:{VarChar:()=>{},NVarChar:()=>{}}}};
const {resolveDashboardScope,intersectScope,managerSelection,options,publicScope}=require('../services/dashboardScope');
const {strictScope}=require('../services/adsCanonicalScope');
const sql={VarChar:()=>{},NVarChar:()=>{}};
const admin={Id:'a',role:{name:'admin'},assignedSellers:[]};
const manager={Id:'m',role:{name:'brand_manager'},assignedSellers:['s1','s2']};
function fakePool(rows){
 const calls=[];
 return {calls,request(){const params={};return {input(k,_t,v){params[k]=v;return this;},async query(query){calls.push({query,params});return {recordset:typeof rows==='function'?rows(query):rows};}}}};
}
test('manager selection validates internal identifiers and rejects sentinels mixed with IDs',()=>{
 assert.equal(managerSelection('all'),null);assert.equal(managerSelection('m1'),'m1');
 for(const value of ['',' ',['m1'],'m1,m2','*','m1 m2','x'.repeat(51)])assert.throws(()=>managerSelection(value));
});
test('server scope intersects actor assignment, explicit seller and manager mapping',async()=>{
 const pool=fakePool([{SellerId:'s2'},{SellerId:'s3'},{SellerId:'s2'}]);
 const read=(user,sellerId)=>resolveDashboardScope({pool,sql,user,sellerId,managerId:'m1'});
 assert.deepEqual(publicScope(await read(manager)),{sellerIds:['s2'],unrestricted:false,empty:false,managerId:'m1'});
 assert.deepEqual((await read(manager,'s1')).sellerIds,[]);
 assert.equal((await read(admin,'s1')).empty,true);
 assert.deepEqual((await read(admin)).sellerIds,['s2','s3']);
 assert.ok(pool.calls.every(c=>c.params.managerId==='m1'&&c.query.includes('dbo.UserSellers')&&c.query.includes('u.IsActive=1')));
 const n=pool.calls.length;
 await assert.rejects(()=>read(manager,'s3'),e=>e.status===403);
 assert.equal(pool.calls.length,n);
});
test('unassigned and empty manager mappings fail closed, not unrestricted',async()=>{
 const pool=fakePool([]);
 const s=await resolveDashboardScope({pool,sql,user:admin,managerId:'nobody'});
 assert.equal(s.empty,true);assert.equal(s.unrestricted,false);assert.deepEqual(s.sellerIds,[]);
 assert.equal((await resolveDashboardScope({pool,sql,user:admin})).unrestricted,true);
 const n=pool.calls.length;
 assert.equal((await resolveDashboardScope({pool,sql,user:{...manager,assignedSellers:[]},managerId:'m1'})).empty,true);
 assert.equal(pool.calls.length,n);
});
test('scope capacity and invalid IDs fail closed',()=>{
 const base=strictScope(admin);
 assert.throws(()=>intersectScope(base,Array.from({length:1001},(_,i)=>'s'+i)),e=>e.status===422);
 assert.deepEqual(intersectScope(base,['s1','',null,'s1']).sellerIds,['s1']);
});
test('manager and seller options are scoped in SQL; names only, no emails',async()=>{
 const pool=fakePool(q=>q.includes('dbo.Sellers s')?[{id:'s1',name:'One'}]:[{id:'m1',name:'Manager'}]);
 const r=await options({pool,sql,user:manager});
 assert.deepEqual(r,{sellers:[{id:'s1',name:'One'}],managers:[{id:'m1',name:'Manager'}]});
 assert.equal(pool.calls[0].params.optionSeller_0,'s1');
 assert.equal(pool.calls[1].params.optionManagerSeller_1,'s2');
 assert.match(pool.calls[1].query,/EXISTS/);
 assert.doesNotMatch(pool.calls[1].query,/Email/);
 const n=pool.calls.length;
 assert.deepEqual(await options({pool,sql,user:{...manager,assignedSellers:[]}}),{sellers:[],managers:[]});
 assert.equal(pool.calls.length,n);
});
