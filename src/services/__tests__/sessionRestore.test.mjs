import test from 'node:test';
import assert from 'node:assert/strict';
import {restoreSession} from '../sessionRestore.mjs';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
test('transient gateway and network failure recover',async()=>{
 let n=0;
 const result=await restoreSession({url:'/api/auth/me',delays:[0,0],fetcher:async(_url,opts)=>{
  assert.equal(opts.credentials,'include');assert.equal(opts.method,'GET');
  if(++n===1)return new Response('Bad Gateway',{status:502});
  if(n===2)throw Error('network');
  return json({success:true,data:{Id:'u1'}});
 }});
 assert.equal(n,3);assert.deepEqual(result,{status:'authenticated',user:{Id:'u1'}});
});
test('401 immediately reports anonymous; persistent outage is distinct',async()=>{
 let n=0;
 const anonymous=await restoreSession({url:'/api/auth/me',delays:[0,0],fetcher:async()=>{n++;return json({},401);}});
 assert.deepEqual(anonymous,{status:'anonymous'});assert.equal(n,1);
 n=0;
 const unavailable=await restoreSession({url:'/api/auth/me',delays:[0,0],fetcher:async()=>{n++;return json({},503);}});
 assert.deepEqual(unavailable,{status:'unavailable',httpStatus:503});assert.equal(n,3);
});
test('malformed success and access denial cannot authenticate',async()=>{
 for(const response of [json({success:true,data:{}}),json({},403)]){
  const r=await restoreSession({url:'/api/auth/me',delays:[],fetcher:async()=>response});
  assert.equal(r.status,'unavailable');
 }
});
test('session cancellation stops retries',async()=>{
 const controller=new AbortController();controller.abort();
 await assert.rejects(()=>restoreSession({url:'/api/auth/me',signal:controller.signal,fetcher:async()=>{throw Error('unexpected');}}),{name:'AbortError'});
});
