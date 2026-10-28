const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { getPool, sql, generateId } = require('../../database/db');

const EXPORT_STORAGE_DIR = path.join(__dirname, '../../../private/oos_exports');

function httpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code || message;
  return err;
}

function parseJson(v) {
  if (v == null) return null;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return null; }
}

/**
 * Neutralize formula injection in CSV/XLSX strings.
 * Prefixes =, +, -, @ with a single quote to neutralize.
 */
function sanitizeCell(value) {
  if (value == null) return '';
  const str = String(value);
  if (str.startsWith('=') || str.startsWith('+') || str.startsWith('-') || str.startsWith('@')) {
    return "'" + str;
  }
  return str;
}

/**
 * Save export bytes to private storage outside web root.
 */
function saveExportBuffer(buffer, runId, version) {
  const dir = path.join(EXPORT_STORAGE_DIR, String(runId));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const fileName = `oos-export-v${version}.xlsx`;
  const filePath = path.join(dir, fileName);
  fs.writeFileSync(filePath, buffer);
  return { fileName, filePath, fileSize: buffer.length };
}

/**
 * Convert a decision row to a flat export row for the Active OOS / Discrepancies sheets.
 */
function flattenDecision(d, sourceManifest, incidentsMap, resyncMap) {
  const ev = parseJson(d.EvidenceJson);
  const incident = incidentsMap.get(d.AsinCode + '|' + d.Channel);
  const resync = resyncMap.get(d.AsinCode + '|' + d.Channel);

  return {
    SellerId: d.SellerId,
    SellerName: d.SellerName,
    Channel: d.Channel,
    AsinCode: d.AsinCode,
    Sku: d.Sku || '',
    ProductTitle: d.ProductTitle || '',
    RetailOpsState: ev?.retailOps?.state || '',
    RetailOpsQuantity: ev?.retailOps?.quantity ?? '',
    RetailOpsRawStatus: ev?.retailOps?.raw?.rawStatus || '',
    RetailOpsObservedAt: ev?.retailOps?.sourceTimestamp || '',
    RetailOpsFreshnessHours: ev?.retailOps?.freshnessHours ?? '',
    BrandCentralState: ev?.brandCentral?.state || '',
    BrandCentralQuantity: ev?.brandCentral?.quantity ?? '',
    BrandCentralRawStatus: ev?.brandCentral?.raw?.rawStatus || '',
    BrandCentralObservedAt: ev?.brandCentral?.sourceTimestamp || '',
    VendorCentralState: ev?.vendor?.applicable === false ? 'N/A' : (ev?.vendor?.state || ''),
    VendorCentralQuantity: ev?.vendor?.quantity ?? '',
    VendorCentralRawStatus: ev?.vendor?.raw?.rawStatus || '',
    VendorCentralObservedAt: ev?.vendor?.sourceTimestamp || '',
    VendorApplicable: ev?.vendor?.applicable !== false,
    Classification: d.Category,
    RuleId: d.RuleId || '',
    Confidence: d.Confidence != null ? d.Confidence : '',
    Revision: d.Revision || 1,
    ExceptionReason: d.Reason || '',
    Gms: d.Gms ?? '',
    GmsSharePct: d.GmsSharePct != null ? d.GmsSharePct : '',
    CumulativePct: d.CumulativePct != null ? d.CumulativePct : '',
    PriorityGroup: d.PriorityGroup || '',
    PriorityRule: d.PriorityRule || '',
    IsNewAsin: d.IsNewAsin ? 'Yes' : 'No',
    FirstSeenAt: d.FirstSeenAt || '',
    GmsVerified: d.GmsVerified ? 'Yes' : 'No',
    ResyncStatus: resync ? resync.Status : 'NONE',
    ResyncJobId: resync ? resync.Id : '',
    ResyncRequestedAt: resync ? resync.CreatedAt : '',
    ResyncObservedAt: resync ? resync.ObservationTime : '',
    ResyncEligible: resync ? 'Yes' : 'No',
    IncidentStatus: incident ? incident.Status : 'NONE',
    IncidentOwner: incident?.OwnerId || '',
    IncidentOwnerName: incident?.OwnerName || '',
    CommunicationStatus: incident?.CommunicationStatus || '',
    NextAction: incident?.NextAction || '',
    EtaDate: incident?.EtaDate || '',
    FollowUpDate: incident?.FollowUpDate || '',
    SourceFiles: sourceManifest.map(s => `${s.SourceType}:${s.FileName}`).join('; '),
  };
}

/**
 * Build an immutable 4-sheet export. Identical content reuses the same hash;
 * every build still records a new immutable version row.
 * Sheet names: '01 Active OOS', '02 Discrepancies', '03 Resync Resolved', '04 Summary & Sources'
 */
async function buildExport(runId, { createdBy, taskInstanceId } = {}) {
  const pool = await getPool();
  const runResult = await pool
    .request()
    .input('id', sql.VarChar, runId)
    .query('SELECT TOP 1 * FROM OosRuns WHERE Id = @id');
  const run = runResult.recordset[0];
  if (!run) throw httpError(404, 'OOS run not found', 'RUN_NOT_FOUND');

  const [decisions, imports, incidentRows, resyncRows] = await Promise.all([
    pool.request().input('runId', sql.VarChar, runId)
      .query(`SELECT v.* FROM vw_OosAffectedAsins v WHERE v.RunId = @runId ORDER BY v.AsinCode`),
    pool.request().input('runId', sql.VarChar, runId)
      .query('SELECT * FROM OosImports WHERE RunId = @runId ORDER BY CreatedAt'),
    pool.request().input('sellerId', sql.VarChar, run.SellerId).input('channel', sql.VarChar, run.Channel)
      .query('SELECT * FROM OosIncidents WHERE SellerId = @sellerId AND Channel = @channel ORDER BY OpenedAt'),
    pool.request().input('runId', sql.VarChar, runId)
      .query('SELECT * FROM OosResyncJobs WHERE RunId = @runId ORDER BY CreatedAt'),
  ]);

  const incidentsMap = new Map();
  for (const inc of incidentRows.recordset) {
    incidentsMap.set(inc.AsinCode + '|' + inc.Channel, inc);
  }

  const resyncMap = new Map();
  for (const rj of resyncRows.recordset) {
    resyncMap.set(rj.AsinCode + '|' + rj.Channel, rj);
  }

  const sourceManifest = imports.recordset.map(r => ({
    ImportId: r.Id,
    SourceType: r.SourceType,
    FileName: r.FileName,
    FileHash: r.FileHash,
    TotalRows: r.TotalRows,
    Accepted: r.AcceptedCount,
    Rejected: r.RejectedCount,
    Status: r.Status,
    Validation: parseJson(r.ValidationJson),
    CreatedAt: r.CreatedAt,
  }));

  // Split decisions by category for sheets
  const activeOos = decisions.recordset.filter(d => d.Category === 'CONFIRMED_CHANNEL_OOS');
  const discrepancies = decisions.recordset.filter(d => d.Category === 'DISCREPANCY' || d.Category === 'INSUFFICIENT_EVIDENCE');
  const resyncResolved = resyncRows.recordset.filter(r => r.Status === 'VERIFIED_RECOVERED');

  // Build rows for each sheet with sanitized values
  const sheet1Rows = activeOos.map(d => {
    const row = flattenDecision(d, sourceManifest, incidentsMap, resyncMap);
    // Sanitize all string values
    for (const k of Object.keys(row)) {
      if (typeof row[k] === 'string') row[k] = sanitizeCell(row[k]);
    }
    return row;
  });

  const sheet2Rows = discrepancies.map(d => {
    const row = flattenDecision(d, sourceManifest, incidentsMap, resyncMap);
    for (const k of Object.keys(row)) {
      if (typeof row[k] === 'string') row[k] = sanitizeCell(row[k]);
    }
    return row;
  });

  const sheet3Rows = resyncResolved.map(r => {
    const row = {
      SellerId: r.SellerId,
      Channel: r.Channel,
      AsinCode: r.AsinCode,
      DiscrepancyRevision: r.DiscrepancyRevision,
      ResyncJobId: r.Id,
      PreStatus: r.PreStatus,
      PostStatus: r.PostStatus,
      ObservationTime: r.ObservationTime,
      Result: parseJson(r.ResultJson),
      ResolvedAt: r.UpdatedAt,
    };
    for (const k of Object.keys(row)) {
      if (typeof row[k] === 'string') row[k] = sanitizeCell(row[k]);
    }
    return row;
  });

  const sheet4Rows = [
    { Metric: 'Total Decisions', Value: decisions.recordset.length },
    { Metric: 'Confirmed OOS', Value: activeOos.length },
    { Metric: 'Discrepancies', Value: discrepancies.filter(d => d.Category === 'DISCREPANCY').length },
    { Metric: 'Insufficient Evidence', Value: discrepancies.filter(d => d.Category === 'INSUFFICIENT_EVIDENCE').length },
    { Metric: 'No Signal', Value: decisions.recordset.filter(d => d.Category === 'NO_CURRENT_OOS_SIGNAL').length },
    { Metric: 'Run Date', Value: run.RunDate },
    { Metric: 'Run Status', Value: run.Status },
    { Metric: 'Policy Version', Value: run.PolicyVersion },
    { Metric: 'Channel', Value: run.Channel },
    { Metric: 'Seller', Value: run.SellerName },
    { Metric: 'Export Generated', Value: new Date().toISOString() },
    { Metric: 'Export Version', Value: '1' },
    { Metric: 'Source Files', Value: sourceManifest.length },
    { Metric: 'Total Source Rows', Value: sourceManifest.reduce((s, i) => s + (i.TotalRows || 0), 0) },
    { Metric: 'Total Accepted Rows', Value: sourceManifest.reduce((s, i) => s + (i.AcceptedCount || 0), 0) },
    { Metric: 'Total Rejected Rows', Value: sourceManifest.reduce((s, i) => s + (i.RejectedCount || 0), 0) },
    { Metric: 'Open Incidents', Value: imports.recordset.length > 0 ? 'See Incidents Tab' : 'None' },
  ];

  const sheets = [
    { name: '01 Active OOS', data: sheet1Rows },
    { name: '02 Discrepancies', data: sheet2Rows },
    { name: '03 Resync Resolved', data: sheet3Rows },
    { name: '04 Summary & Sources', data: sheet4Rows },
  ];

  // Build workbook
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.json_to_sheet(sheet.data || [{ info: 'No data' }]);
    // Set column widths
    const cols = [];
    if (sheet.data && sheet.data.length > 0) {
      for (const key of Object.keys(sheet.data[0])) {
        cols.push({ wch: Math.min(Math.max(key.length + 2, 12), 40) });
      }
      ws['!cols'] = cols;
    }
    XLSX.utils.book_append_sheet(workbook, ws, sheet.name);
  }

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

  const versionResult = await getPool()
    .request()
    .input('runId', sql.VarChar, runId)
    .query('SELECT ISNULL(MAX(Version), 0) AS MaxVersion FROM OosExports WHERE RunId = @runId');
  const version = Number(versionResult.recordset[0].MaxVersion) + 1;

  const manifest = {
    runId: run.Id,
    runDate: run.RunDate,
    sellerId: run.SellerId,
    sellerName: run.SellerName,
    channel: run.Channel,
    policyVersion: run.PolicyVersion,
    generatedAt: new Date().toISOString(),
    generatedBy: createdBy,
    sourceManifest,
    scope: 'ALL_AUTHORIZED',
    sheetNames: sheets.map(s => s.name),
    rowCounts: sheets.map(s => (s.data || []).length),
  };

  // Store export bytes to private storage outside web root
  const storage = saveExportBuffer(buffer, runId, version);

  const exportAuditJson = JSON.stringify({
    generatedBy: createdBy || null,
    generatedAt: new Date().toISOString(),
    taskInstanceId: taskInstanceId || null,
    rowCounts: sheets.map(s => (s.data || []).length),
    totalRows: decisions.recordset.length,
    fileHash,
  });

  const inserted = await getPool()
    .request()
    .input('id', sql.VarChar, generateId())
    .input('runId', sql.VarChar, runId)
    .input('sellerId', sql.VarChar, run.SellerId)
    .input('taskInstanceId', sql.VarChar, taskInstanceId || null)
    .input('version', sql.Int, version)
    .input('sheetCount', sql.Int, sheets.length)
    .input('fileName', sql.NVarChar(260, storage.fileName))
    .input('fileSize', sql.BigInt, storage.fileSize)
    .input('storagePath', sql.NVarChar(500, storage.filePath))
    .input('fileHash', sql.VarChar(128), fileHash)
    .input('contentJson', sql.NVarChar(sql.MAX), JSON.stringify({ manifest, sheets: sheets.map(s => ({ name: s.name, rowCount: (s.data || []).length })) }))
    .input('exportManifestJson', sql.NVarChar(sql.MAX), JSON.stringify(manifest))
    .input('exportAuditJson', sql.NVarChar(sql.MAX), exportAuditJson)
    .input('createdBy', sql.VarChar, createdBy || null)
    .query(`
      INSERT INTO OosExports (Id, RunId, SellerId, TaskInstanceId, Version, SheetCount, FileName, FileSize, StoragePath, FileHash, ContentJson, ExportManifestJson, ExportAuditJson, CreatedBy, CreatedAt)
      OUTPUT INSERTED.*
      VALUES (@id, @runId, @sellerId, @taskInstanceId, @version, @sheetCount, @fileName, @fileSize, @storagePath, @fileHash, @contentJson, @exportManifestJson, @exportAuditJson, @createdBy, GETUTCDATE())
    `);

  return { export: inserted.recordset[0], sheets, fileHash, version, buffer };
}

async function getLatestExport(runId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('runId', sql.VarChar, runId)
    .query('SELECT TOP 1 * FROM OosExports WHERE RunId = @runId ORDER BY Version DESC');
  return result.recordset[0] || null;
}

async function getExportById(exportId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.VarChar, exportId)
    .query('SELECT TOP 1 * FROM OosExports WHERE Id = @id');
  return result.recordset[0] || null;
}

/** Render an immutable export by exportId to a real four-tab XLSX download. */
async function buildWorkbook(exportId) {
  const record = await getExportById(exportId);
  if (!record) throw httpError(404, 'Export not found', 'EXPORT_NOT_FOUND');

  // Verify stored file exists on disk
  const fs = require('fs');
  if (!record.StoragePath || !fs.existsSync(record.StoragePath)) {
    throw httpError(404, 'Export file not found on disk', 'EXPORT_FILE_NOT_FOUND');
  }

  const fileBuffer = fs.readFileSync(record.StoragePath);

  // Verify stored hash matches file contents
  const actualHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  if (actualHash !== record.FileHash) {
    throw httpError(500, 'Export hash mismatch - file may have been tampered with', 'EXPORT_HASH_MISMATCH');
  }

  return {
    record,
    buffer: fileBuffer,
    fileName: record.FileName || `oos-export-${exportId}.xlsx`,
    verifiedHash: actualHash,
  };
}

function buildWorkbookBuffer(contentJson) {
  const content = typeof contentJson === 'string' ? JSON.parse(contentJson) : contentJson;
  const workbook = XLSX.utils.book_new();
  const sheets = content.sheets || [];
  if (sheets.length === 0) {
    const worksheet = XLSX.utils.json_to_sheet([{ info: 'No data' }]);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'No Data');
  } else {
    for (const sheet of sheets) {
      const rows = Array.isArray(sheet.data) && sheet.data.length ? sheet.data : [{ info: 'No rows' }];
      const worksheet = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(workbook, worksheet, String(sheet.name).slice(0, 31));
    }
  }
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = { buildExport, getLatestExport, getExportById, buildWorkbook, buildWorkbookBuffer, sanitizeCell };