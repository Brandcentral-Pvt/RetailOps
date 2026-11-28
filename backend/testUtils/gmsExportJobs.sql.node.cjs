'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const jobs=require('../services/gmsExportJobs');
const XLSX=require('xlsx');
test('durable GMS queue uses canonical finance data, survives a stale lease and verifies downloads',{skip:process.env.GMS_SQLSERVER_SMOKE!=='1',timeout:180000},async()=>{
 const sql=require('mssql'),config={server:'127.0.0.1',user:'sa',password:process.env.GMS_TEST_SQLSERVER_PASSWORD,options:{trustServerCertificate:true,encrypt:false},requestTimeout:60000};
 let admin,pool,dir;const database='GmsExports_'+Date.now();
 for(let i=0;i<40;i++){const c=new sql.ConnectionPool(config);try{admin=await c.connect();break;}catch{await c.close().catch(()=>{});await new Promise(r=>setTimeout(r,1000));}}
 assert.ok(admin);
 try{
 await admin.request().query('CREATE DATABASE ['+database+']');pool=await new sql.ConnectionPool({...config,database}).connect();
 await pool.request().query("CREATE TABLE dbo.Sellers(Id varchar(50) PRIMARY KEY,Name nvarchar(255)); INSERT dbo.Sellers VALUES('s1','One'),('s2','Two'); CREATE TABLE dbo.Asins(Id varchar(50),AsinCode nvarchar(30),SellerId varchar(50),Title nvarchar(max)); INSERT dbo.Asins VALUES('a1','B000000001','s1','Product'),('a2','B000000002','s2','Foreign'); CREATE TABLE dbo.GmsDailyPerformance(Id varchar(50),SellerId varchar(50),Asin nvarchar(30),[Date] date,Brand nvarchar(255),StoreCode nvarchar(20),ReportProductTitle nvarchar(max),OrderedRevenue decimal(18,2),OrderedUnits int,ShippedRevenue decimal(18,2),ShippedCOGS decimal(18,2),ShippedUnits int,CustomerReturns int); INSERT dbo.GmsDailyPerformance VALUES('f1','s1','B000000001','2026-04-01','A','IN','Original',100.25,2,90,40,2,0),('f2','s2','B000000002','2026-04-01','B','IN','Foreign',999,1,999,10,1,0); CREATE TABLE dbo.Roles(Id varchar(50),Name nvarchar(50),DisplayName nvarchar(100),IsActive bit); INSERT dbo.Roles VALUES('r1','brand_manager','Brand manager',1); CREATE TABLE dbo.Users(Id varchar(50),RoleId varchar(50),IsActive bit,ExtraPermissions nvarchar(max),ExcludedPermissions nvarchar(max),ForcePasswordReset bit,PasswordExpiresAt datetime2,IsFirstLogin bit,SetupCompletedAt datetime2); INSERT dbo.Users VALUES('u1','r1',1,NULL,NULL,0,NULL,0,NULL); CREATE TABLE dbo.Permissions(Id varchar(50),Name nvarchar(100)); INSERT dbo.Permissions VALUES('p1','gms_tracker_export'); CREATE TABLE dbo.RolePermissions(RoleId varchar(50),PermissionId varchar(50)); INSERT dbo.RolePermissions VALUES('r1','p1'); CREATE TABLE dbo.UserSellers(UserId varchar(50),SellerId varchar(50)); INSERT dbo.UserSellers VALUES('u1','s1');");
 assert.equal(await jobs.ensureSchema(pool,false),false);assert.equal(await jobs.ensureSchema(pool,true),true);assert.equal(await jobs.ensureSchema(pool,true),true);
 const user={Id:'u1',role:{Name:'brand_manager'},assignedSellers:['s1'],permissions:['gms_tracker_export']},ctx={pool,sql,user};
 const filters={exportDateType:'current',startDate:'2026-04-01',endDate:'2026-04-01',exportBrandType:'current',sellerIds:null};
 const create=(f=filters,format='xlsx',clientId=randomUUID())=>jobs.createJob({...ctx,body:{filters:f,format,clientId}});
 const client=randomUUID(),job=await create(filters,'xlsx',client);assert.equal(job.status,'QUEUED');assert.equal((await create(filters,'xlsx',client)).id,job.id);
 await assert.rejects(()=>create({...filters,sellerIds:[]}),{code:'empty_scope'});
 await assert.rejects(()=>create({...filters,sellerIds:['s1','s2']}),{code:'forbidden_seller'});
 await assert.rejects(()=>jobs.getJob({...ctx,id:job.id,user:{...user,Id:'u2'}}),{code:'export_not_found'});
 const lease=await jobs.claimNext(pool,sql);
 await pool.request().input('id',sql.VarChar(36),job.id).query("UPDATE dbo.GmsExportJobs SET LeaseUntil=DATEADD(second,-1,SYSUTCDATETIME()) WHERE Id=@id");
 assert.equal(await jobs.refreshLease(pool,sql,lease),false);assert.equal(await jobs.processNext(pool,sql),true);
 const completed=await jobs.getJob({...ctx,id:job.id});assert.equal(completed.status,'COMPLETED');assert.equal(completed.rawCount,1);assert.equal(completed.attemptCount,2);
 dir=await fs.mkdtemp(path.join(os.tmpdir(),'gms-export-test-'));const filePath=path.join(dir,'report.xlsx');
 await jobs.spoolDownload({...ctx,id:job.id,filePath});
 const book=XLSX.readFile(filePath);assert.ok(book.SheetNames.includes('Complete Data'));assert.ok(book.SheetNames.includes('GMS Matrix'));
 assert.doesNotMatch(JSON.stringify(XLSX.utils.sheet_to_json(book.Sheets['Complete Data'])),/Foreign/);
 const csv=await create({...filters,exportDateType:'all'},'csv');await jobs.processNext(pool,sql);assert.equal((await jobs.getJob({...ctx,id:csv.id})).status,'COMPLETED');
 const cancelled=await create();await jobs.mutate({...ctx,id:cancelled.id,action:'cancel'});assert.equal((await jobs.getJob({...ctx,id:cancelled.id})).status,'CANCELLED');
 await assert.rejects(()=>jobs.getJob({...ctx,id:job.id,user:{...user,assignedSellers:[]}}),{code:'forbidden_seller'});
 }finally{if(dir)await fs.rm(dir,{recursive:true,force:true});if(pool)await pool.close();await admin.request().query('ALTER DATABASE ['+database+'] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE ['+database+'];').catch(()=>{});await admin.close();}
});
