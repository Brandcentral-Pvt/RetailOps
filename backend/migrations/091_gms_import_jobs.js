// Add durable import staging without replacing the legacy ASIN/date identity.
module.exports = { up: async (pool) => {
  await pool.request().query(`
    SET XACT_ABORT ON;
    BEGIN TRY
      BEGIN TRANSACTION;
      DECLARE @schemaLock INT;
      EXEC @schemaLock=sp_getapplock @Resource='retailops:gms-schema-091', @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=30000;
      IF @schemaLock < 0 THROW 51001, 'GMS schema migration lock unavailable', 1;
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
    IF OBJECT_ID(N'dbo.GmsDailyPerformance', N'U') IS NULL
      THROW 51000, 'GMS fact table missing', 1;
    IF COL_LENGTH('dbo.GmsDailyPerformance', 'SellerId') IS NULL
      ALTER TABLE dbo.GmsDailyPerformance ADD SellerId VARCHAR(50) NULL;
    -- Align fresh-install schema with the already-deployed GMS read contract.
    -- Missing historical fields stay NULL; they are not backfilled with zeros.
    IF COL_LENGTH('dbo.GmsDailyPerformance', 'Brand') IS NULL
      ALTER TABLE dbo.GmsDailyPerformance ADD Brand NVARCHAR(255) NULL;
    IF COL_LENGTH('dbo.GmsDailyPerformance', 'StoreCode') IS NULL
      ALTER TABLE dbo.GmsDailyPerformance ADD StoreCode NVARCHAR(50) NULL;
    IF COL_LENGTH('dbo.GmsDailyPerformance', 'ShippedRevenue') IS NULL
      ALTER TABLE dbo.GmsDailyPerformance ADD ShippedRevenue DECIMAL(18,2) NULL;
    IF COL_LENGTH('dbo.GmsDailyPerformance', 'ShippedCOGS') IS NULL
      ALTER TABLE dbo.GmsDailyPerformance ADD ShippedCOGS DECIMAL(18,2) NULL;
    IF COL_LENGTH('dbo.GmsDailyPerformance', 'ShippedUnits') IS NULL
      ALTER TABLE dbo.GmsDailyPerformance ADD ShippedUnits INT NULL;
    IF COL_LENGTH('dbo.GmsDailyPerformance', 'CustomerReturns') IS NULL
      ALTER TABLE dbo.GmsDailyPerformance ADD CustomerReturns INT NULL;
    IF COL_LENGTH('dbo.GmsDailyPerformance', 'UpdatedAt') IS NULL
      ALTER TABLE dbo.GmsDailyPerformance ADD UpdatedAt DATETIME2 NULL;
      COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
      IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
      THROW;
    END CATCH;
  `);
} };
