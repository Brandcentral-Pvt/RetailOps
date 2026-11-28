'use strict';
// Durable, user-owned preview records. No payload in history/list responses.
// Confirmation uses the same canonical writer transaction for facts + job completion.
const {randomUUID,createHash}=require('node:crypto');
const {validateReport,replayValidatedRows,AdsValidationError,MAX_FILE_BYTES}=require('./adsProductContract');
const {ingestCanonicalReport,AdsIngestionError}=require('./adsCanonicalIngestion');
const {strictScope,explicitSeller,resolveContext,AdsScopeError}=require('./adsCanonicalScope');
const {importsEnabled}=require('./adsImportConfirmation');
const MAX_STORED_ISSUES=10000,MAX_PENDING_OWNER=3,MAX_PENDING_GLOBAL=50;
const jobError=(code,message,status=409)=>new AdsScopeError(code,message,status);
const ownerId=user=>{
 const id=user?.Id||user?._id||user?.id;
 if(typeof id!=='string'||!id||id.length>50)throw jobError('authentication_required','Authentication required.',401);
 return id;
};
const normalizeName=name=>String(name||'report.csv').split(/[\\/]/).pop().replace(/[\u0000-\u001f\u007f]/g,'_').slice(0,255)||'report.csv';
const cols="j.Id,j.OwnerId,j.SellerId,j.Marketplace,j.Currency,j.FileName,j.SourceFileSha256,j.Status,j.SummaryJson,j.ResultJson,CONVERT(varchar(33),j.CreatedAt,126)+'Z' AS CreatedAt,CONVERT(varchar(33),j.ExpiresAt,126)+'Z' AS ExpiresAt,CONVERT(varchar(33),j.CompletedAt,126)+'Z' AS CompletedAt,CASE WHEN j.ExpiresAt<=SYSUTCDATETIME() THEN 1 ELSE 0 END AS IsExpired";
function publicJob(row){
 if(!row)return null;
 return {id:row.Id,sellerId:row.SellerId,marketplace:row.Marketplace,currency:row.Currency,fileName:row.FileName,
   sourceFileSha256:row.SourceFileSha256,status:row.Status==='READY'&&row.IsExpired?'EXPIRED':row.Status,
   summary:JSON.parse(row.SummaryJson),result:row.ResultJson?JSON.parse(row.ResultJson):null,
   createdAt:row.CreatedAt,expiresAt:row.ExpiresAt,completedAt:row.CompletedAt,importsEnabled:importsEnabled()};
}
function scopedRequest(pool,sql,user,id){
 const owner=ownerId(user),scope=strictScope(user);
 const request=pool.request().input('owner',sql.VarChar(50),owner);
 let where=' WHERE j.OwnerId=@owner';
 if(id!==undefined){
  if(typeof id!=='string'||!/^[a-f0-9-]{36}$/i.test(id))throw jobError('invalid_job_id','Invalid import identifier.',400);
  request.input('id',sql.VarChar(50),id);where+=' AND j.Id=@id';
 }
 if(!scope.unrestricted){
  request.input('sellerIds',sql.NVarChar(sql.MAX),JSON.stringify(scope.sellerIds));
  where+=" AND EXISTS(SELECT 1 FROM OPENJSON(@sellerIds) WITH ([id] varchar(50) '$') s WHERE s.[id]=j.SellerId)";
 }
 return {request,where};
}
async function getRow({pool,sql,user,id,payload=false,issues=false}){
 const {request,where}=scopedRequest(pool,sql,user,id);
 const result=await request.query('SELECT '+cols+(payload?',j.SourceBytes':'')+(issues?',j.IssuesJson':'')+' FROM dbo.AdsImportJobs j'+where);
 return result.recordset[0]||null;
}
async function getJob(args){return publicJob(await getRow(args));}
async function listJobs({pool,sql,user,page=1,limit=25}){
 if(!Number.isInteger(page)||page<1||page>100000||!Number.isInteger(limit)||limit<1||limit>100)throw jobError('invalid_pagination','Invalid history page or limit.',400);
 const {request,where}=scopedRequest(pool,sql,user);
 request.input('offset',sql.Int,(page-1)*limit).input('limit',sql.Int,limit);
 const r=await request.query('SELECT COUNT_BIG(*) AS total FROM dbo.AdsImportJobs j'+where+'; SELECT '+cols+' FROM dbo.AdsImportJobs j'+where+' ORDER BY j.CreatedAt DESC,j.Id DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;');
 return {rows:r.recordsets[1].map(publicJob),total:Number(r.recordsets[0][0].total),page,limit};
}
const expireSql="UPDATE dbo.AdsImportJobs SET Status='EXPIRED',SourceBytes=NULL,CompletedAt=SYSUTCDATETIME() WHERE Status='READY' AND ExpiresAt<=SYSUTCDATETIME();";
async function expireJobs(pool){await pool.request().query(expireSql);}
async function createPreview({pool,sql,user,sellerId,input,fileName}){
 const owner=ownerId(user);explicitSeller(user,sellerId);
 if(!Buffer.isBuffer(input)||!input.length||input.length>MAX_FILE_BYTES)throw jobError('invalid_file_size','Select a nonempty CSV up to 32 MiB.',400);
 const bytes=Buffer.from(input),hash=createHash('sha256').update(bytes).digest('hex');
 const seller=(await pool.request().input('seller',sql.VarChar(50),sellerId).query('SELECT Id,Marketplace FROM dbo.Sellers WHERE Id=@seller')).recordset[0];
 if(!seller||seller.Id!==sellerId)throw jobError('seller_not_found','Seller not found.',404);
 const context=resolveContext(seller);
 if(!context)throw jobError('seller_context_unverified','Seller marketplace/currency must be verified.');
 const issues=[];let count=0;
 const collect=i=>{count++;if(issues.length<MAX_STORED_ISSUES)issues.push(i);};
 let summary;
 try{
   summary=validateReport(bytes,{onIssue:collect});
 }catch(e){
   if(!(e instanceof AdsValidationError))throw e;
   collect({row:e.row,column:e.column,code:e.code,message:e.message});
   summary={schemaVersion:1,reportType:'daily',valid:false,rows:null,validRows:null,invalidRows:null,sourceFileSha256:hash};
 }
 if(summary.valid){
   const keys=new Map();
   for(const row of replayValidatedRows(bytes,hash))if(!keys.has(row[1]))keys.set(row[1],{row:row[0],asin:row[1],date:row[3]});
   const bad=await pool.request().input('seller',sql.VarChar(50),sellerId).input('keys',sql.NVarChar(sql.MAX),JSON.stringify([...keys.keys()]))
    .query("SELECT k.[asin],COUNT_BIG(a.AsinCode) AS matches FROM OPENJSON(@keys) WITH ([asin] varchar(10) '$') k LEFT JOIN dbo.Asins a ON a.AsinCode=k.[asin] AND a.SellerId=@seller GROUP BY k.[asin] HAVING COUNT_BIG(a.AsinCode)<>1 ORDER BY k.[asin];");
   summary.invalidCatalogKeys=bad.recordset.length;
   for(const r of bad.recordset)collect({...keys.get(r.asin),column:'asin',code:Number(r.matches)===0?'catalog_mapping_missing':'catalog_mapping_ambiguous',
      message:Number(r.matches)===0?'This ASIN is not mapped to the selected seller. Verify the catalog assignment.':'This ASIN has multiple catalog mappings under the selected seller. Resolve the duplicate assignment.'});
 }
 summary={...summary,valid:summary.valid&&count===0,issueCount:count,issues:issues.slice(0,100),issuesTruncated:count>100,storedIssueCount:issues.length,issueReportTruncated:count>issues.length};
 const id=randomUUID(),ready=summary.valid;
 const tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
 try{
   await tx.request().query("DECLARE @lock int; EXEC @lock=sp_getapplock @Resource='retailops:ads-job-create',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000; IF @lock<0 THROW 51042,'Ads job capacity lock unavailable',1;");
   await tx.request().query(expireSql);
   if(ready){
     const limits=await tx.request().input('owner',sql.VarChar(50),owner).query("SELECT COUNT_BIG(*) AS total,COUNT_BIG(CASE WHEN OwnerId=@owner THEN 1 END) AS owned FROM dbo.AdsImportJobs WHERE Status='READY';");
     if(Number(limits.recordset[0].total)>=MAX_PENDING_GLOBAL||Number(limits.recordset[0].owned)>=MAX_PENDING_OWNER)throw jobError('import_capacity','Pending import capacity reached. Cancel an old preview or confirm it before staging another.',429);
   }
   await tx.request().input('id',sql.VarChar(50),id).input('owner',sql.VarChar(50),owner).input('seller',sql.VarChar(50),sellerId)
    .input('marketplace',sql.NVarChar(50),context.marketplace).input('currency',sql.Char(3),context.currency)
    .input('fileName',sql.NVarChar(255),normalizeName(fileName)).input('hash',sql.Char(64),hash)
    .input('bytes',sql.VarBinary(sql.MAX),ready?bytes:null).input('status',sql.VarChar(20),ready?'READY':'REJECTED')
    .input('summary',sql.NVarChar(sql.MAX),JSON.stringify(summary)).input('issues',sql.NVarChar(sql.MAX),JSON.stringify(issues))
    .query("INSERT dbo.AdsImportJobs(Id,OwnerId,SellerId,Marketplace,Currency,FileName,SourceFileSha256,SourceBytes,Status,SummaryJson,IssuesJson,ExpiresAt,CompletedAt) VALUES(@id,@owner,@seller,@marketplace,@currency,@fileName,@hash,@bytes,@status,@summary,@issues,DATEADD(hour,24,SYSUTCDATETIME()),CASE WHEN @status='REJECTED' THEN SYSUTCDATETIME() END);");
   await tx.commit();
 }catch(e){try{await tx.rollback();}catch{}throw e;}
 return getJob({pool,sql,user,id});
}
async function cancelJob({pool,sql,user,id}){
 const {request,where}=scopedRequest(pool,sql,user,id);
 await request.query("UPDATE j SET Status='CANCELLED',SourceBytes=NULL,CompletedAt=SYSUTCDATETIME() FROM dbo.AdsImportJobs j"+where+" AND j.Status='READY' AND j.ExpiresAt>SYSUTCDATETIME();");
 const job=await getJob({pool,sql,user,id});
 if(!job)throw jobError('job_not_found','Import not found.',404);
 if(job.status!=='CANCELLED')throw jobError('job_not_ready','Import cannot be cancelled in its current state.');
 return job;
}
async function confirmJob({pool,sql,user,id}){
 const row=await getRow({pool,sql,user,id,payload:true});
 if(!row)throw jobError('job_not_found','Import not found.',404);
 const initial=publicJob(row);
 if(initial.status==='COMPLETED')return initial;
 if(initial.status!=='READY'||!row.SourceBytes)throw jobError('job_not_ready','Import is not ready or has expired.');
 if(!importsEnabled())throw jobError('ads_import_disabled','Canonical import has not been enabled.');
 explicitSeller(user,row.SellerId);
 const owner=ownerId(user);
 const lifecycle={
  begin:async(tx,report)=>{
    // Same row lock protects cancel, expiry and concurrent confirmation.
    const r=await tx.request().input('id',sql.VarChar(50),id).input('owner',sql.VarChar(50),owner)
      .query("SELECT SellerId,Marketplace,Currency,SourceFileSha256,Status,CASE WHEN ExpiresAt<=SYSUTCDATETIME() THEN 1 ELSE 0 END AS expired FROM dbo.AdsImportJobs WITH(UPDLOCK,HOLDLOCK) WHERE Id=@id AND OwnerId=@owner;");
    const current=r.recordset[0];
    if(!current||current.Status!=='READY'||current.expired)throw jobError('job_not_ready','Import is no longer ready.');
    if(!importsEnabled())throw jobError('ads_import_disabled','Canonical import has not been enabled.');
    if(current.SellerId!==row.SellerId||current.Marketplace!==row.Marketplace||current.Currency!==row.Currency||current.SourceFileSha256!==report.sourceFileSha256)
      throw jobError('job_source_changed','Staged source or seller context changed. Validate again.');
  },
  complete:async(tx,result)=>{
    const output={sellerId:result.sellerId,marketplace:result.marketplace,currency:result.currency,inserted:result.inserted,unchanged:result.unchanged,sourceFileSha256:result.sourceFileSha256,startDate:result.report.startDate,endDate:result.report.endDate,totals:result.report.totals,persisted:true};
    const r=await tx.request().input('id',sql.VarChar(50),id).input('owner',sql.VarChar(50),owner).input('result',sql.NVarChar(sql.MAX),JSON.stringify(output))
      .query("UPDATE dbo.AdsImportJobs SET Status='COMPLETED',SourceBytes=NULL,ResultJson=@result,CompletedAt=SYSUTCDATETIME() WHERE Id=@id AND OwnerId=@owner AND Status='READY'; SELECT @@ROWCOUNT AS changed;");
    if(Number(r.recordset[0].changed)!==1)throw jobError('job_not_ready','Import completion could not be recorded.');
  }
 };
 try{
   await ingestCanonicalReport({pool,sql,user,sellerId:row.SellerId,reportType:'daily',input:row.SourceBytes,expectedContext:{marketplace:row.Marketplace,currency:row.Currency},lifecycle});
 }catch(e){
   const current=await getJob({pool,sql,user,id});
   if(current?.status==='COMPLETED')return current; // ambiguous commit or concurrent request
   // Do not convert SQL timeouts/connection failures into a false terminal failure.
   // Transaction rollback leaves a READY job available for safe retry.
   if(e instanceof AdsIngestionError||e instanceof AdsValidationError){
     const {request,where}=scopedRequest(pool,sql,user,id);
     const detail={code:e.code,message:e.message,details:e.details||null,persisted:false};
     const issue={row:null,column:null,code:e.code,message:e.message};
     await request.input('result',sql.NVarChar(sql.MAX),JSON.stringify(detail)).input('issues',sql.NVarChar(sql.MAX),JSON.stringify([issue]))
       .query("UPDATE j SET Status='FAILED',SourceBytes=NULL,ResultJson=@result,IssuesJson=@issues,CompletedAt=SYSUTCDATETIME() FROM dbo.AdsImportJobs j"+where+" AND j.Status='READY';");
     return getJob({pool,sql,user,id});
   }
   throw e;
 }
 return getJob({pool,sql,user,id});
}
async function getIssues(args){
 const row=await getRow({...args,issues:true});
 if(!row)throw jobError('job_not_found','Import not found.',404);
 const job=publicJob(row),issues=JSON.parse(row.IssuesJson);
 return {job,issues};
}
let timer=null,running=false;
function startExpirySweep(getPool){
 if(timer)return;
 const tick=async()=>{if(running)return;running=true;try{await expireJobs(await getPool());}catch(e){console.error('[ads import expiry]',e.message);}finally{running=false;}};
 timer=setInterval(tick,60000);timer.unref?.();void tick();
}
module.exports={createPreview,getJob,listJobs,cancelJob,confirmJob,getIssues,expireJobs,startExpirySweep,MAX_STORED_ISSUES};
