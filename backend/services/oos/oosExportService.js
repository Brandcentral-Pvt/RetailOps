const crypto = require('crypto');
const XLSX = require('xlsx');
const { getPool, sql, generateId } = require('../../database/db');

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

function summarizeDecisions(decisions) {
  const byCategory = {};
  for (const d of decisions) byCategory[d.Category] = (byCategory[d.Category] || 0) + 1;
  return {
    total: decisions.length,
    byCategory,
    cases: decisions.map((d) => ({
      asin: d.AsinCode,
      category: d.Category,
      ruleId: d.RuleId,
      confidence: d.Confidence == null ? null : Number(d.Confidence),
      revision: d.Revision,
      reason: d.Reason,
      evidence: parseJson(d.EvidenceJson),
    })),
  };
}

/**
 * Build an immutable 4-sheet export. Identical content reuses the same hash;
 * every build still records a new immutable version row.
 */
async function buildExport(runId, { createdBy } = {}) {
  const pool = await getPool();
  const runResult = await pool
    .request()
    .input('id', sql.VarChar, runId)
    .query('SELECT TOP 1 * FROM OosRuns WHERE Id = @id');
  const run = runResult.recordset[0];
  if (!run) throw httpError(404, 'OOS run not found', 'RUN_NOT_FOUND');

  const [decisions, imports, incidentRows, resyncRows] = await Promise.all([
    pool.request().input('runId', sql.VarChar, runId)
      .query('SELECT * FROM OosDecisions WHERE RunId = @runId ORDER BY Category, AsinCode'),
    pool.request().input('runId', sql.VarChar, runId)
      .query('SELECT * FROM OosImports WHERE RunId = @runId ORDER BY CreatedAt'),
    pool.request().input('sellerId', sql.VarChar, run.SellerId).input('channel', sql.VarChar, run.Channel)
      .query('SELECT * FROM OosIncidents WHERE SellerId = @sellerId AND Channel = @channel ORDER BY OpenedAt'),
    pool.request().input('runId', sql.VarChar, runId)
      .query('SELECT * FROM OosResyncJobs WHERE RunId = @runId ORDER BY CreatedAt'),
  ]);

  const sheets = [
    {
      name: 'Seller Summary',
      rows: [{
        runId: run.Id,
        runDate: run.RunDate,
        sellerId: run.SellerId,
        sellerName: run.SellerName,
        channel: run.Channel,
        status: run.Status,
        policyVersion: run.PolicyVersion,
        manifest: parseJson(run.ManifestJson),
        decisions: summarizeDecisions(decisions.recordset),
      }],
    },
    {
      name: 'Source Manifest',
      rows: imports.recordset.map((r) => ({
        importId: r.Id,
        sourceType: r.SourceType,
        fileName: r.FileName,
        fileHash: r.FileHash,
        totalRows: r.TotalRows,
        accepted: r.AcceptedCount,
        rejected: r.RejectedCount,
        status: r.Status,
        validation: parseJson(r.ValidationJson),
        createdAt: r.CreatedAt,
      })),
    },
    {
      name: 'Incidents & Follow-ups',
      rows: incidentRows.recordset.map((r) => ({
        incidentId: r.Id,
        asin: r.AsinCode,
        status: r.Status,
        ownerId: r.OwnerId,
        ownerName: r.OwnerName,
        communicationStatus: r.CommunicationStatus,
        nextAction: r.NextAction,
        etaDate: r.EtaDate,
        followUpDate: r.FollowUpDate,
        openedAt: r.OpenedAt,
      })),
    },
    {
      name: 'Resolved Audit',
      rows: [
        ...incidentRows.recordset.filter((r) => r.Status !== 'OPEN').map((r) => ({
          kind: 'INCIDENT', asin: r.AsinCode, status: r.Status,
          resolvedAt: r.ResolvedAt, resolvedBy: r.ResolvedBy,
        })),
        ...resyncRows.recordset.map((r) => ({
          kind: 'RESYNC', asin: r.AsinCode, status: r.Status,
          revision: r.DiscrepancyRevision, observationTime: r.ObservationTime,
          result: parseJson(r.ResultJson),
        })),
      ],
    },
  ];

  const contentJson = JSON.stringify({ runId, sheets });
  const fileHash = crypto.createHash('sha256').update(contentJson).digest('hex');

  const versionResult = await pool
    .request()
    .input('runId', sql.VarChar, runId)
    .query('SELECT ISNULL(MAX(Version), 0) AS MaxVersion FROM OosExports WHERE RunId = @runId');
  const version = Number(versionResult.recordset[0].MaxVersion) + 1;

  const inserted = await pool
    .request()
    .input('id', sql.VarChar, generateId())
    .input('runId', sql.VarChar, runId)
    .input('sellerId', sql.VarChar, run.SellerId)
    .input('version', sql.Int, version)
    .input('sheetCount', sql.Int, sheets.length)
    .input('fileHash', sql.VarChar(128), fileHash)
    .input('contentJson', sql.NVarChar(sql.MAX), contentJson)
    .input('createdBy', sql.VarChar, createdBy || null)
    .query(`
      INSERT INTO OosExports (Id, RunId, SellerId, Version, SheetCount, FileHash, ContentJson, CreatedBy, CreatedAt)
      OUTPUT INSERTED.*
      VALUES (@id, @runId, @sellerId, @version, @sheetCount, @fileHash, @contentJson, @createdBy, GETUTCDATE())
    `);

  return { export: inserted.recordset[0], sheets, fileHash, version };
}

async function getLatestExport(runId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('runId', sql.VarChar, runId)
    .query('SELECT TOP 1 * FROM OosExports WHERE RunId = @runId ORDER BY Version DESC');
  return result.recordset[0] || null;
}

function buildWorkbookBuffer(contentJson) {
  const content = typeof contentJson === 'string' ? JSON.parse(contentJson) : contentJson;
  const workbook = XLSX.utils.book_new();
  for (const sheet of content.sheets || []) {
    const rows = Array.isArray(sheet.rows) && sheet.rows.length ? sheet.rows : [{ info: 'No rows' }];
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, String(sheet.name).slice(0, 31));
  }
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

/** Render the latest immutable export to a real four-tab XLSX download. */
async function buildWorkbook(runId) {
  const record = await getLatestExport(runId);
  if (!record) throw httpError(404, 'No export exists for this run', 'EXPORT_NOT_FOUND');
  const buffer = buildWorkbookBuffer(record.ContentJson);
  return {
    record,
    buffer,
    fileName: `oos-${runId}-v${record.Version}.xlsx`,
  };
}

module.exports = { buildExport, getLatestExport, buildWorkbook, buildWorkbookBuffer, summarizeDecisions };
