'use strict';
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {getPool,sql}=require('../database/db');
const {AdsScopeError}=require('../services/adsCanonicalScope');
function createReportExportController(jobs,filename){
const {XLSX_MIME}=require('../services/exportFileIntegrity');
function failure(res,e){
 if(res.destroyed||res.headersSent)return;
 if(e instanceof AdsScopeError)return res.status(e.status).json({success:false,code:e.code,message:e.message});
 console.error('[report export jobs API]',e.code||e.name);
 return res.status(503).json({success:false,code:'export_jobs_unavailable',message:'Export jobs are temporarily unavailable. Retry shortly.'});
}
const handler=(method,extra,status=200)=>async(req,res)=>{
 try{
  res.set('Cache-Control','private, no-store');
  const data=await jobs[method]({pool:await getPool(),sql,user:req.user,...extra(req)});
  return res.status(status).json({success:true,data});
 }catch(e){return failure(res,e);}
};
const create=handler('createJob',req=>({body:req.body}),202);
const list=handler('listJobs',req=>({page:req.query.page,limit:req.query.limit,status:req.query.status,search:req.query.search}));
const get=handler('getJob',req=>({id:req.params.id}));
const retry=handler('mutate',req=>({id:req.params.id,action:'retry'}),202);
const cancel=handler('mutate',req=>({id:req.params.id,action:'cancel'}));
let downloads=0;
async function download(req,res){
 let dir,handedOff=false,slot=false;
 const controller=new AbortController();const disconnect=()=>{if(!res.writableEnded)controller.abort();};res.once('close',disconnect);
 const cleanup=async()=>{if(slot){downloads--;slot=false;}if(dir)await fs.rm(dir,{recursive:true,force:true}).catch(()=>{});};
 try{
  if(downloads>=2)throw new AdsScopeError('download_busy','Export downloads are busy. Retry shortly.',429);
  downloads++;slot=true;
  dir=await fs.mkdtemp(path.join(os.tmpdir(),'retailops-report-download-'));
  const filePath=path.join(dir,'artifact');
  const data=await jobs.spoolDownload({pool:await getPool(),sql,user:req.user,id:req.params.id,filePath,signal:controller.signal});
  if(res.destroyed)return;
  res.set('Cache-Control','private, no-store');
  res.type(data.format==='xlsx'?XLSX_MIME:'text/csv');
  res.set('X-Content-Type-Options','nosniff');
  res.set('X-Export-File-Size',String(data.bytes));
  res.download(filePath,filename(data),{acceptRanges:false},err=>{
   res.removeListener('close',disconnect);void cleanup();if(err&&!res.headersSent&&!res.destroyed)failure(res,err);
   else if(err&&!res.writableEnded&&!res.destroyed)res.destroy();
  });
  handedOff=true;
 }catch(e){return failure(res,e);}finally{if(!handedOff){res.removeListener('close',disconnect);await cleanup();}}
}
return {create,list,get,retry,cancel,download};
}
module.exports={createReportExportController};
