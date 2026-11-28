// The initial dashboard/date index may cover only four older metrics.
// Reuse a complete usable date-leading rowstore index, otherwise add a
// narrow-report covering index without removing existing dashboard indexes.
// Deliberately exclude nvarchar(max) titles from this index.
module.exports={up:async pool=>{
  await pool.request().query(`
    SET XACT_ABORT ON;
    BEGIN TRY
      BEGIN TRANSACTION;
      DECLARE @lock int;
      EXEC @lock=sp_getapplock @Resource='retailops:gms-cold-index-097',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=30000;
      IF @lock<0 THROW 51010,'GMS analytics covering index lock unavailable',1;
      IF OBJECT_ID(N'dbo.GmsDailyPerformance',N'U') IS NULL
        THROW 51011,'GMS fact table must exist before cold-query indexing',1;
      DECLARE @factId int=OBJECT_ID(N'dbo.GmsDailyPerformance',N'U');
      IF NOT EXISTS (
        SELECT 1
        FROM sys.indexes i
        JOIN sys.index_columns lead ON lead.object_id=i.object_id AND lead.index_id=i.index_id AND lead.key_ordinal=1
        JOIN sys.columns lc ON lc.object_id=lead.object_id AND lc.column_id=lead.column_id
        WHERE i.object_id=@factId AND i.type IN (1,2) AND i.is_disabled=0 AND i.is_hypothetical=0 AND i.has_filter=0
          AND lc.name=N'Date'
          AND (i.type=1 OR NOT EXISTS (
            SELECT required.name
            FROM (VALUES(N'Id'),(N'Asin'),(N'SellerId'),(N'Brand'),(N'StoreCode'),
              (N'OrderedRevenue'),(N'OrderedUnits'),(N'ShippedRevenue'),(N'ShippedCOGS'),(N'ShippedUnits'),(N'CustomerReturns')) required(name)
            WHERE NOT EXISTS (
              SELECT 1 FROM sys.index_columns ic
              JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
              WHERE ic.object_id=i.object_id AND c.name=required.name
                AND (ic.index_id=i.index_id OR (ic.index_id=1 AND ic.key_ordinal>0))
            )
          ))
      )
      BEGIN
        IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=@factId AND name=N'IX_GmsDailyPerformance_Date_ReportCover')
          THROW 51012,'Existing GMS report covering index is not usable; review index before migration',1;
        CREATE INDEX IX_GmsDailyPerformance_Date_ReportCover
        ON dbo.GmsDailyPerformance([Date],Asin)
        INCLUDE (Id,SellerId,Brand,StoreCode,OrderedRevenue,OrderedUnits,ShippedRevenue,ShippedCOGS,ShippedUnits,CustomerReturns);
      END
      COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
      IF XACT_STATE()<>0 ROLLBACK TRANSACTION;
      THROW;
    END CATCH;
  `);
}};
