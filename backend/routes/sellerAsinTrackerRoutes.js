const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/sellerAsinTrackerController');
const { authenticate, requireAnyPermission } = require('../middleware/auth');

// All routes require auth
router.use(authenticate);

// GET  /api/seller-tracker              — list all sellers with Keepa sync stats
router.get('/', requireAnyPermission(['sellers_view', 'sellers_manage']), ctrl.getTrackerList);

// GET  /api/seller-tracker/:sellerId/asins — list all ASINs for a seller
router.get('/:sellerId/asins', requireAnyPermission(['sellers_view', 'sellers_manage']), ctrl.getSellerAsins);

// POST /api/seller-tracker/sync/:sellerId — sync one seller from Keepa
router.post('/sync/:sellerId', requireAnyPermission(['sellers_manage', 'sellers_manage_asins']), ctrl.syncSeller);

// POST /api/seller-tracker/sync-all    — sync all sellers from Keepa
router.post('/sync-all', requireAnyPermission(['sellers_manage']), ctrl.syncAll);

module.exports = router;
