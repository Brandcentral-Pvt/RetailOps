const mongoose = require('mongoose');

const monthlySchema = new mongoose.Schema({
  asin: String,
  month: Date,
  ordered_units: { type: Number, default: 0 },
  ordered_revenue: { type: Number, default: 0 },
  uploaded_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('MonthlyPerformance', monthlySchema);
