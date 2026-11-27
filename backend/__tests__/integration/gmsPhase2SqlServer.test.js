/**
 * Run only against the disposable SQL Server launched by the CI workflow.
 * Tests the actual migration, preview, durable queue and transactional commit.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
let mockPool, mockSequence = 0;
jest.mock('../../database/db', () => {
  const sql = require(process.env.GMS_TEST_MSSQL_MODULE || 'mssql');
  return {
    sql,
    getPool: async () => mockPool,
    generateId: () => 'batch-' + (++mockSequence),
    withTransaction: async callback => {
      const tx = new sql.Transaction(mockPool);
      await tx.begin();
      try {
        const result = await callback({ request: () => new sql.Request(tx) });
        await tx.commit();
        return result;
      } catch (err) {
        await tx.rollback().catch(()=>{});
        throw err;
      }
    }
  };
});
const sql = require(process.env.GMS_TEST_MSSQL_MODULE || 'mssql');
const migration = require('../../migrations/091_gms_import_jobs');
const service = require('../../services/gmsImportService');
const real = process.env.GMS_SQLSERVER_SMOKE === '1' ? test : test.skip;
async function connect() {
  if (process.env.GMS_TEST_SQLSERVER_HOST !== '127.0.0.1' || !process.env.GMS_TEST_SQLSERVER_PASSWORD) {
    throw new Error('Disposable local SQL Server configuration required');
  }
  const config = { server:'127.0.0.1',port:1433,user:'sa',
    password:process.env.GMS_TEST_SQLSERVER_PASSWORD,database:'tempdb',
    options:{encrypt:false,trustServerCertificate:true},connectionTimeout:4000,requestTimeout:20000 };
  for(let i=0;i<40;i++) {
    const p=new sql.ConnectionPool(config);
    try { await p.connect(); return p; }
    catch(err) { await p.close().catch(()=>{}); if(i===39) throw err; await new Promise(r=>setTimeout(r,2000)); }
  }
}
real('staged reports commit exactly once, reject stale previews and recheck access in real SQL Server', async () => {
  mockPool=await connect();
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gms-sql-'));
  try {
    await mockPool.request().query(
      'CREATE TABLE dbo.Sellers (Id VARCHAR(50) PRIMARY KEY, Marketplace NVARCHAR(50), IsActive BIT);' +
      'CREATE TABLE dbo.Asins (Id VARCHAR(50) PRIMARY KEY, AsinCode NVARCHAR(30), SellerId VARCHAR(50));' +
      'CREATE TABLE dbo.GmsDailyPerformance (Id VARCHAR(50) PRIMARY KEY, Asin NVARCHAR(30), Date DATETIME2, OrderedRevenue DECIMAL(18,2), OrderedUnits INT, CreatedAt DATETIME2);' +
      'CREATE TABLE dbo.Roles (Id VARCHAR(50) PRIMARY KEY, Name NVARCHAR(50));' +
      'CREATE TABLE dbo.Users (Id VARCHAR(50) PRIMARY KEY, RoleId VARCHAR(50), IsActive BIT);' +
      'CREATE TABLE dbo.Permissions (Id VARCHAR(50) PRIMARY KEY, Name NVARCHAR(100));' +
      'CREATE TABLE dbo.RolePermissions (RoleId VARCHAR(50), PermissionId VARCHAR(50));' +
      'CREATE TABLE dbo.UserSellers (UserId VARCHAR(50), SellerId VARCHAR(50));'
    );
    await mockPool.request().query('CREATE FUNCTION dbo.GetEnvDate() RETURNS DATETIME2 AS BEGIN RETURN GETUTCDATE(); END');
    await migration.up(mockPool);
    await migration.up(mockPool);
    await mockPool.request().query(
      "INSERT INTO Sellers VALUES('S1','amazon.in',1);" +
      "INSERT INTO Asins VALUES('A1','B000000001','S1');" +
      "INSERT INTO Roles VALUES('R1','brand_manager');" +
      "INSERT INTO Users VALUES('U1','R1',1);" +
      "INSERT INTO Permissions VALUES('P1','gms_tracker_import');" +
      "INSERT INTO RolePermissions VALUES('R1','P1');" +
      "INSERT INTO UserSellers VALUES('U1','S1');"
    );
    const user={id:'U1',role:{name:'brand_manager'},assignedSellers:['S1'],permissions:['gms_tracker_import']};
    const preview=async revenue=>{
      const file=path.join(dir,'report-'+mockSequence);
      fs.writeFileSync(file,'ASIN,Date,Brand,StoreCode,Ordered Revenue,Ordered Units,Shipped Revenue,Shipped COGS,Shipped Units,Customer Returns\nB000000001,2026-11-27,Brand A,IN,'+revenue+',1,100,50,1,0');
      return service.createPreview(user,{path:file,originalname:'report.csv'});
    };
    const facts=async()=> (await mockPool.request().query('SELECT SellerId,OrderedRevenue FROM GmsDailyPerformance')).recordset;
    const first=await preview('123.45');
    expect(first.status).toBe('READY');
    expect(first.summary.inserted).toBe(1);
    expect(await facts()).toHaveLength(0);
    expect(await service.getJob('U2',first.id)).toBeNull();
    expect(await service.confirm('U2',first.id)).toBeNull();
    expect((await service.confirm('U1',first.id)).status).toBe('QUEUED');
    expect((await service.confirm('U1',first.id)).status).toBe('QUEUED');
    await Promise.all([service.processNext(),service.processNext()]);
    const complete=await service.getJob('U1',first.id);
    expect(complete.status).toBe('COMPLETED');
    expect(complete.summary.committed).toBe(1);
    expect(await facts()).toEqual([{SellerId:'S1',OrderedRevenue:123.45}]);
    expect((await service.confirm('U1',first.id)).status).toBe('COMPLETED');
    const duplicate=await preview('123.45');
    expect(duplicate.summary.unchanged).toBe(1);
    await service.confirm('U1',duplicate.id); await service.processNext();
    expect((await service.getJob('U1',duplicate.id)).summary.committed).toBe(0);
    const correction=await preview('150.25');
    expect(correction.summary.updated).toBe(1);
    await service.confirm('U1',correction.id); await service.processNext();
    expect(await facts()).toEqual([{SellerId:'S1',OrderedRevenue:150.25}]);
    const stale=await preview('160.00');
    await mockPool.request().query('UPDATE GmsDailyPerformance SET OrderedRevenue=155.00');
    await service.confirm('U1',stale.id); await service.processNext();
    expect((await service.getJob('U1',stale.id)).status).toBe('FAILED');
    expect(await facts()).toEqual([{SellerId:'S1',OrderedRevenue:155}]);
    const revoked=await preview('170.00');
    await service.confirm('U1',revoked.id);
    await mockPool.request().query("UPDATE Users SET IsActive=0 WHERE Id='U1'");
    await service.processNext();
    expect((await service.getJob('U1',revoked.id)).status).toBe('FAILED');
    expect(await facts()).toEqual([{SellerId:'S1',OrderedRevenue:155}]);
  } finally {
    fs.rmSync(dir,{recursive:true,force:true});
    await mockPool.close();
  }
}, 180000);
