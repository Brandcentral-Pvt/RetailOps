const mongoose = require('mongoose');

// Referral Fee Tier Schema
const referralFeeTierSchema = new mongoose.Schema({
  minPrice: { type: Number, required: true },
  maxPrice: { type: Number, required: true },
  percentage: { type: Number, required: true }
});

// Referral Fee Schema
const referralFeeSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  category: { type: String, required: true },
  nodeId: { type: String },
  tiers: [referralFeeTierSchema]
});

// Closing Fee Schema
const closingFeeSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  minPrice: { type: Number, required: true },
  maxPrice: { type: Number, required: true },
  fee: { type: Number, required: true },
  category: { type: String },
  nodeId: { type: String },
  sellerType: { type: String, enum: ['FC', 'SF', 'ES', 'MFN'] }
});

// Shipping Fee Schema
const shippingFeeSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  sizeType: { type: String, required: true, enum: ['Standard', 'Heavy', 'Oversize'] },
  weightMin: { type: Number, required: true },
  weightMax: { type: Number, required: true },
  fee: { type: Number, required: true },
  useIncremental: { type: Boolean, default: false },
  incrementalFee: { type: Number },
  incrementalStep: { type: Number },
  pickAndPackFee: { type: Number }
});

// Storage Fee Schema
const storageFeeSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  duration: { type: String, required: true },
  rate: { type: Number, required: true },
  description: { type: String }
});

// Category Mapping Schema
const categoryMapSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  keepaCategory: { type: String, required: true },
  feeCategory: { type: String, required: true }
});

// Node Mapping Schema
const nodeMapSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  nodeId: { type: String, required: true },
  feeCategoryName: { type: String, required: true }
});

// Refund Fee Schema
const refundFeeSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  minPrice: { type: Number, required: true },
  maxPrice: { type: Number, required: true },
  basic: { type: Number, required: true },
  standard: { type: Number, required: true },
  advanced: { type: Number, required: true },
  premium: { type: Number, required: true },
  category: { type: String, required: true, enum: ['General', 'Apparel', 'Shoes'] }
});

// ASIN Item Schema
const asinItemSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  asin: { type: String, required: true, unique: true },
  stapleLevel: { type: String, required: true, enum: ['Standard', 'Heavy', 'Oversize'] },
  status: { type: String, required: true, enum: ['pending', 'fetched', 'calculated', 'error'] },
  errorMessage: { type: String },
  createdAt: { type: Date, required: true },
  
  // Product Data
  title: { type: String },
  categoryId: { type: String },
  category: { type: String },
  categoryPath: { type: String },
  price: { type: Number },
  image: { type: String },
  brand: { type: String },
  weight: { type: Number },
  volumetricWeight: { type: Number },
  dimensions: { type: String },

  // Calculation Data
  referralFee: { type: Number },
  closingFee: { type: Number },
  shippingFee: { type: Number },
  pickAndPackFee: { type: Number },
  storageFee: { type: Number },
  tax: { type: Number },
  totalFees: { type: Number },
  netRevenue: { type: Number },
  marginPercent: { type: Number },
  calculatedAt: { type: Date },
  returnPercent: { type: Number },
  productCost: { type: Number },
  profitBeforeReturns: { type: Number },
  lossPerReturn: { type: Number },
  adjustedNetRevenue: { type: Number },
  adjustedMarginPercent: { type: Number },
  stepLevel: { type: String, enum: ['Basic', 'Standard', 'Advanced', 'Premium'] },
  returnFee: { type: Number }
});

// User Schema (for Revenue Calculator)
const revenueUserSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  role: { type: String, required: true, enum: ['admin'] }
});

// Create models
const ReferralFee = mongoose.model('ReferralFee', referralFeeSchema);
const ClosingFee = mongoose.model('ClosingFee', closingFeeSchema);
const ShippingFee = mongoose.model('ShippingFee', shippingFeeSchema);
const StorageFee = mongoose.model('StorageFee', storageFeeSchema);
const CategoryMap = mongoose.model('CategoryMap', categoryMapSchema);
const NodeMap = mongoose.model('NodeMap', nodeMapSchema);
const RefundFee = mongoose.model('RefundFee', refundFeeSchema);
const AsinItem = mongoose.model('AsinItem', asinItemSchema);
const RevenueUser = mongoose.model('RevenueUser', revenueUserSchema);

// Seed initial data function
const seedInitialData = async () => {
  // Check if data already exists
  const referralCount = await ReferralFee.countDocuments();
  if (referralCount === 0) {
    const initialReferral = [
      { id: 'r1', category: 'Electronics', tiers: [{ minPrice: 0, maxPrice: 99999999, percentage: 8 }] },
      { id: 'r2', category: 'Books', tiers: [{ minPrice: 0, maxPrice: 99999999, percentage: 15 }] },
      { id: 'r3', category: 'Clothing', tiers: [{ minPrice: 0, maxPrice: 99999999, percentage: 17 }] },
      { id: 'r4', category: 'Home & Kitchen', tiers: [{ minPrice: 0, maxPrice: 99999999, percentage: 15 }] },
      { id: 'r5', category: 'Health & Personal Care', tiers: [{ minPrice: 0, maxPrice: 99999999, percentage: 15 }] },
      { id: 'r6', category: 'Toys & Games', tiers: [{ minPrice: 0, maxPrice: 99999999, percentage: 15 }] },
      { id: 'r7', category: 'Sports & Outdoors', tiers: [{ minPrice: 0, maxPrice: 99999999, percentage: 15 }] },
      { id: 'r8', category: 'Automotive', tiers: [{ minPrice: 0, maxPrice: 99999999, percentage: 12 }] },
      { id: 'r9', category: 'Tools & Home Improvement', tiers: [{ minPrice: 0, maxPrice: 99999999, percentage: 12 }] },
      { id: 'r10', category: 'Beauty', tiers: [{ minPrice: 0, maxPrice: 99999999, percentage: 15 }] }
    ];
    await ReferralFee.insertMany(initialReferral);
    console.log('[Revenue Calculator] Seeded referral fees');
  }

  const closingCount = await ClosingFee.countDocuments();
  if (closingCount === 0) {
    const initialClosing = [
      { id: 'c1', minPrice: 0, maxPrice: 300, fee: 26, sellerType: 'FC' },
      { id: 'c2', minPrice: 301, maxPrice: 500, fee: 21, sellerType: 'FC' },
      { id: 'c3', minPrice: 501, maxPrice: 1000, fee: 26, sellerType: 'FC' },
      { id: 'c4', minPrice: 1001, maxPrice: 99999999, fee: 51, sellerType: 'FC' }
    ];
    await ClosingFee.insertMany(initialClosing);
    console.log('[Revenue Calculator] Seeded closing fees');
  }

  const shippingCount = await ShippingFee.countDocuments();
  if (shippingCount === 0) {
    const initialShipping = [
      { id: 's1', sizeType: 'Standard', weightMin: 0, weightMax: 500, fee: 65, pickAndPackFee: 17 },
      { id: 's2', sizeType: 'Standard', weightMin: 501, weightMax: 1000, fee: 85, pickAndPackFee: 17 },
      { id: 's3', sizeType: 'Standard', weightMin: 1001, weightMax: 2000, fee: 122, pickAndPackFee: 17 },
      { id: 's4', sizeType: 'Standard', weightMin: 2001, weightMax: 5000, fee: 122, pickAndPackFee: 37, useIncremental: true, incrementalStep: 1000, incrementalFee: 34 },
      { id: 's5', sizeType: 'Standard', weightMin: 5001, weightMax: 99999999, fee: 224, pickAndPackFee: 37, useIncremental: true, incrementalStep: 1000, incrementalFee: 18 },
      { id: 'h1', sizeType: 'Heavy', weightMin: 0, weightMax: 12000, fee: 300, pickAndPackFee: 26 },
      { id: 'h2', sizeType: 'Heavy', weightMin: 12001, weightMax: 25000, fee: 300, pickAndPackFee: 31, useIncremental: true, incrementalStep: 1000, incrementalFee: 18 },
      { id: 'h3', sizeType: 'Heavy', weightMin: 25001, weightMax: 99999999, fee: 534, pickAndPackFee: 41, useIncremental: true, incrementalStep: 1000, incrementalFee: 12 }
    ];
    await ShippingFee.insertMany(initialShipping);
    console.log('[Revenue Calculator] Seeded shipping fees');
  }

  const storageCount = await StorageFee.countDocuments();
  if (storageCount === 0) {
    const initialStorage = [
      { id: 'st1', duration: 'Monthly', rate: 45, description: 'Standard Monthly Rate' }
    ];
    await StorageFee.insertMany(initialStorage);
    console.log('[Revenue Calculator] Seeded storage fees');
  }

  const categoryMapCount = await CategoryMap.countDocuments();
  if (categoryMapCount === 0) {
    const initialMappings = [
      { id: 'm1', keepaCategory: 'electronics', feeCategory: 'Electronics' },
      { id: 'm2', keepaCategory: 'books', feeCategory: 'Books' },
      { id: 'm3', keepaCategory: 'clothing', feeCategory: 'Clothing' },
      { id: 'm4', keepaCategory: 'apparel', feeCategory: 'Clothing' },
      { id: 'm5', keepaCategory: 'kitchen', feeCategory: 'Home & Kitchen' },
      { id: 'm6', keepaCategory: 'health', feeCategory: 'Health & Personal Care' },
      { id: 'm7', keepaCategory: 'toys', feeCategory: 'Toys & Games' },
      { id: 'm8', keepaCategory: 'sports', feeCategory: 'Sports & Outdoors' },
      { id: 'm9', keepaCategory: 'automotive', feeCategory: 'Automotive' },
      { id: 'm10', keepaCategory: 'tools', feeCategory: 'Tools & Home Improvement' },
      { id: 'm11', keepaCategory: 'beauty', feeCategory: 'Beauty' }
    ];
    await CategoryMap.insertMany(initialMappings);
    console.log('[Revenue Calculator] Seeded category mappings');
  }

  const nodeMapCount = await NodeMap.countDocuments();
  if (nodeMapCount === 0) {
    const initialNodeMaps = [
      { id: 'nm1', nodeId: '1571272031', feeCategoryName: 'Electronics' },
      { id: 'nm2', nodeId: '283155', feeCategoryName: 'Books' },
      { id: 'nm3', nodeId: '1571271031', feeCategoryName: 'Clothing' },
      { id: 'nm4', nodeId: '1571263031', feeCategoryName: 'Home & Kitchen' },
      { id: 'nm5', nodeId: '1571267031', feeCategoryName: 'Health & Personal Care' }
    ];
    await NodeMap.insertMany(initialNodeMaps);
    console.log('[Revenue Calculator] Seeded node mappings');
  }

  const refundCount = await RefundFee.countDocuments();
  if (refundCount === 0) {
    const initialRefund = [
      { id: 'rf1', minPrice: 0, maxPrice: 300, basic: 50, standard: 45, advanced: 40, premium: 40, category: 'General' },
      { id: 'rf2', minPrice: 301, maxPrice: 500, basic: 75, standard: 70, advanced: 65, premium: 65, category: 'General' },
      { id: 'rf3', minPrice: 501, maxPrice: 1000, basic: 100, standard: 95, advanced: 85, premium: 85, category: 'General' },
      { id: 'rf4', minPrice: 1001, maxPrice: 99999999, basic: 140, standard: 130, advanced: 110, premium: 110, category: 'General' },
      { id: 'rf5', minPrice: 0, maxPrice: 300, basic: 30, standard: 27, advanced: 24, premium: 24, category: 'Apparel' },
      { id: 'rf6', minPrice: 301, maxPrice: 500, basic: 45, standard: 42, advanced: 39, premium: 39, category: 'Apparel' },
      { id: 'rf7', minPrice: 501, maxPrice: 1000, basic: 60, standard: 57, advanced: 51, premium: 51, category: 'Apparel' },
      { id: 'rf8', minPrice: 1001, maxPrice: 99999999, basic: 84, standard: 78, advanced: 66, premium: 66, category: 'Apparel' },
      { id: 'rf9', minPrice: 0, maxPrice: 300, basic: 35, standard: 32, advanced: 28, premium: 28, category: 'Shoes' },
      { id: 'rf10', minPrice: 301, maxPrice: 500, basic: 50, standard: 47, advanced: 42, premium: 42, category: 'Shoes' },
      { id: 'rf11', minPrice: 501, maxPrice: 1000, basic: 65, standard: 62, advanced: 55, premium: 55, category: 'Shoes' },
      { id: 'rf12', minPrice: 1001, maxPrice: 99999999, basic: 90, standard: 85, advanced: 72, premium: 72, category: 'Shoes' }
    ];
    await RefundFee.insertMany(initialRefund);
    console.log('[Revenue Calculator] Seeded refund fees');
  }

  const userCount = await RevenueUser.countDocuments();
  if (userCount === 0) {
    const initialUser = {
      id: 'admin-1',
      email: 'info@easysell.in',
      role: 'admin'
    };
    await RevenueUser.create(initialUser);
    console.log('[Revenue Calculator] Seeded admin user (info@easysell.in / Easysell@123)');
  }
};

module.exports = {
  ReferralFee,
  ClosingFee,
  ShippingFee,
  StorageFee,
  CategoryMap,
  NodeMap,
  RefundFee,
  AsinItem,
  RevenueUser,
  seedInitialData
};
