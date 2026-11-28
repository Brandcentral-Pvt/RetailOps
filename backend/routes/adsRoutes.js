/**
 * Ads Intelligence routes — mounted at /api/ads.
 *
 * Every route requires authentication plus the `adsreport_view` permission.
 * Seller-level authorisation happens inside the controller (AdsWindow), because
 * it needs the request's sellerId and the caller's assignments.
 *
 * The AI review route carries its own limiter: it is the only endpoint here
 * that spends money per call, and it is user-triggered by design.
 *
 * Extensions (2026-11-27):
 *   - Saved views:      GET/POST/DELETE /api/ads/saved-views[/:id]
 *   - ASIN flags:       POST/GET/DELETE /api/ads/table/:key/flag, /api/ads/table/flags[/:id]
 *   - User preferences: GET/PUT /api/ads/user-prefs
 *   - Export status:    GET /api/ads/export/:id/status
 */

const express = require('express');
const router = express.Router();
const controller = require('../controllers/adsController');
const savedViewsController = require('../controllers/adsSavedViewsController');
const flagsController = require('../controllers/adsFlagsController');
const prefsController = require('../controllers/adsUserPrefsController');
const exportController = require('../controllers/exportController');
const { authenticate, requirePermission } = require('../middleware/auth');
const { createLimiter } = require('../middleware/rateLimiter');
const { cacheRoute } = require('../middleware/cache');

const canViewAds = requirePermission('adsreport_view');
const aiLimiter = createLimiter('STRICT');

// ── Core Ads Intelligence (existing) ────────────────────────────────────

router.get('/meta', authenticate, cacheRoute('ads:meta', 300), controller.getMeta);

router.get('/overview', authenticate, canViewAds, controller.getOverview);
// Isolated read-only diagnostic. Existing page continues to use legacy endpoints until cutover.
router.get('/canonical-summary', authenticate, canViewAds, require('../controllers/adsCanonicalSummaryController').getSummary);
const canonicalReport = require('../controllers/adsCanonicalReportController');
router.get('/canonical-report', authenticate, canViewAds, canonicalReport.report);
router.get('/canonical-options', authenticate, canViewAds, canonicalReport.options);
router.get('/series', authenticate, canViewAds, controller.getSeries);
router.get('/table', authenticate, canViewAds, controller.getTable);
router.get('/history', authenticate, canViewAds, controller.getHistory);
router.get('/filter-options', authenticate, canViewAds, cacheRoute('ads:meta', 120), controller.getFilterOptions);
router.get('/insights', authenticate, canViewAds, controller.getInsights);
router.get('/report', authenticate, canViewAds, controller.getReport);

router.post('/ai-review', authenticate, canViewAds, aiLimiter, controller.postAiReview);

// ── Saved views (filter presets) ────────────────────────────────────────

router.get('/saved-views', authenticate, canViewAds, savedViewsController.listSavedViews);
router.post('/saved-views', authenticate, canViewAds, savedViewsController.createSavedView);
router.delete('/saved-views/:id', authenticate, canViewAds, savedViewsController.deleteSavedView);

// ── ASIN flags (personal annotations) ───────────────────────────────────

router.post('/table/:key/flag', authenticate, canViewAds, flagsController.setFlag);
router.get('/table/flags', authenticate, canViewAds, flagsController.listFlags);
router.delete('/table/flags/:id', authenticate, canViewAds, flagsController.deleteFlag);

// ── User preferences ────────────────────────────────────────────────────

router.get('/user-prefs', authenticate, canViewAds, prefsController.getUserPrefs);
router.put('/user-prefs', authenticate, canViewAds, prefsController.upsertUserPrefs);

// ── Export status (ads-scoped alias for /api/export/status/:id) ─────────

router.get('/export/:id/status', authenticate, canViewAds, exportController.getExportStatus);

module.exports = router;
