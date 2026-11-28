-- Ads Intelligence Phase 0: read-only schema inventory and optional bounded data diagnostics.
-- Use an authorized read-only login, preferably staging/off-peak. No DDL or persistent DML.
-- Default is metadata only. Enter an internal seller ID and both dates to opt into data checks.
DECLARE @SellerId varchar(50) = NULL;
DECLARE @StartDate date = NULL;
DECLARE @EndDate date = NULL;
SET NOCOUNT ON;
SET LOCK_TIMEOUT 10000;

SELECT s.name AS schema_name, t.name AS table_name, c.column_id, c.name AS column_name,
       ty.name AS data_type, c.max_length, c.precision, c.scale, c.is_nullable,
       c.is_identity, c.is_computed, dc.definition AS default_definition
FROM sys.tables t
JOIN sys.schemas s ON s.schema_id=t.schema_id
JOIN sys.columns c ON c.object_id=t.object_id
JOIN sys.types ty ON ty.user_type_id=c.user_type_id
LEFT JOIN sys.default_constraints dc ON dc.object_id=c.default_object_id
WHERE s.name='dbo' AND t.name IN ('AdsPerformance','Asins','Sellers','GmsDailyPerformance')
ORDER BY t.name,c.column_id;

SELECT t.name AS table_name, i.name AS index_name, i.type_desc, i.is_unique,
       i.is_primary_key, i.is_disabled, i.has_filter, i.filter_definition,
       ic.key_ordinal, ic.is_included_column, ic.is_descending_key, c.name AS column_name
FROM sys.tables t
JOIN sys.schemas s ON s.schema_id=t.schema_id
JOIN sys.indexes i ON i.object_id=t.object_id
LEFT JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id
LEFT JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
WHERE s.name='dbo' AND t.name IN ('AdsPerformance','Asins','Sellers','GmsDailyPerformance')
ORDER BY t.name,i.index_id,ic.key_ordinal,ic.index_column_id;

SELECT OBJECT_NAME(parent_object_id) AS table_name, name, type_desc
FROM sys.objects
WHERE parent_object_id IN (OBJECT_ID('dbo.AdsPerformance'),OBJECT_ID('dbo.Asins'),
                           OBJECT_ID('dbo.Sellers'),OBJECT_ID('dbo.GmsDailyPerformance'))
AND type IN ('PK','UQ','F','C','D');

SELECT OBJECT_NAME(parent_id) AS table_name, name AS trigger_name, is_disabled
FROM sys.triggers
WHERE parent_id IN (OBJECT_ID('dbo.AdsPerformance'),OBJECT_ID('dbo.Asins'),
                    OBJECT_ID('dbo.GmsDailyPerformance'));

IF @SellerId IS NULL AND @StartDate IS NULL AND @EndDate IS NULL
BEGIN
    SELECT 'metadata_only' AS diagnostic_status;
    RETURN;
END;
IF NULLIF(LTRIM(RTRIM(@SellerId)),'') IS NULL OR @StartDate IS NULL OR @EndDate IS NULL
   OR @EndDate < @StartDate OR DATEDIFF(day,@StartDate,@EndDate)>30
BEGIN
    THROW 50001, 'Optional data checks require a seller and a valid 1-31 day range.', 1;
END;

-- Aggregate catalog ambiguity for the chosen seller; no ASIN values returned.
IF COL_LENGTH('dbo.Asins','AsinCode') IS NOT NULL AND COL_LENGTH('dbo.Asins','SellerId') IS NOT NULL
BEGIN
    EXEC sys.sp_executesql N'
      SELECT COUNT_BIG(*) AS shared_asin_keys
      FROM (SELECT DISTINCT a.AsinCode FROM dbo.Asins a
            WHERE a.SellerId=@seller AND EXISTS
                  (SELECT 1 FROM dbo.Asins b WHERE b.AsinCode=a.AsinCode AND b.SellerId<>a.SellerId)) x;
      SELECT COUNT_BIG(*) AS duplicate_catalog_keys
      FROM (SELECT AsinCode FROM dbo.Asins WHERE SellerId=@seller GROUP BY AsinCode HAVING COUNT_BIG(*)>1) x;',
      N'@seller varchar(50)',@seller=@SellerId;
END;

-- Do not derive fact ownership from the catalog. If SellerId is absent, stop here.
IF COL_LENGTH('dbo.AdsPerformance','SellerId') IS NULL
   OR COL_LENGTH('dbo.AdsPerformance','Asin') IS NULL
   OR COL_LENGTH('dbo.AdsPerformance','Date') IS NULL
   OR COL_LENGTH('dbo.AdsPerformance','ReportType') IS NULL
BEGIN
    SELECT 'seller_or_date_schema_unavailable; no fact data queried' AS diagnostic_status;
    RETURN;
END;

-- Count facts by explicit seller/type and report date, without printing identifiers or monetary values.
EXEC sys.sp_executesql N'
  SELECT ReportType, COUNT_BIG(*) AS fact_rows, COUNT(DISTINCT Asin) AS distinct_asins,
         COUNT(DISTINCT CAST([Date] AS date)) AS covered_dates
  FROM dbo.AdsPerformance
  WHERE SellerId=@seller AND [Date]>=@start AND [Date]<DATEADD(day,1,@end)
  GROUP BY ReportType;
  SELECT COUNT_BIG(*) AS duplicate_daily_keys
  FROM (SELECT Asin,CAST([Date] AS date) AS day_key FROM dbo.AdsPerformance
        WHERE SellerId=@seller AND ReportType=''daily'' AND [Date]>=@start AND [Date]<DATEADD(day,1,@end)
        GROUP BY Asin,CAST([Date] AS date) HAVING COUNT_BIG(*)>1) x;',
  N'@seller varchar(50),@start date,@end date',@seller=@SellerId,@start=@StartDate,@end=@EndDate;

-- Monthly rows are not necessarily date-keyed. Only check when a Month column exists.
IF COL_LENGTH('dbo.AdsPerformance','Month') IS NOT NULL
BEGIN
    EXEC sys.sp_executesql N'
      SELECT COUNT_BIG(*) AS monthly_rows,
             COALESCE(SUM(CONVERT(bigint,CASE WHEN [Date] IS NULL THEN 1 ELSE 0 END)),0) AS monthly_null_date_rows
      FROM dbo.AdsPerformance
      WHERE SellerId=@seller AND ReportType=''monthly''
        AND [Month]>=DATEFROMPARTS(YEAR(@start),MONTH(@start),1)
        AND [Month]<DATEADD(month,1,DATEFROMPARTS(YEAR(@end),MONTH(@end),1));',
      N'@seller varchar(50),@start date,@end date',@seller=@SellerId,@start=@StartDate,@end=@EndDate;
END;

-- Null versus populated/zero, and explicit-vs-derived reconciliation counters.
-- Only run when these extended columns exist; do not assume the bootstrap schema.
IF COL_LENGTH('dbo.AdsPerformance','AdSpend') IS NOT NULL
   AND COL_LENGTH('dbo.AdsPerformance','AdSales') IS NOT NULL
   AND COL_LENGTH('dbo.AdsPerformance','OrganicSales') IS NOT NULL
   AND COL_LENGTH('dbo.AdsPerformance','TotalSales') IS NOT NULL
BEGIN
    EXEC sys.sp_executesql N'
      SELECT COUNT_BIG(*) AS daily_rows,
             COUNT_BIG(AdSpend) AS populated_spend,
             COUNT_BIG(AdSales) AS populated_ad_sales,
             COUNT_BIG(TotalSales) AS populated_total_sales,
             COALESCE(SUM(CONVERT(bigint,CASE WHEN AdSpend=0 THEN 1 ELSE 0 END)),0) AS explicit_zero_spend_rows,
             COALESCE(SUM(CONVERT(bigint,CASE WHEN TotalSales<0 THEN 1 ELSE 0 END)),0) AS negative_total_sales_rows,
             COALESCE(SUM(CONVERT(bigint,CASE WHEN TotalSales IS NOT NULL AND AdSales IS NOT NULL
                  AND OrganicSales IS NOT NULL AND ABS(TotalSales-AdSales-OrganicSales)>0.01 THEN 1 ELSE 0 END)),0)
                  AS non_reconciling_rows
      FROM dbo.AdsPerformance
      WHERE SellerId=@seller AND ReportType=''daily'' AND [Date]>=@start AND [Date]<DATEADD(day,1,@end);',
      N'@seller varchar(50),@start date,@end date',@seller=@SellerId,@start=@StartDate,@end=@EndDate;
END;
-- Review actual source totals privately using a verified seller and compatible source semantics.
-- A zero already stored by the legacy importer cannot establish whether the source was blank.
