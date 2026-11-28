'use strict';
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {getPool,sql}=require('../database/db');
const {parseReport,readCanonicalReport}=require('../services/adsCanonicalReport');
const {AdsScopeError}=require('../services/adsCanonicalScope');
const {writeCanonicalWorkbook}=require('../services/adsCanonicalExport');
let active=0;
async function download(req,res){
  let dir=null,slot=false;
  try{
    parseReport(req.user,req.query);
    if(req.query.entityKey)throw new AdsScopeError('invalid_ads_filter','Export the report scope, not an individual drill-down.');
    if(active>=2)return res.status(429).json({success:false,code:'export_busy',message:'Two advertising exports are already processing. Retry shortly.'});
    active++;slot=true;
    const report=await readCanonicalReport({pool:await getPool(),sql,user:req.user,query:req.query,exportAll:true});
    if(report.rows.length!==report.total)throw Error('Export entity count mismatch');
    dir=await fs.mkdtemp(path.join(os.tmpdir(),'retailops-ads-export-'));
    const filePath=path.join(dir,'ads.xlsx');
    await writeCanonicalWorkbook({ExcelJS:require('exceljs'),filePath,report,filters:req.query});
    const stat=await fs.stat(filePath);
    if(!stat.size)throw Error('Workbook empty');
    const cleanupDir=dir;dir=null;
    res.set('Cache-Control','private, no-store');
    // Build completely before sending. Private temporary file, not /uploads.
    res.download(filePath,'ads-intelligence-'+report.period.startDate+'-'+report.period.endDate+'.xlsx',err=>{
      fs.rm(cleanupDir,{recursive:true,force:true}).catch(()=>{});
      if(err&&!res.headersSent)res.status(503).json({success:false,code:'export_failed',message:'Export download failed.'});
      if(err&&res.headersSent&&!res.writableEnded)res.destroy();
    });
  }catch(e){
    if(e instanceof AdsScopeError)return res.status(e.status).json({success:false,code:e.code,message:e.message});
    console.error('[canonical ads export]',e.message);
    if(!res.headersSent)return res.status(503).json({success:false,code:'export_failed',message:'Advertising export could not be generated.'});
  }finally{
    if(dir)await fs.rm(dir,{recursive:true,force:true}).catch(()=>{});
    if(slot)active--;
  }
}
module.exports={download};
