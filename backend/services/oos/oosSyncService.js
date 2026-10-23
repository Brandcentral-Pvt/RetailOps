const { getPool, sql, generateId } = require('../../database/db');
const {
  resyncEligibility,
  resyncIdempotencyKey,
  applyResyncVerification,
  isVendorApplicable,
} = require('./oosPolicy');
const { getActivePolicy } = require('./oosPolicyService');
const { retailOpsInput, observationInput } = require('./oosReconciliationService');
const incidents = require('./oosIncidentService');

function httpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code || message;
  return err;
}

async function loadRun(pool, runId) {
  const r = await pool
    .request()
    .input('id', sql.VarChar, runId)
    .query('SELECT TOP 1 * FROM OosRuns WHERE Id = @id');
  return r.recordset[0] || null;
}

async function evaluateEligibility(run, asin, policy) {
  const pool = await getPool();
  const rowResult = await pool
    .request()
    .input('sellerId', sql.VarChar, run.SellerId)
    .input('channel', sql.VarChar, run.Channel)
    .input('asin', sql.VarChar, asin)
    .query(`
      SELECT TOP 1 AsinCode, Availability, AvailabilityStatus, ScrapeStatus, StockLevel, LastScrapedAt
      FROM Asins WHERE SellerId = @sellerId AND Marketplace = @channel AND AsinCode = @asin
    `);
  const obsResult = await pool
    .request()
    .input('runId', sql.VarChar, run.Id)
    .input('asin', sql.VarChar, asin)
    .query(`
      SELECT Source, Channel, RawQuantity, RawAvailability, RawStatus, SourceTimestamp
      FROM OosObservations WHERE RunId = @runId AND AsinCode = @asin AND IsValid = 1
    `);
  const sources = {};
  for (const row of obsResult.recordset) sources[row.Source] = row;

  const retailOps = retailOpsInput(rowResult.recordset[0]);
  const brandCentral = observationInput(sources.BRAND_CENTRAL, policy);
  const vendor = observationInput(sources.VENDOR_CENTRAL, policy);
  const vendorApplicable = isVendorApplicable(run.Channel, policy);

  return resyncEligibility(
    { retailOps, brandCentral, vendor, vendorApplicable, channel: run.Channel, policy },
    new Date(),
  );
}

/**
 * Request a privileged resync for one discrepancy revision. Duplicate requests
 * collapse on the idempotency key. Accepting a request NEVER resolves the case.
 */
async function requestResync({ runId, asin, revision, requestedBy, preStatus } = {}) {
  if (!runId || !asin) throw httpError(400, 'runId and asin are required', 'RESYNC_REQUIRED');
  const pool = await getPool();
  const run = await loadRun(pool, runId);
  if (!run) throw httpError(404, 'OOS run not found', 'RUN_NOT_FOUND');

  const policy = await getActivePolicy();
  const eligibility = await evaluateEligibility(run, asin, policy);
  if (!eligibility.eligible) throw httpError(422, eligibility.reason, 'RESYNC_NOT_ELIGIBLE');

  const decisionResult = await pool
    .request()
    .input('runId', sql.VarChar, runId)
    .input('sellerId', sql.VarChar, run.SellerId)
    .input('channel', sql.VarChar, run.Channel)
    .input('asin', sql.VarChar, asin)
    .query(`
      SELECT TOP 1 * FROM OosDecisions
      WHERE RunId = @runId AND SellerId = @sellerId AND Channel = @channel AND AsinCode = @asin
    `);
  const decision = decisionResult.recordset[0];
  const effectiveRevision = Number(revision) || Number(decision?.Revision) || 1;
  const key = resyncIdempotencyKey({ sellerId: run.SellerId, channel: run.Channel, asin, revision: effectiveRevision });

  const existing = await pool
    .request()
    .input('key', sql.VarChar, key)
    .query('SELECT TOP 1 * FROM OosResyncJobs WHERE IdempotencyKey = @key');
  if (existing.recordset[0]) return { job: existing.recordset[0], created: false, eligibility };

  const inserted = await pool
    .request()
    .input('id', sql.VarChar, generateId())
    .input('runId', sql.VarChar, runId)
    .input('sellerId', sql.VarChar, run.SellerId)
    .input('channel', sql.VarChar, run.Channel)
    .input('asin', sql.VarChar, asin)
    .input('revision', sql.Int, effectiveRevision)
    .input('key', sql.VarChar, key)
    .input('status', sql.VarChar, 'QUEUED')
    .input('requestedBy', sql.VarChar, requestedBy || null)
    .input('preStatus', sql.NVarChar, preStatus || decision?.Category || null)
    .query(`
      INSERT INTO OosResyncJobs
        (Id, RunId, SellerId, Channel, AsinCode, DiscrepancyRevision, IdempotencyKey, Status, RequestedBy, PreStatus, CreatedAt, UpdatedAt)
      OUTPUT INSERTED.*
      VALUES
        (@id, @runId, @sellerId, @channel, @asin, @revision, @key, @status, @requestedBy, @preStatus, GETUTCDATE(), GETUTCDATE())
    `);

  return { job: inserted.recordset[0], created: true, eligibility };
}

/**
 * Record post-sync verification. Only a NEWER in-stock observation for the same
 * scope resolves the incident; unchanged/failed/timeout stays open.
 */
async function verifyResync(jobId, verification = {}, actorId) {
  const pool = await getPool();
  const jobResult = await pool
    .request()
    .input('id', sql.VarChar, jobId)
    .query('SELECT TOP 1 * FROM OosResyncJobs WHERE Id = @id');
  const job = jobResult.recordset[0];
  if (!job) throw httpError(404, 'Resync job not found', 'RESYNC_NOT_FOUND');

  const outcome = applyResyncVerification(
    {
      sellerId: job.SellerId,
      channel: job.Channel,
      asin: job.AsinCode,
      requestedAt: job.CreatedAt,
    },
    verification,
  );

  await pool
    .request()
    .input('id', sql.VarChar, jobId)
    .input('status', sql.VarChar, outcome.status)
    .input('postStatus', sql.NVarChar, verification.state || null)
    .input('observationTime', sql.DateTime2, verification.observationTime || null)
    .input('resultJson', sql.NVarChar(sql.MAX), JSON.stringify({ outcome, verification }))
    .query(`
      UPDATE OosResyncJobs SET
        Status = @status, PostStatus = @postStatus, ObservationTime = @observationTime,
        ResultJson = @resultJson, UpdatedAt = GETUTCDATE()
      WHERE Id = @id
    `);

  const incidentResult = await incidents.resolveForAsin({
    sellerId: job.SellerId,
    channel: job.Channel,
    asin: job.AsinCode,
    actorId,
    runId: job.RunId,
    detail: { resyncJobId: jobId, outcome, verification },
  }).catch(() => null);

  return {
    jobId,
    ...outcome,
    incidentResolved: Boolean(outcome.resolved && incidentResult && incidentResult.changed),
  };
}

async function listResyncJobs(runId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('runId', sql.VarChar, runId)
    .query('SELECT * FROM OosResyncJobs WHERE RunId = @runId ORDER BY CreatedAt ASC');
  return result.recordset;
}

async function getResyncJob(jobId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.VarChar, jobId)
    .query('SELECT TOP 1 * FROM OosResyncJobs WHERE Id = @id');
  return result.recordset[0] || null;
}

module.exports = { requestResync, verifyResync, listResyncJobs, getResyncJob, evaluateEligibility };
