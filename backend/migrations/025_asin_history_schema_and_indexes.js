/**
 * ASIN history schema + the indexes the freshness/history work depends on.
 *
 * Two problems this closes (docs/asin-manager-deep-dive.md → F10 / §3):
 *
 *   1. `AsinHistory`, `AsinWeekHistory` and `SubBsrHistory` were referenced by
 *      the code but only `SubBsrHistory` had a migration — nothing in the repo
 *      created the first two, so a fresh environment could not be provisioned.
 *      They are created here (when missing) with the columns the writers use.
 *      `Asins` itself is documented as externally provisioned: its full column
 *      set (≈110 columns) exists only in the production database, and guessing
 *      it here would create a table the app cannot actually use. The migration
 *      warns loudly instead of inventing it.
 *
 *   2. The queries added with Step 2 need supporting indexes: freshness filters
 *      (`SellerId + LastScrapedAt`), the sub-BSR trend read/write key
 *      (`AsinId + Date + SubBsrCategory`) and period aggregation over week rows.
 *      Every index is best-effort — the same contract as migrations 008/024 —
 *      so a missing table or column logs a skip instead of blocking the chain.
 */
const { sql, tableExists, indexExists, columnExists, createTableIfMissing } = require('./_helpers');

async function existingColumns(pool, table) {
  const r = await pool.request()
    .input('t', sql.NVarChar, table)
    .query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = @t`);
  return new Set(r.recordset.map((row) => row.COLUMN_NAME));
}

async function ensureIndex(pool, { table, name, key, include = [], unique = false }) {
  try {
    if (!(await tableExists(pool, table))) {
      console.log(`  ⏭ skip ${name}: table ${table} not present`);
      return;
    }
    if (await indexExists(pool, name)) return;

    const cols = await existingColumns(pool, table);
    const missing = key.filter((c) => !cols.has(c));
    if (missing.length > 0) {
      console.log(`  ⏭ skip ${name}: missing key column(s) ${missing.join(', ')} on ${table}`);
      return;
    }

    const includeList = include.filter((c) => cols.has(c));
    const ddl = [`CREATE ${unique ? 'UNIQUE ' : ''}INDEX ${name} ON ${table}(${key.join(', ')})`];
    if (includeList.length > 0) ddl.push(`INCLUDE (${includeList.join(', ')})`);
    await pool.request().query(`${ddl.join(' ')};`);
    console.log(`  ✅ ${name}`);
  } catch (err) {
    // A UNIQUE index over existing duplicates, for example, must not stop the
    // chain — the writers fall back to IF EXISTS/UPDATE in that case.
    console.log(`  ⏭ skip ${name}: ${err.message.split('\n')[0]}`);
  }
}

module.exports = {
  up: async (pool) => {
    console.log('025_asin_history_schema_and_indexes: ensuring history tables…');

    await createTableIfMissing(pool, {
      name: 'AsinHistory',
      columns: [
        ['Id', { ddl: 'BIGINT IDENTITY(1, 1)', pk: true }],
        ['AsinId', { fk: { table: 'Asins', col: 'Id', onDelete: 'CASCADE' }, nullable: false }],
        ['Date', { ddl: 'DATE', nullable: false }],
        ['Price', { ddl: 'DECIMAL(18, 2) NULL' }],
        ['Mrp', { ddl: 'DECIMAL(18, 2) NULL' }],
        ['BSR', { ddl: 'INT NULL' }],
        ['SubBSR', { ddl: 'INT NULL' }],
        ['Rating', { ddl: 'DECIMAL(3, 2) NULL' }],
        ['ReviewCount', { ddl: 'INT NULL' }],
        ['StockLevel', { ddl: 'INT NULL' }],
        ['LQS', { ddl: 'DECIMAL(5, 2) NULL' }],
        ['Source', { ddl: 'NVARCHAR(50) NULL' }],
        ['CreatedAt', { ddl: 'DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()' }],
      ],
      indexes: [
        { name: 'IX_AsinHistory_AsinId_Date', cols: ['AsinId', 'Date'] },
      ],
    });

    await createTableIfMissing(pool, {
      name: 'AsinWeekHistory',
      columns: [
        ['Id', { ddl: 'VARCHAR(50)', pk: true }],
        ['AsinId', { fk: { table: 'Asins', col: 'Id', onDelete: 'CASCADE' }, nullable: false }],
        ['WeekStartDate', { ddl: 'DATE', nullable: false }],
        ['AvgPrice', { ddl: 'DECIMAL(18, 2) NULL' }],
        ['AvgBSR', { ddl: 'DECIMAL(18, 2) NULL' }],
        ['AvgRating', { ddl: 'DECIMAL(3, 2) NULL' }],
        ['TotalReviews', { ddl: 'INT NULL' }],
        ['AvgLQS', { ddl: 'DECIMAL(5, 2) NULL' }],
        ['CreatedAt', { ddl: 'DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()' }],
      ],
      indexes: [
        { name: 'IX_AsinWeekHistory_AsinId_WeekStartDate', cols: ['AsinId', 'WeekStartDate'] },
      ],
    });

    // The table exists (020); make sure it can be keyed by the writer.
    if (!(await tableExists(pool, 'SubBsrHistory'))) {
      console.log('  ⏭ skip SubBsrHistory index: table not present');
    }

    console.log('025_asin_history_schema_and_indexes: creating indexes…');

    // Freshness filters and the stale-repair queue
    await ensureIndex(pool, {
      table: 'Asins',
      name: 'IX_Asins_Seller_LastScrapedAt_Covering',
      key: ['SellerId', 'LastScrapedAt'],
      include: ['Status', 'ScrapeStatus', 'AsinCode'],
    });

    // History reads are (AsinId, window) — 008 created a covering variant, this
    // one exists for environments where that migration never ran.
    await ensureIndex(pool, {
      table: 'AsinHistory',
      name: 'IX_AsinHistory_AsinId_Date_Window',
      key: ['AsinId', 'Date'],
      include: ['Price', 'BSR', 'Rating', 'ReviewCount', 'LQS'],
    });

    // Sub-BSR trend read + the merge key used by asinHistoryService
    await ensureIndex(pool, {
      table: 'SubBsrHistory',
      name: 'IX_SubBsrHistory_Asin_Date_Category',
      key: ['AsinId', 'Date', 'SubBsrCategory'],
    });

    // One row per ASIN per ISO week — also makes the weekly upsert race-free.
    // Skipped (with a log) if legacy rows already contain duplicates.
    await ensureIndex(pool, {
      table: 'AsinWeekHistory',
      name: 'UX_AsinWeekHistory_Asin_Week',
      key: ['AsinId', 'WeekStartDate'],
      unique: true,
    });

    // Period aggregation across week rows (Step 4 charts)
    await ensureIndex(pool, {
      table: 'AsinWeekHistory',
      name: 'IX_AsinWeekHistory_WeekStartDate',
      key: ['WeekStartDate'],
      include: ['AvgPrice', 'AvgBSR', 'AvgRating', 'TotalReviews', 'AvgLQS'],
    });

    // Loud, explicit note about the one table this repository cannot provision.
    if (!(await tableExists(pool, 'Asins'))) {
      console.log(
        '  ⚠ Asins is missing and is NOT created by this migration: its column set exists only in the ' +
        'production database. Provision it from the live schema before running the application.'
      );
    }

    console.log('025_asin_history_schema_and_indexes complete');
  },
};
