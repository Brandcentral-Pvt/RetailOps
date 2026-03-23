const mongoose = require('mongoose');

const adsPerformanceSchema = new mongoose.Schema({
  asin: { type: String, required: true, index: true },
  advertised_sku: { type: String, index: true },
  date: { type: Date, index: true },
  month: { type: Date, index: true }, // Store as first day of month for monthly reports
  reportType: { type: String, enum: ['daily', 'monthly'], required: true },

  // Core metrics
  ad_spend: { type: Number, default: 0 },
  ad_sales: { type: Number, default: 0 },
  impressions: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  orders: { type: Number, default: 0 },

  // Performance metrics (calculated)
  acos: { type: Number, default: 0 }, // ACoS (Advertising Cost of Sales) - percentage
  roas: { type: Number, default: 0 }, // ROAS (Return on Ad Spend) - ratio
  ctr: { type: Number, default: 0 }, // Click Through Rate - percentage
  aov: { type: Number, default: 0 }, // Average Order Value

  // Additional metrics from CSV
  cpc: { type: Number, default: 0 }, // Cost Per Click
  conversion_rate: { type: Number, default: 0 }, // Conversion Rate - percentage
  conversions: { type: Number, default: 0 }, // Total conversions (same as orders for most cases)

  // Same SKU metrics
  same_sku_sales: { type: Number, default: 0 }, // Sales from same SKU
  same_sku_orders: { type: Number, default: 0 }, // Orders from same SKU

  // Budget metrics
  daily_budget: { type: Number, default: 0 },
  total_budget: { type: Number, default: 0 },
  max_spend: { type: Number, default: 0 },
  avg_spend: { type: Number, default: 0 },

  // Totals
  total_sales: { type: Number, default: 0 },
  total_acos: { type: Number, default: 0 },
  total_units: { type: Number, default: 0 },

  // Organic metrics
  organic_sales: { type: Number, default: 0 },
  organic_orders: { type: Number, default: 0 },

  // Traffic & engagement
  page_views: { type: Number, default: 0 },
  ad_sales_perc: { type: Number, default: 0 }, // Ad sales percentage
  tos_is: { type: Number, default: 0 }, // Traffic on page to item session
  sessions: { type: Number, default: 0 },
  buy_box_percentage: { type: Number, default: 0 },
  browser_sessions: { type: Number, default: 0 },
  mobile_app_sessions: { type: Number, default: 0 },

  uploaded_at: { type: Date, default: Date.now }
});

// Partial unique indexes — daily index ignores monthly docs and vice versa
adsPerformanceSchema.index(
  { asin: 1, date: 1, reportType: 1 },
  { unique: true, partialFilterExpression: { reportType: 'daily' }, name: 'asin_date_daily_unique' }
);
adsPerformanceSchema.index(
  { asin: 1, month: 1, reportType: 1 },
  { unique: true, partialFilterExpression: { reportType: 'monthly' }, name: 'asin_month_monthly_unique' }
);

module.exports = mongoose.model('AdsPerformance', adsPerformanceSchema);
