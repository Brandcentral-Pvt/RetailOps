const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const XLSX = require('xlsx');
const { MAX_ROWS, MAX_FILE_BYTES, money, units, reportDate, validateRows, parseFile } = require('../../services/gmsImportParser');
const { makeFakePool } = require('../../testUtils/fakePool');
jest.mock('../../database/db', () => ({ sql: require('../../testUtils/fakePool').FAKE_SQL }));
const { inspect } = require('../../services/gmsImportService');
const headers = ['ASIN','Date','Brand','StoreCode','Ordered Revenue','Ordered Units','Shipped Revenue','Shipped COGS','Shipped Units','Customer Returns'];
const base = ['B000000001','2026-11-27','Brand A','IN','1,23,456.78','20','1000.10','500.20','10','0'];
const row = (changes = {}) => base.map((v,i) => Object.prototype.hasOwnProperty.call(changes,i)?changes[i]:v);
const valid = () => validateRows([headers,row()]).rows[0];

describe('strict GMS report validation', () => {
  test('accepts exact currency and legitimate zero without implicit rounding', () => {
    const result = validateRows([headers,row()]);
    expect(result.invalid).toBe(0);
    expect(result.rows[0]).toMatchObject({asin:'B000000001',date:'2026-11-27',storeCode:'IN',orderedRevenue:'123456.78',customerReturns:0});
    expect(money('₹1,234.50')).toBe('1234.50');
    expect(money('-10.25')).toBe('-10.25');
    expect(units('0')).toBe(0);
  });
  test.each(['1x00','10.123','NaN','1,2','1e3','(--10)','₹abc'])('rejects invalid monetary value %p', value => {
    expect(() => money(value)).toThrow();
  });
  test.each(['2.5','2.0','2147483648','-2147483649','invalid'])('rejects invalid units %p', value => {
    expect(() => units(value)).toThrow();
  });
  test('dates are calendar days, not rollover dates', () => {
    expect(reportDate('27/11/2026')).toBe('2026-11-27');
    expect(reportDate(46353)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(() => reportDate('31/02/2026')).toThrow();
    expect(() => reportDate(60)).toThrow();
  });
  test('duplicate snapshots collapse only when identical; conflicting values reject', () => {
    let result = validateRows([headers,row(),row()]);
    expect(result).toMatchObject({total:2,duplicates:1,invalid:0});
    expect(result.rows).toHaveLength(1);
    result = validateRows([headers,row(),row({4:'9.99'})]);
    expect(result.invalid).toBe(1);
    expect(result.issues[0].code).toBe('CONFLICTING_DUPLICATE');
  });
  test('blank metrics default to zero but missing required headers, invalid identity and unsupported stores fail', () => {
    expect(validateRows([headers.slice(0,-1),row()]).invalid).toBeGreaterThan(0);
    const blank=validateRows([headers,row({2:'',3:' ',4:'',5:null,6:undefined,7:' ',8:'',9:null})]);
    expect(blank).toMatchObject({invalid:0,defaultedCells:6,defaultedRows:1,negativeRows:0});
    expect(blank.rows[0]).toMatchObject({brand:'-',storeCode:'IN',orderedRevenue:'0.00',orderedUnits:0,shippedRevenue:'0.00',shippedCOGS:'0.00',shippedUnits:0,customerReturns:0});
    expect(validateRows([headers,row({0:''})]).invalid).toBe(1);
    expect(validateRows([headers,row({1:''})]).invalid).toBe(1);
    expect(validateRows([headers,row({3:'US'})]).invalid).toBe(1);
    expect(validateRows([headers,row({4:'abc'})]).invalid).toBe(1);
    expect(validateRows([headers,Array(10).fill(null),row()]).total).toBe(1);
  });
  test('signed values, accounting parentheses and Excel binary noise retain their intended values', () => {
    expect(money(null)).toBe('0.00');
    expect(units(' ')).toBe(0);
    expect(money('(₹1,234.50)')).toBe('-1234.50');
    expect(money('-₹1,234.50')).toBe('-1234.50');
    expect(money(-0.1-0.2)).toBe('-0.30');
    expect(money(855.2399999999999)).toBe('855.24');
    expect(()=>money(10.123)).toThrow();
    expect(units('-2147483648')).toBe(-2147483648);
    expect(units('(1,200)')).toBe(-1200);
    const signed=validateRows([headers,row({4:'-125.50',5:'-2',6:'(25.00)',7:'-5',8:'-1',9:'-1'})]);
    expect(signed).toMatchObject({invalid:0,negativeRows:1});
    expect(signed.rows[0]).toMatchObject({orderedRevenue:'-125.50',orderedUnits:-2,shippedRevenue:'-25.00',shippedCOGS:'-5.00',shippedUnits:-1,customerReturns:-1});
  });
  test('parses a CSV above the old 100,000-row ceiling without losing its last row', () => {
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gms-large-csv-'));
    try {
      const csv=path.join(dir,'large.csv'), n=100001;
      const data=Array.from({length:n},(_,i)=>'B'+String(i).padStart(9,'0')+',2026-11-27,Brand A,IN,-1.25,-1,0,0,0,');
      fs.writeFileSync(csv,headers.join(',')+'\n'+data.join('\n'));
      const result=parseFile(csv,'large.csv');
      expect(MAX_ROWS).toBe(500000);
      expect(MAX_FILE_BYTES).toBe(100*1024*1024);
      expect(result).toMatchObject({total:n,invalid:0,duplicates:0,defaultedCells:n,negativeRows:n});
      expect(result.rows).toHaveLength(n);
      expect(result.rows[n-1]).toMatchObject({asin:'B000100000',orderedRevenue:'-1.25',customerReturns:0});
    } finally { fs.rmSync(dir,{recursive:true,force:true}); }
  },120000);
  test('parses an XLSX with more than 100,000 rows and preserves negative values', () => {
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gms-large-xlsx-'));
    try {
      const file=path.join(dir,'large.xlsx'), n=100001;
      const data=[headers,...Array.from({length:n},(_,i)=>['B'+String(i).padStart(9,'0'),'2026-11-27','Brand A','IN',-1.25,-1,0,0,0,null])];
      const book=XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(data,{dense:true}),'GMS');
      XLSX.writeFile(book,file,{compression:true});
      const result=parseFile(file,'large.xlsx');
      expect(result).toMatchObject({total:n,invalid:0,defaultedCells:n,negativeRows:n});
      expect(result.rows).toHaveLength(n);
      expect(result.rows[n-1]).toMatchObject({asin:'B000100000',orderedRevenue:'-1.25',customerReturns:0});
    } finally { fs.rmSync(dir,{recursive:true,force:true}); }
  },120000);
  test('reads an actual CSV and rejects Excel formula cells', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(),'gms-parser-'));
    try {
      const csv = path.join(dir,'report.csv');
      fs.writeFileSync(csv,headers.join(',')+'\n'+row({4:'123.45'}).join(','));
      expect(parseFile(csv,'report.csv').rows[0].orderedRevenue).toBe('123.45');
      const wb = XLSX.utils.book_new(), ws = XLSX.utils.aoa_to_sheet([headers,row({4:100})]);
      ws.E2 = {t:'n',v:100,f:'1+99'};
      XLSX.utils.book_append_sheet(wb,ws,'Report');
      const xlsx = path.join(dir,'report.xlsx'); XLSX.writeFile(wb,xlsx);
      expect(() => parseFile(xlsx,'report.xlsx')).toThrow(/Formula/);
    } finally { fs.rmSync(dir,{recursive:true,force:true}); }
  });
});

describe('seller mapping and legacy fact conflicts', () => {
  const scope = {isGlobal:false,allowed:['S1']};
  const seller = {asin:'B000000001',sellerId:'S1',marketplace:'amazon.in',active:true};
  const old = {id:'fact1',...valid(),sellerId:'S1'};
  const pool = (catalog=[seller], facts=[]) => makeFakePool([
    {match:/FROM Asins a/,rows:catalog},
    {match:/FROM GmsDailyPerformance g/,rows:facts}
  ]);
  test('new authorized fact is staged; SQL inputs are bound', async () => {
    const db=pool();
    const result=await inspect(db,[valid()],scope);
    expect(result.summary).toMatchObject({inserted:1,invalid:0});
    expect(result.rows[0]).toMatchObject({sellerId:'S1',action:'inserted'});
    expect(db.calls.every(c=>c.inputs.payload)).toBe(true);
  });
  test('ASIN lookup uses its assigned database seller regardless of seller status, marketplace or spreadsheet brand', async () => {
    const db=pool([{asin:' b000000001 ',sellerId:'S1',active:false,marketplace:'legacy-value'}]);
    const result=await inspect(db,[{...valid(),brand:'Different report brand'}],scope);
    expect(result.summary).toMatchObject({inserted:1,invalid:0});
    expect(result.rows[0].sellerId).toBe('S1');
    expect(db.calls[0].sql).not.toMatch(/JOIN Sellers|IsActive|Marketplace/i);
  });
  test('duplicate catalog records carrying the same owner resolve to that owner', async () => {
    const result=await inspect(pool([seller,{...seller}]),[valid()],scope);
    expect(result.summary).toMatchObject({inserted:1,invalid:0});
    expect(result.rows[0].sellerId).toBe('S1');
  });
  test('unmapped, unassigned, conflicting and inaccessible ASINs have separate diagnostics', async () => {
    expect((await inspect(pool([]),[valid()],scope)).summary.issues[0].code).toBe('UNMATCHED_IMPORT_FORBIDDEN');
    expect((await inspect(pool([{...seller,sellerId:null}]),[valid()],scope)).summary.issues[0].code).toBe('UNMATCHED_IMPORT_FORBIDDEN');
    expect((await inspect(pool([seller,{...seller,sellerId:'S2'}]),[valid()],scope)).summary.issues[0].code).toBe('ASIN_AMBIGUOUS');
    expect((await inspect(pool([{...seller,sellerId:'S2'}]),[valid()],scope)).summary.issues[0].code).toBe('ASIN_FORBIDDEN');
  });
  test('global import retains missing or unassigned ASINs with sheet brand and null owner', async () => {
    const global={isGlobal:true,allowed:[]};
    for (const catalog of [[],[{...seller,sellerId:null}]]) {
      const result=await inspect(pool(catalog),[valid()],global);
      expect(result.summary).toMatchObject({inserted:1,matched:0,unmatched:1,invalid:0});
      expect(result.rows[0]).toMatchObject({sellerId:null,brand:'Brand A',action:'inserted'});
      expect(result.summary.sample[0]).toMatchObject({mappingStatus:'UNMATCHED',brand:'Brand A'});
    }
  });
  test('global repeat and correction of an unmatched fact are idempotent', async () => {
    const global={isGlobal:true,allowed:[]};
    const orphan={...old,sellerId:null};
    expect((await inspect(pool([],[orphan]),[valid()],global)).summary.unchanged).toBe(1);
    const corrected=await inspect(pool([],[orphan]),[{...valid(),orderedRevenue:'12.34'}],global);
    expect(corrected.rows[0]).toMatchObject({action:'updated',sellerId:null});
    const mapped=await inspect(pool([seller],[orphan]),[valid()],global);
    expect(mapped.rows[0]).toMatchObject({action:'updated',sellerId:'S1'});
  });
  test('out-of-scope or ambiguous ASIN is rejected even if one match is authorized', async () => {
    expect((await inspect(pool([{...seller,sellerId:'S2'}]),[valid()],scope)).summary.invalid).toBe(1);
    expect((await inspect(pool([seller,{...seller,sellerId:'S2'}]),[valid()],{isGlobal:true,allowed:[]})).summary.invalid).toBe(1);
  });
  test('exact repeat is unchanged; corrections require verified matching ownership', async () => {
    expect((await inspect(pool([seller],[old]),[valid()],scope)).summary.unchanged).toBe(1);
    const correction={...valid(),orderedRevenue:'99.99'};
    expect((await inspect(pool([seller],[old]),[correction],scope)).summary.updated).toBe(1);
    const ownerless=await inspect(pool([seller],[{...old,sellerId:null}]),[correction],scope);
    expect(ownerless.summary.issues[0].code).toBe('LEGACY_OWNER_UNKNOWN');
  });
  test('different seller or store and duplicate legacy facts are blocked', async () => {
    for (const facts of [[{...old,sellerId:'S2'}],[{...old,storeCode:'US'}],[old,{...old,id:'fact2'}]]) {
      expect((await inspect(pool([seller],facts),[valid()],scope)).summary.invalid).toBe(1);
    }
  });
  test('large catalog inspection uses bounded SQL chunks and stable file-wide snapshot', async () => {
    const rows=Array.from({length:10001},(_,i)=>({...valid(),asin:'B'+String(i).padStart(9,'0'),line:i+2}));
    const db=pool([]);
    const global={isGlobal:true,allowed:[]};
    const first=await inspect(db,rows,global);
    expect(first.summary).toMatchObject({inserted:10001,unmatched:10001,invalid:0});
    expect(db.calls).toHaveLength(4);
    expect(db.calls.every(c=>JSON.parse(c.inputs.payload).length<=10000)).toBe(true);
    const second=await inspect(pool([]),[...rows].reverse(),global);
    expect(second.snapshotHash).toBe(first.snapshotHash);
  },30000);
  test('snapshot changes when existing records change', async () => {
    const a=await inspect(pool(),[valid()],scope);
    const b=await inspect(pool([seller],[old]),[valid()],scope);
    expect(a.snapshotHash).not.toBe(b.snapshotHash);
  });
});
