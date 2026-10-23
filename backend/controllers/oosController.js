const { resolveSellerScope } = require('../utils/sellerScope');
const { getActivePolicy } = require('../services/oos/oosPolicyService');
const monitoring = require('../services/oos/oosMonitoringService');
const uploads = require('../services/oos/oosUploadService');
const reconciliation = require('../services/oos/oosReconciliationService');
const incidents = require('../services/oos/oosIncidentService');
const pareto = require('../services/oos/oosParetoService');
const sync = require('../services/oos/oosSyncService');
const exportsService = require('../services/oos/oosExportService');
const submission = require('../services/oos/oosSubmissionService');

function fail(res, err) {
  const status = err.status || 500;
  return res.status(status).json({ success: false, code: err.code || 'OOS_ERROR', error: err.message });
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

async function loadRunOr404(runId) {
  const run = await monitoring.getRun(runId);
  if (!run) {
    const err = new Error('OOS run not found');
    err.status = 404;
    err.code = 'RUN_NOT_FOUND';
    throw err;
  }
  return run;
}

async function runScoped(req, res, runId) {
  const run = await loadRunOr404(runId);
  const scope = sellerScopeOr403(req, res, run.SellerId);
  if (!scope) return null;
  return run;
}

exports.getPolicy = async (req, res) => {
  try {
    const policy = await getActivePolicy();
    return res.json({ success: true, policy });
  } catch (err) { return fail(res, err); }
};

exports.createRun = async (req, res) => {
  try {
    const sellerId = req.body?.sellerId;
    const scope = sellerScopeOr403(req, res, sellerId);
    if (!scope) return undefined;
    const result = await monitoring.createOrGetRun({
      sellerId,
      channel: req.body?.channel,
      runDate: req.body?.runDate,
      monitoredDate: req.body?.monitoredDate,
      createdBy: req.user?.Id,
    });
    return res.status(result.created ? 201 : 200).json({ success: true, ...result });
  } catch (err) { return fail(res, err); }
};

exports.listRuns = async (req, res) => {
  try {
    const scope = sellerScopeOr403(req, res, req.query.sellerId);
    if (!scope) return undefined;
    let sellerId = req.query.sellerId;
    if (!sellerId && !scope.isGlobal) {
      if (scope.empty) return res.json({ success: true, runs: [] });
      sellerId = scope.sellerIds.length === 1 ? scope.sellerIds[0] : undefined;
      if (scope.sellerIds.length > 1) {
        // Filter in memory to the allowed set rather than widening.
        const all = await monitoring.listRuns({ from: req.query.from, to: req.query.to, status: req.query.status });
        const allowed = new Set(scope.sellerIds);
        return res.json({ success: true, runs: all.filter((r) => allowed.has(r.SellerId)) });
      }
    }
    const runs = await monitoring.listRuns({
      sellerId,
      from: req.query.from,
      to: req.query.to,
      status: req.query.status,
    });
    return res.json({ success: true, runs });
  } catch (err) { return fail(res, err); }
};

exports.getRun = async (req, res) => {
  try {
    const run = await runScoped(req, res, req.params.id);
    if (!run) return undefined;
    return res.json({ success: true, run });
  } catch (err) { return fail(res, err); }
};

exports.ingestUpload = async (req, res) => {
  try {
    const run = await runScoped(req, res, req.params.id);
    if (!run) return undefined;
    const result = await uploads.ingestUpload({
      runId: run.Id,
      sellerId: run.SellerId,
      channel: req.body?.channel || run.Channel,
      sourceType: req.body?.sourceType,
      fileName: req.body?.fileName,
      fileHash: req.body?.fileHash,
      rows: req.body?.rows,
      mapping: req.body?.mapping,
      createdBy: req.user?.Id,
    });
    return res.status(result.idempotent ? 200 : 201).json({ success: true, ...result });
  } catch (err) { return fail(res, err); }
};

exports.listImports = async (req, res) => {
  try {
    const run = await runScoped(req, res, req.params.id);
    if (!run) return undefined;
    const imports = await uploads.listImports(run.Id);
    return res.json({ success: true, imports });
  } catch (err) { return fail(res, err); }
};

exports.reconcile = async (req, res) => {
  try {
    const run = await runScoped(req, res, req.params.id);
    if (!run) return undefined;
    const result = await reconciliation.reconcileRun(run.Id, { actorId: req.user?.Id });
    return res.json({ success: true, ...result });
  } catch (err) { return fail(res, err); }
};

exports.listDecisions = async (req, res) => {
  try {
    const run = await runScoped(req, res, req.params.id);
    if (!run) return undefined;
    const decisions = await reconciliation.listDecisions(run.Id, { category: req.query.category });
    return res.json({ success: true, decisions });
  } catch (err) { return fail(res, err); }
};

exports.listRunIncidents = async (req, res) => {
  try {
    const run = await runScoped(req, res, req.params.id);
    if (!run) return undefined;
    const open = await incidents.listOpenIncidents({ sellerId: run.SellerId });
    return res.json({ success: true, incidents: open.filter((i) => i.Channel === run.Channel) });
  } catch (err) { return fail(res, err); }
};

exports.updateIncident = async (req, res) => {
  try {
    const incident = await incidents.getIncident(req.params.id);
    if (!incident) return res.status(404).json({ success: false, code: 'INCIDENT_NOT_FOUND', error: 'Incident not found' });
    const scope = sellerScopeOr403(req, res, incident.SellerId);
    if (!scope) return undefined;
    const updated = await incidents.updateIncident(incident.Id, {
      ownerId: req.body?.ownerId,
      ownerName: req.body?.ownerName,
      communicationStatus: req.body?.communicationStatus,
      nextAction: req.body?.nextAction,
      etaDate: req.body?.etaDate,
      followUpDate: req.body?.followUpDate,
    }, req.user?.Id);
    return res.json({ success: true, incident: updated });
  } catch (err) { return fail(res, err); }
};

exports.resolveIncident = async (req, res) => {
  try {
    const incident = await incidents.getIncident(req.params.id);
    if (!incident) return res.status(404).json({ success: false, code: 'INCIDENT_NOT_FOUND', error: 'Incident not found' });
    const scope = sellerScopeOr403(req, res, incident.SellerId);
    if (!scope) return undefined;
    const result = await incidents.resolveIncident(incident.Id, {
      actorId: req.user?.Id,
      detail: { note: req.body?.note || null, manual: true },
      status: req.body?.status === 'WAIVED' ? 'WAIVED' : 'RESOLVED',
    });
    return res.json({ success: true, ...result });
  } catch (err) { return fail(res, err); }
};

exports.getPareto = async (req, res) => {
  try {
    const sellerId = req.params.sellerId;
    const scope = sellerScopeOr403(req, res, sellerId);
    if (!scope) return undefined;
    const result = await pareto.getSellerPareto({
      sellerId,
      channel: req.query.channel,
      pct: req.query.pct,
    });
    return res.json({ success: true, pareto: result });
  } catch (err) { return fail(res, err); }
};

exports.requestResync = async (req, res) => {
  try {
    const run = await runScoped(req, res, req.params.id);
    if (!run) return undefined;
    const result = await sync.requestResync({
      runId: run.Id,
      asin: req.body?.asin,
      revision: req.body?.revision,
      requestedBy: req.user?.Id,
      preStatus: req.body?.preStatus,
    });
    return res.status(result.created ? 201 : 200).json({ success: true, ...result });
  } catch (err) { return fail(res, err); }
};

exports.verifyResync = async (req, res) => {
  try {
    const job = await sync.getResyncJob(req.params.id);
    if (!job) return res.status(404).json({ success: false, code: 'RESYNC_NOT_FOUND', error: 'Resync job not found' });
    const scope = sellerScopeOr403(req, res, job.SellerId);
    if (!scope) return undefined;
    const result = await sync.verifyResync(job.Id, {
      sellerId: job.SellerId,
      channel: job.Channel,
      asin: job.AsinCode,
      state: req.body?.state,
      observationTime: req.body?.observationTime,
    }, req.user?.Id);
    return res.json({ success: true, ...result });
  } catch (err) { return fail(res, err); }
};

exports.listResync = async (req, res) => {
  try {
    const run = await runScoped(req, res, req.params.id);
    if (!run) return undefined;
    const jobs = await sync.listResyncJobs(run.Id);
    return res.json({ success: true, jobs });
  } catch (err) { return fail(res, err); }
};

exports.buildExport = async (req, res) => {
  try {
    const run = await runScoped(req, res, req.params.id);
    if (!run) return undefined;
    const result = await exportsService.buildExport(run.Id, { createdBy: req.user?.Id });
    return res.status(201).json({ success: true, ...result });
  } catch (err) { return fail(res, err); }
};

exports.downloadExport = async (req, res) => {
  try {
    const run = await runScoped(req, res, req.params.id);
    if (!run) return undefined;
    const { buffer, fileName, record } = await exportsService.buildWorkbook(run.Id);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('X-Export-Hash', record.FileHash);
    return res.send(buffer);
  } catch (err) { return fail(res, err); }
};

exports.getLatestExport = async (req, res) => {
  try {
    const run = await runScoped(req, res, req.params.id);
    if (!run) return undefined;
    const record = await exportsService.getLatestExport(run.Id);
    if (!record) return res.status(404).json({ success: false, code: 'EXPORT_NOT_FOUND', error: 'No export exists for this run' });
    return res.json({ success: true, export: record });
  } catch (err) { return fail(res, err); }
};

exports.submit = async (req, res) => {
  try {
    const run = await runScoped(req, res, req.params.id);
    if (!run) return undefined;
    const result = await submission.submitRun(run.Id, {
      reviewerId: req.body?.reviewerId,
      actorId: req.user?.Id,
      sourcesValidated: req.body?.sourcesValidated,
      exceptionsRecorded: req.body?.exceptionsRecorded,
      blockingReasons: req.body?.blockingReasons,
      note: req.body?.note,
    });
    return res.status(result.ok ? 200 : 422).json({ success: result.ok, ...result });
  } catch (err) { return fail(res, err); }
};
