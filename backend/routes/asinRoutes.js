const express = require('express');
const router = express.Router();
const asinController = require('../controllers/asinController');
const { authenticate, requirePermission, checkSellerAccess } = require('../middleware/auth');

// Search and stats
router.get('/search', authenticate, requirePermission('sellers_view'), asinController.searchAsins);
router.get('/stats', authenticate, requirePermission('sellers_view'), asinController.getAsinStats);
router.get('/lqs-top', authenticate, requirePermission('sellers_view'), asinController.getAsinsByLQS);

// Main routes
router.get('/', authenticate, requirePermission('sellers_view'), asinController.getAsins);
router.get('/all', authenticate, requirePermission('sellers_view'), asinController.getAllAsinsWithHistory);
router.get('/seller/:sellerId', authenticate, requirePermission('sellers_view'), checkSellerAccess, asinController.getAsinsBySeller);
router.get('/:id', authenticate, requirePermission('sellers_view'), asinController.getAsin);

// Trends and week history
router.get('/:id/trends', authenticate, requirePermission('sellers_view'), asinController.getAsinTrends);
router.put('/:id/week-history', authenticate, requirePermission('sellers_manage_asins'), asinController.updateWeekHistory);

// CRUD operations
router.post('/', authenticate, requirePermission('sellers_manage_asins'), checkSellerAccess, asinController.createAsin);
router.post('/bulk', authenticate, requirePermission('sellers_manage_asins'), checkSellerAccess, asinController.createAsins);
router.post('/bulk-delete', authenticate, requirePermission('sellers_manage_asins'), asinController.bulkDeleteAsins);
router.post('/bulk-update', authenticate, requirePermission('sellers_manage_asins'), asinController.bulkUpdateAsins);
router.post('/bulk-week-history', authenticate, requirePermission('sellers_manage_asins'), asinController.bulkUpdateWeekHistory);

router.put('/:id', authenticate, requirePermission('sellers_manage_asins'), asinController.updateAsin);
router.delete('/:id', authenticate, requirePermission('sellers_manage_asins'), asinController.deleteAsin);

module.exports = router;
