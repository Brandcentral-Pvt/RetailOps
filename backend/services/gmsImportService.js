const { Worker } = require('node:worker_threads');
const path = require('node:path');
const crypto = require('node:crypto');
const { sql, getPool, generateId, withTransaction } = require('../database/db');
const { resolveAccessProfile } = require('./accessProfileService');
const { resolveSellerScope } = require('../utils/sellerScope');
const { MAX_ISSUES, normalizeStore, money } = require('./gmsImportParser');

const TERMINAL = new Set(['REJECTED','COMPLETED','FAILED','EXPIRED','CANCELLED']);
const LOCK = 'retailops:gms-import-commit';
const SQL_BATCH_ROWS = 10000;
const metricFields = ['orderedRevenue','orderedUnits','shippedRevenue','shippedCOGS','shippedUnits','customerReturns'];
const keyOf = row => row.asin + '|' + row.date;

let activeParses = 0;
function parseInWorker(file) {
  if (activeParses >= 1) {
    const error = new Error('Another report is being validated on this server. Try again shortly.');
    error.status = 429;
    return Promise.reject(error);
  }
  activeParses++;
  return new Promise((resolve, reject) => {
    let worker;
    try {
      worker = new Worker(path.join(__dirname, 'gmsImportParser.js'), {
        workerData: { path: file.path, name: file.originalname },
        resourceLimits: { maxOldGenerationSizeMb: 1536 },
      });
    } catch (err) { activeParses--; reject(err); return; }
    let settled = false;
    const finish = async (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { await worker.terminate(); } catch (_) { /* already stopped */ }
      activeParses--;
      if (error) reject(error); else resolve(result);
    };
    const timer = setTimeout(() => finish(new Error('Report validation timed out; split the report into smaller files')), 480000);
    worker.once('message', data => {
      if (data.ok) finish(null, data.result);
      else {
        const safe = /^(No worksheet|Report exceeds|Report must|Formula cells)/.test(data.message || '');
        finish(new Error(safe ? data.message : 'Unable to parse report; check the file format'));
      }
    });
    worker.once('error', () => finish(new Error('Report validation failed; check format or split the file')));
    worker.once('exit', () => finish(new Error('Report validation stopped before completing')));
  });
}

function addIssue(summary, line, code, message) {
  summary.invalid++;
  if (summary.issues.length < MAX_ISSUES) summary.issues.push({ row: line, code, message });
}
function canonicalFact(f) {
  return {
    id: f.id, asin: f.asin, date: f.date, sellerId: f.sellerId == null ? null : String(f.sellerId),
    storeCode: f.storeCode, brand: f.brand,
    ...Object.fromEntries(metricFields.map(k => [k, f[k] == null ? null : String(f[k])])),
  };
}

function sameMetrics(existing, row) {
  if (String(existing.brand ?? '') !== row.brand || normalizeStore(existing.storeCode) !== row.storeCode) return false;
  try {
    return metricFields.every(k => {
      if (existing[k] == null) return false;
      if (['orderedUnits','shippedUnits','customerReturns'].includes(k)) return Number(existing[k]) === row[k];
      return money(existing[k]) === row[k];
    });
  } catch (_) { return false; }
}

// Inputs are already validated. All SQL is static and payloads are bound.
const keysJson = "OPENJSON(@payload) WITH (asin NVARCHAR(30) '$.asin', [date] DATE '$.date')";
async function inspectChunk(db, rows, scope, { lock = false } = {}) {
  const summary = { invalid: 0, issues: [], inserted: 0, updated: 0, unchanged: 0, matched: 0, unmatched: 0, sample: [] };
  if (!rows.length) return { summary, rows: [], snapshot: [] };
  const payload = JSON.stringify(rows.map(({asin,date}) => ({asin,date})));
  const hint = lock ? ' WITH (UPDLOCK,HOLDLOCK)' : '';
  const catalog = await db.request().input('payload', sql.NVarChar(sql.MAX), payload).query(
    // The catalog owns the mapping. Do not join Sellers or filter their status,
    // marketplace or display name. The uploaded ASIN is the only lookup key.
    'SELECT a.AsinCode AS asin, a.SellerId AS sellerId ' +
    'FROM Asins a' + hint + ' ' +
    'WHERE EXISTS (SELECT 1 FROM ' + keysJson + ' k WHERE k.asin=UPPER(LTRIM(RTRIM(a.AsinCode))))'
  );
  const facts = await db.request().input('payload', sql.NVarChar(sql.MAX), payload).query(
    'SELECT g.Id AS id, g.Asin AS asin, CONVERT(char(10),g.Date,23) AS date, g.SellerId AS sellerId, ' +
    'g.Brand AS brand, g.StoreCode AS storeCode, CONVERT(varchar(50),g.OrderedRevenue) AS orderedRevenue, ' +
    'g.OrderedUnits AS orderedUnits, CONVERT(varchar(50),g.ShippedRevenue) AS shippedRevenue, ' +
    'CONVERT(varchar(50),g.ShippedCOGS) AS shippedCOGS, g.ShippedUnits AS shippedUnits, g.CustomerReturns AS customerReturns ' +
    'FROM GmsDailyPerformance g' + hint + ' WHERE EXISTS (SELECT 1 FROM ' + keysJson +
    ' k WHERE k.asin=g.Asin AND g.Date>=k.date AND g.Date<DATEADD(day,1,k.date))'
  );
  const byAsin = new Map(), byKey = new Map();
  for (const c of catalog.recordset) {
    const k = String(c.asin).trim().toUpperCase();
    if (!byAsin.has(k)) byAsin.set(k, []);
    byAsin.get(k).push(c);
  }
  for (const f of facts.recordset) {
    const k = String(f.asin).toUpperCase() + '|' + f.date;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(f);
  }
  const allowed = new Set(scope.allowed || []);
  const prepared = [], snapshot = [];
  for (const row of rows) {
    const matches = byAsin.get(row.asin) || [];
    const owners = matches.map(c => String(c.sellerId ?? '').trim());
    const sellerIds = [...new Set(owners.filter(Boolean))];
    if (sellerIds.length > 1) {
      addIssue(summary, row.line, 'ASIN_AMBIGUOUS', 'RetailOps contains this ASIN under multiple seller IDs');
      continue;
    }
    // Missing/unassigned catalog ASINs are valid GMS facts. Never create
    // catalog entries or substitute the report brand for a seller identity.
    const sellerId = sellerIds.length === 1 && owners.every(Boolean) ? sellerIds[0] : null;
    if (!scope.isGlobal && (!sellerId || !allowed.has(sellerId))) {
      addIssue(summary, row.line, sellerId ? 'ASIN_FORBIDDEN' : 'UNMATCHED_IMPORT_FORBIDDEN',
        sellerId ? 'Your account cannot import this RetailOps ASIN' : 'Unmatched ASINs require a global-scope importer');
      continue;
    }
    const existing = byKey.get(keyOf(row)) || [];
    if (existing.length > 1) {
      addIssue(summary, row.line, 'AMBIGUOUS_FACT', 'Multiple existing records for this ASIN/date; resolve before importing');
      continue;
    }
    let action = 'inserted';
    if (existing.length === 1) {
      const old = existing[0];
      const oldSeller = old.sellerId == null ? null : String(old.sellerId);
      if ((oldSeller !== null && oldSeller !== sellerId) || normalizeStore(old.storeCode) !== row.storeCode) {
        addIssue(summary, row.line, 'FACT_CONFLICT', 'Existing record has conflicting seller or store identity');
        continue;
      }
      if (sameMetrics(old, row)) action = oldSeller === null && sellerId !== null && scope.isGlobal ? 'updated' : 'unchanged';
      else if (oldSeller === sellerId || (oldSeller === null && scope.isGlobal)) action = 'updated';
      else {
        addIssue(summary, row.line, 'LEGACY_OWNER_UNKNOWN', 'Existing record has no verified historical owner; replacement is blocked');
        continue;
      }
    }
    summary[action]++;
    summary[sellerId === null ? 'unmatched' : 'matched']++;
    const next = { ...row, sellerId, action };
    prepared.push(next);
    snapshot.push({ key: keyOf(row), sellerId, existing: existing.map(canonicalFact) });
    if (summary.sample.length < 20) {
      summary.sample.push({ row: row.line, asin: row.asin, date: row.date, storeCode: row.storeCode,
        orderedRevenue: row.orderedRevenue, orderedUnits: row.orderedUnits, brand: row.brand, mappingStatus: sellerId === null ? 'UNMATCHED' : 'MATCHED', action });
    }
  }
  snapshot.sort((a,b) => a.key.localeCompare(b.key));
  return { summary, rows: prepared, snapshot };
}

// Limit SQL payloads and result sets while retaining a deterministic snapshot
// over the whole file. The worker still commits all chunks in one transaction.
async function inspect(db, rows, scope, options = {}) {
  const summary = { invalid: 0, issues: [], inserted: 0, updated: 0, unchanged: 0, matched: 0, unmatched: 0, sample: [] };
  const prepared = [];
  const sorted = [...rows].sort((a,b) => keyOf(a).localeCompare(keyOf(b)));
  const digest = crypto.createHash('sha256');
  digest.update('[');
  let first = true;
  for (let offset = 0; offset < sorted.length; offset += SQL_BATCH_ROWS) {
    const chunk = await inspectChunk(db, sorted.slice(offset,offset + SQL_BATCH_ROWS), scope, options);
    for (const key of ['invalid','inserted','updated','unchanged','matched','unmatched']) {
      summary[key] += chunk.summary[key];
    }
    summary.issues.push(...chunk.summary.issues.slice(0, MAX_ISSUES-summary.issues.length));
    summary.sample.push(...chunk.summary.sample.slice(0, 20-summary.sample.length));
    for (const row of chunk.rows) prepared.push(row);
    for (const fact of chunk.snapshot) {
      if (!first) digest.update(',');
      digest.update(JSON.stringify(fact));
      first = false;
    }
  }
  digest.update(']');
  return { summary, rows: prepared, snapshotHash: digest.digest('hex') };
}

function publicJob(row) {
  if (!row) return null;
  return {
    id: row.Id, fileName: row.FileName, status: row.Status,
    createdAt: row.CreatedAt, expiresAt: row.ExpiresAt, completedAt: row.CompletedAt,
    summary: JSON.parse(row.SummaryJson),
  };
}
const jobColumns = "Id, FileName, Status, SummaryJson, CONVERT(varchar(33),CreatedAt,126)+'Z' AS CreatedAt, CONVERT(varchar(33),ExpiresAt,126)+'Z' AS ExpiresAt, CONVERT(varchar(33),CompletedAt,126)+'Z' AS CompletedAt";
async function getJob(ownerId, id, db = null) {
  db = db || await getPool();
  const result = await db.request().input('id', sql.VarChar, id).input('owner', sql.VarChar, ownerId)
    .query('SELECT ' + jobColumns + ' FROM GmsImportJobs WHERE Id=@id AND OwnerId=@owner');
  return publicJob(result.recordset[0]);
}
async function listJobs(ownerId) {
  const pool = await getPool();
  const result = await pool.request().input('owner', sql.VarChar, ownerId)
    .query('SELECT TOP (50) ' + jobColumns + ' FROM GmsImportJobs WHERE OwnerId=@owner ORDER BY CreatedAt DESC, Id DESC');
  return result.recordset.map(publicJob);
}
async function createPreview(user, file) {
  const scope = resolveSellerScope(user);
  if (scope.empty) { const e = new Error('No assigned sellers'); e.status = 403; throw e; }
  let parsed;
  try { parsed = await parseInWorker(file); }
  catch (err) {
    if (err.status === 429) throw err;
    parsed = { rows: [], issues: [{ row: 1, code: 'FILE_VALIDATION', message: err.message }], invalid: 1, total: 0, duplicates: 0 };
  }
  const pool = await getPool();
  const inspected = await inspect(pool, parsed.rows, scope);
  const summary = {
    total: parsed.total, duplicates: parsed.duplicates,
    defaultedCells: parsed.defaultedCells || 0, defaultedRows: parsed.defaultedRows || 0, negativeRows: parsed.negativeRows || 0,
    ...inspected.summary,
    invalid: parsed.invalid + inspected.summary.invalid,
    issues: [...parsed.issues, ...inspected.summary.issues].slice(0, MAX_ISSUES),
  };
  const ready = summary.invalid === 0 && inspected.rows.length > 0;
  const id = generateId();
  const owner = String(user.id || user.Id || user._id);
  await pool.request().input('id', sql.VarChar, id).input('owner', sql.VarChar, owner)
    .input('name', sql.NVarChar(255), path.basename(file.originalname).slice(0,255))
    .input('status', sql.VarChar, ready ? 'READY' : 'REJECTED')
    .input('rows', sql.NVarChar(sql.MAX), ready ? JSON.stringify(inspected.rows) : null)
    .input('summary', sql.NVarChar(sql.MAX), JSON.stringify(summary))
    .input('hash', sql.VarChar(64), ready ? inspected.snapshotHash : null)
    .query('INSERT INTO GmsImportJobs(Id,OwnerId,FileName,Status,RowsJson,SummaryJson,SnapshotHash,ExpiresAt) ' +
      'VALUES(@id,@owner,@name,@status,@rows,@summary,@hash,DATEADD(hour,24,SYSUTCDATETIME()))');
  return getJob(owner,id,pool);
}
async function confirm(owner, id) {
  const pool = await getPool();
  await pool.request().input('id',sql.VarChar,id).input('owner',sql.VarChar,owner)
    .query("UPDATE GmsImportJobs SET Status='QUEUED' WHERE Id=@id AND OwnerId=@owner AND Status='READY' AND ExpiresAt>SYSUTCDATETIME()");
  await pool.request().input('id',sql.VarChar,id).input('owner',sql.VarChar,owner)
    .query("UPDATE GmsImportJobs SET Status='EXPIRED',RowsJson=NULL,CompletedAt=SYSUTCDATETIME() WHERE Id=@id AND OwnerId=@owner AND Status='READY' AND ExpiresAt<=SYSUTCDATETIME()");
  return getJob(owner,id,pool);
}
async function cancel(owner,id) {
  const pool = await getPool();
  await pool.request().input('id',sql.VarChar,id).input('owner',sql.VarChar,owner)
    .query("UPDATE GmsImportJobs SET Status='CANCELLED',RowsJson=NULL,CompletedAt=SYSUTCDATETIME() WHERE Id=@id AND OwnerId=@owner AND Status IN ('READY','QUEUED')");
  return getJob(owner,id,pool);
}
async function acquireCommitLock(tx, timeout = 0) {
  const result = await tx.request().input('resource',sql.NVarChar,LOCK).input('timeout',sql.Int,timeout)
    .query("DECLARE @result int; EXEC @result=sp_getapplock @Resource=@resource, @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=@timeout; SELECT @result AS result");
  return Number(result.recordset[0]?.result) >= 0;
}
async function finish(tx, job, status, summary) {
  await tx.request().input('id',sql.VarChar,job.Id).input('status',sql.VarChar,status)
    .input('summary',sql.NVarChar(sql.MAX),JSON.stringify(summary))
    .query('UPDATE GmsImportJobs SET Status=@status,RowsJson=NULL,SummaryJson=@summary,CompletedAt=SYSUTCDATETIME() WHERE Id=@id AND Status=\'QUEUED\'');
}
async function commitRows(tx, rows) {
  const writes = rows.filter(r => r.action !== 'unchanged');
  if (!writes.length) return;
  // All actions were verified under the same transaction and locks. Never
  // invent owner IDs, infer missing values, or change the legacy date key.
  const source = "OPENJSON(@payload) WITH (asin NVARCHAR(30) '$.asin', [date] DATE '$.date', sellerId VARCHAR(50) '$.sellerId', brand NVARCHAR(255) '$.brand', storeCode NVARCHAR(50) '$.storeCode', orderedRevenue DECIMAL(18,2) '$.orderedRevenue', orderedUnits INT '$.orderedUnits', shippedRevenue DECIMAL(18,2) '$.shippedRevenue', shippedCOGS DECIMAL(18,2) '$.shippedCOGS', shippedUnits INT '$.shippedUnits', customerReturns INT '$.customerReturns', [action] VARCHAR(20) '$.action')";
  for (let offset=0; offset<writes.length; offset+=SQL_BATCH_ROWS) {
    const batch = writes.slice(offset,offset+SQL_BATCH_ROWS);
    const result = await tx.request().input('payload',sql.NVarChar(sql.MAX),JSON.stringify(batch)).query(
    'MERGE GmsDailyPerformance WITH (HOLDLOCK) AS g USING ' + source + ' AS s ' +
    'ON g.Asin=s.asin AND g.Date>=s.date AND g.Date<DATEADD(day,1,s.date) ' +
    "WHEN MATCHED AND s.action='updated' AND (g.SellerId=s.sellerId OR g.SellerId IS NULL) THEN UPDATE SET " +
    'g.SellerId=s.sellerId,g.Brand=s.brand,g.StoreCode=s.storeCode,g.OrderedRevenue=s.orderedRevenue,g.OrderedUnits=s.orderedUnits,' +
    'g.ShippedRevenue=s.shippedRevenue,g.ShippedCOGS=s.shippedCOGS,g.ShippedUnits=s.shippedUnits,g.CustomerReturns=s.customerReturns,g.UpdatedAt=dbo.GetEnvDate() ' +
    "WHEN NOT MATCHED BY TARGET AND s.action='inserted' THEN INSERT (Id,Asin,Date,SellerId,Brand,StoreCode,OrderedRevenue,OrderedUnits,ShippedRevenue,ShippedCOGS,ShippedUnits,CustomerReturns,CreatedAt,UpdatedAt) " +
    "VALUES (SUBSTRING(LOWER(REPLACE(CAST(NEWID() AS VARCHAR(36)),'-','')),1,24),s.asin,s.date,s.sellerId,s.brand,s.storeCode,s.orderedRevenue,s.orderedUnits,s.shippedRevenue,s.shippedCOGS,s.shippedUnits,s.customerReturns,dbo.GetEnvDate(),dbo.GetEnvDate());"
  );
    if (result.rowsAffected?.[0] !== batch.length) throw new Error('Fact write count did not match validated rows');
  }
}
async function processNext() {
  let claimed = null;
  try {
    return await withTransaction(async tx => {
      if (!await acquireCommitLock(tx)) return false;
      await tx.request().query("UPDATE GmsImportJobs SET Status='EXPIRED',RowsJson=NULL,CompletedAt=SYSUTCDATETIME() WHERE Status='READY' AND ExpiresAt<=SYSUTCDATETIME()");
      const next = await tx.request().query("SELECT TOP (1) * FROM GmsImportJobs WITH (UPDLOCK,HOLDLOCK) WHERE Status='QUEUED' ORDER BY CreatedAt,Id");
      const job = next.recordset[0];
      if (!job) return false;
      claimed = job;
      const old = JSON.parse(job.SummaryJson);
      const u = await tx.request().input('owner',sql.VarChar,job.OwnerId)
        .query('SELECT U.*, R.Name AS RoleName FROM Users U LEFT JOIN Roles R ON U.RoleId=R.Id WHERE U.Id=@owner AND U.IsActive=1');
      const user = u.recordset[0];
      const access = user ? await resolveAccessProfile(user, tx) : null;
      if (!access || (!access.permissions.includes('*') && !access.permissions.includes('gms_tracker_import'))) {
        await finish(tx,job,'FAILED',{...old, failure:'Import permission is no longer available'});
        return true;
      }
      const checked = await inspect(tx, JSON.parse(job.RowsJson), resolveSellerScope(access), {lock:true});
      if (checked.summary.invalid || checked.snapshotHash !== job.SnapshotHash) {
        await finish(tx,job,'FAILED',{...old, failure:'Seller mapping or stored data changed after preview. Upload and validate again.'});
        return true;
      }
      await commitRows(tx,checked.rows);
      await finish(tx,job,'COMPLETED',{...old, committed:checked.summary.inserted+checked.summary.updated});
      return true;
    });
  } catch (err) {
    console.error('GMS import commit failed:',err.message);
    // The transaction rolled back, including any fact writes. If another
    // worker already completed this job, do not change its terminal state.
    if (claimed) {
      try {
        await withTransaction(async tx => {
          if (!await acquireCommitLock(tx,1000)) return;
          await finish(tx,claimed,'FAILED',{...JSON.parse(claimed.SummaryJson),failure:'Import could not be committed. No partial writes were applied; validate a new batch.'});
        });
      } catch (e) { console.error('GMS import failure recording failed:',e.message); }
    }
    return false;
  }
}
let timer;
function startWorker() {
  if (timer) return;
  const tick = async () => {
    try { await processNext(); } finally {
      timer = setTimeout(tick,3000);
      timer.unref?.();
    }
  };
  timer=setTimeout(tick,1000);
  timer.unref?.();
}
module.exports = { createPreview, getJob, listJobs, confirm, cancel, processNext, startWorker, acquireCommitLock, inspect, sameMetrics, TERMINAL };
