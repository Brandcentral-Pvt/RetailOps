const Message = require('../models/Message');
const User = require('../models/User');
const mongoose = require('mongoose');

exports.getUsersForChat = async (req, res) => {
    try {
        const users = await User.find({ _id: { $ne: req.user._id } })
            .select('firstName lastName email avatar role')
            .populate('role', 'name');

        // Fetch last message for each user to show in sidebar
        const usersWithLastMessage = await Promise.all(users.map(async (user) => {
            const lastMessage = await Message.findOne({
                $or: [
                    { sender: req.user._id, recipient: user._id },
                    { sender: user._id, recipient: req.user._id }
                ]
            }).sort({ createdAt: -1 });

            const unreadCount = await Message.countDocuments({
                sender: user._id,
                recipient: req.user._id,
                read: false
            });

            return {
                ...user.toObject(),
                lastMessage: lastMessage ? {
                    content: lastMessage.content,
                    createdAt: lastMessage.createdAt
                } : null,
                unreadCount
            };
        }));

        res.json({ success: true, data: usersWithLastMessage });
    } catch (error) {
        console.error('Error fetching chat users:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.getConversation = async (req, res) => {
    try {
        const { recipientId } = req.params;
        const messages = await Message.find({
            $or: [
                { sender: req.user._id, recipient: recipientId },
                { sender: recipientId, recipient: req.user._id }
            ]
        })
            .sort({ createdAt: 1 })
            .populate('sender', 'firstName lastName avatar')
            .populate('recipient', 'firstName lastName avatar');

        // Mark messages as read
        await Message.updateMany(
            { sender: recipientId, recipient: req.user._id, read: false },
            { $set: { read: true } }
        );

        // Also mark notifications as read
        const Notification = require('../models/Notification');
        await Notification.updateMany(
            { recipient: req.user._id, type: 'CHAT_MESSAGE', referenceId: { $in: messages.map(m => m._id) }, isRead: false },
            { $set: { isRead: true } }
        );

        res.json({ success: true, data: messages });
    } catch (error) {
        console.error('Error fetching conversation:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.sendMessage = async (req, res) => {
    try {
        const { recipientId, content, actionId } = req.body;
        console.log(`📩 Sending message to ${recipientId}, content summary: ${content.substring(0, 20)}...`);

        const io = req.app.get('io');
        if (!io) {
            console.error('❌ Socket.io instance (io) not found in app');
        }

        const Notification = require('../models/Notification');

        const message = await Message.create({
            sender: req.user._id,
            recipient: recipientId,
            content,
            actionId: actionId || null
        });

        const populatedMessage = await Message.findById(message._id)
            .populate('sender', 'firstName lastName avatar')
            .populate('recipient', 'firstName lastName avatar');

        // Create notification for recipient
        const notification = await Notification.create({
            recipient: recipientId,
            type: 'CHAT_MESSAGE',
            referenceModel: 'User',
            referenceId: req.user._id, // The sender
            message: `New message from ${req.user.firstName}: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`
        });

        console.log(`🔔 Notification created for ${recipientId}: ${notification._id}`);

        // Get unread count for recipient
        const unreadCount = await Notification.countDocuments({ recipient: recipientId, isRead: false });

        // Emit via socket - use .toString() to be safe for room name
        const recipientRoom = recipientId.toString();
        io.to(recipientRoom).emit('private-message', populatedMessage);
        io.to(recipientRoom).emit('new-notification', {
            notification,
            unreadCount
        });

        console.log(`📡 Emitted new-notification to room ${recipientRoom}, unreadCount: ${unreadCount}`);

        // Also emit to sender (for multi-device sync)
        io.to(req.user._id.toString()).emit('private-message', populatedMessage);

        res.status(201).json({ success: true, data: populatedMessage });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
