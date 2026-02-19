/**
 * Calculate LQS (Listing Quality Score) for an ASIN
 * @param {Object} asin
 * @returns {number} Score between 0 and 100
 */
export const calculateLQS = (asin) => {
    let score = 100;

    // Title completeness (max 15 points)
    const title = asin.title || '';
    if (title.length < 50) score -= 10;
    else if (title.length < 80) score -= 5;

    // Images (max 20 points)
    // Check both imagesCount and imagesCSV
    let imagesCount = asin.imagesCount || 0;
    if (!imagesCount && asin.imagesCSV) {
        imagesCount = asin.imagesCSV.split(',').length;
    }

    if (imagesCount === 0) score -= 20;
    else if (imagesCount < 5) score -= 10;

    // Price (max 15 points)
    const price = Number(asin.price || asin.currentPrice || 0);
    const mrp = Number(asin.mrp || 0);
    if (price === 0) score -= 15;
    else if (mrp > 0 && price > mrp) score -= 10;

    // Rating (max 20 points)
    const rating = Number(asin.rating || 0);
    if (rating < 3) score -= 20;
    else if (rating < 4) score -= 10;

    // Reviews (max 15 points)
    const reviews = Number(asin.reviewCount || asin.reviews || 0);
    if (reviews === 0) score -= 15;
    else if (reviews < 10) score -= 8;

    // Ranking (max 15 points)
    const rank = Number(asin.currentRank || asin.salesRank || 0);
    if (rank === 0) score -= 15; // No rank is usually bad
    else if (rank > 50000) score -= 15;
    else if (rank > 20000) score -= 8;
    else if (rank > 10000) score -= 4;

    return Math.max(0, score);
};

/**
 * Get list of LQS issues
 * @param {Object} asin
 * @returns {string[]} List of issues
 */
export const getLQSIssues = (asin) => {
    const issues = [];

    const title = asin.title || '';
    if (title.length < 50) issues.push('Title too short (< 50 chars)');

    let imagesCount = asin.imagesCount || 0;
    if (!imagesCount && asin.imagesCSV) {
        imagesCount = asin.imagesCSV.split(',').length;
    }
    if (imagesCount < 5) issues.push(`Missing images (Has ${imagesCount}, needs 5+)`);

    const rating = Number(asin.rating || 0);
    if (rating < 4) issues.push(`Low rating (${rating})`);

    const reviews = Number(asin.reviewCount || asin.reviews || 0);
    if (reviews < 10) issues.push(`Few reviews (${reviews})`);

    const rank = Number(asin.currentRank || asin.salesRank || 0);
    if (rank > 50000) issues.push(`Poor ranking (#${rank})`);

    return issues;
};
