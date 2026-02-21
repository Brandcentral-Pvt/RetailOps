const express = require('express');
const router = express.Router();
const marketSyncController = require('../controllers/marketDataSyncController');
const { authenticate, requirePermission, checkSellerAccess } = require('../middleware/auth');

/**
 * Routes for Discreet Market Data Synchronization.
 * Uses 'market-sync' namespace to avoid provider exposure.
 */

// Basic health check for service
router.get('/status', authenticate, marketSyncController.getSyncStatus);

// Trigger sync for a specific ASIN
router.post('/sync/:id', authenticate, requirePermission('sellers_manage_asins'), marketSyncController.syncAsin);

// Trigger batch sync for all ASINs of a seller
router.post('/sync-all/:sellerId', authenticate, requirePermission('sellers_manage_asins'), checkSellerAccess, marketSyncController.syncSellerAsins);

// Fetch and apply results for a task
router.post('/fetch-results/:sellerId', authenticate, requirePermission('sellers_manage_asins'), checkSellerAccess, marketSyncController.fetchAndApplyResults);

// Handle sync data updates (e.g., from webhooks or manual updates)
router.post('/update', authenticate, requirePermission('sellers_manage_asins'), marketSyncController.handleSyncComplete);

module.exports = router;
