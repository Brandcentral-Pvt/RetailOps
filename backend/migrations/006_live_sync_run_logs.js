/**
 * Live Sync Tracker — run-level + per-ASIN logging.
 *
 * Every live-sync run (manual, auto, re-sync, or the Live Data Inspector
 * tool) records a row in LiveSyncRunLogs, and each ASIN processed during
 * that run gets a row in LiveSyncRunAsinLogs. Idempotent — safe to re-run.
 */
module.exports = {
  up: async (pool, sql) => {
    // ── Run-level log ──
    await pool.request().query(`
      IF OBJECT_ID(N'dbo.LiveSyncRunLogs', N'U') IS NULL
      BEGIN
        CREATE TABLE LiveSyncRunLogs (
          Id VARCHAR(50) PRIMARY KEY,
          BatchId VARCHAR(50) NULL,
          TriggerType NVARCHAR(20) NOT NULL DEFAULT 'MANUAL',   -- MANUAL | AUTO | RE_SYNC | TOOL
          Source NVARCHAR(30) NOT NULL DEFAULT 'SELLER',        -- SYNC_ALL | SELLER | RESYNC | INSPECTOR_FETCH | INSPECTOR_UPLOAD
          TriggeredById VARCHAR(50) NULL,
          TriggeredByName NVARCHAR(255) NULL,
          SellerId VARCHAR(50) NULL,
          SellerName NVARCHAR(255) NULL,
          Marketplace NVARCHAR(50) NULL,
          Status NVARCHAR(20) NOT NULL DEFAULT 'RUNNING',       -- RUNNING | COMPLETED | PARTIAL | FAILED | CANCELLED
          TotalAsins INT NOT NULL DEFAULT 0,
          SuccessCount INT NOT NULL DEFAULT 0,
          FailedCount INT NOT NULL DEFAULT 0,
          FailedAsinCodes NVARCHAR(MAX) NULL,
          Errors NVARCHAR(MAX) NULL,
          DurationMs INT NULL,
          StartedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
          CompletedAt DATETIME2 NULL,
          Metadata NVARCHAR(MAX) NULL
        );

        CREATE INDEX IX_LiveSyncRunLogs_StartedAt ON LiveSyncRunLogs(StartedAt DESC);
        CREATE INDEX IX_LiveSyncRunLogs_Seller ON LiveSyncRunLogs(SellerId);
        CREATE INDEX IX_LiveSyncRunLogs_TriggerType ON LiveSyncRunLogs(TriggerType);
        CREATE INDEX IX_LiveSyncRunLogs_Batch ON LiveSyncRunLogs(BatchId);
      END
    `);

    // ── Per-ASIN detail log ──
    await pool.request().query(`
      IF OBJECT_ID(N'dbo.LiveSyncRunAsinLogs', N'U') IS NULL
      BEGIN
        CREATE TABLE LiveSyncRunAsinLogs (
          Id VARCHAR(50) PRIMARY KEY,
          RunId VARCHAR(50) NOT NULL,
          AsinCode VARCHAR(30) NULL,
          AsinId VARCHAR(50) NULL,
          Status NVARCHAR(20) NOT NULL,                         -- SUCCESS | FAILED | NOT_FOUND | SKIPPED
          ErrorMessage NVARCHAR(MAX) NULL,
          LoggedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()
        );

        CREATE INDEX IX_LiveSyncRunAsinLogs_RunId ON LiveSyncRunAsinLogs(RunId);
        CREATE INDEX IX_LiveSyncRunAsinLogs_AsinCode ON LiveSyncRunAsinLogs(AsinCode);
      END
    `);
  },
};
