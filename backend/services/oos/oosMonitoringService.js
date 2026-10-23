const { getPool, sql, generateId } = require('../../database/db');
const { getActivePolicy } = require('./oosPolicyService');

function httpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code || message;
  return err;
}

function isoDate(d) {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10);
}

async function loadSeller(pool, sellerId) {
  const result = await pool
    .request()
    .input('sellerId', sql.VarChar, sellerId)
    .query('SELECT TOP 1 Id, Name, Marketplace FROM Sellers WHERE Id = @sellerId');
  return result.recordset[0] || null;
}

async function buildManifest(pool, { sellerId, channel, policy }) {
  const request = pool
    .request()
    .input('sellerId', sql.VarChar, sellerId)
    .input('channel', sql.NVarChar, channel);

  const counts = await request.query(`
    SELECT
      COUNT(*) AS EligibleActiveAsins,
      SUM(CASE WHEN Availability = 'OutOfStock'
                 OR LOWER(ISNULL(AvailabilityStatus, '')) LIKE '%unavailable%'
                 OR LOWER(ISNULL(AvailabilityStatus, '')) LIKE '%out of stock%'
               THEN 1 ELSE 0 END) AS RetailOpsUnavailableCount,
      SUM(CASE WHEN Availability IS NULL AND (AvailabilityStatus IS NULL OR LTRIM(RTRIM(AvailabilityStatus)) = '')
               THEN 1 ELSE 0 END) AS MissingAvailabilityCount,
      MAX(LastScrapedAt) AS LastRetailOpsObservation
    FROM Asins
    WHERE SellerId = @sellerId AND Status = 'Active' AND Marketplace = @channel
  `);
  const c = counts.recordset[0] || {};

  const gms = await pool
    .request()
    .input('sellerId', sql.VarChar, sellerId)
    .input('days', sql.Int, Number(policy.gmsWindowDays) || 30)
    .query(`
      SELECT
        COUNT(DISTINCT g.Asin) AS GmsAsinCount,
        SUM(g.OrderedRevenue) AS GmsRevenue,
        MAX(g.Date) AS GmsLastDate,
        MIN(g.Date) AS GmsFirstDate
      FROM GmsDailyPerformance g
      INNER JOIN Asins a ON a.AsinCode = g.Asin AND a.SellerId = @sellerId
      WHERE g.Date >= DATEADD(day, -@days, CAST(GETDATE() AS date))
    `);
  const g = gms.recordset[0] || {};

  return {
    channel,
    capturedAt: new Date().toISOString(),
    policyVersion: policy.version,
    eligibleActiveAsins: Number(c.EligibleActiveAsins) || 0,
    retailOpsUnavailableCount: Number(c.RetailOpsUnavailableCount) || 0,
    missingAvailabilityCount: Number(c.MissingAvailabilityCount) || 0,
    lastRetailOpsObservation: c.LastRetailOpsObservation || null,
    gms: {
      windowDays: Number(policy.gmsWindowDays) || 30,
      asinCount: Number(g.GmsAsinCount) || 0,
      revenue: g.GmsRevenue == null ? null : Number(g.GmsRevenue),
      firstDate: g.GmsFirstDate || null,
      lastDate: g.GmsLastDate || null,
      verified: Number(g.GmsAsinCount) > 0,
      note: Number(g.GmsAsinCount) > 0 ? null : 'GMS_UNVERIFIED',
    },
  };
}

/**
 * Create today's monitoring run for a seller, or return the existing one.
 * This is the idempotent entry point for the "Start daily monitoring" activity.
 */
async function createOrGetRun({ sellerId, channel, runDate, monitoredDate, createdBy } = {}) {
  if (!sellerId) throw httpError(400, 'sellerId is required', 'SELLER_REQUIRED');
  const pool = await getPool();
  const seller = await loadSeller(pool, sellerId);
  if (!seller) throw httpError(404, 'Seller not found', 'SELLER_NOT_FOUND');

  const effectiveChannel = channel || seller.Marketplace || 'amazon.in';
  const effectiveRunDate = isoDate(runDate || new Date());

  const existing = await pool
    .request()
    .input('runDate', sql.Date, effectiveRunDate)
    .input('sellerId', sql.VarChar, sellerId)
    .query('SELECT TOP 1 * FROM OosRuns WHERE RunDate = @runDate AND SellerId = @sellerId');
  if (existing.recordset[0]) {
    return { run: existing.recordset[0], created: false };
  }

  const policy = await getActivePolicy();
  const manifest = await buildManifest(pool, { sellerId, channel: effectiveChannel, policy });

  const id = generateId();
  const insert = await pool
    .request()
    .input('id', sql.VarChar, id)
    .input('sellerId', sql.VarChar, sellerId)
    .input('sellerName', sql.NVarChar, seller.Name)
    .input('channel', sql.NVarChar, effectiveChannel)
    .input('runDate', sql.Date, effectiveRunDate)
    .input('monitoredDate', sql.Date, isoDate(monitoredDate || new Date()))
    .input('status', sql.VarChar, 'MONITORING')
    .input('policyVersion', sql.VarChar, policy.version)
    .input('manifestJson', sql.NVarChar(sql.MAX), JSON.stringify(manifest))
    .input('createdBy', sql.NVarChar, createdBy || null)
    .query(`
      INSERT INTO OosRuns
        (Id, SellerId, SellerName, Channel, RunDate, MonitoredDate, Status, PolicyVersion, ManifestJson, CreatedBy, CreatedAt, UpdatedAt)
      OUTPUT INSERTED.*
      VALUES
        (@id, @sellerId, @sellerName, @channel, @runDate, @monitoredDate, @status, @policyVersion, @manifestJson, @createdBy, GETUTCDATE(), GETUTCDATE())
    `);

  return { run: insert.recordset[0], manifest, created: true };
}

async function getRun(runId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.VarChar, runId)
    .query('SELECT TOP 1 * FROM OosRuns WHERE Id = @id');
  return result.recordset[0] || null;
}

async function listRuns({ sellerId, from, to, status } = {}) {
  const pool = await getPool();
  const request = pool.request();
  const where = [];
  if (sellerId) { request.input('sellerId', sql.VarChar, sellerId); where.push('SellerId = @sellerId'); }
  if (from) { request.input('from', sql.Date, isoDate(from)); where.push('RunDate >= @from'); }
  if (to) { request.input('to', sql.Date, isoDate(to)); where.push('RunDate <= @to'); }
  if (status) { request.input('status', sql.VarChar, status); where.push('Status = @status'); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const result = await request.query(`
    SELECT TOP 200 * FROM OosRuns ${clause} ORDER BY RunDate DESC, CreatedAt DESC
  `);
  return result.recordset;
}

async function updateRunStatus(runId, status) {
  const pool = await getPool();
  await pool
    .request()
    .input('id', sql.VarChar, runId)
    .input('status', sql.VarChar, status)
    .query('UPDATE OosRuns SET Status = @status, UpdatedAt = GETUTCDATE() WHERE Id = @id');
}

module.exports = { createOrGetRun, getRun, listRuns, updateRunStatus, buildManifest, loadSeller };
