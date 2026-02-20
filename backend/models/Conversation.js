const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['DIRECT', 'GROUP'],
        default: 'DIRECT',
        required: true
    },
    name: {
        type: String, // Only for Group chats
        trim: true
    },
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }],
    admins: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    memberRoles: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        role: {
            type: String,
            enum: ['ADMIN', 'MODERATOR', 'PARTICIPANT'],
            default: 'PARTICIPANT'
        }
    }],
    sellerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Seller',
        comment: 'Chat tied to specific seller context'
    },
    lastMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message'
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

// Ensure unique direct conversations between two users
conversationSchema.index({ participants: 1, type: 1 });

module.exports = mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema);
