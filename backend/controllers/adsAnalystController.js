'use strict';
const {getPool,sql}=require('../database/db');
const {AdsScopeError}=require('../services/adsCanonicalScope');
const {parseAnalystRequest,loadEvidence}=require('../services/adsAnalystEvidence');
const {reviewSnapshot}=require('../services/adsAnalystReview');
let active=0;
const lastAI=new Map();
async function run(req,res,useAI=false){
 let reserved=false;
 try{
  res.set('Cache-Control','private, no-store');
  parseAnalystRequest(req.user,req.body);
  if(active>=2)throw new AdsScopeError('analyst_busy','Analyst evidence is busy. Retry shortly.',429);
  active++;reserved=true;
  const owner=String(req.user.Id||req.user.id||req.user._id||'');
  if(useAI&&process.env.ADS_ANALYST_AI_ENABLED==='true'){
   const now=Date.now();for(const [id,at] of lastAI)if(now-at>=60000)lastAI.delete(id);
   if(lastAI.has(owner)||lastAI.size>=1000)throw new AdsScopeError('analyst_rate_limited','Wait one minute before requesting another AI ranking.',429);
   lastAI.set(owner,now);
  }
  const snapshot=await loadEvidence({pool:await getPool(),sql,user:req.user,body:req.body});
  if(res.destroyed)return;
  const data=await reviewSnapshot(snapshot,{useAI});
  if(!res.destroyed)return res.json({success:true,data});
 }catch(e){
  if(res.destroyed)return;
  if(e instanceof AdsScopeError)return res.status(e.status).json({success:false,code:e.code,message:e.message});
  console.error('[ads analyst evidence]',e.code||e.name);
  return res.status(503).json({success:false,code:'analyst_unavailable',message:'Analyst evidence could not be loaded. Retry shortly.'});
 }finally{if(reserved)active--;}
}
module.exports={evidence:(req,res)=>run(req,res),review:(req,res)=>run(req,res,true)};
