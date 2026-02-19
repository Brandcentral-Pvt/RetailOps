const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: true
    },
    actionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Action'
    },
    read: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

messageSchema.index({ sender: 1, recipient: 1 });
messageSchema.index({ recipient: 1, read: 1 });
messageSchema.index({ createdAt: 1 });

module.exports = mongoose.models.Message || mongoose.model('Message', messageSchema);
