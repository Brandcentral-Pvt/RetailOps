/**
 * Keyword Research routes — mounted at /api/keywords.
 *
 *   view     keywords_view     search, batch-search, categories, meta
 *   export   keywords_export   server-rendered XLSX of the current result set
 *   manage   keywords_manage   bypass the snapshot cache, clear the shared cache
 *
 * Seller scope is enforced inside the controller (it needs the request's
 * sellerId and the caller's assignments) and applies to every catalog read that
 * powers the "you sell this" flags.
 */

const express = require('express');
const router = express.Router();
const keywordController = require('../controllers/keywordController');
const { authenticate, requirePermission } = require('../middleware/auth');
const { createLimiter } = require('../middleware/rateLimiter');

const canView = requirePermission('keywords_view');
const canExport = requirePermission('keywords_export');
const canManage = requirePermission('keywords_manage');

// Batch search fans out to the upstream API (one paid call per keyword), so it
// gets the same strict limiter the ads AI review uses.
const batchLimiter = createLimiter('STRICT');

router.get('/search', authenticate, canView, keywordController.search);
router.post('/batch-search', authenticate, canView, batchLimiter, keywordController.batchSearch);
router.get('/categories', authenticate, canView, keywordController.getCategories);
router.get('/meta', authenticate, canView, keywordController.getMeta);

router.post('/export', authenticate, canView, canExport, keywordController.exportResults);
router.post('/cache/clear', authenticate, canView, canManage, keywordController.clearCache);

module.exports = router;
