const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const chatUploadController = require('../controllers/chatUploadController');
const { authenticate } = require('../middleware/auth');

const chatWebhookController = require('../controllers/chatWebhookController');

router.post('/webhook', chatWebhookController.handleCometChatWebhook);
router.get('/users', authenticate, chatController.getUsersForChat);
router.get('/sellers', authenticate, chatController.getSellersForChat);
router.get('/conversations', authenticate, chatController.getConversations);
router.post('/conversations', authenticate, chatController.getOrCreateConversation);
router.get('/messages/:conversationId', authenticate, chatController.getMessages);
router.post('/messages/:conversationId/read', authenticate, chatController.markAsRead);

// Upload route
router.post('/upload', authenticate, chatUploadController.chatUploadMiddleware, chatUploadController.uploadChatFile);
router.post('/send', authenticate, chatController.sendMessage);
router.get('/search', authenticate, chatController.searchMessages);
router.put('/messages/:messageId', authenticate, chatController.editMessage);
router.delete('/messages/:messageId', authenticate, chatController.deleteMessage);
router.put('/messages/:messageId/pin', authenticate, chatController.togglePinMessage);
router.post('/messages/forward', authenticate, chatController.forwardMessage);
router.get('/messages/:messageId/receipts', authenticate, chatController.getMessageReadReceipts);
router.get('/link-preview', authenticate, chatController.getLinkPreview);
router.post('/messages/:messageId/vote', authenticate, chatController.votePoll);
router.post('/messages/poll', authenticate, chatController.createPoll);

// Group management routes
router.post('/groups', authenticate, chatController.createGroup);
router.post('/groups/:conversationId/members', authenticate, chatController.addGroupMembers);
router.post('/groups/:conversationId/members/remove', authenticate, chatController.removeGroupMember);
router.put('/groups/:conversationId/role', authenticate, chatController.updateMemberRole);
router.get('/groups/:conversationId/media', authenticate, chatController.getSharedMedia);

module.exports = router;
