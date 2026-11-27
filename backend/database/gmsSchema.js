const { getPool } = require('./db');
const migration = require('../migrations/091_gms_import_jobs');
const nullableSeller = require('../migrations/092_gms_nullable_seller');

const required = {
  GmsDailyPerformance: ['Id','Asin','Date','SellerId','Brand','StoreCode','OrderedRevenue','OrderedUnits','ShippedRevenue','ShippedCOGS','ShippedUnits','CustomerReturns','CreatedAt','UpdatedAt'],
  GmsImportJobs: ['Id','OwnerId','FileName','Status','RowsJson','SummaryJson','SnapshotHash','CreatedAt','ExpiresAt','CompletedAt'],
};
async function inspectGmsSchema(pool) {
  pool = pool || await getPool();
  const result = await pool.request().query(
    "SELECT t.name AS tableName,c.name AS columnName,c.is_nullable AS isNullable FROM sys.tables t " +
    "JOIN sys.schemas s ON s.schema_id=t.schema_id JOIN sys.columns c ON c.object_id=t.object_id " +
    "WHERE s.name='dbo' AND t.name IN ('GmsDailyPerformance','GmsImportJobs');" +
    "SELECT compatibility_level AS level FROM sys.databases WHERE database_id=DB_ID();"
  );
  const columns = new Map();
  for (const row of result.recordsets[0]) {
    const name = String(row.tableName).toLowerCase();
    if (!columns.has(name)) columns.set(name,new Set());
    columns.get(name).add(String(row.columnName).toLowerCase());
  }
  const missing = [];
  for (const [table, names] of Object.entries(required)) {
    const cols = columns.get(table.toLowerCase());
    if (!cols) { missing.push(table); continue; }
    for (const column of names) if (!cols.has(column.toLowerCase())) missing.push(table+'.'+column);
  }
  const ownerColumn = result.recordsets[0].find(row => String(row.tableName).toLowerCase()==='gmsdailyperformance' && String(row.columnName).toLowerCase()==='sellerid');
  if (ownerColumn && !ownerColumn.isNullable) missing.push('GmsDailyPerformance.SellerId nullable');
  const compatibility = Number(result.recordsets[1]?.[0]?.level || 0);
  return { ready: missing.length===0 && compatibility>=130, missing, compatibility };
}

// 091 is additive and independent of the older feature migrations. Re-running
// its locked, idempotent DDL is safe; this does NOT mark unrelated migrations
// as applied or infer historical ownership.
async function ensureGmsSchema({ apply = false, pool } = {}) {
  pool = pool || await getPool();
  let state = await inspectGmsSchema(pool);
  if (!state.ready && apply && state.compatibility>=130 &&
      !state.missing.includes('GmsDailyPerformance')) {
    await migration.up(pool);
    await nullableSeller.up(pool);
    state = await inspectGmsSchema(pool);
  }
  return state;
}

function isGmsSchemaError(error) {
  const number = Number(error?.number ?? error?.originalError?.info?.number);
  return number===207 || number===208 || number===195;
}
function sendGmsSchemaUnavailable(res) {
  return res.status(503).json({ success:false, code:'GMS_SCHEMA_NOT_READY',
    message:'GMS database migration is incomplete. Contact an administrator to verify and repair the GMS schema.' });
}
module.exports = { inspectGmsSchema, ensureGmsSchema, isGmsSchemaError, sendGmsSchemaUnavailable };
