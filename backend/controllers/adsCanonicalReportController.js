'use strict';
const {isAdsSchemaError,sendAdsSchemaUnavailable}=require('../database/adsSchema');
const {getPool,sql}=require('../database/db');
const {strictScope,AdsScopeError}=require('../services/adsCanonicalScope');
const {parseReport,readCanonicalReport,readCanonicalOptions}=require('../services/adsCanonicalReport');
function failure(res,error){
  if(error instanceof AdsScopeError)return res.status(error.status).json({success:false,code:error.code,message:error.message});
  if(isAdsSchemaError(error))return sendAdsSchemaUnavailable(res);
  console.error('[canonical ads report]',error.message);
  return res.status(503).json({success:false,code:'canonical_report_unavailable',message:'Canonical advertising analytics could not be loaded. Verify the schema and retry.'});
}
async function report(req,res){
  try{
    parseReport(req.user,req.query);
    return res.json({success:true,data:await readCanonicalReport({pool:await getPool(),sql,user:req.user,query:req.query})});
  }catch(e){return failure(res,e);}
}
async function options(req,res){
  try{
    if(Object.keys(req.query).some(k=>k!=='sellerId'))throw new AdsScopeError('invalid_ads_filter','Unsupported seller options filter.');
    strictScope(req.user,req.query.sellerId);
    return res.json({success:true,data:await readCanonicalOptions({pool:await getPool(),sql,user:req.user,sellerId:req.query.sellerId})});
  }catch(e){return failure(res,e);}
}
async function insights(req,res){
  try{
    const filters=parseReport(req.user,req.query);
    if(filters.groupBy!=='asin'||filters.entityKey)throw new AdsScopeError('invalid_ads_filter','Product review requires ASIN grouping.');
    return res.json({success:true,data:await readCanonicalReport({pool:await getPool(),sql,user:req.user,query:req.query,insightsOnly:true})});
  }catch(e){return failure(res,e);}
}
// Explicit on-demand endpoint; bound concurrent analytical snapshots per API
// process rather than turning every table pagination into a full scan.
let portfolioInFlight=0;
async function portfolio(req,res){
  let slot=false;
  try{
    const filters=parseReport(req.user,req.query);
    if(filters.groupBy!=='asin'||filters.entityKey)throw new AdsScopeError('invalid_ads_filter','Portfolio analytics requires ASIN grouping.');
    if(portfolioInFlight>=2)throw new AdsScopeError('portfolio_busy','Portfolio analysis is busy. Retry shortly.',429);
    portfolioInFlight++;slot=true;
    return res.json({success:true,data:await readCanonicalReport({pool:await getPool(),sql,user:req.user,query:req.query,portfolioOnly:true})});
  }catch(e){return failure(res,e);}finally{if(slot)portfolioInFlight--;}
}
module.exports={report,options,insights,portfolio};
