const express = require('express');
const router = express.Router();
const systemLogController = require('../controllers/systemLogController');
const { authenticate: protect, requirePermission } = require('../middleware/auth');

router.use(protect);

// SECURITY: system logs may contain sensitive operational data — settings_manage holders only
router.get('/', requirePermission('settings_manage'), systemLogController.getLogs);

module.exports = router;
