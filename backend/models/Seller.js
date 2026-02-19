const mongoose = require('mongoose');

const sellerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  marketplace: { type: String, required: true, enum: ['amazon.in', 'amazon.com', 'amazon.uk', 'amazon.de', 'amazon.fr', 'amazon.ca'] },
  sellerId: { type: String, required: true, unique: true },
  apiKey: { type: String },
  plan: { type: String, enum: ['Starter', 'Pro', 'Enterprise'], default: 'Starter' },
  scrapeLimit: { type: Number, default: 100 },
  scrapeUsed: { type: Number, default: 0 },
  totalAsins: { type: Number, default: 0 },
  activeAsins: { type: Number, default: 0 },
  lastScraped: { type: Date },
  status: { type: String, enum: ['Active', 'Paused'], default: 'Active' },
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  marketSyncTaskId: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

sellerSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Seller', sellerSchema);
