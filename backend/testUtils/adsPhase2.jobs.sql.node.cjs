'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {up:factMigration}=require('../migrations/098_ads_product_daily_facts');
const {up:jobMigration}=require('../migrations/099_ads_import_jobs');
const {up:queueMigration}=require('../migrations/101_ads_import_queue');
const {claimNext,refreshLease,processNext}=require('../services/adsImportWorker');
const {inspectAdsImportSchema,ensureAdsImportSchema}=require('../database/adsImportSchema');
const {HEADERS}=require('../services/adsProductContract');
const {createPreview,getJob,listJobs,cancelJob,confirmJob,getIssues,expireJobs}=require('../services/adsImportJobs');
const quote=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
const csv=rows=>Buffer.from(HEADERS.map(quote).join(',')+'\n'+rows.map(r=>HEADERS.map(h=>quote(r[h])).join(',')).join('\n')+'\n');
const row={asin:'B000000001',date:'2026-04-01','metrics.spend':'10.25','metrics.sales':'25.50','metrics.total_sales':'30.50'};
const user={Id:'u1',role:{Name:'brand_manager'},assignedSellers:['s1']};
test('SQL durable Ads job lifecycle, scope, atomic confirmation, retries and expiry',{skip:process.env.ADS_SQL_SMOKE!=='1',timeout:180000},async()=>{
 const sql=require(process.env.ADS_TEST_MSSQL_MODULE||'mssql');
 const config={server:'127.0.0.1',user:'sa',password:process.env.ADS_TEST_SQL_PASSWORD,options:{trustServerCertificate:true,encrypt:false}};
 let admin,pool;const database='AdsJobs_'+Date.now(),prior=process.env.ADS_CANONICAL_IMPORT_ENABLED;
 for(let i=0;i<40;i++){let c=new sql.ConnectionPool(config);try{admin=await c.connect();break;}catch{await c.close().catch(()=>{});await new Promise(r=>setTimeout(r,1000));}}
 assert.ok(admin);
 try{
  await admin.request().query('CREATE DATABASE ['+database+']');
  pool=await new sql.ConnectionPool({...config,database}).connect();
  await pool.request().query("CREATE TABLE dbo.Sellers(Id varchar(50) PRIMARY KEY,Marketplace nvarchar(50)); INSERT dbo.Sellers VALUES('s1','amazon.in'),('s2','amazon.in'); CREATE TABLE dbo.Asins(AsinCode nvarchar(30),SellerId varchar(50)); CREATE UNIQUE INDEX UX_Catalog ON dbo.Asins(AsinCode,SellerId); INSERT dbo.Asins VALUES('B000000001','s1'),('B000000001','s2'),('B000000002','s2');");
  await pool.request().query("CREATE TABLE dbo.Roles(Id varchar(50) PRIMARY KEY,Name nvarchar(50),DisplayName nvarchar(100),IsActive bit); INSERT dbo.Roles VALUES('r1','brand_manager','Brand manager',1); CREATE TABLE dbo.Users(Id varchar(50) PRIMARY KEY,RoleId varchar(50),IsActive bit,ExtraPermissions nvarchar(max),ExcludedPermissions nvarchar(max),ForcePasswordReset bit,PasswordExpiresAt datetime2,IsFirstLogin bit,SetupCompletedAt datetime2); INSERT dbo.Users VALUES('u1','r1',1,NULL,NULL,0,NULL,0,NULL); CREATE TABLE dbo.TestAdsGrants(OwnerId varchar(50),Permission nvarchar(100)); INSERT dbo.TestAdsGrants VALUES('u1','adsreport_import'); CREATE TABLE dbo.UserSellers(UserId varchar(50),SellerId varchar(50)); INSERT dbo.UserSellers VALUES('u1','s1');");
  await factMigration(pool);
  assert.equal((await ensureAdsImportSchema({pool,apply:false})).ready,false);
  assert.equal((await ensureAdsImportSchema({pool,apply:true})).ready,true);
  await jobMigration(pool);await queueMigration(pool);await queueMigration(pool);assert.equal((await inspectAdsImportSchema(pool)).ready,true);
  const ctx={pool,sql,user};
  // Real SQL permissions/assignments, injected profile resolver in this isolated fixture.
  const resolveProfile=async(owner,db)=>{
   const permissions=await db.request().input('owner',sql.VarChar(50),owner.Id).query('SELECT Permission FROM dbo.TestAdsGrants WHERE OwnerId=@owner;');
   const sellers=await db.request().input('owner',sql.VarChar(50),owner.Id).query('SELECT SellerId FROM dbo.UserSellers WHERE UserId=@owner;');
   return {role:{Name:owner.RoleName},permissions:permissions.recordset.map(r=>r.Permission),assignedSellers:sellers.recordset.map(r=>r.SellerId)};
  };
  const work=extra=>processNext({pool,sql,resolveProfile,...extra});
  const run=async id=>{const queued=await confirmJob({...ctx,id});assert.equal(queued.status,'QUEUED');assert.equal(await work(),true);return getJob({...ctx,id});};
  const preview=(rows,extra={})=>createPreview({...ctx,sellerId:'s1',input:csv(rows),fileName:'report.csv',...extra});
  const ready=await preview([{},row,{}]);assert.equal(ready.status,'READY');assert.equal(ready.summary.rows,1);assert.equal(ready.summary.skippedBlankRows,2);assert.equal(ready.summary.sourceRecords,3);assert.equal('SourceBytes' in ready,false);
  assert.equal((await listJobs(ctx)).total,1);
  assert.equal(await getJob({...ctx,id:ready.id,user:{...user,Id:'u2'}}),null);
  assert.equal(await getJob({...ctx,id:ready.id,user:{...user,assignedSellers:['s2']}}),null);
  await assert.rejects(()=>preview([row],{sellerId:'s2'}),{code:'forbidden_seller'});
  await assert.rejects(()=>confirmJob({...ctx,id:ready.id,user:{...user,Id:'u2'}}),{code:'job_not_found'});
  process.env.ADS_CANONICAL_IMPORT_ENABLED='false';
  await assert.rejects(()=>confirmJob({...ctx,id:ready.id}),{code:'ads_import_disabled'});
  const before=await pool.request().query('SELECT COUNT(*) AS n FROM dbo.AdsProductDailyFacts');assert.equal(before.recordset[0].n,0);
  delete process.env.ADS_CANONICAL_IMPORT_ENABLED;
  assert.equal((await getJob({...ctx,id:ready.id})).importsEnabled,true);
  const results=await Promise.all([confirmJob({...ctx,id:ready.id}),confirmJob({...ctx,id:ready.id})]);
  assert.ok(results.every(r=>r.status==='QUEUED'));
  assert.equal((await pool.request().query('SELECT COUNT(*) AS n FROM dbo.AdsProductDailyFacts')).recordset[0].n,0);
  const competing=await Promise.all([work(),work()]);assert.equal(competing.filter(Boolean).length,1);
  const done=await getJob({...ctx,id:ready.id});assert.equal(done.status,'COMPLETED');assert.equal(done.result.inserted,1);assert.equal(done.attemptCount,1);
  assert.equal((await confirmJob({...ctx,id:ready.id})).status,'COMPLETED');
  const stored=await pool.request().query("SELECT Status,DATALENGTH(SourceBytes) AS bytes FROM dbo.AdsImportJobs WHERE Id='"+ready.id+"'; SELECT COUNT(*) AS n FROM dbo.AdsProductDailyFacts;");
  assert.equal(stored.recordsets[0][0].bytes,null);assert.equal(stored.recordsets[1][0].n,1);
  const lineage=await pool.request().query("SELECT SourceRowNumber FROM dbo.AdsProductDailyFacts WHERE SellerId='s1'");assert.equal(lineage.recordset[0].SourceRowNumber,3);
  const replay=await preview([row]);const replayed=await run(replay.id);assert.equal(replayed.result.inserted,0);assert.equal(replayed.result.unchanged,1);
  const bad=await preview([{...row,'metrics.spend':'bad'}]);assert.equal(bad.status,'REJECTED');assert.equal(bad.summary.issueCount,1);
  const errors=await getIssues({...ctx,id:bad.id});assert.equal(errors.issues[0].asin,row.asin);assert.equal(errors.issues[0].row,2);
  await assert.rejects(()=>getIssues({...ctx,id:bad.id,user:{...user,Id:'u2'}}),{code:'job_not_found'});
  const foreign=await preview([{...row,asin:'B000000002'}]);assert.equal(foreign.status,'REJECTED');assert.equal(foreign.summary.invalidCatalogKeys,1);
  const malformed=await preview([],{input:Buffer.from('bad,header\n')});assert.equal(malformed.status,'REJECTED');assert.equal(malformed.summary.scanComplete,false);
  const cancel=await preview([{...row,date:'2026-04-02'}]);assert.equal((await cancelJob({...ctx,id:cancel.id})).status,'CANCELLED');
  await assert.rejects(()=>confirmJob({...ctx,id:cancel.id}),{code:'job_not_ready'});
  const expires=await preview([{...row,date:'2026-04-02'}]);
  await pool.request().input('id',sql.VarChar(50),expires.id).query("UPDATE dbo.AdsImportJobs SET ExpiresAt=DATEADD(second,-1,SYSUTCDATETIME()) WHERE Id=@id");
  await expireJobs(pool);assert.equal((await getJob({...ctx,id:expires.id})).status,'EXPIRED');
  const conflict=await preview([{...row,date:'2026-04-02'},{...row,'metrics.spend':'999'}]);
  const failed=await run(conflict.id);assert.equal(failed.status,'FAILED');assert.equal(failed.result.code,'historical_conflict');
  const facts=await pool.request().query("SELECT COUNT(*) AS n FROM dbo.AdsProductDailyFacts; SELECT COUNT(*) AS payloads FROM dbo.AdsImportJobs WHERE SourceBytes IS NOT NULL;");
  assert.equal(facts.recordsets[0][0].n,1);assert.equal(facts.recordsets[1][0].payloads,0);
  assert.equal((await listJobs({...ctx,user:{...user,assignedSellers:[]}})).total,0);
  const gaps=await preview([{...row,date:'2026-04-03'},{},{},{...row,date:'2026-04-04'}]);
  assert.equal(gaps.status,'READY');assert.equal(gaps.summary.validRows,2);assert.equal(gaps.summary.skippedBlankRows,2);
  const committed=await run(gaps.id);assert.equal(committed.status,'COMPLETED');assert.equal(committed.result.inserted,2);
  const gapFacts=await pool.request().query("SELECT SourceRowNumber FROM dbo.AdsProductDailyFacts WHERE SellerId='s1' AND [Date]>='2026-04-03' ORDER BY [Date]");
  assert.deepEqual(gapFacts.recordset.map(r=>r.SourceRowNumber),[2,5]);
  // A queued job survives a process restart. Expire a claimed lease without
  // executing its writer, then verify a new worker takes over and stale tokens fail.
  const recover=await preview([{...row,date:'2026-04-05'}]);await confirmJob({...ctx,id:recover.id});
  const firstClaim=await claimNext({pool,sql});assert.equal(firstClaim.Id,recover.id);
  assert.equal((await getJob({...ctx,id:recover.id})).status,'PROCESSING');
  await assert.rejects(()=>cancelJob({...ctx,id:recover.id}),{code:'job_not_ready'});
  await pool.request().input('id',sql.VarChar(50),recover.id).query("UPDATE dbo.AdsImportJobs SET LeaseUntil=DATEADD(second,-1,SYSUTCDATETIME()) WHERE Id=@id;");
  await assert.rejects(()=>refreshLease({pool,sql,job:firstClaim,stage:'staging',staged:1}),{code:'lease_lost'});
  assert.equal(await work(),true);
  const recovered=await getJob({...ctx,id:recover.id});assert.equal(recovered.status,'COMPLETED');assert.equal(recovered.attemptCount,2);
  const queuedCancel=await preview([{...row,date:'2026-04-06'}]);await confirmJob({...ctx,id:queuedCancel.id});
  assert.equal((await cancelJob({...ctx,id:queuedCancel.id})).status,'CANCELLED');assert.equal(await work(),false);
  // Revoked permission/assignment must fail before any facts enter the table.
  const revoked=await preview([{...row,date:'2026-04-07'}]);await confirmJob({...ctx,id:revoked.id});
  await pool.request().query("DELETE FROM dbo.TestAdsGrants WHERE OwnerId='u1';");
  await work();const denied=await getJob({...ctx,id:revoked.id});assert.equal(denied.status,'FAILED');assert.equal(denied.result.code,'access_changed');
  await pool.request().query("INSERT dbo.TestAdsGrants VALUES('u1','adsreport_import');");
  const reassigned=await preview([{...row,date:'2026-04-08'}]);await confirmJob({...ctx,id:reassigned.id});
  await pool.request().query("DELETE FROM dbo.UserSellers WHERE UserId='u1';");
  await work();assert.equal((await getJob({...ctx,id:reassigned.id})).status,'FAILED');
  await pool.request().query("INSERT dbo.UserSellers VALUES('u1','s1');");
  // Transient failures requeue and preserve payload until bounded retries.
  const retry=await preview([{...row,date:'2026-04-09'}]);await confirmJob({...ctx,id:retry.id});
  await work({writer:async()=>{throw Error('synthetic transient error');}});
  const pending=await getJob({...ctx,id:retry.id});assert.equal(pending.status,'QUEUED');assert.equal(pending.stage,'retry_wait');assert.equal(pending.attemptCount,1);
  await pool.request().input('id',sql.VarChar(50),retry.id).query("UPDATE dbo.AdsImportJobs SET NextAttemptAt=SYSUTCDATETIME() WHERE Id=@id;");
  await work();assert.equal((await getJob({...ctx,id:retry.id})).status,'COMPLETED');
  // A stale worker cannot publish a terminal completion after its lease is stolen.
  const fenced=await preview([{...row,date:'2026-04-10'}]);await confirmJob({...ctx,id:fenced.id});
  await work({writer:async args=>{
   const real=require('../services/adsCanonicalIngestion').ingestCanonicalReport;
   const complete=args.lifecycle.complete;
   args.lifecycle.complete=async(tx,result)=>{
    await pool.request().input('id',sql.VarChar(50),fenced.id).query("UPDATE dbo.AdsImportJobs SET LeaseUntil=DATEADD(second,-1,SYSUTCDATETIME()) WHERE Id=@id;");
    await complete(tx,result);
   };
   return real(args);
  }});
  const afterFence=await pool.request().query("SELECT COUNT(*) AS n FROM dbo.AdsProductDailyFacts WHERE [Date]='2026-04-10'");
  assert.equal(afterFence.recordset[0].n,0);
  await work();assert.equal((await getJob({...ctx,id:fenced.id})).status,'COMPLETED');

 }finally{if(prior===undefined)delete process.env.ADS_CANONICAL_IMPORT_ENABLED;else process.env.ADS_CANONICAL_IMPORT_ENABLED=prior;if(pool)await pool.close();await admin.request().query('ALTER DATABASE ['+database+'] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE ['+database+'];').catch(()=>{});await admin.close();}
});
