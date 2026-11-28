'use strict';
const {createStreamingWorkbook}=require('./streamingWorkbook');
const {verifyXlsx}=require('./exportFileIntegrity');
async function writeIssueReport({filePath,job,issues,iterateIssues,issueCount}){
 const book=createStreamingWorkbook({filename:filePath,useStyles:true,useSharedStrings:false});
 const sheet=book.addWorksheet('Ads Validation Errors',{views:[{state:'frozen',ySplit:1}]});
 sheet.columns=[14,20,18,42,34,95].map(width=>({width}));
 const header=sheet.addRow(['CSV Record','ASIN','Report Date','Affected Column','Error Code','Remarks']);
 header.font={bold:true,color:{argb:'FFFFFFFF'}};header.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF243B53'}};header.commit();
 let count=1;
 for await(const i of (iterateIssues?iterateIssues():issues)){const row=sheet.addRow([i.row??null,i.asin??'',i.date??'',i.column??'',i.code,i.message]);row.getCell(6).alignment={wrapText:true};row.commit();count++;}
 if(issueCount!==undefined&&count-1!==issueCount)throw Error('Incomplete validation error report');
 if(job.summary?.issueReportTruncated){sheet.addRow(['','','','','REPORT_LIMIT','Stored '+job.summary.storedIssueCount+' of '+job.summary.issueCount+' issues. Split the report and validate the smaller files to retrieve all errors.']).commit();count++;}
 sheet.commit();await book.commit();await verifyXlsx(filePath,{expectedSheets:new Map([['Ads Validation Errors',count]])});
}
// Very large error sets use a full CSV (no Excel worksheet row limit).
// Build privately and verify the complete issue count before sending bytes.
async function writeIssueCsv({filePath,job,issues,iterateIssues,issueCount}){
 const {createWriteStream}=require('node:fs');
 const {pipeline}=require('node:stream/promises');
 const {Readable}=require('node:stream');
 const cell=v=>{
  let s=String(v??'');
  // Spreadsheet formula injection protection for text values.
  if(/^[\s]*[=+\-@]/.test(s))s="'"+s;
  return '"'+s.replace(/"/g,'""')+'"';
 };
 async function* lines(){
  yield '\uFEFF"CSV Record","ASIN","Report Date","Affected Column","Error Code","Remarks"\r\n';
  let count=0,batch=[];
  for await(const i of (iterateIssues?iterateIssues():issues)){
   batch.push([i.row,i.asin,i.date,i.column,i.code,i.message].map(cell).join(',')+'\r\n');count++;
   if(batch.length>=1000){yield batch.join('');batch=[];}
  }
  if(batch.length)yield batch.join('');
  if(issueCount!==undefined&&count!==issueCount)throw Error('Incomplete validation error report');
  if(job.summary?.issueReportTruncated)yield ['','','','','REPORT_LIMIT','Stored '+job.summary.storedIssueCount+' of '+job.summary.issueCount+' issues. Legacy report; revalidate to capture all detected errors.'].map(cell).join(',')+'\r\n';
 }
 await pipeline(Readable.from(lines()),createWriteStream(filePath,{flags:'wx'}));
}
const XLSX_ISSUE_LIMIT=100000;
module.exports={writeIssueReport,writeIssueCsv,XLSX_ISSUE_LIMIT};
