'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const ExcelJS=require('exceljs');
const {writeCanonicalWorkbook}=require('../services/adsCanonicalExport');
test('canonical export generates a readable XLSX with typed values and unknown blanks',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ads-xlsx-test-'));
 try{
  const filePath=path.join(dir,'report.xlsx');
  const summary={currency:'INR',rowCount:'1',unmappedRows:'0',totals:{spend:'25.5',sales:'100',totalSales:'123456789012345678.123456789'},coverage:{spend:{status:'complete',populated:'1'},sales:{status:'complete',populated:'1'}},ratios:{acos:{value:'25.5',status:'complete'}}};
  await writeCanonicalWorkbook({ExcelJS,filePath,filters:{sellerId:'s1'},report:{period:{startDate:'2026-04-01',endDate:'2026-04-30',prevStart:'2026-03-02',prevEnd:'2026-03-31'},groupBy:'asin',granularity:'day',total:1,current:[summary],previous:[],rows:[{sellerId:'s1',sellerName:'One',marketplace:'amazon.in',currency:'INR',entityKey:'B000000001',title:'=1+2',current:summary,previous:null}],series:[{...summary,periodKey:'current',bucket:'2026-04-01'}]}});
  const book=new ExcelJS.Workbook();await book.xlsx.readFile(filePath);
  assert.deepEqual(book.worksheets.map(s=>s.name),['Report Scope','Summary','Entity Comparisons','History']);
  const sheet=book.getWorksheet('Summary'),headers=sheet.getRow(1).values;
  const cell=k=>sheet.getRow(2).getCell(headers.indexOf(k));
  assert.equal(cell('spend').value,25.5);assert.equal(cell('acos').value,.255);assert.equal(cell('acos').numFmt,'0.00%');
  assert.equal(cell('totalSales').value,'123456789012345678.123456789');assert.equal(cell('organicSales').value,null);
  const entities=book.getWorksheet('Entity Comparisons');assert.equal(entities.getRow(2).getCell(7).value,'=1+2');
  assert.equal(entities.getRow(3).getCell(1).value,'previous');
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
