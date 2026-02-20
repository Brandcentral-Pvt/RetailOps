const express = require('express');
const router = express.Router();
const controller = require('../controllers/dataController');
const dashboardController = require('../controllers/dashboardController');

const { authenticate, requirePermission } = require('../middleware/auth');

router.get('/master-revenue', authenticate, requirePermission('reports_sku_view'), controller.getMasterWithRevenue);
router.get('/chart-data', authenticate, requirePermission('dashboard_view'), controller.getChartData); // Monthly trend
router.get('/chart-size-bar', authenticate, requirePermission('dashboard_view'), controller.getRevenueBySize); // Revenue by size
router.get('/chart-size-pie', authenticate, requirePermission('dashboard_view'), controller.getSizeShare); // Size share pie
router.get('/ads-report', authenticate, requirePermission('reports_ads_view'), controller.getAdsReport);
router.get('/sku-report', authenticate, requirePermission('reports_sku_view'), controller.getSkuReport);
router.get('/parent-asin-report', authenticate, requirePermission('reports_parent_view'), controller.getParentAsinReport);
router.get('/month-wise-report', authenticate, requirePermission('reports_monthly_view'), controller.getMonthWiseReport);
router.get('/categories', authenticate, controller.getCategories); // Category options
router.get('/dashboard', authenticate, requirePermission('dashboard_view'), dashboardController.getDashboardData);

module.exports = router;
