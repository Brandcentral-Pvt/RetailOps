const mongoose = require('mongoose');

const adsPerformanceSchema = new mongoose.Schema({
  asin: { type: String, required: true, index: true },
  advertised_sku: { type: String, index: true },
  date: { type: Date, index: true },
  month: { type: Date, index: true }, // Store as first day of month for monthly reports
  reportType: { type: String, enum: ['daily', 'monthly'], required: true },
  ad_spend: { type: Number, default: 0 },
  ad_sales: { type: Number, default: 0 },
  impressions: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  orders: { type: Number, default: 0 },
  uploaded_at: { type: Date, default: Date.now }
});

// Compound index to prevent duplicates and speed up queries
adsPerformanceSchema.index({ asin: 1, date: 1, reportType: 1 }, { unique: true, sparse: true });
adsPerformanceSchema.index({ asin: 1, month: 1, reportType: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('AdsPerformance', adsPerformanceSchema);
