// Transactional source revisions for bounded report caching. A rollback also
// rolls back its revision update. Separate rows avoid a single lock shared
// by unrelated fact, catalog and seller writers. No historical data changes.
const sources=[
  {name:'facts',table:'AdsProductDailyFacts',trigger:'TR_AdsReportRevision_Facts'},
  {name:'catalog',table:'Asins',trigger:'TR_AdsReportRevision_Catalog'},
  {name:'sellers',table:'Sellers',trigger:'TR_AdsReportRevision_Sellers'},
];
function triggerSql(source){
  const relevant=source.columns?.map(column=>'UPDATE(['+column+'])').join(' OR ');
  const projection=source.columns?.map(column=>'CONVERT(varbinary(max),['+column+'])').join(',');
  return 'CREATE OR ALTER TRIGGER dbo.'+source.trigger+' ON dbo.'+source.table+' AFTER INSERT, UPDATE, DELETE AS BEGIN '+
    'SET NOCOUNT ON; IF NOT EXISTS (SELECT 1 FROM inserted) AND NOT EXISTS (SELECT 1 FROM deleted) RETURN; '+
    (relevant?'IF EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted) BEGIN '+
      'IF NOT ('+relevant+') RETURN; '+
      // Exact binary comparison ignores metadata updates that write the same
      // values, avoiding invalidation on unchanged title refreshes.
      'IF NOT EXISTS (SELECT '+projection+' FROM inserted EXCEPT SELECT '+projection+' FROM deleted) '+
      'AND NOT EXISTS (SELECT '+projection+' FROM deleted EXCEPT SELECT '+projection+' FROM inserted) RETURN; END; ':'')+
    "UPDATE dbo.AdsReportRevision SET Revision=NEWID() WHERE SourceName=N'"+source.name+"'; END;";
}
module.exports={up:async pool=>{
  const ddl=sources.map(source=>"EXEC(N'"+triggerSql(source).replace(/'/g,"''")+"'); ENABLE TRIGGER dbo."+source.trigger+" ON dbo."+source.table+";").join('\n');
  await pool.request().query(
    "SET XACT_ABORT ON; BEGIN TRY BEGIN TRANSACTION; "+
    "DECLARE @lock int; EXEC @lock=sp_getapplock @Resource='retailops:ads-cache-revision-108',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=30000; "+
    "IF @lock<0 THROW 51076,'Ads report revision migration lock unavailable',1; "+
    "IF OBJECT_ID(N'dbo.AdsReportRevision',N'U') IS NULL CREATE TABLE dbo.AdsReportRevision(SourceName nvarchar(20) NOT NULL PRIMARY KEY,Revision uniqueidentifier NOT NULL); "+
    sources.map(s=>"IF NOT EXISTS(SELECT 1 FROM dbo.AdsReportRevision WHERE SourceName=N'"+s.name+"') INSERT INTO dbo.AdsReportRevision(SourceName,Revision) VALUES(N'"+s.name+"',NEWID());").join('\n')+
    ddl+
    // Reapplying the migration invalidates existing cached report blocks.
    "UPDATE dbo.AdsReportRevision SET Revision=NEWID(); COMMIT TRANSACTION; END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK TRANSACTION; THROW; END CATCH;"
  );
},sources};
