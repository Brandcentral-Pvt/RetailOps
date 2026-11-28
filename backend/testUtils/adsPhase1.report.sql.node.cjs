'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {up}=require('../migrations/098_ads_product_daily_facts');
const {readCanonicalReport,readCanonicalOptions}=require('../services/adsCanonicalReport');
const {readCanonicalTargets}=require('../services/adsCanonicalTargets');
test('SQL: canonical scope, duplicate catalog protection, current/prior comparison, exact metrics and pagination',{skip:process.env.ADS_SQL_SMOKE!=='1',timeout:120000},async()=>{
 const sql=require(process.env.ADS_TEST_MSSQL_MODULE||'mssql');
 const config={server:'127.0.0.1',user:'sa',password:process.env.ADS_TEST_SQL_PASSWORD,options:{trustServerCertificate:true,encrypt:false}};
 let admin,pool;const database='AdsReport_'+Date.now();
 for(let i=0;i<40;i++){const c=new sql.ConnectionPool(config);try{admin=await c.connect();break;}catch{await c.close().catch(()=>{});await new Promise(r=>setTimeout(r,1000));}}
 assert.ok(admin);
 const user={Id:'u',role:{Name:'brand_manager'},assignedSellers:['s1','s2']};
 const range={startDate:'2026-04-01',endDate:'2026-04-30'};
 try{
  await admin.request().query('CREATE DATABASE ['+database+']');
  pool=await new sql.ConnectionPool({...config,database}).connect();
  await pool.request().query("CREATE TABLE dbo.Sellers(Id varchar(50) PRIMARY KEY,Name nvarchar(255),Marketplace nvarchar(50)); INSERT dbo.Sellers VALUES('s1','One','amazon.in'),('s2','Two','amazon.com'),('s3','Foreign','amazon.in'); CREATE TABLE dbo.Asins(AsinCode nvarchar(30),SellerId varchar(50),Title nvarchar(max),Brand nvarchar(255),Category nvarchar(255),ParentAsin nvarchar(30),Sku nvarchar(255)); INSERT dbo.Asins VALUES('B000000001','s1','First','A','Cat','B000000010','sku1'),('B000000001','s1','Duplicate','Other','Cat','B000000099','skuX'),('B000000002','s1','Second','A','Cat','B000000010','sku2'),('B000000003','s1','Prior','A','Cat','B000000010','sku3'),('B000000001','s2','Other seller','B','Cat','B000000020','sku1'),('B000000001','s3','Foreign','C','Cat','B000000030','sku1');");
  await up(pool);
  const prefix="INSERT dbo.AdsProductDailyFacts (SellerId,Marketplace,Currency,ReportType,Asin,[Date],SourceFileSha256,SourceRowNumber,SourceSchemaVersion,ImportedBy,TotalSales,AdSales,AdSpend,Orders,Conversions,TotalOrders,Clicks) VALUES ";
  const row=(s,m,c,a,d,total,sales,spend,orders,conversions,totalOrders,clicks)=>"('"+s+"','"+m+"','"+c+"','daily','"+a+"','"+d+"',REPLICATE('a',64),2,1,'test',"+[total,sales,spend,orders,conversions,totalOrders,clicks].map(v=>v===null?'NULL':v).join(',')+")";
  await pool.request().query(prefix+[
   row('s1','amazon.in','INR','B000000001','2026-04-01','100.01','120','10',2,1,3,4),
   row('s1','amazon.in','INR','B000000001','2026-04-02','-1.25',null,null,null,null,-1,null),
   row('s1','amazon.in','INR','B000000002','2026-04-01','50','20','5',1,1,2,10),
   row('s1','amazon.in','INR','B000000003','2026-03-31','80','25','8',1,1,2,8),
   row('s2','amazon.com','USD','B000000001','2026-04-01','10','8','2',1,1,1,4),
   row('s3','amazon.in','INR','B000000001','2026-04-01','9999','9','1',1,1,1,1)
  ].join(','));
  const read=(extra={},actor=user)=>readCanonicalReport({pool,sql,user:actor,query:{...range,...extra}});
  const r=await read({sellerId:'s1',limit:'2',page:'99'});
  assert.equal(r.current[0].totals.totalSales,'148.76');assert.equal(r.current[0].rowCount,'3');
  assert.equal(r.current[0].unmappedRows,'2');assert.equal(r.current[0].ratios.tacos.value,null);
  assert.equal(r.current[0].ratios.cvr.value,'14.285714');assert.equal(r.previous[0].totals.totalSales,'80');
  assert.equal(r.total,3);assert.equal(r.page,2);assert.equal(r.rows.length,1);assert.equal(r.rows[0].current,null);assert.equal(r.rows[0].previous.totals.totalSales,'80');
  const full=await readCanonicalReport({pool,sql,user,query:{...range,sellerId:'s1',limit:'1',page:'2'},exportAll:true});
  assert.equal(full.rows.length,3);assert.equal(full.total,3);assert.equal(full.page,1);
  const first=await read({sellerId:'s1',limit:'2',sortBy:'totalSales',sortOrder:'desc'});
  assert.equal(first.rows[0].entityKey,'B000000001');assert.equal(first.rows[0].title,null);
  assert.equal(first.rows[0].current.totals.totalSales,'98.76');
  const parent=await read({sellerId:'s1',groupBy:'parent',granularity:'month'});
  assert.equal(parent.total,2);assert.equal(parent.rows.find(x=>x.entityKey==='B000000010').current.totals.totalSales,'50');
  assert.equal(parent.series.find(x=>x.periodKey==='current').bucket,'2026-04');
  const filtered=await read({sellerId:'s1',brand:'A'});
  assert.equal(filtered.current[0].totals.totalSales,'50');
  const portfolio=await read({groupBy:'seller'});
  assert.equal(portfolio.current.length,2);assert.equal(portfolio.current.find(x=>x.currency==='INR').totals.totalSales,'148.76');
  assert.equal(portfolio.current.find(x=>x.currency==='USD').totals.totalSales,'10');
  const drill=await read({sellerId:'s1',entityKey:'B000000001',marketplace:'amazon.in',currency:'INR'});
  assert.equal(drill.current[0].totals.totalSales,'98.76');assert.equal(drill.rows.length,0);
  const weekly=await read({sellerId:'s1',granularity:'week'});
  assert.equal(weekly.current[0].totals.totalSales,'148.76');assert.ok(weekly.series.some(x=>x.bucket==='2026-03-30'));
  await assert.rejects(()=>read({sellerId:'s1,s3'}),{code:'forbidden_seller'});
  const opts=await readCanonicalOptions({pool,sql,user,sellerId:'s1'});
  assert.deepEqual(opts.sellers.map(s=>s.id),['s1','s2']);assert.deepEqual(opts.brands,['A','Other']);assert.equal(opts.parentAvailable,true);
  await pool.request().query("CREATE TABLE dbo.GmsTargets(Id varchar(50),SellerId varchar(50),GoalType varchar(20),TargetType varchar(20),[Year] int,[Month] int,TotalTargetValue decimal(18,2)); CREATE TABLE dbo.GmsTargetBreakdowns(TargetId varchar(50),PeriodType varchar(20),PeriodValue int,TargetValue decimal(18,2)); INSERT dbo.GmsTargets VALUES('m1','s1','ADS','MONTHLY',2026,4,100),('y1','s1','ADS','YEARLY',2026,NULL,1200),('m2','s1','ACOS','MONTHLY',2026,4,20),('m3','s3','ADS','MONTHLY',2026,4,9999); INSERT dbo.GmsTargetBreakdowns VALUES('y1','MONTH',4,200);");
  const target=await readCanonicalTargets({pool,sql,user,query:{...range,sellerId:'s1'}});
  assert.equal(target.rows.length,2);assert.equal(Number(target.rows.find(x=>x.goalType==='ADS').target),100);assert.equal(target.rows.find(x=>x.goalType==='ADS').actual,'15');
  assert.equal(target.rows.find(x=>x.goalType==='ADS').attainmentPct,null);
  await assert.rejects(()=>readCanonicalTargets({pool,sql,user,query:{...range,sellerId:'s1,s3'}}),{code:'forbidden_seller'});
  const empty=await read({startDate:'2026-11-01',endDate:'2026-11-30'});
  assert.equal(empty.empty,true);assert.equal(empty.total,0);
 }finally{if(pool)await pool.close();await admin.request().query('ALTER DATABASE ['+database+'] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE ['+database+'];').catch(()=>{});await admin.close();}
});
