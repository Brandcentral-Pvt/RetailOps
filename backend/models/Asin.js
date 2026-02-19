const mongoose = require('mongoose');

const weekHistorySchema = new mongoose.Schema({
  week: { type: String, required: true }, // e.g., "W45"
  date: { type: Date, required: true },
  price: { type: Number, default: 0 },
  bsr: { type: Number, default: 0 },
  rating: { type: Number, default: 0 },
  reviews: { type: Number, default: 0 },
  lqs: { type: Number, default: 0 },
  imageCount: { type: Number, default: 0 },
  descLength: { type: Number, default: 0 },
  hasAplus: { type: Boolean, default: false },
  // New metrics for detailed tracking
  titleLength: { type: Number, default: 0 },
  videoCount: { type: Number, default: 0 },
  offers: { type: Number, default: 0 },
});

const asinSchema = new mongoose.Schema({
  asinCode: { type: String, required: true },
  sku: { type: String }, // SKU field
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true },
  title: { type: String },
  description: { type: String }, // Description content
  imageUrl: { type: String },
  brand: { type: String },
  manufacturer: { type: String },
  category: { type: String },
  currentPrice: { type: Number, default: 0 },
  currentRank: { type: Number, default: 0 },
  bsr: { type: Number, default: 0 }, // Main BSR
  rating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
  buyBoxPrice: { type: Number, default: 0 },
  buyBoxSellerId: { type: String },
  buyBoxWin: { type: Boolean, default: false },
  couponDetails: { type: String, default: 'None' },
  dealDetails: { type: String, default: 'None' },
  totalOffers: { type: Number, default: 0 },
  imagesCount: { type: Number, default: 0 },
  hasAplus: { type: Boolean, default: false },
  lqs: { type: Number, default: 0 },
  subBSRs: [{ type: String }],
  mrp: { type: Number, default: 0 },
  currentASP: { type: Number, default: 0 },
  // Enhanced Product Details (from Tracker & Calculator)
  weight: { type: Number }, // in grams
  dimensions: { type: String }, // LxWxH
  volumetricWeight: { type: Number },
  stapleLevel: { type: String, enum: ['Standard', 'Heavy', 'Oversize'] },

  // Scrape Status (from Tracker)
  scrapeStatus: {
    type: String,
    enum: ['PENDING', 'SCRAPING', 'COMPLETED', 'FAILED'],
    default: 'PENDING'
  },
  lastScrapeExecutionId: { type: String },
  scrapeError: { type: String },
  marketplace: { type: String, default: 'amazon.in' },

  // LQS Details (Enhanced)
  lqsDetails: {
    titleLength: Number,
    bulletPointCount: Number,
    imageCount: Number,
    videoCount: Number,
    hasAplus: Boolean,
    descriptionLength: Number,
    reviewRating: Number,
    reviewCount: Number,
  },

  // Action Items (Task Management)
  actionItems: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Action' }],

  // Fee Preview (from Calculator)
  feePreview: {
    referralFee: Number,
    closingFee: Number,
    shippingFee: Number,
    fbaFee: Number,
    storageFee: Number,
    tax: Number,
    totalFees: Number,
    netRevenue: Number,
    margin: Number,
    calculatedAt: Date
  },

  amazonListedDate: { type: String },
  status: { type: String, enum: ['Active', 'Pending', 'Scraping', 'Error'], default: 'Active' },
  lastScraped: { type: Date },

  // Daily history (existing)
  history: [{
    date: Date,
    price: Number,
    salesRank: Number,
    offers: Number,
    reviews: Number,
  }],

  // Rating history (existing)
  ratingHistory: [{
    date: Date,
    rating: Number,
    reviewCount: Number,
  }],

  // Week-on-Week history (new - for trend tracking)
  weekHistory: [weekHistorySchema],

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Compound index for unique ASIN per seller
asinSchema.index({ asinCode: 1, seller: 1 }, { unique: true });

// Index for faster queries
asinSchema.index({ seller: 1, status: 1 });
asinSchema.index({ category: 1 });
asinSchema.index({ lqs: -1 });
asinSchema.index({ bsr: 1 });

// Method to update week history
asinSchema.methods.updateWeekHistory = function (weekData) {
  const existingIndex = this.weekHistory.findIndex(w => w.week === weekData.week);
  if (existingIndex >= 0) {
    this.weekHistory[existingIndex] = weekData;
  } else {
    this.weekHistory.push(weekData);
  }
  // Keep only last 12 weeks of history
  if (this.weekHistory.length > 12) {
    this.weekHistory = this.weekHistory.slice(-12);
  }
};

// Method to get week-on-week trends
asinSchema.methods.getTrends = function () {
  if (this.weekHistory.length < 2) return null;

  const sorted = [...this.weekHistory].sort((a, b) => new Date(a.date) - new Date(b.date));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  return {
    priceChange: last.price - first.price,
    pricePercent: ((last.price - first.price) / first.price * 100).toFixed(1),
    bsrChange: last.bsr - first.bsr,
    bsrPercent: ((last.bsr - first.bsr) / first.bsr * 100).toFixed(1),
    ratingChange: last.rating - first.rating,
    reviewsChange: last.reviews - first.reviews,
    lqsChange: last.lqs - first.lqs,
  };
};

asinSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.models.Asin || mongoose.model('Asin', asinSchema);
