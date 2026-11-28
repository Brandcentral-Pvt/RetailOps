'use strict';
// Cover the narrow interactive projection; full exports still use the fact table.
// No index removal, no fact changes. Apply through the numbered migration runner.
const {METRICS}=require('../services/adsCanonicalMetrics');
const includes=[...new Set(['Currency','AdvertisedSku',...Object.values(METRICS)])];
const keys=['Date','SellerId','Marketplace','Asin','ReportType'];
const required=[...keys,...includes];
const values=required.map(c=>"(N'"+c+"')").join(',');
const name='IX_AdsProductDaily_Date_ReportCover';
async function up(pool){
 await pool.request().batch(`
 SET XACT_ABORT ON;
 BEGIN TRY
 BEGIN TRANSACTION;
 DECLARE @lock int;
 EXEC @lock=sp_getapplock @Resource='retailops:ads-index-107',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=30000;
 IF @lock<0 THROW 51072,'Ads report index lock unavailable',1;
 DECLARE @fact int=OBJECT_ID(N'dbo.AdsProductDailyFacts',N'U');
 IF @fact IS NULL THROW 51073,'Canonical Ads facts missing',1;
 IF NOT EXISTS(
 SELECT 1 FROM sys.indexes i
 JOIN sys.index_columns k ON k.object_id=i.object_id AND k.index_id=i.index_id AND k.key_ordinal=1
 JOIN sys.columns c ON c.object_id=k.object_id AND c.column_id=k.column_id
 WHERE i.object_id=@fact AND i.type IN(1,2) AND i.is_disabled=0 AND i.is_hypothetical=0 AND i.has_filter=0 AND c.name=N'Date'
 AND (i.type=1 OR NOT EXISTS(SELECT 1 FROM (VALUES ${values}) required(name)
 WHERE NOT EXISTS(SELECT 1 FROM sys.index_columns ic JOIN sys.columns col ON col.object_id=ic.object_id AND col.column_id=ic.column_id
 WHERE ic.object_id=i.object_id AND col.name=required.name AND (ic.index_id=i.index_id OR (ic.index_id=1 AND ic.key_ordinal>0)))))
 )
 BEGIN
 IF EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=@fact AND name=N'${name}') THROW 51074,'Existing Ads covering index is incompatible; review before migration',1;
 CREATE INDEX ${name} ON dbo.AdsProductDailyFacts([Date],SellerId,Marketplace,Asin,ReportType) INCLUDE (${includes.map(c=>'['+c+']').join(',')});
 END;
 -- Catalog lookups retain duplicate detection. Only add a nonunique index
 -- when both existing key columns are bounded indexable character types.
 DECLARE @catalog int=OBJECT_ID(N'dbo.Asins',N'U');
 IF @catalog IS NOT NULL AND
 (SELECT COUNT(*) FROM sys.columns WHERE object_id=@catalog AND name IN(N'SellerId',N'AsinCode') AND system_type_id IN(167,175,231,239) AND max_length BETWEEN 1 AND 450)=2
 AND NOT EXISTS(
 SELECT 1 FROM sys.indexes i JOIN sys.index_columns k1 ON k1.object_id=i.object_id AND k1.index_id=i.index_id AND k1.key_ordinal=1
 JOIN sys.index_columns k2 ON k2.object_id=i.object_id AND k2.index_id=i.index_id AND k2.key_ordinal=2
 JOIN sys.columns c1 ON c1.object_id=k1.object_id AND c1.column_id=k1.column_id
 JOIN sys.columns c2 ON c2.object_id=k2.object_id AND c2.column_id=k2.column_id
 WHERE i.object_id=@catalog AND i.type IN(1,2) AND i.is_disabled=0 AND i.is_hypothetical=0 AND i.has_filter=0
 AND ((c1.name=N'SellerId' AND c2.name=N'AsinCode') OR (c1.name=N'AsinCode' AND c2.name=N'SellerId')))
 BEGIN
 IF EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=@catalog AND name=N'IX_Asins_AdsOwnerLookup') THROW 51075,'Existing catalog lookup index is incompatible',1;
 CREATE INDEX IX_Asins_AdsOwnerLookup ON dbo.Asins(SellerId,AsinCode);
 END;
 COMMIT TRANSACTION;
 END TRY
 BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK TRANSACTION;
 THROW;
 END CATCH;
 `);
}
module.exports={up,name,includes};
