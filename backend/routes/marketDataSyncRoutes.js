const express = require('express');
const router = express.Router();
const marketSyncController = require('../controllers/marketDataSyncController');
const { authenticate, requireRole } = require('../middleware/auth');

/**
 * Routes for Discreet Market Data Synchronization.
 * Uses 'market-sync' namespace to avoid provider exposure.
 */

// Basic health check for service
router.get('/status', authenticate, marketSyncController.getSyncStatus);

// Trigger sync for a specific ASIN
router.post('/sync/:id', authenticate, requireRole('admin'), marketSyncController.syncAsin);

// Trigger batch sync for all ASINs of a seller
router.post('/sync-all/:sellerId', authenticate, requireRole('admin'), marketSyncController.syncSellerAsins);

// Handle sync data updates (e.g., from webhooks or manual updates)
router.post('/update', authenticate, requireRole('admin'), marketSyncController.handleSyncComplete);

module.exports = router;
