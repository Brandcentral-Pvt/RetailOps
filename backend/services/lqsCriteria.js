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
    amazonInCompliance: {
      title: [
        'Brand should appear early and clearly in the title.',
        'Avoid promotional words such as SALE, FREE, BEST, GUARANTEED, or excessive punctuation.',
        'Do not use all caps for non-brand words and avoid keyword stuffing.'
      ],
      bullets: [
        'Use benefit-led bullet points that explain product value to Indian shoppers.',
        'Avoid pricing, shipping claims, seller information, or superiority claims.',
        'Each bullet should be specific, readable, and customer-focused.'
      ],
      images: [
        'The main image should have a pure white background and a clean product hero composition.',
        'Use clear, high-resolution images that support the product story and Amazon.in listing expectations.',
        'Avoid watermark, text overlays, clutter, or non-compliant lifestyle imagery in the main image.'
      ],
      description: [
        'Description should explain product features, usage, and key benefits plainly.',
        'Do not use exaggerated promotional language or policy-breaking claims.',
        'Keep the content accurate, readable, and tailored for Amazon.in shoppers.'
      ]
    }
  },
  ELECTRONICS: {
    title: { minChars: 60, idealMin: 150, idealMax: 180, maxChars: 200, brandFirst: true, noAllCaps: true, noPromoWords: true },
    bullets: { min: 4, ideal: 5, max: 8, idealChar: [150, 250], capHeader: true, noPricing: true },
    images: { min: 2, ideal: 7, max: 9, whiteBg: true, highRes: true },
    description: { minChars: 250, maxChars: 2000, noPromo: true },
    weight: { title: 0.35, bullets: 0.25, images: 0.25, description: 0.15 },
    amazonInCompliance: {
      title: [
        'For electronics, the title must stay concise and product-focused.',
        'Mention core model or key attribute only if it is factual and relevant.'
      ],
      bullets: [
        'Highlight features, compatibility, and practical benefits.',
        'Avoid unsupported claims, warranty promises, or vague superlatives.'
      ],
      images: [
        'Show the actual product clearly, preferably with detailed close-ups and usage context.',
        'Ensure the primary image is clean and compliant with Amazon.in image rules.'
      ],
      description: [
        'Include compatibility details, usage conditions, and notable technical benefits.',
        'Avoid unverified performance or comparison claims.'
      ]
    }
  },
  CLOTHING: {
    title: { minChars: 60, idealMin: 150, idealMax: 200, maxChars: 200, brandFirst: true, noAllCaps: true, noPromoWords: true },
    bullets: { min: 3, ideal: 5, max: 8, idealChar: [150, 250], capHeader: true, noPricing: true },
    images: { min: 2, ideal: 8, max: 9, whiteBg: true, highRes: true },
    description: { minChars: 150, maxChars: 2000, noPromo: true },
    weight: { title: 0.3, bullets: 0.25, images: 0.3, description: 0.15 },
    amazonInCompliance: {
      title: [
        'For apparel, the title should identify the product type, fit, and key material clearly.',
        'Do not include irrelevant promotional language or style-only claims.'
      ],
      bullets: [
        'Describe fit, material, care, and usage clearly for Indian shoppers.',
        'Avoid unsupported sizing or quality claims.'
      ],
      images: [
        'Show fit and material clearly, with accurate and clean visuals.',
        'The main image should be crisp and free of clutter or non-compliant text.'
      ],
      description: [
        'Explain the fit, material, care, and features in a helpful way.',
        'Avoid making claims that cannot be proven from the product information.'
      ]
    }
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
  const marketplace = getMarketplace(item);
  const matched = Object.keys(LQS_CRITERIA).find(k => k !== 'DEFAULT' && cat.includes(k));
  const base = { ...LQS_CRITERIA.DEFAULT, ...(matched ? LQS_CRITERIA[matched] : {}) };
  return {
    ...base,
    marketplace,
    currency: (MARKETPLACE_WORDING[marketplace] || MARKETPLACE_WORDING['www.amazon.in']).currency,
    locale: (MARKETPLACE_WORDING[marketplace] || MARKETPLACE_WORDING['www.amazon.in']).locale,
  };
}

module.exports = { LQS_CRITERIA, MARKETPLACE_WORDING, criteriaFor, getCategory, getMarketplace };