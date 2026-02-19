// Types for Revenue Calculator
// These are JSDoc type definitions for JavaScript

/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} email
 * @property {'admin'} role
 */

/**
 * @typedef {Object} ReferralFeeTier
 * @property {number} minPrice
 * @property {number} maxPrice
 * @property {number} percentage
 */

/**
 * @typedef {Object} ReferralFee
 * @property {string} id
 * @property {string} category
 * @property {string} [nodeId]
 * @property {ReferralFeeTier[]} tiers
 */

/**
 * @typedef {Object} ClosingFee
 * @property {string} id
 * @property {number} minPrice
 * @property {number} maxPrice
 * @property {number} fee
 * @property {string} [category]
 * @property {string} [nodeId]
 * @property {'FC' | 'SF' | 'ES' | 'MFN'} [sellerType]
 */

/**
 * @typedef {Object} ShippingFee
 * @property {string} id
 * @property {'Standard' | 'Heavy' | 'Oversize'} sizeType
 * @property {number} weightMin
 * @property {number} weightMax
 * @property {number} fee
 * @property {boolean} [useIncremental]
 * @property {number} [incrementalFee]
 * @property {number} [incrementalStep]
 * @property {number} [pickAndPackFee]
 */

/**
 * @typedef {Object} StorageFee
 * @property {string} id
 * @property {string} duration
 * @property {number} rate
 * @property {string} [description]
 */

/**
 * @typedef {Object} CategoryMap
 * @property {string} id
 * @property {string} keepaCategory
 * @property {string} feeCategory
 */

/**
 * @typedef {Object} NodeMap
 * @property {string} id
 * @property {string} nodeId
 * @property {string} feeCategoryName
 */

/**
 * @typedef {Object} RefundFee
 * @property {string} id
 * @property {number} minPrice
 * @property {number} maxPrice
 * @property {number} basic
 * @property {number} standard
 * @property {number} advanced
 * @property {number} premium
 * @property {'General' | 'Apparel' | 'Shoes'} category
 */

// Export constants for easy access
export const AsinStatus = {
  PENDING: 'pending',
  FETCHED: 'fetched',
  CALCULATED: 'calculated',
  ERROR: 'error'
};

export const StepLevel = {
  BASIC: 'Basic',
  STANDARD: 'Standard',
  ADVANCED: 'Advanced',
  PREMIUM: 'Premium'
};

export const StapleLevel = {
  STANDARD: 'Standard',
  HEAVY: 'Heavy',
  OVERSIZE: 'Oversize'
};
