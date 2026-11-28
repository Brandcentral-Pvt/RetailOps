'use strict';
// Durable DB queue, short claims and lease fencing. No request-bound state.
// Never hold a job-row lock while staging, so status/progress reads remain live.
const {randomUUID}=require('node:crypto');
const {ingestCanonicalReport,AdsIngestionError}=require('./adsCanonicalIngestion');
const {AdsValidationError}=require('./adsProductContract');
const {explicitSeller,resolveContext,AdsScopeError}=require('./adsCanonicalScope');
const {resolveOwners}=require('./adsOwnership');
const {parseInWorker}=require('./adsPreviewParser');
const {issueSink}=require('./adsImportIssueChunks');
const {importsEnabled}=require('./adsImportConfirmation');
const LEASE_SECONDS=180,MAX_ATTEMPTS=3;
const lost=()=>new AdsScopeError('lease_lost','Import lease no longer belongs to this worker.',409);
function bind(request,sql,job){
 return request.input('id',sql.VarChar(50),job.Id).input('token',sql.VarChar(36),job.LeaseToken);
}
const kindOf=job=>job.QueueKind==='preview'?'preview':'commit';
const statusFor=kind=>kind==='preview'?{queued:'PREVIEW_QUEUED',active:'VALIDATING',stage:'preview_scanning'}:{queued:'QUEUED',active:'PROCESSING',stage:'validating'};
const fence=job=>"Id=@id AND Status='"+statusFor(kindOf(job)).active+"' AND LeaseToken=@token AND LeaseUntil>SYSUTCDATETIME()";
async function claimNext({pool,sql,kind='commit'}){
 if(!['preview','commit'].includes(kind))throw Error('Invalid Ads queue kind');
 if(kind==='commit'&&!importsEnabled())return null;
 const states=statusFor(kind);
 const previewExpiry=kind==='preview'?" AND ExpiresAt>SYSUTCDATETIME()":'';
 const token=randomUUID();
 const failure=JSON.stringify({code:'retry_exhausted',message:'Import interrupted repeatedly. Validate a new report.',persisted:false});
 const issues=JSON.stringify([{row:null,column:null,code:'retry_exhausted',message:'Import interrupted repeatedly. Validate a new report.'}]);
 // A pooled SQL connection may retain SERIALIZABLE isolation from a prior
 // writer. Explicitly start a short READ COMMITTED transaction, serialize
 // claims across replicas, and avoid isolation-dependent READPAST hints.
 const tx=new sql.Transaction(pool);
 await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
 try{
  const locked=await tx.request().query("DECLARE @lock int; EXEC @lock=sp_getapplock @Resource='retailops:ads-queue-claim',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=0; SELECT @lock AS acquired;");
  if(Number(locked.recordset[0].acquired)<0){await tx.rollback();return null;}
  await tx.request().input('result',sql.NVarChar(sql.MAX),failure).input('issues',sql.NVarChar(sql.MAX),issues)
   .query("UPDATE dbo.AdsImportJobs SET Status='FAILED',Stage='failed',SourceBytes=NULL,LeaseToken=NULL,LeaseUntil=NULL,CompletedAt=SYSUTCDATETIME(),ResultJson=@result,IssuesJson=@issues,IssueToken=NULL WHERE Status='"+states.active+"' AND LeaseUntil<=SYSUTCDATETIME() AND AttemptCount>=3;");
  if(kind==='preview')await tx.request().query("UPDATE dbo.AdsImportJobs SET Status='EXPIRED',Stage='expired',SourceBytes=NULL,NextAttemptAt=NULL,CompletedAt=SYSUTCDATETIME() WHERE Status='PREVIEW_QUEUED' AND ExpiresAt<=SYSUTCDATETIME();");
  // One active lease per queue kind across replicas, not merely per process.
  const active=await tx.request().query("SELECT COUNT_BIG(*) AS n FROM dbo.AdsImportJobs WHERE Status='"+states.active+"' AND LeaseUntil>SYSUTCDATETIME();");
  if(Number(active.recordset[0].n)>=1){await tx.commit();return null;}
  const r=await tx.request().input('token',sql.VarChar(36),token).input('lease',sql.Int,LEASE_SECONDS)
   .query(";WITH candidate AS (SELECT TOP (1) * FROM dbo.AdsImportJobs WITH (UPDLOCK,HOLDLOCK) WHERE AttemptCount<3 AND ((Status='"+states.queued+"' AND NextAttemptAt<=SYSUTCDATETIME()"+previewExpiry+") OR (Status='"+states.active+"' AND LeaseUntil<=SYSUTCDATETIME())) ORDER BY QueuedAt,Id) UPDATE candidate SET Status='"+states.active+"',AttemptCount=AttemptCount+1,LeaseToken=@token,LeaseUntil=DATEADD(second,@lease,SYSUTCDATETIME()),StartedAt=SYSUTCDATETIME(),Stage='"+states.stage+"',StagedRows=0 OUTPUT inserted.Id,inserted.OwnerId,inserted.SellerId,inserted.Marketplace,inserted.Currency,inserted.SourceFileSha256,inserted.OwnershipHash,inserted.SourceBytes,inserted.LeaseToken,inserted.AttemptCount;");
  await tx.commit();
  return r.recordset[0]?{...r.recordset[0],QueueKind:kind}:null;
 }catch(error){try{await tx.rollback();}catch{}throw error;}
}
async function refreshLease({pool,sql,job,stage,staged}){
 const req=bind(pool.request(),sql,job).input('lease',sql.Int,LEASE_SECONDS);
 let set='LeaseUntil=DATEADD(second,@lease,SYSUTCDATETIME())';
 if(stage!==undefined){req.input('stage',sql.VarChar(32),stage).input('staged',sql.Int,staged);set+=',Stage=@stage,StagedRows=@staged';}
 const r=await req.query('UPDATE dbo.AdsImportJobs SET '+set+' WHERE '+fence(job)+'; SELECT @@ROWCOUNT AS changed;');
 if(Number(r.recordset[0].changed)!==1)throw lost();
}
async function authorize({db,sql,job,resolveProfile}){
 // Re-resolve current account state, role grants, overrides and assignments.
 const r=await db.request().input('owner',sql.VarChar(50),job.OwnerId).query(
  'SELECT U.Id,U.RoleId,U.IsActive,U.ExtraPermissions,U.ExcludedPermissions,U.ForcePasswordReset,U.PasswordExpiresAt,U.IsFirstLogin,U.SetupCompletedAt,R.Name AS RoleName,R.DisplayName AS RoleDisplayName,R.IsActive AS RoleActive FROM dbo.Users U LEFT JOIN dbo.Roles R ON R.Id=U.RoleId WHERE U.Id=@owner;');
 const owner=r.recordset[0];
 if(!owner?.IsActive||!owner.RoleActive||owner.ForcePasswordReset||(owner.PasswordExpiresAt&&new Date(owner.PasswordExpiresAt)<new Date())||(owner.IsFirstLogin&&!owner.SetupCompletedAt))throw new AdsScopeError('access_changed','Import owner is inactive or requires account maintenance.',403);
 const access=await resolveProfile(owner,db);
 if(!access.permissions.includes('*')&&!access.permissions.includes('adsreport_import'))throw new AdsScopeError('access_changed','Import permission has changed.',403);
 const user={Id:owner.Id,...access};
 if(job.SellerId!=null)explicitSeller(user,job.SellerId);
 else if(kindOf(job)==='commit'){
  const mapped=await db.request().input('id',sql.VarChar(50),job.Id).query('SELECT SellerId FROM dbo.AdsImportJobOwners WHERE JobId=@id;');
  if(!mapped.recordset.length||!job.OwnershipHash)throw new AdsScopeError('access_changed','Automatic seller mapping is unavailable.',403);
  for(const r of mapped.recordset)explicitSeller(user,r.SellerId);
 }
 return user;
}
async function recordFailure({pool,sql,job,error}){
 // SQL connection errors can occur after COMMIT. Never overwrite completion
 // or a newer lease. Re-read through the conditional update, not a blind write.
 if(error?.code==='lease_lost')return;
 const pause=error?.code==='ads_import_disabled';
 const permanent=!pause&&(error instanceof AdsIngestionError||error instanceof AdsValidationError||error instanceof AdsScopeError);
 const terminal=permanent||(!pause&&Number(job.AttemptCount)>=MAX_ATTEMPTS);
 const code=permanent?error.code:'retry_exhausted';
 const message=permanent?error.message:'Import interrupted repeatedly. Validate a new report.';
 const req=bind(pool.request(),sql,job);
 if(!permanent&&!pause){
  const cause=error?.cause||error;
  // Do not log source rows, SQL values, account names or arbitrary errors.
  const safeCode=typeof cause?.code==='string'&&/^[A-Z0-9_]{1,40}$/.test(cause.code)?cause.code:'UNCLASSIFIED';
  console.warn('[ads import retry]',{kind:kindOf(job),attempt:Number(job.AttemptCount),code:safeCode,sqlNumber:Number.isInteger(cause?.number)?cause.number:null});
 }
 if(terminal){
  req.input('result',sql.NVarChar(sql.MAX),JSON.stringify({code,message,persisted:false,details:permanent?error.details||null:null}));
  req.input('issues',sql.NVarChar(sql.MAX),JSON.stringify([{row:error.row??null,column:error.column??null,code,message}]));
  await req.query("UPDATE dbo.AdsImportJobs SET Status='FAILED',Stage='failed',SourceBytes=NULL,LeaseToken=NULL,LeaseUntil=NULL,CompletedAt=SYSUTCDATETIME(),ResultJson=@result,IssuesJson=@issues,IssueToken=NULL WHERE "+fence(job));
 }else{
  const delay=pause?30:Math.min(120,15*2**(Number(job.AttemptCount)-1));
  req.input('delay',sql.Int,delay).input('pause',sql.Int,pause?1:0);
  await req.query("UPDATE dbo.AdsImportJobs SET Status='"+statusFor(kindOf(job)).queued+"',Stage='retry_wait',StagedRows=0,LeaseToken=NULL,LeaseUntil=NULL,AttemptCount=AttemptCount-@pause,NextAttemptAt=DATEADD(second,@delay,SYSUTCDATETIME()) WHERE "+fence(job));
 }
}
async function processNext({pool,sql,resolveProfile,writer=ingestCanonicalReport,kind='commit',parser=parseInWorker}){
 const job=await claimNext({pool,sql,kind});
 if(!job)return false;
 let heartbeat=null,inFlight=null,previewScanning=false,scanned=0;
 const refresh=(stage,staged)=>refreshLease({pool,sql,job,stage,staged});
 // Do not overlap heartbeat updates; progress writes are also token-fenced.
 const stop=()=>{if(heartbeat)clearInterval(heartbeat);heartbeat=null;};
 try{
  heartbeat=setInterval(()=>{
   if(inFlight)return;
   inFlight=(previewScanning?refresh('preview_scanning',scanned):refresh()).catch(()=>{/* Final SQL fence remains authoritative. */}).finally(()=>{inFlight=null;});
  },20000);heartbeat.unref?.();
  const user=await authorize({db:pool,sql,job,resolveProfile});
  if(kind==='preview'){
   // CPU work happens on a separate Node thread. Heartbeats and status reads
   // remain responsive. Store actual scanned counts, never a guessed percent.
   previewScanning=true;
   const sink=issueSink({pool,sql,job});
   const parsed=await parser(job.SourceBytes,{onProgress:rows=>{scanned=rows;},onIssueBatch:issues=>sink.append(issues)});
   if(sink.count!==parsed.issueCount)throw Error('Stored parser issue count mismatch');
   previewScanning=false;
   if(inFlight)await inFlight;
   if(parsed.sourceFileSha256!==job.SourceFileSha256)throw new AdsIngestionError('job_source_changed','Staged source hash changed.');
   // Final catalog validation is lease-fenced. Stop heartbeat writes before
   // the final transaction acquires job/chunk locks; refresh the full lease.
   stop();if(inFlight)await inFlight;
   await refresh('preview_catalog',parsed.summary.rows??scanned);
   const tx=new sql.Transaction(pool);
   await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
   try{
    const currentUser=await authorize({db:tx,sql,job,resolveProfile});
    if(job.SellerId!=null){
    const seller=(await tx.request().input('seller',sql.VarChar(50),job.SellerId).query('SELECT Id,Marketplace FROM dbo.Sellers WHERE Id=@seller;')).recordset[0];
    const context=seller?resolveContext(seller):null;
    if(!context||context.marketplace!==job.Marketplace||context.currency!==job.Currency)throw new AdsIngestionError('seller_context_changed','Seller marketplace or currency changed after upload. Validate again.');
    }
    const issues=parsed.issues,summary=parsed.summary;
    let ownership=null;
    let count=parsed.issueCount,pending=[];
    const addIssue=i=>{count++;if(issues.length<100)issues.push(i);pending.push(i);};
    const flushIssues=async()=>{if(pending.length){await sink.append(pending,tx);pending=[];}};
    if(summary.valid&&job.SellerId==null){
     ownership=await resolveOwners({db:tx,sql,user:currentUser,keys:parsed.keys,onIssue:addIssue,onChunk:flushIssues});
     summary.invalidCatalogKeys=ownership.invalid;
     if(!ownership.invalid){summary.sellerBreakdown=ownership.owners;summary.currency=ownership.currency;summary.marketplace=ownership.marketplace;}
     else {summary.totals=null;summary.currency=null;summary.marketplace=null;}
    }else if(summary.valid){
     const keys=new Map(parsed.keys.map(r=>[r.asin,r]));
     const bad=await tx.request().input('seller',sql.VarChar(50),job.SellerId).input('keys',sql.NVarChar(sql.MAX),JSON.stringify([...keys.keys()]))
      .query("SELECT k.[asin],COUNT_BIG(a.AsinCode) AS matches FROM OPENJSON(@keys) WITH ([asin] varchar(10) '$') k LEFT JOIN dbo.Asins a ON a.AsinCode=k.[asin] AND a.SellerId=@seller GROUP BY k.[asin] HAVING COUNT_BIG(a.AsinCode)<>1 ORDER BY k.[asin];");
     summary.invalidCatalogKeys=bad.recordset.length;
     for(const r of bad.recordset){
      addIssue({...keys.get(r.asin),column:'asin',code:Number(r.matches)===0?'catalog_mapping_missing':'catalog_mapping_ambiguous',message:Number(r.matches)===0?'This ASIN is not mapped to the selected seller. Verify the catalog assignment.':'This ASIN has multiple catalog mappings under the selected seller. Resolve the duplicate assignment.'});
      if(pending.length>=1000)await flushIssues();
     }
    }
    await flushIssues();
    if(sink.count!==count)throw Error('Stored validation issue count mismatch');
    const final={...summary,valid:summary.valid&&count===0,issueCount:count,issues:issues.slice(0,100),issuesTruncated:count>100,storedIssueCount:count,issueReportTruncated:false};
    const status=final.valid?'READY':'REJECTED';
    stop();
    if(status==='READY'&&ownership){
     await tx.request().input('id',sql.VarChar(50),job.Id).input('owners',sql.NVarChar(sql.MAX),JSON.stringify(ownership.owners))
      .query("INSERT dbo.AdsImportJobOwners(JobId,SellerId,Marketplace,Currency,AsinCount) SELECT @id,sellerId,marketplace,currency,asinCount FROM OPENJSON(@owners) WITH (sellerId varchar(50),marketplace nvarchar(50),currency char(3),asinCount int);");
    }
    const r=await bind(tx.request(),sql,job).input('status',sql.VarChar(20),status).input('ownershipHash',sql.Char(64),status==='READY'?ownership?.hash||null:null).input('issueToken',sql.VarChar(36),count?job.LeaseToken:null).input('summary',sql.NVarChar(sql.MAX),JSON.stringify(final)).input('issues',sql.NVarChar(sql.MAX),JSON.stringify(issues))
     .query("UPDATE dbo.AdsImportJobs SET Status=@status,Stage=CASE WHEN @status='READY' THEN 'ready' ELSE 'rejected' END,SummaryJson=@summary,IssuesJson=@issues,IssueToken=@issueToken,OwnershipHash=@ownershipHash,SourceBytes=CASE WHEN @status='READY' THEN SourceBytes ELSE NULL END,ValidationAttempts=AttemptCount,AttemptCount=0,ValidatedAt=SYSUTCDATETIME(),ExpiresAt=DATEADD(hour,24,SYSUTCDATETIME()),CompletedAt=CASE WHEN @status='REJECTED' THEN SYSUTCDATETIME() ELSE NULL END,LeaseToken=NULL,LeaseUntil=NULL,NextAttemptAt=NULL,StagedRows=0 WHERE "+fence(job)+"; SELECT @@ROWCOUNT AS changed;");
    if(Number(r.recordset[0].changed)!==1)throw lost();
    await tx.commit();
   }catch(e){try{await tx.rollback();}catch{}throw e;}
   return true;
  }
  const lifecycle={
   progress:refresh,
   begin:async(_tx,report)=>{
    if(report.sourceFileSha256!==job.SourceFileSha256)throw new AdsIngestionError('job_source_changed','Staged source hash changed.');
    if(!importsEnabled())throw new AdsScopeError('ads_import_disabled','Import paused.',409);
   },
   complete:async(tx,result)=>{
    stop();
    // Authorization must still hold at commit; SERIALIZABLE reads protect
    // the user/role/seller rows until facts and terminal outcome commit.
    await authorize({db:tx,sql,job,resolveProfile});
    if(!importsEnabled())throw new AdsScopeError('ads_import_disabled','Import paused.',409);
    const output={sellerId:result.sellerId,sellerBreakdown:result.sellerBreakdown,marketplace:result.marketplace,currency:result.currency,inserted:result.inserted,unchanged:result.unchanged,sourceFileSha256:result.sourceFileSha256,startDate:result.report.startDate,endDate:result.report.endDate,totals:result.report.totals,persisted:true};
    const r=await bind(tx.request(),sql,job).input('result',sql.NVarChar(sql.MAX),JSON.stringify(output)).input('rows',sql.Int,result.report.validRows)
     .query("UPDATE dbo.AdsImportJobs SET Status='COMPLETED',Stage='completed',StagedRows=@rows,SourceBytes=NULL,LeaseToken=NULL,LeaseUntil=NULL,CompletedAt=SYSUTCDATETIME(),ResultJson=@result WHERE "+fence(job)+"; SELECT @@ROWCOUNT AS changed;");
    if(Number(r.recordset[0].changed)!==1)throw lost();
   }
  };
  await writer({pool,sql,user,sellerId:job.SellerId,reportType:'daily',input:job.SourceBytes,expectedContext:job.SellerId==null?null:{marketplace:job.Marketplace,currency:job.Currency},expectedOwnershipHash:job.OwnershipHash,lifecycle});
 }catch(error){
  stop();
  // The writer already rolled back (or the commit outcome is uncertain).
  // Only the active fenced lease may transition this job.
  await recordFailure({pool,sql,job,error});
 }finally{stop();if(inFlight)await inFlight;}
 return true;
}
let started=false;
function startWorker({getPool,sql,resolveProfile}){
 if(started)return;started=true;
 const tick=kind=>async()=>{
  try{await processNext({pool:await getPool(),sql,resolveProfile,kind});}
  catch(e){console.error('[ads import worker '+kind+']',e.code||e.name||'unknown');}
  finally{const timer=setTimeout(tick(kind),3000);timer.unref?.();}
 };
 for(const kind of ['preview','commit']){const timer=setTimeout(tick(kind),1000);timer.unref?.();}
}
module.exports={claimNext,refreshLease,processNext,startWorker,authorize,LEASE_SECONDS,MAX_ATTEMPTS};
