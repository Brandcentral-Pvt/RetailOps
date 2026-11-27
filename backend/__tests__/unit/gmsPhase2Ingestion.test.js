const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const XLSX = require('xlsx');
const { money, units, reportDate, validateRows, parseFile } = require('../../services/gmsImportParser');
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
  test.each(['','1x00','10.123','NaN','1,2','1e3'])('rejects invalid monetary value %p', value => {
    expect(() => money(value)).toThrow();
  });
  test.each(['','-1','2.5','2.0','2147483648'])('rejects invalid units %p', value => {
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
  test('missing headers, blank metrics and unknown marketplaces are not defaulted', () => {
    expect(validateRows([headers.slice(0,-1),row()]).invalid).toBeGreaterThan(0);
    expect(validateRows([headers,row({4:''})]).invalid).toBe(1);
    expect(validateRows([headers,row({3:'US'})]).invalid).toBe(1);
  });
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
  test('snapshot changes when existing records change', async () => {
    const a=await inspect(pool(),[valid()],scope);
    const b=await inspect(pool([seller],[old]),[valid()],scope);
    expect(a.snapshotHash).not.toBe(b.snapshotHash);
  });
});
