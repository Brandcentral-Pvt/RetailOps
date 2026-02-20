const express = require('express');
const router = express.Router();
const seedController = require('../controllers/seedController');
const { authenticate } = require('../middleware/auth');


// Get dashboard summary from database
router.get('/dashboard', seedController.getDashboardSummary);

module.exports = router;
