'use strict';
// Real SQL disposable CI only. No production DB configuration is read.
const test=require('node:test'),assert=require('node:assert/strict');
const {up}=require('../migrations/098_ads_product_daily_facts');
const {HEADERS}=require('../services/adsProductContract');
const {ingestCanonicalReport}=require('../services/adsCanonicalIngestion');
const {readCanonicalSummary}=require('../services/adsCanonicalMetrics');
const quote=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
const csv=rows=>Buffer.from(HEADERS.map(quote).join(',')+'\n'+rows.map(r=>HEADERS.map(h=>quote(r[h])).join(',')).join('\n')+'\n');
const base={asin:'B000000001',date:'2026-04-01','metrics.spend':'10.25','metrics.sales':'25.50','metrics.organic_sales':'8',
 'metrics.total_sales':'20','metrics.ordered_revenue':'20','metrics.total_orders':'3','metrics.ordered_orders':'3','metrics.orders':'2',
 'metrics.conversions':'1','metrics.clicks':'4','metrics.new_to_brand_sales':'1.1234567891','product_detail.priceToPay.amount':'123.45'};
const user={Id:'u1',role:{Name:'brand_manager'},assignedSellers:['s1','s2','s3']};
test('SQL: full writer, shared ASIN isolation, exact replay, conflict rollback, sparse values, currency summaries and concurrent replay',{skip:process.env.ADS_SQL_SMOKE!=='1',timeout:180000},async()=>{
 const sql=require(process.env.ADS_TEST_MSSQL_MODULE||'mssql');
 const config={server:'127.0.0.1',user:'sa',password:process.env.ADS_TEST_SQL_PASSWORD,options:{trustServerCertificate:true,encrypt:false}};
 let admin;
 for(let i=0;i<40;i++){let candidate=new sql.ConnectionPool(config);try{admin=await candidate.connect();break;}catch{await candidate.close().catch(()=>{});await new Promise(r=>setTimeout(r,1000));}}
 assert.ok(admin);
 const database='AdsWriter_'+Date.now();let pool;
 const priorConfig=process.env.ADS_SELLER_CONTEXT_JSON;
 process.env.ADS_SELLER_CONTEXT_JSON=JSON.stringify({s3:{catalogMarketplace:'Amazon US',marketplace:'amazon.com',currency:'USD'}});
 try{
  await admin.request().query('CREATE DATABASE ['+database+']');
  pool=await new sql.ConnectionPool({...config,database}).connect();
  await pool.request().query("CREATE TABLE dbo.Sellers(Id varchar(50) PRIMARY KEY,Marketplace nvarchar(50)); INSERT dbo.Sellers VALUES ('s1','amazon.in'),('s2','amazon.in'),('s3','Amazon US'); CREATE TABLE dbo.Asins(AsinCode nvarchar(30),SellerId varchar(50)); CREATE UNIQUE INDEX UX_Catalog ON dbo.Asins(AsinCode,SellerId); INSERT dbo.Asins VALUES ('B000000001','s1'),('B000000001','s2'),('B000000001','s3'),('B000000002','s2'); CREATE TABLE dbo.AdsPerformance(Id int PRIMARY KEY); INSERT dbo.AdsPerformance VALUES(42);");
  await up(pool);
  const write=(sellerId,rows,actor=user)=>ingestCanonicalReport({pool,sql,user:actor,sellerId,reportType:'daily',input:csv(rows)});
  const first=await write('s1',[base,{...base,date:'2026-04-02','metrics.spend':'0','metrics.total_sales':'-1.25','metrics.ordered_revenue':'-1.25','metrics.new_to_brand_sales':''},{asin:base.asin,date:'2026-04-03'}]);
  assert.equal(first.inserted,3);assert.equal(first.unchanged,0);
  const replay=await write('s1',[base]);assert.equal(replay.inserted,0);assert.equal(replay.unchanged,1);
  const p=await pool.request().query("SELECT CONVERT(varchar(80),NewToBrandSales) AS ntb, SourceFileSha256,SourceRowNumber,ImportedBy,AdvertisedSku FROM dbo.AdsProductDailyFacts WHERE SellerId='s1' AND [Date]='2026-04-01'");
  assert.equal(p.recordset[0].ntb,'1.1234567891');assert.equal(p.recordset[0].SourceFileSha256,first.sourceFileSha256);
  assert.equal(p.recordset[0].SourceRowNumber,2);assert.equal(p.recordset[0].ImportedBy,'u1');assert.equal(p.recordset[0].AdvertisedSku,null);
  await assert.rejects(()=>write('s1',[{...base,date:'2026-04-04'},{...base,'metrics.spend':'999'}]),{code:'historical_conflict'});
  await assert.rejects(()=>write('s1',[{...base,date:'2026-04-05'},{...base,asin:'B000000002'}]),{code:'catalog_ownership_conflict'});
  await assert.rejects(()=>write('s1',[{...base,asin:'B000000003'}]),{code:'catalog_ownership_conflict'});
  await assert.rejects(()=>write('s2',[base],{...user,assignedSellers:['s1']}),{code:'forbidden_seller'});
  await write('s2',[base]);await write('s3',[base]);
  const concurrent=[{...base,date:'2026-04-06'}];
  const results=await Promise.all([write('s1',concurrent),write('s1',concurrent)]);
  assert.equal(results.reduce((s,x)=>s+x.inserted,0),1);assert.equal(results.reduce((s,x)=>s+x.unchanged,0),1);
  const summary=(sellerId,actor=user)=>readCanonicalSummary({pool,sql,user:actor,sellerId,startDate:'2026-04-01',endDate:'2026-04-30'});
  const one=(await summary('s1')).currencies[0];
  assert.equal(one.rowCount,'4');assert.equal(one.totals.totalSales,'38.75');assert.equal(one.totals.sales,'76.5');
  assert.equal(one.totals.totalOrders,'9');assert.equal(one.coverage.spend.populated,'3');assert.equal(one.coverage.spend.missing,'1');
  assert.equal(one.ratios.cvr.value,'25');assert.equal(one.ratios.aov.value,'25.5');
  const all=await summary(undefined);
  assert.equal(all.currencies.length,2);
  assert.equal(all.currencies.find(c=>c.currency==='INR').totals.totalSales,'58.75');
  assert.equal(all.currencies.find(c=>c.currency==='USD').totals.totalSales,'20');
  await assert.rejects(()=>summary('s1,foreign'),{code:'forbidden_seller'});
  const remaining=await pool.request().query("SELECT COUNT(*) AS n FROM dbo.AdsProductDailyFacts; SELECT COUNT(*) AS legacy FROM dbo.AdsPerformance WHERE Id=42; SELECT COUNT(*) AS catalog FROM dbo.Asins;");
  assert.equal(remaining.recordsets[0][0].n,6);assert.equal(remaining.recordsets[1][0].legacy,1);assert.equal(remaining.recordsets[2][0].catalog,4);
 }finally{
  if(priorConfig===undefined)delete process.env.ADS_SELLER_CONTEXT_JSON;else process.env.ADS_SELLER_CONTEXT_JSON=priorConfig;
  if(pool)await pool.close();
  await admin.request().query('ALTER DATABASE ['+database+'] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE ['+database+'];').catch(()=>{});
  await admin.close();
 }
});
