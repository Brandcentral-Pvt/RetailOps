/**
 * Shared helpers for JS migrations.
 *
 * The live DB is EF-scaffolded (Users.Id = nvarchar(100), TaskTemplates.Id =
 * varchar(24), …) while init-database.sql fresh installs use VARCHAR(50)
 * everywhere. Hard-coded FK column types therefore break one of the two.
 * These helpers build CREATE TABLE from the *actual* referenced column type at
 * runtime, so FKs succeed against either schema. A column whose referenced
 * type cannot be resolved degrades to a plain column (FK constraint dropped,
 * warned) — a missing covering index or FK must never block the chain.
 *
 * This file intentionally starts with '_' so migrate.js (filter ^\d{3}_) skips it.
 */
const { sql } = require('../database/db');

async function tableExists(pool, table) {
  const r = await pool.request()
    .input('t', sql.NVarChar, table)
    .query('SELECT 1 FROM sys.tables WHERE OBJECT_ID = OBJECT_ID(\'dbo.\' + @t)');
  return r.recordset.length > 0;
}

async function indexExists(pool, name) {
  const r = await pool.request()
    .input('n', sql.NVarChar, name)
    .query('SELECT 1 FROM sys.indexes WHERE name = @n');
  return r.recordset.length > 0;
}

async function columnExists(pool, table, column) {
  const r = await pool.request()
    .input('t', sql.NVarChar, table)
    .input('c', sql.NVarChar, column)
    .query('SELECT 1 FROM sys.columns c WHERE c.object_id = OBJECT_ID(\'dbo.\' + @t) AND c.name = @c');
  return r.recordset.length > 0;
}

/**
 * Resolve a column's type as DDL (nvarchar(100), varchar(24), int, …).
 * @returns {Promise<string|null>}
 */
async function columnTypeDdl(pool, table, column) {
  const r = await pool.request()
    .input('t', sql.NVarChar, table)
    .input('c', sql.NVarChar, column)
    .query(`
      SELECT ty.name AS [Type], c.max_length, c.precision, c.scale
      FROM sys.columns c
      JOIN sys.types ty ON ty.user_type_id = c.user_type_id
      WHERE c.object_id = OBJECT_ID('dbo.' + @t) AND c.name = @c
    `);
  const row = r.recordset[0];
  if (!row) return null;
  const name = row.Type; // 'varchar', 'nvarchar', 'decimal', …
  if (['varchar', 'char', 'binary', 'varbinary'].includes(name)) {
    if (row.max_length === -1) return `${name}(MAX)`;
    return `${name}(${row.max_length})`;
  }
  if (['nvarchar', 'nchar'].includes(name)) {
    if (row.max_length === -1) return `${name}(MAX)`;
    return `${name}(${row.max_length / 2})`;
  }
  if (['decimal', 'numeric'].includes(name)) return `${name}(${row.precision},${row.scale})`;
  return name;
}

/**
 * CREATE TABLE only when missing. FK columns are typed to match their
 * referenced PK at runtime; unresolvable references drop the FK with a warning.
 *
 * @param {object} pool mssql pool
 * @param {{
 *   name: string,
 *   columns: Array<[string, {ddl?: string, type?: string, pk?: boolean, nullable?: boolean, fk?: {table: string, col: string, onDelete?: string}}]>,
 *   indexes?: Array<{name: string, cols: string[], unique?: boolean, filter?: string}>
 * }} spec
 * @returns {Promise<boolean>} true if the table was created
 */
async function createTableIfMissing(pool, { name, columns, indexes = [] }) {
  if (await tableExists(pool, name)) {
    console.log(`  ⏭ skip ${name}: table already exists`);
    return false;
  }

  const cols = [];
  const fks = [];
  for (const [colName, def] of columns) {
    let ddl;
    if (def.ddl) {
      ddl = def.ddl;
    } else if (def.fk) {
      const refType = await columnTypeDdl(pool, def.fk.table, def.fk.col);
      if (!refType) {
        console.log(`  ⏭ ${name}.${colName}: cannot resolve ${def.fk.table}.${def.fk.col} type — FK dropped, column uses VARCHAR(50)`);
        ddl = 'VARCHAR(50)';
      } else {
        ddl = refType;
        fks.push({ colName, ...def.fk });
      }
      ddl += def.nullable === false ? ' NOT NULL' : ' NULL';
    } else {
      ddl = def.type;
    }
    if (def.pk) ddl += ' PRIMARY KEY';
    cols.push(`    ${colName} ${ddl}`);
  }

  for (const f of fks) {
    const onDelete = f.onDelete ? ` ON DELETE ${f.onDelete}` : '';
    cols.push(`    CONSTRAINT FK_${name}_${f.colName} FOREIGN KEY (${f.colName}) REFERENCES ${f.table}(${f.col})${onDelete}`);
  }

  if (cols.length === 0) throw new Error(`createTableIfMissing: no columns for ${name}`);

  await pool.request().query(`CREATE TABLE ${name} (\n${cols.join(',\n')}\n);`);
  console.log(`  ✅ created ${name}`);

  for (const idx of indexes) {
    if (await indexExists(pool, idx.name)) continue;
    const unique = idx.unique ? 'UNIQUE ' : '';
    const filter = idx.filter ? ` WHERE ${idx.filter}` : '';
    await pool.request().query(
      `CREATE ${unique}INDEX ${idx.name} ON ${name}(${idx.cols.join(', ')})${filter};`
    );
  }

  return true;
}

module.exports = {
  sql, tableExists, indexExists, columnExists, columnTypeDdl, createTableIfMissing,
};