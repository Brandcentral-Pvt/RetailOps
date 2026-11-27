const fs=require('node:fs');
const fsp=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const ExcelJS=require('exceljs');
const {verifyXlsx,checkFileEnvelope,safeExportName}=require('../../services/exportFileIntegrity');
const {writeGmsExport}=require('../../services/gmsExportWriter');
const {buildCompleteExport}=require('../../services/gmsCompleteExport');
jest.mock('../../database/db',()=>({sql:require('../../testUtils/fakePool').FAKE_SQL}));

describe('export file integrity',()=>{
  let dir;
  beforeEach(()=>{dir=fs.mkdtempSync(path.join(os.tmpdir(),'gms-integrity-'));});
  afterEach(async()=>{await fsp.rm(dir,{recursive:true,force:true});});
  async function workbook(file){
    const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Complete Data');
    sheet.addRow(['ASIN','Revenue']);
    sheet.addRow(['B000000001',-125.5]);
    await book.xlsx.writeFile(file);
  }
  test('verifies real package and exact worksheet counts',async()=>{
    const file=path.join(dir,'valid.xlsx');await workbook(file);
    const verified=await verifyXlsx(file,{expectedSheets:new Map([['Complete Data',2]])});
    expect(verified.sheets.get('Complete Data')).toBe(2);
    await expect(verifyXlsx(file,{expectedSheets:new Map([['Complete Data',3]])})).rejects.toThrow();
    await expect(verifyXlsx(file,{expectedSheets:new Map([['Other',2]])})).rejects.toThrow();
  });
  test('rejects mislabeled, empty, incomplete and size-mismatched exports',async()=>{
    const file=path.join(dir,'valid.xlsx');await workbook(file);
    const bytes=await fsp.readFile(file),bad=path.join(dir,'bad.xlsx');
    await fsp.writeFile(bad,'<html>Login required</html>');
    await expect(checkFileEnvelope(bad,'xlsx')).rejects.toThrow();
    await fsp.writeFile(bad,bytes.subarray(0,bytes.length-30));
    await expect(verifyXlsx(bad)).rejects.toThrow();
    await fsp.writeFile(bad,'');
    await expect(checkFileEnvelope(bad,'xlsx')).rejects.toThrow();
    await expect(checkFileEnvelope(file,'xlsx',bytes.length+1)).rejects.toThrow();
    await expect(checkFileEnvelope(file,'csv')).rejects.toThrow();
  });
  test('rejects a ZIP whose central directory CRC was altered',async()=>{
    const file=path.join(dir,'valid.xlsx');await workbook(file);
    const bytes=await fsp.readFile(file);
    const signature=Buffer.from([0x50,0x4b,0x01,0x02]);
    let at=bytes.indexOf(signature),changed=false;
    while(at>=0){
      const length=bytes.readUInt16LE(at+28),name=bytes.subarray(at+46,at+46+length).toString('utf8');
      if(name==='xl/worksheets/sheet1.xml'){bytes.writeUInt32LE((bytes.readUInt32LE(at+16)^1)>>>0,at+16);changed=true;break;}
      at=bytes.indexOf(signature,at+46+length);
    }
    expect(changed).toBe(true);
    const bad=path.join(dir,'crc.xlsx');await fsp.writeFile(bad,bytes);
    await expect(verifyXlsx(bad)).rejects.toThrow(/CRC/);
  });
  test('uses only a safe exact export name with matching extension',()=>{
    expect(safeExportName({Id:'abc123',FileName:'gms_export_asin_2026-11-27.xlsx',Format:'xlsx'})).toEqual({name:'gms_export_asin_2026-11-27.xlsx',diskName:'abc123_gms_export_asin_2026-11-27.xlsx',format:'xlsx'});
    expect(()=>safeExportName({Id:'abc',FileName:'../private.xlsx',Format:'xlsx'})).toThrow();
    expect(()=>safeExportName({Id:'abc',FileName:'report.xlsx',Format:'csv'})).toThrow();
  });
  test('complete styled workbook verifies in both conventional and streaming paths',async()=>{
    const facts=[{asin:'B000000001',date:'2026-11-27',brand:'A & B <test>',sellerId:null,dbBrand:null,storeCode:'IN',reportProductTitle:'Title "quoted" & unicode ₹',productTitle:'Title "quoted" & unicode ₹',orderedRevenue:'-125.50',orderedUnits:-1,shippedRevenue:'0.00',shippedCOGS:'0.00',shippedUnits:0,customerReturns:0}];
    const {report,complete}=buildCompleteExport(facts,{window:{from:'2026-11-27',to:'2026-11-27'}});
    const columns=[{label:'ASIN',getValue:r=>r.asin},{label:'Revenue',getValue:r=>r.orderedRevenue}];
    const small=path.join(dir,'small.xlsx');
    await writeGmsExport({filePath:small,format:'xlsx',report,complete,columns,matrixFixedCount:2});
    const expected=(await verifyXlsx(small)).sheets;
    expect(expected.get('Complete Data')).toBe(2);
    expect(expected.size).toBe(9);
    // Force the streaming branch with a descriptor whose legitimate cell
    // count exceeds the conventional writer budget.
    const wide={name:'Scale Fixture',columns:Array.from({length:151},(_,i)=>({label:'Col '+i,width:18,kind:'text'})),rowCount:1000,rows:function*(){for(let i=0;i<1000;i++)yield Array.from({length:151},()=>String(i));}};
    const big=path.join(dir,'big.xlsx');
    await writeGmsExport({filePath:big,format:'xlsx',report,complete:{...complete,sheets:[...complete.sheets,wide]},columns,matrixFixedCount:2});
    const actual=(await verifyXlsx(big)).sheets;
    expect(actual.size).toBe(10);expect(actual.get('Scale Fixture')).toBe(1001);
    for(const [name,count] of expected)if(name!=='Executive Summary')expect(actual.get(name)).toBe(count);
    expect(fs.existsSync(big+'.partial')).toBe(false);
  },120000);
});
