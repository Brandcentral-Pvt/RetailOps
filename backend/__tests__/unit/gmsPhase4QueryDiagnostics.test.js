jest.mock('../../database/db',()=>({sql:require('../../testUtils/fakePool').FAKE_SQL}));
const {parseArgs,addIo,indexInventory,profile}=require('../../scripts/profileGmsQuery');
const {makeFakePool}=require('../../testUtils/fakePool');

describe('GMS read-only diagnostic CLI',()=>{
  const dates=['--start','2026-11-01','--end','2026-11-27'];
  test('requires explicit date range and seller scope, and limits repeated expensive queries',()=>{
    expect(()=>parseArgs(dates)).toThrow(/Choose --all-sellers/);
    expect(()=>parseArgs([...dates,'--all-sellers','--seller-id','S1'])).toThrow();
    expect(()=>parseArgs([...dates,'--all-sellers','--repeats','4'])).toThrow();
    expect(()=>parseArgs([...dates,'--all-sellers','--page-size','101'])).toThrow();
    expect(()=>parseArgs(['--start','2026-01-01','--end','2026-11-27','--all-sellers'])).toThrow(/90 days/);
    expect(()=>parseArgs([...dates,'--all-sellers','--strategy','unknown'])).toThrow();
    const args=parseArgs([...dates,'--seller-id','S1','--seller-id','S2','--repeats','2']);
    expect(args.spec.filters.sellerIds).toEqual(['S1','S2']);
    expect(args.repeats).toBe(2);
    expect(args.strategy).toBe('compare');
  });
  test('aggregates only numerical I/O statistics and normalizes temp table names',()=>{
    const stats=Object.create(null);
    addIo(stats,"Table '#GmsFacts________00000012'. Scan count 1, logical reads 30, physical reads 2, lob logical reads 7.");
    addIo(stats,"Table '#GmsFacts________00000034'. Scan count 2, logical reads 11, physical reads 0, lob logical reads 0.");
    addIo(stats,'Unrelated SQL message with user data');
    expect(stats['#GmsFacts']).toEqual({scans:3,logicalReads:41,physicalReads:2,lobLogicalReads:7});
    expect(Object.keys(stats)).toEqual(['#GmsFacts']);
  });
  test('index inventory reads metadata rather than report contents',async()=>{
    const pool=makeFakePool([{match:/FROM sys.tables/,rows:[{tableName:'Asins',indexName:'IX_Test',columnName:'AsinCode'}]}]);
    expect(await indexInventory(pool)).toHaveLength(1);
    expect(pool.calls[0].sql).toContain("t.name IN ('GmsDailyPerformance','Asins')");
    expect(pool.calls[0].sql).not.toContain('SELECT *');
  });
  test('profile composes six SQL result sets and reports timings without returning facts in timing payload',async()=>{
    const args=parseArgs([...dates,'--all-sellers']);
    const fake=makeFakePool([{match:/SET STATISTICS IO ON/,recordsets:[[],[{records:0,asins:0,sellers:0,unmatchedRecords:0}],[{page:1,pageSize:50,totalRows:0}],[],[],[]]}]);
    const request=fake.request.bind(fake);
    fake.request=()=>{const q=request();q.on=()=>q;return q;};
    const result=await profile(fake,args.spec,'optimized');
    expect(result.report.matrixRows).toEqual([]);
    expect(result.timing).toMatchObject({strategy:'optimized',responseBytes:expect.any(Number),io:{}});
    expect(result.timing).not.toHaveProperty('report');
    expect(fake.calls[0].sql).toContain('SET STATISTICS IO OFF');
  });
});
