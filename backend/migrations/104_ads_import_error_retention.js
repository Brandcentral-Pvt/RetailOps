'use strict';
module.exports={up:async pool=>{
 await pool.request().batch(`
 SET XACT_ABORT ON;
 BEGIN TRY
 BEGIN TRANSACTION;
 DECLARE @lock int;
 EXEC @lock=sp_getapplock @Resource='retailops:ads-schema-104',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=30000;
 IF @lock<0 THROW 51057,'Ads error schema lock unavailable',1;
 IF OBJECT_ID(N'dbo.AdsImportJobOwners',N'U') IS NULL THROW 51058,'Ads ownership migration required',1;
 IF COL_LENGTH('dbo.AdsImportJobs','IssueToken') IS NULL ALTER TABLE dbo.AdsImportJobs ADD IssueToken varchar(36) NULL;
 IF COL_LENGTH('dbo.AdsImportJobs','ErrorReportPurgedAt') IS NULL ALTER TABLE dbo.AdsImportJobs ADD ErrorReportPurgedAt datetime2(3) NULL;
 IF OBJECT_ID(N'dbo.AdsImportIssueChunks',N'U') IS NULL
 BEGIN
  CREATE TABLE dbo.AdsImportIssueChunks(
   JobId varchar(50) NOT NULL,AttemptToken varchar(36) NOT NULL,ChunkNo int NOT NULL,
   IssueCount int NOT NULL,Payload varbinary(max) NOT NULL,CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
   PRIMARY KEY(JobId,AttemptToken,ChunkNo),
   CONSTRAINT FK_AdsIssueChunks_Job FOREIGN KEY(JobId) REFERENCES dbo.AdsImportJobs(Id) ON DELETE CASCADE,
   CONSTRAINT CK_AdsIssueChunks_Count CHECK(ChunkNo>0 AND IssueCount BETWEEN 1 AND 1000)
  );
  CREATE INDEX IX_AdsIssueChunks_CreatedAt ON dbo.AdsImportIssueChunks(CreatedAt);
 END;
 COMMIT TRANSACTION;
 END TRY
 BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK TRANSACTION;
 THROW;
 END CATCH;
 `);
}};
