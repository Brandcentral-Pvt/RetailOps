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
 */
async function submitRun(runId, {
  reviewerId,
  actorId,
  sourcesValidated,
  exceptionsRecorded,
  blockingReasons,
  note,
} = {}) {
  if (!runId) throw httpError(400, 'runId is required', 'RUN_REQUIRED');
  const pool = await getPool();
  const runResult = await pool
    .request()
    .input('id', sql.VarChar, runId)
    .query('SELECT TOP 1 * FROM OosRuns WHERE Id = @id');
  const run = runResult.recordset[0];
  if (!run) throw httpError(404, 'OOS run not found', 'RUN_NOT_FOUND');

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

  const independentReviewer = Boolean(reviewerId) && reviewerId !== run.CreatedBy;
  const errorsFromReviewer = reviewerId && !independentReviewer
    ? ['The reviewer must be independent of the preparer.']
    : [];

  const gate = checkSubmission({
    sourcesValidated: sourcesValidated ?? importsValidated,
    exceptionsRecorded: Boolean(exceptionsRecorded),
    casesMissingDisposition: Number(missingResult.recordset[0]?.Missing || 0),
    openIncidents,
    exportHash: latestExport?.FileHash || null,
    reviewerId: reviewerId || null,
    blockingReasons: [
      ...(Array.isArray(blockingReasons) ? blockingReasons : []),
      ...errorsFromReviewer,
      ...(imports.length === 0 ? ['No source report has been uploaded for this run.'] : []),
    ],
  });

  const status = gate.ok ? 'APPROVED' : 'REJECTED';
  const review = await pool
    .request()
    .input('id', sql.VarChar, generateId())
    .input('runId', sql.VarChar, runId)
    .input('reviewerId', sql.VarChar, reviewerId || '')
    .input('status', sql.VarChar, status)
    .input('checklistJson', sql.NVarChar(sql.MAX), JSON.stringify({ checklist: gate.checklist, note: note || null }))
    .input('blockingReasonsJson', sql.NVarChar(sql.MAX), JSON.stringify(gate.errors))
    .query(`
      INSERT INTO OosSubmissionReviews (Id, RunId, ReviewerId, Status, ChecklistJson, BlockingReasonsJson, CreatedAt)
      OUTPUT INSERTED.*
      VALUES (@id, @runId, @reviewerId, @status, @checklistJson, @blockingReasonsJson, GETUTCDATE())
    `);

  if (gate.ok) {
    await pool
      .request()
      .input('id', sql.VarChar, runId)
      .query("UPDATE OosRuns SET Status = 'CLOSED', UpdatedAt = GETUTCDATE() WHERE Id = @id");
  }

  return {
    ok: gate.ok,
    errors: gate.errors,
    checklist: gate.checklist,
    review: review.recordset[0],
    runStatus: gate.ok ? 'CLOSED' : run.Status,
    openIncidents: openIncidents.length,
    exportVersion: latestExport?.Version || null,
    exportHash: latestExport?.FileHash || null,
  };
}

module.exports = { submitRun };
