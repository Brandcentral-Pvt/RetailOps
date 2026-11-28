'use strict';
const {isAdsSchemaError,sendAdsSchemaUnavailable}=require('../database/adsSchema');
const {getPool,sql}=require('../database/db');
const {strictScope,AdsScopeError}=require('../services/adsCanonicalScope');
const {validateWindow}=require('../services/adsCanonicalMetrics');
const {readCanonicalTargets}=require('../services/adsCanonicalTargets');
const {readBudgetIntelligence}=require('../services/adsBudgetIntelligence');
async function targets(req,res){
  try{
    strictScope(req.user,req.query.sellerId);validateWindow(req.query.startDate,req.query.endDate);
    return res.json({success:true,data:await readCanonicalTargets({pool:await getPool(),sql,user:req.user,query:req.query})});
  }catch(e){
    if(e instanceof AdsScopeError)return res.status(e.status).json({success:false,code:e.code,message:e.message});
    if(isAdsSchemaError(e))return sendAdsSchemaUnavailable(res);
    console.error('[canonical ads targets]',e.message);
    return res.status(503).json({success:false,code:'targets_unavailable',message:'Advertising targets could not be loaded.'});
  }
}
let inFlight=0;
async function budget(req,res){
 let slot=false;
 try{
  strictScope(req.user,req.query.sellerId);validateWindow(req.query.startDate,req.query.endDate);
  if(inFlight>=2)throw new AdsScopeError('budget_busy','Budget intelligence is busy. Retry shortly.',429);
  inFlight++;slot=true;
  return res.json({success:true,data:await readBudgetIntelligence({pool:await getPool(),sql,user:req.user,query:req.query})});
 }catch(e){
  if(e instanceof AdsScopeError)return res.status(e.status).json({success:false,code:e.code,message:e.message});
  if(isAdsSchemaError(e))return sendAdsSchemaUnavailable(res);
  console.error('[canonical ads budget]',e.code||e.name||'unknown');
  return res.status(503).json({success:false,code:'budget_unavailable',message:'Budget intelligence could not be loaded. Retry after verifying target configuration.'});
 }finally{if(slot)inFlight--;}
}
module.exports={targets,budget};
