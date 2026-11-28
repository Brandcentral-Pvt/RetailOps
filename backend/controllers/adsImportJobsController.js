'use strict';
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {getPool,sql}=require('../database/db');
const {AdsScopeError}=require('../services/adsCanonicalScope');
const {isAdsSchemaError}=require('../database/adsSchema');
const service=require('../services/adsImportJobs');
const {writeIssueReport}=require('../services/adsImportIssueReport');
const failure=(res,e)=>{
 if(e instanceof AdsScopeError)return res.status(e.status).json({success:false,code:e.code,message:e.message});
 if(isAdsSchemaError(e))return res.status(503).json({success:false,code:'ADS_IMPORT_SCHEMA_NOT_READY',message:'Ads import job schema is not ready. Verify migrations 098, 099 and 101.'});
 console.error('[ads import jobs]',e.message);
 return res.status(503).json({success:false,code:'ads_import_unavailable',message:'Import service unavailable. Reopen history to verify the job status before retrying.'});
};
const args=async req=>({pool:await getPool(),sql,user:req.user,id:req.params.id});
let previews=0,exportsInFlight=0;
async function preview(req,res){
 const file=req.file;let slot=false;
 try{
  if(!file||req.body?.reportType!=='daily')throw new AdsScopeError('invalid_upload','Select a daily v1 CSV.',400);
  if(previews>=2)throw new AdsScopeError('preview_busy','Two reports are validating. Retry shortly.',429);
  previews++;slot=true;
  const data=await service.createPreview({...await args(req),sellerId:req.body.sellerId,input:await fs.readFile(file.path),fileName:file.originalname});
  return res.status(201).json({success:true,data});
 }catch(e){return failure(res,e);}
 finally{if(slot)previews--;if(file?.path)await fs.unlink(file.path).catch(()=>{});}
}
async function list(req,res){try{
 const page=req.query.page===undefined?1:Number(req.query.page),limit=req.query.limit===undefined?25:Number(req.query.limit);
 return res.json({success:true,data:await service.listJobs({...await args(req),page,limit})});
}catch(e){return failure(res,e);}}
async function get(req,res){try{
 const data=await service.getJob(await args(req));
 return data?res.json({success:true,data}):res.status(404).json({success:false,code:'job_not_found',message:'Import not found.'});
}catch(e){return failure(res,e);}}
async function confirm(req,res){try{
 const data=await service.confirmJob(await args(req));
 const pending=['QUEUED','PROCESSING'].includes(data.status),completed=data.status==='COMPLETED';
 return res.status(pending?202:completed?200:409).json({success:pending||completed,data,message:pending?'Import queued for background processing.':completed?'Import committed and reconciled.':data.result?.message||'Import could not be confirmed.'});
}catch(e){return failure(res,e);}}
async function cancel(req,res){try{return res.json({success:true,data:await service.cancelJob(await args(req))});}catch(e){return failure(res,e);}}
async function issues(req,res){let dir,slot=false;try{
 if(exportsInFlight>=2)throw new AdsScopeError('issue_export_busy','Error exports are busy. Retry shortly.',429);
 exportsInFlight++;slot=true;
 const report=await service.getIssues(await args(req));
 if(!report.issues.length)throw new AdsScopeError('no_issues','This import has no validation errors.',409);
 dir=await fs.mkdtemp(path.join(os.tmpdir(),'retailops-ads-issues-'));const filePath=path.join(dir,'errors.xlsx');
 await writeIssueReport({filePath,...report});
 const cleanup=dir;dir=null;res.set('Cache-Control','private, no-store');
 res.download(filePath,'ads-import-'+report.job.id+'-errors.xlsx',err=>{fs.rm(cleanup,{recursive:true,force:true}).catch(()=>{});if(err&&!res.headersSent)failure(res,err);});
}catch(e){if(!res.headersSent)return failure(res,e);}finally{if(dir)await fs.rm(dir,{recursive:true,force:true}).catch(()=>{});if(slot)exportsInFlight--;}}
module.exports={preview,list,get,confirm,cancel,issues};
