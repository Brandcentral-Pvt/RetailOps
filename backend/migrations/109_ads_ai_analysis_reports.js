'use strict';
// Additive immutable analysis snapshots. No changes to canonical facts.
module.exports={up:async pool=>pool.request().query(`
SET XACT_ABORT ON;
BEGIN TRY
 BEGIN TRANSACTION;
 DECLARE @lock int;
 EXEC @lock=sp_getapplock @Resource='retailops:ads-analyst-109',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=30000;
 IF @lock<0 THROW 51077,'Analyst schema lock unavailable',1;
 IF OBJECT_ID(N'dbo.AdsAiAnalysisReports',N'U') IS NULL
 BEGIN
 CREATE TABLE dbo.AdsAiAnalysisReports(
 Id varchar(36) NOT NULL PRIMARY KEY,
 OwnerId varchar(50) NOT NULL,
 SellerScope nvarchar(max) NOT NULL CHECK(ISJSON(SellerScope)=1),
 Filters nvarchar(max) NOT NULL CHECK(ISJSON(Filters)=1),
 Evidence nvarchar(max) NOT NULL CHECK(ISJSON(Evidence)=1),
 Analysis nvarchar(max) NOT NULL CHECK(ISJSON(Analysis)=1),
 Model nvarchar(160) NOT NULL,
 PromptVersion varchar(24) NOT NULL,
 CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME()
 );
 CREATE INDEX IX_AdsAiAnalysisReports_Owner ON dbo.AdsAiAnalysisReports(OwnerId,CreatedAt DESC,Id);
 END;
 COMMIT TRANSACTION;
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK TRANSACTION;
 THROW;
END CATCH;
`)};
