// Permit financially valid unmatched GMS facts without inventing a seller.
// Preserve all existing facts, foreign keys and column type. The initial
// RetailOps schema defines SellerId as VARCHAR(50) NOT NULL; migration 091
// already creates it nullable on legacy installations missing that column.
module.exports = { up: async (pool) => {
  await pool.request().query(`
    SET XACT_ABORT ON;
    BEGIN TRY
      BEGIN TRANSACTION;
      DECLARE @schemaLock INT;
      EXEC @schemaLock=sp_getapplock @Resource='retailops:gms-schema-091', @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=30000;
      IF @schemaLock < 0 THROW 51001, 'GMS schema migration lock unavailable', 1;
      IF COL_LENGTH('dbo.GmsDailyPerformance','SellerId') IS NULL
        THROW 51002, 'Apply GMS migration 091 first', 1;
      IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('dbo.GmsDailyPerformance') AND name='SellerId' AND is_nullable=0)
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('dbo.GmsDailyPerformance') AND name='SellerId' AND system_type_id=167 AND max_length=50 AND user_type_id=system_type_id)
          THROW 51003, 'Unexpected GMS SellerId type; inspect before changing nullability', 1;
        ALTER TABLE dbo.GmsDailyPerformance ALTER COLUMN SellerId VARCHAR(50) NULL;
      END;
      COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
      IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
      THROW;
    END CATCH;
  `);
} };
