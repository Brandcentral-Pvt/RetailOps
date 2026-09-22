const express = require('express');
const router = express.Router();
const chatController = require('../controllers/messagingController');
const { authenticate: protect } = require('../middleware/auth');

router.get('/contacts', protect, chatController.getContacts);
router.get('/conversations', protect, chatController.listConversations);
router.get('/unread', protect, chatController.getUnread);
router.post('/conversations', protect, chatController.createConversation);
router.get('/conversations/:id/messages', protect, chatController.getMessages);
router.post('/conversations/:id/messages', protect, chatController.sendMessage);
router.post('/conversations/:id/read', protect, chatController.markRead);

module.exports = router;