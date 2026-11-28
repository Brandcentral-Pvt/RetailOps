'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {up:factMigration}=require('../migrations/098_ads_product_daily_facts');
const {up:jobMigration}=require('../migrations/099_ads_import_jobs');
const {up:queueMigration}=require('../migrations/101_ads_import_queue');
const {up:previewMigration}=require('../migrations/102_ads_preview_queue');
const {up:ownershipMigration}=require('../migrations/103_ads_auto_ownership');
const {up:errorMigration}=require('../migrations/104_ads_import_error_retention');
const {sweepRetainedErrors}=require('../services/adsImportIssueChunks');
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
  await jobMigration(pool);await queueMigration(pool);
  // Existing history survives the additive upgrade, including legacy terminal states.
  await pool.request().query("INSERT dbo.AdsImportJobs(Id,OwnerId,SellerId,Marketplace,Currency,FileName,SourceFileSha256,Status,SummaryJson,IssuesJson,ExpiresAt) VALUES('old-history','u1','s1','amazon.in','INR','old.csv',REPLICATE('a',64),'CANCELLED',N'{}',N'[]',SYSUTCDATETIME());");
  assert.equal((await inspectAdsImportSchema(pool)).ready,false);
  assert.equal((await ensureAdsImportSchema({pool,apply:true})).ready,true);
  await jobMigration(pool);await queueMigration(pool);await previewMigration(pool);await previewMigration(pool);await ownershipMigration(pool);await errorMigration(pool);await errorMigration(pool);
  assert.equal((await inspectAdsImportSchema(pool)).ready,true);
  assert.equal((await pool.request().query("SELECT Status FROM dbo.AdsImportJobs WHERE Id='old-history';")).recordset[0].Status,'CANCELLED');
  await pool.request().query("DELETE dbo.AdsImportJobs WHERE Id='old-history';");
  const ctx={pool,sql,user};
  // Real SQL permissions/assignments, injected profile resolver in this isolated fixture.
  const resolveProfile=async(owner,db)=>{
   const permissions=await db.request().input('owner',sql.VarChar(50),owner.Id).query('SELECT Permission FROM dbo.TestAdsGrants WHERE OwnerId=@owner;');
   const sellers=await db.request().input('owner',sql.VarChar(50),owner.Id).query('SELECT SellerId FROM dbo.UserSellers WHERE UserId=@owner;');
   return {role:{Name:owner.RoleName},permissions:permissions.recordset.map(r=>r.Permission),assignedSellers:sellers.recordset.map(r=>r.SellerId)};
  };
  const work=extra=>processNext({pool,sql,resolveProfile,...extra});
  const run=async id=>{const queued=await confirmJob({...ctx,id});assert.equal(queued.status,'QUEUED');assert.equal(await work(),true);return getJob({...ctx,id});};
  const enqueue=(rows,extra={})=>createPreview({...ctx,sellerId:'s1',input:csv(rows),fileName:'report.csv',...extra});
  const validateNext=extra=>work({kind:'preview',...extra});
  const preview=async(rows,extra={})=>{
   const job=await enqueue(rows,extra);
   assert.equal(job.status,'PREVIEW_QUEUED');assert.equal(job.summary.valid,null);
   assert.equal(await validateNext(),true);
   return getJob({...ctx,id:job.id});
  };
  process.env.ADS_CANONICAL_IMPORT_ENABLED='false';
  const queuedPreview=await enqueue([{},row,{}],{fileName:'April-report.csv'});
  assert.equal(queuedPreview.status,'PREVIEW_QUEUED');assert.equal(queuedPreview.summary.valid,null);
  assert.equal((await listJobs({...ctx,status:'PREVIEW_QUEUED',search:'April-',sellerId:'s1'})).total,1);
  assert.equal((await listJobs({...ctx,search:'%'})).total,0);
  await assert.rejects(()=>listJobs({...ctx,status:'invalid'}),{code:'invalid_history_status'});
  await assert.rejects(()=>listJobs({...ctx,sellerId:'s2'}),{code:'forbidden_seller'});
  await assert.rejects(()=>confirmJob({...ctx,id:queuedPreview.id}),{code:'job_not_ready'});
  const previewClaims=await Promise.all([validateNext(),validateNext()]);
  assert.equal(previewClaims.filter(Boolean).length,1);
  const ready=await getJob({...ctx,id:queuedPreview.id});
  assert.equal(ready.validationAttempts,1);assert.equal(ready.attemptCount,0);assert.ok(ready.validatedAt);
  assert.equal(ready.importsEnabled,false);assert.equal(ready.status,'READY');assert.equal(ready.summary.rows,1);assert.equal(ready.summary.skippedBlankRows,2);assert.equal(ready.summary.sourceRecords,3);assert.equal('SourceBytes' in ready,false);
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
  const waitingCommit=await preview([{...row,date:'2026-04-08'}]);await confirmJob({...ctx,id:waitingCommit.id});
  const firstClaim=await claimNext({pool,sql});assert.equal(firstClaim.Id,recover.id);
  assert.equal(await claimNext({pool,sql}),null);
  assert.equal((await getJob({...ctx,id:waitingCommit.id})).status,'QUEUED');
  await cancelJob({...ctx,id:waitingCommit.id});
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
  await pool.request().input('id',sql.VarChar(50),retry.id).query("UPDATE dbo.AdsImportJobs SET NextAttemptAt=DATEADD(second,-1,SYSUTCDATETIME()) WHERE Id=@id;");
  assert.equal(await work(),true,'due retry should be claimed');assert.equal((await getJob({...ctx,id:retry.id})).status,'COMPLETED');
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
  const previewCancel=await enqueue([{...row,date:'2026-04-11'}]);
  assert.equal((await cancelJob({...ctx,id:previewCancel.id})).status,'CANCELLED');assert.equal(await validateNext(),false);
  const previewRecovery=await enqueue([{...row,date:'2026-04-12'}]);
  const abandoned=await claimNext({pool,sql,kind:'preview'});assert.equal(abandoned.Id,previewRecovery.id);
  assert.equal((await getJob({...ctx,id:previewRecovery.id})).status,'VALIDATING');
  await assert.rejects(()=>cancelJob({...ctx,id:previewRecovery.id}),{code:'job_not_ready'});
  await pool.request().input('id',sql.VarChar(50),previewRecovery.id).query("UPDATE dbo.AdsImportJobs SET LeaseUntil=DATEADD(second,-1,SYSUTCDATETIME()) WHERE Id=@id;");
  await assert.rejects(()=>refreshLease({pool,sql,job:abandoned,stage:'preview_scanning',staged:1}),{code:'lease_lost'});
  await validateNext();const recoveredPreview=await getJob({...ctx,id:previewRecovery.id});
  assert.equal(recoveredPreview.status,'READY');assert.equal(recoveredPreview.validationAttempts,2);assert.equal(recoveredPreview.attemptCount,0);
  await cancelJob({...ctx,id:previewRecovery.id});
  const deniedPreview=await enqueue([{...row,date:'2026-04-13'}]);
  await pool.request().query("DELETE dbo.TestAdsGrants WHERE OwnerId='u1';");
  await validateNext();assert.equal((await getJob({...ctx,id:deniedPreview.id})).status,'FAILED');
  await pool.request().query("INSERT dbo.TestAdsGrants VALUES('u1','adsreport_import');");
  const retryPreview=await enqueue([{...row,date:'2026-04-14'}]);
  await validateNext({parser:async()=>{throw Error('test parser interruption');}});
  assert.equal((await getJob({...ctx,id:retryPreview.id})).status,'PREVIEW_QUEUED');
  await pool.request().input('id',sql.VarChar(50),retryPreview.id).query("UPDATE dbo.AdsImportJobs SET NextAttemptAt=DATEADD(second,-1,SYSUTCDATETIME()) WHERE Id=@id;");
  await validateNext();assert.equal((await getJob({...ctx,id:retryPreview.id})).validationAttempts,2);
  await cancelJob({...ctx,id:retryPreview.id});
  const readyOnly=await listJobs({...ctx,status:'READY'});assert.equal(readyOnly.total,0);
  const leaks=await pool.request().query("SELECT COUNT(*) AS n FROM dbo.AdsProductDailyFacts WHERE [Date]>='2026-04-11';");
  assert.equal(leaks.recordset[0].n,0);
  // New public mode resolves owners globally and commits all sellers atomically.
  await pool.request().query("INSERT dbo.Asins VALUES('B000000003','s1'),('B000000004','s2'); INSERT dbo.UserSellers VALUES('u1','s2');");
  const multi={...ctx,user:{...user,assignedSellers:['s1','s2']}};
  const auto=async(rows,actor=multi)=>{
   const q=await createPreview({...actor,input:csv(rows),fileName:'auto.csv'});assert.equal(q.sellerId,null);assert.equal(q.status,'PREVIEW_QUEUED');
   await validateNext();return getJob({...actor,id:q.id});
  };
  const rowsAuto=[{...row,asin:'B000000003',date:'2026-05-01'},{...row,asin:'B000000004',date:'2026-05-01'}];
  const mixed=await auto(rowsAuto);assert.equal(mixed.status,'READY');assert.equal(mixed.summary.sellerBreakdown.length,2);assert.equal(mixed.currency,'INR');
  assert.equal(await getJob({...ctx,id:mixed.id}),null);assert.equal((await listJobs({...multi,sellerId:'s2',status:'READY'})).total,1);
  await confirmJob({...multi,id:mixed.id});await work();const all=await getJob({...multi,id:mixed.id});
  assert.equal(all.status,'COMPLETED');assert.equal(all.result.inserted,2);assert.equal(all.result.sellerBreakdown.length,2);assert.equal(all.result.sellerId,null);
  const storedAuto=await pool.request().query("SELECT SellerId,SourceRowNumber,CONVERT(varchar(80),AdSpend) AS spend FROM dbo.AdsProductDailyFacts WHERE [Date]='2026-05-01' ORDER BY SellerId");
  assert.deepEqual(storedAuto.recordset.map(r=>[r.SellerId,r.SourceRowNumber,Number(r.spend)]),[['s1',2,10.25],['s2',3,10.25]]);
  const again=await auto(rowsAuto);await confirmJob({...multi,id:again.id});await work();assert.equal((await getJob({...multi,id:again.id})).result.unchanged,2);
  const ambiguous=await auto([{...row,date:'2026-05-02'}]);assert.equal(ambiguous.status,'REJECTED');assert.equal(ambiguous.summary.issues[0].code,'catalog_mapping_ambiguous');
  const missing=await auto([{...row,asin:'B000000099'}]);assert.equal(missing.status,'REJECTED');assert.equal(missing.summary.issues[0].code,'catalog_mapping_missing');
  await pool.request().query("DELETE FROM dbo.UserSellers WHERE SellerId='s2';");
  const foreignAuto=await auto([{...row,asin:'B000000004'}],ctx);assert.equal(foreignAuto.status,'REJECTED');assert.equal(foreignAuto.summary.issues[0].code,'catalog_mapping_forbidden');
  await pool.request().query("INSERT dbo.UserSellers VALUES('u1','s2');");
  const changed=await auto(rowsAuto.map(r=>({...r,date:'2026-05-02'})));await confirmJob({...multi,id:changed.id});
  await pool.request().query("UPDATE dbo.Asins SET SellerId='s2' WHERE AsinCode='B000000003';");await work();
  assert.equal((await getJob({...multi,id:changed.id})).result.code,'ownership_changed');
  assert.equal((await pool.request().query("SELECT COUNT(*) AS n FROM dbo.AdsProductDailyFacts WHERE [Date]='2026-05-02'")).recordset[0].n,0);
  await pool.request().query("UPDATE dbo.Asins SET SellerId='s1' WHERE AsinCode='B000000003';");
  const conflictAuto=await auto([{...rowsAuto[0],date:'2026-05-03'},{...rowsAuto[1],'metrics.spend':'999'}]);await confirmJob({...multi,id:conflictAuto.id});await work();
  assert.equal((await getJob({...multi,id:conflictAuto.id})).status,'FAILED');
  assert.equal((await pool.request().query("SELECT COUNT(*) AS n FROM dbo.AdsProductDailyFacts WHERE [Date]='2026-05-03'")).recordset[0].n,0);
  // Full error reports exceed the previous retention cap without keeping the
  // entire issue array in the job payload or leaking partial failed attempts.
  const many=await auto(Array.from({length:10025},()=>({...row,'metrics.spend':'bad'})));
  assert.equal(many.status,'REJECTED');assert.equal(many.summary.issueCount,10025);
  assert.equal(many.summary.storedIssueCount,10025);assert.equal(many.summary.issues.length,100);assert.equal(many.summary.issueReportTruncated,false);
  const manyReport=await getIssues({...multi,id:many.id});assert.equal(manyReport.issueCount,10025);assert.equal(manyReport.issues.length,100);
  let errorCount=0,lastRow;
  for await(const e of manyReport.iterateIssues()){errorCount++;lastRow=e.row;}
  assert.equal(errorCount,10025);assert.equal(lastRow,10026);
  const retained=await pool.request().input('id',sql.VarChar(50),many.id).query("SELECT COUNT(*) AS chunks,SUM(IssueCount) AS issues FROM dbo.AdsImportIssueChunks WHERE JobId=@id;");
  assert.equal(retained.recordset[0].chunks,11);assert.equal(retained.recordset[0].issues,10025);
  await pool.request().input('id',sql.VarChar(50),many.id).query("UPDATE dbo.AdsImportJobs SET CompletedAt=DATEADD(day,-91,SYSUTCDATETIME()) WHERE Id=@id; UPDATE dbo.AdsImportIssueChunks SET CreatedAt=DATEADD(day,-91,SYSUTCDATETIME()) WHERE JobId=@id;");
  await sweepRetainedErrors(pool);
  const purged=await getJob({...multi,id:many.id});assert.equal(purged.errorReportExpired,true);assert.equal(purged.summary.issueCount,10025);
  await assert.rejects(()=>getIssues({...multi,id:many.id}),{code:'issue_report_expired'});
  assert.equal((await pool.request().input('id',sql.VarChar(50),many.id).query("SELECT COUNT(*) AS n FROM dbo.AdsImportIssueChunks WHERE JobId=@id;")).recordset[0].n,0);
  // Unconfirmed uploads can expire; confirmed queued jobs must never expire
  // merely because their original preview window has elapsed.
  const originalContext=process.env.ADS_SELLER_CONTEXT_JSON;
  try{
   await pool.request().query("UPDATE dbo.Sellers SET Marketplace='amazon.com' WHERE Id='s2';");
   process.env.ADS_SELLER_CONTEXT_JSON=JSON.stringify({s2:{catalogMarketplace:'amazon.com',marketplace:'amazon.com',currency:'USD'}});
   const mixedCurrency=await auto(rowsAuto.map(r=>({...r,date:'2026-05-06'})));
   assert.equal(mixedCurrency.status,'REJECTED');assert.equal(mixedCurrency.summary.issues.at(-1).code,'mixed_currency_report');
   assert.equal(mixedCurrency.summary.totals,null);
  }finally{
   await pool.request().query("UPDATE dbo.Sellers SET Marketplace='amazon.in' WHERE Id='s2';");
   if(originalContext===undefined)delete process.env.ADS_SELLER_CONTEXT_JSON;else process.env.ADS_SELLER_CONTEXT_JSON=originalContext;
  }
  const waiting=await createPreview({...multi,input:csv(rowsAuto),fileName:'waiting.csv'});
  await pool.request().input('id',sql.VarChar(50),waiting.id).query("UPDATE dbo.AdsImportJobs SET ExpiresAt=DATEADD(second,-1,SYSUTCDATETIME()) WHERE Id=@id;");
  await expireJobs(pool);assert.equal((await getJob({...multi,id:waiting.id})).status,'EXPIRED');assert.equal(await validateNext(),false);
  // Historical facts cannot be silently moved to a newly mapped seller.
  await pool.request().query("UPDATE dbo.Asins SET SellerId='s2' WHERE AsinCode='B000000003';");
  const transfer=await auto([rowsAuto[0]]);await confirmJob({...multi,id:transfer.id});await work();
  assert.equal((await getJob({...multi,id:transfer.id})).result.code,'historical_owner_conflict');
  await pool.request().query("UPDATE dbo.Asins SET SellerId='s1' WHERE AsinCode='B000000003';");

 }finally{if(prior===undefined)delete process.env.ADS_CANONICAL_IMPORT_ENABLED;else process.env.ADS_CANONICAL_IMPORT_ENABLED=prior;if(pool)await pool.close();await admin.request().query('ALTER DATABASE ['+database+'] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE ['+database+'];').catch(()=>{});await admin.close();}
});
