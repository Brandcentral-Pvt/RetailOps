'use strict';
const {getPool,sql}=require('../database/db');
const {AdsScopeError}=require('../services/adsCanonicalScope');
const {parseAnalystRequest,loadEvidence}=require('../services/adsAnalystEvidence');
let active=0;
async function evidence(req,res){
 let reserved=false;
 try{
  res.set('Cache-Control','private, no-store');
  parseAnalystRequest(req.user,req.body);
  if(active>=2)throw new AdsScopeError('analyst_busy','Analyst evidence is busy. Retry shortly.',429);
  active++;reserved=true;
  const data=await loadEvidence({pool:await getPool(),sql,user:req.user,body:req.body});
  if(!res.destroyed)return res.json({success:true,data});
 }catch(e){
  if(res.destroyed)return;
  if(e instanceof AdsScopeError)return res.status(e.status).json({success:false,code:e.code,message:e.message});
  console.error('[ads analyst evidence]',e.code||e.name);
  return res.status(503).json({success:false,code:'analyst_unavailable',message:'Analyst evidence could not be loaded. Retry shortly.'});
 }finally{if(reserved)active--;}
}
module.exports={evidence};
