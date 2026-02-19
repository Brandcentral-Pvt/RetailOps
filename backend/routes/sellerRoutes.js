const express = require('express');
const router = express.Router();
const sellerController = require('../controllers/sellerController');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/', authenticate, sellerController.getSellers);
router.get('/:id', authenticate, sellerController.getSeller);
router.post('/', authenticate, requireRole('admin', 'Brand Manager'), sellerController.createSeller);
router.put('/:id', authenticate, sellerController.updateSeller);
router.delete('/:id', authenticate, requireRole('admin', 'Brand Manager'), sellerController.deleteSeller);
router.post('/import', authenticate, requireRole('admin'), sellerController.importSellers);

module.exports = router;
