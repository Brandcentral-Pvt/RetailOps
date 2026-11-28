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

// Old financial contracts are retired, not silently redirected to incompatible shapes.
const retired=(_req,res)=>res.status(410).json({success:false,code:'ads_legacy_retired',message:'This legacy Ads endpoint has been retired. Use canonical reporting.'});
router.get('/overview', authenticate, canViewAds, retired);
// Isolated read-only diagnostic. Existing page continues to use legacy endpoints until cutover.
router.get('/canonical-summary', authenticate, canViewAds, require('../controllers/adsCanonicalSummaryController').getSummary);
const canonicalReport = require('../controllers/adsCanonicalReportController');
router.get('/canonical-analyst/history', authenticate, canViewAds, require('../controllers/adsAnalystController').history);
router.get('/canonical-analyst/history/:id', authenticate, canViewAds, require('../controllers/adsAnalystController').history);
router.post('/canonical-analyst/review', authenticate, canViewAds, aiLimiter, require('../controllers/adsAnalystController').review);
router.post('/canonical-analyst/evidence', authenticate, canViewAds, aiLimiter, require('../controllers/adsAnalystController').evidence);
router.get('/canonical-overview', authenticate, canViewAds, canonicalReport.overview);
router.get('/canonical-report', authenticate, canViewAds, canonicalReport.report);
router.get('/canonical-insights', authenticate, canViewAds, canonicalReport.insights);
router.get('/canonical-portfolio', authenticate, canViewAds, canonicalReport.portfolio);
router.get('/canonical-reconciliation', authenticate, canViewAds, canonicalReport.reconciliation);
router.get('/canonical-options', authenticate, canViewAds, canonicalReport.options);
router.get('/canonical-targets', authenticate, canViewAds, require('../controllers/adsCanonicalTargetsController').targets);
router.get('/canonical-budget', authenticate, canViewAds, require('../controllers/adsCanonicalTargetsController').budget);
// Separate export permission. Also require view, since this is a report read.
const exportJobs=require('../controllers/adsExportJobsController');
const canExportAds=requirePermission('adsreport_export');
router.post('/export-jobs',authenticate,canViewAds,canExportAds,exportJobs.create);
router.get('/export-jobs',authenticate,canViewAds,canExportAds,exportJobs.list);
router.get('/export-jobs/:id',authenticate,canViewAds,canExportAds,exportJobs.get);
router.post('/export-jobs/:id/retry',authenticate,canViewAds,canExportAds,exportJobs.retry);
router.post('/export-jobs/:id/cancel',authenticate,canViewAds,canExportAds,exportJobs.cancel);
router.get('/export-jobs/:id/download',authenticate,canViewAds,canExportAds,exportJobs.download);
router.get('/canonical-export', authenticate, canViewAds, requirePermission('adsreport_export'), require('../controllers/adsCanonicalExportController').download);
router.get('/series', authenticate, canViewAds, retired);
router.get('/table', authenticate, canViewAds, retired);
router.get('/history', authenticate, canViewAds, retired);
router.get('/filter-options', authenticate, canViewAds, retired);
router.get('/insights', authenticate, canViewAds, retired);
router.get('/report', authenticate, canViewAds, retired);

router.post('/ai-review', authenticate, canViewAds, aiLimiter, retired);

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
