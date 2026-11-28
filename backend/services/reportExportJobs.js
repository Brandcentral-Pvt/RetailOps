'use strict';
const {randomUUID,createHash}=require('node:crypto');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {createReadStream}=require('node:fs');
const {strictScope,AdsScopeError}=require('./adsCanonicalScope');
const {verifyXlsx,checkFileEnvelope}=require('./exportFileIntegrity');
const {resolveAccessProfile}=require('./accessProfileService');
const err=(code,message,status=400)=>new AdsScopeError(code,message,status);
function createReportExportJobs({kind,permission,freezeScope,scopedFilters,validateFilters,generate,migration}){
 if(!['ads','gms'].includes(kind))throw Error('Unsupported report queue');
 const table=kind==='ads'?'dbo.AdsExportJobs':'dbo.GmsExportJobs';
 const chunksTable=kind==='ads'?'dbo.AdsExportChunks':'dbo.GmsExportChunks';
const MAX_ACTIVE=kind==='ads'?1:2;
const LEASE=120,MAX_BYTES=512*1024*1024,CHUNK=1024*1024;
const configuredRetention=Number(process.env[kind.toUpperCase()+'_EXPORT_RETENTION_DAYS']||7);
const RETENTION_DAYS=Number.isInteger(configuredRetention)&&configuredRetention>=1&&configuredRetention<=30?configuredRetention:7;
const uid=u=>String(u?.Id||u?.id||u?._id||'');
const idValid=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const publicJob=j=>({kind,id:j.Id,format:j.Format,filters:JSON.parse(j.Filters),sellerScope:JSON.parse(j.AccessScope),status:j.Status,stage:j.Stage,attemptCount:j.AttemptCount,createdAt:j.CreatedAt,startedAt:j.StartedAt,completedAt:j.CompletedAt,expiresAt:j.ExpiresAt,bytes:j.FileBytes==null?null:Number(j.FileBytes),rawCount:j.RawCount==null?null:Number(j.RawCount),entityCount:j.EntityCount==null?null:Number(j.EntityCount),errorCode:j.ErrorCode});
const cols='Id,OwnerId,ClientId,Filters,AccessScope,Format,Status,Stage,AttemptCount,CreatedAt,StartedAt,CompletedAt,ExpiresAt,FileBytes,ArtifactSha256,ChunkCount,RawCount,EntityCount,ErrorCode,ArtifactToken,LeaseToken,LeaseUntil';
async function authorizeOwner(pool,sql,ownerId){
 const r=await pool.request().input('owner',sql.VarChar(50),ownerId).query('SELECT U.Id,U.RoleId,U.IsActive,U.ExtraPermissions,U.ExcludedPermissions,U.ForcePasswordReset,U.PasswordExpiresAt,U.IsFirstLogin,U.SetupCompletedAt,R.Name AS RoleName,R.DisplayName AS RoleDisplayName,R.IsActive AS RoleActive FROM dbo.Users U LEFT JOIN dbo.Roles R ON R.Id=U.RoleId WHERE U.Id=@owner;');
 const owner=r.recordset[0];
 if(!owner?.IsActive||!owner.RoleActive||owner.ForcePasswordReset||(owner.PasswordExpiresAt&&new Date(owner.PasswordExpiresAt)<new Date())||(owner.IsFirstLogin&&!owner.SetupCompletedAt))throw err('access_changed','Export owner is inactive or requires account maintenance.',403);
 const access=await resolveAccessProfile(owner,pool);
 const user={Id:owner.Id,...access};
 if(!permission(user))throw err('access_changed','Export permission is no longer available.',403);
 return user;
}
const lockSql="DECLARE @lock int; EXEC @lock=sp_getapplock @Resource='retailops:"+kind+"-export-queue',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=5000; SELECT @lock AS acquired;";
async function queueTx(pool,sql,fn){
 const tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
 try{const l=await tx.request().query(lockSql);if(Number(l.recordset[0].acquired)<0)throw err('queue_busy','Export queue is busy. Retry shortly.',503);const out=await fn(tx);await tx.commit();return out;}catch(e){try{await tx.rollback();}catch{}throw e;}
}
async function capacity(tx,sql,owner){
 const r=await tx.request().input('owner',sql.VarChar(50),owner).query("SELECT COUNT_BIG(*) AS total,COUNT_BIG(CASE WHEN OwnerId=@owner THEN 1 END) AS own FROM "+table+" WHERE Status IN ('QUEUED','PROCESSING');");
 if(Number(r.recordset[0].total)>=50||Number(r.recordset[0].own)>=3)throw err('queue_full','Too many active exports. Cancel or finish an existing job.',429);
}
async function createJob({pool,sql,user,body}){
 const {clientId,format='xlsx',filters}=body||{};
 if(!uid(user)||!permission(user))throw err('access_changed','Export permission required.',403);
 if(!idValid(clientId)||!['xlsx','csv'].includes(format)||!filters||typeof filters!=='object'||Array.isArray(filters))throw err('invalid_export','Invalid export configuration.');
 if(Object.keys(body).some(k=>!['clientId','format','filters'].includes(k)))throw err('invalid_export','Unsupported export configuration.');
 const clean=validateFilters(filters,format);
 const scope=freezeScope(user,clean),owner=uid(user);
 return queueTx(pool,sql,async tx=>{
  const existing=await tx.request().input('owner',sql.VarChar(50),owner).input('client',sql.VarChar(36),clientId).query('SELECT '+cols+' FROM '+table+' WHERE OwnerId=@owner AND ClientId=@client;');
  if(existing.recordset[0]){
   const j=existing.recordset[0];scopedFilters(user,JSON.parse(j.Filters),JSON.parse(j.AccessScope));
   if(j.Format!==format||JSON.stringify(JSON.parse(j.Filters))!==JSON.stringify(clean))throw err('export_conflict','This request ID was already used for another export.',409);
   return publicJob(j);
  }
  await capacity(tx,sql,owner);
  const r=await tx.request().input('id',sql.VarChar(36),randomUUID()).input('owner',sql.VarChar(50),owner).input('client',sql.VarChar(36),clientId).input('filters',sql.NVarChar(sql.MAX),JSON.stringify(clean)).input('scope',sql.NVarChar(sql.MAX),JSON.stringify(scope)).input('format',sql.VarChar(4),format).query("INSERT "+table+"(Id,OwnerId,ClientId,Filters,AccessScope,Format,Status,Stage) OUTPUT inserted.* VALUES(@id,@owner,@client,@filters,@scope,@format,'QUEUED','queued');");
  return publicJob(r.recordset[0]);
 });
}
async function ownJob(db,sql,user,id,lock=false){
 if(!idValid(id))throw err('export_not_found','Export not found.',404);
 const r=await db.request().input('id',sql.VarChar(36),id).input('owner',sql.VarChar(50),uid(user)).query('SELECT '+cols+',CASE WHEN ExpiresAt>SYSUTCDATETIME() THEN 1 ELSE 0 END AS ArtifactAvailable FROM '+table+''+(lock?' WITH (UPDLOCK,HOLDLOCK)':'')+' WHERE Id=@id AND OwnerId=@owner;');
 const j=r.recordset[0];if(!j)throw err('export_not_found','Export not found.',404);
 scopedFilters(user,JSON.parse(j.Filters),JSON.parse(j.AccessScope));return j;
}
async function getJob({pool,sql,user,id}){return publicJob(await ownJob(pool,sql,user,id));}
async function listJobs({pool,sql,user,page=1,limit=20,status,search}){
 page=Number(page);limit=Number(limit);
 if(!permission(user)||!uid(user))throw err('access_changed','Export permission required.',403);
 if(!Number.isInteger(page)||page<1||page>10000||!Number.isInteger(limit)||limit<1||limit>50||status&&!['QUEUED','PROCESSING','COMPLETED','FAILED','CANCELLED','EXPIRED'].includes(status)||search!==undefined&&(typeof search!=='string'||search.length>120))throw err('invalid_export','Invalid export history filters.');
 const scope=strictScope(user);
 const request=pool.request().input('owner',sql.VarChar(50),uid(user)).input('global',sql.Bit,scope.unrestricted).input('allowed',sql.NVarChar(sql.MAX),JSON.stringify(scope.sellerIds)).input('offset',sql.Int,(page-1)*limit).input('limit',sql.Int,limit).input('status',sql.VarChar(12),status||null).input('search',sql.NVarChar(120),search?.trim()||null);
 const visible=" WHERE OwnerId=@owner AND ((JSON_VALUE(AccessScope,'$.global')='true' AND @global=1) OR (JSON_VALUE(AccessScope,'$.global')='false' AND EXISTS(SELECT 1 FROM OPENJSON(AccessScope,'$.ids')) AND (@global=1 OR NOT EXISTS(SELECT 1 FROM OPENJSON(AccessScope,'$.ids') WITH(id varchar(50) '$') s WHERE s.id IS NULL OR NOT EXISTS(SELECT 1 FROM OPENJSON(@allowed) WITH(id varchar(50) '$') a WHERE a.id=s.id)))))";
 const filtered=visible+" AND (@status IS NULL OR Status=@status) AND (@search IS NULL OR CHARINDEX(@search,Filters)>0 OR CHARINDEX(@search,Id)>0 OR CHARINDEX(@search,Format)>0 OR CHARINDEX(@search,Status)>0 OR CHARINDEX(@search,CONVERT(varchar(33),CreatedAt,126))>0)";
 const r=await request.query("SELECT COUNT_BIG(*) AS activeCount FROM "+table+""+visible+" AND Status IN ('QUEUED','PROCESSING'); SELECT COUNT_BIG(*) AS total FROM "+table+""+filtered+"; SELECT "+cols+" FROM "+table+""+filtered+" ORDER BY CreatedAt DESC,Id DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;");
 const rows=r.recordsets[2].filter(j=>{try{scopedFilters(user,JSON.parse(j.Filters),JSON.parse(j.AccessScope));return true;}catch{return false;}});
 return {rows:rows.map(publicJob),total:Number(r.recordsets[1][0].total),activeCount:Number(r.recordsets[0][0].activeCount),page,limit};
}
async function mutate({pool,sql,user,id,action}){
 return queueTx(pool,sql,async tx=>{
  const j=await ownJob(tx,sql,user,id,true);
  if(action==='retry'){
   if(j.Status!=='FAILED')throw err('invalid_export_state','Only failed exports can be retried.',409);
   await capacity(tx,sql,uid(user));
  }else if(!['QUEUED','PROCESSING'].includes(j.Status))throw err('invalid_export_state','Only active exports can be cancelled.',409);
  const set=action==='retry'?"Status='QUEUED',Stage='queued',AttemptCount=0,NextAttemptAt=SYSUTCDATETIME(),StartedAt=NULL,CompletedAt=NULL,ErrorCode=NULL":"Status='CANCELLED',Stage='cancelled',CompletedAt=SYSUTCDATETIME()";
  const r=await tx.request().input('id',sql.VarChar(36),id).query('UPDATE '+table+' SET '+set+',LeaseToken=NULL,LeaseUntil=NULL OUTPUT inserted.* WHERE Id=@id;');
  return publicJob(r.recordset[0]);
 });
}
async function claimNext(pool,sql){
 return queueTx(pool,sql,async tx=>{
  await tx.request().query("UPDATE "+table+" SET Status='FAILED',Stage='failed',ErrorCode='retry_exhausted',CompletedAt=SYSUTCDATETIME(),LeaseToken=NULL,LeaseUntil=NULL WHERE Status='PROCESSING' AND LeaseUntil<=SYSUTCDATETIME() AND AttemptCount>=3;");
  const r=await tx.request().input('token',sql.VarChar(36),randomUUID()).input('lease',sql.Int,LEASE).query("IF (SELECT COUNT(*) FROM "+table+" WHERE Status='PROCESSING' AND LeaseUntil>SYSUTCDATETIME())<"+MAX_ACTIVE+" BEGIN ;WITH candidate AS (SELECT TOP(1) * FROM "+table+" WITH(UPDLOCK,HOLDLOCK) WHERE AttemptCount<3 AND ((Status='QUEUED' AND NextAttemptAt<=SYSUTCDATETIME()) OR (Status='PROCESSING' AND LeaseUntil<=SYSUTCDATETIME())) ORDER BY CreatedAt,Id) UPDATE candidate SET Status='PROCESSING',Stage='generating',AttemptCount=AttemptCount+1,StartedAt=SYSUTCDATETIME(),LeaseToken=@token,LeaseUntil=DATEADD(second,@lease,SYSUTCDATETIME()) OUTPUT inserted.*; END");
  return r.recordset?.[0]||null;
 });
}
const leaseReq=(pool,sql,j)=>pool.request().input('id',sql.VarChar(36),j.Id).input('token',sql.VarChar(36),j.LeaseToken);
const leaseWhere="Id=@id AND Status='PROCESSING' AND LeaseToken=@token AND LeaseUntil>SYSUTCDATETIME()";
async function refreshLease(pool,sql,j){
 const r=await leaseReq(pool,sql,j).input('lease',sql.Int,LEASE).query('UPDATE '+table+' SET LeaseUntil=DATEADD(second,@lease,SYSUTCDATETIME()) WHERE '+leaseWhere+';');
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
  dir=await fs.mkdtemp(path.join(os.tmpdir(),'retailops-report-job-'));
  const filePath=path.join(dir,'report.'+j.Format);
  const result=await generate({pool,sql,user,filters,signal,filePath,format:j.Format,onStage:async(stage)=>{
   if(!['generating','writing','verifying'].includes(stage))throw Error('Invalid export stage');
   const r=await leaseReq(pool,sql,j).input('stage',sql.VarChar(24),stage).query('UPDATE '+table+' SET Stage=@stage WHERE '+leaseWhere+';');
   if(r.rowsAffected[0]!==1)throw err('lease_lost','Export lease lost.',409);
  }});
  if(j.Format==='xlsx')await verifyXlsx(filePath,{expectedSheets:result.expectedSheets,signal});
  else await checkFileEnvelope(filePath,'csv');
  const stat=await fs.stat(filePath);if(!stat.size||stat.size>MAX_BYTES)throw err('artifact_too_large','Export artifact exceeds the 512 MiB storage limit.',422);
  await leaseReq(pool,sql,j).query("UPDATE "+table+" SET Stage='storing' WHERE "+leaseWhere+";");
  let chunks=0,bytes=0;const hash=createHash('sha256');
  for await(const chunk of createReadStream(filePath,{highWaterMark:CHUNK})){
   if(signal.aborted)throw err('export_interrupted','Export interrupted.',408);
   const r=await leaseReq(pool,sql,j).input('chunk',sql.Int,++chunks).input('payload',sql.VarBinary(sql.MAX),chunk).query("INSERT "+chunksTable+"(JobId,AttemptToken,ChunkNo,Payload) SELECT @id,@token,@chunk,@payload WHERE EXISTS(SELECT 1 FROM "+table+" WHERE "+leaseWhere+");");
   if(r.rowsAffected[0]!==1)throw err('lease_lost','Export lease lost.',409);bytes+=chunk.length;hash.update(chunk);
  }
  if(bytes!==stat.size||signal.aborted)throw err('export_interrupted','Export interrupted.',408);
  const fresh=await authorizeOwner(pool,sql,j.OwnerId);scopedFilters(fresh,JSON.parse(j.Filters),JSON.parse(j.AccessScope));
  const published=await leaseReq(pool,sql,j).input('bytes',sql.BigInt,bytes).input('chunks',sql.Int,chunks).input('raw',sql.BigInt,result.rawCount).input('entities',sql.BigInt,result.entityCount).input('sha',sql.VarChar(64),hash.digest('hex')).input('retention',sql.Int,RETENTION_DAYS).query("UPDATE "+table+" SET Status='COMPLETED',Stage='completed',ArtifactToken=@token,ArtifactSha256=@sha,FileBytes=@bytes,ChunkCount=@chunks,RawCount=@raw,EntityCount=@entities,CompletedAt=SYSUTCDATETIME(),ExpiresAt=DATEADD(day,@retention,SYSUTCDATETIME()),LeaseToken=NULL,LeaseUntil=NULL WHERE "+leaseWhere+";");
  if(published.rowsAffected[0]!==1)throw err('lease_lost','Export lease lost.',409);
  console.info('[report export completed]',{jobId:j.Id,rows:result.rawCount,entities:result.entityCount,bytes,durationMs:Date.now()-new Date(j.StartedAt).getTime()});
 }catch(e){
  const permanent=e instanceof AdsScopeError&&[400,403,422].includes(e.status);
  const fail=permanent||j.AttemptCount>=3;
  await leaseReq(pool,sql,j).input('code',sql.VarChar(64),e instanceof AdsScopeError?e.code:'export_failed').input('backoff',sql.Int,30*Math.pow(2,j.AttemptCount-1)).query("UPDATE "+table+" SET Status='"+(fail?'FAILED':'QUEUED')+"',Stage='"+(fail?'failed':'retry_wait')+"',ErrorCode=@code,NextAttemptAt=DATEADD(second,@backoff,SYSUTCDATETIME()),CompletedAt="+(fail?'SYSUTCDATETIME()':'NULL')+",LeaseToken=NULL,LeaseUntil=NULL WHERE "+leaseWhere+";");
  console.error('[report export job]',j.Id,e.code||e.name);
 }finally{clearInterval(heartbeat);clearTimeout(deadline);if(dir)await fs.rm(dir,{recursive:true,force:true}).catch(()=>{});}
 return true;
}
async function sweep(pool){
 await pool.request().query("UPDATE TOP(100) "+table+" SET Status='EXPIRED',Stage='expired',ArtifactToken=NULL WHERE Status='COMPLETED' AND ExpiresAt<=SYSUTCDATETIME();");
 await pool.request().query("DELETE TOP(200) c FROM "+chunksTable+" c JOIN "+table+" j ON j.Id=c.JobId WHERE c.CreatedAt<DATEADD(hour,-1,SYSUTCDATETIME()) AND (j.ArtifactToken IS NULL OR j.ArtifactToken<>c.AttemptToken) AND (j.LeaseToken IS NULL OR j.LeaseToken<>c.AttemptToken);");
}
async function spoolDownload({pool,sql,user,id,filePath,signal}){
 const tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
 let handle;
 try{
  const j=await ownJob(tx,sql,user,id,true);
  if(j.Status!=='COMPLETED'||!j.ArtifactToken||!j.ArtifactAvailable)throw err('artifact_unavailable','Export is not available for download.',409);
  handle=await fs.open(filePath,'wx');let bytes=0;const hash=createHash('sha256');
  for(let i=1;i<=j.ChunkCount;i++){
   if(signal?.aborted)throw err('download_interrupted','Export download interrupted.',408);
   const r=await tx.request().input('id',sql.VarChar(36),id).input('token',sql.VarChar(36),j.ArtifactToken).input('chunk',sql.Int,i).query('SELECT Payload FROM '+chunksTable+' WHERE JobId=@id AND AttemptToken=@token AND ChunkNo=@chunk;');
   const data=r.recordset[0]?.Payload;if(!Buffer.isBuffer(data)||!data.length)throw err('artifact_corrupt','Export artifact is incomplete.',503);
   await handle.writeFile(data);bytes+=data.length;hash.update(data);
  }
  if(bytes!==Number(j.FileBytes)||hash.digest('hex')!==j.ArtifactSha256)throw err('artifact_corrupt','Export artifact size mismatch.',503);
  await handle.close();handle=null;await tx.commit();
  const fresh=await authorizeOwner(pool,sql,j.OwnerId);scopedFilters(fresh,JSON.parse(j.Filters),JSON.parse(j.AccessScope));
  if(signal?.aborted)throw err('download_interrupted','Export download interrupted.',408);
  return publicJob(j);
 }catch(e){try{await tx.rollback();}catch{}throw e;}finally{if(handle)await handle.close().catch(()=>{});}
}
async function ensureSchema(pool,apply){
 if(apply)await migration.up(pool);
 const r=await pool.request().query("SELECT CASE WHEN OBJECT_ID(N'"+table+"',N'U') IS NOT NULL AND OBJECT_ID(N'"+chunksTable+"',N'U') IS NOT NULL THEN 1 ELSE 0 END AS ready;");
 return Boolean(r.recordset[0]?.ready);
}
let started=false;
function startWorker(getPool){
 if(started)return;started=true;
 const {sql}=require('../database/db');
 let busy=false,lastSweep=0;
 const tick=async()=>{if(busy)return;busy=true;try{const pool=await getPool();if(Date.now()-lastSweep>60000){await sweep(pool);lastSweep=Date.now();}await processNext(pool,sql);}catch(e){console.error('[report export worker]',e.code||e.name);}finally{busy=false;}};
 const timer=setInterval(tick,3000);timer.unref?.();void tick();
}
return {createJob,getJob,listJobs,mutate,claimNext,refreshLease,processNext,sweep,spoolDownload,ensureSchema,startWorker,freezeScope,scopedFilters};
}
module.exports={createReportExportJobs};
