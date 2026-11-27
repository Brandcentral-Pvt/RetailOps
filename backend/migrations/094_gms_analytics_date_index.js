// Reuse a usable date-leading index when migration 024 already provided one.
module.exports = { up: async pool => {
  await pool.request().query(`
    IF OBJECT_ID(N'dbo.GmsDailyPerformance',N'U') IS NULL
      THROW 51005, 'GMS fact table must exist before analytics indexing', 1;
    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes i
      JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id
      JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
      WHERE i.object_id=OBJECT_ID(N'dbo.GmsDailyPerformance')
        AND i.type IN (1,2) AND i.is_disabled=0 AND i.is_hypothetical=0
        AND i.has_filter=0 AND ic.key_ordinal=1 AND c.name='Date'
    )
    BEGIN
      CREATE INDEX IX_GmsDailyPerformance_Date_Asin_Analytics
      ON dbo.GmsDailyPerformance(Date,Asin)
      INCLUDE (SellerId,OrderedRevenue,OrderedUnits,ShippedRevenue,ShippedCOGS,ShippedUnits,CustomerReturns);
    END
  `);
} };
