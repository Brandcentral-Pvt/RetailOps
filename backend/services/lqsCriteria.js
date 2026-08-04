/**
 * lqsCriteria — data-driven Listing Quality criteria (per category + marketplace).
 * Pure module (no AI deps) so it is unit-testable and reusable by the
 * rule-based analyzers and the AI prompt builder alike.
 */
const LQS_CRITERIA = {
  DEFAULT: {
    title: { minChars: 60, idealMin: 150, idealMax: 200, maxChars: 200, brandFirst: true, noAllCaps: true, noPromoWords: true },
    bullets: { min: 3, ideal: 5, max: 8, idealChar: [150, 250], capHeader: true, noPricing: true },
    images: { min: 1, ideal: 6, max: 9, whiteBg: true, highRes: true },
    description: { minChars: 200, maxChars: 2000, noPromo: true },
    weight: { title: 0.35, bullets: 0.25, images: 0.25, description: 0.15 },
  },
  ELECTRONICS: {
    title: { minChars: 60, idealMin: 150, idealMax: 180, maxChars: 200, brandFirst: true, noAllCaps: true, noPromoWords: true },
    bullets: { min: 4, ideal: 5, max: 8, idealChar: [150, 250], capHeader: true, noPricing: true },
    images: { min: 2, ideal: 7, max: 9, whiteBg: true, highRes: true },
    description: { minChars: 250, maxChars: 2000, noPromo: true },
    weight: { title: 0.35, bullets: 0.25, images: 0.25, description: 0.15 },
  },
  CLOTHING: {
    title: { minChars: 60, idealMin: 150, idealMax: 200, maxChars: 200, brandFirst: true, noAllCaps: true, noPromoWords: true },
    bullets: { min: 3, ideal: 5, max: 8, idealChar: [150, 250], capHeader: true, noPricing: true },
    images: { min: 2, ideal: 8, max: 9, whiteBg: true, highRes: true },
    description: { minChars: 150, maxChars: 2000, noPromo: true },
    weight: { title: 0.3, bullets: 0.25, images: 0.3, description: 0.15 },
  },
};

const MARKETPLACE_WORDING = {
  'www.amazon.in': { currency: 'INR', locale: 'en-IN' },
  'www.amazon.com': { currency: 'USD', locale: 'en-US' },
};

function getCategory(item) {
  const nodes = item?.browseNodeInfo?.browseNodes || [];
  return [nodes.map(n => n.displayName || n.contextFreeName).filter(Boolean).join(' > '), item?.category || ''].find(Boolean) || '';
}

function getMarketplace(item) {
  return item?.marketplace || process.env.LIVE_SYNC_MARKETPLACE || 'www.amazon.in';
}

function criteriaFor(item) {
  const cat = String(getCategory(item) || '').toUpperCase();
  const matched = Object.keys(LQS_CRITERIA).find(k => k !== 'DEFAULT' && cat.includes(k));
  return { ...LQS_CRITERIA.DEFAULT, ...(matched ? LQS_CRITERIA[matched] : {}) };
}

module.exports = { LQS_CRITERIA, MARKETPLACE_WORDING, criteriaFor, getCategory, getMarketplace };