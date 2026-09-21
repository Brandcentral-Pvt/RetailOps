const express = require('express');
const router = express.Router();
const asinTableController = require('../controllers/asinTableController');
const { authenticate: protect, requirePermission } = require('../middleware/auth');

/**
 * ASIN Table Integration Routes
 */

// GET /api/asins/table
// Unified endpoint for high-performance ASIN intelligence ledger
router.get('/', protect, requirePermission('asinmanager_view'), asinTableController.getAsinTable);

module.exports = router;
