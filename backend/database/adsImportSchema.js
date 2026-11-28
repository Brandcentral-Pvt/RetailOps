'use strict';
const migration=require('../migrations/099_ads_import_jobs');
const queueMigration=require('../migrations/101_ads_import_queue');
const {inspectAdsSchema}=require('./adsSchema');
const columns=['Id','OwnerId','SellerId','Marketplace','Currency','FileName','SourceFileSha256','SourceBytes','Status','SummaryJson','IssuesJson','ResultJson','CreatedAt','ExpiresAt','CompletedAt'];
const queueColumns=['QueuedAt','StartedAt','NextAttemptAt','AttemptCount','LeaseToken','LeaseUntil','Stage','StagedRows'];
async function inspectAdsImportSchema(pool){
 pool=pool||await require('./db').getPool();
 const facts=await inspectAdsSchema(pool);
 const r=await pool.request().query("SELECT name FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.AdsImportJobs',N'U');");
 const existing=new Set(r.recordset.map(x=>String(x.name).toLowerCase()));
 const missing=columns.filter(c=>!existing.has(c.toLowerCase()));
 const queueMissing=queueColumns.filter(c=>!existing.has(c.toLowerCase()));
 const checks=await pool.request().query("SELECT name,is_disabled,is_not_trusted FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID(N'dbo.AdsImportJobs',N'U');");
 const queueState=checks.recordset.some(x=>x.name==='CK_AdsImportJobs_QueueState'&&!x.is_disabled&&!x.is_not_trusted);
 return {ready:facts.ready&&missing.length===0&&queueMissing.length===0&&queueState,factsReady:facts.ready,tableExists:existing.size>0,missing,queueMissing,queueState};
}
async function ensureAdsImportSchema({pool,apply=false}={}){
 pool=pool||await require('./db').getPool();let state=await inspectAdsImportSchema(pool);
 if(state.factsReady&&!state.tableExists&&apply){await migration.up(pool);state=await inspectAdsImportSchema(pool);}
 if(state.factsReady&&state.tableExists&&!state.missing.length&&!state.ready&&apply){await queueMigration.up(pool);state=await inspectAdsImportSchema(pool);}
 return state;
}
module.exports={inspectAdsImportSchema,ensureAdsImportSchema};
