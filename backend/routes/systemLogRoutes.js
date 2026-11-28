const express = require('express');
const router = express.Router();
const systemLogController = require('../controllers/systemLogController');
const { authenticate: protect,requirePermission } = require('../middleware/auth');

router.use(protect);

router.get('/', requirePermission('activitylogs_view'), systemLogController.getLogs);

module.exports = router;
