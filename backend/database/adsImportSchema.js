'use strict';
const migration=require('../migrations/099_ads_import_jobs');
const queueMigration=require('../migrations/101_ads_import_queue');
const previewMigration=require('../migrations/102_ads_preview_queue');
const ownershipMigration=require('../migrations/103_ads_auto_ownership');
const errorMigration=require('../migrations/104_ads_import_error_retention');
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
 const previewMissing=['ValidatedAt','ValidationAttempts'].filter(c=>!existing.has(c.toLowerCase()));
 const checks=await pool.request().query("SELECT name,is_disabled,is_not_trusted FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID(N'dbo.AdsImportJobs',N'U');");
 const queueState=checks.recordset.some(x=>x.name==='CK_AdsImportJobs_QueueState'&&!x.is_disabled&&!x.is_not_trusted);
 const ownership=await pool.request().query("SELECT CASE WHEN OBJECT_ID(N'dbo.AdsImportJobOwners',N'U') IS NOT NULL AND COL_LENGTH('dbo.AdsImportJobs','OwnershipHash') IS NOT NULL AND (SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.AdsImportJobs') AND name IN ('SellerId','Marketplace','Currency') AND is_nullable=1)=3 AND EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.AdsProductDailyFacts') AND name='IX_AdsProductDaily_AsinDateOwner' AND is_disabled=0) THEN 1 ELSE 0 END AS ready;");
 const ownershipReady=Boolean(ownership.recordset[0]?.ready);
 const errors=await pool.request().query("SELECT CASE WHEN OBJECT_ID(N'dbo.AdsImportIssueChunks',N'U') IS NOT NULL AND COL_LENGTH('dbo.AdsImportJobs','IssueToken') IS NOT NULL AND COL_LENGTH('dbo.AdsImportJobs','ErrorReportPurgedAt') IS NOT NULL THEN 1 ELSE 0 END AS ready;");
 const errorsReady=Boolean(errors.recordset[0]?.ready);
 const previewState=checks.recordset.some(x=>x.name==='CK_AdsImportJobs_PreviewAttempts'&&!x.is_disabled&&!x.is_not_trusted);
 return {ready:facts.ready&&missing.length===0&&queueMissing.length===0&&queueState&&previewMissing.length===0&&previewState&&ownershipReady&&errorsReady,errorsReady,ownershipReady,factsReady:facts.ready,tableExists:existing.size>0,missing,queueMissing,queueState,previewMissing,previewState};
}
async function ensureAdsImportSchema({pool,apply=false}={}){
 pool=pool||await require('./db').getPool();let state=await inspectAdsImportSchema(pool);
 if(state.factsReady&&!state.tableExists&&apply){await migration.up(pool);state=await inspectAdsImportSchema(pool);}
 if(state.factsReady&&state.tableExists&&!state.missing.length&&(state.queueMissing.length||!state.queueState)&&apply){await queueMigration.up(pool);state=await inspectAdsImportSchema(pool);}
 if(state.factsReady&&state.tableExists&&!state.missing.length&&!state.queueMissing.length&&state.queueState&&(state.previewMissing.length||!state.previewState)&&apply){await previewMigration.up(pool);state=await inspectAdsImportSchema(pool);}
 if(state.factsReady&&state.tableExists&&!state.missing.length&&!state.queueMissing.length&&state.queueState&&!state.previewMissing.length&&state.previewState&&!state.ownershipReady&&apply){await ownershipMigration.up(pool);state=await inspectAdsImportSchema(pool);}
 if(state.factsReady&&state.ownershipReady&&state.queueState&&state.previewState&&!state.missing.length&&!state.queueMissing.length&&!state.previewMissing.length&&!state.errorsReady&&apply){await errorMigration.up(pool);state=await inspectAdsImportSchema(pool);}
 return state;
}
module.exports={inspectAdsImportSchema,ensureAdsImportSchema};
