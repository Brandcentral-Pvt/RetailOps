'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {up}=require('../migrations/100_ads_permissions');
const {ADS_PERMISSIONS,inspectAdsPermissions,ensureAdsPermissions}=require('../database/adsPermissions');
test('SQL: permission registry repair is additive, idempotent and preserves all grants',{skip:process.env.ADS_SQL_SMOKE!=='1',timeout:120000},async()=>{
 const sql=require(process.env.ADS_TEST_MSSQL_MODULE||'mssql');
 const config={server:'127.0.0.1',user:'sa',password:process.env.ADS_TEST_SQL_PASSWORD,options:{trustServerCertificate:true,encrypt:false}};
 let admin,pool;const database='AdsPermissions_'+Date.now();
 for(let i=0;i<40;i++){const c=new sql.ConnectionPool(config);try{admin=await c.connect();break;}catch{await c.close().catch(()=>{});await new Promise(r=>setTimeout(r,1000));}}
 assert.ok(admin);
 try{
  await admin.request().query('CREATE DATABASE ['+database+']');
  pool=await new sql.ConnectionPool({...config,database}).connect();
  await pool.request().query("CREATE TABLE dbo.Permissions(Id varchar(50) PRIMARY KEY,Name nvarchar(100) UNIQUE NOT NULL,DisplayName nvarchar(200) NOT NULL,Description nvarchar(max),Category nvarchar(50) NOT NULL,Action nvarchar(50) NOT NULL,CreatedAt datetime2 NOT NULL); CREATE TABLE dbo.RolePermissions(RoleId varchar(50),PermissionId varchar(50) REFERENCES dbo.Permissions(Id),PRIMARY KEY(RoleId,PermissionId)); INSERT dbo.Permissions VALUES('old-view','adsreport_view','Old view','Old','Reports','view',SYSUTCDATETIME()),('unrelated','gms_tracker_import','GMS','Unchanged','GMS Tracker','import',SYSUTCDATETIME()); INSERT dbo.RolePermissions VALUES('existing-role','old-view'),('existing-role','unrelated');");
  const before=await inspectAdsPermissions(pool);assert.equal(before.ready,false);assert.equal(before.missing.length,2);assert.deepEqual(before.outdated,['adsreport_view']);
  assert.equal((await ensureAdsPermissions({pool,apply:false})).ready,false);
  assert.equal((await ensureAdsPermissions({pool,apply:true})).ready,true);
  await up(pool);await up(pool);
  const r=await pool.request().query('SELECT Id,Name,Category FROM dbo.Permissions ORDER BY Name; SELECT RoleId,PermissionId FROM dbo.RolePermissions ORDER BY PermissionId;');
  assert.equal(r.recordsets[0].length,4);
  for(const p of ADS_PERMISSIONS)assert.ok(r.recordsets[0].some(x=>x.Name===p.name&&x.Category==='Ads Intelligence'));
  assert.equal(r.recordsets[0].find(x=>x.Name==='adsreport_view').Id,'old-view');
  assert.equal(r.recordsets[0].find(x=>x.Name==='gms_tracker_import').Category,'GMS Tracker');
  assert.deepEqual(r.recordsets[1],[{RoleId:'existing-role',PermissionId:'old-view'},{RoleId:'existing-role',PermissionId:'unrelated'}]);
  assert.equal((await inspectAdsPermissions(pool)).ready,true);
 }finally{if(pool)await pool.close();await admin.request().query('ALTER DATABASE ['+database+'] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE ['+database+'];').catch(()=>{});await admin.close();}
});
