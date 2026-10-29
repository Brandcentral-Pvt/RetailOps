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

const UPLOAD_DIR = path.join(__dirname, '../../../private/oos_uploads');
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
 * Validate magic bytes (file signature) against declared file type.
 * Prevents MIME spoofing by checking actual file content.
 */
function validateMagicBytes(buffer, fileName) {
  const sig = buffer.slice(0, 8);
  const ext = (fileName || '').toLowerCase();

  // Excel XLSX / XLS: starts with PK ZIP signature (0x50 0x4B 0x03 0x04)
  if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
    if (sig[0] === 0x50 && sig[1] === 0x4B && sig[2] === 0x03 && sig[3] === 0x04) {
      return true;
    }
    // Some XLS files use OLE2 signature D0 CF 11 E0
    if (sig[0] === 0xD0 && sig[1] === 0xCF && sig[2] === 0x11 && sig[3] === 0xE0) {
      return true;
    }
    throw httpError(400, 'File content does not match Excel format (magic bytes invalid)', 'MAGIC_BYTES_INVALID');
  }

  // CSV: plain text - check first bytes are printable ASCII/UTF-8
  if (ext.endsWith('.csv') || ext.endsWith('.txt')) {
    const text = buffer.toString('utf8', 0, Math.min(buffer.length, 64));
    const isText = /^[\x09\x0A\x0D\x20-\x7E\xC0-\xFF]*$/.test(text);
    if (!isText) {
      throw httpError(400, 'File content does not match CSV format (magic bytes invalid)', 'MAGIC_BYTES_INVALID');
    }
    return true;
  }

  return true;
}

/**
 * Save uploaded file to private storage outside web root and return storage path.
 * Never exposes originals via static /uploads directory.
 */
function saveOriginalFile(buffer, originalFileName, runId, sourceType) {
  const dir = path.join(UPLOAD_DIR, String(runId));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const ext = path.extname(originalFileName || '');
  const base = path.basename(originalFileName || '', ext);
  const safeBase = base.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fileName = `${safeBase}_${Date.now()}${ext}`;
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

  // Validate magic bytes before writing anything
  validateMagicBytes(fileBuffer, fileName);

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

  const normalized = parseWorkbook(fileBuffer);

  const stored = await withTransaction(async (tx) => {
    // Check for existing import (same run/channel/source) inside transaction
    const existing = await tx
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

    // Save original file to private storage (inside transaction so we can rollback)
    const storagePath = saveOriginalFile(fileBuffer, fileName, runId, sourceType);

    const accepted = normalized.rows.length;
    const rejected = normalized.invalid.length;
    const importId = generateId();

    const imp = await tx
      .request()
      .input('id', sql.VarChar, importId)
      .input('runId', sql.VarChar, runId)
      .input('sellerId', sql.VarChar, effectiveSeller)
      .input('channel', sql.NVarChar, effectiveChannel)
      .input('sourceType', sql.VarChar, sourceType)
      .input('fileName', sql.NVarChar, fileName || null)
      .input('fileHash', sql.VarChar(128), fileHash)
      .input('totalRows', sql.Int, normalized.rows.length)
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
      .input('originalFileHash', sql.VarChar(128), fileHash)
      .input('originalFileName', sql.NVarChar, fileName || null)
      .input('originalFileSize', sql.BigInt, fileBuffer.length)
      .input('originalFileContentType', sql.NVarChar, 'application/octet-stream')
      .input('originalFileStoragePath', sql.NVarChar, storagePath)
      .input('parserVersion', sql.VarChar, PARSER_VERSION)
      .input('uploadRevision', sql.Int, uploadRevision)
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

/**
 * Ingest BrandCentral inventory file by extracting ASIN from Model No column.
 * BrandCentral files have Model No column (E) with data like `B0D2LK39FD` (with backticks).
 * This function:
 * 1. Parses the file
 * 2. Extracts ASIN from Model No column (stripping backticks)
 * 3. Validates it's a valid Amazon ASIN (^B0[A-Z0-9]{8}$)
 * 4. Falls back to SKU→ASIN lookup from Asins table if needed
 * 5. Stores observations with both ASIN and SKU
 */
async function ingestBrandCentralUpload({
  runId,
  sellerId,
  channel,
  fileName,
  fileBuffer,
  mapping,
  createdBy,
} = {}) {
  if (!runId) throw httpError(400, 'runId is required', 'RUN_REQUIRED');
  if (!fileBuffer || fileBuffer.length === 0) {
    throw httpError(400, 'Empty file', 'EMPTY_FILE');
  }

  validateMagicBytes(fileBuffer, fileName);

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

  // Parse workbook with custom mapping
  const normalized = parseWorkbook(fileBuffer, mapping);

  // Step 1: Extract ASIN from Model No column (strip backticks, validate Amazon ASIN)
  const ASIN_REGEX = /^B0[A-Z0-9]{8}$/;
  const rowsWithModelNoAsin = [];
  const rowsNeedingSkuLookup = [];

  for (const row of normalized.rows) {
    const modelNo = row.raw?.['Model No'] || row.raw?.['model no'] || row.raw?.['modelno'] || row.raw?.['model_no'];
    if (modelNo) {
      // Strip backticks and whitespace
      const cleaned = String(modelNo).replace(/^`+|`+$/g, '').trim();
      // Validate Amazon ASIN format
      if (ASIN_REGEX.test(cleaned)) {
        row.asin = cleaned;
        row._asinSource = 'model_no';
        rowsWithModelNoAsin.push(row);
        continue;
      }
    }
    rowsNeedingSkuLookup.push(row);
  }

  // Step 2: For rows without valid Model No ASIN, try SKU lookup from Asins table
  const skuToAsin = new Map();
  const skus = [...new Set(rowsNeedingSkuLookup.map((r) => r.sku).filter(Boolean))];
  
  if (skus.length > 0) {
    const batchSize = 500;
    for (let i = 0; i < skus.length; i += batchSize) {
      const batch = skus.slice(i, i + batchSize);
      const request = pool.request();
      const placeholders = batch.map((sku, idx) => {
        const key = `sku${idx}`;
        request.input(key, sql.NVarChar, sku);
        return `@${key}`;
      });
      const rows = await request.query(`
        SELECT Sku, AsinCode FROM Asins
        WHERE SellerId = @sellerId AND Marketplace = @channel AND Sku IN (${placeholders.join(',')})
      `, { sellerId: effectiveSeller, channel: effectiveChannel });
      for (const row of rows.recordset) {
        skuToAsin.set(row.Sku, row.AsinCode);
      }
    }
  }

  // Step 3: Enrich remaining rows with ASINs from SKU lookup
  for (const row of rowsNeedingSkuLookup) {
    if (row.sku && skuToAsin.has(row.sku)) {
      row.asin = skuToAsin.get(row.sku);
      row._asinSource = 'sku_lookup';
    }
  }

  // Combine all rows that now have valid ASINs
  const rowsWithAsin = [
    ...rowsWithModelNoAsin,
    ...rowsNeedingSkuLookup.filter((r) => r.asin && isUsableAsinCode(r.asin))
  ];
  const rowsWithoutAsin = rowsNeedingSkuLookup.filter((r) => !r.asin || !isUsableAsinCode(r.asin));

  const stored = await withTransaction(async (tx) => {
    const existing = await tx
      .request()
      .input('runId', sql.VarChar, runId)
      .input('channel', sql.NVarChar, effectiveChannel)
      .input('sourceType', sql.VarChar, 'BRAND_CENTRAL')
      .query('SELECT TOP 1 * FROM OosImports WHERE RunId = @runId AND Channel = @channel AND SourceType = @sourceType ORDER BY UploadRevision DESC');

    let uploadRevision = 1;
    let parentImportId = null;
    if (existing.recordset[0]) {
      const prior = existing.recordset[0];
      if (prior.FileHash === fileHash) {
        return { import: prior, idempotent: true, accepted: 0, rejected: 0, invalid: [] };
      }
      uploadRevision = prior.UploadRevision + 1;
      parentImportId = prior.Id;
    }

    const storagePath = saveOriginalFile(fileBuffer, fileName, runId, 'BRAND_CENTRAL');

    const accepted = rowsWithAsin.length;
    const rejected = normalized.invalid.length + rowsWithoutAsin.length;
    const importId = generateId();

    const imp = await tx
      .request()
      .input('id', sql.VarChar, importId)
      .input('runId', sql.VarChar, runId)
      .input('sellerId', sql.VarChar, effectiveSeller)
      .input('channel', sql.NVarChar, effectiveChannel)
      .input('sourceType', sql.VarChar, 'BRAND_CENTRAL')
      .input('fileName', sql.NVarChar, fileName || null)
      .input('fileHash', sql.VarChar(128), fileHash)
      .input('totalRows', sql.Int, normalized.rows.length)
      .input('acceptedCount', sql.Int, accepted)
      .input('rejectedCount', sql.Int, rejected)
      .input('status', sql.VarChar, 'VALIDATED')
      .input('mappingJson', sql.NVarChar(sql.MAX), JSON.stringify({ ...DEFAULT_MAPPING, ...(mapping || {}) }))
      .input('validationJson', sql.NVarChar(sql.MAX), JSON.stringify({
        rejected: [
          ...normalized.invalid.map((r) => ({ line: r.index + 1, asin: r.asin || null, sku: r.sku, reason: r.invalidReason })),
          ...rowsWithoutAsin.map((r) => ({ line: r.index + 1, asin: null, sku: r.sku, reason: 'NO_VALID_ASIN_FOUND' })),
        ],
        asinSources: {
          modelNoDirect: rowsWithModelNoAsin.length,
          skuLookup: rowsWithAsin.length - rowsWithModelNoAsin.length,
        },
      }))
      .input('createdBy', sql.VarChar, createdBy || null)
      .input('originalFileHash', sql.VarChar(128), fileHash)
      .input('originalFileName', sql.NVarChar, fileName || null)
      .input('originalFileSize', sql.BigInt, fileBuffer.length)
      .input('originalFileContentType', sql.NVarChar, 'application/octet-stream')
      .input('originalFileStoragePath', sql.NVarChar, storagePath)
      .input('parserVersion', sql.VarChar, PARSER_VERSION)
      .input('uploadRevision', sql.Int, uploadRevision)
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

    for (const r of rowsWithAsin) {
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
        .input('source', sql.VarChar, 'BRAND_CENTRAL')
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
    invalid: [
      ...normalized.invalid.map((r) => ({ line: r.index + 1, asin: r.asin || null, sku: r.sku, reason: r.invalidReason })),
      ...rowsWithoutAsin.map((r) => ({ line: r.index + 1, asin: null, sku: r.sku, reason: 'NO_VALID_ASIN_FOUND' })),
    ],
    asinSources: {
      modelNoDirect: rowsWithModelNoAsin.length,
      skuLookup: rowsWithAsin.length - rowsWithModelNoAsin.length,
    },
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

module.exports = { ingestUpload, normalizeRows, parseWorkbook, listImports, hashBuffer, SOURCES, ingestBrandCentralUpload };