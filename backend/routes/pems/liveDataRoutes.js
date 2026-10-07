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

// Full v1–v6 credential overview (read-only; env-backed)
router.get('/credentials', auth, ctrl.getCredentials);

// V2 — locked to secondary credential only
router.post('/v2/fetch', auth, ctrl.fetchLiveDataV2);
router.post('/v2/upload', auth, upload.single('file'), ctrl.uploadAndProcessV2);
router.get('/v2/progress/:jobId', auth, ctrl.getProgressV2);
router.get('/v2/results/:jobId', auth, ctrl.getResultsV2);
router.get('/v2/download/:jobId', auth, ctrl.downloadResultsV2);
router.post('/v2/cancel/:jobId', auth, ctrl.cancelJobV2);

// V3–V6 — one page + endpoint set per dedicated API credential.
// Progress/results/download/cancel are jobId-based, so they are reused.
for (const ver of ['v3', 'v4', 'v5', 'v6']) {
    const fetchName = `fetchLiveData${ver.toUpperCase()}`;
    const uploadName = `uploadAndProcess${ver.toUpperCase()}`;
    router.post(`/${ver}/fetch`, auth, ctrl[fetchName]);
    router.post(`/${ver}/upload`, auth, upload.single('file'), ctrl[uploadName]);
    router.get(`/${ver}/progress/:jobId`, auth, ctrl.getProgress);
    router.get(`/${ver}/results/:jobId`, auth, ctrl.getResults);
    router.get(`/${ver}/download/:jobId`, auth, ctrl.downloadResults);
    router.post(`/${ver}/cancel/:jobId`, auth, ctrl.cancelJob);
}

module.exports = router;
