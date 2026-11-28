const express = require('express');
const multer = require('multer');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const gmsImport = require('../controllers/gmsImportController');
const gmsAnalytics = require('../controllers/gmsAnalyticsController');
const { MAX_FILE_BYTES } = require('../services/gmsImportParser');
const { randomUUID } = require('node:crypto');
const os = require('node:os');
const { authenticate, requirePermission } = require('../middleware/auth');
const { resolveSellerScope } = require('../utils/sellerScope');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads'),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, Date.now() + '-' + safeName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/csv',
    'application/json'
  ];

  const ext = file.originalname.toLowerCase();
  if (allowedTypes.includes(file.mimetype) ||
    ext.endsWith('.csv') ||
    ext.endsWith('.json') ||
    ext.endsWith('.xlsx') ||
    ext.endsWith('.xls')) {
    cb(null, true);
  } else {
    cb(new Error('Only Excel (.xlsx, .xls), CSV, and JSON files are accepted'), false);
  }
};

const limits = {
  fileSize: 200 * 1024 * 1024 // 200MB
};

const upload = multer({
  storage,
  fileFilter,
  limits
});

router.post('/upload/upload-monthly', authenticate, upload.single('file'), uploadController.uploadMonthlyData);
// Retire the unconfirmed legacy writer. New clients validate and explicitly confirm.
router.post('/upload/upload-ads', authenticate, requirePermission('adsreport_import'), (_req,res) =>
  res.status(409).json({success:false,code:'ads_import_confirmation_required',message:'Validate the report and confirm through the canonical import workflow.'}));
const adsValidation = require('../controllers/adsProductValidationController');
const { MAX_FILE_BYTES: ADS_MAX_FILE_BYTES } = require('../services/adsProductContract');
const adsCsvUpload = multer({
  storage: multer.diskStorage({
    destination: (_req,_file,cb) => cb(null,os.tmpdir()),
    filename: (_req,_file,cb) => cb(null,'retailops-ads-'+randomUUID())
  }),
  limits: {fileSize:ADS_MAX_FILE_BYTES,files:1,fields:3,parts:4,fieldSize:1024},
  fileFilter: (_req,file,cb) => /\.csv$/i.test(file.originalname)?cb(null,true):cb(new Error('Only CSV supported'))
}).single('file');
router.get('/upload/ads-validation-sellers', authenticate, requirePermission('adsreport_import'), adsValidation.listSellers);
const receiveAdsCsv=(req,res,next) => {
  adsCsvUpload(req,res,err => {
    if(err) return res.status(err.code==='LIMIT_FILE_SIZE'?413:400).json({
      success:false,code:'invalid_upload',message:'Select one UTF-8 CSV up to 32 MiB.'
    });
    next();
  });
};
const adsImportLimiter = require('../middleware/rateLimiter').createLimiter('STRICT');
router.post('/upload/ads-validate', authenticate, requirePermission('adsreport_import'), adsImportLimiter, receiveAdsCsv, adsValidation.validate);
router.post('/upload/ads-confirm', authenticate, requirePermission('adsreport_import'), adsValidation.importGate, adsImportLimiter, receiveAdsCsv, adsValidation.confirm);
router.post('/upload/octoparse', authenticate, upload.single('file'), uploadController.uploadOctoparseData);
router.get('/upload/upload-stats', authenticate, uploadController.getUploadStats);

// GMS reports use a separate bounded upload; files exist only until validation.
const gmsUpload = multer({
  storage: multer.diskStorage({
    destination: (_req,_file,cb) => cb(null,os.tmpdir()),
    filename: (_req,_file,cb) => cb(null,'retailops-gms-'+randomUUID())
  }),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
  fileFilter: (_req,file,cb) => /\.(csv|xlsx|xls)$/i.test(file.originalname)
    ? cb(null,true) : cb(new Error('Only CSV or Excel reports are supported'))
}).single('file');
const receiveGms = (req,res,next) => {
  req.setTimeout(900000);
  res.setTimeout(900000);
  gmsUpload(req,res,err => {
  if (err) return res.status(err.code==='LIMIT_FILE_SIZE'?413:400).json({
    success:false,message:err.code==='LIMIT_FILE_SIZE'?'Report exceeds 100 MB; split it into smaller reports':'Invalid report upload'
  });
  next();
  });
};
const importPermission = requirePermission('gms_tracker_import');
// Retired legacy immediate-write endpoint: old clients cannot bypass preview.
router.post('/upload/upload-gms', authenticate, importPermission, (_req,res) =>
  res.status(409).json({success:false,message:'GMS uploads now require validation and explicit confirmation. Update the application.'}));
router.post('/upload/gms-imports', authenticate, importPermission, receiveGms, gmsImport.preview);
router.get('/upload/gms-imports', authenticate, importPermission, gmsImport.list);
router.get('/upload/gms-imports/:id/errors', authenticate, importPermission, gmsImport.downloadIssues);
router.get('/upload/gms-imports/:id', authenticate, importPermission, gmsImport.get);
router.post('/upload/gms-imports/:id/confirm', authenticate, importPermission, gmsImport.confirm);
router.post('/upload/gms-imports/:id/cancel', authenticate, importPermission, gmsImport.cancel);
    router.get('/upload/gms-filters', authenticate, requirePermission('gms_tracker_view'), gmsAnalytics.filters);
    router.post('/upload/gms-analytics', authenticate, requirePermission('gms_tracker_view'), gmsAnalytics.overview);
    router.get('/upload/gms-data', authenticate, requirePermission('gms_tracker_view'), uploadController.getGmsData);
    router.get('/upload/gms-asins', authenticate, requirePermission('gms_tracker_view'), uploadController.getGmsAsins);
    router.post('/upload/gms-clear', authenticate, requirePermission('gms_tracker_delete'), (req,res) => {
      if (!resolveSellerScope(req.user).isGlobal) return res.status(403).json({success:false,message:'Global scope is required'});
      // The legacy administrative action is unavailable until it can be
      // coordinated transactionally with durable queued batches and recovery.
      return res.status(409).json({success:false,message:'Global GMS clear is paused during staged-import rollout; use batch cancellation for pending imports.'});
    });

module.exports = router;
