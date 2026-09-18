const express = require('express');
const router = express.Router();
const keywordController = require('../controllers/keywordController');
const { authenticate, requirePermission } = require('../middleware/auth');

router.get('/search', authenticate, requirePermission('keywords_view'), keywordController.search);
router.post('/batch-search', authenticate, requirePermission('keywords_view'), keywordController.batchSearch);
router.get('/categories', authenticate, requirePermission('keywords_view'), keywordController.getCategories);

module.exports = router;
