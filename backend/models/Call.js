const mongoose = require('mongoose');

const callSchema = new mongoose.Schema({
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation',
        required: true
    },
    callerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    receiverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    type: {
        type: String,
        enum: ['AUDIO', 'VIDEO'],
        default: 'AUDIO'
    },
    status: {
        type: String,
        enum: ['INITIATED', 'ONGOING', 'ENDED', 'MISSED', 'REJECTED'],
        default: 'INITIATED'
    },
    startedAt: {
        type: Date
    },
    endedAt: {
        type: Date
    },
    duration: {
        type: Number, // In seconds
        default: 0
    }
}, { timestamps: true });

module.exports = mongoose.models.Call || mongoose.model('Call', callSchema);
