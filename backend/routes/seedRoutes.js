const express = require('express');
const router = express.Router();
const seedController = require('../controllers/seedController');
const { authenticate, requirePermission } = require('../middleware/auth');


// Get dashboard summary from database
router.get('/dashboard', authenticate, seedController.getDashboardSummary);
// SECURITY: seeding endpoint — admin-level gate for consistency (currently a no-op handler)
router.post('/seed-all', authenticate, requirePermission('settings_manage'), seedController.seedAll);

module.exports = router;
