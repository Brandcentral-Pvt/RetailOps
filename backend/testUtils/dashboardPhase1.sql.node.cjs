'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
test('Dashboard SQL: seller ownership, duplicate catalog protection, exact cents and unknown observations',{skip:process.env.ADS_SQL_SMOKE!=='1',timeout:120000},async()=>{
 const sql=require(process.env.ADS_TEST_MSSQL_MODULE||'mssql');
 const cfg={server:'127.0.0.1',user:'sa',password:process.env.ADS_TEST_SQL_PASSWORD,options:{trustServerCertificate:true,encrypt:false,useUTC:false}};
 let admin,pool;
 const database='DashboardPhase1_'+Date.now();
 for(let i=0;i<40;i++){const c=new sql.ConnectionPool(cfg);try{admin=await c.connect();break;}catch{await c.close().catch(()=>{});await new Promise(r=>setTimeout(r,1000));}}
 assert.ok(admin,'SQL server available');
 try{
  await admin.request().query('CREATE DATABASE ['+database+']');
  pool=await new sql.ConnectionPool({...cfg,database}).connect();
  await pool.request().query(`
  CREATE TABLE dbo.Sellers(Id varchar(50) PRIMARY KEY,Name nvarchar(255),Marketplace nvarchar(50),IsActive bit);
  INSERT dbo.Sellers VALUES('s1','One','amazon.in',1),('s2','Two','amazon.in',1);
  CREATE TABLE dbo.Asins(Id varchar(50) PRIMARY KEY,AsinCode nvarchar(30),SellerId varchar(50),Title nvarchar(255),Sku nvarchar(255),Category nvarchar(100),Brand nvarchar(100),ParentAsin nvarchar(30),CurrentPrice decimal(18,2),ImageUrl nvarchar(255),Status nvarchar(20),AvailabilityStatus nvarchar(50),CreatedAt datetime2);
  INSERT dbo.Asins(Id,AsinCode,SellerId,Title,Status) VALUES
   ('a1','B000000001','s1','Unique','Active'),
   ('a2','B000000001','s1','Duplicate same owner','Active'),
   ('a3','B000000002','s1','Shared one','Active'),
   ('a4','B000000002','s2','Shared two','Active');
  CREATE TABLE dbo.Roles(Id varchar(50) PRIMARY KEY,Name nvarchar(50),Level int);
  INSERT dbo.Roles VALUES('r1','brand_manager',2);
  CREATE TABLE dbo.Users(Id varchar(50) PRIMARY KEY,FirstName nvarchar(50),LastName nvarchar(50),RoleId varchar(50),IsActive bit);
  INSERT dbo.Users VALUES('m1','First','Manager','r1',1),('m2','Second','Manager','r1',1),('m3','No','Assignments','r1',1),('m4','Inactive','Manager','r1',0);
  CREATE TABLE dbo.UserSellers(UserId varchar(50),SellerId varchar(50));
  INSERT dbo.UserSellers VALUES('m1','s1'),('m2','s2'),('m4','s1');
  CREATE TABLE dbo.Alerts(Id varchar(50),SellerId varchar(50),Severity nvarchar(50),Message nvarchar(255),CreatedAt datetime2);
  CREATE TABLE dbo.Actions(AssignedTo varchar(50),Status nvarchar(50));
  CREATE TABLE dbo.GmsDailyPerformance(Id varchar(50) PRIMARY KEY,Asin nvarchar(30),SellerId varchar(50),[Date] date,OrderedRevenue decimal(18,2),OrderedUnits int,ShippedRevenue decimal(18,2),CustomerReturns int);
  INSERT dbo.GmsDailyPerformance VALUES
   ('f1','B000000001','s1','2026-04-01',100.01,1,90,0),
   ('f2','B000000001',NULL,'2026-04-02',0.02,1,NULL,0),
   ('f3','B000000002','s2','2026-04-02',50.05,1,40,0),
   ('f4','B000000002','s1','2026-04-03',20.03,1,20,0),
   ('f5','B000000002',NULL,'2026-04-04',30.04,1,30,0),
   ('f6','B000000001','s1','2026-03-31',10.00,1,9,0);
  CREATE TABLE dbo.AdsProductDailyFacts(Asin varchar(10),SellerId varchar(50),[Date] date,ReportType varchar(20),Currency char(3),AdSales decimal(28,10),AdSpend decimal(28,10),TotalSales decimal(28,10),OrganicSales decimal(28,10),Orders bigint,Impressions bigint,Clicks bigint);
  INSERT dbo.AdsProductDailyFacts VALUES('B000000001','s1','2026-04-01','daily','INR',20,10,100,80,1,100,10);
  `);
  // Inject the disposable pool before requiring the production controller.
  const dbPath=require.resolve('../database/db');
  const previous=require.cache[dbPath];
  require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:{sql,getPool:async()=>pool}};
  try{
   const {getDashboardData}=require('../controllers/dashboardController');
   const request=async(user,extra={})=>{
    let status=200,data;
    const res={status(s){status=s;return this;},json(v){data=v;return this;}};
    await getDashboardData({user,query:{startDate:'2026-04-01',endDate:'2026-04-04',...extra}},res);
    assert.equal(status,200,JSON.stringify(data));return data;
   };
   const manager={Id:'u1',role:{name:'brand_manager'},assignedSellers:['s1']};
   const adminUser={Id:'u2',role:{name:'admin'}};
   const scoped=await request(manager);
   const overview=await request(manager,{mode:'overview'});
   const products=await request(manager,{mode:'products'});
   assert.equal(overview.productsIncluded,false);
   assert.deepEqual(overview.tableData,[]);
   assert.deepEqual(overview.gms.series,scoped.gms.series);
   assert.deepEqual(overview.ads,scoped.ads);
   assert.deepEqual(products.tableData,scoped.tableData);
   assert.equal(products.gmsRevenue,overview.gms.revenue);
   assert.deepEqual(products.period,overview.period);
   assert.deepEqual(products.scope,overview.scope);
   const next=await request(manager,{mode:'overview',startDate:'2026-04-02',endDate:'2026-04-02'});
   assert.equal(next.period.days,1);
   assert.equal(next.period.startDate,'2026-04-02');
   assert.equal(next.gms.revenue,0.02);
   assert.deepEqual(next.gms.series,[0.02]);
   const nextProducts=await request(manager,{mode:'products',startDate:'2026-04-02',endDate:'2026-04-02'});
   assert.equal(nextProducts.tableData[0].gmsRevenue,0.02);
   assert.equal(nextProducts.gmsRevenue,0.02);
   assert.equal(scoped.gms.revenue,100.03);
   assert.equal(scoped.gms.shippedRevenue,null);
   assert.equal(scoped.gms.prevRevenue,10);
   assert.equal(scoped.gms.deltaPct,null);
   assert.deepEqual(scoped.gms.series,[100.01,0.02,null,null]);
   assert.equal(scoped.tableData.length,1);
   assert.equal(scoped.tableData[0].gmsRevenue,100.03);
   assert.deepEqual(scoped.tableData[0].trend,[100.01,0.02,null,null]);
   assert.equal(scoped.gmsBySeller[0].revenue,100.03);
   assert.equal(scoped.ads.tacos,10);
   const wide=await request(adminUser);
   assert.equal(wide.gms.revenue,200.15);
   assert.equal(wide.tableData.length,3);
   assert.equal(wide.tableData.find(r=>r.asin==='B000000002'&&r.sellerId==='s1').gmsRevenue,20.03);
   assert.deepEqual(wide.tableData.find(r=>r.asin==='B000000002'&&r.sellerId==='s2').trend,[null,50.05,null,null]);
   assert.equal(wide.gmsBySeller.find(r=>r.sellerId===null).revenue,30.04);
   const selected=await request(adminUser,{sellerId:'s1'});
   assert.equal(selected.gms.revenue,120.06);
   const empty=await request({...manager,assignedSellers:[]});
   assert.equal(empty.gms.revenue,null);
   assert.deepEqual(empty.tableData,[]);
   // Phase 2: manager assignment must intersect both selected seller and actor.
   const mgrOne=await request(adminUser,{managerId:'m1'});
   assert.equal(mgrOne.gms.revenue,120.06);
   assert.deepEqual(mgrOne.scope,{sellerIds:['s1'],unrestricted:false,empty:false,managerId:'m1'});
   for(const result of [
     await request(adminUser,{managerId:'m3'}),
     await request(adminUser,{managerId:'m4'}),
     await request(adminUser,{managerId:'m2',sellerId:'s1'}),
     await request(manager,{managerId:'m2'})
   ]){
    assert.equal(result.scope.empty,true);
    assert.equal(result.gms.revenue,null);
    assert.equal(result.ads.adSpend,null);
    assert.equal(result.stats.totalAsins,0);
    assert.deepEqual(result.tableData,[]);
   }
   const {getDashboardOptions}=require('../controllers/dashboardController');
   let optionResponse;
   await getDashboardOptions({user:manager},{set(){},json(v){optionResponse=v;},status(){return this;}});
   assert.equal(optionResponse.success,true);
   assert.deepEqual(optionResponse.data.sellers.map(s=>s.id),['s1']);
   assert.deepEqual(optionResponse.data.managers.map(m=>m.id),['m1']);
   await pool.request().query("DELETE FROM dbo.UserSellers WHERE UserId='m1'");
   assert.equal((await request(adminUser,{managerId:'m1'})).scope.empty,true);
  }finally{if(previous)require.cache[dbPath]=previous;else delete require.cache[dbPath];}
 }finally{
  if(pool)await pool.close();
  await admin.request().query('ALTER DATABASE ['+database+'] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE ['+database+']');
  await admin.close();
 }
});
