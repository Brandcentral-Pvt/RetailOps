// Persist complete rejected-row diagnostics separately from compact job summaries.
module.exports = { up: async pool => {
  await pool.request().query(`
    SET XACT_ABORT ON;
    BEGIN TRY
      BEGIN TRANSACTION;
      DECLARE @schemaLock INT;
      EXEC @schemaLock=sp_getapplock @Resource='retailops:gms-schema-091', @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=30000;
      IF @schemaLock < 0 THROW 51001, 'GMS schema migration lock unavailable', 1;
      IF OBJECT_ID(N'dbo.GmsImportJobs', N'U') IS NULL
        THROW 51004, 'Apply GMS migration 091 first', 1;
      IF COL_LENGTH('dbo.GmsImportJobs','IssueReportJson') IS NULL
        ALTER TABLE dbo.GmsImportJobs ADD IssueReportJson NVARCHAR(MAX) NULL;
      COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
      IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
      THROW;
    END CATCH;
  `);
} };
