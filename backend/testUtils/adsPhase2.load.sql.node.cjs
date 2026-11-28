'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const {HEADERS,MAX_FILE_BYTES}=require('../services/adsProductContract');
const {ensureAdsSchema}=require('../database/adsSchema');
const {ensureAdsImportSchema}=require('../database/adsImportSchema');
const {createPreview,getJob,confirmJob}=require('../services/adsImportJobs');
const {processNext}=require('../services/adsImportWorker');
test('SQL: 100k and 200k auto-owned daily facts, exact totals and replay',{skip:process.env.ADS_SQL_SMOKE!=='1',timeout:420000},async()=>{
 const sql=require(process.env.ADS_TEST_MSSQL_MODULE||'mssql');
 const config={server:'127.0.0.1',user:'sa',password:process.env.ADS_TEST_SQL_PASSWORD,requestTimeout:180000,options:{trustServerCertificate:true,encrypt:false}};
 let admin,pool;const database='AdsLoad_'+Date.now(),prior=process.env.ADS_CANONICAL_IMPORT_ENABLED;
 for(let i=0;i<40;i++){const c=new sql.ConnectionPool(config);try{admin=await c.connect();break;}catch{await c.close().catch(()=>{});await new Promise(r=>setTimeout(r,1000));}}
 assert.ok(admin);
 try{
  await admin.request().query('CREATE DATABASE ['+database+']');pool=await new sql.ConnectionPool({...config,database}).connect();
  await pool.request().query("CREATE TABLE dbo.Sellers(Id varchar(50) PRIMARY KEY,Marketplace nvarchar(50)); INSERT dbo.Sellers VALUES('s1','amazon.in'),('s2','amazon.in'); CREATE TABLE dbo.Asins(AsinCode nvarchar(30),SellerId varchar(50)); CREATE UNIQUE INDEX UX_AdsLoadCatalog ON dbo.Asins(AsinCode,SellerId); CREATE TABLE dbo.Roles(Id varchar(50) PRIMARY KEY,Name nvarchar(50),DisplayName nvarchar(100),IsActive bit); INSERT dbo.Roles VALUES('r1','brand_manager','Brand manager',1); CREATE TABLE dbo.Users(Id varchar(50) PRIMARY KEY,RoleId varchar(50),IsActive bit,ExtraPermissions nvarchar(max),ExcludedPermissions nvarchar(max),ForcePasswordReset bit,PasswordExpiresAt datetime2,IsFirstLogin bit,SetupCompletedAt datetime2); INSERT dbo.Users VALUES('u1','r1',1,NULL,NULL,0,NULL,0,NULL);");
  const catalog=Array.from({length:2000},(_,i)=>({asin:'B'+String(i+1).padStart(9,'0'),sellerId:i%2?'s2':'s1'}));
  await pool.request().input('payload',sql.NVarChar(sql.MAX),JSON.stringify(catalog)).query("INSERT dbo.Asins SELECT asin,sellerId FROM OPENJSON(@payload) WITH (asin nvarchar(30),sellerId varchar(50));");
  assert.equal((await ensureAdsSchema({pool,apply:true})).ready,true);
  assert.equal((await ensureAdsImportSchema({pool,apply:true})).ready,true);
  process.env.ADS_CANONICAL_IMPORT_ENABLED='true';
  const user={Id:'u1',role:{Name:'brand_manager'},permissions:['adsreport_import'],assignedSellers:['s1','s2']};
  const resolveProfile=async()=>({role:user.role,permissions:user.permissions,assignedSellers:user.assignedSellers});
  const ctx={pool,sql,user},work=kind=>processNext({pool,sql,resolveProfile,kind});
  function source(days){
   const lines=[HEADERS.join(',')];
   for(let d=0;d<days;d++){
    const date=new Date(Date.UTC(2026,0,1+d)).toISOString().slice(0,10);
    for(const item of catalog)lines.push(HEADERS.map(h=>h==='asin'?item.asin:h==='date'?date:h==='metrics.spend'?'1.25':h==='metrics.sales'?'5.5':h==='metrics.total_sales'?'9.75':'').join(','));
   }
   return Buffer.from(lines.join('\n')+'\n');
  }
  for(const [days,expectedInserted,expectedUnchanged] of [[50,100000,0],[100,100000,100000]]){
   const input=source(days),rows=days*catalog.length;assert.ok(input.length<=MAX_FILE_BYTES);
   const start=performance.now();const queued=await createPreview({...ctx,input,fileName:'synthetic-'+rows+'.csv'});
   assert.equal(queued.status,'PREVIEW_QUEUED');await work('preview');
   const ready=await getJob({...ctx,id:queued.id});assert.equal(ready.status,'READY');assert.equal(ready.summary.validRows,rows);assert.equal(ready.summary.sellerBreakdown.length,2);
   const validationMs=Math.round(performance.now()-start);
   const began=performance.now();await confirmJob({...ctx,id:queued.id});await work('commit');
   const done=await getJob({...ctx,id:queued.id});assert.equal(done.status,'COMPLETED',JSON.stringify(done.result));assert.equal(done.result.inserted,expectedInserted);assert.equal(done.result.unchanged,expectedUnchanged);
   assert.equal(done.result.totals['metrics.spend'],String(rows*1.25));assert.equal(done.result.totals['metrics.total_sales'],String(rows*9.75));
   const facts=await pool.request().query('SELECT SellerId,COUNT_BIG(*) AS n,CONVERT(varchar(80),SUM(AdSpend)) AS spend,CONVERT(varchar(80),SUM(TotalSales)) AS sales FROM dbo.AdsProductDailyFacts GROUP BY SellerId ORDER BY SellerId;');
   assert.deepEqual(facts.recordset.map(r=>[r.SellerId,Number(r.n),Number(r.spend),Number(r.sales)]),[['s1',rows/2,rows*.625,rows*4.875],['s2',rows/2,rows*.625,rows*4.875]]);
   console.log('Ads full SQL benchmark',rows,'rows',input.length,'bytes; validation',validationMs,'ms; commit',Math.round(performance.now()-began),'ms; inserted',expectedInserted,'unchanged',expectedUnchanged);
  }
 }finally{if(prior===undefined)delete process.env.ADS_CANONICAL_IMPORT_ENABLED;else process.env.ADS_CANONICAL_IMPORT_ENABLED=prior;if(pool)await pool.close();await admin.request().query('ALTER DATABASE ['+database+'] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE ['+database+'];').catch(()=>{});await admin.close();}
});
