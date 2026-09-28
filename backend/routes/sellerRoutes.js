const express = require('express');
const router = express.Router();
const sellerController = require('../controllers/sellerController');
const { authenticate, requirePermission, checkSellerAccess } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { cacheRoute, invalidateCache } = require('../middleware/cache');

router.get('/', authenticate, requirePermission('seller_view'), cacheRoute('seller:list', 300), sellerController.getSellers);
router.get('/stats', authenticate, requirePermission('seller_view'), cacheRoute('seller:list', 60), sellerController.getSellerStats);
router.get('/:id', authenticate, requirePermission('seller_view'), checkSellerAccess, sellerController.getSeller);
router.post('/', authenticate, requirePermission('seller_manage'), validate('createSeller'), invalidateCache('seller:list'), sellerController.createSeller);
router.put('/:id', authenticate, requirePermission('seller_manage'), checkSellerAccess, invalidateCache('seller:list'), sellerController.updateSeller);
router.delete('/:id', authenticate, requirePermission('seller_manage'), checkSellerAccess, invalidateCache('seller:list'), sellerController.deleteSeller);
router.post('/import', authenticate, requirePermission('seller_manage'), invalidateCache('seller:list'), sellerController.importSellers);

module.exports = router;
