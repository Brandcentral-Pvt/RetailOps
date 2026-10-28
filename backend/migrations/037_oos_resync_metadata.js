/**
 * Migration 037: OOS resync metadata
 *
 * Adds task-scoped run uniqueness columns to OosResyncJobs:
 *   RequestedAt: when the resync was requested (UTC)
 *   DispatchAttempt: retry counter
 *   ProviderRequestId: provider job identifier
 *   CompletedAt: when dispatch/completion finished
 *   FailureCode: terminal failure reason
 *   ErrorMessage: last error text
 */
module.exports = {
  up: async (pool) => {
    const q = (s) => pool.request().query(s);

    await q(`
      IF COL_LENGTH('dbo.OosResyncJobs', 'RequestedAt') IS NULL
        ALTER TABLE dbo.OosResyncJobs ADD RequestedAt DATETIME2 NULL;
    `);
    await q(`
      IF COL_LENGTH('dbo.OosResyncJobs', 'DispatchAttempt') IS NULL
        ALTER TABLE dbo.OosResyncJobs ADD DispatchAttempt INT NOT NULL DEFAULT 0;
    `);
    await q(`
      IF COL_LENGTH('dbo.OosResyncJobs', 'ProviderRequestId') IS NULL
        ALTER TABLE dbo.OosResyncJobs ADD ProviderRequestId VARCHAR(100) NULL;
    `);
    await q(`
      IF COL_LENGTH('dbo.OosResyncJobs', 'CompletedAt') IS NULL
        ALTER TABLE dbo.OosResyncJobs ADD CompletedAt DATETIME2 NULL;
    `);
    await q(`
      IF COL_LENGTH('dbo.OosResyncJobs', 'FailureCode') IS NULL
        ALTER TABLE dbo.OosResyncJobs ADD FailureCode VARCHAR(50) NULL;
    `);
    await q(`
      IF COL_LENGTH('dbo.OosResyncJobs', 'ErrorMessage') IS NULL
        ALTER TABLE dbo.OosResyncJobs ADD ErrorMessage NVARCHAR(1000) NULL;
    `);

    console.log('[Migration 037] ✅ OOS resync metadata columns');
  },
};