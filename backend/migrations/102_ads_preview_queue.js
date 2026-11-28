'use strict';
// Add background validation states without replacing historical jobs or facts.
module.exports={up:async pool=>{
 await pool.request().batch(`
 SET XACT_ABORT ON;
 BEGIN TRY
  BEGIN TRANSACTION;
  DECLARE @lock int;
  EXEC @lock=sp_getapplock @Resource='retailops:ads-schema-102',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=30000;
  IF @lock<0 THROW 51053,'Ads preview schema lock unavailable',1;
  IF OBJECT_ID(N'dbo.CK_AdsImportJobs_QueueState',N'C') IS NULL THROW 51054,'Ads commit queue migration required',1;
  IF COL_LENGTH('dbo.AdsImportJobs','ValidatedAt') IS NULL ALTER TABLE dbo.AdsImportJobs ADD ValidatedAt datetime2(3) NULL;
  IF COL_LENGTH('dbo.AdsImportJobs','ValidationAttempts') IS NULL ALTER TABLE dbo.AdsImportJobs ADD ValidationAttempts int NOT NULL CONSTRAINT DF_AdsImportJobs_ValidationAttempts DEFAULT(0);
  IF OBJECT_ID(N'dbo.CK_AdsImportJobs_PreviewAttempts',N'C') IS NULL
  BEGIN
   ALTER TABLE dbo.AdsImportJobs DROP CONSTRAINT CK_AdsImportJobs_Status, CK_AdsImportJobs_Payload, CK_AdsImportJobs_QueueState;
   EXEC(N'ALTER TABLE dbo.AdsImportJobs WITH CHECK ADD CONSTRAINT CK_AdsImportJobs_Status CHECK(Status IN (''PREVIEW_QUEUED'',''VALIDATING'',''READY'',''QUEUED'',''PROCESSING'',''REJECTED'',''COMPLETED'',''FAILED'',''CANCELLED'',''EXPIRED'')), CONSTRAINT CK_AdsImportJobs_Payload CHECK((Status IN (''PREVIEW_QUEUED'',''VALIDATING'',''READY'',''QUEUED'',''PROCESSING'') AND SourceBytes IS NOT NULL) OR (Status NOT IN (''PREVIEW_QUEUED'',''VALIDATING'',''READY'',''QUEUED'',''PROCESSING'') AND SourceBytes IS NULL)), CONSTRAINT CK_AdsImportJobs_QueueState CHECK(AttemptCount BETWEEN 0 AND 3 AND StagedRows>=0 AND ((Status IN (''PROCESSING'',''VALIDATING'') AND LeaseToken IS NOT NULL AND LeaseUntil IS NOT NULL) OR (Status NOT IN (''PROCESSING'',''VALIDATING'') AND LeaseToken IS NULL AND LeaseUntil IS NULL))), CONSTRAINT CK_AdsImportJobs_PreviewAttempts CHECK(ValidationAttempts BETWEEN 0 AND 3)');
  END;
  COMMIT TRANSACTION;
 END TRY
 BEGIN CATCH
  IF XACT_STATE()<>0 ROLLBACK TRANSACTION;
  THROW;
 END CATCH;
 `);
}};
