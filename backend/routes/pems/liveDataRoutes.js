const express = require('express');
const router = express.Router();
const multer = require('multer');
const { auth } = require('../../middleware/auth');
const ctrl = require('../../controllers/pems/liveDataController');
const CreatorsApiCredentials = require('../../services/creatorsApiCredentials');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/metrics', auth, ctrl.getMetrics);
router.post('/fetch', auth, ctrl.fetchLiveData);
router.post('/upload', auth, upload.single('file'), ctrl.uploadAndProcess);
router.get('/progress/:jobId', auth, ctrl.getProgress);
router.get('/results/:jobId', auth, ctrl.getResults);
router.get('/download/:jobId', auth, ctrl.downloadResults);
router.post('/cancel/:jobId', auth, ctrl.cancelJob);
router.get('/creds-stats', auth, (req, res) => res.json({ success: true, data: CreatorsApiCredentials.getStats() }));

// V2 — locked to secondary credential only
router.post('/v2/fetch', auth, ctrl.fetchLiveDataV2);
router.post('/v2/upload', auth, upload.single('file'), ctrl.uploadAndProcessV2);
router.get('/v2/progress/:jobId', auth, ctrl.getProgressV2);
router.get('/v2/results/:jobId', auth, ctrl.getResultsV2);
router.get('/v2/download/:jobId', auth, ctrl.downloadResultsV2);
router.post('/v2/cancel/:jobId', auth, ctrl.cancelJobV2);

module.exports = router;
