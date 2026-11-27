// Store the optional original uploaded title separately from catalog metadata.
module.exports = { up: async pool => {
  await pool.request().query(`
    SET XACT_ABORT ON;
    BEGIN TRY
      BEGIN TRANSACTION;
      DECLARE @schemaLock int;
      EXEC @schemaLock=sp_getapplock @Resource='retailops:gms-schema-091',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=30000;
      IF @schemaLock<0 THROW 51007, 'GMS source title migration lock unavailable', 1;
      IF OBJECT_ID(N'dbo.GmsDailyPerformance',N'U') IS NULL THROW 51008, 'GMS fact table missing', 1;
      IF COL_LENGTH('dbo.GmsDailyPerformance','ReportProductTitle') IS NULL
        ALTER TABLE dbo.GmsDailyPerformance ADD ReportProductTitle nvarchar(max) NULL;
      COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
      IF XACT_STATE()<>0 ROLLBACK TRANSACTION;
      THROW;
    END CATCH;
  `);
} };
