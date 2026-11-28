'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const XLSX=require('xlsx');
const {writeCanonicalWorkbook}=require('../services/adsCanonicalExport');
test('canonical export generates a readable XLSX with typed values and unknown blanks',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ads-xlsx-test-'));
 try{
  const filePath=path.join(dir,'report.xlsx');
  const summary={currency:'INR',rowCount:'1',unmappedRows:'0',totals:{spend:'25.5',sales:'100',totalSales:'123456789012345678.123456789'},coverage:{spend:{status:'complete',populated:'1'},sales:{status:'complete',populated:'1'}},ratios:{acos:{value:'25.5',status:'complete'}}};
  await writeCanonicalWorkbook({filePath,filters:{sellerId:'s1'},report:{period:{startDate:'2026-04-01',endDate:'2026-04-30',prevStart:'2026-03-02',prevEnd:'2026-03-31'},groupBy:'asin',granularity:'day',total:1,current:[summary],previous:[],rows:[{sellerId:'s1',sellerName:'One',marketplace:'amazon.in',currency:'INR',entityKey:'B000000001',title:'=1+2',current:summary,previous:null}],series:[{...summary,periodKey:'current',bucket:'2026-04-01'}]}});
  const book=XLSX.readFile(filePath,{cellNF:true});
  assert.deepEqual(book.SheetNames,['Report Scope','Summary','Entity Comparisons','History']);
  const sheet=book.Sheets.Summary,headers=XLSX.utils.sheet_to_json(sheet,{header:1})[0];
  const cell=k=>sheet[XLSX.utils.encode_cell({r:1,c:headers.indexOf(k)})];
  assert.equal(cell('spend').v,25.5);assert.equal(cell('acos').v,.255);assert.equal(cell('acos').z,'0.00%');
  assert.equal(cell('totalSales').v,'123456789012345678.123456789');assert.equal(cell('organicSales')?.v??null,null);
  const entities=book.Sheets['Entity Comparisons'];assert.equal(entities.G2.v,'=1+2');assert.equal(entities.G2.f,undefined);
  assert.equal(entities.A3.v,'previous');
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
