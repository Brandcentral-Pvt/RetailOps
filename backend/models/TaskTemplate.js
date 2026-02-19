const mongoose = require('mongoose');

const taskTemplateSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: [
            'DESCRIPTION_OPTIMIZATION',
            'TITLE_OPTIMIZATION',
            'IMAGE_OPTIMIZATION',
            'BULLET_POINTS',
            'A_PLUS_CONTENT',
            'PRICING_STRATEGY',
            'RANK_IMPROVEMENT',
            'REVIEW_MANAGEMENT',
            'INVENTORY_MANAGEMENT',
            'COMPETITOR_ANALYSIS',
            'KEYWORD_OPTIMIZATION',
            'GENERAL_OPTIMIZATION',
            'TECHNICAL_ISSUE',
            'OTHER'
        ],
        required: true
    },
    priority: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
        default: 'MEDIUM'
    },
    estimatedMinutes: {
        type: Number,
        default: 30
    },
    category: {
        type: String,
        enum: ['SEO & Content', 'Sales & Marketing', 'Operations & General', 'Technical', 'Other'],
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.models.TaskTemplate || mongoose.model('TaskTemplate', taskTemplateSchema);
