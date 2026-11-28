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
const { loadAnalytics,queryFacts } = require('../../services/gmsAnalyticsService');
const { buildCompleteExport }=require('../../services/gmsCompleteExport');
const { writeGmsExport }=require('../../services/gmsExportWriter');
const XLSX=require('xlsx');
const { loadPagedAnalytics } = require('../../services/gmsAnalyticsPageService');
const { loadGmsFilters } = require('../../services/gmsAnalyticsFilters');
const analyticsIndex=require('../../migrations/094_gms_analytics_date_index');
const service = require('../../services/gmsImportService');
const real = process.env.GMS_SQLSERVER_SMOKE === '1' ? test : test.skip;
const scaleRows=Number(process.env.GMS_SQL_SCALE_ROWS||0);
if(![0,100000,500000].includes(scaleRows))throw new Error('Unsupported disposable GMS scale fixture size');
async function connect() {
  if (process.env.GMS_TEST_SQLSERVER_HOST !== '127.0.0.1' || !process.env.GMS_TEST_SQLSERVER_PASSWORD) {
    throw new Error('Disposable local SQL Server configuration required');
  }
  const config = { server:'127.0.0.1',port:1433,user:'sa',
    password:process.env.GMS_TEST_SQLSERVER_PASSWORD,database:'tempdb',
    options:{encrypt:false,trustServerCertificate:true},connectionTimeout:4000,requestTimeout:scaleRows?240000:20000 };
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
      'CREATE TABLE dbo.Sellers (Id VARCHAR(50) PRIMARY KEY, Marketplace NVARCHAR(50), IsActive BIT, Name NVARCHAR(255));' +
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
      "INSERT INTO Sellers VALUES('S1','legacy-marketplace',0,'Seller A');" +
      "INSERT INTO Asins VALUES('A1','B000000001','S1',NULL);" +
      "INSERT INTO Roles VALUES('R1','brand_manager');" +
      "INSERT INTO Users VALUES('U1','R1',1);" +
      "INSERT INTO Permissions VALUES('P1','gms_tracker_import');" +
      "INSERT INTO RolePermissions VALUES('R1','P1');" +
      "INSERT INTO UserSellers VALUES('U1','S1');"
    );
    const user={id:'U1',role:{name:'brand_manager'},assignedSellers:['S1'],permissions:['gms_tracker_import']};
    const preview=async (revenue,title)=>{
      const file=path.join(dir,'report-'+mockSequence);
      fs.writeFileSync(file,'ASIN,Date,Brand,StoreCode,Ordered Revenue,Ordered Units,Shipped Revenue,Shipped COGS,Shipped Units,Customer Returns'+(title?',Product Title':'')+'\nB000000001,2026-11-27,Brand A,IN,'+revenue+',1,100,50,1,0'+(title?','+title:''));
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
    const first=await preview('123.45','Original title from report');
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
    const savedTitle=await mockPool.request().query("SELECT ReportProductTitle FROM GmsDailyPerformance WHERE Asin='B000000001'");
    expect(savedTitle.recordset[0].ReportProductTitle).toBe('Original title from report');
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
    // Read real persisted signed values with the shared analytics SQL path.
    // Multiple catalog rows with the same owner must not multiply revenue.
    const unified=await loadAnalytics(mockPool,global,{startDate:'2026-11-27',endDate:'2026-11-27',level:'asin'});
    expect(unified.kpis.orderedRevenue).toBe(29.5);
    expect(unified.meta.records).toBe(2);
    expect(unified.matrixRows.find(r=>r.asin==='B000000002')).toMatchObject({dbBrand:'Seller A',brand:'Sheet Brand'});
    expect(unified.comparison.changes.orderedRevenue).toBeNull();
    const scoped=await loadAnalytics(mockPool,user,{startDate:'2026-11-27',endDate:'2026-11-27',level:'seller',sellerIds:['S1']});
    expect(scoped.matrixRows).toHaveLength(1);
    expect(scoped.kpis.orderedRevenue).toBe(29.5);
    await analyticsIndex.up(mockPool);
    await analyticsIndex.up(mockPool);
    const index=await mockPool.request().query("SELECT name FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.GmsDailyPerformance') AND name='IX_GmsDailyPerformance_Date_Asin_Analytics'");
    expect(index.recordset).toHaveLength(1);
    const options={startDate:'2026-11-27',endDate:'2026-11-27',level:'asin',pageSize:1};
    const firstPage=await loadPagedAnalytics(mockPool,global,{...options,page:1});
    const secondPage=await loadPagedAnalytics(mockPool,global,{...options,page:2});
    expect(firstPage.pagination).toEqual({page:1,pageSize:1,totalRows:2});
    expect(secondPage.pagination).toEqual({page:2,pageSize:1,totalRows:2});
    expect(firstPage.kpis).toEqual(unified.kpis);
    expect(secondPage.kpis).toEqual(unified.kpis);
    expect(firstPage.matrixRows[0]).toMatchObject({asin:'B000000001',orderedRevenue:155});
    expect(secondPage.matrixRows[0]).toMatchObject({asin:'B000000002',orderedRevenue:-125.5,dbBrand:'Seller A'});
    expect(secondPage.monthGroups).toEqual(firstPage.monthGroups);
    const ascending=await loadPagedAnalytics(mockPool,global,{...options,page:1,sort:{key:'day-2026-11-27',direction:'asc'}});
    expect(ascending.matrixRows[0].asin).toBe('B000000002');
    const profitSort=await loadPagedAnalytics(mockPool,global,{...options,page:1,sort:{key:'profit',direction:'asc'}});
    expect(profitSort.matrixRows[0].asin).toBe('B000000002');
    expect(profitSort.matrixRows[0]).toMatchObject({shippedRevenue:-25,shippedCOGS:-5,profit:-20,marginPct:null,periodCoverage:{currentDays:1,priorDays:0,expectedDays:1,comparable:false}});
    const selectedSearch=await loadPagedAnalytics(mockPool,global,{...options,search:'Original title from report'});
    const searchFacts=await queryFacts(mockPool,global,{from:'2026-11-27',to:'2026-11-27'},{search:'Original title from report'});
    expect(selectedSearch.kpis.orderedRevenue).toBe(155);
    expect(searchFacts.map(r=>r.asin)).toEqual(['B000000001']);
    const scopedPage=await loadPagedAnalytics(mockPool,user,{...options,level:'seller',sellerIds:['S1']});
    expect(scopedPage.kpis).toEqual(scoped.kpis);
    expect(scopedPage.matrixRows[0].orderedRevenue).toBe(29.5);
    // Verify export uses the complete scoped daily facts, not the one-row page.
    const allFacts=await queryFacts(mockPool,global,{from:'2026-11-27',to:'2026-11-27'});
    const completeExport=buildCompleteExport(allFacts,{window:{from:'2026-11-27',to:'2026-11-27'},level:'seller'});
    expect(completeExport.complete.selectedCount).toBe(2);
    expect(completeExport.report.kpis).toEqual(unified.kpis);
    const reportFile=path.join(dir,'full-report.xlsx');
    const written=await writeGmsExport({filePath:reportFile,format:'xlsx',...completeExport,columns:[{label:'Seller (DB)',getValue:r=>r.dbBrand},{label:'Period Revenue',getValue:r=>r.orderedRevenue}],matrixFixedCount:2});
    expect(written.rowCount).toBe(2);
    const actual=XLSX.utils.sheet_to_json(XLSX.readFile(reportFile).Sheets['Complete Data'],{raw:true,defval:null});
    expect(actual).toHaveLength(2);
    expect(actual.find(r=>r.ASIN==='B000000001')).toMatchObject({'Product Title':'Original title from report','Ordered Revenue':155,'Shipped COGS':50});
    expect(actual.find(r=>r.ASIN==='B000000002')).toMatchObject({'Ordered Revenue':-125.5,'Ordered Units':-2,'Customer Returns':0});

    const none=await loadPagedAnalytics(mockPool,user,{...options,sellerIds:['S2']});
    expect(none.pagination.totalRows).toBe(0);
    expect(none.meta.records).toBe(0);
    const literal=await loadPagedAnalytics(mockPool,global,{...options,search:'%'});
    expect(literal.meta.records).toBe(0);
    const clamped=await loadPagedAnalytics(mockPool,global,{...options,page:100});
    expect(clamped.pagination.page).toBe(2);
    // The new directory returns only report filter labels/associations, not
    // enriched seller profiles. Add the real directory columns to this fixture.
    await mockPool.request().query(`
      ALTER TABLE Roles ADD Level int NULL;
      ALTER TABLE Users ADD FirstName nvarchar(100) NULL,LastName nvarchar(100) NULL;
    `);
    await mockPool.request().query(`
      INSERT INTO Sellers VALUES('S2','amazon.in',1,'Seller B');
      UPDATE Users SET FirstName='Test',LastName='Manager' WHERE Id='U1';
      INSERT INTO UserSellers VALUES('U1','S2');
      CREATE INDEX IX_Test_AsinCode_Seller ON Asins(AsinCode,SellerId);
    `);
    const directory=await loadGmsFilters(mockPool,user);
    expect(directory.sellers).toEqual([{id:'S1',name:'Seller A'}]);
    expect(directory.managers).toEqual([{id:'U1',firstName:'Test',lastName:'Manager',assignedSellers:['S1']}]);
    expect((await loadGmsFilters(mockPool,global)).sellers.map(s=>s.id)).toEqual(['S1','S2']);
    // Verify optimized lookup against the existing canonical raw-fact query,
    // including trimmed/case-normalized duplicate owners and conflicting owners.
    // Use a separate reporting date so the original signed fixture is unchanged.
    await mockPool.request().query(`
      INSERT INTO Asins VALUES
      ('N1',' p000000001 ','S1','Normalized product'),('N2','P000000001','S1','Same owner'),
      ('N3','P000000002','S1','Ambiguous A'),('N4',' p000000002 ','S2','Ambiguous B'),
      ('N5','P000000003',NULL,'No owner'),('N6','P000000004','S2','Other seller'),
      ('N7','P000000005','S1','Stored owner'),('N8','P000000005','S2','Conflicting catalog');
      INSERT INTO GmsDailyPerformance(Id,Asin,Date,SellerId,Brand,StoreCode,OrderedRevenue,OrderedUnits,ShippedRevenue,ShippedCOGS,ShippedUnits,CustomerReturns,CreatedAt,UpdatedAt)
      SELECT 'norm-'+CONVERT(varchar(10),n),'P'+RIGHT('000000000'+CONVERT(varchar(10),n),9),
        '2026-09-01',CASE WHEN n=5 THEN 'S1' ELSE NULL END,'Mapping fixture','IN',10*n,1,0,0,0,0,SYSUTCDATETIME(),SYSUTCDATETIME()
      FROM (VALUES(1),(2),(3),(4),(5)) d(n);
    `);
    const normOptions={startDate:'2026-09-01',endDate:'2026-09-01',level:'asin',pageSize:25};
    for(const actor of [global,user]){
      const reference=await loadAnalytics(mockPool,actor,normOptions);
      const optimized=await loadPagedAnalytics(mockPool,actor,normOptions);
      expect(optimized.kpis).toEqual(reference.kpis);
      expect(optimized.meta).toEqual(reference.meta);
      expect(optimized.matrixRows.map(r=>[r.asin,r.sellerId,r.productTitle]).sort()).toEqual(reference.matrixRows.map(r=>[r.asin,r.sellerId,r.productTitle]).sort());
    }
    const normalizedSearch=await loadPagedAnalytics(mockPool,global,{...normOptions,search:'Normalized product'});
    expect(normalizedSearch.meta.records).toBe(1);
    expect(normalizedSearch.matrixRows[0]).toMatchObject({asin:'P000000001',sellerId:'S1',productTitle:'Normalized product'});
    // Existing mapped fact test below is scoped to its original ASIN.
    const revoked=await preview('170.00');
    await service.confirm('U1',revoked.id);
    await mockPool.request().query("UPDATE Users SET IsActive=0 WHERE Id='U1'");
    await service.processNext();
    expect((await service.getJob('U1',revoked.id)).status).toBe('FAILED');
    expect(await facts()).toEqual([{SellerId:'S1',OrderedRevenue:155}]);
    // Optional manual scale exercise: exclusively the disposable local SQL
    // Server above. Report elapsed times without asserting hardware-dependent SLAs.
    if(scaleRows){
      await mockPool.request().input('rows',sql.Int,scaleRows).query(`
        WITH digits AS (SELECT n FROM (VALUES(0),(1),(2),(3),(4),(5),(6),(7),(8),(9)) d(n)),
        seq AS (SELECT TOP (@rows) ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS n FROM digits a CROSS JOIN digits b CROSS JOIN digits c CROSS JOIN digits d CROSS JOIN digits e CROSS JOIN digits f)
        INSERT INTO GmsDailyPerformance(Id,Asin,Date,SellerId,Brand,StoreCode,OrderedRevenue,OrderedUnits,ShippedRevenue,ShippedCOGS,ShippedUnits,CustomerReturns,CreatedAt,UpdatedAt)
        SELECT 'scale-'+CONVERT(varchar(20),n),'F'+RIGHT('000000000'+CONVERT(varchar(20),(n-1)/30+1),9),
          DATEADD(day,CONVERT(int,(n-1)%30),CONVERT(date,'2026-10-01')),NULL,'Load Test','IN',
          CASE WHEN n%7=0 THEN -1.25 ELSE 1.25 END,1,1.25,0.50,1,0,SYSUTCDATETIME(),SYSUTCDATETIME()
        FROM seq;
      `);
      // The previous scale fixture contained almost no catalog entries.
      // Include 50k irrelevant catalog ASINs and mapped rows for half of
      // the synthetic report entities to exercise the real matching path.
      const mappedEntities=Math.floor(Math.ceil(scaleRows/30)/2);
      await mockPool.request().input('mapped',sql.Int,mappedEntities).input('catalogRows',sql.Int,50000+mappedEntities).query(`
        WITH digits AS (SELECT n FROM (VALUES(0),(1),(2),(3),(4),(5),(6),(7),(8),(9)) d(n)),
        seq AS (SELECT TOP (@catalogRows) ROW_NUMBER() OVER(ORDER BY (SELECT NULL)) AS n FROM digits a CROSS JOIN digits b CROSS JOIN digits c CROSS JOIN digits d CROSS JOIN digits e CROSS JOIN digits f)
        INSERT INTO Asins(Id,AsinCode,SellerId,Title)
        SELECT 'catalog-'+CONVERT(varchar(20),n),
          CASE WHEN n<=@mapped THEN 'F'+RIGHT('000000000'+CONVERT(varchar(20),n),9) ELSE 'C'+RIGHT('000000000'+CONVERT(varchar(20),n),9) END,
          'S1',REPLICATE(N'Catalog product title ',20)
        FROM seq;
      `);
      const scaleOptions={startDate:'2026-10-01',endDate:'2026-10-30',level:'asin',pageSize:100};
      const before=Date.now();
      let firstTiming,nextTiming;
      const large=await loadPagedAnalytics(mockPool,global,{...scaleOptions,page:1},{onTiming:t=>{firstTiming=t;}});
      const firstMs=Date.now()-before;
      const nextStarted=Date.now();
      const next=await loadPagedAnalytics(mockPool,global,{...scaleOptions,page:2},{onTiming:t=>{nextTiming=t;}});
      const nextMs=Date.now()-nextStarted;
      expect(large.meta.records).toBe(scaleRows);
      expect(large.meta.unmatchedRecords).toBe(scaleRows-mappedEntities*30);
      expect(large.kpis.orderedRevenue).toBe((scaleRows-2*Math.floor(scaleRows/7))*1.25);
      expect(large.pagination.totalRows).toBe(Math.ceil(scaleRows/30));
      expect(large.matrixRows).toHaveLength(100);
      expect(next.matrixRows).toHaveLength(100);
      expect(next.kpis).toEqual(large.kpis);
      expect(new Set([...large.matrixRows,...next.matrixRows].map(r=>r.key)).size).toBe(200);
      console.log('GMS disposable scale result',JSON.stringify({facts:scaleRows,catalogRows:50000+mappedEntities,mappedEntities,entities:large.pagination.totalRows,pageRows:100,firstMs,nextMs,firstTiming,nextTiming,responseBytes:Buffer.byteLength(JSON.stringify(large))}));
    }
  } finally {
    fs.rmSync(dir,{recursive:true,force:true});
    await mockPool.close();
  }
}, scaleRows?600000:180000);
