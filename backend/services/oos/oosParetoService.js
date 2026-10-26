const { getPool, sql } = require('../../database/db');
const { computePareto } = require('./oosPolicy');
const { getActivePolicy } = require('./oosPolicyService');
const { loadSeller } = require('./oosMonitoringService');

function httpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code || message;
  return err;
}

/**
 * Seller-by-seller GMS Pareto over the seller's WHOLE eligible active catalog.
 * No GMS in the window => GMS_UNVERIFIED (never silently "standard").
 * Returns priority group as '80%' or '20%' (never Tier 1/Tier 2/Standard).
 */
async function getSellerPareto({ sellerId, channel, pct } = {}) {
  if (!sellerId) throw httpError(400, 'sellerId is required', 'SELLER_REQUIRED');
  const pool = await getPool();
  const seller = await loadSeller(pool, sellerId);
  if (!seller) throw httpError(404, 'Seller not found', 'SELLER_NOT_FOUND');

  const policy = await getActivePolicy();
  const effectiveChannel = channel || seller.Marketplace || 'amazon.in';
  const targetPct = Number(pct) || Number(policy.gmsParetoPct) || 80;

  const result = await pool
    .request()
    .input('sellerId', sql.VarChar, sellerId)
    .input('channel', sql.VarChar, effectiveChannel)
    .input('days', sql.Int, Number(policy.gmsWindowDays) || 30)
    .query(`
      SELECT a.AsinCode AS asin, SUM(g.OrderedRevenue) AS gms
      FROM Asins a
      LEFT JOIN GmsDailyPerformance g
        ON g.Asin = a.AsinCode
       AND g.Date >= DATEADD(day, -@days, CAST(GETDATE() AS date))
      WHERE a.SellerId = @sellerId AND a.Marketplace = @channel AND a.Status = 'Active'
      GROUP BY a.AsinCode
    `);

  const rows = result.recordset.map((r) => ({
    asin: r.asin,
    gms: r.gms == null ? null : Number(r.gms),
  }));
  const pareto = computePareto(rows, targetPct);
  const tier1 = new Set(pareto.tier1Asins);
  const asinDetails = new Map();
  for (const r of rows) {
    if (pareto.verified) {
      asinDetails.set(r.asin, {
        priorityGroup: tier1.has(r.asin) ? '80%' : '20%',
        priorityRule: tier1.has(r.asin) ? 'GMS_TOP_80' : 'GMS_REMAINDER_20',
        gmsVerified: true,
      });
    } else {
      asinDetails.set(r.asin, {
        priorityGroup: null,
        priorityRule: 'GMS_UNVERIFIED',
        gmsVerified: false,
      });
    }
  }

  return {
    sellerId,
    sellerName: seller.Name,
    channel: effectiveChannel,
    windowDays: Number(policy.gmsWindowDays) || 30,
    targetPct,
    ...pareto,
    asinDetails,
  };
}

module.exports = { getSellerPareto };