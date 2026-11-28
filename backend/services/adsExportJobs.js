'use strict';
const {randomUUID,createHash}=require('node:crypto');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {createReadStream}=require('node:fs');
const {parseReport,readCanonicalReport}=require('./adsCanonicalReport');
const {strictScope,AdsScopeError}=require('./adsCanonicalScope');
const {writeCompleteWorkbook}=require('./adsCompleteWorkbook');
const {writeDailyCsv}=require('./adsExportCsv');
const {verifyXlsx,checkFileEnvelope}=require('./exportFileIntegrity');
const {readBudgetIntelligence}=require('./adsBudgetIntelligence');
const {resolveAccessProfile}=require('./accessProfileService');
const LEASE=120,MAX_BYTES=512*1024*1024,CHUNK=1024*1024;
const err=(code,message,status=400)=>new AdsScopeError(code,message,status);
const uid=u=>String(u?.Id||u?.id||u?._id||'');
const idValid=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const permission=u=>['adsreport_view','adsreport_export'].every(p=>u.permissions?.includes('*')||u.permissions?.includes(p));
const publicJob=j=>({id:j.Id,format:j.Format,filters:JSON.parse(j.Filters),status:j.Status,stage:j.Stage,attemptCount:j.AttemptCount,createdAt:j.CreatedAt,startedAt:j.StartedAt,completedAt:j.CompletedAt,expiresAt:j.ExpiresAt,bytes:j.FileBytes==null?null:Number(j.FileBytes),rawCount:j.RawCount==null?null:Number(j.RawCount),entityCount:j.EntityCount==null?null:Number(j.EntityCount),errorCode:j.ErrorCode});
const cols='Id,OwnerId,ClientId,Filters,AccessScope,Format,Status,Stage,AttemptCount,CreatedAt,StartedAt,CompletedAt,ExpiresAt,FileBytes,ArtifactSha256,ChunkCount,RawCount,EntityCount,ErrorCode,ArtifactToken,LeaseToken,LeaseUntil';
function freezeScope(user,filters){
 const scope=parseReport(user,filters,true).scope;
 if(scope.empty)throw err('empty_scope','No authorized sellers match this export.',403);
 if(scope.sellerIds.length>1000)throw err('scope_too_large','Select up to 1,000 sellers.',422);
 return {global:scope.unrestricted,ids:scope.sellerIds};
}
function scopedFilters(user,filters,frozen){
 if(!permission(user))throw err('access_changed','Export permission is no longer available.',403);
 if(frozen.global){if(!strictScope(user).unrestricted)throw err('access_changed','Global export scope is no longer available.',403);return {...filters,sellerId:undefined};}
 if(!Array.isArray(frozen.ids)||!frozen.ids.length)throw err('access_changed','Invalid stored export scope.',403);
 strictScope(user,frozen.ids);
 return {...filters,sellerId:frozen.ids};
}
async function authorizeOwner(pool,sql,ownerId){
 const r=await pool.request().input('owner',sql.VarChar(50),ownerId).query('SELECT U.Id,U.RoleId,U.IsActive,U.ExtraPermissions,U.ExcludedPermissions,U.ForcePasswordReset,U.PasswordExpiresAt,U.IsFirstLogin,U.SetupCompletedAt,R.Name AS RoleName,R.DisplayName AS RoleDisplayName,R.IsActive AS RoleActive FROM dbo.Users U LEFT JOIN dbo.Roles R ON R.Id=U.RoleId WHERE U.Id=@owner;');
 const owner=r.recordset[0];
 if(!owner?.IsActive||!owner.RoleActive||owner.ForcePasswordReset||(owner.PasswordExpiresAt&&new Date(owner.PasswordExpiresAt)<new Date())||(owner.IsFirstLogin&&!owner.SetupCompletedAt))throw err('access_changed','Export owner is inactive or requires account maintenance.',403);
 const access=await resolveAccessProfile(owner,pool);
 const user={Id:owner.Id,...access};
 if(!permission(user))throw err('access_changed','Export permission is no longer available.',403);
 return user;
}
const lockSql="DECLARE @lock int; EXEC @lock=sp_getapplock @Resource='retailops:ads-export-queue',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000; SELECT @lock AS acquired;";
async function queueTx(pool,sql,fn){
 const tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
 try{const l=await tx.request().query(lockSql);if(Number(l.recordset[0].acquired)<0)throw err('queue_busy','Export queue is busy. Retry shortly.',503);const out=await fn(tx);await tx.commit();return out;}catch(e){try{await tx.rollback();}catch{}throw e;}
}
async function capacity(tx,sql,owner){
 const r=await tx.request().input('owner',sql.VarChar(50),owner).query("SELECT COUNT_BIG(*) AS total,COUNT_BIG(CASE WHEN OwnerId=@owner THEN 1 END) AS own FROM dbo.AdsExportJobs WHERE Status IN ('QUEUED','PROCESSING');");
 if(Number(r.recordset[0].total)>=50||Number(r.recordset[0].own)>=3)throw err('queue_full','Too many active exports. Cancel or finish an existing job.',429);
}
async function createJob({pool,sql,user,body}){
 const {clientId,format='xlsx',filters}=body||{};
 if(!uid(user)||!permission(user))throw err('access_changed','Export permission required.',403);
 if(!idValid(clientId)||!['xlsx','csv'].includes(format)||!filters||typeof filters!=='object'||Array.isArray(filters))throw err('invalid_export','Invalid export configuration.');
 if(Object.keys(body).some(k=>!['clientId','format','filters'].includes(k)))throw err('invalid_export','Unsupported export configuration.');
 const clean={...filters};delete clean.page;delete clean.limit;
 if(clean.entityKey)throw err('invalid_export','Export a report scope, not a drill-down.');
 const scope=freezeScope(user,clean),owner=uid(user);
 return queueTx(pool,sql,async tx=>{
  const existing=await tx.request().input('owner',sql.VarChar(50),owner).input('client',sql.VarChar(36),clientId).query('SELECT '+cols+' FROM dbo.AdsExportJobs WHERE OwnerId=@owner AND ClientId=@client;');
  if(existing.recordset[0]){
   const j=existing.recordset[0];scopedFilters(user,JSON.parse(j.Filters),JSON.parse(j.AccessScope));
   if(j.Format!==format||JSON.stringify(JSON.parse(j.Filters))!==JSON.stringify(clean))throw err('export_conflict','This request ID was already used for another export.',409);
   return publicJob(j);
  }
  await capacity(tx,sql,owner);
  const r=await tx.request().input('id',sql.VarChar(36),randomUUID()).input('owner',sql.VarChar(50),owner).input('client',sql.VarChar(36),clientId).input('filters',sql.NVarChar(sql.MAX),JSON.stringify(clean)).input('scope',sql.NVarChar(sql.MAX),JSON.stringify(scope)).input('format',sql.VarChar(4),format).query("INSERT dbo.AdsExportJobs(Id,OwnerId,ClientId,Filters,AccessScope,Format,Status,Stage) OUTPUT inserted.* VALUES(@id,@owner,@client,@filters,@scope,@format,'QUEUED','queued');");
  return publicJob(r.recordset[0]);
 });
}
async function ownJob(db,sql,user,id,lock=false){
 if(!idValid(id))throw err('export_not_found','Export not found.',404);
 const r=await db.request().input('id',sql.VarChar(36),id).input('owner',sql.VarChar(50),uid(user)).query('SELECT '+cols+' FROM dbo.AdsExportJobs'+(lock?' WITH (UPDLOCK,HOLDLOCK)':'')+' WHERE Id=@id AND OwnerId=@owner;');
 const j=r.recordset[0];if(!j)throw err('export_not_found','Export not found.',404);
 scopedFilters(user,JSON.parse(j.Filters),JSON.parse(j.AccessScope));return j;
}
async function getJob({pool,sql,user,id}){return publicJob(await ownJob(pool,sql,user,id));}
async function listJobs({pool,sql,user,page=1,limit=20,status}){
 page=Number(page);limit=Number(limit);
 if(!Number.isInteger(page)||page<1||page>10000||!Number.isInteger(limit)||limit<1||limit>50||status&&!['QUEUED','PROCESSING','COMPLETED','FAILED','CANCELLED','EXPIRED'].includes(status))throw err('invalid_export','Invalid export history filters.');
 // Return only jobs still within current access, including metadata. Scan a bounded recent history.
 const r=await pool.request().input('owner',sql.VarChar(50),uid(user)).query('SELECT TOP(1000) '+cols+' FROM dbo.AdsExportJobs WHERE OwnerId=@owner ORDER BY CreatedAt DESC,Id DESC;');
 const visible=r.recordset.filter(j=>{try{scopedFilters(user,JSON.parse(j.Filters),JSON.parse(j.AccessScope));return !status||j.Status===status;}catch{return false;}});
 return {rows:visible.slice((page-1)*limit,page*limit).map(publicJob),total:visible.length,page,limit,historyCapped:r.recordset.length===1000};
}
async function mutate({pool,sql,user,id,action}){
 return queueTx(pool,sql,async tx=>{
  const j=await ownJob(tx,sql,user,id,true);
  if(action==='retry'){
   if(j.Status!=='FAILED')throw err('invalid_export_state','Only failed exports can be retried.',409);
   await capacity(tx,sql,uid(user));
  }else if(!['QUEUED','PROCESSING'].includes(j.Status))throw err('invalid_export_state','Only active exports can be cancelled.',409);
  const set=action==='retry'?"Status='QUEUED',Stage='queued',AttemptCount=0,NextAttemptAt=SYSUTCDATETIME(),StartedAt=NULL,CompletedAt=NULL,ErrorCode=NULL":"Status='CANCELLED',Stage='cancelled',CompletedAt=SYSUTCDATETIME()";
  const r=await tx.request().input('id',sql.VarChar(36),id).query('UPDATE dbo.AdsExportJobs SET '+set+',LeaseToken=NULL,LeaseUntil=NULL OUTPUT inserted.* WHERE Id=@id;');
  return publicJob(r.recordset[0]);
 });
}
async function claimNext(pool,sql){
 return queueTx(pool,sql,async tx=>{
  await tx.request().query("UPDATE dbo.AdsExportJobs SET Status='FAILED',Stage='failed',ErrorCode='retry_exhausted',CompletedAt=SYSUTCDATETIME(),LeaseToken=NULL,LeaseUntil=NULL WHERE Status='PROCESSING' AND LeaseUntil<=SYSUTCDATETIME() AND AttemptCount>=3;");
  const r=await tx.request().input('token',sql.VarChar(36),randomUUID()).input('lease',sql.Int,LEASE).query("IF (SELECT COUNT(*) FROM dbo.AdsExportJobs WHERE Status='PROCESSING' AND LeaseUntil>SYSUTCDATETIME())<2 BEGIN ;WITH candidate AS (SELECT TOP(1) * FROM dbo.AdsExportJobs WITH(UPDLOCK,HOLDLOCK) WHERE AttemptCount<3 AND ((Status='QUEUED' AND NextAttemptAt<=SYSUTCDATETIME()) OR (Status='PROCESSING' AND LeaseUntil<=SYSUTCDATETIME())) ORDER BY CreatedAt,Id) UPDATE candidate SET Status='PROCESSING',Stage='generating',AttemptCount=AttemptCount+1,StartedAt=SYSUTCDATETIME(),LeaseToken=@token,LeaseUntil=DATEADD(second,@lease,SYSUTCDATETIME()) OUTPUT inserted.*; END");
  return r.recordset?.[0]||null;
 });
}
const leaseReq=(pool,sql,j)=>pool.request().input('id',sql.VarChar(36),j.Id).input('token',sql.VarChar(36),j.LeaseToken);
const leaseWhere="Id=@id AND Status='PROCESSING' AND LeaseToken=@token AND LeaseUntil>SYSUTCDATETIME()";
async function refreshLease(pool,sql,j){
 const r=await leaseReq(pool,sql,j).input('lease',sql.Int,LEASE).query('UPDATE dbo.AdsExportJobs SET LeaseUntil=DATEADD(second,@lease,SYSUTCDATETIME()) WHERE '+leaseWhere+';');
 return r.rowsAffected[0]===1;
}
async function processNext(pool,sql){
 const j=await claimNext(pool,sql);if(!j)return false;
 const controller=new AbortController(),signal=controller.signal;
 let dir,refreshing=false,heartbeat;
 const deadline=setTimeout(()=>controller.abort(),30*60*1000);deadline.unref?.();
 try{
  heartbeat=setInterval(async()=>{if(refreshing)return;refreshing=true;try{if(!await refreshLease(pool,sql,j))controller.abort();}catch{controller.abort();}finally{refreshing=false;}},20000);heartbeat.unref?.();
  const user=await authorizeOwner(pool,sql,j.OwnerId),filters=scopedFilters(user,JSON.parse(j.Filters),JSON.parse(j.AccessScope));
  dir=await fs.mkdtemp(path.join(os.tmpdir(),'retailops-ads-job-'));
  const filePath=path.join(dir,'report.'+j.Format);
  const writer=j.Format==='csv'?writeDailyCsv:writeCompleteWorkbook;
  let budgetInfo=null;
  if(j.Format==='xlsx'){
   if(filters.allHistory)budgetInfo={rows:[],reason:'Not applicable to unbounded history; choose a reporting window for seller-wide month budgets and targets.'};
   else if(filters.brand||filters.category||filters.search||filters.marketplace)budgetInfo={rows:[],reason:'Not applicable: seller-wide budget data cannot be attributed to catalog, marketplace or search filters.'};
   else{const query=Object.fromEntries(['sellerId','startDate','endDate','currency'].filter(k=>filters[k]!=null).map(k=>[k,filters[k]]));budgetInfo=await readBudgetIntelligence({pool,sql,user,query});}
  }
  const result=await readCanonicalReport({pool,sql,user,query:filters,signal,backgroundExport:true,advancedExport:j.Format==='xlsx',exportWorkbook:snapshot=>writer({filePath,...snapshot,filters,signal,advanced:j.Format==='xlsx',budgetInfo})});
  if(j.Format==='xlsx')await verifyXlsx(filePath,{expectedSheets:result.expectedSheets,signal});
  else await checkFileEnvelope(filePath,'csv');
  const stat=await fs.stat(filePath);if(!stat.size||stat.size>MAX_BYTES)throw err('artifact_too_large','Export artifact exceeds the 512 MiB storage limit.',422);
  await leaseReq(pool,sql,j).query("UPDATE dbo.AdsExportJobs SET Stage='storing' WHERE "+leaseWhere+";");
  let chunks=0,bytes=0;const hash=createHash('sha256');
  for await(const chunk of createReadStream(filePath,{highWaterMark:CHUNK})){
   if(signal.aborted)throw err('export_interrupted','Export interrupted.',408);
   const r=await leaseReq(pool,sql,j).input('chunk',sql.Int,++chunks).input('payload',sql.VarBinary(sql.MAX),chunk).query("INSERT dbo.AdsExportChunks(JobId,AttemptToken,ChunkNo,Payload) SELECT @id,@token,@chunk,@payload WHERE EXISTS(SELECT 1 FROM dbo.AdsExportJobs WHERE "+leaseWhere+");");
   if(r.rowsAffected[0]!==1)throw err('lease_lost','Export lease lost.',409);bytes+=chunk.length;hash.update(chunk);
  }
  if(bytes!==stat.size||signal.aborted)throw err('export_interrupted','Export interrupted.',408);
  const fresh=await authorizeOwner(pool,sql,j.OwnerId);scopedFilters(fresh,JSON.parse(j.Filters),JSON.parse(j.AccessScope));
  const published=await leaseReq(pool,sql,j).input('bytes',sql.BigInt,bytes).input('chunks',sql.Int,chunks).input('raw',sql.BigInt,result.rawCount).input('entities',sql.BigInt,result.entityCount).input('sha',sql.VarChar(64),hash.digest('hex')).query("UPDATE dbo.AdsExportJobs SET Status='COMPLETED',Stage='completed',ArtifactToken=@token,ArtifactSha256=@sha,FileBytes=@bytes,ChunkCount=@chunks,RawCount=@raw,EntityCount=@entities,CompletedAt=SYSUTCDATETIME(),ExpiresAt=DATEADD(day,7,SYSUTCDATETIME()),LeaseToken=NULL,LeaseUntil=NULL WHERE "+leaseWhere+";");
  if(published.rowsAffected[0]!==1)throw err('lease_lost','Export lease lost.',409);
 }catch(e){
  const permanent=e instanceof AdsScopeError&&[400,403,422].includes(e.status);
  const fail=permanent||j.AttemptCount>=3;
  await leaseReq(pool,sql,j).input('code',sql.VarChar(64),e instanceof AdsScopeError?e.code:'export_failed').input('backoff',sql.Int,30*Math.pow(2,j.AttemptCount-1)).query("UPDATE dbo.AdsExportJobs SET Status='"+(fail?'FAILED':'QUEUED')+"',Stage='"+(fail?'failed':'retry_wait')+"',ErrorCode=@code,NextAttemptAt=DATEADD(second,@backoff,SYSUTCDATETIME()),CompletedAt="+(fail?'SYSUTCDATETIME()':'NULL')+",LeaseToken=NULL,LeaseUntil=NULL WHERE "+leaseWhere+";");
  console.error('[ads export job]',j.Id,e.code||e.name);
 }finally{clearInterval(heartbeat);clearTimeout(deadline);if(dir)await fs.rm(dir,{recursive:true,force:true}).catch(()=>{});}
 return true;
}
async function sweep(pool){
 await pool.request().query("UPDATE TOP(100) dbo.AdsExportJobs SET Status='EXPIRED',Stage='expired',ArtifactToken=NULL WHERE Status='COMPLETED' AND ExpiresAt<=SYSUTCDATETIME();");
 await pool.request().query("DELETE TOP(200) c FROM dbo.AdsExportChunks c JOIN dbo.AdsExportJobs j ON j.Id=c.JobId WHERE c.CreatedAt<DATEADD(hour,-1,SYSUTCDATETIME()) AND (j.ArtifactToken IS NULL OR j.ArtifactToken<>c.AttemptToken) AND (j.LeaseToken IS NULL OR j.LeaseToken<>c.AttemptToken);");
}
async function spoolDownload({pool,sql,user,id,filePath}){
 const tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
 let handle;
 try{
  const j=await ownJob(tx,sql,user,id,true);
  if(j.Status!=='COMPLETED'||!j.ArtifactToken||!j.ExpiresAt||new Date(j.ExpiresAt)<=new Date())throw err('artifact_unavailable','Export is not available for download.',409);
  handle=await fs.open(filePath,'wx');let bytes=0;const hash=createHash('sha256');
  for(let i=1;i<=j.ChunkCount;i++){
   const r=await tx.request().input('id',sql.VarChar(36),id).input('token',sql.VarChar(36),j.ArtifactToken).input('chunk',sql.Int,i).query('SELECT Payload FROM dbo.AdsExportChunks WHERE JobId=@id AND AttemptToken=@token AND ChunkNo=@chunk;');
   const data=r.recordset[0]?.Payload;if(!Buffer.isBuffer(data)||!data.length)throw err('artifact_corrupt','Export artifact is incomplete.',503);
   await handle.writeFile(data);bytes+=data.length;hash.update(data);
  }
  if(bytes!==Number(j.FileBytes)||hash.digest('hex')!==j.ArtifactSha256)throw err('artifact_corrupt','Export artifact size mismatch.',503);
  await handle.close();handle=null;await tx.commit();return publicJob(j);
 }catch(e){try{await tx.rollback();}catch{}throw e;}finally{if(handle)await handle.close().catch(()=>{});}
}
async function ensureSchema(pool,apply){
 if(apply)await require('../migrations/105_ads_export_jobs').up(pool);
 const r=await pool.request().query("SELECT CASE WHEN OBJECT_ID(N'dbo.AdsExportJobs',N'U') IS NOT NULL AND OBJECT_ID(N'dbo.AdsExportChunks',N'U') IS NOT NULL THEN 1 ELSE 0 END AS ready;");
 return Boolean(r.recordset[0]?.ready);
}
let started=false;
function startWorker(getPool){
 if(started)return;started=true;
 const {sql}=require('../database/db');
 let busy=false,lastSweep=0;
 const tick=async()=>{if(busy)return;busy=true;try{const pool=await getPool();if(Date.now()-lastSweep>60000){await sweep(pool);lastSweep=Date.now();}await processNext(pool,sql);}catch(e){console.error('[ads export worker]',e.code||e.name);}finally{busy=false;}};
 const timer=setInterval(tick,3000);timer.unref?.();void tick();
}
module.exports={createJob,getJob,listJobs,mutate,claimNext,refreshLease,processNext,sweep,spoolDownload,ensureSchema,startWorker,freezeScope,scopedFilters};
