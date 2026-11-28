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
router.get('/downloads', auth, getDownloads);
router.get('/status/:id', auth, getExportStatus);
router.get('/download/:id', auth, downloadFile);
router.get('/fields', auth, getExportFields);

module.exports = router;
