const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { writeIssueReport, reportFileName } = require('../services/gmsImportIssueReport');
const service = require('../services/gmsImportService');
const { isGmsSchemaError, sendGmsSchemaUnavailable } = require('../database/gmsSchema');
const owner = req => String(req.user.id || req.user.Id || req.user._id);
function respondError(res, err) {
  console.error('GMS import request failed:', err.message);
  if (isGmsSchemaError(err)) return sendGmsSchemaUnavailable(res);
  if (err.status === 403 || err.status === 429) return res.status(err.status).json({success:false,message:err.message});
  return res.status(500).json({success:false,message:'GMS import service unavailable. Retry after checking service and migration status.'});
}
exports.preview = async (req,res) => {
  try {
    if (!req.file) return res.status(400).json({success:false,message:'A report file is required'});
    const data = await service.createPreview(req.user,req.file);
    res.status(201).json({success:true,data});
  } catch (err) { respondError(res,err); }
  finally { if (req.file?.path) await fs.unlink(req.file.path).catch(()=>{}); }
};
exports.list = async (req,res) => {
  try { res.json({success:true,data:await service.listJobs(owner(req))}); }
  catch (err) { respondError(res,err); }
};
exports.get = async (req,res) => {
  try {
    const data = await service.getJob(owner(req),req.params.id);
    if (!data) return res.status(404).json({success:false,message:'Import not found'});
    res.json({success:true,data});
  } catch (err) { respondError(res,err); }
};
exports.confirm = async (req,res) => {
  try {
    const data = await service.confirm(owner(req),req.params.id);
    if (!data) return res.status(404).json({success:false,message:'Import not found'});
    if (!['QUEUED','COMPLETED'].includes(data.status)) return res.status(409).json({success:false,message:'Import cannot be committed in its current state',data});
    res.status(data.status==='COMPLETED'?200:202).json({success:true,data});
  } catch (err) { respondError(res,err); }
};
exports.cancel = async (req,res) => {
  try {
    const data = await service.cancel(owner(req),req.params.id);
    if (!data) return res.status(404).json({success:false,message:'Import not found'});
    if (data.status!=='CANCELLED') return res.status(409).json({success:false,message:'Import cannot be cancelled in its current state',data});
    res.json({success:true,data});
  } catch (err) { respondError(res,err); }
};

exports.downloadIssues = async (req,res) => {
  const format=String(req.query.format||'xlsx').toLowerCase();
  if (!['xlsx','csv'].includes(format)) return res.status(400).json({success:false,message:'Choose Excel or CSV for the error report.'});
  let dir;
  try {
    const report=await service.getIssueReport(owner(req),req.params.id);
    if(!report) return res.status(404).json({success:false,message:'Import not found'});
    if(!report.issues.length)return res.status(409).json({success:false,message:'This import has no error report.'});
    dir=await fs.mkdtemp(path.join(os.tmpdir(),'retailops-gms-issues-'));
    const filename=reportFileName(report.fileName,format);
    const file=path.join(dir,filename);
    await writeIssueReport(report,format,file);
    res.set('Cache-Control','private, no-store');
    // Express download streams a completed file; no partial or mislabeled file.
    return res.download(file,filename,async err=>{
      await fs.rm(dir,{recursive:true,force:true}).catch(()=>{});
      if(err&&!res.headersSent) respondError(res,err);
    });
  } catch(err) {
    if(dir)await fs.rm(dir,{recursive:true,force:true}).catch(()=>{});
    respondError(res,err);
  }
};
