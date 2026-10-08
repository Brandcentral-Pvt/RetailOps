const express = require('express');
const router = express.Router();
const multer = require('multer');
const { auth } = require('../../middleware/auth');
const ctrl = require('../../controllers/pems/liveDataController');
const CreatorsApiCredentials = require('../../services/creatorsApiCredentials');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Live-data responses must never be cached (progress is polled every few
// seconds). Without this, Express auto-ETags the JSON and browsers revalidate,
// producing the noisy `304 Not Modified` lines in the logs every poll.
function noStore(req, res, next) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    next();
}

// V1 API is disabled by default. Set LIVE_DATA_V1_ENABLED=true to re-enable.
const V1_ENABLED = process.env.LIVE_DATA_V1_ENABLED === 'true';

router.get('/metrics', auth, ctrl.getMetrics);

if (V1_ENABLED) {
    // V1 — legacy endpoints
    router.post('/fetch', auth, ctrl.fetchLiveData);
    router.post('/upload', auth, upload.single('file'), ctrl.uploadAndProcess);
    router.post('/start', auth, ctrl.startJob);
    router.get('/progress/:jobId', auth, noStore, ctrl.getProgress);
    router.get('/results/:jobId', auth, noStore, ctrl.getResults);
    router.get('/download/:jobId', auth, noStore, ctrl.downloadResults);
    router.post('/cancel/:jobId', auth, ctrl.cancelJob);
} else {
    // V1 — disabled, respond with a clear "use v2" message
    router.post('/fetch', auth, ctrl.disabledV1);
    router.post('/upload', auth, upload.single('file'), ctrl.disabledV1);
    router.post('/start', auth, ctrl.disabledV1);
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
router.post('/v2/start', auth, ctrl.startJobV2);
router.get('/v2/progress/:jobId', auth, noStore, ctrl.getProgressV2);
router.get('/v2/results/:jobId', auth, noStore, ctrl.getResultsV2);
router.get('/v2/download/:jobId', auth, noStore, ctrl.downloadResultsV2);
router.post('/v2/cancel/:jobId', auth, ctrl.cancelJobV2);

// V3–V6 — one page + endpoint set per dedicated API credential.
// Progress/results/download/cancel are jobId-based, so they are reused.
for (const ver of ['v3', 'v4', 'v5', 'v6']) {
    const fetchName = `fetchLiveData${ver.toUpperCase()}`;
    const uploadName = `uploadAndProcess${ver.toUpperCase()}`;
    const startName = `startJob${ver.toUpperCase()}`;
    router.post(`/${ver}/fetch`, auth, ctrl[fetchName]);
    router.post(`/${ver}/upload`, auth, upload.single('file'), ctrl[uploadName]);
    router.post(`/${ver}/start`, auth, ctrl[startName]);
    router.get(`/${ver}/progress/:jobId`, auth, noStore, ctrl.getProgress);
    router.get(`/${ver}/results/:jobId`, auth, noStore, ctrl.getResults);
    router.get(`/${ver}/download/:jobId`, auth, noStore, ctrl.downloadResults);
    router.post(`/${ver}/cancel/:jobId`, auth, ctrl.cancelJob);
}

module.exports = router;
