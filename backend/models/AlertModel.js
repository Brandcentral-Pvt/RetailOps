const mongoose = require('mongoose');

const alertRuleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: {
    type: String,
    required: true,
    enum: ['revenue', 'inventory', 'ads', 'system']
  },
  condition: {
    metric: { type: String, required: true },
    operator: { type: String, required: true },
    value: { type: Number, required: true },
    period: { type: String, default: '1d' }
  },
  severity: {
    type: String,
    required: true,
    enum: ['critical', 'warning', 'info']
  },
  active: { type: Boolean, default: true },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const alertSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['revenue', 'inventory', 'ads', 'system']
  },
  message: { type: String, required: true },
  severity: {
    type: String,
    required: true,
    enum: ['critical', 'warning', 'info']
  },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller' },
  createdAt: { type: Date, default: Date.now },
  acknowledged: { type: Boolean, default: false },
  acknowledgedBy: { type: String },
  acknowledgedAt: { type: Date },
  data: { type: mongoose.Schema.Types.Mixed }
});

alertRuleSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

alertRuleSchema.pre('updateOne', function (next) {
  this.set({ updatedAt: new Date() });
  next();
});

// Use mongoose.model() only if it doesn't already exist
const AlertRule = mongoose.models.AlertRule || mongoose.model('AlertRule', alertRuleSchema);
const Alert = mongoose.models.Alert || mongoose.model('Alert', alertSchema);

module.exports = { Alert, AlertRule };
