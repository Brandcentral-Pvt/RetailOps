'use strict';
const {isAdsSchemaError,sendAdsSchemaUnavailable}=require('../database/adsSchema');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {getPool,sql}=require('../database/db');
const {parseReport,readCanonicalReport}=require('../services/adsCanonicalReport');
const {AdsScopeError}=require('../services/adsCanonicalScope');
const {writeCompleteWorkbook}=require('../services/adsCompleteWorkbook');
const {verifyXlsx}=require('../services/exportFileIntegrity');
let active=0;
async function download(req,res){
 let dir=null,slot=false,handedOff=false,timer,controller;
 const release=()=>{if(slot){active--;slot=false;}};
 const disconnect=()=>{if(!res.writableEnded)controller?.abort();};
 try{
  const parsed=parseReport(req.user,req.query);
  if(parsed.entityKey)throw new AdsScopeError('invalid_ads_filter','Export the report scope, not an individual drill-down.');
  if(active>=2)throw new AdsScopeError('export_busy','Two advertising exports are already processing. Retry shortly.',429);
  active++;slot=true;
  controller=new AbortController();
  res.once('close',disconnect);
  timer=setTimeout(()=>controller.abort(),170000);timer.unref?.();
  dir=await fs.mkdtemp(path.join(os.tmpdir(),'retailops-ads-export-'));
  const filePath=path.join(dir,'ads.xlsx');
  const filters={...req.query};delete filters.page;delete filters.limit;
  const result=await readCanonicalReport({pool:await getPool(),sql,user:req.user,query:filters,signal:controller.signal,exportWorkbook:snapshot=>writeCompleteWorkbook({filePath,...snapshot,filters,signal:controller.signal})});
  // Database transaction is released before the ZIP/XML integrity pass.
  await verifyXlsx(filePath,{expectedSheets:result.expectedSheets,signal:controller.signal});
  if(controller.signal.aborted||res.destroyed)throw new AdsScopeError('export_interrupted','Export was interrupted. Retry with a narrower scope.',408);
  const stat=await fs.stat(filePath);if(!stat.size)throw Error('Workbook empty');
  clearTimeout(timer);
  const cleanupDir=dir;
  res.set('Cache-Control','private, no-store');
  res.download(filePath,'ads-intelligence-'+parsed.period.startDate+'-'+parsed.period.endDate+'.xlsx',err=>{
   fs.rm(cleanupDir,{recursive:true,force:true}).catch(()=>{});
   release();res.removeListener('close',disconnect);
   if(err&&!res.headersSent&&!res.destroyed)res.status(503).json({success:false,code:'export_failed',message:'Export download failed.'});
   if(err&&res.headersSent&&!res.writableEnded)res.destroy();
  });
  handedOff=true;dir=null;
 }catch(e){
  if(res.destroyed||res.headersSent)return;
  if(controller?.signal.aborted)return res.status(408).json({success:false,code:'export_interrupted',message:'Export was interrupted or exceeded its time limit. Narrow the scope and retry.'});
  if(e instanceof AdsScopeError)return res.status(e.status).json({success:false,code:e.code,message:e.message});
  if(isAdsSchemaError(e))return sendAdsSchemaUnavailable(res);
  console.error('[canonical ads complete export]',e.code||e.cause?.code||e.name||'unknown');
  return res.status(503).json({success:false,code:'export_failed',message:'Advertising export could not be generated. Retry with a narrower report scope.'});
 }finally{
  clearTimeout(timer);
  if(dir)await fs.rm(dir,{recursive:true,force:true}).catch(()=>{});
  if(!handedOff){release();res.removeListener('close',disconnect);}
 }
}
module.exports={download};
