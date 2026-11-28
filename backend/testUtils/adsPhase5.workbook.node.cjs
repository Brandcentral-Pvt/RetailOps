'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const XLSX=require('xlsx');
const {writeCompleteWorkbook}=require('../services/adsCompleteWorkbook');
const {verifyXlsx}=require('../services/exportFileIntegrity');
const {SOURCE_FIELDS,rawReconciler,checkCount,MAX_RAW_ROWS,MAX_ENTITIES}=require('../services/adsExportSnapshot');
const {METRICS,RATIOS,toFixedUnits:fixed,fromFixedUnits:decimal,shapeSummary}=require('../services/adsCanonicalMetrics');
const {comparePeriods,compareCurrencies}=require('../services/adsAnalyticsV3');
const period={startDate:'2026-04-01',endDate:'2026-04-02',prevStart:'2026-03-30',prevEnd:'2026-03-31',days:2};
const raw=(over={})=>({...Object.fromEntries(SOURCE_FIELDS.map(f=>[f.canonicalColumn,null])),Asin:'B000000001',AdvertisedSku:'00123',Date:'2026-04-01',SellerId:'s1',SellerName:'One',Marketplace:'amazon.in',Currency:'INR',ReportType:'daily',periodKey:'current',CatalogTitle:'=1+2',CatalogBrand:'Brand',CatalogCategory:'Cat',CatalogMatches:'1',SourceFileSha256:'a'.repeat(64),SourceRowNumber:'3',SourceSchemaVersion:'1',ImportedBy:'test',ImportedAt:'2026-04-05T00:00:00.000Z',...over});
function summary(rows){
 if(!rows.length)return null;
 const r={currency:rows[0].Currency,rowCount:String(rows.length)};
 const sum=(list,col)=>{const v=list.map(x=>x[col]).filter(x=>x!=null);return v.length?decimal(v.reduce((n,x)=>n+fixed(x),0n)):null;};
 for(const [key,col] of Object.entries(METRICS)){r[key]=sum(rows,col);r[key+'Count']=String(rows.filter(x=>x[col]!=null).length);}
 for(const [k,[n,d]] of Object.entries(RATIOS)){const both=rows.filter(x=>x[METRICS[n]]!=null&&x[METRICS[d]]!=null);r[k+'PairCount']=String(both.length);r[k+'PairNumerator']=sum(both,METRICS[n]);r[k+'PairDenominator']=sum(both,METRICS[d]);}
 return {...shapeSummary(r),coveredDays:new Set(rows.map(x=>x.Date)).size,unmappedRows:'0'};
}
function fixture(){
 const rows=[
 raw({AdSpend:'25.5000000000',AdSales:'100',TotalSales:'9007199254740993.1234567891',Orders:'11',Clicks:'0',ACoS:'0.255',TotalAcos:'12.5',ProductPrice:'7100.0300000000',SourceRowNumber:'2'}),
 raw({Date:'2026-04-02',AdSpend:'0',AdSales:'0',TotalSales:'-1.25',Orders:'-1',AdvertisedSku:'=1+2',SourceRowNumber:'4'}),
 raw({Date:'2026-03-30',periodKey:'previous',AdSpend:'10',AdSales:'50',TotalSales:'80',Orders:'4',SourceRowNumber:'7'}),
 raw({Asin:'B000000002',Date:'2026-03-31',periodKey:'previous',AdSpend:null,AdSales:'0',TotalSales:'20',SourceRowNumber:'8'})
 ];
 const current=summary(rows.filter(r=>r.periodKey==='current')),previous=summary(rows.filter(r=>r.periodKey==='previous'));
 const entities=['B000000001','B000000002'].map(asin=>{
  const c=summary(rows.filter(r=>r.Asin===asin&&r.periodKey==='current')),p=summary(rows.filter(r=>r.Asin===asin&&r.periodKey==='previous'));
  return {sellerId:'s1',sellerName:'One',marketplace:'amazon.in',currency:'INR',entityKey:asin,title:'=1+2',brand:'Brand',category:'Cat',current:c,previous:p,comparison:comparePeriods(c,p,2)};
 });
 const report={period,groupBy:'asin',granularity:'day',current:[current],previous:[previous],comparisons:compareCurrencies([current],[previous],2),total:2,series:rows.map(r=>({...summary([r]),periodKey:r.periodKey,bucket:r.Date}))};
 const aligned=[{currency:'INR',bucket:'2026-04-01',currentStart:'2026-04-01',currentEnd:'2026-04-01',previousStart:'2026-03-30',previousEnd:'2026-03-30',days:1,current:summary([rows[0]]),previous:summary([rows[2]]),comparison:comparePeriods(summary([rows[0]]),summary([rows[2]]),1)}];
 return {report,rawCount:rows.length,aligned,rawRows:async function*(){yield* rows;},entityRows:async function*(){yield* entities;},rows};
}
const read=(sheet,r,h)=>{const headers=XLSX.utils.sheet_to_json(sheet,{header:1})[0],i=headers.indexOf(h);assert.ok(i>=0,h);return sheet[XLSX.utils.encode_cell({r,c:i})];};
test('complete XLSX has all 63 source fields, lineage, exact financial values and prior-only entities',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ads-full-xlsx-'));
 try{
  const filePath=path.join(dir,'complete.xlsx'),f=fixture();
  const result=await writeCompleteWorkbook({filePath,...f,filters:{sellerId:'s1'}});
  assert.equal(result.rawCount,4);assert.equal(result.entityCount,2);
  await verifyXlsx(filePath,{expectedSheets:result.expectedSheets});
  const b=XLSX.readFile(filePath,{cellNF:true});
  assert.deepEqual(b.SheetNames,['Report Scope','Summary','Entity Comparisons','Entity Coverage','History','Aligned Trends','Daily Source','Data Dictionary']);
  const daily=b.Sheets['Daily Source'];
  assert.deepEqual(XLSX.utils.sheet_to_json(daily,{header:1})[0].slice(0,63),SOURCE_FIELDS.map(f=>f.header));
  assert.equal(read(daily,1,'sku').v,'00123');assert.equal(read(daily,2,'sku').v,'=1+2');assert.equal(read(daily,2,'sku').f,undefined);
  assert.equal(read(daily,1,'metrics.total_sales').v,'9007199254740993.1234567891');
  assert.equal(read(daily,1,'metrics.acos').v,.255);assert.equal(read(daily,1,'metrics.total_acos').v,12.5);
  assert.equal(read(daily,2,'metrics.spend').v,0);assert.equal(read(daily,4,'metrics.spend')?.v??null,null);
  assert.equal(read(daily,2,'metrics.orders').v,-1);assert.equal(read(daily,1,'Source record').v,2);assert.equal(read(daily,1,'Seller ID').v,'s1');
  assert.equal(read(daily,1,'product_detail.priceToPay.amount').v,7100.03);
  assert.equal(read(daily,1,'Source file SHA-256').v,'a'.repeat(64));assert.equal(read(daily,1,'Period').v,'current');assert.ok(daily['!autofilter']);
  const comp=b.Sheets['Entity Comparisons'];
  assert.equal(read(comp,1,'Title').f,undefined);
  assert.equal(read(comp,1,'Ad spend current').v,25.5);assert.match(read(comp,1,'Ad spend current').z,/0\.00/);
  assert.equal(read(comp,1,'ACoS current').v,.255);assert.match(read(comp,1,'ACoS current').z,/%/);
  assert.equal(read(comp,2,'Ad spend current')?.v??null,null);
  assert.equal(read(comp,2,'Total sales prior').v,20);
  assert.equal(read(comp,2,'Total sales comparison status').v,'missing_current');
  assert.equal(result.expectedSheets.get('Entity Coverage'),5);
  assert.equal(result.expectedSheets.get('Daily Source'),5);
  assert.equal(result.expectedSheets.get('Summary'),37);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('full export refuses missing or changed raw rows, capacity overflow and interrupted export',async()=>{
 const f=fixture(),r=rawReconciler(f.report);
 for(const row of f.rows)r.add(row);
 assert.equal(r.finish(4),4);
 const mismatch=rawReconciler(f.report);
 for(const row of f.rows)mismatch.add({...row,AdSpend:row===f.rows[0]?'25.5000000001':row.AdSpend});
 assert.throws(()=>mismatch.finish(4),/reconciliation failed/);
 assert.throws(()=>checkCount(String(MAX_RAW_ROWS+1),MAX_RAW_ROWS,'daily records'),{code:'export_too_large',status:422});
 assert.throws(()=>checkCount(String(MAX_ENTITIES+1),MAX_ENTITIES,'entities'),{code:'export_too_large',status:422});
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ads-full-failure-'));
 try{
  const filePath=path.join(dir,'bad.xlsx');
  await assert.rejects(()=>writeCompleteWorkbook({filePath,...f,filters:{},rawRows:async function*(){yield* f.rows.slice(0,3);}}),/Workbook row mismatch/);
  await assert.rejects(()=>fs.stat(filePath),{code:'ENOENT'});
  const controller=new AbortController();controller.abort();
  await assert.rejects(()=>writeCompleteWorkbook({filePath,...f,filters:{},signal:controller.signal}),{code:'export_interrupted'});
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('empty scope exports headers only and cannot claim a fabricated zero total',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ads-full-empty-'));
 try{
  const filePath=path.join(dir,'empty.xlsx'),emptyRows=async function*(){};
  const result=await writeCompleteWorkbook({filePath,report:{period,groupBy:'asin',granularity:'day',current:[],previous:[],comparisons:[],total:0,series:[]},rawCount:0,aligned:[],rawRows:emptyRows,entityRows:emptyRows,filters:{}});
  await verifyXlsx(filePath,{expectedSheets:result.expectedSheets});
  assert.equal(result.expectedSheets.get('Daily Source'),1);
  assert.equal(result.expectedSheets.get('Summary'),1);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test('partition plan respects Excel header capacity and background workbook manifest records every part',async()=>{
 const {partitionPlan}=require('../services/adsCompleteWorkbook');
 assert.deepEqual(partitionPlan('Daily Source',1048576),[{name:'Daily Source',count:1048575},{name:'Daily Source 2',count:1}]);
 assert.deepEqual(partitionPlan('Daily Source',0),[{name:'Daily Source',count:0}]);
 assert.throws(()=>partitionPlan('Daily Source',1,1048576),/Invalid/);
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ads-partitions-'));
 try{
  const filePath=path.join(dir,'partitioned.xlsx');
  const result=await writeCompleteWorkbook({filePath,...fixture(),filters:{sellerId:'s1'},advanced:true,maxRows:2});
  await verifyXlsx(filePath,{expectedSheets:result.expectedSheets});
  const book=XLSX.readFile(filePath);
  assert.equal(result.expectedSheets.get('Daily Source'),3);
  assert.equal(result.expectedSheets.get('Daily Source 2'),3);
  assert.ok(book.SheetNames.includes('Export Manifest'));
  const manifest=book.SheetNames.filter(n=>n.startsWith('Export Manifest')).flatMap(n=>XLSX.utils.sheet_to_json(book.Sheets[n],{header:1}).slice(1));
  assert.ok(manifest.some(row=>row[0]==='Worksheet: Daily Source 2'&&row[1]===2));
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('streaming CSV preserves exact raw decimals, all source rows and safe formula-like text',async()=>{
 const {writeDailyCsv,csvCell}=require('../services/adsExportCsv');
 assert.equal(csvCell('=1+2'),'"\'=1+2"');
 assert.equal(csvCell('-1.25',true),'"-1.25"');
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ads-csv-'));
 try{
  const filePath=path.join(dir,'complete.csv'),f=fixture();
  const out=await writeDailyCsv({filePath,...f});
  assert.equal(out.rawCount,4);
  const data=await fs.readFile(filePath,'utf8');
  assert.match(data,/9007199254740993\.1234567891/);
  assert.match(data,/"'=1\+2"/);
  assert.equal(data.trim().split('\n').length,5);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
