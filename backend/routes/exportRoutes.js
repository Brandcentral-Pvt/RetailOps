const express = require('express');
const router = express.Router();
const { auth, requirePermission } = require('../middleware/auth');
const {
    startExport,
    getDownloads,
    getExportStatus,
    downloadFile,
    getExportFields,
    startGmsExport
} = require('../controllers/exportController');
const startAdsExport=(_req,res)=>res.status(410).json({success:false,code:'ads_legacy_retired',message:'Use the canonical Ads Intelligence workbook export.'});

router.post('/start', auth, startExport);
router.post('/start-ads', auth, requirePermission('adsreport_export'), startAdsExport);
router.post('/start-gms', auth, requirePermission('gms_tracker_export'), startGmsExport);
const gmsJobs=require('../controllers/reportExportJobsController').createReportExportController(require('../services/gmsExportJobs'),data=>{
 const f=data.filters,range=f.exportDateType==='all'?'all-history':f.exportDateType==='custom'?f.exportCustomDates.join('-'):f.startDate+'-'+f.endDate;
 return 'gms_export_'+f.exportLevel+'_'+range+'.'+data.format;
});
const canGmsExport=requirePermission('gms_tracker_export');
router.post('/gms-jobs',auth,canGmsExport,gmsJobs.create);
router.get('/gms-jobs',auth,canGmsExport,gmsJobs.list);
router.get('/gms-jobs/:id',auth,canGmsExport,gmsJobs.get);
router.post('/gms-jobs/:id/retry',auth,canGmsExport,gmsJobs.retry);
router.post('/gms-jobs/:id/cancel',auth,canGmsExport,gmsJobs.cancel);
router.get('/gms-jobs/:id/download',auth,canGmsExport,gmsJobs.download);
router.get('/downloads', auth, getDownloads);
router.get('/status/:id', auth, getExportStatus);
router.get('/download/:id', auth, downloadFile);
router.get('/fields', auth, getExportFields);

module.exports = router;
