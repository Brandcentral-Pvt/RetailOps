const fs = require('node:fs/promises');
const service = require('../services/gmsImportService');
const owner = req => String(req.user.id || req.user.Id || req.user._id);
function respondError(res, err) {
  console.error('GMS import request failed:', err.message);
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
