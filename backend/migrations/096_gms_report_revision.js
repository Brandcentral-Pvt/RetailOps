// Transactional source revisions for bounded report caching. A rollback also
// rolls back its revision update. Separate rows avoid a single lock shared
// by unrelated fact, catalog and seller writers. No historical data changes.
const sources=[
  {name:'facts',table:'GmsDailyPerformance',trigger:'TR_GmsReportRevision_Facts'},
  {name:'catalog',table:'Asins',trigger:'TR_GmsReportRevision_Catalog',columns:['Id','AsinCode','SellerId','Title']},
  {name:'sellers',table:'Sellers',trigger:'TR_GmsReportRevision_Sellers',columns:['Id','Name']},
];
function triggerSql(source){
  const relevant=source.columns?.map(column=>'UPDATE(['+column+'])').join(' OR ');
  return 'CREATE OR ALTER TRIGGER dbo.'+source.trigger+' ON dbo.'+source.table+' AFTER INSERT, UPDATE, DELETE AS BEGIN '+
    'SET NOCOUNT ON; IF NOT EXISTS (SELECT 1 FROM inserted) AND NOT EXISTS (SELECT 1 FROM deleted) RETURN; '+
    (relevant?'IF EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted) AND NOT ('+relevant+') RETURN; ':'')+
    "UPDATE dbo.GmsReportRevision SET Revision=NEWID() WHERE SourceName=N'"+source.name+"'; END;";
}
module.exports={up:async pool=>{
  const ddl=sources.map(source=>"EXEC(N'"+triggerSql(source).replace(/'/g,"''")+"');").join('\n');
  await pool.request().query(
    "SET XACT_ABORT ON; BEGIN TRY BEGIN TRANSACTION; "+
    "DECLARE @lock int; EXEC @lock=sp_getapplock @Resource='retailops:gms-cache-revision-096',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=30000; "+
    "IF @lock<0 THROW 51009,'GMS report revision migration lock unavailable',1; "+
    "IF OBJECT_ID(N'dbo.GmsReportRevision',N'U') IS NULL CREATE TABLE dbo.GmsReportRevision(SourceName nvarchar(20) NOT NULL PRIMARY KEY,Revision uniqueidentifier NOT NULL); "+
    sources.map(s=>"IF NOT EXISTS(SELECT 1 FROM dbo.GmsReportRevision WHERE SourceName=N'"+s.name+"') INSERT INTO dbo.GmsReportRevision(SourceName,Revision) VALUES(N'"+s.name+"',NEWID());").join('\n')+
    ddl+
    // Reapplying the migration invalidates existing cached report blocks.
    "UPDATE dbo.GmsReportRevision SET Revision=NEWID(); COMMIT TRANSACTION; END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK TRANSACTION; THROW; END CATCH;"
  );
},sources};
