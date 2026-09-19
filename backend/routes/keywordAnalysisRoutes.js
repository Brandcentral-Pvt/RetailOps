/**
 * AI keyword analysis routes — mounted at /api/keyword-analysis.
 *
 * The only keyword endpoint that spends money per call (the LLM round trip),
 * so it carries the strict limiter. Seller scope is applied in the controller.
 */

const express = require('express');
const router = express.Router();
const keywordAnalysisController = require('../controllers/keywordAnalysisController');
const { authenticate, requirePermission } = require('../middleware/auth');
const { createLimiter } = require('../middleware/rateLimiter');

router.get('/analyze', authenticate, requirePermission('keywords_view'), createLimiter('STRICT'), keywordAnalysisController.analyze);

module.exports = router;
