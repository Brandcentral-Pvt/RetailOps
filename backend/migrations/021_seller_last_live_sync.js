/**
 * 021 — add Sellers.LastLiveSyncAt.
 *
 * The live-sync-tracker endpoints (liveSyncTrackerController.js) SELECT
 * s.LastLiveSyncAt from Sellers in 5 places, but the column did not exist on
 * the table (it only exists on Asins). It is read-only in the code (never
 * written by any query), so a nullable DATETIME2 column with NULL default keeps
 * the endpoint working and reports "not synced" until a sync populates it.
 *
 * Idempotent: skipped when the column already exists.
 */
module.exports = {
  up: async (pool) => {
    const check = await pool.request().query(
      `SELECT COUNT(*) AS n FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Sellers') AND name = 'LastLiveSyncAt'`
    );
    if (check.recordset[0].n > 0) {
      console.log('  - skip Sellers.LastLiveSyncAt (exists)');
      return;
    }
    await pool.request().query(
      `ALTER TABLE dbo.Sellers ADD LastLiveSyncAt DATETIME2 NULL`
    );
    console.log('  + added Sellers.LastLiveSyncAt');
  },
};