/**
 * Data freshness — the honesty layer for ASIN data.
 *
 * The module had no notion of "is this row current?": `LastScrapedAt` was
 * displayed but never reasoned about, `SubBsrHistory` was never written, weekly
 * history only existed if a human created it, and the six-hourly
 * `integrityRepair` cron was a no-op that logged "skipped (Refactoring in
 * progress)" while the manual repair endpoint did all the real work.
 *
 * This service answers three questions and nothing else:
 *   1. `getFreshnessReport`  — how much of the (scoped) catalogue is fresh,
 *                              stale, or never scraped, per seller;
 *   2. `findStaleAsins`      — which ASINs to repair first, oldest first;
 *   3. `runStaleRepairCycle` — hand the worst sellers to the existing scraper
 *                              repair job, deliberately and with a dry-run mode.
 *
 * Freshness is *derived* from `LastScrapedAt` against an SLA in days; it is not
 * a stored column, so it can never drift from the timestamp it describes.
 */

const { sql } = require('../database/db');
const { bindSellerFilter, resolveSellerScope } = require('../utils/sellerScope');

const DEFAULT_SLA_DAYS = 7;
const MAX_SLA_DAYS = 90;

function normalizeSlaDays(value) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_SLA_DAYS;
  return Math.min(parsed, MAX_SLA_DAYS);
}

/** SQL predicate for "needs a scrape": never scraped, or older than the SLA. */
const stalePredicate = (alias = 'a') =>
  `(${alias}.LastScrapedAt IS NULL OR ${alias}.LastScrapedAt < DATEADD(day, -@slaDays, dbo.GetEnvDate()))`;

/** SQL predicate for "fresh": scraped inside the SLA. */
const freshPredicate = (alias = 'a') =>
  `(${alias}.LastScrapedAt IS NOT NULL AND ${alias}.LastScrapedAt >= DATEADD(day, -@slaDays, dbo.GetEnvDate()))`;

/**
 * Counts of fresh / stale / never-scraped ASINs for a scope, plus a per-seller
 * breakdown. One aggregate query, scoped through the shared seller helper.
 */
async function getFreshnessReport(pool, { user, sellerId, slaDays, global = false } = {}) {
  // `global: true` is for system callers (the freshness cron) that have no
  // request user and must see every seller. A sellerId from a request always
  // goes through resolveSellerScope instead.
  const scope = global
    ? { isGlobal: true, unrestricted: true, denied: false, empty: false }
    : resolveSellerScope(user, sellerId);
  if (scope.denied) return { denied: true };
  if (scope.empty) {
    return { slaDays: normalizeSlaDays(slaDays), total: 0, fresh: 0, stale: 0, never: 0, sellers: [] };
  }

  const days = normalizeSlaDays(slaDays);
  const request = pool.request();
  request.input('slaDays', sql.Int, days);
  const sellerClause = bindSellerFilter(request, scope, { alias: 'a', prefix: 'freshScope' });

  const result = await request.query(`
    SELECT
      a.SellerId,
      s.Name AS sellerName,
      COUNT(*) AS total,
      SUM(CASE WHEN ${freshPredicate('a')} THEN 1 ELSE 0 END) AS fresh,
      SUM(CASE WHEN ${stalePredicate('a')} THEN 1 ELSE 0 END) AS stale,
      SUM(CASE WHEN a.LastScrapedAt IS NULL THEN 1 ELSE 0 END) AS never,
      MIN(a.LastScrapedAt) AS oldestScrape
    FROM Asins a WITH (NOLOCK)
    LEFT JOIN Sellers s WITH (NOLOCK) ON a.SellerId = s.Id
    WHERE 1 = 1${sellerClause}
    GROUP BY a.SellerId, s.Name
    ORDER BY SUM(CASE WHEN ${stalePredicate('a')} THEN 1 ELSE 0 END) DESC
  `);

  const sellers = result.recordset.map((row) => ({
    sellerId: row.SellerId,
    sellerName: row.sellerName || '',
    total: Number(row.total) || 0,
    fresh: Number(row.fresh) || 0,
    stale: Number(row.stale) || 0,
    never: Number(row.never) || 0,
    oldestScrape: row.oldestScrape || null,
  }));

  const totals = sellers.reduce(
    (acc, s) => ({
      total: acc.total + s.total,
      fresh: acc.fresh + s.fresh,
      stale: acc.stale + s.stale,
      never: acc.never + s.never,
    }),
    { total: 0, fresh: 0, stale: 0, never: 0 }
  );

  return { slaDays: days, ...totals, sellers };
}

/** The most-stale ASINs in scope, oldest first — what a repair pass should take. */
async function findStaleAsins(pool, { user, sellerId, slaDays, limit = 50, global = false } = {}) {
  const scope = global
    ? { isGlobal: true, unrestricted: true, denied: false, empty: false }
    : resolveSellerScope(user, sellerId);
  if (scope.denied || scope.empty) return [];

  const days = normalizeSlaDays(slaDays);
  const request = pool.request();
  request.input('slaDays', sql.Int, days);
  request.input('limit', sql.Int, Math.max(1, Math.min(parseInt(limit, 10) || 50, 500)));
  const sellerClause = bindSellerFilter(request, scope, { alias: 'a', prefix: 'staleScope' });

  const result = await request.query(`
    SELECT TOP (@limit)
      a.Id, a.AsinCode, a.SellerId, a.LastScrapedAt, a.ScrapeStatus, a.Status
    FROM Asins a WITH (NOLOCK)
    WHERE ${stalePredicate('a')}${sellerClause}
    ORDER BY CASE WHEN a.LastScrapedAt IS NULL THEN 0 ELSE 1 END, a.LastScrapedAt ASC
  `);

  return result.recordset;
}

/**
 * One repair cycle: for each seller over the threshold, ask the existing
 * scraper repair job to take the seller. Never throws — a cron job that dies
 * loudly is worse than one that reports why it did nothing.
 *
 * `dryRun` (the default) reports the plan without starting any job.
 */
async function runStaleRepairCycle(pool, { slaDays, maxSellers = 3, dryRun = true, minStale = 25 } = {}) {
  const report = await getFreshnessReport(pool, { slaDays, global: true });
  const candidates = report.sellers
    .filter((s) => s.stale + s.never >= minStale)
    .slice(0, Math.max(0, maxSellers));

  if (candidates.length === 0) {
    return { ran: false, reason: 'no seller above the stale threshold', report };
  }
  if (dryRun) {
    return { ran: false, dryRun: true, candidates, report };
  }

  let scraperRunner;
  try {
    scraperRunner = require('./scraperRunner');
  } catch (err) {
    return { ran: false, reason: `repair job unavailable: ${err.message}`, candidates, report };
  }

  const started = [];
  for (const candidate of candidates) {
    try {
      const result = await scraperRunner.startRepairJob(candidate.sellerId, 'system:freshness');
      started.push({ sellerId: candidate.sellerId, stale: candidate.stale + candidate.never, result });
    } catch (err) {
      started.push({ sellerId: candidate.sellerId, error: err.message });
    }
  }
  return { ran: true, started, report };
}

module.exports = {
  DEFAULT_SLA_DAYS,
  MAX_SLA_DAYS,
  normalizeSlaDays,
  stalePredicate,
  freshPredicate,
  getFreshnessReport,
  findStaleAsins,
  runStaleRepairCycle,
};
