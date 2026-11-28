'use strict';
// Additive staging/history. Never write or replace existing fact rows here.
module.exports={up:async pool=>{
 await pool.request().query(`
 SET XACT_ABORT ON;
 BEGIN TRY
  BEGIN TRANSACTION;
  DECLARE @lock int;
  EXEC @lock=sp_getapplock @Resource='retailops:ads-schema-099',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=30000;
  IF @lock<0 THROW 51040,'Ads import schema lock unavailable',1;
  IF OBJECT_ID(N'dbo.AdsProductDailyFacts',N'U') IS NULL THROW 51041,'Canonical Ads facts missing',1;
  IF OBJECT_ID(N'dbo.AdsImportJobs',N'U') IS NULL
  BEGIN
   CREATE TABLE dbo.AdsImportJobs(
    Id varchar(50) NOT NULL PRIMARY KEY,
    OwnerId varchar(50) NOT NULL,
    SellerId varchar(50) NOT NULL,
    Marketplace nvarchar(50) NOT NULL,
    Currency char(3) NOT NULL,
    FileName nvarchar(255) NOT NULL,
    SourceFileSha256 char(64) NOT NULL,
    SourceBytes varbinary(max) NULL,
    Status varchar(20) NOT NULL,
    SummaryJson nvarchar(max) NOT NULL,
    IssuesJson nvarchar(max) NOT NULL,
    ResultJson nvarchar(max) NULL,
    CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    ExpiresAt datetime2(3) NOT NULL,
    CompletedAt datetime2(3) NULL,
    CONSTRAINT CK_AdsImportJobs_Status CHECK(Status IN ('READY','REJECTED','COMPLETED','FAILED','CANCELLED','EXPIRED')),
    CONSTRAINT CK_AdsImportJobs_Payload CHECK((Status='READY' AND SourceBytes IS NOT NULL) OR (Status<>'READY' AND SourceBytes IS NULL)),
    CONSTRAINT FK_AdsImportJobs_Seller FOREIGN KEY(SellerId) REFERENCES dbo.Sellers(Id)
   );
   CREATE INDEX IX_AdsImportJobs_OwnerCreated ON dbo.AdsImportJobs(OwnerId,CreatedAt DESC,Id DESC);
   CREATE INDEX IX_AdsImportJobs_StatusExpires ON dbo.AdsImportJobs(Status,ExpiresAt);
  END;
  COMMIT TRANSACTION;
 END TRY
 BEGIN CATCH
  IF XACT_STATE()<>0 ROLLBACK TRANSACTION;
  THROW;
 END CATCH;
 `);
}};
