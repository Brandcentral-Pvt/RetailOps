'use strict';
const {isAdsSchemaError,sendAdsSchemaUnavailable}=require('../database/adsSchema');
const {getPool,sql}=require('../database/db');
const {strictScope,AdsScopeError}=require('../services/adsCanonicalScope');
const {validateWindow}=require('../services/adsCanonicalMetrics');
const {readCanonicalTargets}=require('../services/adsCanonicalTargets');
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
module.exports={targets};
