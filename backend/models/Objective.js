const mongoose = require('mongoose');

const objectiveSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        enum: ['MONTHLY', 'WEEKLY', 'QUARTERLY', 'ANNUAL'],
        default: 'MONTHLY',
        required: true
    },
    status: {
        type: String,
        enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'AT_RISK'],
        default: 'NOT_STARTED'
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    progress: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    owners: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    sellerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Seller'
    },
    parentObjectiveId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Objective',
        default: null
    },
    description: {
        type: String
    },
    goal: {
        type: String,
        default: ''
    },
    measurementMetrics: {
        type: String,
        default: ''
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    tags: [{ type: String }]
}, { timestamps: true });

// Backward-compatible virtual: returns the first owner
objectiveSchema.virtual('owner').get(function () {
    return this.owners && this.owners.length > 0 ? this.owners[0] : null;
});

// Virtual to get KeyResults
objectiveSchema.virtual('keyResults', {
    ref: 'KeyResult',
    localField: '_id',
    foreignField: 'objectiveId'
});

// Calculate progress based on Key Results (method to be called explicitly)
objectiveSchema.methods.calculateProgress = async function () {
    const KeyResult = mongoose.model('KeyResult');
    const krs = await KeyResult.find({ objectiveId: this._id });

    if (krs.length === 0) return 0;

    let totalWeight = 0;
    let weightedProgress = 0;

    krs.forEach(kr => {
        // Calculate KR progress
        let krProgress = 0;
        if (kr.targetValue > 0) {
            krProgress = Math.min((kr.currentValue / kr.targetValue) * 100, 100);
        }

        const weight = kr.weight || 1;
        totalWeight += weight;
        weightedProgress += krProgress * weight;
    });

    this.progress = totalWeight > 0 ? Math.round(weightedProgress / totalWeight) : 0;
    await this.save();
    return this.progress;
};

// Index for efficient querying
objectiveSchema.index({ owners: 1, type: 1, status: 1 });
objectiveSchema.index({ sellerId: 1 });
objectiveSchema.index({ parentObjectiveId: 1 });

module.exports = mongoose.models.Objective || mongoose.model('Objective', objectiveSchema);
