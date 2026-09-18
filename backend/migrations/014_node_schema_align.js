/**
 * Align the live EF-scaffolded schema with what the Node.js application
 * actually writes. The .NET migration chain produced many `NOT NULL` columns
 * with no default (audit columns like CreatedBy / IsDeleted / IsMuted, counters,
 * flags, FK ids). The Node INSERTs (controllers/services/routes/middleware)
 * omit those columns, so SQL Server rejects them (error 515) and the writes
 * silently fail.
 *
 * Strategy (idempotent, reversible, DB-conforms-to-Node):
 *   1. Parse every `INSERT INTO <t> (<cols>)` in the Node app code.
 *   2. For each live table, find NOT NULL columns that have no default and are
 *      not IDENTITY, then flag ones omitted by at least one INSERT.
 *   3. Skip PRIMARY KEY columns (a synthetic default would just collide) and
 *      report them.
 *   4. Fix each flagged column:
 *      - participates in a FOREIGN KEY  -> make it NULL-able (SQL Server FK
 *        semantics: NULL never violates a FK), because a fabricated value would.
 *      - otherwise                       -> add a datatype-appropriate DEFAULT
 *        (bit 0 / numeric 0 / '' text / SYSUTCDATETIME() for datetimes), so the
 *        existing Node INSERT keeps working untouched.
 *
 * Every statement is guarded, so re-running is a no-op.
 */
const fs = require('fs');
const path = require('path');
const { sql } = require('../database/db');

const ROOT = path.resolve(__dirname, '..');
const SCAN_DIRS = ['controllers', 'services', 'routes', 'middleware', 'utils', 'database', 'jobs', 'scripts'];
const IGNORE = ['node_modules', 'migrations', 'test', '__tests__'];

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE.includes(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, acc);
    else if (/\.(js|cjs|mjs)$/.test(e.name)) acc.push(full);
  }
  return acc;
}

function normalizeTable(t) {
  return t.replace(/^\[(.*)\]$/, '$1').replace(/^dbo\./, '').split('.').filter(Boolean).pop().trim();
}

function parseInserts(file) {
  const src = fs.readFileSync(file, 'utf8');
  const out = [];
  const re = /INSERT\s+INTO\s+(\[?[\w]+\]?(?:\.\[?[\w]+\]?)?)(?:\s*\(([^)]*)\))?/gi;
  let m;
  while ((m = re.exec(src))) {
    const table = normalizeTable(m[1]);
    let cols = [];
    if (m[2]) {
      cols = m[2].split(',').map(c => c.trim().replace(/^\[(.*)\]$/, '$1').split(' AS ')[0].trim()).filter(Boolean);
    }
    out.push({ table, cols, noColumnList: !m[2] });
  }
  return out;
}

function fullTypeName(c) {
  const len = c.type.max_length;
  let base = c.type.name;
  if (c.type.name === 'nchar' || c.type.name === 'nvarchar') base += len >= 4000 && c.type.name === 'nvarchar' && len === -1 ? '(MAX)' : `(${len / 2})`;
  else if (c.type.name === 'char' || c.type.name === 'varchar') base += len === -1 ? '(MAX)' : `(${len})`;
  else if (c.type.name === 'binary' || c.type.name === 'varbinary') base += len === -1 ? '(MAX)' : `(${len})`;
  else if (c.type.name === 'decimal' || c.type.name === 'numeric') base += `(${c.precision},${c.scale})`;
  else if (c.type.name === 'datetime2' || c.type.name === 'datetimeoffset') base += `(${c.scale})`;
  else if (c.type.name === 'time') base += `(${c.scale})`;
  // in v1.3+ mssql returns user_type_id for custom types; if the base type is
  // a user-defined alias, fall back to a conservative NVARCHAR length
  if (!/^(bit|int|bigint|smallint|tinyint|money|smallmoney|decimal|numeric|real|float|date|datetime2|datetime|smalldatetime|datetimeoffset|time|char|varchar|nchar|nvarchar|binary|varbinary|uniqueidentifier|text|ntext|image)$/i.test(c.type.name)) {
    return null;
  }
  return base.toUpperCase();
}

function defaultValueFor(type) {
  switch (type) {
    case 'bit': return '0';
    case 'int': case 'bigint': case 'smallint': case 'tinyint':
    case 'decimal': case 'numeric': case 'money': case 'smallmoney': case 'real': case 'float':
      return '0';
    case 'datetime2': case 'datetime': case 'smalldatetime': case 'datetimeoffset':
      return 'SYSDATETIME()';
    case 'date': return 'CAST(SYSDATETIME() AS DATE)';
    case 'char': case 'varchar': case 'nchar': case 'nvarchar': case 'text': case 'ntext':
      return "''"; // SQL Server coerces '' into an empty text value
    default:
      return null;
  }
}

module.exports = {
  up: async (pool) => {
    const files = [];
    for (const d of SCAN_DIRS) {
      const dir = path.join(ROOT, d);
      if (fs.existsSync(dir)) walk(dir, files);
    }
    for (const f of ['app.js', 'server.js', 'index.js']) {
      const p = path.join(ROOT, f);
      if (fs.existsSync(p)) files.push(p);
    }

    const insertsByTable = {};
    for (const f of files) {
      for (const ins of parseInserts(f)) {
        (insertsByTable[ins.table] = insertsByTable[ins.table] || []).push(ins);
      }
    }

    // Pull NOT NULL column metadata + PK/FK participation for every targeted table
    const tables = Object.keys(insertsByTable).filter(Boolean);
    const meta = {};
    for (const t of tables) {
      const r = await pool.request().input('t', sql.NVarChar, t).query(`
        SELECT c.name,
               c.is_identity, c.is_nullable, c.default_object_id,
               ty.name AS TypeName,
               (SELECT CAST(COUNT(*) AS INT)
                  FROM sys.indexes i JOIN sys.index_columns ic
                    ON ic.object_id = i.object_id AND ic.index_id = i.index_id
                 WHERE i.is_primary_key = 1 AND i.object_id = c.object_id AND ic.column_id = c.column_id) AS IsPk,
               (SELECT CAST(COUNT(*) AS INT)
                  FROM sys.foreign_key_columns fk
                 WHERE (fk.parent_object_id = c.object_id AND fk.parent_column_id = c.column_id)
                    OR (fk.referenced_object_id = c.object_id AND fk.referenced_column_id = c.column_id)) AS IsFk,
               ty.max_length, ty.precision, ty.scale
        FROM sys.columns c
        JOIN sys.tables tbl ON tbl.object_id = c.object_id
        JOIN sys.types ty ON ty.user_type_id = c.user_type_id
        WHERE tbl.name = @t
      `);
      meta[t] = r.recordset;
    }

    // Determine fixes
    const addDefault = [];   // { table, col, expr }
    const makeNullable = []; // { table, col, ddl }
    const skipped = [];      // { table, col, reason }

    for (const [table, list] of Object.entries(insertsByTable)) {
      const cols = meta[table] || [];
      const required = cols.filter(c => !c.is_identity && !c.is_nullable && !c.default_object_id);
      if (!required.length) continue;

      const omitted = new Set();
      for (const ins of list) {
        if (ins.noColumnList) continue;
        const provided = new Set(ins.cols);
        for (const c of required) if (!provided.has(c.name)) omitted.add(c.name);
      }
      if (!omitted.size) continue;

      for (const c of required) {
        if (!omitted.has(c.name)) continue;
        if (c.IsPk) { skipped.push({ table, col: c.name, reason: 'PRIMARY KEY — cannot default' }); continue; }
        if (c.IsFk) {
          const full = fullTypeName(c);
          if (full) makeNullable.push({ table, col: c.name, ddl: `${full} NULL` });
          else skipped.push({ table, col: c.name, reason: `FK column with unsupported type '${c.TypeName}'` });
          continue;
        }
        const expr = defaultValueFor(c.TypeName);
        if (expr === null) { skipped.push({ table, col: c.name, reason: `unsupported type '${c.TypeName}'` }); continue; }
        addDefault.push({ table, col: c.name, expr });
      }
    }

    console.log(`[migrate:014] ${addDefault.length} default additions, ${makeNullable.length} FK columns to nullable, ${skipped.length} skipped`);

    // Apply non-FK defaults
    for (const f of addDefault) {
      const ddl = `ALTER TABLE dbo.[${f.table}] ADD CONSTRAINT DF_${f.table}_${f.col} DEFAULT (${f.expr}) FOR [${f.col}];`;
      await pool.request()
        .input('table', sql.NVarChar, f.table)
        .input('col', sql.NVarChar, f.col)
        .input('ddl', sql.NVarChar, ddl)
        .query(`
          IF COL_LENGTH('dbo.' + @table, @col) IS NOT NULL
             AND NOT EXISTS (
               SELECT 1 FROM sys.default_constraints dc
               JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
               JOIN sys.tables t ON t.object_id = c.object_id
               WHERE t.name = @table AND c.name = @col
             )
          BEGIN
            EXEC sp_executesql @ddl;
          END
        `);
    }

    // Apply FK nullable fixes
    for (const f of makeNullable) {
      const ddl = `ALTER TABLE dbo.[${f.table}] ALTER COLUMN [${f.col}] ${f.ddl};`;
      await pool.request()
        .input('table', sql.NVarChar, f.table)
        .input('col', sql.NVarChar, f.col)
        .input('ddl', sql.NVarChar, ddl)
        .query(`
          IF COL_LENGTH('dbo.' + @table, @col) IS NOT NULL
             AND EXISTS (
               SELECT 1 FROM sys.columns c
               JOIN sys.tables t ON t.object_id = c.object_id
               WHERE t.name = @table AND c.name = @col AND c.is_nullable = 0 AND c.is_identity = 0
             )
          BEGIN
            EXEC sp_executesql @ddl;
          END
        `);
    }

    for (const s of skipped) console.log(`[migrate:014] SKIP ${s.table}.${s.col} — ${s.reason}`);
  },
};