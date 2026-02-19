const mongoose = require('mongoose');

// Referral Fee Schema
const referralFeeSchema = new mongoose.Schema({
    id: { type: String, unique: true }, // Keeping string ID for compatibility with existing data logic
    category: { type: String, required: true },
    tiers: [{
        minPrice: Number,
        maxPrice: Number,
        percentage: Number
    }]
}, { collection: 'referral_fees' });

// Closing Fee Schema
const closingFeeSchema = new mongoose.Schema({
    id: { type: String, unique: true },
    minPrice: Number,
    maxPrice: Number,
    fee: Number,
    category: String,
    sellerType: { type: String, enum: ['FC', 'SF', 'ES', 'MFN'] }
}, { collection: 'closing_fees' });

// Shipping Fee Schema
const shippingFeeSchema = new mongoose.Schema({
    id: { type: String, unique: true },
    sizeType: { type: String, enum: ['Standard', 'Heavy', 'Oversize'] },
    weightMin: Number,
    weightMax: Number,
    fee: Number,
    pickAndPackFee: Number,
    useIncremental: { type: Boolean, default: false },
    incrementalFee: Number,
    incrementalStep: Number
}, { collection: 'shipping_fees' });

// Storage Fee Schema
const storageFeeSchema = new mongoose.Schema({
    id: { type: String, unique: true },
    duration: String,
    rate: Number,
    description: String
}, { collection: 'storage_fees' });

// Category Mapping Schema
const categoryMapSchema = new mongoose.Schema({
    id: { type: String, unique: true },
    keepaCategory: String,
    feeCategory: String
}, { collection: 'category_mappings' });

// Node Mapping Schema
const nodeMapSchema = new mongoose.Schema({
    id: { type: String, unique: true },
    nodeId: String,
    feeCategoryName: String
}, { collection: 'node_mappings' });

// Refund Fee Schema
const refundFeeSchema = new mongoose.Schema({
    id: { type: String, unique: true },
    minPrice: Number,
    maxPrice: Number,
    basic: Number,
    standard: Number,
    advanced: Number,
    premium: Number,
    category: { type: String, enum: ['General', 'Apparel', 'Shoes'] }
}, { collection: 'refund_fees' });

const ReferralFee = mongoose.models.ReferralFee || mongoose.model('ReferralFee', referralFeeSchema);
const ClosingFee = mongoose.models.ClosingFee || mongoose.model('ClosingFee', closingFeeSchema);
const ShippingFee = mongoose.models.ShippingFee || mongoose.model('ShippingFee', shippingFeeSchema);
const StorageFee = mongoose.models.StorageFee || mongoose.model('StorageFee', storageFeeSchema);
const CategoryMap = mongoose.models.CategoryMap || mongoose.model('CategoryMap', categoryMapSchema);
const NodeMap = mongoose.models.NodeMap || mongoose.model('NodeMap', nodeMapSchema);
const RefundFee = mongoose.models.RefundFee || mongoose.model('RefundFee', refundFeeSchema);

module.exports = {
    ReferralFee,
    ClosingFee,
    ShippingFee,
    StorageFee,
    CategoryMap,
    NodeMap,
    RefundFee
};
