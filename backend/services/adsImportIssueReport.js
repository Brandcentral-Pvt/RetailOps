'use strict';
const {createStreamingWorkbook}=require('./streamingWorkbook');
const {verifyXlsx}=require('./exportFileIntegrity');
async function writeIssueReport({filePath,job,issues}){
 const book=createStreamingWorkbook({filename:filePath,useStyles:true,useSharedStrings:false});
 const sheet=book.addWorksheet('Ads Validation Errors',{views:[{state:'frozen',ySplit:1}]});
 sheet.columns=[14,20,18,42,34,95].map(width=>({width}));
 const header=sheet.addRow(['CSV Record','ASIN','Report Date','Affected Column','Error Code','Remarks']);
 header.font={bold:true,color:{argb:'FFFFFFFF'}};header.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF243B53'}};header.commit();
 let count=1;
 for(const i of issues){const row=sheet.addRow([i.row??null,i.asin??'',i.date??'',i.column??'',i.code,i.message]);row.getCell(6).alignment={wrapText:true};row.commit();count++;}
 if(job.summary?.issueReportTruncated){sheet.addRow(['','','','','REPORT_LIMIT','Stored '+job.summary.storedIssueCount+' of '+job.summary.issueCount+' issues. Split the report and validate the smaller files to retrieve all errors.']).commit();count++;}
 sheet.commit();await book.commit();await verifyXlsx(filePath,{expectedSheets:new Map([['Ads Validation Errors',count]])});
}
module.exports={writeIssueReport};
