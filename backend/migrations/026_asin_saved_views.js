/**
 * Saved views + per-user column preferences for the ASIN Manager workspace.
 *
 * Step 3 makes the workspace state shareable and durable:
 *
 *   - `AsinSavedViews` holds a named workspace state — the filter set, search
 *     term, sort and column selection — owned by one user and optionally shared
 *     with everyone. The JSON payload is stored as-is (it is validated by the
 *     controller before it is written), so the shape can grow (view mode, page
 *     size, future facets) without a migration.
 *   - `AsinColumnPreferences` keeps the column selection per user *server-side*,
 *     which is what makes "my columns" portable across browsers and devices.
 *     It used to live only in `localStorage` (key `asin-datatable-columns`).
 *
 * Both are additive and best-effort: a missing table is created, an existing one
 * is left alone.
 */
const { createTableIfMissing, indexExists, tableExists, sql } = require('./_helpers');

async function ensureIndex(pool, table, name, cols) {
  try {
    if (!(await tableExists(pool, table))) return;
    if (await indexExists(pool, name)) return;
    await pool.request().query(`CREATE INDEX ${name} ON ${table}(${cols.join(', ')});`);
    console.log(`  ✅ ${name}`);
  } catch (err) {
    console.log(`  ⏭ skip ${name}: ${err.message.split('\n')[0]}`);
  }
}

module.exports = {
  up: async (pool) => {
    console.log('026_asin_saved_views: ensuring workspace view tables…');

    await createTableIfMissing(pool, {
      name: 'AsinSavedViews',
      columns: [
        ['Id', { ddl: 'VARCHAR(50)', pk: true }],
        ['Name', { ddl: 'NVARCHAR(120) NOT NULL' }],
        ['OwnerId', { ddl: 'VARCHAR(50) NULL' }],
        ['IsShared', { ddl: 'BIT NOT NULL DEFAULT 0' }],
        ['ViewJson', { ddl: 'NVARCHAR(MAX) NULL' }],
        ['CreatedAt', { ddl: 'DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()' }],
        ['UpdatedAt', { ddl: 'DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()' }],
      ],
      indexes: [
        { name: 'IX_AsinSavedViews_Owner', cols: ['OwnerId'] },
      ],
    });

    await createTableIfMissing(pool, {
      name: 'AsinColumnPreferences',
      columns: [
        ['Id', { ddl: 'VARCHAR(50)', pk: true }],
        ['UserId', { ddl: 'VARCHAR(50) NOT NULL' }],
        ['ColumnsJson', { ddl: 'NVARCHAR(MAX) NULL' }],
        ['CreatedAt', { ddl: 'DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()' }],
        ['UpdatedAt', { ddl: 'DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()' }],
      ],
      indexes: [
        { name: 'IX_AsinColumnPreferences_User', cols: ['UserId'] },
      ],
    });

    await ensureIndex(pool, 'AsinSavedViews', 'IX_AsinSavedViews_Shared', ['IsShared', 'Name']);

    // One row per user: the controller MERGEs on UserId, and a unique index makes
    // that race-free. Skipped (with a log) if a database already holds duplicates.
    try {
      if (await tableExists(pool, 'AsinColumnPreferences') && !(await indexExists(pool, 'UX_AsinColumnPreferences_User'))) {
        await pool.request().query('CREATE UNIQUE INDEX UX_AsinColumnPreferences_User ON AsinColumnPreferences(UserId);');
        console.log('  ✅ UX_AsinColumnPreferences_User');
      }
    } catch (err) {
      console.log(`  ⏭ skip UX_AsinColumnPreferences_User: ${err.message.split('\n')[0]}`);
    }

    console.log('026_asin_saved_views complete');
  },
};
