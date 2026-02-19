const express = require('express');
const router = express.Router();
const asinController = require('../controllers/asinController');
const { authenticate } = require('../middleware/auth');

// Search and stats
router.get('/search', authenticate, asinController.searchAsins);
router.get('/stats', authenticate, asinController.getAsinStats);
router.get('/lqs-top', authenticate, asinController.getAsinsByLQS);

// Main routes
router.get('/', authenticate, asinController.getAsins);
router.get('/all', authenticate, asinController.getAllAsinsWithHistory);
router.get('/seller/:sellerId', authenticate, asinController.getAsinsBySeller);
router.get('/:id', authenticate, asinController.getAsin);

// Trends and week history
router.get('/:id/trends', authenticate, asinController.getAsinTrends);
router.put('/:id/week-history', authenticate, asinController.updateWeekHistory);

// CRUD operations
router.post('/', authenticate, asinController.createAsin);
router.post('/bulk', authenticate, asinController.createAsins);
router.post('/bulk-delete', authenticate, asinController.bulkDeleteAsins);
router.post('/bulk-update', authenticate, asinController.bulkUpdateAsins);
router.post('/bulk-week-history', authenticate, asinController.bulkUpdateWeekHistory);

router.put('/:id', authenticate, asinController.updateAsin);
router.delete('/:id', authenticate, asinController.deleteAsin);

module.exports = router;
