const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  asin: String,
  month: Date,
  drop_percentage: Number,
  previous_revenue: Number,
  current_revenue: Number,
  alert_generated_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Alert', alertSchema);
