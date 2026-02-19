const express = require('express');
const router = express.Router();
const controller = require('../controllers/dataController');
const dashboardController = require('../controllers/dashboardController');

const { authenticate } = require('../middleware/auth');

router.get('/master-revenue', controller.getMasterWithRevenue);
router.get('/chart-data', controller.getChartData); // Monthly trend
router.get('/chart-size-bar', controller.getRevenueBySize); // Revenue by size
router.get('/chart-size-pie', controller.getSizeShare); // Size share pie
router.get('/ads-report', controller.getAdsReport);
router.get('/sku-report', controller.getSkuReport);
router.get('/parent-asin-report', controller.getParentAsinReport);
router.get('/month-wise-report', controller.getMonthWiseReport);
router.get('/categories', controller.getCategories); // Category options
router.get('/dashboard', authenticate, dashboardController.getDashboardData);

module.exports = router;
