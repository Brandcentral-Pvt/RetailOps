const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { authenticate: protect } = require('../middleware/auth');

router.use(protect); // Ensure all AI routes are protected

router.post('/generate-okr', aiController.generateOKR);
router.post('/suggest-tasks', aiController.suggestTasks);

module.exports = router;
