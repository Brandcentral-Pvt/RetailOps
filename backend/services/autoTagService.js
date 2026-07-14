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
        const result = await pool.request()
            .input('months', sql.Int, months)
            .query(`
                WITH GmsAgg AS (
                    SELECT
                        g.Asin as AsinCode,
                        SUM(ISNULL(g.OrderedRevenue, 0)) as TotalGms
                    FROM GmsDailyPerformance g WITH (NOLOCK)
                    WHERE g.Date >= DATEADD(MONTH, -@months, CAST(dbo.GetEnvDate() AS DATE))
                    GROUP BY g.Asin
                ),
                AsinGms AS (
                    SELECT
                        a.Id,
                        a.AsinCode,
                        a.Tags,
                        a.Brand,
                        agg.TotalGms
                    FROM Asins a WITH (NOLOCK)
                    INNER JOIN GmsAgg agg ON a.AsinCode = agg.AsinCode
                    WHERE a.Status = 'Active'
                        AND a.Brand IS NOT NULL AND a.Brand <> ''
                        AND agg.TotalGms > 0
                ),
                WithPct AS (
                    SELECT *,
                        SUM(TotalGms) OVER (PARTITION BY Brand) as BrandTotalGms,
                        ROUND(CAST(TotalGms AS FLOAT) / NULLIF(SUM(TotalGms) OVER (PARTITION BY Brand), 0) * 100, 2) as PctContribution
                    FROM AsinGms
                ),
                Cumulative AS (
                    SELECT *,
                        COUNT(*) OVER (PARTITION BY Brand) as AsinCount,
                        SUM(PctContribution) OVER (
                            PARTITION BY Brand
                            ORDER BY TotalGms DESC
                            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
                        ) as CumPct
                    FROM WithPct
                )
                SELECT
                    Id, AsinCode, Tags, Brand,
                    TotalGms, BrandTotalGms, PctContribution, CumPct, AsinCount,
                    CASE
                        WHEN AsinCount = 1 THEN 'Top 80% Contributor'
                        WHEN CumPct <= 80 THEN 'Top 80% Contributor'
                        ELSE 'Bottom 20% Contributor'
                    END as ParetoTag
                FROM Cumulative
                ORDER BY Brand, TotalGms DESC
            `);

        let updated = 0;
        const brandMap = {};

        for (const row of result.recordset) {
            let tags = [];
            try { tags = JSON.parse(row.Tags || '[]'); } catch { tags = []; }

            // Remove old Pareto tags
            tags = tags.filter(t => t !== 'Top 80% Contributor' && t !== 'Bottom 20% Contributor');
            tags.push(row.ParetoTag);

            await pool.request()
                .input('id', sql.VarChar, row.Id)
                .input('tags', sql.NVarChar, JSON.stringify(tags))
                .query('UPDATE Asins SET Tags = @tags, UpdatedAt = dbo.GetEnvDate() WHERE Id = @id');
            updated++;

            // Aggregate stats per brand
            if (!brandMap[row.Brand]) {
                brandMap[row.Brand] = { topCount: 0, bottomCount: 0, brandTotalGms: row.BrandTotalGms };
            }
            if (row.ParetoTag === 'Top 80% Contributor') {
                brandMap[row.Brand].topCount++;
            } else {
                brandMap[row.Brand].bottomCount++;
            }
        }

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
     * Run all auto-tag computations in sequence.
     * @param {object} pool
     * @returns {Promise<object>} summary
     */
    static async runAllAutoTags(pool) {
        console.log('[AutoTag] Starting full auto-tag run...');

        // Clear stale Pareto tags first
        const stalePareto = await this.clearStaleParetoTags(pool);
        console.log(`[AutoTag] Cleared ${stalePareto} stale Pareto tags`);

        // Compute Pareto 80/20 contributor tags
        const pareto = await this.computeParetoContributorTags(pool, 3);
        console.log(`[AutoTag] Pareto 80/20: ${pareto.updated} updated across ${pareto.brandCount} brands`);

        // Update age tags for all ASINs
        const ageResult = await this.batchUpdateAgeTags(pool);
        console.log(`[AutoTag] Age tags: ${ageResult.updated} updated, ${ageResult.skipped} skipped`);

        return {
            pareto,
            ageTags: ageResult,
            cleared: { pareto: stalePareto }
        };
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
