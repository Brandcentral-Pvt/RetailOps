const express = require('express');
const router = express.Router();
const sellerController = require('../controllers/sellerController');
const { authenticate, requirePermission, checkSellerAccess } = require('../middleware/auth');

router.get('/', authenticate, requirePermission('sellers_view'), sellerController.getSellers);
router.get('/:id', authenticate, requirePermission('sellers_view'), checkSellerAccess, sellerController.getSeller);
router.post('/', authenticate, requirePermission('sellers_create'), sellerController.createSeller);
router.put('/:id', authenticate, requirePermission('sellers_edit'), checkSellerAccess, sellerController.updateSeller);
router.delete('/:id', authenticate, requirePermission('sellers_delete'), checkSellerAccess, sellerController.deleteSeller);
router.post('/import', authenticate, requirePermission('sellers_create'), sellerController.importSellers);

module.exports = router;
