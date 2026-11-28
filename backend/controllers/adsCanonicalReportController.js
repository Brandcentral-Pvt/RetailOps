'use strict';
const {performance}=require('node:perf_hooks');
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
const {createReportCache}=require('../services/adsReportCache');
const cachedRead=createReportCache();
// Coalesce only concurrent identical reads; completed data is revision-gated.
const flights=new Map();
const MAX_READS=6;
function requestKey(user,parsed,mode){
 const scope={unrestricted:parsed.scope.unrestricted,ids:[...parsed.scope.sellerIds].sort()};
 return JSON.stringify([user.Id||user.id||user._id,mode,{...parsed,scope}]);
}
async function runRead(req,res,mode){
 const started=performance.now();
 try{
  const {refresh,...query}=req.query;
  if(refresh!==undefined&&refresh!=='true')throw new AdsScopeError('invalid_ads_filter','Invalid refresh flag.');
  const parsed=parseReport(req.user,query);
  if(mode==='overview'&&parsed.entityKey)throw new AdsScopeError('invalid_ads_filter','Overview requires report scope.');
  if(mode==='insights'&&(parsed.groupBy!=='asin'||parsed.entityKey))throw new AdsScopeError('invalid_ads_filter','Product review requires ASIN grouping.');
  res.set('Cache-Control','private, no-store');
  const key=requestKey(req.user,parsed,mode)+':'+(refresh==='true');
  let pending=flights.get(key);
  if(!pending){
   if(flights.size>=MAX_READS)throw new AdsScopeError('report_busy','Advertising reports are busy. Retry shortly.',429);
   pending=(async()=>{const pool=await getPool();return cachedRead({pool,user:req.user,parsed,mode,refresh:refresh==='true',load:()=>readCanonicalReport({pool,sql,user:req.user,query,overviewOnly:mode==='overview',insightsOnly:mode==='insights'})});})();
   flights.set(key,pending);
   const clear=()=>{if(flights.get(key)===pending)flights.delete(key);};
   pending.then(clear,clear);
  }
  const {data,status}=await pending;
  if(!res.destroyed){res.set('X-Ads-Cache',status);res.set('Server-Timing','ads_report;dur='+Math.round(performance.now()-started));return res.json({success:true,data});}
 }catch(e){if(!res.destroyed)return failure(res,e);}
}
const report=(req,res)=>runRead(req,res,'report');
const overview=(req,res)=>runRead(req,res,'overview');
async function options(req,res){
  try{
    if(Object.keys(req.query).some(k=>k!=='sellerId'))throw new AdsScopeError('invalid_ads_filter','Unsupported seller options filter.');
    strictScope(req.user,req.query.sellerId);
    return res.json({success:true,data:await readCanonicalOptions({pool:await getPool(),sql,user:req.user,sellerId:req.query.sellerId})});
  }catch(e){return failure(res,e);}
}
const insights=(req,res)=>runRead(req,res,'insights');
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
let reconciliationInFlight=0;
async function reconciliation(req,res){
 let slot=false;
 try{
  const filters=parseReport(req.user,req.query);
  if(filters.groupBy!=='asin'||filters.entityKey)throw new AdsScopeError('invalid_ads_filter','Reconciliation requires ASIN grouping.');
  if(reconciliationInFlight>=1)throw new AdsScopeError('reconciliation_busy','Analytics reconciliation is busy. Retry shortly.',429);
  reconciliationInFlight++;slot=true;
  res.set('Cache-Control','private, no-store');
  return res.json({success:true,data:await readCanonicalReport({pool:await getPool(),sql,user:req.user,query:req.query,reconciliationOnly:true})});
 }catch(e){return failure(res,e);}finally{if(slot)reconciliationInFlight--;}
}
module.exports={report,overview,options,insights,portfolio,reconciliation};
