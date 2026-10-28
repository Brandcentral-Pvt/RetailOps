/**
 * Migration 035: Task-scoped OOS run uniqueness
 *
 * Adds TaskInstanceId to OosRuns and creates a task-scoped unique index so that
 * concurrent creates for one task/seller/date produce exactly one run.
 * Replaces the legacy UX_OosRuns_Date_Seller(RunDate, SellerId) index which
 * incorrectly prevented multiple tasks for the same seller/date.
 *
 * Idempotent forward-only; existing data preserved.
 */
module.exports = {
  up: async (pool) => {
    const q = (s) => pool.request().query(s);

    // ── Add TaskInstanceId to OosRuns ──────────────────────────────────
    await q(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.OosRuns') AND name = 'TaskInstanceId')
        ALTER TABLE dbo.OosRuns ADD TaskInstanceId VARCHAR(50) NULL;
    `);

    // ── Backfill TaskInstanceId from existing bindings ─────────────────
    await q(`
      UPDATE r
      SET TaskInstanceId = b.TaskInstanceId
      FROM dbo.OosRuns r
      INNER JOIN dbo.OosTaskBindings b ON b.OosRunId = r.Id
      WHERE r.TaskInstanceId IS NULL AND b.TaskInstanceId IS NOT NULL;
    `);

    // ── Drop legacy date+seller unique index (prevents multi-task same day) ──
    await q(`
      IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_OosRuns_Date_Seller' AND object_id = OBJECT_ID('dbo.OosRuns'))
        DROP INDEX UX_OosRuns_Date_Seller ON dbo.OosRuns;
    `);

    // ── Create task-scoped unique index ────────────────────────────────
    await q(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_OosRuns_Task_Seller_RunDate' AND object_id = OBJECT_ID('dbo.OosRuns'))
        CREATE UNIQUE NONCLUSTERED INDEX UX_OosRuns_Task_Seller_RunDate
          ON dbo.OosRuns(TaskInstanceId, SellerId, RunDate)
          WHERE TaskInstanceId IS NOT NULL;
    `);

    // ── Fix OosImports unique index for revision support ─────────────────
    // Old index UX_OosImports_Run_Channel_Source only allowed one import per
    // run/channel/source. Revisioned uploads need multiple rows per run/channel/source
    // differentiated by UploadRevision.
    await q(`
      IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_OosImports_Run_Channel_Source' AND object_id = OBJECT_ID('dbo.OosImports'))
        DROP INDEX UX_OosImports_Run_Channel_Source ON dbo.OosImports;
    `);
    await q(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_OosImports_Run_Channel_Source_Revision' AND object_id = OBJECT_ID('dbo.OosImports'))
        CREATE UNIQUE NONCLUSTERED INDEX UX_OosImports_Run_Channel_Source_Revision
          ON dbo.OosImports(RunId, Channel, SourceType, UploadRevision);
    `);

    console.log('[Migration 035] ✅ Task-scoped OOS run uniqueness');
  },
};