const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['ALERT', 'ACTION_ASSIGNED', 'CHAT_MENTION', 'CHAT_MESSAGE', 'SYSTEM'],
        required: true
    },
    referenceModel: {
        type: String,
        enum: ['Alert', 'Action', 'Message', 'User', 'System'],
        required: true
    },
    referenceId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    isRead: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

notificationSchema.post('save', async function (doc) {
    try {
        const SocketService = require('../services/socketService');
        const unreadCount = await doc.constructor.countDocuments({
            recipient: doc.recipient,
            isRead: false
        });

        SocketService.emitToUser(doc.recipient, 'new-notification', {
            notification: doc,
            unreadCount
        });
    } catch (error) {
        console.error('Error emitting notification via socket:', error);
    }
});

module.exports = mongoose.model('Notification', notificationSchema);
