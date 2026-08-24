const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const ctrl = require('../../controllers/pems/liveSyncTrackerController');

router.get('/overview', auth, ctrl.getOverview);
router.get('/sellers', auth, ctrl.getSellers);
router.get('/seller/:sellerId', auth, ctrl.getSellerDetail);
router.get('/activity', auth, ctrl.getActivity);
router.post('/trigger', auth, ctrl.triggerSync);

// Advanced run-log endpoints (Live Sync Tracker)
router.get('/runs', auth, ctrl.getRuns);
router.get('/runs/:runId', auth, ctrl.getRunDetail);
router.get('/brands', auth, ctrl.getBrandRuns);

module.exports = router;
