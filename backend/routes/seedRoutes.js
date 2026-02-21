const express = require('express');
const router = express.Router();
const seedController = require('../controllers/seedController');
const { authenticate } = require('../middleware/auth');


// Get dashboard summary from database
router.get('/dashboard', authenticate, seedController.getDashboardSummary);
router.post('/seed-all', authenticate, seedController.seedAll);

module.exports = router;
