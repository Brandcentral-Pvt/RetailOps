'use strict';
const {Worker,isMainThread,parentPort,workerData}=require('node:worker_threads');
const {createHash}=require('node:crypto');
const {validateReport,AdsValidationError}=require('./adsProductContract');
const MAX_STORED_ISSUES=10000;
function parsePreview(input,{onProgress,onIssueBatch}={}){
 const bytes=Buffer.from(input),hash=createHash('sha256').update(bytes).digest('hex');
 const issues=[],keys=new Map();let count=0;
 let pending=[];
 const flush=()=>{if(pending.length){onIssueBatch(pending);pending=[];}};
 const collect=i=>{
  count++;
  if(issues.length<(onIssueBatch?100:MAX_STORED_ISSUES))issues.push(i);
  if(onIssueBatch){pending.push(i);if(pending.length>=1000)flush();}
 };
 let summary;
 try{
  summary=validateReport(bytes,{onIssue:collect,onProgress,onValidRow:r=>{if(!keys.has(r.asin))keys.set(r.asin,r);}});
 }catch(e){
  if(!(e instanceof AdsValidationError))throw e;
  collect({row:e.row,column:e.column,code:e.code,message:e.message});
  summary={schemaVersion:1,reportType:'daily',valid:false,scanComplete:false,rows:null,validRows:null,invalidRows:null,sourceFileSha256:hash};
 }
 if(onIssueBatch)flush();
 return {summary:{scanComplete:true,...summary},issues,issueCount:count,keys:summary.valid?[...keys.values()]:[],sourceFileSha256:hash};
}
function parseInWorker(input,{onProgress,onIssueBatch,timeoutMs=300000}={}){
 return new Promise((resolve,reject)=>{
  // Backpressure: the parser waits for durable storage of each error batch,
  // rather than buffering an unbounded message queue in the API process.
  const ack=onIssueBatch?new Int32Array(new SharedArrayBuffer(4)):null;
  const worker=new Worker(__filename,{workerData:{input,adsPreview:true,ack:ack?.buffer},resourceLimits:{maxOldGenerationSizeMb:384}});
  let settled=false;
  const finish=(err,value)=>{
   if(settled)return;settled=true;clearTimeout(timer);
   // Terminate also on timeout/abnormal result; ignore termination error.
   void worker.terminate().catch(()=>{});
   if(err)reject(err);else resolve(value);
  };
  const timer=setTimeout(()=>finish(Error('Ads preview parser timed out')),timeoutMs);
  worker.on('message',message=>{
   if(settled)return;
   if(message?.type==='issues'){
    if(!ack||!onIssueBatch){finish(Error('Unexpected issue batch'));return;}
    Promise.resolve().then(()=>onIssueBatch(message.issues)).then(()=>{Atomics.store(ack,0,1);Atomics.notify(ack,0);},e=>{Atomics.store(ack,0,-1);Atomics.notify(ack,0);finish(e);});
    return;
   }
   if(message?.type==='progress'){try{onProgress?.(message.rows);}catch(e){finish(e);}return;}
   if(message?.type==='result')finish(null,message.value);
   else if(message?.type==='error')finish(Error('Ads preview parser failed'));
  });
  worker.on('error',e=>finish(e));
  worker.on('exit',()=>finish(Error('Ads preview parser exited before returning a result')));
 });
}
if(!isMainThread&&workerData?.adsPreview===true){
 try{
  const ack=workerData.ack?new Int32Array(workerData.ack):null;
  const onIssueBatch=ack?issues=>{
   Atomics.store(ack,0,0);parentPort.postMessage({type:'issues',issues});
   Atomics.wait(ack,0,0,120000);
   if(Atomics.load(ack,0)!==1)throw Error('Issue batch was not durably stored');
  }:undefined;
  const value=parsePreview(workerData.input,{onIssueBatch,onProgress:rows=>parentPort.postMessage({type:'progress',rows})});parentPort.postMessage({type:'result',value});
 }
 catch{parentPort.postMessage({type:'error'});}
}
module.exports={parsePreview,parseInWorker,MAX_STORED_ISSUES};
