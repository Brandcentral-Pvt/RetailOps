'use strict';
const {isAdsSchemaError,sendAdsSchemaUnavailable}=require('../database/adsSchema');
const {getPool,sql}=require('../database/db');
const {readCanonicalSummary,validateWindow}=require('../services/adsCanonicalMetrics');
const {strictScope,AdsScopeError}=require('../services/adsCanonicalScope');
async function getSummary(req,res){
  try{
    const {sellerId,startDate,endDate}=req.query;
    strictScope(req.user,sellerId);validateWindow(startDate,endDate);
    const data=await readCanonicalSummary({pool:await getPool(),sql,user:req.user,sellerId,startDate,endDate});
    return res.json({success:true,data});
  }catch(e){
    if(e instanceof AdsScopeError)return res.status(e.status).json({success:false,code:e.code,message:e.message});
    if(isAdsSchemaError(e))return sendAdsSchemaUnavailable(res);
    return res.status(503).json({success:false,code:'canonical_summary_unavailable',message:'Canonical Ads summary is unavailable. Verify migration 098 and retry.'});
  }
}
module.exports={getSummary};
