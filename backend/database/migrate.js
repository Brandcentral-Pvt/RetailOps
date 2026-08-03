/**
 * Migration runner — applies numbered migration files in backend/migrations in order.
 *
 * Supported shapes:
 *   legacy: module.exports = { runMigration, migrations }   (001–003, self-contained & idempotent)
 *   modern: module.exports = { up: async (pool, sql) => {} } (004+)
 *
 * Applied files are tracked in SchemaMigrations so re-runs are no-ops.
 */
const fs = require('fs');
const path = require('path');
const { sql, getPool, generateId } = require('./db');
const logger = require('../utils/logger');

async function ensureSchemaMigrationsTable(pool) {
  await pool.request().query(`
    IF OBJECT_ID(N'dbo.SchemaMigrations', N'U') IS NULL
    BEGIN
      CREATE TABLE SchemaMigrations (
        Id VARCHAR(50) PRIMARY KEY,
        Name NVARCHAR(200) NOT NULL,
        AppliedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()
      );
      CREATE UNIQUE INDEX UX_SchemaMigrations_Name ON SchemaMigrations(Name);
    END
  `);
}

async function getApplied(pool) {
  const r = await pool.request().query('SELECT Name FROM SchemaMigrations');
  return new Set(r.recordset.map(row => row.Name));
}

async function recordApplied(pool, name) {
  const id = generateId ? generateId() : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await pool.request()
    .input('id', sql.VarChar, id)
    .input('name', sql.NVarChar, name)
    .query('INSERT INTO SchemaMigrations (Id, Name) VALUES (@id, @name)');
}

/**
 * Run all pending migrations. Stops at the first failure to keep the DB consistent.
 * @returns {{ applied: number, skipped: number, failed: number, errors: Array }}
 */
async function runMigrations({ quiet = false } = {}) {
  const pool = await getPool();
  await ensureSchemaMigrationsTable(pool);
  const applied = await getApplied(pool);

  const dir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(dir)
    .filter(f => /^\d{3}_.*\.js$/.test(f))
    .sort();

  const results = { applied: 0, skipped: 0, failed: 0, errors: [] };

  for (const file of files) {
    if (applied.has(file)) { results.skipped += 1; continue; }

    const mod = require(path.join(dir, file));
    try {
      if (typeof mod.up === 'function') {
        await mod.up(pool, sql);
      } else if (typeof mod.runMigration === 'function') {
        await mod.runMigration(); // legacy self-contained runner
      } else {
        throw new Error(`Migration ${file} must export up() or runMigration()`);
      }
      await recordApplied(pool, file);
      results.applied += 1;
      if (!quiet) logger.info(`Migration applied: ${file}`);
    } catch (err) {
      results.failed += 1;
      results.errors.push({ file, error: err.message });
      logger.error(`Migration FAILED: ${file}`, { error: err.message });
      break; // stop on first failure
    }
  }

  return results;
}

/**
 * Startup wrapper — non-fatal: DB down or migration failure must never kill the API.
 * Gated by RUN_MIGRATIONS_ON_STARTUP=false (default: run).
 */
async function runMigrationsAtStartup() {
  if (process.env.RUN_MIGRATIONS_ON_STARTUP === 'false') {
    logger.info('Migrations skipped at startup (RUN_MIGRATIONS_ON_STARTUP=false)');
    return { skipped: true };
  }
  try {
    const results = await runMigrations();
    logger.info(`Migrations complete: ${results.applied} applied, ${results.skipped} skipped, ${results.failed} failed`);
    return results;
  } catch (err) {
    logger.error('Migrations at startup failed — continuing without them', { error: err.message });
    return { failed: true, error: err.message };
  }
}

module.exports = { runMigrations, runMigrationsAtStartup };
