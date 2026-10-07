/**
 * ASIN Completeness Service
 *
 * Single source of truth for "does a seller have ALL its listing + content
 * data?" Used by BOTH the Playwright scraper cron and the Live Data Sync cron
 * so they can guarantee "complete one seller's data before moving to the next".
 *
 *  - HARD fields  : required for a row to count as complete. These are filled
 *                    by the Live sync API path (title/price/img/BSR/bullets)
 *                    and the Playwright scraper (rating/reviews/A+).
 *  - SOFT field   : ProductDescription is only reported (not blocking) unless
 *                    LIVE_SYNC_REQUIRE_DESCRIPTION=true — many ASINs have no
 *                    description on the page, so it must not stall the pipeline.
 */
const { sql, getPool } = require('../database/db');

const REQUIRE_DESCRIPTION = process.env.LIVE_SYNC_REQUIRE_DESCRIPTION === 'true';

const HARD_FIELDS = [
    `Title IS NOT NULL AND LTRIM(RTRIM(Title)) <> '' AND Title NOT LIKE '%Amazon Product%'`,
    `CurrentPrice > 0`,
    `ImageUrl IS NOT NULL AND LTRIM(RTRIM(ImageUrl)) <> ''`,
    `BSR > 0`,
    `Rating IS NOT NULL`,
    `ReviewCount IS NOT NULL`,
    `BulletPoints > 0`,
    `HasAplus IS NOT NULL`,
];

function buildHardPredicate(includeDescription = REQUIRE_DESCRIPTION) {
    let predicate = HARD_FIELDS.map((f) => `(${f})`).join(' AND ');
    if (includeDescription) {
        predicate += ` AND (LEN(ISNULL(ProductDescription, '')) >= 100)`;
    }
    return predicate;
}

const HARD_PREDICATE = buildHardPredicate();

/**
 * Completeness metrics for a seller: { total, complete, incomplete, percent }.
 * @param {string} sellerId
 * @param {object} [opts]
 * @param {string} [opts.scopeWhere] Extra SQL AND-clause (default: Status = 'Active')
 */
async function getSellerCompleteness(sellerId, { scopeWhere = "Status = 'Active'" } = {}) {
    const pool = await getPool();
    const result = await pool.request()
        .input('sellerId', sql.VarChar, sellerId)
        .query(`
            SELECT
                COUNT(*) AS TotalAsins,
                SUM(CASE WHEN ${buildHardPredicate()} THEN 1 ELSE 0 END) AS CompleteAsins
            FROM Asins
            WHERE SellerId = @sellerId AND (${scopeWhere})
        `);
    const row = result.recordset[0];
    const total = Number(row?.TotalAsins) || 0;
    const complete = Number(row?.CompleteAsins) || 0;
    return {
        total,
        complete,
        incomplete: Math.max(0, total - complete),
        percent: total > 0 ? +((complete / total) * 100).toFixed(1) : 100,
    };
}

/**
 * Which fields are missing, per field, for the seller's active ASINs.
 * Useful for the run log + retry targeting.
 */
async function getMissingFieldBreakdown(sellerId, { scopeWhere = "Status = 'Active'" } = {}) {
    const pool = await getPool();
    const result = await pool.request()
        .input('sellerId', sql.VarChar, sellerId)
        .query(`
            SELECT
                SUM(CASE WHEN Title IS NULL OR LTRIM(RTRIM(Title)) = '' OR Title LIKE '%Amazon Product%' THEN 1 ELSE 0 END) AS missingTitle,
                SUM(CASE WHEN ISNULL(CurrentPrice, 0) <= 0 THEN 1 ELSE 0 END) AS missingPrice,
                SUM(CASE WHEN ImageUrl IS NULL OR LTRIM(RTRIM(ImageUrl)) = '' THEN 1 ELSE 0 END) AS missingImage,
                SUM(CASE WHEN ISNULL(BSR, 0) <= 0 THEN 1 ELSE 0 END) AS missingBsr,
                SUM(CASE WHEN Rating IS NULL THEN 1 ELSE 0 END) AS missingRating,
                SUM(CASE WHEN ReviewCount IS NULL THEN 1 ELSE 0 END) AS missingReviews,
                SUM(CASE WHEN ISNULL(BulletPoints, 0) <= 0 THEN 1 ELSE 0 END) AS missingBullets,
                SUM(CASE WHEN HasAplus IS NULL THEN 1 ELSE 0 END) AS missingAplus,
                SUM(CASE WHEN LEN(ISNULL(ProductDescription, '')) < 100 THEN 1 ELSE 0 END) AS missingDescription
            FROM Asins
            WHERE SellerId = @sellerId AND (${scopeWhere})
        `);
    const row = result.recordset[0] || {};
    const out = {};
    for (const key of Object.keys(row)) {
        out[key] = Number(row[key]) || 0;
    }
    return out;
}

/**
 * List the seller's incomplete active ASINs (bounded) so a pipeline can
 * re-sync ONLY what is still missing instead of the whole seller.
 */
async function listIncompleteAsins(sellerId, { limit = 500, scopeWhere = "Status = 'Active'" } = {}) {
    const pool = await getPool();
    const result = await pool.request()
        .input('sellerId', sql.VarChar, sellerId)
        .input('limit', sql.Int, Math.max(1, limit))
        .query(`
            SELECT TOP (@limit) Id, AsinCode
            FROM Asins
            WHERE SellerId = @sellerId
              AND (${scopeWhere})
              AND NOT (${buildHardPredicate()})
            ORDER BY AsinCode
        `);
    return result.recordset;
}

/**
 * Order all active Amazon sellers so the ones with the most incomplete ASINs
 * come first — used by both cron loops so an interrupted run resumes the
 * sellers that need the most work.
 */
async function getSellersOrderedByIncompleteness({ marketplace = 'amazon.in', minAsins = 1 } = {}) {
    const pool = await getPool();
    const result = await pool.request()
        .input('marketplace', sql.NVarChar, marketplace)
        .query(`
            SELECT s.Id, s.Name,
                   COUNT(a.Id) AS TotalAsins,
                   SUM(CASE WHEN ${buildHardPredicate()} THEN 1 ELSE 0 END) AS CompleteAsins
            FROM Sellers s
            JOIN Asins a ON a.SellerId = s.Id AND a.Status = 'Active'
            WHERE s.IsActive = 1 AND LOWER(s.Marketplace) = LOWER(@marketplace)
            GROUP BY s.Id, s.Name
            HAVING COUNT(a.Id) >= ${Math.max(1, Number(minAsins) || 1)}
            ORDER BY (COUNT(a.Id) - SUM(CASE WHEN ${buildHardPredicate()} THEN 1 ELSE 0 END)) DESC, s.Name
        `);
    return result.recordset.map((r) => ({
        id: r.Id,
        name: r.Name,
        totalAsins: Number(r.TotalAsins) || 0,
        completeAsins: Number(r.CompleteAsins) || 0,
        incompleteAsins: Math.max(0, (Number(r.TotalAsins) || 0) - (Number(r.CompleteAsins) || 0)),
    }));
}

module.exports = {
    HARD_FIELDS,
    HARD_PREDICATE,
    buildHardPredicate,
    REQUIRE_DESCRIPTION,
    getSellerCompleteness,
    getMissingFieldBreakdown,
    listIncompleteAsins,
    getSellersOrderedByIncompleteness,
};