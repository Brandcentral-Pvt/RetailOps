const { getPool, sql, generateId } = require('../../database/db');
const dayjs = require('dayjs');
const { getActivePolicy } = require('../../services/oos/oosPolicyService');
const monitoring = require('../../services/oos/oosMonitoringService');
const uploads = require('../../services/oos/oosUploadService');
const reconciliation = require('../../services/oos/oosReconciliationService');
const incidents = require('../../services/oos/oosIncidentService');
const pareto = require('../../services/oos/oosParetoService');
const sync = require('../../services/oos/oosSyncService');
const exportsService = require('../../services/oos/oosExportService');
const submission = require('../../services/oos/oosSubmissionService');
const { resolveSellerScope } = require('../../utils/sellerScope');
const { getViewDefinitionForTaskInstance } = require('../../services/pems/taskViewDefinitionService');

function fail(res, err) {
  const status = err.status || 500;
  return res.status(status).json({ success: false, code: err.code || 'OOS_ERROR', error: err.message });
}

async function getTaskInstance(taskInstanceId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.VarChar, taskInstanceId)
    .query('SELECT * FROM PemsTaskInstances WHERE Id = @id');
  return result.recordset[0] || null;
}

function sellerScopeOr403(req, res, sellerId) {
  const scope = resolveSellerScope(req.user, sellerId);
  if (scope.denied) {
    res.status(403).json({
      success: false,
      code: 'forbidden_seller',
      error: 'You do not have access to the requested seller.',
      requestedSellers: scope.requested,
      assignedSellers: scope.allowed,
    });
    return null;
  }
  return scope;
}

async function ensureTaskAccess(req, res, taskInstanceId) {
  const task = await getTaskInstance(taskInstanceId);
  if (!task) return res.status(404).json({ success: false, code: 'TASK_NOT_FOUND', error: 'Task instance not found' });
  const scope = sellerScopeOr403(req, res, task.SellerId);
  if (!scope) return null;
  return task;
}

exports.getTaskView = async (req, res) => {
  try {
    const task = await ensureTaskAccess(req, res, req.params.id);
    if (!task) return;

    const viewResult = await getViewDefinitionForTaskInstance(task.Id);
    return res.json({ success: true, data: { ...task, viewDefinition: viewResult } });
  } catch (err) { return fail(res, err); }
};

exports.getOosContext = async (req, res) => {
  try {
    const task = await ensureTaskAccess(req, res, req.params.id);
    if (!task) return;

    const sellerId = req.params.sellerId || req.query.sellerId;
    if (!sellerId) return res.status(400).json({ success: false, error: 'sellerId required' });

    const scope = sellerScopeOr403(req, res, sellerId);
    if (!scope) return;

    const runResult = await monitoring.getRun(req.query.runId);
    if (!runResult) return res.json({ success: true, data: { counts: {}, manifest: null } });

    const policy = await getActivePolicy();
    const [counts, manifest] = await Promise.all([
      reconciliation.listDecisions(runResult.Id).then(d => d.reduce((acc, d) => { acc[d.Category] = (acc[d.Category] || 0) + 1; return acc; }, {})),
      Promise.resolve(runResult.ManifestJson ? JSON.parse(runResult.ManifestJson) : null),
    ]);

    return res.json({ success: true, data: { counts, manifest, status: runResult.Status, channel: runResult.Channel } });
  } catch (err) { return fail(res, err); }
};

exports.listOosRuns = async (req, res) => {
  try {
    const task = await ensureTaskAccess(req, res, req.params.id);
    if (!task) return;

    const sellerId = req.params.sellerId;
    const scope = sellerScopeOr403(req, res, sellerId);
    if (!scope) return;

    const runs = await monitoring.listRuns({ sellerId });
    return res.json({ success: true, runs });
  } catch (err) { return fail(res, err); }
};

exports.createOosRun = async (req, res) => {
  try {
    const task = await ensureTaskAccess(req, res, req.params.id);
    if (!task) return;

    const sellerId = req.params.sellerId;
    const scope = sellerScopeOr403(req, res, sellerId);
    if (!scope) return;

    const result = await monitoring.createOrGetRun({
      sellerId,
      channel: req.body.channel,
      runDate: req.body.runDate,
      monitoredDate: req.body.monitoredDate,
      createdBy: req.user?.Id,
      taskInstanceId: req.params.id,
    });

    return res.status(result.created ? 201 : 200).json({ success: true, created: result.created, run: result.run, manifest: result.manifest, binding: result.binding });
  } catch (err) { return fail(res, err); }
};

exports.uploadOosFile = async (req, res) => {
  try {
    const task = await ensureTaskAccess(req, res, req.params.id);
    if (!task) return;

    const runId = req.params.runId;
    const run = await monitoring.getRun(runId);
    if (!run) return res.status(404).json({ success: false, error: 'Run not found' });

    const file = req.file;
    if (!file) return res.status(400).json({ success: false, error: 'No file uploaded' });

    const sourceType = req.body.sourceType;
    if (!sourceType) return res.status(400).json({ success: false, error: 'sourceType required' });

    const result = await uploads.ingestUpload({
      runId: run.Id,
      sellerId: run.SellerId,
      channel: run.Channel,
      sourceType,
      fileName: file.originalname,
      fileBuffer: file.buffer,
      createdBy: req.user?.Id,
    });

    return res.status(result.idempotent ? 200 : 201).json({ success: true, ...result });
  } catch (err) { return fail(res, err); }
};

exports.listOosUploads = async (req, res) => {
  try {
    const task = await ensureTaskAccess(req, res, req.params.id);
    if (!task) return;

    const runId = req.params.runId;
    const uploadsList = await uploads.listImports(runId);
    return res.json({ success: true, uploads: uploadsList });
  } catch (err) { return fail(res, err); }
};

exports.downloadOosImport = async (req, res) => {
  try {
    const task = await ensureTaskAccess(req, res, req.params.id);
    if (!task) return;

    const importId = req.params.importId;
    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', sql.VarChar, importId)
      .query('SELECT TOP 1 * FROM OosImports WHERE Id = @id');
    const imp = result.recordset[0];
    if (!imp) return res.status(404).json({ success: false, error: 'Import not found' });

    const fs = require('fs');
    const path = require('path');
    if (!fs.existsSync(imp.OriginalFileStoragePath)) {
      return res.status(404).json({ success: false, error: 'Original file not found on disk' });
    }

    const fileBuffer = fs.readFileSync(imp.OriginalFileStoragePath);
    res.setHeader('Content-Type', imp.OriginalFileContentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${imp.OriginalFileName || 'oos-upload'}"`);
    res.setHeader('X-Import-Hash', imp.FileHash || imp.OriginalFileHash);
    return res.send(fileBuffer);
  } catch (err) { return fail(res, err); }
};

exports.reconcileOosRun = async (req, res) => {
  try {
    const task = await ensureTaskAccess(req, res, req.params.id);
    if (!task) return;

    const runId = req.params.runId;
    const result = await reconciliation.reconcileRun(runId, { actorId: req.user?.Id });
    return res.json({ success: true, ...result });
  } catch (err) { return fail(res, err); }
};

// Allowlist for sort keys — prevents SQL injection via sortBy (AS-02)
const ALLOWED_SORT_KEYS = new Set([
  'AsinCode', 'Sku', 'PriorityGroup', 'Gms', 'GmsSharePct', 'CumulativePct',
  'Category', 'IsNewAsin', 'FirstSeenAt', 'CreatedAt', 'Classification',
  'IncidentStatus', 'ResyncStatus'
]);
const ALLOWED_SORT_DIRS = new Set(['asc', 'desc']);

exports.getAffectedAsins = async (req, res) => {
  try {
    const task = await ensureTaskAccess(req, res, req.params.id);
    if (!task) return;

    const runId = req.query.runId;
    if (!runId) return res.status(400).json({ success: false, error: 'runId required' });

    const scope = sellerScopeOr403(req, res, req.query.sellerId);
    if (!scope) return;

    // Clamp and validate pagination
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize) || 50, 1), 200);

    // Allowlist sort key/direction — default to PriorityGroup desc
    const sortBy = ALLOWED_SORT_KEYS.has(req.query.sortBy) ? req.query.sortBy : 'PriorityGroup';
    const sortOrder = ALLOWED_SORT_DIRS.has(String(req.query.sortOrder).toLowerCase())
      ? String(req.query.sortOrder).toLowerCase() : 'desc';

    const pool = await getPool();
    const runResult = await pool.request().input('id', sql.VarChar, runId).query('SELECT TOP 1 * FROM OosRuns WHERE Id = @id');
    const run = runResult.recordset[0];
    if (!run) return res.status(404).json({ success: false, error: 'Run not found' });

    const scopeCheck = sellerScopeOr403(req, res, run.SellerId);
    if (!scopeCheck) return;

    // Build WHERE clause against vw_OosAffectedAsins (decision metrics view)
    let where = 'WHERE v.RunId = @runId AND v.SellerId = @sellerId AND v.Channel = @channel';
    const request = pool.request().input('runId', sql.VarChar, runId).input('sellerId', sql.VarChar, run.SellerId).input('channel', sql.VarChar, run.Channel);

    if (req.query.classification) { request.input('classification', sql.VarChar, req.query.classification); where += ' AND v.Classification = @classification'; }
    if (req.query.priorityGroup) { request.input('priorityGroup', sql.VarChar, req.query.priorityGroup); where += ' AND v.PriorityGroup = @priorityGroup'; }
    if (req.query.isNew !== undefined) { request.input('isNew', sql.Bit, req.query.isNew === 'true' ? 1 : 0); where += ' AND v.IsNewAsin = @isNew'; }
    if (req.query.gmsVerification !== undefined) { request.input('gmsVerification', sql.Bit, req.query.gmsVerification === 'true' ? 1 : 0); where += ' AND v.GmsVerified = @gmsVerification'; }
    if (req.query.resyncStatus) { request.input('resyncStatus', sql.VarChar, req.query.resyncStatus); where += ' AND v.ResyncStatus = @resyncStatus'; }
    if (req.query.incidentStatus) { request.input('incidentStatus', sql.VarChar, req.query.incidentStatus); where += ' AND v.IncidentStatus = @incidentStatus'; }
    if (req.query.ownerId) { request.input('ownerId', sql.VarChar, req.query.ownerId); where += ' AND v.IncidentOwnerId = @ownerId'; }
    if (req.query.search) { request.input('search', sql.VarChar, `%${req.query.search}%`); where += ' AND (v.AsinCode LIKE @search OR v.Sku LIKE @search)'; }

    const countResult = await request.query(`SELECT COUNT(*) as total FROM vw_OosAffectedAsins v ${where}`);
    const total = countResult.recordset[0].total;

    const offset = (page - 1) * pageSize;
    const limit = pageSize;

    const dataResult = await request.query(`
      SELECT v.*
      FROM vw_OosAffectedAsins v
      ${where}
      ORDER BY v.${sortBy} ${sortOrder}
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `, { offset, limit });

    const rows = dataResult.recordset.map(r => ({
      id: r.DecisionId,
      asinCode: r.AsinCode,
      sku: r.Sku,
      productTitle: r.ProductTitle,
      sellerId: r.SellerId,
      sellerName: r.SellerName,
      channel: r.Channel,
      classification: r.Classification,
      ruleId: r.RuleId,
      confidence: r.Confidence,
      revision: r.Revision,
      priorityGroup: r.PriorityGroup,
      isNewAsin: r.IsNewAsin,
      firstSeenAt: r.FirstSeenAt,
      gmsVerified: r.GmsVerified,
      gms: r.Gms,
      gmsSharePct: r.GmsSharePct,
      cumulativePct: r.CumulativePct,
      retailOpsState: r.RetailOpsState,
      brandCentralState: r.BrandCentralState,
      vendorCentralState: r.VendorCentralState,
      classificationVersion: r.ClassificationVersion,
      computedAt: r.ComputedAt,
      resyncStatus: r.ResyncStatus || 'NONE',
      resyncJobId: r.ResyncJobId,
      resyncRequestedAt: r.ResyncRequestedAt,
      resyncObservedAt: r.ResyncObservedAt,
      incidentStatus: r.IncidentStatus,
      incidentOwner: r.IncidentOwnerId,
      communicationStatus: r.CommunicationStatus,
      nextAction: r.NextAction,
      etaDate: r.EtaDate,
      followUpDate: r.FollowUpDate,
    }));

    return res.json({ success: true, data: { rows, total, page, pageSize } });
  } catch (err) { return fail(res, err); }
};

exports.getAffectedAsinsSummary = async (req, res) => {
  try {
    const task = await ensureTaskAccess(req, res, req.params.id);
    if (!task) return;

    const runId = req.query.runId;
    if (!runId) return res.status(400).json({ success: false, error: 'runId required' });

    const scope = sellerScopeOr403(req, res, req.query.sellerId);
    if (!scope) return;

    const pool = await getPool();
    const result = await pool.request().input('runId', sql.VarChar, runId).query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN Category = 'CONFIRMED_CHANNEL_OOS' THEN 1 ELSE 0 END) as CONFIRMED_CHANNEL_OOS,
        SUM(CASE WHEN Category = 'DISCREPANCY' THEN 1 ELSE 0 END) as DISCREPANCY,
        SUM(CASE WHEN Category = 'INSUFFICIENT_EVIDENCE' THEN 1 ELSE 0 END) as INSUFFICIENT_EVIDENCE,
        SUM(CASE WHEN Category = 'NO_CURRENT_OOS_SIGNAL' THEN 1 ELSE 0 END) as NO_CURRENT_OOS_SIGNAL,
        SUM(CASE WHEN PriorityGroup = '80%' THEN 1 ELSE 0 END) as PRIORITY_80,
        SUM(CASE WHEN PriorityGroup = '20%' THEN 1 ELSE 0 END) as PRIORITY_20,
        SUM(CASE WHEN IsNewAsin = 1 THEN 1 ELSE 0 END) as NEW_ASIN_20,
        SUM(CASE WHEN GmsVerified = 0 THEN 1 ELSE 0 END) as GMS_UNVERIFIED
      FROM OosDecisions WHERE RunId = @runId
    `);

    return res.json({ success: true, counts: result.recordset[0] });
  } catch (err) { return fail(res, err); }
};

exports.getAffectedAsinDetail = async (req, res) => {
  try {
    const task = await ensureTaskAccess(req, res, req.params.id);
    if (!task) return;

    const caseId = req.params.caseId;
    const pool = await getPool();
    const result = await pool.request().input('id', sql.VarChar, caseId).query('SELECT TOP 1 * FROM OosDecisions WHERE Id = @id');
    if (!result.recordset[0]) return res.status(404).json({ success: false, error: 'Case not found' });

    return res.json({ success: true, data: result.recordset[0] });
  } catch (err) { return fail(res, err); }
};

exports.requestResync = async (req, res) => {
  try {
    const task = await ensureTaskAccess(req, res, req.params.id);
    if (!task) return;

    const runId = req.params.runId;
    const caseId = req.params.caseId;

    const pool = await getPool();
    const decision = await pool.request().input('id', sql.VarChar, caseId).query('SELECT TOP 1 * FROM OosDecisions WHERE Id = @id');
    if (!decision.recordset[0]) return res.status(404).json({ success: false, error: 'Case not found' });

    const result = await sync.requestResync({ runId, asin: decision.recordset[0].AsinCode, revision: decision.recordset[0].Revision, requestedBy: req.user?.Id });
    return res.json({ success: true, ...result });
  } catch (err) { return fail(res, err); }
};

exports.getResyncStatus = async (req, res) => {
  try {
    const task = await ensureTaskAccess(req, res, req.params.id);
    if (!task) return;

    const runId = req.params.runId;
    const caseId = req.params.caseId;

    const pool = await getPool();
    const decision = await pool.request().input('id', sql.VarChar, caseId).query('SELECT TOP 1 * FROM OosDecisions WHERE Id = @id');
    if (!decision.recordset[0]) return res.status(404).json({ success: false, error: 'Case not found' });

    const jobs = await sync.listResyncJobs(runId);
    const job = jobs.find(j => j.AsinCode === decision.recordset[0].AsinCode);
    if (!job) return res.status(404).json({ success: false, error: 'Resync job not found' });

    return res.json({ success: true, job });
  } catch (err) { return fail(res, err); }
};

exports.verifyResync = async (req, res) => {
  try {
    const task = await ensureTaskAccess(req, res, req.params.id);
    if (!task) return;

    const runId = req.params.runId;
    const caseId = req.params.caseId;

    const pool = await getPool();
    const decision = await pool.request().input('id', sql.VarChar, caseId).query('SELECT TOP 1 * FROM OosDecisions WHERE Id = @id');
    if (!decision.recordset[0]) return res.status(404).json({ success: false, error: 'Case not found' });

    const jobs = await sync.listResyncJobs(runId);
    const job = jobs.find(j => j.AsinCode === decision.recordset[0].AsinCode);
    if (!job) return res.status(404).json({ success: false, error: 'Resync job not found' });

    const result = await sync.verifyResync(job.Id, req.user?.Id);
    return res.json({ success: true, ...result });
  } catch (err) { return fail(res, err); }
};

exports.updateIncident = async (req, res) => {
  try {
    const task = await ensureTaskAccess(req, res, req.params.id);
    if (!task) return;

    const caseId = req.params.caseId;
    const pool = await getPool();
    const incident = await pool.request().input('id', sql.VarChar, caseId).query('SELECT TOP 1 * FROM OosIncidents WHERE Id = @id');
    if (!incident.recordset[0]) return res.status(404).json({ success: false, error: 'Incident not found' });

    const updated = await incidents.updateIncident(caseId, req.body, req.user?.Id);
    return res.json({ success: true, incident: updated });
  } catch (err) { return fail(res, err); }
};

exports.resolveOosIncident = async (req, res) => {
  try {
    const task = await ensureTaskAccess(req, res, req.params.id);
    if (!task) return;

    const caseId = req.params.caseId;
    const { action, waiveReason } = req.body || {};
    
    if (!action || !['resolve', 'waive'].includes(action)) {
      return res.status(400).json({ success: false, error: 'action must be "resolve" or "waive"' });
    }
    if (action === 'waive' && !waiveReason) {
      return res.status(400).json({ success: false, error: 'waiveReason required when waiving' });
    }

    const pool = await getPool();
    const incident = await pool.request().input('id', sql.VarChar, caseId).query('SELECT TOP 1 * FROM OosIncidents WHERE Id = @id');
    if (!incident.recordset[0]) return res.status(404).json({ success: false, error: 'Incident not found' });

    const incidentData = incident.recordset[0];
    
    // Verify this incident belongs to the task's run
    const runCheck = await pool.request()
      .input('runId', sql.VarChar, incidentData.RunId)
      .input('taskInstanceId', sql.VarChar, req.params.id)
      .query('SELECT Id FROM OosTaskBindings WHERE TaskInstanceId = @taskInstanceId AND OosRunId = @runId');
    if (!runCheck.recordset.length) {
      return res.status(403).json({ success: false, error: 'Incident does not belong to this task' });
    }

    const result = await incidents.resolveIncident(caseId, {
      actorId: req.user?.Id,
      runId: incidentData.RunId,
      detail: { action, waiveReason },
      status: action === 'waive' ? 'WAIVED' : 'RESOLVED'
    });

    return res.json({ success: true, incident: result.incident, changed: result.changed });
  } catch (err) { return fail(res, err); }
};

exports.buildExport = async (req, res) => {
  try {
    const task = await ensureTaskAccess(req, res, req.params.id);
    if (!task) return;

    const runId = req.query.runId || req.body.runId;
    if (!runId) return res.status(400).json({ success: false, error: 'runId required' });

    const scope = req.body.scope || 'ALL_AUTHORIZED';
    const result = await exportsService.buildExport(runId, {
      createdBy: req.user?.Id,
      taskInstanceId: req.params.id,
    });
    return res.status(201).json({ success: true, ...result });
  } catch (err) { return fail(res, err); }
};

exports.listExports = async (req, res) => {
  try {
    const task = await ensureTaskAccess(req, res, req.params.id);
    if (!task) return;

    const runId = req.query.runId;
    if (!runId) return res.status(400).json({ success: false, error: 'runId required' });

    const pool = await getPool();
    const result = await pool.request().input('runId', sql.VarChar, runId).query('SELECT * FROM OosExports WHERE RunId = @runId ORDER BY Version DESC');
    return res.json({ success: true, exports: result.recordset });
  } catch (err) { return fail(res, err); }
};

exports.downloadExport = async (req, res) => {
  try {
    const task = await ensureTaskAccess(req, res, req.params.id);
    if (!task) return;

    const exportId = req.params.exportId;
    const result = await exportsService.buildWorkbook(exportId);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
    res.setHeader('X-Export-Hash', result.record.FileHash);
    return res.send(result.buffer);
  } catch (err) { return fail(res, err); }
};

exports.submitOos = async (req, res) => {
  try {
    const task = await ensureTaskAccess(req, res, req.params.id);
    if (!task) return;

    const runId = req.query.runId || req.body.runId;
    if (!runId) return res.status(400).json({ success: false, error: 'runId required' });

    const pool = await getPool();
    const runResult = await pool.request().input('id', sql.VarChar, runId).query('SELECT TOP 1 * FROM OosRuns WHERE Id = @id');
    const run = runResult.recordset[0];
    if (!run) return res.status(404).json({ success: false, error: 'Run not found' });

    // Submission does NOT require a reviewerId - reviewer is assigned later
    // via the PEMS review queue. The executor submits for review only.
    const result = await submission.submitRun(runId, {
      actorId: req.user?.Id,
      sourcesValidated: req.body.sourcesValidated,
      exceptionsRecorded: req.body.exceptionsRecorded,
      blockingReasons: req.body.blockingReasons,
    });

    return res.json({ success: true, ...result });
  } catch (err) { return fail(res, err); }
};

exports.reviewOos = async (req, res) => {
  try {
    const task = await ensureTaskAccess(req, res, req.params.id);
    if (!task) return;

    const runId = req.query.runId || req.body.runId;
    if (!runId) return res.status(400).json({ success: false, error: 'runId required' });

    const { decision, feedback, waiverReason, waiverExpiry } = req.body;
    if (!decision || !['APPROVED', 'REJECTED', 'WAIVED'].includes(decision)) {
      return res.status(400).json({ success: false, error: 'decision must be APPROVED, REJECTED, or WAIVED' });
    }

    // Reviewer is the authenticated user making the review decision
    const reviewerId = req.user?.Id;
    if (!reviewerId) {
      return res.status(401).json({ success: false, error: 'Authenticated reviewer required' });
    }

    const result = await submission.reviewSubmission(runId, {
      reviewerId,
      actorId: req.user?.Id,
      decision,
      feedback,
      waiverReason,
      waiverExpiry,
    });

    return res.json({ success: true, ...result });
  } catch (err) { return fail(res, err); }
};