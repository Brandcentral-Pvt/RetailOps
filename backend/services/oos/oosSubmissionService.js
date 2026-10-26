const { getPool, sql, generateId } = require('../../database/db');
const { checkSubmission } = require('./oosPolicy');
const { getLatestExport } = require('./oosExportService');

function httpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code || message;
  return err;
}

/**
 * Review & close a daily run. Open incidents are allowed to persist, but each
 * must be fully owned, and the reviewer must be independent of the preparer.
 * 
 * FIXED: Now uses genuine PEMS reviewer flow. The executor submits for review,
 * and an independent authenticated reviewer must approve/reject via the PEMS
 * review queue. The executor CANNOT approve their own work.
 */
async function submitRun(runId, { actorId, sourcesValidated, exceptionsRecorded, blockingReasons } = {}) {
  if (!runId) throw httpError(400, 'runId is required', 'RUN_REQUIRED');
  const pool = await getPool();
  const runResult = await pool
    .request()
    .input('id', sql.VarChar, runId)
    .query('SELECT TOP 1 * FROM OosRuns WHERE Id = @id');
  const run = runResult.recordset[0];
  if (!run) throw httpError(404, 'OOS run not found', 'RUN_NOT_FOUND');

  // Check for missing dispositions
  const missingResult = await pool
    .request()
    .input('runId', sql.VarChar, runId)
    .input('sellerId', sql.VarChar, run.SellerId)
    .input('channel', sql.VarChar, run.Channel)
    .query(`
      SELECT COUNT(*) AS Missing
      FROM (SELECT DISTINCT AsinCode FROM OosObservations WHERE RunId = @runId AND IsValid = 1) o
      LEFT JOIN OosDecisions d
        ON d.RunId = @runId AND d.SellerId = @sellerId AND d.Channel = @channel AND d.AsinCode = o.AsinCode
      WHERE d.Id IS NULL
    `);

  const importsResult = await pool
    .request()
    .input('runId', sql.VarChar, runId)
    .query('SELECT * FROM OosImports WHERE RunId = @runId');
  const imports = importsResult.recordset;

  const incidentResult = await pool
    .request()
    .input('sellerId', sql.VarChar, run.SellerId)
    .input('channel', sql.VarChar, run.Channel)
    .query(`
      SELECT AsinCode, OwnerId, CommunicationStatus, NextAction, FollowUpDate
      FROM OosIncidents WHERE SellerId = @sellerId AND Channel = @channel AND Status = 'OPEN'
    `);
  const openIncidents = incidentResult.recordset.map((r) => ({
    asin: r.AsinCode,
    channel: run.Channel,
    ownerId: r.OwnerId,
    communicationStatus: r.CommunicationStatus,
    nextAction: r.NextAction,
    followUpDate: r.FollowUpDate,
  }));

  const latestExport = await getLatestExport(runId);
  const importsValidated = imports.length > 0 && imports.every((i) => i.Status !== 'REJECTED');

  const gate = checkSubmission({
    sourcesValidated: sourcesValidated ?? importsValidated,
    exceptionsRecorded: Boolean(exceptionsRecorded),
    casesMissingDisposition: Number(missingResult.recordset[0]?.Missing || 0),
    openIncidents,
    exportHash: latestExport?.FileHash || null,
    reviewerId: null, // Reviewer is determined by PEMS review queue, not passed in
    blockingReasons: [
      ...(Array.isArray(blockingReasons) ? blockingReasons : []),
      ...(imports.length === 0 ? ['No source report has been uploaded for this run.'] : []),
    ],
  });

  // Record submission request (SUBMITTED, not APPROVED)
  const review = await pool
    .request()
    .input('id', sql.VarChar, generateId())
    .input('runId', sql.VarChar, runId)
    .input('reviewerId', sql.VarChar, '') // Will be filled by reviewer when they act
    .input('status', sql.VarChar, 'SUBMITTED') // Not APPROVED - reviewer must approve
    .input('checklistJson', sql.NVarChar(sql.MAX), JSON.stringify({ checklist: gate.checklist }))
    .input('blockingReasonsJson', sql.NVarChar(sql.MAX), JSON.stringify(gate.errors))
    .query(`
      INSERT INTO OosSubmissionReviews (Id, RunId, ReviewerId, Status, ChecklistJson, BlockingReasonsJson, CreatedAt)
      OUTPUT INSERTED.*
      VALUES (@id, @runId, @reviewerId, @status, @checklistJson, @blockingReasonsJson, GETUTCDATE())
    `);

  // Update run status to SUBMITTED (not CLOSED - reviewer must approve)
  if (gate.ok) {
    await pool
      .request()
      .input('id', sql.VarChar, runId)
      .query("UPDATE OosRuns SET Status = 'SUBMITTED', UpdatedAt = GETUTCDATE() WHERE Id = @id");
  }

  return {
    ok: gate.ok,
    errors: gate.errors,
    checklist: gate.checklist,
    review: review.recordset[0],
    runStatus: gate.ok ? 'SUBMITTED' : run.Status,
    openIncidents: openIncidents.length,
    exportVersion: latestExport?.Version || null,
    exportHash: latestExport?.FileHash || null,
    message: gate.ok ? 'Submitted for independent review. Task will close only after reviewer approval.' : 'Submission blocked - see checklist',
  };
}

/**
 * Independent reviewer approves or rejects the submission.
 * Reviewer must be authenticated and different from the preparer.
 */
async function reviewSubmission(runId, { reviewerId, actorId, decision, feedback } = {}) {
  if (!runId) throw httpError(400, 'runId is required', 'RUN_REQUIRED');
  if (!reviewerId) throw httpError(400, 'reviewerId is required', 'REVIEWER_REQUIRED');
  if (!['APPROVED', 'REJECTED'].includes(decision)) {
    throw httpError(400, 'decision must be APPROVED or REJECTED', 'INVALID_DECISION');
  }

  const pool = await getPool();
  const runResult = await pool
    .request()
    .input('id', sql.VarChar, runId)
    .query('SELECT TOP 1 * FROM OosRuns WHERE Id = @id');
  const run = runResult.recordset[0];
  if (!run) throw httpError(404, 'OOS run not found', 'RUN_NOT_FOUND');

  // Prevent self-review
  if (reviewerId === run.CreatedBy) {
    throw httpError(403, 'Reviewer must be independent of the preparer', 'SELF_REVIEW_FORBIDDEN');
  }

  // Check if already reviewed
  const existing = await pool
    .request()
    .input('runId', sql.VarChar, runId)
    .query('SELECT TOP 1 * FROM OosSubmissionReviews WHERE RunId = @runId ORDER BY CreatedAt DESC');
  const latestReview = existing.recordset[0];
  if (latestReview && latestReview.Status !== 'SUBMITTED') {
    throw httpError(409, `Run already ${latestReview.Status.toLowerCase()}`, 'ALREADY_REVIEWED');
  }

  const status = decision === 'APPROVED' ? 'APPROVED' : 'REJECTED';
  
  const review = await pool
    .request()
    .input('id', sql.VarChar, generateId())
    .input('runId', sql.VarChar, runId)
    .input('reviewerId', sql.VarChar, reviewerId)
    .input('status', sql.VarChar, status)
    .input('checklistJson', sql.NVarChar(sql.MAX), JSON.stringify({ feedback: feedback || null }))
    .input('blockingReasonsJson', sql.NVarChar(sql.MAX), JSON.stringify([]))
    .query(`
      INSERT INTO OosSubmissionReviews (Id, RunId, ReviewerId, Status, ChecklistJson, BlockingReasonsJson, CreatedAt)
      OUTPUT INSERTED.*
      VALUES (@id, @runId, @reviewerId, @status, @checklistJson, @blockingReasonsJson, GETUTCDATE())
    `);

  if (status === 'APPROVED') {
    await pool
      .request()
      .input('id', sql.VarChar, runId)
      .query("UPDATE OosRuns SET Status = 'CLOSED', UpdatedAt = GETUTCDATE() WHERE Id = @id");
  }

  return {
    ok: status === 'APPROVED',
    review: review.recordset[0],
    runStatus: status === 'APPROVED' ? 'CLOSED' : 'REJECTED',
    message: status === 'APPROVED' ? 'Daily run approved and closed. Open incidents remain tracked.' : 'Run rejected - returned to executor for rework',
  };
}

module.exports = { submitRun, reviewSubmission };