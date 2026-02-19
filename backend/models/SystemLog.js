const mongoose = require('mongoose');

const systemLogSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'COMMENT'],
        required: true
    },
    entityType: {
        type: String,
        enum: ['OBJECTIVE', 'KR', 'ACTION', 'SYSTEM'],
        required: true
    },
    entityId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    entityTitle: {
        type: String
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    description: {
        type: String,
        required: true
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed
    }
}, { timestamps: true });

systemLogSchema.index({ createdAt: -1 });
systemLogSchema.index({ entityType: 1, entityId: 1 });
systemLogSchema.index({ user: 1 });

module.exports = mongoose.models.SystemLog || mongoose.model('SystemLog', systemLogSchema);
