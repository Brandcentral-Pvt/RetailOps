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
const { inspectGmsSchema, ensureGmsSchema } = require('../../database/gmsSchema');
const migration = require('../../migrations/091_gms_import_jobs');
const nullableMigration = require('../../migrations/092_gms_nullable_seller');
const { gmsCatalogApplySql } = require('../../utils/gmsPhase1');
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
      'CREATE TABLE dbo.Asins (Id VARCHAR(50) PRIMARY KEY, AsinCode NVARCHAR(30), SellerId VARCHAR(50), Title NVARCHAR(MAX));' +
      'CREATE TABLE dbo.GmsDailyPerformance (Id VARCHAR(50) PRIMARY KEY, Asin NVARCHAR(30), Date DATETIME2, OrderedRevenue DECIMAL(18,2), OrderedUnits INT, CreatedAt DATETIME2);' +
      'CREATE TABLE dbo.Roles (Id VARCHAR(50) PRIMARY KEY, Name NVARCHAR(50));' +
      'CREATE TABLE dbo.Users (Id VARCHAR(50) PRIMARY KEY, RoleId VARCHAR(50), IsActive BIT);' +
      'CREATE TABLE dbo.Permissions (Id VARCHAR(50) PRIMARY KEY, Name NVARCHAR(100));' +
      'CREATE TABLE dbo.RolePermissions (RoleId VARCHAR(50), PermissionId VARCHAR(50));' +
      'CREATE TABLE dbo.UserSellers (UserId VARCHAR(50), SellerId VARCHAR(50));'
    );
    await mockPool.request().query('CREATE FUNCTION dbo.GetEnvDate() RETURNS DATETIME2 AS BEGIN RETURN GETUTCDATE(); END');
    const before = await inspectGmsSchema(mockPool);
    expect(before.ready).toBe(false);
    expect(before.missing).toEqual(expect.arrayContaining(['GmsImportJobs','GmsDailyPerformance.SellerId']));
    const readOnly = await ensureGmsSchema({ pool: mockPool });
    expect(readOnly.ready).toBe(false);
    const repaired = await ensureGmsSchema({ apply:true, pool:mockPool });
    expect(repaired).toMatchObject({ready:true,missing:[]});
    await migration.up(mockPool);
    expect((await inspectGmsSchema(mockPool)).ready).toBe(true);
    await mockPool.request().query('ALTER TABLE dbo.GmsDailyPerformance ALTER COLUMN SellerId VARCHAR(50) NOT NULL; CREATE INDEX IX_Test_Gms_Seller_Date ON dbo.GmsDailyPerformance(SellerId,Date)');
    expect((await inspectGmsSchema(mockPool)).ready).toBe(false);
    await nullableMigration.up(mockPool);
    await nullableMigration.up(mockPool);
    expect((await inspectGmsSchema(mockPool)).ready).toBe(true);
    await mockPool.request().query(
      "INSERT INTO Sellers VALUES('S1','legacy-marketplace',0);" +
      "INSERT INTO Asins VALUES('A1','B000000001','S1',NULL);" +
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
    const facts=async()=> (await mockPool.request().query('SELECT SellerId,OrderedRevenue FROM GmsDailyPerformance WHERE Asin=\'B000000001\'')).recordset;
    const rejectedFile=path.join(dir,'rejected.csv');
    fs.writeFileSync(rejectedFile,'ASIN,Date,Brand,StoreCode,Ordered Revenue,Ordered Units,Shipped Revenue,Shipped COGS,Shipped Units,Customer Returns\n'+Array.from({length:205},(_,i)=>'B'+String(i).padStart(9,'0')+',2026-11-27,Brand A,IN,bad,1,100,50,1,0').join('\n'));
    const rejected=await service.createPreview(user,{path:rejectedFile,originalname:'rejected.csv'});
    expect(rejected.status).toBe('REJECTED');
    expect(rejected.summary).toMatchObject({invalid:205,reportIssueCount:205,reportComplete:true});
    expect(rejected.summary.issues).toHaveLength(200);
    expect(rejected.summary.issues[0].remarks).toContain('Enter a valid amount');
    expect(await service.getIssueReport('U2',rejected.id)).toBeNull();
    const completeReport=await service.getIssueReport('U1',rejected.id);
    expect(completeReport.legacy).toBe(false);
    expect(completeReport.issues).toHaveLength(205);
    expect(completeReport.issues[204]).toMatchObject({row:206,asin:'B000000204'});
    expect(await facts()).toHaveLength(0);
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
    // A global importer can retain a missing catalog ASIN without a seller.
    await mockPool.request().query("INSERT INTO Roles VALUES('RG','admin'); INSERT INTO Users VALUES('UG','RG',1); INSERT INTO RolePermissions VALUES('RG','P1')");
    const global={id:'UG',role:{name:'admin'},permissions:['gms_tracker_import'],assignedSellers:[]};
    const unmatchedPreview=async revenue=>{
      const file=path.join(dir,'unmatched-'+mockSequence);
      fs.writeFileSync(file,'ASIN,Date,Brand,StoreCode,Ordered Revenue,Ordered Units,Shipped Revenue,Shipped COGS,Shipped Units,Customer Returns\nB000000002,2026-11-27,Sheet Brand,IN,'+revenue+',1,0,0,0,0');
      return service.createPreview(global,{path:file,originalname:'unmatched.csv'});
    };
    const missing=await unmatchedPreview('25.00');
    expect(missing.status).toBe('READY');
    expect(missing.summary).toMatchObject({unmatched:1,invalid:0});
    await service.confirm('UG',missing.id); await service.processNext();
    expect((await service.getJob('UG',missing.id)).status).toBe('COMPLETED');
    const correctionMissing=await unmatchedPreview('26.00');
    await service.confirm('UG',correctionMissing.id); await service.processNext();
    const orphanFact=await mockPool.request().query("SELECT SellerId,Brand,OrderedRevenue FROM GmsDailyPerformance WHERE Asin='B000000002'");
    expect(orphanFact.recordset).toEqual([{SellerId:null,Brand:'Sheet Brand',OrderedRevenue:26}]);
    const signedFile=path.join(dir,'signed-adjustment.csv');
    fs.writeFileSync(signedFile,'ASIN,Date,Brand,StoreCode,Ordered Revenue,Ordered Units,Shipped Revenue,Shipped COGS,Shipped Units,Customer Returns\nB000000002,2026-11-27,Sheet Brand,IN,-125.50,-2,-25.00,-5.00,-1,');
    const signed=await service.createPreview(global,{path:signedFile,originalname:'signed.csv'});
    expect(signed.summary).toMatchObject({invalid:0,defaultedCells:1,negativeRows:1,updated:1});
    await service.confirm('UG',signed.id); await service.processNext();
    expect((await service.getJob('UG',signed.id)).status).toBe('COMPLETED');
    const persisted=await mockPool.request().query("SELECT OrderedRevenue,OrderedUnits,ShippedRevenue,ShippedCOGS,ShippedUnits,CustomerReturns FROM GmsDailyPerformance WHERE Asin='B000000002'");
    expect(persisted.recordset).toEqual([{OrderedRevenue:-125.5,OrderedUnits:-2,ShippedRevenue:-25,ShippedCOGS:-5,ShippedUnits:-1,CustomerReturns:0}]);
    await mockPool.request().query("INSERT INTO Asins VALUES('A2','B000000002','S1',NULL),('A3','B000000002','S1',NULL)");
    const mapped=await mockPool.request().query("SELECT COALESCE(g.SellerId,a.SellerId) AS sellerId,g.Brand FROM GmsDailyPerformance g "+gmsCatalogApplySql+" WHERE g.Asin='B000000002'");
    expect(mapped.recordset).toEqual([{sellerId:'S1',Brand:'Sheet Brand'}]);
    // Existing mapped fact test below is scoped to its original ASIN.
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
