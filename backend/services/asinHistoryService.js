/**
 * ASIN history writers.
 *
 * Before this module existed there were three separate places writing ASIN
 * history by hand, and two of the three history tables were effectively dead:
 *
 *   - `AsinHistory`      — only `liveDataSyncService` wrote it (other ingestion
 *                          paths updated `Asins` and left no trail);
 *   - `AsinWeekHistory`  — rows only appeared when a human called the week-history
 *                          endpoints, so weekly trends were empty in practice;
 *   - `SubBsrHistory`    — read by three endpoints and the UI, written by nothing
 *                          at all (docs/asin-manager-deep-dive.md → F10).
 *
 * Everything that ingests data now records a snapshot through this module, so a
 * daily row, a weekly aggregate row (derived from those daily rows), and the
 * sub-BSR rank row are written together, exactly once per ASIN per period.
 *
 * Week keys are ISO weeks (Monday start) computed **in SQL**, independent of
 * `@@DATEFIRST` and of the Node process timezone — the previous JS
 * `setHours(0,0,0,0)` keys produced Sunday- or Monday-anchored buckets depending
 * on where the server ran, and the UI then labelled them `W{ceil(day/7)}`
 * (F13 / F5).
 */

const { sql } = require('../database/db');

/**
 * SQL expression for the ISO week start (Monday) of a date expression.
 * 1900-01-01 was a Monday, hence the day-difference trick; the double modulo
 * keeps the result correct for dates before that epoch as well, and the whole
 * expression is independent of the session's DATEFIRST setting.
 */
const weekStartSql = (dateExpr) =>
  `CAST(DATEADD(day, -((((DATEDIFF(day, '19000101', ${dateExpr}) % 7) + 7) % 7)), ${dateExpr}) AS DATE)`;

/** ISO week number of a date expression (1…53), used to label buckets in the UI. */
const isoWeekSql = (dateExpr) => `DATEPART(iso_week, ${dateExpr})`;

/**
 * Upsert today's `AsinHistory` row for an ASIN (one row per ASIN per day).
 * `executor` is a pool or an open transaction — anything exposing `.request()`.
 * Null values never overwrite an existing value.
 */
async function upsertDailyHistory(executor, asinId, data = {}) {
  const { price, mrp, bsr, subBsr, rating, reviewCount, stockLevel, lqs, source } = data;
  await executor.request()
    .input('asinId', sql.VarChar, asinId)
    .input('price', sql.Decimal(18, 2), price ?? null)
    .input('mrp', sql.Decimal(18, 2), mrp ?? null)
    .input('bsr', sql.Int, bsr ?? null)
    .input('subBSR', sql.Int, subBsr ?? null)
    .input('rating', sql.Decimal(3, 2), rating ?? null)
    .input('reviewCount', sql.Int, reviewCount ?? null)
    .input('stockLevel', sql.Int, stockLevel ?? null)
    .input('lqs', sql.Decimal(5, 2), lqs ?? null)
    .input('source', sql.NVarChar, source || 'SYNC')
    .query(`
      MERGE AsinHistory AS target
      USING (SELECT @asinId AS AsinId, CAST(dbo.GetEnvDate() AS DATE) AS [Date]) AS source
      ON target.AsinId = source.AsinId AND target.[Date] = source.[Date]
      WHEN MATCHED THEN
        UPDATE SET
          Price = ISNULL(@price, target.Price),
          Mrp = ISNULL(@mrp, target.Mrp),
          BSR = ISNULL(@bsr, target.BSR),
          SubBSR = ISNULL(@subBSR, target.SubBSR),
          Rating = ISNULL(@rating, target.Rating),
          ReviewCount = ISNULL(@reviewCount, target.ReviewCount),
          StockLevel = ISNULL(@stockLevel, target.StockLevel),
          LQS = ISNULL(@lqs, target.LQS),
          Source = @source
      WHEN NOT MATCHED THEN
        INSERT (AsinId, [Date], Price, Mrp, BSR, SubBSR, Rating, ReviewCount, StockLevel, LQS, Source)
        VALUES (source.AsinId, source.[Date], @price, @mrp, @bsr, @subBSR, @rating, @reviewCount, @stockLevel, @lqs, @source);
    `);
}

/**
 * Recompute the current week's aggregate row from the daily snapshots.
 *
 * The weekly row is *derived*, not sampled: averages come from `AsinHistory`
 * for the ISO week that contains today, and `TotalReviews` is the highest review
 * count seen that week (reviews are a running total, so summing them would be
 * meaningless). Called after every daily snapshot, so weekly history exists
 * without anyone pressing a button.
 */
async function upsertWeekHistoryFromDaily(executor, asinId, data = {}) {
  await executor.request()
    .input('asinId', sql.VarChar, asinId)
    .input('avgLqs', sql.Decimal(5, 2), data.lqs ?? null)
    .query(`
      DECLARE @weekStart DATE = ${weekStartSql('dbo.GetEnvDate()')};

      MERGE AsinWeekHistory AS target
      USING (
        SELECT
          @asinId AS AsinId,
          @weekStart AS WeekStartDate,
          AVG(CAST(Price AS DECIMAL(18, 2))) AS AvgPrice,
          AVG(CAST(BSR AS DECIMAL(18, 2))) AS AvgBSR,
          AVG(CAST(Rating AS DECIMAL(3, 2))) AS AvgRating,
          MAX(ReviewCount) AS TotalReviews,
          AVG(CAST(LQS AS DECIMAL(5, 2))) AS AvgLQS
        FROM AsinHistory
        WHERE AsinId = @asinId
          AND [Date] >= @weekStart
          AND [Date] < DATEADD(day, 7, @weekStart)
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
}

/**
 * Upsert today's sub-BSR rank for one category.
 * `SubBsrHistory` was write-free before this — the table now gets one row per
 * ASIN / day / category from the scrape paths that already collect the rank.
 */
async function upsertSubBsrHistory(executor, asinId, data = {}) {
  const { category, rank } = data;
  if (!category || rank === undefined || rank === null) return false;

  await executor.request()
    .input('asinId', sql.VarChar, asinId)
    .input('category', sql.NVarChar, category)
    .input('rank', sql.Int, rank)
    .query(`
      DECLARE @today DATE = CAST(dbo.GetEnvDate() AS DATE);

      MERGE SubBsrHistory AS target
      USING (SELECT @asinId AS AsinId, @today AS [Date], @category AS SubBsrCategory) AS source
      ON target.AsinId = source.AsinId
         AND target.[Date] = source.[Date]
         AND target.SubBsrCategory = source.SubBsrCategory
      WHEN MATCHED THEN
        UPDATE SET SubBsrRank = @rank
      WHEN NOT MATCHED THEN
        INSERT (Id, AsinId, [Date], SubBsrCategory, SubBsrRank)
        VALUES (CONVERT(VARCHAR(50), NEWID()), source.AsinId, source.[Date], source.SubBsrCategory, @rank);
    `);
  return true;
}

/** Split a scraped `SubBSRs` blob into { category, rank } pairs. */
function parseSubBsrPairs(raw) {
  let list = raw;
  if (typeof list === 'string') {
    try { list = JSON.parse(list); } catch (e) { list = []; }
  }
  if (!Array.isArray(list)) return [];
  return list
    .map((entry) => {
      if (!entry) return null;
      if (typeof entry === 'string') {
        const m = entry.match(/#([\d,]+)\s*(?:in\s+(.+))?/i);
        return m ? { rank: parseInt(m[1].replace(/,/g, ''), 10), category: (m[2] || '').trim() } : null;
      }
      const rank = entry.rank ?? entry.Rank ?? entry.SubBsrRank ?? entry.bsr;
      const category = entry.category ?? entry.Category ?? entry.SubBsrCategory ?? entry.name;
      return rank ? { rank: parseInt(rank, 10), category: (category || '').trim() } : null;
    })
    .filter((p) => p && p.category && Number.isFinite(p.rank));
}

/**
 * Record a full snapshot for an ASIN: daily row + weekly aggregate + any
 * sub-BSR ranks supplied either as a single category/rank or as the scraped
 * `SubBSRs` list. Every ingestion path calls this one function.
 */
async function recordSnapshot(executor, asinId, data = {}) {
  const written = { daily: false, week: false, subBsr: 0 };

  await upsertDailyHistory(executor, asinId, data);
  written.daily = true;

  await upsertWeekHistoryFromDaily(executor, asinId, data);
  written.week = true;

  if (data.subBsrCategory && data.subBsr) {
    await upsertSubBsrHistory(executor, asinId, { category: data.subBsrCategory, rank: data.subBsr });
    written.subBsr += 1;
  }
  for (const pair of parseSubBsrPairs(data.subBsrList)) {
    await upsertSubBsrHistory(executor, asinId, pair);
    written.subBsr += 1;
  }

  return written;
}

module.exports = {
  weekStartSql,
  isoWeekSql,
  upsertDailyHistory,
  upsertWeekHistoryFromDaily,
  upsertSubBsrHistory,
  parseSubBsrPairs,
  recordSnapshot,
};
