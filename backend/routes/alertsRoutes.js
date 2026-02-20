const express = require('express');
const router = express.Router();
const alertsController = require('../controllers/alertsController');

const { authenticate, requirePermission } = require('../middleware/auth');

// Alert routes
router.get('/alerts', authenticate, requirePermission('dashboard_view'), alertsController.getAlerts);
router.patch('/alerts/:id', authenticate, requirePermission('dashboard_view'), alertsController.acknowledgeAlert);

// Alert rule routes
router.get('/alert-rules', authenticate, requirePermission('settings_view'), alertsController.getAlertRules);
router.post('/alert-rules', authenticate, requirePermission('settings_edit'), alertsController.createAlertRule);
router.put('/alert-rules/:id', authenticate, requirePermission('settings_edit'), alertsController.updateAlertRule);
router.delete('/alert-rules/:id', authenticate, requirePermission('settings_edit'), alertsController.deleteAlertRule);

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'gms-dashboard-api'
  });
});

module.exports = router;
