const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const XLSX=require('xlsx');
const {makeFakePool}=require('../../testUtils/fakePool');
jest.mock('../../database/db',()=>({sql:require('../../testUtils/fakePool').FAKE_SQL}));
const {pageSpec,periodRange,buildPageQuery,composePage,loadPagedAnalytics}=require('../../services/gmsAnalyticsPageService');
const {writeGmsExport,csvCell}=require('../../services/gmsExportWriter');
const {buildAnalytics}=require('../../services/gmsAnalyticsService');
const admin={role:{name:'admin'},assignedSellers:[]};
const scoped={role:{name:'brand_manager'},assignedSellers:['S1']};
const options={startDate:'2024-12-30',endDate:'2025-01-01',page:1,pageSize:1};
const metric=(date,orderedRevenue,recordCount=1)=>({date,recordCount,orderedRevenue:String(orderedRevenue),orderedUnits:'2',shippedRevenue:'10.00',shippedCOGS:'6.00',shippedUnits:'2',customerReturns:'0'});
const entity={entityKey:'B000000001',asin:'B000000001',sellerId:'S1',dbBrand:'Seller A',brand:'Brand A',storeCode:'IN'};
describe('bounded analytics contract',()=>{
  test('stable and allowlisted sorts validate month segments across ISO years',()=>{
    expect(periodRange('week-total-2024-12|2025-W01')).toEqual({from:'2024-12-30',to:'2024-12-31'});
    expect(periodRange('week-total-2025-01|2025-W01')).toEqual({from:'2025-01-01',to:'2025-01-05'});
    expect(()=>periodRange('week-total-2025-01|2025-W99')).toThrow();
    expect(()=>pageSpec({...options,pageSize:101})).toThrow();
    expect(()=>pageSpec({...options,page:-1})).toThrow();
    expect(()=>pageSpec({...options,sort:{key:'__proto__',direction:'asc'}})).toThrow();
    expect(()=>pageSpec({...options,sort:{key:'orderedRevenue',direction:'DESC; SELECT 1'}})).toThrow();
  });
  test('SQL query binds scope, search, date and period and selects only page entities',()=>{
    const spec=pageSpec({...options,sellerIds:['S1'],search:"100%_['",sort:{key:'week-total-2024-12|2025-W01',direction:'desc'}});
    const pool=makeFakePool(),q=pool.request(),query=buildPageQuery(q,scoped,spec);
    expect(q._inputs).toMatchObject({allowedSellerIds:'["S1"]',selectedSellerIds:'["S1"]',search:"100%_['",sortFrom:'2024-12-30',sortTo:'2024-12-31',pageSize:1});
    expect(query).toContain('SELECT DISTINCT Asin,SellerId INTO #GmsKeys');
    expect(query).toContain('JOIN #GmsPage');
    expect(query).toContain('ROW_NUMBER() OVER(ORDER BY');
    expect(query).toContain('CHARINDEX(@search');
    expect(query).not.toContain("100%_['");
  });
  test('common report path collects normalized catalog keys once and defers title LOB reads',()=>{
    const db=makeFakePool();
    const normal=buildPageQuery(db.request(),admin,pageSpec(options));
    const search=buildPageQuery(db.request(),admin,pageSpec({...options,search:'Example'}));
    expect(normal).toContain('INTO #GmsNormalizedKeys');
    expect(normal).toContain('INTO #GmsCatalog FROM Asins c INNER JOIN #GmsNormalizedKeys');
    expect(normal).toContain('OPTION (HASH JOIN)');
    expect(normal).toContain('IX_GmsCatalog_Normalized_Owner');
    expect(normal).toContain('COUNT_BIG(DISTINCT SellerId)=1');
    expect(normal).not.toContain('g.ReportProductTitle');
    expect(normal).toContain('COALESCE(original.ReportProductTitle,catalog.Title) AS productTitle');
    expect(search).toContain('g.ReportProductTitle');
    expect(search).toContain('COALESCE(g.ReportProductTitle,m.ProductTitle)');
    expect(search).toContain('CHARINDEX(@search');
  });
  test('optimized ranking returns only the bounded page while retaining identical bound scope and ordering',()=>{
    const db=makeFakePool(),spec=pageSpec({...options,page:17,sort:{key:'profit',direction:'asc'},sellerIds:['S1']});
    const old=db.request(),next=db.request();
    const baseline=buildPageQuery(old,scoped,spec,{strategy:'baseline'});
    const optimized=buildPageQuery(next,scoped,spec,{strategy:'optimized'});
    expect(next._inputs).toEqual(old._inputs);
    expect(baseline).toContain('INTO #GmsOrder');
    expect(optimized).not.toContain('#GmsOrder');
    expect(optimized).toContain('OFFSET @pageOffset ROWS FETCH NEXT @pageSize ROWS ONLY');
    expect(optimized).toContain('CASE WHEN SortValue IS NULL THEN 1 ELSE 0 END,SortValue ASC,EntityKey ASC');
    expect(optimized).toContain('IX_GmsMap_Asin_Owner');
    expect(optimized).toContain('CREATE CLUSTERED INDEX IX_GmsFacts_Entity_Date');
    expect(optimized).toContain('IX_GmsPage_Entity');
    expect(optimized).toContain('OPENJSON(@allowedSellerIds)');
    expect(()=>buildPageQuery(db.request(),admin,spec,{strategy:'injected'})).toThrow();
    // HTTP input cannot choose an internal implementation strategy.
    expect(pageSpec({...options,strategy:'baseline'})).not.toHaveProperty('strategy');
  });
  test('whole-filter daily aggregates, global month segments and page matrix stay consistent',()=>{
    const r=composePage([
      [metric('2024-12-30','10.01',3),metric('2024-12-31','-2.02',2),metric('2025-01-01','5.05',4)],
      [{records:9,asins:3,sellers:1,unmatchedRecords:2}],
      [{page:2,pageSize:1,totalRows:3}],
      [{...metric('2025-01-01','2.25'),entityKey:entity.entityKey}],
      [entity],
      [{...entity,brand:'Brand B'},{...entity,brand:'Brand A'}],
    ],pageSpec({...options,page:2}));
    expect(r.kpis.orderedRevenue).toBe(13.04);
    expect(r.meta).toMatchObject({records:9,asins:3,unmatchedRecords:2});
    expect(r.comparison.currentCoverage.records).toBe(9);
    expect(r.pagination).toEqual({page:2,pageSize:1,totalRows:3});
    expect(r.matrixRows).toHaveLength(1);
    expect(r.matrixRows[0]).toMatchObject({orderedRevenue:2.25,brand:'Brand A, Brand B'});
    expect(r.matrixRows[0].weeklyRev).toEqual({'2025-01|2025-W01':2.25});
    expect(Object.keys(r.monthGroups)).toEqual(['2024-12','2025-01']);
  });
  test('empty intersection does not access SQL and cancellation reaches active request',async()=>{
    const db=makeFakePool();
    expect((await loadPagedAnalytics(db,admin,{...options,sellerIds:[]})).pagination.totalRows).toBe(0);
    expect(db.calls).toHaveLength(0);
    const controller=new AbortController();
    let cancel;
    const fake={request:()=>({input(){return this;},query:()=>new Promise((_,reject)=>{cancel=()=>reject(new Error('cancelled'));}),cancel:()=>cancel()})};
    const pending=loadPagedAnalytics(fake,admin,options,{signal:controller.signal});
    controller.abort();
    await expect(pending).rejects.toThrow('cancelled');
  });
});
describe('streaming GMS export files',()=>{
  const report=buildAnalytics([{...metric('2026-11-27','-125.50'),...entity,brand:'=2+2'}],{window:{from:'2026-11-27',to:'2026-11-27'}});
  const columns=[{label:'ASIN',getValue:r=>r.asin},{label:'Brand',getValue:r=>r.brand},{label:'Revenue',getValue:r=>r.orderedRevenue}];
  test('Excel and CSV preserve signed numerics, text, summary, and valid file formats',async()=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gms-export-'));
    try{
      const xlsx=path.join(dir,'report.xlsx'),csv=path.join(dir,'report.csv');
      expect(await writeGmsExport({filePath:xlsx,format:'xlsx',report,columns})).toMatchObject({rowCount:1});
      const book=XLSX.readFile(xlsx);
      expect(book.SheetNames).toEqual(['GMS Matrix','Summary']);
      const rows=XLSX.utils.sheet_to_json(book.Sheets['GMS Matrix'],{header:1,raw:true});
      expect(rows[1]).toEqual(['B000000001','=2+2',-125.5]);
      expect(book.Sheets['GMS Matrix'].B2.f).toBeUndefined();
      await writeGmsExport({filePath:csv,format:'csv',report,columns});
      const data=fs.readFileSync(csv,'utf8');
      expect(data).toContain('"B000000001","\'=2+2","-125.5"');
      expect(fs.existsSync(xlsx+'.partial')).toBe(false);
      expect(fs.existsSync(csv+'.partial')).toBe(false);
      expect(csvCell('-')).toBe('"-"');
    }finally{fs.rmSync(dir,{recursive:true,force:true});}
  },30000);
  test('cancelled export is not published',async()=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gms-cancel-'));
    try{
      const file=path.join(dir,'report.csv'),controller=new AbortController();
      controller.abort();
      await expect(writeGmsExport({filePath:file,format:'csv',report,columns,signal:controller.signal})).rejects.toThrow();
      expect(fs.existsSync(file)).toBe(false);
    }finally{fs.rmSync(dir,{recursive:true,force:true});}
  });
});
