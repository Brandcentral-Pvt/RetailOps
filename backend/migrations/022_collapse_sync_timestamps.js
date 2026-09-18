/**
 * 022 — collapse sync timestamps into one.
 *
 * Decision (user-approved): Asins kept three refresh timestamps —
 * LastScrapedAt, LastLiveSyncAt, LastOctoparseSyncAt — but LastSyncSource
 * already records the source (LIVE/OCTOPARSE). Collapse to a single
 * LastScrapedAt + LastSyncSource and drop the redundant columns:
 *   - Asins.LastLiveSyncAt
 *   - Asins.LastOctoparseSyncAt
 *   - Sellers.LastLiveSyncAt (added in 021, read-only, now derived from Asins)
 *
 * Idempotent. Existing sync timestamps are backfilled into LastScrapedAt
 * BEFORE the columns are dropped so no history is lost.
 */
module.exports = {
  up: async (pool) => {
    async function hasColumn(table, column) {
      const r = await pool.request()
        .input('tableName', table)
        .input('name', column)
        .query(`SELECT COUNT(*) AS n FROM sys.columns WHERE object_id = OBJECT_ID(@tableName) AND name = @name`);
      return r.recordset[0].n > 0;
    }

    // 1) Backfill LastScrapedAt from the legacy cols (live first, then octoparse).
    if (await hasColumn('dbo.Asins', 'LastLiveSyncAt')) {
      await pool.request().query(
        `UPDATE dbo.Asins SET LastScrapedAt = LastLiveSyncAt WHERE LastLiveSyncAt IS NOT NULL`
      );
      console.log('  - backfilled LastScrapedAt from LastLiveSyncAt');
    }
    if (await hasColumn('dbo.Asins', 'LastOctoparseSyncAt')) {
      await pool.request().query(
        `UPDATE dbo.Asins SET LastScrapedAt = LastOctoparseSyncAt WHERE LastOctoparseSyncAt IS NOT NULL AND LastScrapedAt IS NULL`
      );
      console.log('  - backfilled LastScrapedAt from LastOctoparseSyncAt');
    }

    // 2) Drop the redundant columns.
    const drops = [
      ['dbo.Asins', 'LastLiveSyncAt'],
      ['dbo.Asins', 'LastOctoparseSyncAt'],
      ['dbo.Sellers', 'LastLiveSyncAt'],
    ];
    for (const [table, column] of drops) {
      if (await hasColumn(table, column)) {
        await pool.request().query(`ALTER TABLE ${table} DROP COLUMN ${column}`);
        console.log(`  - dropped ${table}.${column}`);
      } else {
        console.log(`  - skip ${table}.${column} (absent)`);
      }
    }
  },
};