'use strict';
// Disposable SQL Server only. No use of application database connection settings.
const test=require('node:test'), assert=require('node:assert/strict');
const {up}=require('../migrations/098_ads_product_daily_facts');
const contract=require('../contracts/ads-product-daily-v1.json');
test('real SQL: additive schema, all 63 columns, owner-aware keys, nullable source values, repeat migration', {skip:process.env.ADS_SQL_SMOKE!=='1'},async()=>{
 const sql=require(process.env.ADS_TEST_MSSQL_MODULE||'mssql');
 const config={server:'127.0.0.1',user:'sa',password:process.env.ADS_TEST_SQL_PASSWORD,options:{trustServerCertificate:true,encrypt:false}};
 let admin;
 for(let i=0;i<60;i++){try{admin=await new sql.ConnectionPool(config).connect();break;}catch{await new Promise(r=>setTimeout(r,1000));}}
 assert.ok(admin,'disposable SQL available');
 const database='AdsPhase1_'+Date.now();let pool;
 try{
  await admin.request().query('CREATE DATABASE ['+database+']');
  pool=await new sql.ConnectionPool({...config,database}).connect();
  await pool.request().query("CREATE TABLE dbo.Sellers (Id varchar(50) PRIMARY KEY); INSERT dbo.Sellers VALUES ('s1'),('s2'); CREATE TABLE dbo.AdsPerformance (Id int PRIMARY KEY); INSERT dbo.AdsPerformance VALUES (42);");
  await up(pool);await up(pool);
  const columns=await pool.request().query("SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('dbo.AdsProductDailyFacts')");
  const names=new Set(columns.recordset.map(r=>r.name));
  for(const f of contract.fields)assert.ok(names.has(f.canonicalColumn),f.header);
  const prefix="INSERT dbo.AdsProductDailyFacts (SellerId,Marketplace,Currency,ReportType,Asin,[Date],SourceFileSha256,SourceRowNumber,SourceSchemaVersion,ImportedBy,TotalSales,AdSpend) VALUES ";
  const values=seller=>"('"+seller+"','amazon.in','INR','daily','B000000001','2026-04-01',REPLICATE('a',64),2,1,'test',-1.25,NULL)";
  await pool.request().query(prefix+values('s1')+','+values('s2'));
  await assert.rejects(()=>pool.request().query(prefix+values('s1')));
  const counts=await pool.request().query("SELECT COUNT(*) AS n,COUNT(AdSpend) AS populated,SUM(TotalSales) AS total FROM dbo.AdsProductDailyFacts; SELECT COUNT(*) AS legacy FROM dbo.AdsPerformance WHERE Id=42;");
  assert.equal(counts.recordsets[0][0].n,2);assert.equal(counts.recordsets[0][0].populated,0);assert.equal(counts.recordsets[0][0].total,-2.5);assert.equal(counts.recordsets[1][0].legacy,1);
 }finally{if(pool)await pool.close();await admin.request().query('ALTER DATABASE ['+database+'] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE ['+database+'];').catch(()=>{});await admin.close();}
});
