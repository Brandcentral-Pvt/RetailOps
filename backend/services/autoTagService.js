const { sql, getPool } = require('../database/db');

/**
 * Auto-Tag Service
 * Automatically adds age-based tags to ASINs based on their release date
 * Computes Pareto 80/20 contributor tags based on 3-month GMS per brand
 */

class AutoTagService {

    /**
     * Calculate age tags based on release date
     * @param {Date} releaseDate - The release date of the ASIN
     * @param {Date} referenceDate - Reference date (defaults to now)
     * @returns {string[]} Array of tags to add
     */
    static calculateAgeTags(releaseDate, referenceDate = new Date()) {
        if (!releaseDate) return [];

        const release = new Date(releaseDate);
        const now = new Date(referenceDate);
        const diffDays = Math.floor((now - release) / (1000 * 60 * 60 * 24));

        const tags = [];

        // Age-based tags
        if (diffDays >= 0 && diffDays <= 30) {
            tags.push('30Days');
        } else if (diffDays > 30 && diffDays <= 60) {
            tags.push('60 Days');
        } else if (diffDays > 60 && diffDays <= 90) {
            tags.push('90Days');
        } else if (diffDays > 90 && diffDays <= 180) {
            tags.push('180 Days');
        } else if (diffDays > 180 && diffDays <= 365) {
            tags.push('365 Days');
        } else if (diffDays > 365) {
            tags.push('365 + Days');
        }

        // Less than 60 days old tag
        if (diffDays >= 0 && diffDays < 60) {
            tags.push('< 60 Days Old');
        }

        return tags;
    }

    /**
     * Calculate age-based priority
     * @param {Date} releaseDate 
     * @returns {object} { daysSinceRelease, priority, needsReview }
     */
    static calculateAgePriority(releaseDate) {
        if (!releaseDate) return null;

        const release = new Date(releaseDate);
        const now = new Date();
        const diffDays = Math.floor((now - release) / (1000 * 60 * 60 * 24));

        let priority = 'Low';
        let needsReview = false;

        if (diffDays > 90) {
            priority = 'High';
            needsReview = true;
        } else if (diffDays > 60) {
            priority = 'Medium';
            needsReview = true;
        } else if (diffDays > 30) {
            priority = 'Low';
            needsReview = false;
        }

        return {
            daysSinceRelease: diffDays,
            priority,
            needsReview,
            ageCategory: diffDays <= 30 ? '30Days' : diffDays <= 60 ? '60 Days' : diffDays <= 90 ? '90Days' : diffDays <= 180 ? '180 Days' : diffDays <= 365 ? '365 Days' : '365 + Days'
        };
    }

    /**
     * Merge auto-generated tags with existing tags
     * @param {string[]} existingTags - Current tags from database
     * @param {string[]} autoTags - Auto-generated tags
     * @param {boolean} replaceAgeTags - Replace existing age tags with new ones
     * @returns {string[]} Merged tags array
     */
    static mergeTags(existingTags = [], autoTags = [], replaceAgeTags = true) {
        // Age-related tag patterns to identify
        const ageTagPatterns = [
            '30Days', '60 Days', '90Days', '180 Days', '365 Days', '365 + Days',
            'New Launch', 'New 30D', '30-60 Days', '60-90 Days', '90-180 Days', '180-365 Days', '365+ Days',
            'Growth Phase', 'Established', 'Mature', 'Veteran', 'Legacy',
            '30+ Days Live', '60+ Days Live', '90+ Days Live',
            'New', 'Growing', 'Established'
        ];

        let merged = [...existingTags];

        // Remove old age tags if replacing
        if (replaceAgeTags) {
            merged = merged.filter(tag => {
                const isAgeTag = ageTagPatterns.some(pattern => 
                    tag.toLowerCase() === pattern.toLowerCase() ||
                    tag.toLowerCase().includes('days') ||
                    tag.toLowerCase().includes('phase') ||
                    tag.toLowerCase().includes('mature') ||
                    tag.toLowerCase().includes('veteran') ||
                    tag.toLowerCase().includes('legacy') ||
                    tag.toLowerCase().includes('growing') ||
                    tag.toLowerCase().includes('established')
                );
                return !isAgeTag;
            });
        }

        // Add new auto tags
        for (const tag of autoTags) {
            if (!merged.includes(tag)) {
                merged.push(tag);
            }
        }

        return merged;
    }

    /**
     * Remove stale Pareto contributor tags from all ASINs.
     * Must be called BEFORE computeParetoContributorTags to clean old tags.
     * @param {object} pool
     * @returns {Promise<number>} count of tags removed
     */
    static async clearStaleParetoTags(pool) {
        const result = await pool.request()
            .query(`
                SELECT Id, Tags FROM Asins
                WHERE Tags LIKE '%Top 80% Contributor%'
                   OR Tags LIKE '%Bottom 20% Contributor%'
            `);
        let cleared = 0;
        for (const row of result.recordset) {
            let tags = [];
            try { tags = JSON.parse(row.Tags || '[]'); } catch { continue; }
            const filtered = tags.filter(t =>
                t !== 'Top 80% Contributor' && t !== 'Bottom 20% Contributor'
            );
            if (filtered.length !== tags.length) {
                await pool.request()
                    .input('id', sql.VarChar, row.Id)
                    .input('tags', sql.NVarChar, JSON.stringify(filtered))
                    .query('UPDATE Asins SET Tags = @tags, UpdatedAt = dbo.GetEnvDate() WHERE Id = @id');
                cleared++;
            }
        }
        return cleared;
    }

    /**
     * Compute Pareto 80/20 contributor tags per brand from last N months of GMS data.
     * For each brand, calculates each ASIN's % contribution to brand GMS,
     * then tags ASINs in the top 80% cumulative as "Top 80% Contributor"
     * and the rest as "Bottom 20% Contributor".
     * @param {object} pool - Database connection pool
     * @param {number} months - Lookback window (default 3)
     * @returns {Promise<object>} { updated, total, brandCount, details }
     */
    static async computeParetoContributorTags(pool, months = 3) {
        // Step 1: Get ASIN-level 3-month GMS grouped by brand, sorted descending
        const req = pool.request();
        req.input('months', sql.Int, months);
        const result = await req.query(`
                SELECT a.Id, a.AsinCode, a.Tags, a.Brand,
                    CAST(SUM(ISNULL(g.OrderedRevenue, 0)) AS FLOAT) as TotalGms
                FROM GmsDailyPerformance g WITH (NOLOCK)
                INNER JOIN Asins a WITH (NOLOCK) ON g.Asin = a.AsinCode
                WHERE g.Date >= DATEADD(MONTH, -@months, CAST(dbo.GetEnvDate() AS DATE))
                    AND a.Status = 'Active'
                    AND a.Brand IS NOT NULL AND a.Brand <> ''
                GROUP BY a.Id, a.AsinCode, a.Tags, a.Brand
                HAVING SUM(ISNULL(g.OrderedRevenue, 0)) > 0
                ORDER BY a.Brand, SUM(ISNULL(g.OrderedRevenue, 0)) DESC
            `);

        // Step 2: Process in JavaScript — group by brand, compute Pareto in memory
        const brandGroups = {};
        for (const row of result.recordset) {
            if (!brandGroups[row.Brand]) brandGroups[row.Brand] = [];
            brandGroups[row.Brand].push(row);
        }

        let updated = 0;
        const brandMap = {};
        const BATCH_SIZE = 100;
        let updateBatch = [];

        async function flushBatch() {
            if (updateBatch.length === 0) return;
            await Promise.all(updateBatch.map(item =>
                pool.request()
                    .input('id', sql.VarChar, item.id)
                    .input('tags', sql.NVarChar, JSON.stringify(item.tags))
                    .query('UPDATE Asins SET Tags = @tags, UpdatedAt = dbo.GetEnvDate() WHERE Id = @id')
            ));
            updated += updateBatch.length;
            updateBatch = [];
        }

        for (const [brand, asins] of Object.entries(brandGroups)) {
            const brandTotal = asins.reduce((sum, a) => sum + a.TotalGms, 0);
            if (brandTotal <= 0) continue;

            let cumPct = 0;
            let topCount = 0;
            let bottomCount = 0;

            for (const asin of asins) {
                const pct = Math.round((asin.TotalGms / brandTotal) * 10000) / 100;
                cumPct = Math.round((cumPct + pct) * 100) / 100;

                const isSingleAsin = asins.length === 1;
                const tag = isSingleAsin || cumPct <= 80
                    ? 'Top 80% Contributor'
                    : 'Bottom 20% Contributor';

                if (tag === 'Top 80% Contributor') topCount++;
                else bottomCount++;

                let tags = [];
                try { tags = JSON.parse(asin.Tags || '[]'); } catch { tags = []; }
                tags = tags.filter(t => t !== 'Top 80% Contributor' && t !== 'Bottom 20% Contributor');
                tags.push(tag);

                updateBatch.push({ id: asin.Id, tags });

                if (updateBatch.length >= BATCH_SIZE) {
                    await flushBatch();
                }
            }

            brandMap[brand] = { topCount, bottomCount, brandTotalGms: brandTotal };
        }

        await flushBatch();

        const details = Object.entries(brandMap).map(([brand, stats]) => ({
            brand,
            ...stats
        }));

        return {
            updated,
            total: result.recordset.length,
            brandCount: Object.keys(brandMap).length,
            details
        };
    }

    /**
     * Remove stale "Top 20 By GMS" tags from all ASINs.
     * Must be called BEFORE computeTop20ByGmsTags.
     * @param {object} pool
     * @returns {Promise<number>} count of tags removed
     */
    static async clearStaleTop20ByGmsTags(pool) {
        const result = await pool.request()
            .query(`
                SELECT Id, Tags FROM Asins
                WHERE Tags LIKE '%Top 20 By GMS%'
            `);
        let cleared = 0;
        for (const row of result.recordset) {
            let tags = [];
            try { tags = JSON.parse(row.Tags || '[]'); } catch { continue; }
            const filtered = tags.filter(t => t !== 'Top 20 By GMS');
            if (filtered.length !== tags.length) {
                await pool.request()
                    .input('id', sql.VarChar, row.Id)
                    .input('tags', sql.NVarChar, JSON.stringify(filtered))
                    .query('UPDATE Asins SET Tags = @tags, UpdatedAt = dbo.GetEnvDate() WHERE Id = @id');
                cleared++;
            }
        }
        return cleared;
    }

    /**
     * Compute "Top 20 By GMS" tags per brand.
     * From the set of ASINs tagged as "Top 80% Contributor",
     * picks the top 20 by GMS and tags them with "Top 20 By GMS".
     * @param {object} pool - Database connection pool
     * @param {number} months - Lookback window (default 3)
     * @returns {Promise<object>} { updated, total, brandCount }
     */
    static async computeTop20ByGmsTags(pool, months = 3) {
        const result = await pool.request()
            .input('months', sql.Int, months)
            .query(`
                SELECT a.Id, a.AsinCode, a.Tags, a.Brand,
                    CAST(SUM(ISNULL(g.OrderedRevenue, 0)) AS FLOAT) as TotalGms
                FROM GmsDailyPerformance g WITH (NOLOCK)
                INNER JOIN Asins a WITH (NOLOCK) ON g.Asin = a.AsinCode
                WHERE g.Date >= DATEADD(MONTH, -@months, CAST(dbo.GetEnvDate() AS DATE))
                    AND a.Status = 'Active'
                    AND a.Tags LIKE '%Top 80% Contributor%'
                    AND a.Brand IS NOT NULL AND a.Brand <> ''
                GROUP BY a.Id, a.AsinCode, a.Tags, a.Brand
                HAVING SUM(ISNULL(g.OrderedRevenue, 0)) > 0
                ORDER BY a.Brand, SUM(ISNULL(g.OrderedRevenue, 0)) DESC
            `);

        const brandGroups = {};
        for (const row of result.recordset) {
            if (!brandGroups[row.Brand]) brandGroups[row.Brand] = [];
            brandGroups[row.Brand].push(row);
        }

        let updated = 0;
        const BATCH_SIZE = 100;
        let updateBatch = [];

        async function flushBatch() {
            if (updateBatch.length === 0) return;
            await Promise.all(updateBatch.map(item =>
                pool.request()
                    .input('id', sql.VarChar, item.id)
                    .input('tags', sql.NVarChar, JSON.stringify(item.tags))
                    .query('UPDATE Asins SET Tags = @tags, UpdatedAt = dbo.GetEnvDate() WHERE Id = @id')
            ));
            updated += updateBatch.length;
            updateBatch = [];
        }

        for (const [brand, asins] of Object.entries(brandGroups)) {
            const top20 = asins.slice(0, 20);
            for (const asin of top20) {
                let tags = [];
                try { tags = JSON.parse(asin.Tags || '[]'); } catch { tags = []; }
                if (!tags.includes('Top 20 By GMS')) {
                    tags.push('Top 20 By GMS');
                    updateBatch.push({ id: asin.Id, tags });
                    if (updateBatch.length >= BATCH_SIZE) {
                        await flushBatch();
                    }
                }
            }
        }

        await flushBatch();

        return {
            updated,
            total: result.recordset.length,
            brandCount: Object.keys(brandGroups).length
        };
    }

    /**
     * Remove stale "Price Dispute" tags from all ASINs.
     * Must be called BEFORE computePriceDisputeTags.
     * @param {object} pool
     * @returns {Promise<number>} count of tags removed
     */
    static async clearStalePriceDisputeTags(pool) {
        const result = await pool.request()
            .query(`
                SELECT Id, Tags FROM Asins
                WHERE Tags LIKE '%Price Dispute%'
            `);
        let cleared = 0;
        for (const row of result.recordset) {
            let tags = [];
            try { tags = JSON.parse(row.Tags || '[]'); } catch { continue; }
            const filtered = tags.filter(t => t !== 'Price Dispute');
            if (filtered.length !== tags.length) {
                await pool.request()
                    .input('id', sql.VarChar, row.Id)
                    .input('tags', sql.NVarChar, JSON.stringify(filtered))
                    .query('UPDATE Asins SET Tags = @tags, UpdatedAt = dbo.GetEnvDate() WHERE Id = @id');
                cleared++;
            }
        }
        return cleared;
    }

    /**
     * Compute "Price Dispute" tags.
     * Tags Active ASINs where |UploadedPrice - CurrentPrice| > 5 and no proper deal badge.
     * @param {object} pool - Database connection pool
     * @returns {Promise<object>} { updated, total }
     */
    static async computePriceDisputeTags(pool) {
        const PROPER_DEAL_RE = /^(lightning|limited time deal|best deal|prime exclusive|subscribe.?and.?save|deal of the day|coupon)$/i;

        const result = await pool.request()
            .query(`
                SELECT Id, Tags, UploadedPrice, CurrentPrice, DealBadge
                FROM Asins
                WHERE Status = 'Active'
                    AND UploadedPrice > 0 AND CurrentPrice > 0
                    AND ABS(UploadedPrice - CurrentPrice) > 5
            `);

        let updated = 0;
        const BATCH_SIZE = 100;
        let updateBatch = [];

        async function flushBatch() {
            if (updateBatch.length === 0) return;
            await Promise.all(updateBatch.map(item =>
                pool.request()
                    .input('id', sql.VarChar, item.id)
                    .input('tags', sql.NVarChar, JSON.stringify(item.tags))
                    .query('UPDATE Asins SET Tags = @tags, UpdatedAt = dbo.GetEnvDate() WHERE Id = @id')
            ));
            updated += updateBatch.length;
            updateBatch = [];
        }

        for (const row of result.recordset) {
            const hasProperDeal = row.DealBadge && PROPER_DEAL_RE.test((row.DealBadge || '').trim());
            if (hasProperDeal) continue;

            let tags = [];
            try { tags = JSON.parse(row.Tags || '[]'); } catch { tags = []; }
            if (!tags.includes('Price Dispute')) {
                tags.push('Price Dispute');
                updateBatch.push({ id: row.Id, tags });
                if (updateBatch.length >= BATCH_SIZE) {
                    await flushBatch();
                }
            }
        }

        await flushBatch();

        return { updated, total: result.recordset.length };
    }

    /**
     * Run all auto-tag computations in sequence.
     * Order: clear stale → Pareto 80/20 → Top 20 By GMS → Price Dispute → Age tags
     * @param {object} pool
     * @returns {Promise<object>} summary
     */
    static async runAllAutoTags(pool) {
        console.log('[AutoTag] Starting full auto-tag run...');
        const results = {};

        try {
            // 1. Clear all stale auto-tags
            results.clearedPareto = await this.clearStaleParetoTags(pool);
            console.log(`[AutoTag] Cleared ${results.clearedPareto} stale Pareto tags`);
            results.clearedTop20 = await this.clearStaleTop20ByGmsTags(pool);
            console.log(`[AutoTag] Cleared ${results.clearedTop20} stale Top 20 By GMS tags`);
            results.clearedPriceDispute = await this.clearStalePriceDisputeTags(pool);
            console.log(`[AutoTag] Cleared ${results.clearedPriceDispute} stale Price Dispute tags`);

            // 2. Compute Pareto 80/20 contributor tags
            const pareto = await this.computeParetoContributorTags(pool, 3);
            console.log(`[AutoTag] Pareto 80/20: ${pareto.updated} updated across ${pareto.brandCount} brands`);

            // 3. Compute Top 20 By GMS tags (from within Top 80% Contributor set)
            const top20 = await this.computeTop20ByGmsTags(pool, 3);
            console.log(`[AutoTag] Top 20 By GMS: ${top20.updated} updated across ${top20.brandCount} brands`);

            // 4. Compute Price Dispute tags
            const priceDispute = await this.computePriceDisputeTags(pool);
            console.log(`[AutoTag] Price Dispute: ${priceDispute.updated} updated out of ${priceDispute.total} candidates`);

            // 5. Update age tags for all ASINs (runs last so it preserves all other tags)
            const age = await this.batchUpdateAgeTags(pool);
            console.log(`[AutoTag] Age tags: ${age.updated} updated, ${age.skipped} skipped`);

            results.pareto = pareto;
            results.top20ByGms = top20;
            results.priceDispute = priceDispute;
            results.ageTags = age;
            results.cleared = {
                pareto: results.clearedPareto,
                top20ByGms: results.clearedTop20,
                priceDispute: results.clearedPriceDispute
            };

        } catch (err) {
            console.error('[AutoTag] Fatal error during auto-tag run:', err);
            throw err;
        }

        return results;
    }

    /**
     * Get all ASINs that need age tag updates
     * @param {object} pool - Database connection pool
     * @returns {Promise<Array>} ASINs needing updates
     */
    static async getAsinsNeedingAgeUpdate(pool) {
        const result = await pool.request().query(`
            SELECT Id, AsinCode, ReleaseDate, Tags, CreatedAt
            FROM Asins 
            WHERE ReleaseDate IS NOT NULL
            ORDER BY ReleaseDate ASC
        `);
        return result.recordset;
    }

    /**
     * Batch update age tags for all ASINs
     * @param {object} pool - Database connection pool
     * @returns {Promise<object>} Update summary
     */
    static async batchUpdateAgeTags(pool) {
        const asins = await this.getAsinsNeedingAgeUpdate(pool);
        let updated = 0;
        let skipped = 0;

        for (const asin of asins) {
            try {
                const autoTags = this.calculateAgeTags(asin.ReleaseDate);
                if (autoTags.length === 0) {
                    skipped++;
                    continue;
                }

                let existingTags = [];
                try {
                    existingTags = JSON.parse(asin.Tags || '[]');
                } catch (e) {
                    existingTags = [];
                }

                const mergedTags = this.mergeTags(existingTags, autoTags, true);

                // Check if tags actually changed
                const currentTags = JSON.stringify(existingTags.sort());
                const newTags = JSON.stringify(mergedTags.sort());

                if (currentTags !== newTags) {
                    await pool.request()
                        .input('id', sql.VarChar, asin.Id)
                        .input('tags', sql.NVarChar, JSON.stringify(mergedTags))
                        .query('UPDATE Asins SET Tags = @tags, UpdatedAt = dbo.GetEnvDate() WHERE Id = @id');
                    updated++;
                } else {
                    skipped++;
                }
            } catch (e) {
                console.error(`Failed to update age tags for ${asin.AsinCode}:`, e.message);
                skipped++;
            }
        }

        console.log(`[AutoTag] Updated ${updated} ASINs, skipped ${skipped}`);
        return { updated, skipped, total: asins.length };
    }
}

module.exports = AutoTagService;
