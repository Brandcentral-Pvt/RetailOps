const mongoose = require('mongoose');

const masterSchema = new mongoose.Schema({
  sku: String,
  parent_asin: String,
  asin: { type: String, unique: true },
  category: { 
    type: String, 
    default: 'general',
    enum: ['apparel', 'electronics', 'fmcg', 'home_goods', 'beauty', 'industrial', 'general']
  },
  attributes: {
    type: Map,
    of: String
  }
});

module.exports = mongoose.model('Master', masterSchema);
