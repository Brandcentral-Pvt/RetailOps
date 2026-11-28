'use strict';
// Preserve all existing facts and history; expand the job lifecycle only.
module.exports={up:async pool=>{
 await pool.request().batch(`
 SET XACT_ABORT ON;
 BEGIN TRY
  BEGIN TRANSACTION;
  DECLARE @lock int;
  EXEC @lock=sp_getapplock @Resource='retailops:ads-schema-101',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=30000;
  IF @lock<0 THROW 51051,'Ads queue schema lock unavailable',1;
  IF OBJECT_ID(N'dbo.AdsImportJobs',N'U') IS NULL THROW 51052,'Ads import jobs missing',1;
  IF COL_LENGTH('dbo.AdsImportJobs','QueuedAt') IS NULL ALTER TABLE dbo.AdsImportJobs ADD QueuedAt datetime2(3) NULL;
  IF COL_LENGTH('dbo.AdsImportJobs','StartedAt') IS NULL ALTER TABLE dbo.AdsImportJobs ADD StartedAt datetime2(3) NULL;
  IF COL_LENGTH('dbo.AdsImportJobs','NextAttemptAt') IS NULL ALTER TABLE dbo.AdsImportJobs ADD NextAttemptAt datetime2(3) NULL;
  IF COL_LENGTH('dbo.AdsImportJobs','AttemptCount') IS NULL ALTER TABLE dbo.AdsImportJobs ADD AttemptCount int NOT NULL CONSTRAINT DF_AdsImportJobs_Attempts DEFAULT(0);
  IF COL_LENGTH('dbo.AdsImportJobs','LeaseToken') IS NULL ALTER TABLE dbo.AdsImportJobs ADD LeaseToken varchar(36) NULL;
  IF COL_LENGTH('dbo.AdsImportJobs','LeaseUntil') IS NULL ALTER TABLE dbo.AdsImportJobs ADD LeaseUntil datetime2(3) NULL;
  IF COL_LENGTH('dbo.AdsImportJobs','Stage') IS NULL ALTER TABLE dbo.AdsImportJobs ADD Stage varchar(32) NULL;
  IF COL_LENGTH('dbo.AdsImportJobs','StagedRows') IS NULL ALTER TABLE dbo.AdsImportJobs ADD StagedRows int NOT NULL CONSTRAINT DF_AdsImportJobs_Staged DEFAULT(0);
  IF OBJECT_ID(N'dbo.CK_AdsImportJobs_QueueState',N'C') IS NULL
  BEGIN
   ALTER TABLE dbo.AdsImportJobs DROP CONSTRAINT CK_AdsImportJobs_Status, CK_AdsImportJobs_Payload;
   EXEC(N'ALTER TABLE dbo.AdsImportJobs WITH CHECK ADD CONSTRAINT CK_AdsImportJobs_Status CHECK(Status IN (''READY'',''QUEUED'',''PROCESSING'',''REJECTED'',''COMPLETED'',''FAILED'',''CANCELLED'',''EXPIRED'')), CONSTRAINT CK_AdsImportJobs_Payload CHECK((Status IN (''READY'',''QUEUED'',''PROCESSING'') AND SourceBytes IS NOT NULL) OR (Status NOT IN (''READY'',''QUEUED'',''PROCESSING'') AND SourceBytes IS NULL)), CONSTRAINT CK_AdsImportJobs_QueueState CHECK(AttemptCount BETWEEN 0 AND 3 AND StagedRows>=0 AND ((Status=''PROCESSING'' AND LeaseToken IS NOT NULL AND LeaseUntil IS NOT NULL) OR (Status<>''PROCESSING'' AND LeaseToken IS NULL AND LeaseUntil IS NULL)))');
  END;
  IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.AdsImportJobs') AND name='IX_AdsImportJobs_Queue')
   EXEC(N'CREATE INDEX IX_AdsImportJobs_Queue ON dbo.AdsImportJobs(Status,NextAttemptAt,LeaseUntil,QueuedAt,Id)');
  COMMIT TRANSACTION;
 END TRY
 BEGIN CATCH
  IF XACT_STATE()<>0 ROLLBACK TRANSACTION;
  THROW;
 END CATCH;
 `);
}};
