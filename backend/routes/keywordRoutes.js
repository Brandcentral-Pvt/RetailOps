const express = require('express');
const router = express.Router();
const keywordController = require('../controllers/keywordController');
const { authenticate } = require('../middleware/auth');

router.get('/search', authenticate, keywordController.search);
router.post('/batch-search', authenticate, keywordController.batchSearch);
router.get('/categories', authenticate, keywordController.getCategories);

module.exports = router;
