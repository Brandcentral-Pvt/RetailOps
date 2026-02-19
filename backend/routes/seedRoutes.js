const express = require('express');
const router = express.Router();
const seedController = require('../controllers/seedController');
const { authenticate } = require('../middleware/auth');

// Seed all demo data (public endpoint for demo purposes)
router.post('/seed-all', seedController.seedAllDemoData);

// Get dashboard summary from database
router.get('/dashboard', seedController.getDashboardSummary);

module.exports = router;
