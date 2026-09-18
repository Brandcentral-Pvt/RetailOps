const express = require('express');
const router = express.Router();
const keywordAnalysisController = require('../controllers/keywordAnalysisController');
const { authenticate, requirePermission } = require('../middleware/auth');

router.get('/analyze', authenticate, requirePermission('keywords_view'), keywordAnalysisController.analyze);

module.exports = router;
