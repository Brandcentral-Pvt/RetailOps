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
const liveDataSyncService = require('../liveDataSyncService');

const MAX_DISPATCH_ATTEMPTS = 3;
const RESYNC_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const RESYNC_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour window
const RESYNC_MAX_REQUESTS_PER_WINDOW = 50; // max 50 resync requests per hour per seller
const RESYNC_PROVIDER_QUOTA_DAILY = 500; // daily provider quota

const resyncRateLimitMap = new Map(); // key: sellerId, value: { count, windowStart }

function httpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code || message;
  return err;
}

function checkRateLimit(sellerId) {
  const now = Date.now();
  const record = resyncRateLimitMap.get(sellerId);
  
  if (!record || now - record.windowStart > RESYNC_RATE_LIMIT_WINDOW_MS) {
    resyncRateLimitMap.set(sellerId, { count: 1, windowStart: now });
    return { allowed: true, remaining: RESYNC_MAX_REQUESTS_PER_WINDOW - 1 };
  }
  
  if (record.count >= RESYNC_MAX_REQUESTS_PER_WINDOW) {
    const retryAfterMs = RESYNC_RATE_LIMIT_WINDOW_MS - (now - record.windowStart);
    return { 
      allowed: false, 
      remaining: 0, 
      retryAfterMs,
      message: `Rate limit exceeded. Try again in ${Math.ceil(retryAfterMs / 60000)} minutes.`
    };
  }
  
  record.count++;
  return { allowed: true, remaining: RESYNC_MAX_REQUESTS_PER_WINDOW - record.count };
}

function checkProviderQuota(sellerId) {
  // In a real implementation, this would check a daily quota table
  // For now, we track a simple daily counter
  const today = new Date().toDateString();
  const key = `${sellerId}:${today}`;
  const record = resyncRateLimitMap.get(key) || { count: 0 };
  
  if (record.count >= RESYNC_PROVIDER_QUOTA_DAILY) {
    return { 
      allowed: false, 
      message: 'Daily provider quota exceeded. Please try again tomorrow.' 
    };
  }
  
  record.count++;
  resyncRateLimitMap.set(key, record);
  return { allowed: true, remaining: RESYNC_PROVIDER_QUOTA_DAILY - record.count };
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
 * Actually dispatches the resync via the liveDataSyncService.
 */
async function requestResync({ runId, asin, revision, requestedBy, preStatus } = {}) {
  if (!runId || !asin) throw httpError(400, 'runId and asin are required', 'RESYNC_REQUIRED');
  const pool = await getPool();
  const run = await loadRun(pool, runId);
  if (!run) throw httpError(404, 'OOS run not found', 'RUN_NOT_FOUND');

  const policy = await getActivePolicy();
  const eligibility = await evaluateEligibility(run, asin, policy);
  if (!eligibility.eligible) throw httpError(422, eligibility.reason, 'RESYNC_NOT_ELIGIBLE');

  // Rate limiting per seller
  const rateLimit = checkRateLimit(run.SellerId);
  if (!rateLimit.allowed) {
    throw httpError(429, rateLimit.message, 'RATE_LIMIT_EXCEEDED');
  }

  // Provider quota check
  const quotaCheck = checkProviderQuota(run.SellerId);
  if (!quotaCheck.allowed) {
    throw httpError(429, quotaCheck.message, 'PROVIDER_QUOTA_EXCEEDED');
  }

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

  const requestedAt = new Date();
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
    .input('requestedAt', sql.DateTime2, requestedAt)
    .input('dispatchAttempt', sql.Int, 0)
    .query(`
      INSERT INTO OosResyncJobs
        (Id, RunId, SellerId, Channel, AsinCode, DiscrepancyRevision, IdempotencyKey, Status,
         RequestedBy, PreStatus, RequestedAt, DispatchAttempt, CreatedAt, UpdatedAt)
      OUTPUT INSERTED.*
      VALUES
        (@id, @runId, @sellerId, @channel, @asin, @revision, @key, @status,
         @requestedBy, @preStatus, @requestedAt, @dispatchAttempt, GETUTCDATE(), GETUTCDATE())
    `);

  const job = inserted.recordset[0];

  // Dispatch the actual resync via liveDataSyncService asynchronously
  // Don't await - let it run in background, job status will be updated by the sync service
  dispatchResync(run.SellerId, asin, run.Channel, job.Id).catch(err => {
    console.error(`Resync dispatch failed for job ${job.Id}:`, err.message);
    updateJobStatus(job.Id, 'FAILED', { error: err.message }).catch(() => {});
  });

  return { job: inserted.recordset[0], created: true, eligibility };
}


async function dispatchResync(sellerId, asinCode, channel, jobId) {
  try {
    // Increment dispatch attempt
    await updateJobStatus(jobId, 'RUNNING', { dispatchAttempt: 1 });

    const result = await liveDataSyncService.syncSellerLiveData(sellerId, {
      asinCodes: [asinCode],
    });

    // Fetch the post-sync observation from Asins table using the job's channel
    const pool = await getPool();
    const postSync = await pool
      .request()
      .input('sellerId', sql.VarChar, sellerId)
      .input('channel', sql.VarChar, channel)
      .input('asin', sql.VarChar, asinCode)
      .query(`
        SELECT TOP 1 AsinCode, Availability, AvailabilityStatus, ScrapeStatus, StockLevel, LastScrapedAt
        FROM Asins WHERE SellerId = @sellerId AND Marketplace = @channel AND AsinCode = @asin
      `);

    const postSyncObs = postSync.recordset[0] || null;
    let outcome = { status: 'FAILED', resolved: false, reason: 'Live sync did not complete successfully' };

    if (postSyncObs) {
      const retailOps = { state: classifyPostSync(postSyncObs) };
      // Use the job's persisted RequestedAt (not current time) for freshness comparison
      const job = await getResyncJob(jobId);
      const requestedAt = job.RequestedAt ? new Date(job.RequestedAt) : new Date();
      outcome = applyResyncVerification(
        { sellerId, channel, asin: asinCode, requestedAt },
        { state: retailOps.state, observationTime: postSyncObs.LastScrapedAt }
      );
    }

    await updateJobStatus(
      jobId,
      outcome.resolved ? 'VERIFIED_RECOVERED' : 'OPEN_DISCREPANCY',
      {
        postStatus: outcome.status,
        observationTime: new Date(),
        completedAt: new Date(),
        resultJson: { outcome },
      }
    );

    // If resolved, resolve the incident
    if (outcome.resolved) {
      await incidents.resolveForAsin({
        sellerId,
        channel,
        asin: asinCode,
        actorId: 'system',
        detail: { resyncJobId: jobId, outcome, autoResolved: true },
      }).catch(() => {});
    }

  } catch (err) {
    console.error(`Resync execution failed for job ${jobId}:`, err.message);

    // Increment dispatch attempt and retry if under limit
    const job = await getResyncJob(jobId);
    if (job) {
      const nextAttempt = Number(job.DispatchAttempt || 0) + 1;
      if (nextAttempt < MAX_DISPATCH_ATTEMPTS) {
        // Retry with backoff
        setTimeout(() => {
          dispatchResync(sellerId, asinCode, channel, jobId).catch(() => {});
        }, 2000 * nextAttempt);
        await updateJobStatus(jobId, 'QUEUED', { dispatchAttempt: nextAttempt });
        return;
      }
      // Terminal failure after max attempts
      await updateJobStatus(jobId, 'FAILED', {
        dispatchAttempt: nextAttempt,
        completedAt: new Date(),
        failureCode: 'MAX_ATTEMPTS_EXCEEDED',
        error: err.message,
      });
    }
  }
}

function classifyPostSync(row) {
  if (!row) return 'UNKNOWN';
  if (row.Availability === 'OutOfStock') return 'OOS';
  if (row.Availability === 'InStock') return 'IN_STOCK';
  if (row.AvailabilityStatus) {
    const text = String(row.AvailabilityStatus).toLowerCase().trim();
    if (text.includes('unavailable') || text.includes('out of stock') || text === 'available_date') return 'OOS';
    if (text === 'in stock' || text === 'add to bag') return 'IN_STOCK';
    if (text.startsWith('only ') && text.includes('left in stock')) return 'LOW_STOCK';
  }
  return 'UNKNOWN';
}

async function updateJobStatus(jobId, status, extra = {}) {
  const pool = await getPool();
  const updates = ['Status = @status', 'UpdatedAt = GETUTCDATE()'];
  const request = pool.request().input('id', sql.VarChar, jobId).input('status', sql.VarChar, status);

  if (extra.postStatus) { request.input('postStatus', sql.NVarChar, extra.postStatus); updates.push('PostStatus = @postStatus'); }
  if (extra.observationTime) { request.input('observationTime', sql.DateTime2, extra.observationTime); updates.push('ObservationTime = @observationTime'); }
  if (extra.completedAt) { request.input('completedAt', sql.DateTime2, extra.completedAt); updates.push('CompletedAt = @completedAt'); }
  if (extra.resultJson) { request.input('resultJson', sql.NVarChar(sql.MAX), JSON.stringify(extra.resultJson)); updates.push('ResultJson = @resultJson'); }
  if (extra.error) { request.input('error', sql.NVarChar, extra.error); updates.push('ErrorMessage = @error'); }
  if (extra.failureCode) { request.input('failureCode', sql.VarChar, extra.failureCode); updates.push('FailureCode = @failureCode'); }
  if (extra.dispatchAttempt !== undefined) { request.input('dispatchAttempt', sql.Int, extra.dispatchAttempt); updates.push('DispatchAttempt = @dispatchAttempt'); }

  await request.query(`UPDATE OosResyncJobs SET ${updates.join(', ')} WHERE Id = @id`);
}

/**
 * Record post-sync verification. Only a NEWER in-stock observation for the same
 * scope resolves the incident; unchanged/failed/timeout stays open.
 *
 * FIXED: Now fetches the actual post-sync observation from the server instead of
 * accepting client-supplied state/time. Only resolves if server-fetched observation
 * shows IN_STOCK and is newer than the request.
 */
async function verifyResync(jobId, actorId) {
  const pool = await getPool();
  const jobResult = await pool
    .request()
    .input('id', sql.VarChar, jobId)
    .query('SELECT TOP 1 * FROM OosResyncJobs WHERE Id = @id');
  const job = jobResult.recordset[0];
  if (!job) throw httpError(404, 'Resync job not found', 'RESYNC_NOT_FOUND');

  // Fetch the actual post-sync observation from the Asins table using the job's channel
  const postSync = await pool
    .request()
    .input('sellerId', sql.VarChar, job.SellerId)
    .input('channel', sql.VarChar, job.Channel)
    .input('asin', sql.VarChar, job.AsinCode)
    .query(`
      SELECT TOP 1 AsinCode, Availability, AvailabilityStatus, ScrapeStatus, StockLevel, LastScrapedAt
      FROM Asins WHERE SellerId = @sellerId AND Marketplace = @channel AND AsinCode = @asin
    `);

  const postSyncObs = postSync.recordset[0];
  if (!postSyncObs) {
    await updateJobStatus(jobId, 'OPEN_DISCREPANCY', {
      resultJson: { outcome: { status: 'OPEN_DISCREPANCY', resolved: false, reason: 'No post-sync observation found' } },
    });
    return { jobId, status: 'OPEN_DISCREPANCY', resolved: false, reason: 'No post-sync observation found' };
  }

  // FIXED: postSyncObs is already the row object (recordset[0]), not the recordset
  const retailOpsState = classifyPostSync(postSyncObs);
  const requestedAt = job.CreatedAt ? new Date(job.CreatedAt) : new Date();
  const outcome = applyResyncVerification(
    { sellerId: job.SellerId, channel: job.Channel, asin: job.AsinCode, requestedAt },
    { state: retailOpsState, observationTime: postSyncObs.LastScrapedAt }
  );

  await updateJobStatus(jobId, outcome.resolved ? 'VERIFIED_RECOVERED' : outcome.status, {
    postStatus: retailOpsState,
    observationTime: postSyncObs.LastScrapedAt,
    completedAt: new Date(),
    resultJson: { outcome },
  });

  // If resolved, resolve the incident
  if (outcome.resolved) {
    await incidents.resolveForAsin({
      sellerId: job.SellerId,
      channel: job.Channel,
      asin: job.AsinCode,
      actorId: 'system',
      detail: { resyncJobId: jobId, outcome, autoResolved: true },
    }).catch(() => {});
  }

  return {
    jobId,
    ...outcome,
    incidentResolved: outcome.resolved,
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
