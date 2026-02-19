const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { authenticate } = require('../middleware/auth');

router.get('/users', authenticate, chatController.getUsersForChat);
router.get('/conversation/:recipientId', authenticate, chatController.getConversation);
router.post('/send', authenticate, chatController.sendMessage);

module.exports = router;
