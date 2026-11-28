'use strict';
// Existing explicit jobs retain their ownership. New uploads resolve catalog owners.
module.exports={up:async pool=>{
 await pool.request().batch(`
 SET XACT_ABORT ON;
 BEGIN TRY
 BEGIN TRANSACTION;
 DECLARE @lock int;
 EXEC @lock=sp_getapplock @Resource='retailops:ads-schema-103',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=30000;
 IF @lock<0 THROW 51055,'Ads ownership schema lock unavailable',1;
 IF OBJECT_ID(N'dbo.CK_AdsImportJobs_PreviewAttempts',N'C') IS NULL THROW 51056,'Ads preview queue migration required',1;
 IF COL_LENGTH('dbo.AdsImportJobs','OwnershipHash') IS NULL
 BEGIN
  ALTER TABLE dbo.AdsImportJobs DROP CONSTRAINT FK_AdsImportJobs_Seller;
  ALTER TABLE dbo.AdsImportJobs ALTER COLUMN SellerId varchar(50) NULL;
  ALTER TABLE dbo.AdsImportJobs ALTER COLUMN Marketplace nvarchar(50) NULL;
  ALTER TABLE dbo.AdsImportJobs ALTER COLUMN Currency char(3) NULL;
  ALTER TABLE dbo.AdsImportJobs WITH CHECK ADD CONSTRAINT FK_AdsImportJobs_Seller FOREIGN KEY(SellerId) REFERENCES dbo.Sellers(Id);
  ALTER TABLE dbo.AdsImportJobs ADD OwnershipHash char(64) NULL;
 END;
 IF OBJECT_ID(N'dbo.AdsImportJobOwners',N'U') IS NULL
 BEGIN
  CREATE TABLE dbo.AdsImportJobOwners(
   JobId varchar(50) NOT NULL,SellerId varchar(50) NOT NULL,
   Marketplace nvarchar(50) NOT NULL,Currency char(3) NOT NULL,
   AsinCount int NOT NULL,PRIMARY KEY(JobId,SellerId),
   CONSTRAINT FK_AdsJobOwners_Job FOREIGN KEY(JobId) REFERENCES dbo.AdsImportJobs(Id) ON DELETE CASCADE
  );
  CREATE INDEX IX_AdsJobOwners_Seller ON dbo.AdsImportJobOwners(SellerId,JobId);
 END;
 IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.AdsProductDailyFacts') AND name='IX_AdsProductDaily_AsinDateOwner')
  CREATE INDEX IX_AdsProductDaily_AsinDateOwner ON dbo.AdsProductDailyFacts(Asin,[Date],ReportType,SellerId,Marketplace) INCLUDE(Currency);
 COMMIT TRANSACTION;
 END TRY
 BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK TRANSACTION;
 THROW;
 END CATCH;
 `);
}};
