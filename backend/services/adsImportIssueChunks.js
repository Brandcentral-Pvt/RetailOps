'use strict';
const {gzip,gunzip}=require('node:zlib');
const {promisify}=require('node:util');
const {AdsScopeError}=require('./adsCanonicalScope');
const compress=promisify(gzip),decompress=promisify(gunzip);
const CHUNK_SIZE=1000,ERROR_RETENTION_DAYS=90;
function issueSink({pool,sql,job}){
 let count=0,chunkNo=0;
 async function append(issues,db=pool){
  for(let offset=0;offset<issues.length;offset+=CHUNK_SIZE){
   const part=issues.slice(offset,offset+CHUNK_SIZE);
   const payload=await compress(Buffer.from(JSON.stringify(part)));
   const r=await db.request().input('id',sql.VarChar(50),job.Id).input('token',sql.VarChar(36),job.LeaseToken)
    .input('chunk',sql.Int,chunkNo+1).input('count',sql.Int,part.length).input('payload',sql.VarBinary(sql.MAX),payload)
    .query("INSERT dbo.AdsImportIssueChunks(JobId,AttemptToken,ChunkNo,IssueCount,Payload) SELECT @id,@token,@chunk,@count,@payload WHERE EXISTS(SELECT 1 FROM dbo.AdsImportJobs WHERE Id=@id AND Status='VALIDATING' AND LeaseToken=@token AND LeaseUntil>SYSUTCDATETIME()); SELECT @@ROWCOUNT AS changed;");
   if(Number(r.recordset[0].changed)!==1)throw new AdsScopeError('lease_lost','Import lease no longer belongs to this worker.',409);
   count+=part.length;chunkNo++;
  }
 }
 return {append,get count(){return count;}};
}
async function* readIssueChunks({pool,sql,id,token,expectedCount,authorize}){
 let chunkNo=0,count=0;
 while(true){
  // Recheck current job scope through the caller before each batch.
  if(authorize)await authorize();
  const r=await pool.request().input('id',sql.VarChar(50),id).input('token',sql.VarChar(36),token).input('after',sql.Int,chunkNo)
   .query("SELECT TOP (10) ChunkNo,IssueCount,Payload FROM dbo.AdsImportIssueChunks WHERE JobId=@id AND AttemptToken=@token AND ChunkNo>@after ORDER BY ChunkNo;");
  if(!r.recordset.length)break;
  for(const row of r.recordset){
   if(Number(row.ChunkNo)!==chunkNo+1)throw Error('Missing Ads error chunk');
   const issues=JSON.parse((await decompress(row.Payload)).toString('utf8'));
   if(!Array.isArray(issues)||issues.length!==Number(row.IssueCount))throw Error('Ads error chunk count mismatch');
   for(const issue of issues)yield issue;
   count+=issues.length;chunkNo++;
  }
 }
 if(count!==expectedCount)throw Error('Ads error report count mismatch');
}
async function sweepRetainedErrors(pool){
 // Keep job metadata, mapping, financial result and first 100 issue previews
 // for audit. Clear detailed reports after 90 days; clean interrupted attempts.
 await pool.request().query("UPDATE TOP(25) dbo.AdsImportJobs SET IssueToken=NULL,IssuesJson=N'[]',ErrorReportPurgedAt=SYSUTCDATETIME() WHERE Status IN ('REJECTED','FAILED','CANCELLED','EXPIRED','COMPLETED') AND CompletedAt<DATEADD(day,-90,SYSUTCDATETIME()) AND ErrorReportPurgedAt IS NULL AND (IssueToken IS NOT NULL OR IssuesJson<>N'[]');");
 await pool.request().query("DELETE TOP(200) c FROM dbo.AdsImportIssueChunks c JOIN dbo.AdsImportJobs j ON j.Id=c.JobId WHERE c.CreatedAt<DATEADD(hour,-24,SYSUTCDATETIME()) AND (j.IssueToken IS NULL OR j.IssueToken<>c.AttemptToken) AND (j.Status<>'VALIDATING' OR j.LeaseToken<>c.AttemptToken);");
}
module.exports={issueSink,readIssueChunks,sweepRetainedErrors,CHUNK_SIZE,ERROR_RETENTION_DAYS};
