const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const XLSX=require('xlsx');
jest.mock('../../database/db',()=>({sql:require('../../testUtils/fakePool').FAKE_SQL}));
const {buildCompleteExport,buildDailyExport,rawColumns,excelAmount}=require('../../services/gmsCompleteExport');
const {writeGmsExport}=require('../../services/gmsExportWriter');
const {validateRows}=require('../../services/gmsImportParser');
const {sameMetrics}=require('../../services/gmsImportService');
const fact=(date,asin,extra={})=>({date,asin,sellerId:'S1',dbBrand:'Seller A',brand:'Brand A',storeCode:'IN',reportProductTitle:'Original title',
  catalogProductTitle:'Catalog title',productTitle:'Original title',orderedRevenue:'100.00',orderedUnits:4,shippedRevenue:'80.00',shippedCOGS:'30.00',shippedUnits:3,customerReturns:1,...extra});
const data=[
  fact('2026-11-27','B000000001'),
  fact('2026-11-27','B000000002',{sellerId:null,dbBrand:null,brand:'Other',reportProductTitle:null,catalogProductTitle:'Legacy catalog title',productTitle:'Legacy catalog title',orderedRevenue:'-25.00',orderedUnits:-1,shippedRevenue:'-10.00',shippedCOGS:'-5.00',shippedUnits:-1,customerReturns:0}),
  fact('2026-11-26','B000000001',{orderedRevenue:'50.00',orderedUnits:2,shippedRevenue:'40.00',shippedCOGS:'15.00',shippedUnits:2,customerReturns:1}),
];
const window={from:'2026-11-27',to:'2026-11-27'};
const headers=['ASIN','Product Title','Brand','Ordered Revenue','Ordered Units','Shipped Revenue','Shipped COGS','Shipped Units','Customer Returns','Date','storeCode'];
const columns=[{label:'ASIN',getValue:r=>r.asin},{label:'Period Revenue',getValue:r=>r.orderedRevenue}];
const byName=(complete,name)=>complete.sheets.find(s=>s.name===name);
const asObjects=(sheet)=>Array.from(sheet.rows(),row=>Object.fromEntries(sheet.columns.map((c,i)=>[c.label,row[i]])));

describe('complete GMS reporting contract',()=>{
  test('retains all selected daily facts and keeps the prior baseline separate',()=>{
    const {report,complete}=buildCompleteExport(data,{window});
    expect(rawColumns.slice(0,11).map(c=>c.label)).toEqual(headers);
    expect(complete.selectedCount).toBe(2);
    expect(complete.priorCount).toBe(1);
    expect(report.meta.records).toBe(2);
    expect(report.kpis).toMatchObject({orderedRevenue:75,orderedUnits:3,shippedRevenue:70,shippedCOGS:25,shippedUnits:2,customerReturns:1,profit:45});
    expect(report.comparison.changes.orderedRevenue).toBe(50);
    const raw=asObjects(complete.raw);
    expect(raw[0]).toMatchObject({'ASIN':'B000000001','Product Title':'Original title','Catalog Product Title':'Catalog title','Title Source':'Uploaded report','Ordered Revenue':100,'Shipped COGS':30});
    expect(raw[1]).toMatchObject({'ASIN':'B000000002','Product Title':null,'Catalog Product Title':'Legacy catalog title','Title Source':'Catalog only','Seller (DB)':'-','Mapping Status':'Unmatched','Ordered Revenue':-25});
    expect(asObjects(byName(complete,'Prior Period Data'))[0]['Date']).toBe('2026-11-26');
    const asins=asObjects(byName(complete,'ASIN Analytics'));
    expect(asins[0]['Ordered Revenue | Current']).toBe(100);
    expect(asins[0]['Ordered Revenue | Prior']).toBe(50);
    expect(asins[0]['Ordered Revenue | Change (%)']).toBe(1);
    expect(asins[1]['Ordered Revenue | Change (%)']).toBeNull();
    const daily=asObjects(byName(complete,'Daily Analytics'))[0];
    expect(daily['Ordered Revenue | Change (%)']).toBe(0.5);
    expect(daily['Gross Profit | Current']).toBe(45);
    expect(daily['Return Ratio | Current']).toBeCloseTo(1/3);
    expect(daily['Return Ratio | Change (pp)']).toBeCloseTo(-16.6666667);
    expect(asObjects(byName(complete,'Monthly Analytics'))[0]['Ordered Revenue | Change (%)']).toBeNull();
  });
  test('complete export is independent of interactive page size and all-time comparisons are honest',()=>{
    const many=Array.from({length:151},(_,i)=>fact('2026-11-27','B'+String(i).padStart(9,'0')));
    const {complete,report}=buildCompleteExport(many,{window:{from:null,to:null},level:'seller'});
    expect(complete.selectedCount).toBe(151);
    expect(complete.raw.rowCount).toBe(151);
    expect(report.matrixRows).toHaveLength(1);
    expect(report.kpis.orderedRevenue).toBe(15100);
    expect(report.comparison.window).toBeNull();
    expect(complete.sheets.some(s=>s.name==='Prior Period Data')).toBe(false);
    expect(byName(complete,'ASIN Analytics').rowCount).toBe(151);
  });
  test('preserves optional uploaded titles and does not erase them with missing title',()=>{
    const original=['B000000001','Exact original title','Brand A',100,4,80,30,3,1,'2026-11-27','IN'];
    const parsed=validateRows([headers,original]);
    expect(parsed.invalid).toBe(0);
    const row=parsed.rows[0];
    expect(row.reportProductTitle).toBe('Exact original title');
    expect(sameMetrics({...row,reportProductTitle:'Previous title'},row)).toBe(false);
    const noTitle={...row};delete noTitle.reportProductTitle;
    expect(sameMetrics({...row,reportProductTitle:'Previous title'},noTitle)).toBe(true);
    expect(excelAmount('9999999999999999.99')).toBe('9999999999999999.99');
    expect(excelAmount(null)).toBeNull();
  });
});
describe('complete workbook round trip',()=>{
  test('writes actual styled Excel and raw CSV with all metrics, all rows and comparisons',async()=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gms-complete-'));
    try{
      const xlsx=path.join(dir,'complete.xlsx'),csv=path.join(dir,'complete.csv');
      const {report,complete}=buildCompleteExport(data,{window,level:'seller'});
      expect(await writeGmsExport({filePath:xlsx,format:'xlsx',report,complete,columns,matrixFixedCount:2})).toMatchObject({rowCount:2});
      const book=XLSX.readFile(xlsx,{cellNF:true});
      expect(book.SheetNames).toEqual(['Complete Data','Executive Summary','ASIN Analytics','Seller Analytics','Daily Analytics','Weekly Analytics','Monthly Analytics','Prior Period Data','GMS Matrix']);
      const sheet=book.Sheets['Complete Data'],raw=XLSX.utils.sheet_to_json(sheet,{header:1,raw:true,defval:null});
      expect(raw[0].slice(0,11)).toEqual(headers);
      expect(raw).toHaveLength(3);
      expect(raw[1].slice(0,11)).toEqual(['B000000001','Original title','Brand A',100,4,80,30,3,1,'2026-11-27','IN']);
      expect(raw[2][3]).toBe(-25);
      expect(sheet.D2.t).toBe('n');
      expect(sheet.D2.z).toContain('0.00');
      const summary=XLSX.utils.sheet_to_json(book.Sheets['Executive Summary'],{header:1,raw:true});
      expect(summary.find(r=>r[0]==='Ordered Revenue').slice(0,5)).toEqual(['Ordered Revenue',75,50,0.5,'%']);
      const detailed=buildDailyExport(data,{window});
      expect(await writeGmsExport({filePath:csv,format:'csv',...detailed,columns:[]})).toMatchObject({rowCount:2});
      const text=fs.readFileSync(csv,'utf8');
      expect(text).toContain('"ASIN","Product Title","Brand","Ordered Revenue","Ordered Units","Shipped Revenue","Shipped COGS","Shipped Units","Customer Returns","Date","storeCode"');
      expect(text).toContain('"B000000002","","Other","-25","-1","-10","-5","-1","0","2026-11-27","IN"');
      expect(text.trim().split(/\r?\n/)).toHaveLength(3);
      expect(text).not.toContain('2026-11-26');
    }finally{fs.rmSync(dir,{recursive:true,force:true});}
  },30000);
});
