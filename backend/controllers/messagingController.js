const chatService = require('../services/chatService');

exports.getContacts = async (req, res) => {
    try {
        const contacts = await chatService.getContacts(req.user, req.query.search || '');
        res.json({ success: true, contacts });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

exports.listConversations = async (req, res) => {
    try {
        const conversations = await chatService.listConversations(req.user);
        res.json({ success: true, conversations });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

exports.getUnread = async (req, res) => {
    try {
        const unreadCount = await chatService.getUnreadTotal(req.user);
        res.json({ success: true, unreadCount });
    } catch (error) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

exports.createConversation = async (req, res) => {
    try {
        const { userId: otherUserId, group, title, sellerId, participantIds } = req.body || {};
        if (group) {
            const conversation = await chatService.createGroup(req.user, { title, sellerId, participantIds });
            return res.status(201).json({ success: true, conversation });
        }
        const conversation = await chatService.createDirect(req.user, otherUserId);
        res.status(201).json({ success: true, conversation });
    } catch (error) {
        console.error('createConversation error:', error.message);
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

exports.getMessages = async (req, res) => {
    try {
        const { beforeId, beforeAt, limit } = req.query;
        const history = await chatService.listMessages(req.user, req.params.id, { beforeId, beforeAt, limit });
        res.json({ success: true, ...history });
    } catch (error) {
        console.error('getMessages error:', error.message);
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

exports.sendMessage = async (req, res) => {
    try {
        const { content, type, attachmentUrl, attachmentName } = req.body || {};
        const message = await chatService.sendMessage(req.user, req.params.id, {
            content,
            type,
            attachmentUrl,
            attachmentName,
        });
        res.status(201).json({ success: true, message });
    } catch (error) {
        console.error('sendMessage error:', error.message);
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};

exports.markRead = async (req, res) => {
    try {
        const state = await chatService.markRead(req.user, req.params.id);
        res.json({ success: true, ...state });
    } catch (error) {
        console.error('markRead error:', error.message);
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
};