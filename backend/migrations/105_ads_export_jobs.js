'use strict';
module.exports={up:async pool=>{
 await pool.request().batch(`
 SET XACT_ABORT ON;
 BEGIN TRY
 BEGIN TRANSACTION;
 DECLARE @lock int;
 EXEC @lock=sp_getapplock @Resource='retailops:ads-export-schema',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=30000;
 IF @lock<0 THROW 51070,'Ads export schema lock unavailable',1;
 IF OBJECT_ID(N'dbo.AdsExportJobs',N'U') IS NULL
 BEGIN
 CREATE TABLE dbo.AdsExportJobs(
 Id varchar(36) NOT NULL PRIMARY KEY,OwnerId varchar(50) NOT NULL,ClientId varchar(36) NOT NULL,
 Filters nvarchar(max) NOT NULL,AccessScope nvarchar(max) NOT NULL,Format varchar(4) NOT NULL,
 Status varchar(12) NOT NULL,Stage varchar(24) NOT NULL,AttemptCount int NOT NULL DEFAULT 0,
 CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),NextAttemptAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
 StartedAt datetime2(3) NULL,CompletedAt datetime2(3) NULL,ExpiresAt datetime2(3) NULL,
 LeaseToken varchar(36) NULL,LeaseUntil datetime2(3) NULL,ArtifactToken varchar(36) NULL,
 FileBytes bigint NULL,ChunkCount int NULL,RawCount bigint NULL,EntityCount bigint NULL,ErrorCode varchar(64) NULL,
 CONSTRAINT UQ_AdsExportJobs_Client UNIQUE(OwnerId,ClientId),
 CONSTRAINT CK_AdsExportJobs_Status CHECK(Status IN ('QUEUED','PROCESSING','COMPLETED','FAILED','CANCELLED','EXPIRED')),
 CONSTRAINT CK_AdsExportJobs_Format CHECK(Format IN ('xlsx','csv')),
 CONSTRAINT CK_AdsExportJobs_Attempts CHECK(AttemptCount BETWEEN 0 AND 3));
 CREATE INDEX IX_AdsExportJobs_Queue ON dbo.AdsExportJobs(Status,NextAttemptAt,LeaseUntil,CreatedAt);
 CREATE INDEX IX_AdsExportJobs_Owner ON dbo.AdsExportJobs(OwnerId,CreatedAt DESC,Id);
 END;
 IF OBJECT_ID(N'dbo.AdsExportChunks',N'U') IS NULL
 BEGIN
 CREATE TABLE dbo.AdsExportChunks(
 JobId varchar(36) NOT NULL,AttemptToken varchar(36) NOT NULL,ChunkNo int NOT NULL,
 Payload varbinary(max) NOT NULL,CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
 PRIMARY KEY(JobId,AttemptToken,ChunkNo),
 CONSTRAINT FK_AdsExportChunks_Job FOREIGN KEY(JobId) REFERENCES dbo.AdsExportJobs(Id) ON DELETE CASCADE,
 CONSTRAINT CK_AdsExportChunks_Size CHECK(ChunkNo>=1 AND DATALENGTH(Payload) BETWEEN 1 AND 1048576));
 CREATE INDEX IX_AdsExportChunks_Created ON dbo.AdsExportChunks(CreatedAt);
 END;
 COMMIT TRANSACTION;
 END TRY
 BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK TRANSACTION;
 THROW;
 END CATCH;
 `);
}};
