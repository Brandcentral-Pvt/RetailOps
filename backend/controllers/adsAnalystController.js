'use strict';
const {getPool,sql}=require('../database/db');
const {AdsScopeError}=require('../services/adsCanonicalScope');
const {parseAnalystRequest,loadEvidence}=require('../services/adsAnalystEvidence');
const {reviewSnapshot,analystAvailability}=require('../services/adsAnalystReview');
const {analyze}=require('../services/adsAnalystV2');
const store=require('../services/adsAnalystReportStore');
let active=0;
const {createHash}=require('node:crypto');
async function run(req,res,useAI=false){
 let reserved=false;
 try{
  res.set('Cache-Control','private, no-store');
  parseAnalystRequest(req.user,req.body);
  if(active>=2)throw new AdsScopeError('analyst_busy','Analyst evidence is busy. Retry shortly.',429);
  active++;reserved=true;
  const owner=String(req.user.Id||req.user.id||req.user._id||'');
  let admissionReason=useAI?analystAvailability():null;
  if(useAI&&!admissionReason){
   const cache=require('../services/cacheService');
   const admitted=owner?await cache.reserveOnce(cache.key('ads-analyst-cooldown',createHash('sha256').update(owner).digest('hex')),60):null;
   if(admitted===false)throw new AdsScopeError('analyst_rate_limited','Wait one minute before requesting another AI ranking.',429);
   if(admitted!==true)admissionReason='usage_control_unavailable';
  }
  const snapshot=await loadEvidence({pool:await getPool(),sql,user:req.user,body:req.body});
  if(res.destroyed)return;
  const started=Date.now();
  let data=await reviewSnapshot(snapshot,{useAI:false});
  if(admissionReason)data.reason=admissionReason;
  else if(useAI&&!snapshot.empty){
   let result;
   try{result=await analyze(snapshot);}catch{data.reason='provider_unavailable_or_invalid';}
   if(result){
    const reportId=await store.save({pool:await getPool(),sql,user:req.user,filters:req.body.filters,snapshot,result});
    data={...data,analysis:result.analysis,products:result.products,reportId,model:result.model,mode:'ai_analysis',reason:null};
   }
  }else if(useAI)data.reason='no_actionable_evidence';
  console.info('[ads analyst outcome]',{mode:data.mode,reason:data.reason,durationMs:Date.now()-started,candidates:data.findings.length});
  if(!res.destroyed)return res.json({success:true,data});
 }catch(e){
  if(res.destroyed)return;
  if(e instanceof AdsScopeError)return res.status(e.status).json({success:false,code:e.code,message:e.message});
  console.error('[ads analyst evidence]',e.code||e.name);
  return res.status(503).json({success:false,code:'analyst_unavailable',message:'Analyst evidence could not be loaded. Retry shortly.'});
 }finally{if(reserved)active--;}
}
async function history(req,res){
 res.set('Cache-Control','private, no-store');
 try{const args={pool:await getPool(),sql,user:req.user};return res.json({success:true,data:req.params.id?await store.get({...args,id:req.params.id}):await store.list(args)});}catch(e){if(e instanceof AdsScopeError)return res.status(e.status).json({success:false,code:e.code,message:e.message});return res.status(503).json({success:false,code:'analysis_history_unavailable',message:'Analysis history unavailable.'});}
}
module.exports={evidence:(req,res)=>run(req,res),review:(req,res)=>run(req,res,true),history};
