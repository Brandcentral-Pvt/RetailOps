const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation',
        required: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['TEXT', 'IMAGE', 'FILE', 'AUDIO', 'VIDEO', 'POLL'],
        default: 'TEXT',
        required: true
    },
    content: {
        type: String,
        required: function () { return this.type === 'TEXT'; }
    },
    fileUrl: {
        type: String,
        required: function () { return this.type !== 'TEXT'; }
    },
    replyTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message'
    },
    reactions: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        emoji: String
    }],
    status: {
        sentAt: { type: Date, default: Date.now },
        deliveredTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
    },
    edited: {
        type: Boolean,
        default: false
    },
    deleted: {
        type: Boolean,
        default: false
    },
    pinned: {
        type: Boolean,
        default: false
    },
    pollData: {
        question: String,
        options: [{
            text: String,
            votes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
        }],
        expiresAt: Date
    }
}, { timestamps: true });

messageSchema.index({ conversationId: 1, createdAt: 1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ 'status.readBy': 1 });

module.exports = mongoose.models.Message || mongoose.model('Message', messageSchema);
