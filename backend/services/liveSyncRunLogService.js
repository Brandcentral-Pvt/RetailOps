/**
 * Live Sync Run Log Service
 *
 * Persists a complete, brand-wise audit trail of every live-sync run:
 *  - LiveSyncRunLogs: one row per run (manual / auto / re-sync / inspector tool)
 *  - LiveSyncRunAsinLogs: one row per ASIN processed in that run
 *
 * All methods are defensive — if the DB or a write fails, sync itself must
 * never be blocked, so every call is fire-and-forget safe.
 */
const { sql, getPool } = require('../database/db');
const crypto = require('crypto');

const genId = (prefix = 'run') => `${prefix}_${crypto.randomBytes(8).toString('hex')}`;

const safeJson = (v) => {
  if (v === undefined || v === null) return null;
  try { return JSON.stringify(v); } catch { return null; }
};

const userName = (user) => {
  if (!user) return null;
  const name = [user.FirstName, user.LastName].filter(Boolean).join(' ') || user.Email || '';
  return (name + (user.Email && name !== user.Email ? ` (${user.Email})` : '')).trim();
};

/**
 * Create a run log row. Returns { id } (fire-and-forget friendly).
 */
async function createRun({ triggerType, source, triggeredBy, sellerId, sellerName, marketplace, batchId, metadata } = {}) {
  const id = genId();
  try {
    const pool = await getPool();
    await pool.request()
      .input('Id', sql.VarChar, id)
      .input('BatchId', sql.VarChar, batchId || null)
      .input('TriggerType', sql.NVarChar, triggerType || 'MANUAL')
      .input('Source', sql.NVarChar, source || 'SELLER')
      .input('TriggeredById', sql.VarChar, triggeredBy?.Id || triggeredBy?.id || null)
      .input('TriggeredByName', sql.NVarChar, userName(triggeredBy))
      .input('SellerId', sql.VarChar, sellerId || null)
      .input('SellerName', sql.NVarChar, sellerName || null)
      .input('Marketplace', sql.NVarChar, marketplace || null)
      .input('Metadata', sql.NVarChar(sql.MAX), safeJson(metadata || null))
      .query(`
        INSERT INTO LiveSyncRunLogs (Id, BatchId, TriggerType, Source, TriggeredById, TriggeredByName,
          SellerId, SellerName, Marketplace, Status, Metadata)
        VALUES (@Id, @BatchId, @TriggerType, @Source, @TriggeredById, @TriggeredByName,
          @SellerId, @SellerName, @Marketplace, 'RUNNING', @Metadata)
      `);
  } catch (err) {
    console.error('[LiveSyncRunLog] createRun failed:', err.message);
  }
  return { id };
}

/**
 * Append a single ASIN entry to a run.
 */
async function addAsinLog(runId, { asinCode, asinId, status, error } = {}) {
  if (!runId || !asinCode) return;
  try {
    const pool = await getPool();
    await pool.request()
      .input('Id', sql.VarChar, genId('asin'))
      .input('RunId', sql.VarChar, runId)
      .input('AsinCode', sql.VarChar, asinCode || null)
      .input('AsinId', sql.VarChar, asinId || null)
      .input('Status', sql.NVarChar, status || 'FAILED')
      .input('ErrorMessage', sql.NVarChar(sql.MAX), error || null)
      .query(`
        INSERT INTO LiveSyncRunAsinLogs (Id, RunId, AsinCode, AsinId, Status, ErrorMessage)
        VALUES (@Id, @RunId, @AsinCode, @AsinId, @Status, @ErrorMessage)
      `);
  } catch (err) {
    console.error('[LiveSyncRunLog] addAsinLog failed:', err.message);
  }
}

/**
 * Batch-append ASIN entries (more efficient than N single inserts).
 */
async function addAsinLogs(runId, entries = []) {
  if (!runId || entries.length === 0) return;
  try {
    const pool = await getPool();
    for (const entry of entries) {
      if (!entry?.asinCode) continue;
      await pool.request()
        .input('Id', sql.VarChar, genId('asin'))
        .input('RunId', sql.VarChar, runId)
        .input('AsinCode', sql.VarChar, entry.asinCode)
        .input('AsinId', sql.VarChar, entry.asinId || null)
        .input('Status', sql.NVarChar, entry.status || 'FAILED')
        .input('ErrorMessage', sql.NVarChar(sql.MAX), entry.error || null)
        .query(`
          INSERT INTO LiveSyncRunAsinLogs (Id, RunId, AsinCode, AsinId, Status, ErrorMessage)
          VALUES (@Id, @RunId, @AsinCode, @AsinId, @Status, @ErrorMessage)
        `);
    }
  } catch (err) {
    console.error('[LiveSyncRunLog] addAsinLogs failed:', err.message);
  }
}

/**
 * Finalize a run with its outcome.
 */
async function completeRun(runId, { status, totalAsins, successCount, failedCount, failedAsinCodes, errors, durationMs } = {}) {
  if (!runId) return;
  try {
    const pool = await getPool();
    await pool.request()
      .input('Id', sql.VarChar, runId)
      .input('Status', sql.NVarChar, status || 'COMPLETED')
      .input('TotalAsins', sql.Int, totalAsins || 0)
      .input('SuccessCount', sql.Int, successCount || 0)
      .input('FailedCount', sql.Int, failedCount || 0)
      .input('FailedAsinCodes', sql.NVarChar(sql.MAX), safeJson(failedAsinCodes || []))
      .input('Errors', sql.NVarChar(sql.MAX), safeJson(errors || []))
      .input('DurationMs', sql.Int, durationMs || null)
      .query(`
        UPDATE LiveSyncRunLogs
        SET Status = @Status, TotalAsins = @TotalAsins, SuccessCount = @SuccessCount, FailedCount = @FailedCount,
            FailedAsinCodes = @FailedAsinCodes, Errors = @Errors, DurationMs = @DurationMs,
            CompletedAt = dbo.GetEnvDate()
        WHERE Id = @Id
      `);
  } catch (err) {
    console.error('[LiveSyncRunLog] completeRun failed:', err.message);
  }
}

/**
 * List runs with optional filters. Returns { rows, total }.
 */
async function listRuns({ sellerId, triggerType, source, status, from, to, limit = 50, offset = 0 } = {}) {
  try {
    const pool = await getPool();
    const limitN = Math.min(parseInt(limit, 10) || 50, 500);
    const offsetN = parseInt(offset, 10) || 0;

    const buildWhere = (req) => {
      let w = 'WHERE 1=1';
      if (sellerId) { w += ' AND SellerId = @sellerId'; req.input('sellerId', sql.VarChar, sellerId); }
      if (triggerType) { w += ' AND TriggerType = @triggerType'; req.input('triggerType', sql.NVarChar, triggerType); }
      if (source) { w += ' AND Source = @source'; req.input('source', sql.NVarChar, source); }
      if (status) { w += ' AND Status = @status'; req.input('status', sql.NVarChar, status); }
      if (from) { w += ' AND StartedAt >= @from'; req.input('from', sql.DateTime2, new Date(from)); }
      if (to) { w += ' AND StartedAt <= @to'; req.input('to', sql.DateTime2, new Date(to)); }
      return w;
    };

    const countReq = pool.request();
    const where = buildWhere(countReq);
    const countRes = await countReq.query(`SELECT COUNT(*) AS n FROM LiveSyncRunLogs ${where}`);
    const total = countRes.recordset[0]?.n || 0;

    const req = pool.request();
    const where2 = buildWhere(req);
    req.input('limit', sql.Int, limitN);
    req.input('offset', sql.Int, offsetN);
    const result = await req.query(`
      SELECT Id, BatchId, TriggerType, Source, TriggeredById, TriggeredByName,
        SellerId, SellerName, Marketplace, Status, TotalAsins, SuccessCount, FailedCount,
        DurationMs, StartedAt, CompletedAt
      FROM LiveSyncRunLogs
      ${where2}
      ORDER BY StartedAt DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

    return { rows: result.recordset || [], total };
  } catch (err) {
    console.error('[LiveSyncRunLog] listRuns failed:', err.message);
    return { rows: [], total: 0 };
  }
}

/**
 * Fetch a single run + its per-ASIN detail.
 */
async function getRun(runId) {
  try {
    const pool = await getPool();
    const runRes = await pool.request()
      .input('Id', sql.VarChar, runId)
      .query(`SELECT * FROM LiveSyncRunLogs WHERE Id = @Id`);
    if (!runRes.recordset.length) return null;

    const asinsRes = await pool.request()
      .input('RunId', sql.VarChar, runId)
      .query(`
        SELECT Id, AsinCode, AsinId, Status, ErrorMessage, LoggedAt
        FROM LiveSyncRunAsinLogs WHERE RunId = @RunId
        ORDER BY LoggedAt
      `);

    const run = runRes.recordset[0];
    const asins = asinsRes.recordset || [];
    const parse = (v) => { if (!v) return null; try { return JSON.parse(v); } catch { return v; } };

    return {
      ...run,
      FailedAsinCodes: parse(run.FailedAsinCodes),
      Errors: parse(run.Errors),
      Metadata: parse(run.Metadata),
      asins,
      asinSummary: {
        success: asins.filter(a => a.Status === 'SUCCESS').length,
        failed: asins.filter(a => a.Status === 'FAILED').length,
        notFound: asins.filter(a => a.Status === 'NOT_FOUND').length,
        skipped: asins.filter(a => a.Status === 'SKIPPED').length,
      },
    };
  } catch (err) {
    console.error('[LiveSyncRunLog] getRun failed:', err.message);
    return null;
  }
}

/**
 * Brand-wise summary — how many runs, last status, totals per brand.
 */
async function getBrandSummary({ days = 30 } = {}) {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('days', sql.Int, Math.max(1, parseInt(days, 10) || 30))
      .query(`
        SELECT
          ISNULL(SellerId, 'ALL') AS SellerId,
          ISNULL(SellerName, 'All Brands') AS SellerName,
          COUNT(*) AS TotalRuns,
          SUM(CASE WHEN Status = 'COMPLETED' THEN 1 ELSE 0 END) AS CompletedRuns,
          SUM(CASE WHEN Status = 'PARTIAL' THEN 1 ELSE 0 END) AS PartialRuns,
          SUM(CASE WHEN Status = 'FAILED' THEN 1 ELSE 0 END) AS FailedRuns,
          SUM(SuccessCount) AS TotalSuccessAsins,
          SUM(FailedCount) AS TotalFailedAsins,
          MAX(StartedAt) AS LastRunAt,
          (SELECT TOP 1 Status FROM LiveSyncRunLogs r2
            WHERE r2.SellerId = LiveSyncRunLogs.SellerId
            ORDER BY r2.StartedAt DESC) AS LastStatus
        FROM LiveSyncRunLogs
        WHERE StartedAt >= DATEADD(DAY, -@days, dbo.GetEnvDate())
        GROUP BY SellerId, SellerName
        ORDER BY LastRunAt DESC
      `);
    return result.recordset || [];
  } catch (err) {
    console.error('[LiveSyncRunLog] getBrandSummary failed:', err.message);
    return [];
  }
}

module.exports = {
  createRun,
  addAsinLog,
  addAsinLogs,
  completeRun,
  listRuns,
  getRun,
  getBrandSummary,
};
