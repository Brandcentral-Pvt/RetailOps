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
      taskInstanceId: req.body?.taskInstanceId || req.body?.taskId,
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
    const run = req.oosRun || await runScoped(req, res, req.params.id);
    if (!run) return undefined;
    let rows = req.body?.rows;
    // If file uploaded via multer, parse it
    if (req.file && req.file.buffer) {
      try {
        const XLSX = require('xlsx');
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });
      } catch (e) {
        return res.status(400).json({ success: false, code: 'PARSE_ERROR', error: 'Failed to parse uploaded file' });
      }
    }
    const result = await uploads.ingestUpload({
      runId: run.Id,
      sellerId: run.SellerId,
      channel: req.body?.channel || run.Channel,
      sourceType: req.body?.sourceType || req.body?.type,
      fileName: req.file?.originalname || req.body?.fileName,
      fileBuffer: req.file?.buffer,
      fileHash: req.body?.fileHash,
      rows: rows,
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
    const incident = req.oosIncident || await incidents.getIncident(req.params.id);
    if (!incident) return res.status(404).json({ success: false, code: 'INCIDENT_NOT_FOUND', error: 'Incident not found' });
    if (!req.oosBinding && !req.oosTask) {
      const scope = sellerScopeOr403(req, res, incident.SellerId);
      if (!scope) return undefined;
    }
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
    const incident = req.oosIncident || await incidents.getIncident(req.params.id);
    if (!incident) return res.status(404).json({ success: false, code: 'INCIDENT_NOT_FOUND', error: 'Incident not found' });
    if (!req.oosBinding && !req.oosTask) {
      const scope = sellerScopeOr403(req, res, incident.SellerId);
      if (!scope) return undefined;
    }
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

/**
 * Ingest dual inventory upload (Vendor Central + BrandCentral) for a run.
 * Accepts multipart/form-data with two files:
 *   - vendorCentralFile: CSV/Excel with ASIN, Available units, Status, Warehouse
 *   - brandCentralFile: CSV/Excel with SKU/Model No, old_quantity, new_quantity, mrp
 * Stores each as separate import with sourceType VENDOR_CENTRAL / BRAND_CENTRAL.
 */
exports.ingestInventoryUpload = async (req, res) => {
  try {
    const run = req.oosRun || await runScoped(req, res, req.params.id);
    if (!run) return undefined;

    const files = req.files || {};
    const vendorFile = files.vendorCentralFile?.[0];
    const brandFile = files.brandCentralFile?.[0];

    if (!vendorFile && !brandFile) {
      return res.status(400).json({ success: false, code: 'NO_FILES', error: 'At least one file (vendorCentralFile or brandCentralFile) is required' });
    }

    // Custom column mappings for each source type
    const vendorMapping = {
      asin: 'ASIN',
      sku: 'SKU',
      quantity: 'Available units',
      availability: 'Status',
      status: 'Status',
      timestamp: null, // Not in Vendor Central file
    };

    const brandMapping = {
      asin: null, // BrandCentral doesn't have ASIN directly, uses Model No column
      sku: 'Model No', // or 'sku' column
      quantity: 'old_quantity', // Store ONLY old_quantity from BrandCentral
      availability: null,
      status: null,
      timestamp: null,
    };

    const results = {};

    if (vendorFile) {
      const vendorResult = await uploads.ingestUpload({
        runId: run.Id,
        sellerId: run.SellerId,
        channel: run.Channel,
        sourceType: 'VENDOR_CENTRAL',
        fileName: vendorFile.originalname,
        fileBuffer: vendorFile.buffer,
        mapping: vendorMapping,
        createdBy: req.user?.Id,
      });
      results.vendorCentral = vendorResult;
    }

    if (brandFile) {
      const brandResult = await uploads.ingestBrandCentralUpload({
        runId: run.Id,
        sellerId: run.SellerId,
        channel: run.Channel,
        fileName: brandFile.originalname,
        fileBuffer: brandFile.buffer,
        mapping: brandMapping,
        createdBy: req.user?.Id,
      });
      results.brandCentral = brandResult;
    }

    // Auto-trigger reconciliation so the grid updates immediately
    let reconcileResult = null;
    if (vendorFile || brandFile) {
      try {
        reconcileResult = await reconciliation.reconcileRun(run.Id, { actorId: req.user?.Id });
      } catch (reconcileErr) {
        // Don't fail the upload if reconciliation fails - log and continue
        console.warn('[OOS] Reconciliation after inventory upload failed:', reconcileErr.message);
      }
    }

    return res.json({
      success: true,
      uploads: results,
      reconciliation: reconcileResult,
    });
  } catch (err) { return fail(res, err); }
};

/**
 * Trigger RetailOps availability sync for all ASINs in a run.
 * This queues scrape jobs for each ASIN to refresh availability status.
 */
exports.syncRetailOpsAvailability = async (req, res) => {
  try {
    const run = req.oosRun || await runScoped(req, res, req.params.id);
    if (!run) return undefined;

    const pool = await getPool();

    // Get all unique ASINs from this run (from observations + decisions)
    const asinResult = await pool.request()
      .input('runId', sql.VarChar, run.Id)
      .query(`
        SELECT DISTINCT AsinCode FROM OosObservations WHERE RunId = @runId AND IsValid = 1
        UNION
        SELECT DISTINCT AsinCode FROM OosDecisions WHERE RunId = @runId
      `);

    const asins = asinResult.recordset.map((r) => r.AsinCode);
    if (!asins.length) {
      return res.json({ success: true, message: 'No ASINs to sync', synced: 0 });
    }

    // Get seller info for marketplace
    const sellerResult = await pool.request()
      .input('sellerId', sql.VarChar, run.SellerId)
      .query('SELECT Id, Name, Marketplace, OctoparseId FROM Sellers WHERE Id = @sellerId');
    const seller = sellerResult.recordset[0];
    if (!seller) {
      throw httpError(404, 'Seller not found', 'SELLER_NOT_FOUND');
    }

    // Trigger scrape for each ASIN via market-sync service
    const marketSyncService = require('../services/marketDataSyncService');
    let synced = 0;
    let failed = 0;

    for (const asinCode of asins) {
      try {
        // Check if ASIN exists in Asins table
        const asinCheck = await pool.request()
          .input('asinCode', sql.VarChar, asinCode)
          .input('sellerId', sql.VarChar, run.SellerId)
          .input('channel', sql.VarChar, run.Channel)
          .query('SELECT TOP 1 Id FROM Asins WHERE AsinCode = @asinCode AND SellerId = @sellerId AND Marketplace = @channel');

        if (!asinCheck.recordset[0]) {
          // ASIN not tracked yet, skip
          continue;
        }

        // Trigger sync via market-sync service (similar to syncAsin endpoint)
        const syncStarted = await marketSyncService.syncSellerAsinsToOctoparse(run.SellerId, { 
          triggerScrape: true,
          asinFilter: [asinCode]
        });

        if (syncStarted) synced++;
        else failed++;
      } catch (err) {
        console.error(`[OOS] Sync failed for ASIN ${asinCode}:`, err.message);
        failed++;
      }
    }

    return res.json({
      success: true,
      message: `RetailOps sync initiated for ${synced} ASIN${synced !== 1 ? 's' : ''}`,
      synced,
      failed,
      total: asins.length,
    });
  } catch (err) { return fail(res, err); }
};

/**
 * Get dynamic column configuration for the Affected ASINs grid.
 * Returns which columns are enabled, their order, widths, and visibility.
 */
exports.getColumnConfig = async (req, res) => {
  try {
    const run = await runScoped(req, res, req.params.id);
    if (!run) return undefined;

    // Default column configuration
    const defaultColumns = [
      { key: 'seller', title: 'Seller', enabled: true, width: 150, fixed: 'left', order: 1 },
      { key: 'channel', title: 'Channel', enabled: true, width: 110, fixed: 'left', order: 2 },
      { key: 'asin', title: 'ASIN', enabled: true, width: 140, fixed: 'left', order: 3 },
      { key: 'title', title: 'Title', enabled: true, width: 200, order: 4 },
      { key: 'retailOps', title: 'RetailOps', enabled: true, width: 180, order: 5 },
      { key: 'brandCentral', title: 'BrandCentral', enabled: true, width: 150, order: 6 },
      { key: 'vendorCentral', title: 'Vendor Central', enabled: true, width: 150, order: 7 },
      { key: 'gms', title: 'GMS / Pareto', enabled: true, width: 200, order: 8 },
      { key: 'classification', title: 'Classification', enabled: true, width: 180, order: 9 },
      { key: 'resync', title: 'Resync', enabled: true, width: 180, order: 10 },
      { key: 'incident', title: 'Incident', enabled: true, width: 200, order: 11 },
    ];

    // Check if vendor is applicable for this channel
    const policy = await getActivePolicy();
    const vendorApplicable = require('../services/oos/oosPolicy').isVendorApplicable(run.Channel, policy);

    // Disable vendor central column if not applicable
    const columns = defaultColumns.map((c) => {
      if (c.key === 'vendorCentral' && !vendorApplicable) {
        return { ...c, enabled: false };
      }
      return c;
    });

    return res.json({ success: true, columns });
  } catch (err) { return fail(res, err); }
};
