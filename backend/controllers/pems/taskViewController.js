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

    const existing = await monitoring.getRunBySellerAndDate(sellerId, req.body.runDate || dayjs().format('YYYY-MM-DD'));
    if (existing) {
      return res.json({ success: true, created: false, run: existing });
    }

    const result = await monitoring.createOrGetRun({
      sellerId,
      channel: req.body.channel,
      runDate: req.body.runDate,
      monitoredDate: req.body.monitoredDate,
      createdBy: req.user?.Id,
    });

    await getPool().then(pool => pool.request()
      .input('runId', sql.VarChar, result.run.Id)
      .input('taskInstanceId', sql.VarChar, req.params.id)
      .input('sellerId', sql.VarChar, sellerId)
      .input('channel', sql.VarChar, result.run.Channel)
      .query(`
        INSERT INTO OosTaskBindings (Id, TaskInstanceId, OosRunId, SellerId, Channel, State, CreatedAt, UpdatedAt)
        VALUES (NEWID(), @taskInstanceId, @runId, @sellerId, @channel, 'OPEN', GETUTCDATE(), GETUTCDATE())
      `));

    return res.status(201).json({ success: true, created: true, run: result.run, manifest: result.manifest });
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

    const crypto = require('crypto');
    const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');

    const XLSX = require('xlsx');
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });

    const result = await uploads.ingestUpload({
      runId: run.Id,
      sellerId: run.SellerId,
      channel: run.Channel,
      sourceType,
      fileName: file.originalname,
      fileHash,
      rows,
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

exports.reconcileOosRun = async (req, res) => {
  try {
    const task = await ensureTaskAccess(req, res, req.params.id);
    if (!task) return;

    const runId = req.params.runId;
    const result = await reconciliation.reconcileRun(runId, { actorId: req.user?.Id });
    return res.json({ success: true, ...result });
  } catch (err) { return fail(res, err); }
};

exports.getAffectedAsins = async (req, res) => {
  try {
    const task = await ensureTaskAccess(req, res, req.params.id);
    if (!task) return;

    const runId = req.query.runId;
    if (!runId) return res.status(400).json({ success: false, error: 'runId required' });

    const scope = sellerScopeOr403(req, res, req.query.sellerId);
    if (!scope) return;

    const page = parseInt(req.query.page) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize) || 50, 200);
    const sortBy = req.query.sortBy || 'priorityGroup';
    const sortOrder = req.query.sortOrder || 'desc';

    const filters = {
      classification: req.query.classification,
      priorityGroup: req.query.priorityGroup,
      isNew: req.query.isNew === 'true' ? true : req.query.isNew === 'false' ? false : null,
      gmsVerification: req.query.gmsVerification,
      resyncStatus: req.query.resyncStatus,
      incidentStatus: req.query.incidentStatus,
      ownerId: req.query.ownerId,
      search: req.query.search,
    };

    const pool = await getPool();
    const runResult = await pool.request().input('id', sql.VarChar, runId).query('SELECT TOP 1 * FROM OosRuns WHERE Id = @id');
    const run = runResult.recordset[0];
    if (!run) return res.status(404).json({ success: false, error: 'Run not found' });

    const scopeCheck = sellerScopeOr403(req, res, run.SellerId);
    if (!scopeCheck) return;

    let where = 'WHERE d.RunId = @runId AND d.SellerId = @sellerId AND d.Channel = @channel';
    const request = pool.request().input('runId', sql.VarChar, runId).input('sellerId', sql.VarChar, run.SellerId).input('channel', sql.VarChar, run.Channel);

    if (req.query.classification) { request.input('classification', sql.VarChar, req.query.classification); where += ' AND d.Category = @classification'; }
    if (req.query.priorityGroup) { request.input('priorityGroup', sql.VarChar, req.query.priorityGroup); where += ' AND d.PriorityGroup = @priorityGroup'; }
    if (req.query.isNew !== undefined) { request.input('isNew', sql.Bit, req.query.isNew === 'true' ? 1 : 0); where += ' AND d.IsNewAsin = @isNew'; }
    if (req.query.search) { request.input('search', sql.VarChar, `%${req.query.search}%`); where += ' AND (d.AsinCode LIKE @search OR d.Sku LIKE @search)'; }

    const countResult = await request.query(`SELECT COUNT(*) as total FROM OosDecisions d ${where}`);
    const total = countResult.recordset[0].total;

    const offset = (parseInt(req.query.page) - 1) * parseInt(req.query.pageSize || 50);
    const limit = parseInt(req.query.pageSize) || 50;

    const dataResult = await request.query(`
      SELECT d.*, o.OwnerId, o.OwnerName, o.CommunicationStatus, o.NextAction, o.EtaDate, o.FollowUpDate, o.Status as IncidentStatus,
             rj.Id as ResyncJobId, rj.Status as ResyncStatus, rj.CreatedAt as ResyncRequestedAt, rj.ObservationTime as ResyncObservedAt
      FROM OosDecisions d
      LEFT JOIN OosIncidents o ON o.SellerId = d.SellerId AND o.Channel = d.Channel AND o.AsinCode = d.AsinCode AND o.Status = 'OPEN'
      LEFT JOIN OosResyncJobs rj ON rj.RunId = d.RunId AND rj.SellerId = d.SellerId AND rj.Channel = d.Channel AND rj.AsinCode = d.AsinCode
      ${where}
      ORDER BY ${req.query.sortBy || 'd.PriorityGroup'} ${req.query.sortOrder === 'asc' ? 'ASC' : 'DESC'}
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `, { offset, limit });

    const rows = dataResult.recordset.map(r => ({
      id: r.Id,
      asinCode: r.AsinCode,
      sku: r.Sku,
      productTitle: r.ProductTitle,
      sellerId: r.SellerId,
      sellerName: r.SellerName,
      channel: r.Channel,
      classification: r.Category,
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
      retailOpsQuantity: r.RetailOpsQuantity,
      retailOpsRawStatus: r.RetailOpsRawStatus,
      retailOpsObservedAt: r.RetailOpsObservedAt,
      retailOpsFreshness: r.RetailOpsFreshness,
      brandCentralState: r.BrandCentralState,
      brandCentralQuantity: r.BrandCentralQuantity,
      brandCentralRawStatus: r.BrandCentralRawStatus,
      brandCentralObservedAt: r.BrandCentralObservedAt,
      vendorCentralState: r.VendorCentralState,
      vendorCentralQuantity: r.VendorCentralQuantity,
      vendorCentralRawStatus: r.VendorCentralRawStatus,
      vendorCentralObservedAt: r.VendorCentralObservedAt,
      vendorApplicable: r.VendorApplicable,
      gmsVerified: r.GmsVerified,
      gmsSharePct: r.GmsSharePct,
      cumulativePct: r.CumulativePct,
      resyncStatus: r.ResyncStatus || 'NONE',
      resyncJobId: r.ResyncJobId,
      resyncRequestedAt: r.ResyncRequestedAt,
      resyncObservedAt: r.ResyncObservedAt,
      resyncEligible: r.ResyncEligible,
      incidentStatus: r.IncidentStatus,
      incidentOwner: r.OwnerId,
      incidentOwnerName: r.OwnerName,
      communicationStatus: r.CommunicationStatus,
      nextAction: r.NextAction,
      etaDate: r.EtaDate,
      followUpDate: r.FollowUpDate,
    }));

    return res.json({ success: true, data: { rows, total, page: parseInt(req.query.page) || 1, pageSize: parseInt(req.query.pageSize) || 50 } });
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

exports.buildExport = async (req, res) => {
  try {
    const task = await ensureTaskAccess(req, res, req.params.id);
    if (!task) return;

    const runId = req.query.runId || req.body.runId;
    if (!runId) return res.status(400).json({ success: false, error: 'runId required' });

    const scope = req.body.scope || 'ALL_AUTHORIZED';
    const result = await exportsService.buildExport(runId, { createdBy: req.user?.Id });
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

    const reviewerId = req.body.reviewerId || req.user?.Id;
    if (reviewerId === run.CreatedBy) {
      return res.status(400).json({ success: false, error: 'Reviewer must be independent of preparer' });
    }

    const result = await submission.submitRun(runId, {
      reviewerId,
      actorId: req.user?.Id,
      sourcesValidated: req.body.sourcesValidated,
      exceptionsRecorded: req.body.exceptionsRecorded,
      blockingReasons: req.body.blockingReasons,
      note: req.body.note,
    });

    return res.json({ success: true, ...result });
  } catch (err) { return fail(res, err); }
};