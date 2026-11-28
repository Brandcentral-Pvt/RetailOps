'use strict';
// Durable DB queue, short claims and lease fencing. No request-bound state.
// Never hold a job-row lock while staging, so status/progress reads remain live.
const {randomUUID}=require('node:crypto');
const {ingestCanonicalReport,AdsIngestionError}=require('./adsCanonicalIngestion');
const {AdsValidationError}=require('./adsProductContract');
const {explicitSeller,AdsScopeError}=require('./adsCanonicalScope');
const {importsEnabled}=require('./adsImportConfirmation');
const LEASE_SECONDS=180,MAX_ATTEMPTS=3;
const lost=()=>new AdsScopeError('lease_lost','Import lease no longer belongs to this worker.',409);
function bind(request,sql,job){
 return request.input('id',sql.VarChar(50),job.Id).input('token',sql.VarChar(36),job.LeaseToken);
}
const fence="Id=@id AND Status='PROCESSING' AND LeaseToken=@token AND LeaseUntil>SYSUTCDATETIME()";
async function claimNext({pool,sql}){
 if(!importsEnabled())return null;
 const token=randomUUID();
 const failure=JSON.stringify({code:'retry_exhausted',message:'Import interrupted repeatedly. Validate a new report.',persisted:false});
 const issues=JSON.stringify([{row:null,column:null,code:'retry_exhausted',message:'Import interrupted repeatedly. Validate a new report.'}]);
 // Reap only an expired lease. A fenced worker can no longer publish facts.
 // This is separate from the claim so a short SQL statement holds the locks.
 await pool.request().input('result',sql.NVarChar(sql.MAX),failure).input('issues',sql.NVarChar(sql.MAX),issues)
  .query("UPDATE dbo.AdsImportJobs SET Status='FAILED',Stage='failed',SourceBytes=NULL,LeaseToken=NULL,LeaseUntil=NULL,CompletedAt=SYSUTCDATETIME(),ResultJson=@result,IssuesJson=@issues WHERE Status='PROCESSING' AND LeaseUntil<=SYSUTCDATETIME() AND AttemptCount>=3;");
 const r=await pool.request().input('token',sql.VarChar(36),token).input('lease',sql.Int,LEASE_SECONDS)
  .query(";WITH candidate AS (SELECT TOP (1) * FROM dbo.AdsImportJobs WITH (UPDLOCK,READPAST,ROWLOCK,READCOMMITTEDLOCK) WHERE AttemptCount<3 AND ((Status='QUEUED' AND NextAttemptAt<=SYSUTCDATETIME()) OR (Status='PROCESSING' AND LeaseUntil<=SYSUTCDATETIME())) ORDER BY QueuedAt,Id) UPDATE candidate SET Status='PROCESSING',AttemptCount=AttemptCount+1,LeaseToken=@token,LeaseUntil=DATEADD(second,@lease,SYSUTCDATETIME()),StartedAt=SYSUTCDATETIME(),Stage='validating',StagedRows=0 OUTPUT inserted.Id,inserted.OwnerId,inserted.SellerId,inserted.Marketplace,inserted.Currency,inserted.SourceFileSha256,inserted.SourceBytes,inserted.LeaseToken,inserted.AttemptCount;");
 return r.recordset[0]||null;
}
async function refreshLease({pool,sql,job,stage,staged}){
 const req=bind(pool.request(),sql,job).input('lease',sql.Int,LEASE_SECONDS);
 let set='LeaseUntil=DATEADD(second,@lease,SYSUTCDATETIME())';
 if(stage!==undefined){req.input('stage',sql.VarChar(32),stage).input('staged',sql.Int,staged);set+=',Stage=@stage,StagedRows=@staged';}
 const r=await req.query('UPDATE dbo.AdsImportJobs SET '+set+' WHERE '+fence+'; SELECT @@ROWCOUNT AS changed;');
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
 const user={Id:owner.Id,...access};explicitSeller(user,job.SellerId);
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
 if(terminal){
  req.input('result',sql.NVarChar(sql.MAX),JSON.stringify({code,message,persisted:false,details:permanent?error.details||null:null}));
  req.input('issues',sql.NVarChar(sql.MAX),JSON.stringify([{row:error.row??null,column:error.column??null,code,message}]));
  await req.query("UPDATE dbo.AdsImportJobs SET Status='FAILED',Stage='failed',SourceBytes=NULL,LeaseToken=NULL,LeaseUntil=NULL,CompletedAt=SYSUTCDATETIME(),ResultJson=@result,IssuesJson=@issues WHERE "+fence);
 }else{
  const delay=pause?30:Math.min(120,15*2**(Number(job.AttemptCount)-1));
  req.input('delay',sql.Int,delay).input('pause',sql.Int,pause?1:0);
  await req.query("UPDATE dbo.AdsImportJobs SET Status='QUEUED',Stage='retry_wait',StagedRows=0,LeaseToken=NULL,LeaseUntil=NULL,AttemptCount=AttemptCount-@pause,NextAttemptAt=DATEADD(second,@delay,SYSUTCDATETIME()) WHERE "+fence);
 }
}
async function processNext({pool,sql,resolveProfile,writer=ingestCanonicalReport}){
 const job=await claimNext({pool,sql});
 if(!job)return false;
 let heartbeat=null,inFlight=null;
 const refresh=(stage,staged)=>refreshLease({pool,sql,job,stage,staged});
 // Do not overlap heartbeat updates; progress writes are also token-fenced.
 const stop=()=>{if(heartbeat)clearInterval(heartbeat);heartbeat=null;};
 try{
  heartbeat=setInterval(()=>{
   if(inFlight)return;
   inFlight=refresh().catch(()=>{/* Final SQL fence remains authoritative. */}).finally(()=>{inFlight=null;});
  },20000);heartbeat.unref?.();
  const user=await authorize({db:pool,sql,job,resolveProfile});
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
    const output={sellerId:result.sellerId,marketplace:result.marketplace,currency:result.currency,inserted:result.inserted,unchanged:result.unchanged,sourceFileSha256:result.sourceFileSha256,startDate:result.report.startDate,endDate:result.report.endDate,totals:result.report.totals,persisted:true};
    const r=await bind(tx.request(),sql,job).input('result',sql.NVarChar(sql.MAX),JSON.stringify(output)).input('rows',sql.Int,result.report.validRows)
     .query("UPDATE dbo.AdsImportJobs SET Status='COMPLETED',Stage='completed',StagedRows=@rows,SourceBytes=NULL,LeaseToken=NULL,LeaseUntil=NULL,CompletedAt=SYSUTCDATETIME(),ResultJson=@result WHERE "+fence+"; SELECT @@ROWCOUNT AS changed;");
    if(Number(r.recordset[0].changed)!==1)throw lost();
   }
  };
  await writer({pool,sql,user,sellerId:job.SellerId,reportType:'daily',input:job.SourceBytes,expectedContext:{marketplace:job.Marketplace,currency:job.Currency},lifecycle});
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
 const tick=async()=>{
  try{await processNext({pool:await getPool(),sql,resolveProfile});}
  catch(e){console.error('[ads import worker]',e.code||e.name||'unknown');}
  finally{const timer=setTimeout(tick,3000);timer.unref?.();}
 };
 const timer=setTimeout(tick,1000);timer.unref?.();
}
module.exports={claimNext,refreshLease,processNext,startWorker,authorize,LEASE_SECONDS,MAX_ATTEMPTS};
