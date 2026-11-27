// Add durable import staging without replacing the legacy ASIN/date identity.
module.exports = { up: async (pool) => {
  await pool.request().query(`
    IF OBJECT_ID(N'dbo.GmsImportJobs', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.GmsImportJobs (
        Id VARCHAR(50) NOT NULL PRIMARY KEY,
        OwnerId VARCHAR(50) NOT NULL,
        FileName NVARCHAR(255) NOT NULL,
        Status VARCHAR(20) NOT NULL,
        RowsJson NVARCHAR(MAX) NULL,
        SummaryJson NVARCHAR(MAX) NOT NULL,
        SnapshotHash VARCHAR(64) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        ExpiresAt DATETIME2 NOT NULL,
        CompletedAt DATETIME2 NULL,
        CONSTRAINT CK_GmsImportJobs_Status CHECK (Status IN ('READY','REJECTED','QUEUED','COMPLETED','FAILED','EXPIRED','CANCELLED'))
      );
      CREATE INDEX IX_GmsImportJobs_Status_Created ON dbo.GmsImportJobs(Status, CreatedAt);
      CREATE INDEX IX_GmsImportJobs_Owner_Created ON dbo.GmsImportJobs(OwnerId, CreatedAt DESC);
    END;
    -- New imports retain verified owner identity; do not guess historical ownership.
    IF OBJECT_ID(N'dbo.GmsDailyPerformance', N'U') IS NOT NULL
      AND COL_LENGTH('dbo.GmsDailyPerformance', 'SellerId') IS NULL
      ALTER TABLE dbo.GmsDailyPerformance ADD SellerId VARCHAR(50) NULL;
  `);
} };
