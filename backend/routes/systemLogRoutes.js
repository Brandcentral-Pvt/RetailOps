const express = require('express');
const router = express.Router();
const systemLogController = require('../controllers/systemLogController');
const { authenticate: protect } = require('../middleware/auth');

router.use(protect);

router.get('/', systemLogController.getLogs);

module.exports = router;
