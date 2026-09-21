/* CLI: node backend/scripts/backfillAsinHistory.js [--weeks=12] [--sub-bsr] [--dry-run]
 *
 * One-off backfill for the ASIN history tables (docs/asin-manager-deep-dive.md → F10).
 *
 *   AsinWeekHistory — weekly rows only ever appeared when a human pressed the
 *                     week-history buttons, so weekly trends were empty for every
 *                     ASIN that was scraped normally. This rebuilds them, for the
 *                     last `--weeks` ISO weeks, from the daily `AsinHistory` rows
 *                     that already exist.
 *   SubBsrHistory   — had no writer at all from the day it was created. This seeds
 *                     today's row for every ASIN that currently carries a
 *                     `SubBSRs` / `SubBSRCategory` value on the `Asins` row.
 *
 * Safe to re-run: both steps are idempotent MERGEs keyed on the same natural keys
 * the live writers use. `--dry-run` prints the row counts that would be touched.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { sql, getPool } = require('../database/db');
const asinHistoryService = require('../services/asinHistoryService');

const argOf = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
};
const hasFlag = (name) => process.argv.includes(`--${name}`);

const WEEKS = Math.max(1, Math.min(parseInt(argOf('weeks', '12'), 10) || 12, 104));
const LIMIT = Math.max(1, parseInt(argOf('limit', '100000'), 10) || 100000);
const DRY_RUN = hasFlag('dry-run');
const SEED_SUB_BSR = hasFlag('sub-bsr') || !hasFlag('no-sub-bsr');

async function backfillWeeks(pool) {
  console.log(`\n▸ Weekly aggregates — rebuilding the last ${WEEKS} ISO week(s) from AsinHistory…`);

  const countResult = await pool.request()
    .input('weeks', sql.Int, WEEKS)
    .query(`
      SELECT COUNT(*) AS rows_to_merge FROM (
        SELECT h.AsinId, ${asinHistoryService.weekStartSql('CAST(h.[Date] AS DATE)')} AS WeekStartDate
        FROM AsinHistory h WITH (NOLOCK)
        WHERE h.[Date] >= DATEADD(week, -@weeks, CAST(dbo.GetEnvDate() AS DATE))
        GROUP BY h.AsinId, ${asinHistoryService.weekStartSql('CAST(h.[Date] AS DATE)')}
      ) AS buckets
    `);
  const buckets = countResult.recordset[0] ? countResult.recordset[0].rows_to_merge : 0;
  console.log(`  ${buckets} (ASIN, week) bucket(s) found`);

  if (DRY_RUN || buckets === 0) return { buckets, merged: 0 };

  const result = await pool.request()
    .input('weeks', sql.Int, WEEKS)
    .query(`
      MERGE AsinWeekHistory AS target
      USING (
        SELECT
          h.AsinId,
          ${asinHistoryService.weekStartSql('CAST(h.[Date] AS DATE)')} AS WeekStartDate,
          AVG(CAST(h.Price AS DECIMAL(18, 2))) AS AvgPrice,
          AVG(CAST(h.BSR AS DECIMAL(18, 2))) AS AvgBSR,
          AVG(CAST(h.Rating AS DECIMAL(3, 2))) AS AvgRating,
          MAX(h.ReviewCount) AS TotalReviews,
          AVG(CAST(h.LQS AS DECIMAL(5, 2))) AS AvgLQS
        FROM AsinHistory h WITH (NOLOCK)
        WHERE h.[Date] >= DATEADD(week, -@weeks, CAST(dbo.GetEnvDate() AS DATE))
        GROUP BY h.AsinId, ${asinHistoryService.weekStartSql('CAST(h.[Date] AS DATE)')}
      ) AS source
      ON target.AsinId = source.AsinId AND target.WeekStartDate = source.WeekStartDate
      WHEN MATCHED THEN
        UPDATE SET
          AvgPrice = source.AvgPrice,
          AvgBSR = source.AvgBSR,
          AvgRating = source.AvgRating,
          TotalReviews = source.TotalReviews,
          AvgLQS = source.AvgLQS
      WHEN NOT MATCHED THEN
        INSERT (AsinId, WeekStartDate, AvgPrice, AvgBSR, AvgRating, TotalReviews, AvgLQS)
        VALUES (source.AsinId, source.WeekStartDate, source.AvgPrice, source.AvgBSR, source.AvgRating, source.TotalReviews, source.AvgLQS);
    `);
  console.log('  ✅ weekly rows merged');
  return { buckets, merged: 1, rowsAffected: result.rowsAffected };
}

async function seedSubBsr(pool, limit) {
  console.log('\n▸ Sub-BSR ranks — seeding today\'s row from Asins.SubBSRs / SubBSRCategory…');

  const rowsResult = await pool.request()
    .input('limit', sql.Int, limit)
    .query(`
      SELECT TOP (@limit) Id, AsinCode, SubBsr, SubBSRCategory, SubBSRs
      FROM Asins WITH (NOLOCK)
      WHERE (SubBSRs IS NOT NULL AND LTRIM(RTRIM(SubBSRs)) <> '')
         OR (SubBSRCategory IS NOT NULL AND LTRIM(RTRIM(SubBSRCategory)) <> ''
             AND SubBsr IS NOT NULL AND SubBsr > 0)
    `);
  const rows = rowsResult.recordset;
  console.log(`  ${rows.length} ASIN(s) carry a sub-BSR value`);

  if (DRY_RUN || rows.length === 0) return { candidates: rows.length, written: 0, skipped: 0 };

  let written = 0;
  let skipped = 0;
  for (const row of rows) {
    const pairs = asinHistoryService.parseSubBsrPairs(row.SubBSRs);
    if (row.SubBsr > 0 && row.SubBSRCategory) {
      pairs.push({ rank: row.SubBsr, category: row.SubBSRCategory });
    }
    const seen = new Set();
    for (const pair of pairs) {
      const key = `${pair.category}`;
      if (seen.has(key)) continue;   // the current row wins over the JSON blob
      seen.add(key);
      try {
        const ok = await asinHistoryService.upsertSubBsrHistory(pool, row.Id, pair);
        if (ok) written++; else skipped++;
      } catch (err) {
        skipped++;
        console.log(`  ⚠ ${row.AsinCode}: ${err.message}`);
      }
    }
  }
  console.log(`  ✅ ${written} row(s) upserted, ${skipped} skipped`);
  return { candidates: rows.length, written, skipped };
}

async function main() {
  const pool = await getPool();
  if (DRY_RUN) console.log('DRY RUN — nothing will be written');

  const weeks = await backfillWeeks(pool);
  const subBsr = SEED_SUB_BSR ? await seedSubBsr(pool, LIMIT) : { candidates: 0, written: 0, skipped: 0 };

  console.log('\nSummary');
  console.log(`  week buckets found : ${weeks.buckets}`);
  console.log(`  sub-BSR ASINs      : ${subBsr.candidates}`);
  console.log(`  sub-BSR rows written: ${subBsr.written}`);
  if (DRY_RUN) console.log('  (dry run — re-run without --dry-run to apply)');

  process.exit(0);
}

main().catch((err) => {
  console.error('Backfill failed:', err.message);
  process.exit(1);
});
