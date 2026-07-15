const express = require('express');
const router = express.Router();
const keywordAnalysisController = require('../controllers/keywordAnalysisController');
const { authenticate } = require('../middleware/auth');

router.get('/analyze', authenticate, keywordAnalysisController.analyze);

module.exports = router;
