const mongoose = require('mongoose');

const apiKeySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    serviceId: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    value: {
        type: String,
        required: true
    },
    category: {
        type: String,
        enum: ['Scraping', 'Amazon Data', 'AI', 'Communication', 'Other'],
        default: 'Other'
    },
    description: {
        type: String,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastUsed: {
        type: Date
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('ApiKey', apiKeySchema);
