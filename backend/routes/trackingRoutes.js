const express = require('express');
const router = express.Router();
const controller = require('../controllers/trackingController');
const { authenticate, requirePermission } = require('../middleware/auth');

const canView = requirePermission('tasks_view');

router.use(authenticate);

// Live Sync tracking
router.get('/live-sync/runs', canView, controller.getLiveSyncRuns);
router.get('/live-sync/runs/:runId', canView, controller.getLiveSyncRun);
router.get('/live-sync/sellers/:sellerId', canView, controller.getLiveSyncSellerRuns);

// Scraper tracking
router.get('/scraper/runs', canView, controller.getScraperRuns);
router.get('/scraper/runs/:runId', canView, controller.getScraperRun);
router.get('/scraper/sellers/:sellerId', canView, controller.getScraperSellerRuns);

// Summary
router.get('/summary', canView, controller.getTrackingSummary);

module.exports = router;