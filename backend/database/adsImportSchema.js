'use strict';
const migration=require('../migrations/099_ads_import_jobs');
const {inspectAdsSchema}=require('./adsSchema');
const columns=['Id','OwnerId','SellerId','Marketplace','Currency','FileName','SourceFileSha256','SourceBytes','Status','SummaryJson','IssuesJson','ResultJson','CreatedAt','ExpiresAt','CompletedAt'];
async function inspectAdsImportSchema(pool){
 pool=pool||await require('./db').getPool();
 const facts=await inspectAdsSchema(pool);
 const r=await pool.request().query("SELECT name FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.AdsImportJobs',N'U');");
 const existing=new Set(r.recordset.map(x=>String(x.name).toLowerCase()));
 const missing=columns.filter(c=>!existing.has(c.toLowerCase()));
 return {ready:facts.ready&&missing.length===0,factsReady:facts.ready,tableExists:existing.size>0,missing};
}
async function ensureAdsImportSchema({pool,apply=false}={}){
 pool=pool||await require('./db').getPool();let state=await inspectAdsImportSchema(pool);
 if(state.factsReady&&!state.tableExists&&apply){await migration.up(pool);state=await inspectAdsImportSchema(pool);}
 return state;
}
module.exports={inspectAdsImportSchema,ensureAdsImportSchema};
