const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    originalName: { type: String, required: true },
    storedName: { type: String, required: true },   // uuid filename on disk
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },   // bytes
    path: { type: String, required: true },   // relative path inside /uploads
    folder: { type: String, default: '' },      // virtual folder path, e.g. "docs/2025"
    starred: { type: Boolean, default: false },
    trashed: { type: Boolean, default: false },  // soft-delete (Recovery bin)
    trashedAt: { type: Date },
}, { timestamps: true });

// Auto-purge trashed files older than 30 days
fileSchema.index({ trashedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

module.exports = mongoose.model('File', fileSchema);
