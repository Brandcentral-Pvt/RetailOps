const express = require('express');
const router = express.Router();
const alertsController = require('../controllers/alertsController');

const { authenticate, requirePermission, requireAnyPermission } = require('../middleware/auth');

// ✅ Permission alignment: the dashboard's alerts feed is reachable by users
// with either dashboard_view or targets_view (brand managers), matching the
// frontend ProtectedRoute behavior.
const DASHBOARD_ALERT_PERM = requireAnyPermission(['dashboard_view', 'targets_view']);

// Alert routes
router.get('/alerts', authenticate, DASHBOARD_ALERT_PERM, alertsController.getAlerts);
router.get('/alerts/count', authenticate, DASHBOARD_ALERT_PERM, alertsController.getUnreadAlertCount);
router.patch('/alerts/:id', authenticate, DASHBOARD_ALERT_PERM, alertsController.acknowledgeAlert);
router.patch('/alerts/acknowledge-all', authenticate, DASHBOARD_ALERT_PERM, alertsController.acknowledgeAllAlerts);

// Alert rule routes
router.get('/alert-rules', authenticate, requirePermission('rules_view'), alertsController.getAlertRules);
router.post('/alert-rules', authenticate, requirePermission('rules_manage'), alertsController.createAlertRule);

// Execute all rules (root level to avoid :id conflict)
router.post('/execute-all-rules', authenticate, requirePermission('rules_manage'), alertsController.executeAllRules);

// Specific routes with :id pattern
router.patch('/alert-rules/:id/toggle', authenticate, requirePermission('rules_manage'), alertsController.toggleAlertRule);
router.post('/alert-rules/:id/execute', authenticate, requirePermission('rules_manage'), alertsController.executeRule);
router.get('/alert-rules/:id', authenticate, requirePermission('rules_view'), alertsController.getAlertRuleById);
router.put('/alert-rules/:id', authenticate, requirePermission('rules_manage'), alertsController.updateAlertRule);
router.delete('/alert-rules/:id', authenticate, requirePermission('rules_manage'), alertsController.deleteAlertRule);

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'gms-dashboard-api'
  });
});

module.exports = router;
