'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {HEADERS,validateReport}=require('../services/adsProductContract');
const {writeIssueReport}=require('../services/adsImportIssueReport');
test('complete detected issue collection goes beyond UI preview and preserves source context',()=>{
 const cells=HEADERS.map(h=>h==='asin'?'B000000001':h==='date'?'2026-04-01':h==='metrics.spend'?'bad':'');
 const input=Buffer.from(HEADERS.join(',')+'\n'+Array.from({length:120},()=>cells.join(',')).join('\n')+'\n');
 const issues=[];const r=validateReport(input,{onIssue:i=>issues.push(i)});
 assert.equal(r.issueCount,120);assert.equal(r.issues.length,100);assert.equal(issues.length,120);assert.equal(issues[119].row,121);assert.equal(issues[119].asin,'B000000001');
});
test('Ads error workbook round-trip and explicit truncation notice',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ads-issues-test-'));
 try{
  const filePath=path.join(dir,'errors.xlsx');
  await writeIssueReport({filePath,job:{summary:{issueReportTruncated:true,storedIssueCount:1,issueCount:2}},issues:[{row:2,asin:'B000000001',date:'2026-04-01',column:'metrics.spend',code:'invalid_numeric',message:'Enter a valid number.'}]});
  const xlsx=require('xlsx'),book=xlsx.readFile(filePath),sheet=book.Sheets['Ads Validation Errors'];
  assert.equal(sheet.A2.v,2);assert.equal(sheet.B2.v,'B000000001');assert.equal(sheet.D2.v,'metrics.spend');assert.equal(sheet.E3.v,'REPORT_LIMIT');assert.match(sheet.F3.v,/1 of 2/);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
