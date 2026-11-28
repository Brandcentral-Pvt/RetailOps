'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{performance}=require('node:perf_hooks');
const {up:factMigration}=require('../migrations/098_ads_product_daily_facts');
const {up:indexMigration}=require('../migrations/107_ads_report_covering_index');
const {readCanonicalReport}=require('../services/adsCanonicalReport');
test('Ads reporting index baseline and indexed measurements',{skip:process.env.ADS_SQL_SMOKE!=='1',timeout:180000},async()=>{
 const sql=require(process.env.ADS_TEST_MSSQL_MODULE||'mssql');
 const config={server:'127.0.0.1',user:'sa',password:process.env.ADS_TEST_SQL_PASSWORD,requestTimeout:120000,options:{trustServerCertificate:true,encrypt:false}};
 const size=Number(process.env.ADS_INDEX_BENCH_ROWS||10000);
 assert.ok([10000,100000,250000].includes(size));
 let admin,pool;const database='AdsIndex_'+Date.now();
 for(let i=0;i<40;i++){const c=new sql.ConnectionPool(config);try{admin=await c.connect();break;}catch{await c.close().catch(()=>{});await new Promise(r=>setTimeout(r,1000));}}
 assert.ok(admin);
 try{
  await admin.request().query('CREATE DATABASE ['+database+']');
  pool=await new sql.ConnectionPool({...config,database}).connect();
  await pool.request().query("CREATE TABLE dbo.Sellers(Id varchar(50) PRIMARY KEY,Name nvarchar(255)); INSERT dbo.Sellers VALUES('s1','One'),('s2','Two'); CREATE TABLE dbo.Asins(SellerId varchar(50),AsinCode varchar(10),Title nvarchar(255),Brand nvarchar(255),Category nvarchar(255),ParentAsin varchar(10),Sku nvarchar(255));");
  await factMigration(pool);
  await pool.request().input('size',sql.Int,size).query("WITH digits AS (SELECT n FROM (VALUES(0),(1),(2),(3),(4),(5),(6),(7),(8),(9)) d(n)), nums AS (SELECT a.n+10*b.n+100*c.n+1000*d.n+10000*e.n+100000*f.n AS n FROM digits a CROSS JOIN digits b CROSS JOIN digits c CROSS JOIN digits d CROSS JOIN digits e CROSS JOIN digits f), n AS (SELECT n FROM nums WHERE n<@size) INSERT dbo.AdsProductDailyFacts(SellerId,Marketplace,Currency,ReportType,Asin,[Date],SourceFileSha256,SourceRowNumber,SourceSchemaVersion,ImportedBy,AdSpend,AdSales,TotalSales,Clicks,Conversions) SELECT CASE WHEN n%2=0 THEN 's1' ELSE 's2' END,'amazon.in','INR','daily','B'+RIGHT('000000000'+CONVERT(varchar(9),n/100),9),DATEADD(day,n%100,CONVERT(date,'20260401',112)),REPLICATE('a',64),2,1,'test',1.25,5,8,10,1 FROM n;");
  await pool.request().query("INSERT dbo.Asins(SellerId,AsinCode,Title,Brand,Category,Sku) SELECT DISTINCT SellerId,Asin,'Product','Brand','Category','SKU' FROM dbo.AdsProductDailyFacts;");
  const user={Id:'bench',role:{Name:'admin'},assignedSellers:[]};
  const query={startDate:'2026-06-01',endDate:'2026-06-07'};
  const scenarios=[{name:'overview',overviewOnly:true,query},{name:'products',query:{...query,page:'2'}},{name:'seller',query:{...query,sellerId:'s1'}}];
  async function measure(){const results=[];for(const scenario of scenarios){const times=[];let payload;for(let i=0;i<3;i++){const start=performance.now();payload=await readCanonicalReport({pool,sql,user,query:scenario.query,overviewOnly:scenario.overviewOnly});times.push(Math.round(performance.now()-start));}results.push({name:scenario.name,times,payload});}return results;}
  const before=await measure();await indexMigration(pool);const after=await measure();
  for(let i=0;i<before.length;i++){assert.deepEqual(after[i].payload,before[i].payload);console.log(JSON.stringify({rows:size,scenario:before[i].name,beforeMs:before[i].times,afterMs:after[i].times}));}
 }finally{if(pool)await pool.close();await admin.request().query('ALTER DATABASE ['+database+'] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE ['+database+'];').catch(()=>{});await admin.close();}
});
