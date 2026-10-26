const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { getPool, sql, generateId, withTransaction } = require('../../database/db');
const { isUsableAsinCode, normalizeAsin } = require('../../utils/asinUtils');
const { toQuantity } = require('./oosPolicy');
const XLSX = require('xlsx');

const SOURCES = new Set(['BRAND_CENTRAL', 'VENDOR_CENTRAL', 'RETAILOPS']);

const DEFAULT_MAPPING = {
  asin: 'asin',
  sku: 'sku',
  quantity: 'quantity',
  availability: 'availability',
  status: 'status',
  timestamp: 'timestamp',
};

const UPLOAD_DIR = path.join(__dirname, '../../../uploads/oos');
const PARSER_VERSION = '1.0.0';

function httpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code || message;
  return err;
}

function normalizeKey(key) {
  return String(key).replace(/[\s_-]/g, '').toLowerCase();
}

function pick(row, candidates) {
  if (!row) return undefined;
  const lookup = {};
  for (const k of Object.keys(row)) lookup[normalizeKey(k)] = row[k];
  for (const c of candidates) {
    const key = normalizeKey(c);
    if (lookup[key] !== undefined) return lookup[key];
  }
  return undefined;
}

function readField(row, mapping, field, fallbacks) {
  const mapped = mapping && mapping[field];
  if (mapped && row[mapped] !== undefined) return row[mapped];
  return pick(row, fallbacks);
}

function hashBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Parse uploaded workbook into rows, preserving all columns.
 * Invalid ASINs are recorded (not silently dropped) and never coerced.
 */
function parseWorkbook(buffer, mappingOverride) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });
  return normalizeRows(rawRows, mappingOverride);
}

/**
 * Normalise parsed rows into validated observation rows.
 * Invalid ASINs are recorded (not silently dropped) and never coerced.
 * Duplicate ASINs in one file: prefer the row that carries a real quantity.
 */
function normalizeRows(rows, mappingOverride) {
  const mapping = { ...DEFAULT_MAPPING, ...(mappingOverride || {}) };
  const out = [];
  const invalid = [];
  const seen = new Map();

  (rows || []).forEach((raw, index) => {
    const rawAsin = readField(raw, mapping, 'asin', ['asin', 'asincode', 'asin_code', 'childasin']);
    const sku = readField(raw, mapping, 'sku', ['sku', 'sellerSku', 'msku']);
    const quantityRaw = readField(raw, mapping, 'quantity', ['quantity', 'qty', 'stock', 'stocklevel', 'availablequantity', 'available']);
    const availabilityRaw = readField(raw, mapping, 'availability', ['availability', 'availabilitystatus', 'status', 'stockstatus']);
    const statusRaw = readField(raw, mapping, 'status', ['scrapestatus', 'listingstatus']);
    const timestampRaw = readField(raw, mapping, 'timestamp', ['timestamp', 'date', 'scrapedat', 'lastscrapedat', 'updatedat']);

    const asin = normalizeAsin(rawAsin);
    const quantity = toQuantity(quantityRaw);
    const timestamp = timestampRaw ? new Date(timestampRaw) : null;
    const invalidReason = isUsableAsinCode(asin) ? null : (rawAsin ? 'INVALID_ASIN' : 'MISSING_ASIN');

    const record = {
      index,
      asin,
      sku: sku == null ? null : String(sku),
      quantity,
      availability: availabilityRaw == null ? null : String(availabilityRaw),
      status: statusRaw == null ? null : String(statusRaw),
      sourceTimestamp: timestamp && !Number.isNaN(timestamp.getTime()) ? timestamp : null,
      invalidReason,
      raw,
    };

    if (invalidReason) {
      invalid.push(record);
      return;
    }

    const existing = seen.get(asin);
    if (!existing) {
      seen.set(asin, record);
      return;
    }
    // Duplicate ASIN in one file: prefer the row that carries a real quantity.
    if (existing.quantity === null && record.quantity !== null) seen.set(asin, record);
  });

  out.push(...seen.values());
  return { rows: out, invalid };
}

/**
 * Save uploaded file to disk and return storage path.
 */
function saveOriginalFile(buffer, originalFileName, runId, sourceType) {
  const dir = path.join(UPLOAD_DIR, path.dirname(path.join(runId)));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const ext = path.extname(originalFileName);
  const base = path.basename(originalFileName, ext);
  const fileName = `${base}_${Date.now()}${ext}`;
  const filePath = path.join(dir, fileName);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

/**
 * Ingest an uploaded file (buffer) for a run.
 * Stores original file bytes, computes server-side SHA-256, parses and validates rows.
 * Supports revisioning: re-upload creates new version, never overwrites original.
 */
async function ingestUpload({
  runId,
  sellerId,
  channel,
  sourceType,
  fileName,
  fileBuffer,
  mapping,
  createdBy,
} = {}) {
  if (!runId) throw httpError(400, 'runId is required', 'RUN_REQUIRED');
  if (!sourceType || !SOURCES.has(sourceType)) {
    throw httpError(400, `sourceType must be one of ${[...SOURCES].join(', ')}`, 'INVALID_SOURCE');
  }
  if (!fileBuffer || fileBuffer.length === 0) {
    throw httpError(400, 'Empty file', 'EMPTY_FILE');
  }
  if (fileBuffer.length > 50 * 1024 * 1024) {
    throw httpError(400, 'File size exceeds 50MB limit', 'FILE_TOO_LARGE');
  }

  const pool = await getPool();
  const runResult = await pool
    .request()
    .input('id', sql.VarChar, runId)
    .query('SELECT TOP 1 * FROM OosRuns WHERE Id = @id');
  const run = runResult.recordset[0];
  if (!run) throw httpError(404, 'OOS run not found', 'RUN_NOT_FOUND');

  const effectiveSeller = sellerId || run.SellerId;
  const effectiveChannel = channel || run.Channel;
  const fileHash = hashBuffer(fileBuffer);

  // Save original file to disk
  const storagePath = saveOriginalFile(fileBuffer, fileName, runId, sourceType);

  // Check for existing import (same run/channel/source)
  const existing = await pool
    .request()
    .input('runId', sql.VarChar, runId)
    .input('channel', sql.NVarChar, effectiveChannel)
    .input('sourceType', sql.VarChar, sourceType)
    .query('SELECT TOP 1 * FROM OosImports WHERE RunId = @runId AND Channel = @channel AND SourceType = @sourceType ORDER BY UploadRevision DESC');

  let uploadRevision = 1;
  let parentImportId = null;
  if (existing.recordset[0]) {
    const prior = existing.recordset[0];
    if (prior.FileHash === fileHash) {
      return { import: prior, idempotent: true, accepted: 0, rejected: 0, invalid: [] };
    }
    // New revision
    uploadRevision = prior.UploadRevision + 1;
    parentImportId = prior.Id;
  }

  // Parse and validate
  const normalized = parseWorkbook(fileBuffer);

  const importId = generateId();
  const accepted = normalized.rows.length;
  const rejected = normalized.invalid.length;

  const stored = await withTransaction(async (tx) => {
    const imp = await tx
      .request()
      .input('id', sql.VarChar, generateId())
      .input('runId', sql.VarChar, runId)
      .input('sellerId', sql.VarChar, effectiveSeller)
      .input('channel', sql.NVarChar, effectiveChannel)
      .input('sourceType', sql.VarChar, sourceType)
      .input('fileName', sql.NVarChar, fileName || null)
      .input('fileHash', sql.VarChar(128), fileHash)
      .input('totalRows', sql.Int, (rows || []).length)
      .input('acceptedCount', sql.Int, accepted)
      .input('rejectedCount', sql.Int, rejected)
      .input('status', sql.VarChar, 'VALIDATED')
      .input('mappingJson', sql.NVarChar(sql.MAX), JSON.stringify({ ...DEFAULT_MAPPING, ...(mapping || {}) }))
      .input('validationJson', sql.NVarChar(sql.MAX), JSON.stringify({
        rejected: normalized.invalid.map((r) => ({
          line: r.index + 1, asin: r.asin || null, sku: r.sku, reason: r.invalidReason,
        })),
      }))
      .input('createdBy', sql.VarChar, createdBy || null)
      .input('originalFileHash', sql.VarChar(128), hashBuffer(fileBuffer))
      .input('originalFileName', sql.NVarChar, fileName || null)
      .input('originalFileSize', sql.BigInt, fileBuffer.length)
      .input('originalFileContentType', sql.NVarChar, 'application/octet-stream')
      .input('originalFileStoragePath', sql.NVarChar, filePath)
      .input('parserVersion', sql.VarChar, PARSER_VERSION)
      .input('uploadRevision', sql.Int, 1)
      .input('parentImportId', sql.VarChar, parentImportId)
      .input('createdBy', sql.VarChar, createdBy || null)
      .query(`
        INSERT INTO OosImports
          (Id, RunId, SellerId, Channel, SourceType, FileName, FileHash, TotalRows, AcceptedCount, RejectedCount,
           Status, MappingJson, ValidationJson, CreatedBy, CreatedAt,
           OriginalFileHash, OriginalFileName, OriginalFileSize, OriginalFileContentType, OriginalFileStoragePath,
           ParserVersion, UploadRevision, ParentImportId)
        OUTPUT INSERTED.*
        VALUES
          (@id, @runId, @sellerId, @channel, @sourceType, @fileName, @fileHash, @totalRows, @acceptedCount, @rejectedCount,
           @status, @mappingJson, @validationJson, @createdBy, GETUTCDATE(),
           @originalFileHash, @originalFileName, @originalFileSize, @originalFileContentType, @originalFileStoragePath,
           @parserVersion, @uploadRevision, @parentImportId)
      `);

    for (const r of normalized.rows) {
      await tx
        .request()
        .input('id', sql.VarChar, generateId())
        .input('runId', sql.VarChar, runId)
        .input('sellerId', sql.VarChar, effectiveSeller)
        .input('channel', sql.VarChar, effectiveChannel)
        .input('asinCode', sql.VarChar, r.asin)
        .input('sku', sql.NVarChar, r.sku)
        .input('rawQuantity', sql.Decimal(18, 4), r.quantity)
        .input('rawAvailability', sql.NVarChar, r.availability)
        .input('rawStatus', sql.NVarChar, r.status)
        .input('source', sql.VarChar, sourceType)
        .input('sourceTimestamp', sql.DateTime2, r.sourceTimestamp)
        .input('importId', sql.VarChar, importId)
        .input('lineNumber', sql.Int, r.index + 1)
        .input('isValid', sql.Bit, 1)
        .query(`
          INSERT INTO OosObservations
            (Id, RunId, SellerId, Channel, AsinCode, Sku, RawQuantity, RawAvailability,
             RawStatus, Source, SourceTimestamp, ImportId, LineNumber, IsValid, CreatedAt)
          VALUES
            (@id, @runId, @sellerId, @channel, @asinCode, @sku, @rawQuantity, @rawAvailability,
             @rawStatus, @source, @sourceTimestamp, @importId, @lineNumber, @isValid, GETUTCDATE())
        `);
    }

    return imp.recordset[0];
  });

  return {
    import: stored,
    idempotent: false,
    accepted,
    rejected,
    invalid: normalized.invalid.map((r) => ({ line: r.index + 1, asin: r.asin || null, reason: r.invalidReason })),
  };
}

async function listImports(runId) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('runId', sql.VarChar, runId)
    .query('SELECT * FROM OosImports WHERE RunId = @runId ORDER BY CreatedAt ASC');
  return result.recordset;
}

module.exports = { ingestUpload, normalizeRows, parseWorkbook, listImports, hashBuffer, SOURCES };