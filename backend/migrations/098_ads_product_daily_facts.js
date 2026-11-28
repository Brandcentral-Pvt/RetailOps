
'use strict';
// Additive canonical table. Never ALTER, DROP or backfill legacy AdsPerformance.
module.exports={up:async pool=>{
  await pool.request().query(`
    SET XACT_ABORT ON;
    BEGIN TRY
      BEGIN TRANSACTION;
      DECLARE @lock int;
      EXEC @lock=sp_getapplock @Resource='retailops:ads-product-daily-098',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=30000;
      IF @lock<0 THROW 51020,'Ads schema lock unavailable',1;
      IF OBJECT_ID(N'dbo.Sellers',N'U') IS NULL THROW 51021,'Sellers must exist',1;
      IF OBJECT_ID(N'dbo.AdsProductDailyFacts',N'U') IS NULL
      BEGIN
        CREATE TABLE dbo.AdsProductDailyFacts (
        SellerId varchar(50) NOT NULL,
        Marketplace nvarchar(50) NOT NULL,
        Currency char(3) NOT NULL,
        ReportType varchar(20) NOT NULL CONSTRAINT DF_AdsProductDaily_ReportType DEFAULT ('daily'),
        [Asin] varchar(10) NOT NULL,
        [AdvertisedSku] nvarchar(255) NULL,
        [Date] date NOT NULL,
        [AdSales] decimal(28,10) NULL,
        [AdSpend] decimal(28,10) NULL,
        [Clicks] bigint NULL,
        [Impressions] bigint NULL,
        [ViewImpressions] bigint NULL,
        [Orders] bigint NULL,
        [Conversions] bigint NULL,
        [ConversionRate] decimal(28,10) NULL,
        [ACoS] decimal(28,10) NULL,
        [RoAS] decimal(28,10) NULL,
        [CTR] decimal(28,10) NULL,
        [CPC] decimal(28,10) NULL,
        [Aov] decimal(28,10) NULL,
        [TosIs] decimal(28,10) NULL,
        [SameSkuSales] decimal(28,10) NULL,
        [SameSkuOrders] bigint NULL,
        [NewToBrandSales] decimal(28,10) NULL,
        [NewToBrandOrders] bigint NULL,
        [NewToBrandUnits] bigint NULL,
        [NewToBrandSalesPercentage] decimal(28,10) NULL,
        [NewToBrandOrdersPercentage] decimal(28,10) NULL,
        [NewToBrandUnitsPercentage] decimal(28,10) NULL,
        [DailyBudget] decimal(28,10) NULL,
        [TotalBudget] decimal(28,10) NULL,
        [MaxSpend] decimal(28,10) NULL,
        [AvgSpend] decimal(28,10) NULL,
        [TotalSales] decimal(28,10) NULL,
        [TotalAcos] decimal(28,10) NULL,
        [TotalOrders] bigint NULL,
        [TotalUnits] bigint NULL,
        [OrganicSales] decimal(28,10) NULL,
        [OrganicOrders] bigint NULL,
        [AdSalesPerc] decimal(28,10) NULL,
        [OrderedRevenue] decimal(28,10) NULL,
        [UnitsOrdered] bigint NULL,
        [OrderedOrders] bigint NULL,
        [ShippedRevenue] decimal(28,10) NULL,
        [ShippedCogs] decimal(28,10) NULL,
        [ShippedUnits] bigint NULL,
        [PageViews] bigint NULL,
        [BrowserPageViews] bigint NULL,
        [MobilePageViews] bigint NULL,
        [Sessions] bigint NULL,
        [BrowserSessions] bigint NULL,
        [MobileAppSessions] bigint NULL,
        [BuyBoxPercentage] decimal(28,10) NULL,
        [OrderedItemsSessionPercentage] decimal(28,10) NULL,
        [AverageOfferCount] decimal(28,10) NULL,
        [FeedbackReceived] bigint NULL,
        [ReceivedNegativeFeedbackRate] decimal(28,10) NULL,
        [ClaimsGranted] bigint NULL,
        [ClaimsAmount] decimal(28,10) NULL,
        [GrossProfit] decimal(28,10) NULL,
        [NetProfit] decimal(28,10) NULL,
        [Margin] decimal(28,10) NULL,
        [ProductPrice] decimal(28,10) NULL,
        [BestSellerRank] bigint NULL,
        [AfnDaysOfSupply] decimal(28,10) NULL,
        [AfnQuantity] bigint NULL,
        [MfnQuantity] bigint NULL,
        SourceFileSha256 char(64) NOT NULL,
        SourceRowNumber int NOT NULL,
        SourceSchemaVersion smallint NOT NULL,
        ImportedBy varchar(50) NOT NULL,
        ImportedAt datetime2(3) NOT NULL CONSTRAINT DF_AdsProductDaily_ImportedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_AdsProductDailyFacts PRIMARY KEY CLUSTERED (SellerId,Marketplace,ReportType,[Asin],[Date]),
        CONSTRAINT FK_AdsProductDaily_Seller FOREIGN KEY (SellerId) REFERENCES dbo.Sellers(Id),
        CONSTRAINT CK_AdsProductDaily_ReportType CHECK (ReportType='daily'),
        CONSTRAINT CK_AdsProductDaily_Lineage CHECK (SourceRowNumber>=2 AND SourceSchemaVersion=1)
        );
      END;
      -- Reject a pre-existing incompatible table instead of accepting partial storage.
      IF EXISTS (
        SELECT 1 FROM (VALUES
             (N'Asin',N'varchar',0),
             (N'AdvertisedSku',N'nvarchar',1),
             (N'Date',N'date',0),
             (N'AdSales',N'decimal',1),
             (N'AdSpend',N'decimal',1),
             (N'Clicks',N'bigint',1),
             (N'Impressions',N'bigint',1),
             (N'ViewImpressions',N'bigint',1),
             (N'Orders',N'bigint',1),
             (N'Conversions',N'bigint',1),
             (N'ConversionRate',N'decimal',1),
             (N'ACoS',N'decimal',1),
             (N'RoAS',N'decimal',1),
             (N'CTR',N'decimal',1),
             (N'CPC',N'decimal',1),
             (N'Aov',N'decimal',1),
             (N'TosIs',N'decimal',1),
             (N'SameSkuSales',N'decimal',1),
             (N'SameSkuOrders',N'bigint',1),
             (N'NewToBrandSales',N'decimal',1),
             (N'NewToBrandOrders',N'bigint',1),
             (N'NewToBrandUnits',N'bigint',1),
             (N'NewToBrandSalesPercentage',N'decimal',1),
             (N'NewToBrandOrdersPercentage',N'decimal',1),
             (N'NewToBrandUnitsPercentage',N'decimal',1),
             (N'DailyBudget',N'decimal',1),
             (N'TotalBudget',N'decimal',1),
             (N'MaxSpend',N'decimal',1),
             (N'AvgSpend',N'decimal',1),
             (N'TotalSales',N'decimal',1),
             (N'TotalAcos',N'decimal',1),
             (N'TotalOrders',N'bigint',1),
             (N'TotalUnits',N'bigint',1),
             (N'OrganicSales',N'decimal',1),
             (N'OrganicOrders',N'bigint',1),
             (N'AdSalesPerc',N'decimal',1),
             (N'OrderedRevenue',N'decimal',1),
             (N'UnitsOrdered',N'bigint',1),
             (N'OrderedOrders',N'bigint',1),
             (N'ShippedRevenue',N'decimal',1),
             (N'ShippedCogs',N'decimal',1),
             (N'ShippedUnits',N'bigint',1),
             (N'PageViews',N'bigint',1),
             (N'BrowserPageViews',N'bigint',1),
             (N'MobilePageViews',N'bigint',1),
             (N'Sessions',N'bigint',1),
             (N'BrowserSessions',N'bigint',1),
             (N'MobileAppSessions',N'bigint',1),
             (N'BuyBoxPercentage',N'decimal',1),
             (N'OrderedItemsSessionPercentage',N'decimal',1),
             (N'AverageOfferCount',N'decimal',1),
             (N'FeedbackReceived',N'bigint',1),
             (N'ReceivedNegativeFeedbackRate',N'decimal',1),
             (N'ClaimsGranted',N'bigint',1),
             (N'ClaimsAmount',N'decimal',1),
             (N'GrossProfit',N'decimal',1),
             (N'NetProfit',N'decimal',1),
             (N'Margin',N'decimal',1),
             (N'ProductPrice',N'decimal',1),
             (N'BestSellerRank',N'bigint',1),
             (N'AfnDaysOfSupply',N'decimal',1),
             (N'AfnQuantity',N'bigint',1),
             (N'MfnQuantity',N'bigint',1)
        ) expected(name,type_name,nullable_flag)
        LEFT JOIN sys.columns c ON c.object_id=OBJECT_ID(N'dbo.AdsProductDailyFacts') AND c.name=expected.name
        LEFT JOIN sys.types t ON t.user_type_id=c.user_type_id
        WHERE c.column_id IS NULL OR t.name<>expected.type_name OR CONVERT(int,c.is_nullable)<>expected.nullable_flag
          OR (expected.type_name='decimal' AND (c.precision<>28 OR c.scale<>10))
          OR (expected.type_name='varchar' AND c.max_length<>10)
          OR (expected.type_name='nvarchar' AND c.max_length<>510)
      ) THROW 51022,'Existing AdsProductDailyFacts source columns do not match v1',1;
      IF NOT EXISTS (
        SELECT 1 FROM sys.indexes i WHERE i.object_id=OBJECT_ID(N'dbo.AdsProductDailyFacts')
          AND i.is_primary_key=1 AND i.is_disabled=0 AND
          (SELECT COUNT(*) FROM sys.index_columns ic WHERE ic.object_id=i.object_id AND ic.index_id=i.index_id AND ic.key_ordinal>0)=5
          AND NOT EXISTS (SELECT 1 FROM (VALUES (1,N'SellerId'),(2,N'Marketplace'),(3,N'ReportType'),(4,N'Asin'),(5,N'Date')) k(n,name)
            WHERE NOT EXISTS (SELECT 1 FROM sys.index_columns ic JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
              WHERE ic.object_id=i.object_id AND ic.index_id=i.index_id AND ic.key_ordinal=k.n AND c.name=k.name))
      ) THROW 51023,'Existing AdsProductDailyFacts key does not match v1',1;
      COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
      IF XACT_STATE()<>0 ROLLBACK TRANSACTION;
      THROW;
    END CATCH;
  `);
}};
