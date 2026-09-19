/**
 * Ads Intelligence routes — mounted at /api/ads.
 *
 * Every route requires authentication plus the `adsreport_view` permission.
 * Seller-level authorisation happens inside the controller (AdsWindow), because
 * it needs the request's sellerId and the caller's assignments.
 *
 * The AI review route carries its own limiter: it is the only endpoint here
 * that spends money per call, and it is user-triggered by design.
 */

const express = require('express');
const router = express.Router();
const controller = require('../controllers/adsController');
const { authenticate, requirePermission } = require('../middleware/auth');
const { createLimiter } = require('../middleware/rateLimiter');

const canViewAds = requirePermission('adsreport_view');
const aiLimiter = createLimiter('STRICT');

router.get('/meta', authenticate, controller.getMeta);

router.get('/overview', authenticate, canViewAds, controller.getOverview);
router.get('/series', authenticate, canViewAds, controller.getSeries);
router.get('/table', authenticate, canViewAds, controller.getTable);
router.get('/history', authenticate, canViewAds, controller.getHistory);
router.get('/filter-options', authenticate, canViewAds, controller.getFilterOptions);
router.get('/insights', authenticate, canViewAds, controller.getInsights);
router.get('/report', authenticate, canViewAds, controller.getReport);

router.post('/ai-review', authenticate, canViewAds, aiLimiter, controller.postAiReview);

module.exports = router;
