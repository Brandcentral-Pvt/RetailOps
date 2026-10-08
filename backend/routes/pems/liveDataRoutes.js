const express = require('express');
const router = express.Router();
const multer = require('multer');
const { auth } = require('../../middleware/auth');
const ctrl = require('../../controllers/pems/liveDataController');
const CreatorsApiCredentials = require('../../services/creatorsApiCredentials');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// V1 API is disabled by default. Set LIVE_DATA_V1_ENABLED=true to re-enable.
const V1_ENABLED = process.env.LIVE_DATA_V1_ENABLED === 'true';

router.get('/metrics', auth, ctrl.getMetrics);

if (V1_ENABLED) {
    // V1 — legacy endpoints
    router.post('/fetch', auth, ctrl.fetchLiveData);
    router.post('/upload', auth, upload.single('file'), ctrl.uploadAndProcess);
    router.get('/progress/:jobId', auth, ctrl.getProgress);
    router.get('/results/:jobId', auth, ctrl.getResults);
    router.get('/download/:jobId', auth, ctrl.downloadResults);
    router.post('/cancel/:jobId', auth, ctrl.cancelJob);
} else {
    // V1 — disabled, respond with a clear "use v2" message
    router.post('/fetch', auth, ctrl.disabledV1);
    router.post('/upload', auth, upload.single('file'), ctrl.disabledV1);
    router.get('/progress/:jobId', auth, ctrl.disabledV1);
    router.get('/results/:jobId', auth, ctrl.disabledV1);
    router.get('/download/:jobId', auth, ctrl.disabledV1);
    router.post('/cancel/:jobId', auth, ctrl.disabledV1);
}

router.get('/creds-stats', auth, (req, res) => res.json({ success: true, data: CreatorsApiCredentials.getStats() }));

// V2 — locked to secondary credential only
router.post('/v2/fetch', auth, ctrl.fetchLiveDataV2);
router.post('/v2/upload', auth, upload.single('file'), ctrl.uploadAndProcessV2);
router.get('/v2/progress/:jobId', auth, ctrl.getProgressV2);
router.get('/v2/results/:jobId', auth, ctrl.getResultsV2);
router.get('/v2/download/:jobId', auth, ctrl.downloadResultsV2);
router.post('/v2/cancel/:jobId', auth, ctrl.cancelJobV2);

// V3 — no auth required; uses the tertiary credential from .env
// (CREATORS_API_CLIENT_ID_3 / CREATORS_API_CLIENT_SECRET_3).
router.get('/v3/metrics', ctrl.getMetrics);
router.post('/v3/fetch', ctrl.fetchLiveDataV3);
router.post('/v3/upload', upload.single('file'), ctrl.uploadAndProcessV3);
router.get('/v3/progress/:jobId', ctrl.getProgressV3);
router.get('/v3/results/:jobId', ctrl.getResultsV3);
router.get('/v3/download/:jobId', ctrl.downloadResultsV3);
router.post('/v3/cancel/:jobId', ctrl.cancelJobV3);

module.exports = router;
