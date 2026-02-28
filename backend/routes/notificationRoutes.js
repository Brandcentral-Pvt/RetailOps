const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticate: protect } = require('../middleware/auth');

router.get('/', protect, notificationController.getNotifications);
router.put('/read', protect, notificationController.markAsRead);
router.delete('/:id', protect, notificationController.deleteNotification);

module.exports = router;
