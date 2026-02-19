const express = require('express');
const router = express.Router();
const alertsController = require('../controllers/alertsController');

// Alert routes
router.get('/alerts', alertsController.getAlerts);
router.patch('/alerts/:id', alertsController.acknowledgeAlert);

// Alert rule routes
router.get('/alert-rules', alertsController.getAlertRules);
router.post('/alert-rules', alertsController.createAlertRule);
router.put('/alert-rules/:id', alertsController.updateAlertRule);
router.delete('/alert-rules/:id', alertsController.deleteAlertRule);

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'gms-dashboard-api'
  });
});

module.exports = router;
