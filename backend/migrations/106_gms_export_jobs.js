'use strict';
module.exports={up:async pool=>{
 await pool.request().batch(`
 SET XACT_ABORT ON;
 BEGIN TRY
 BEGIN TRANSACTION;
 DECLARE @lock int;
 EXEC @lock=sp_getapplock @Resource='retailops:gms-export-schema',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=30000;
 IF @lock<0 THROW 51071,'GMS export schema lock unavailable',1;
 IF OBJECT_ID(N'dbo.GmsExportJobs',N'U') IS NULL
 BEGIN
 CREATE TABLE dbo.GmsExportJobs(
 Id varchar(36) NOT NULL PRIMARY KEY,OwnerId varchar(50) NOT NULL,ClientId varchar(36) NOT NULL,
 Filters nvarchar(max) NOT NULL,AccessScope nvarchar(max) NOT NULL,Format varchar(4) NOT NULL,
 Status varchar(12) NOT NULL,Stage varchar(24) NOT NULL,AttemptCount int NOT NULL DEFAULT 0,
 CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),NextAttemptAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
 StartedAt datetime2(3) NULL,CompletedAt datetime2(3) NULL,ExpiresAt datetime2(3) NULL,
 LeaseToken varchar(36) NULL,LeaseUntil datetime2(3) NULL,ArtifactToken varchar(36) NULL,
 FileBytes bigint NULL,ArtifactSha256 varchar(64) NULL,ChunkCount int NULL,RawCount bigint NULL,EntityCount bigint NULL,ErrorCode varchar(64) NULL,
 CONSTRAINT UQ_GmsExportJobs_Client UNIQUE(OwnerId,ClientId),
 CONSTRAINT CK_GmsExportJobs_Status CHECK(Status IN ('QUEUED','PROCESSING','COMPLETED','FAILED','CANCELLED','EXPIRED')),
 CONSTRAINT CK_GmsExportJobs_Json CHECK(ISJSON(Filters)=1 AND ISJSON(AccessScope)=1),
 CONSTRAINT CK_GmsExportJobs_Format CHECK(Format IN ('xlsx','csv')),
 CONSTRAINT CK_GmsExportJobs_Attempts CHECK(AttemptCount BETWEEN 0 AND 3));
 CREATE INDEX IX_GmsExportJobs_Queue ON dbo.GmsExportJobs(Status,NextAttemptAt,LeaseUntil,CreatedAt);
 CREATE INDEX IX_GmsExportJobs_Owner ON dbo.GmsExportJobs(OwnerId,CreatedAt DESC,Id);
 END;
 IF OBJECT_ID(N'dbo.GmsExportChunks',N'U') IS NULL
 BEGIN
 CREATE TABLE dbo.GmsExportChunks(
 JobId varchar(36) NOT NULL,AttemptToken varchar(36) NOT NULL,ChunkNo int NOT NULL,
 Payload varbinary(max) NOT NULL,CreatedAt datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
 PRIMARY KEY(JobId,AttemptToken,ChunkNo),
 CONSTRAINT FK_GmsExportChunks_Job FOREIGN KEY(JobId) REFERENCES dbo.GmsExportJobs(Id) ON DELETE CASCADE,
 CONSTRAINT CK_GmsExportChunks_Size CHECK(ChunkNo>=1 AND DATALENGTH(Payload) BETWEEN 1 AND 1048576));
 CREATE INDEX IX_GmsExportChunks_Created ON dbo.GmsExportChunks(CreatedAt);
 END;
 COMMIT TRANSACTION;
 END TRY
 BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK TRANSACTION;
 THROW;
 END CATCH;
 `);
}};
