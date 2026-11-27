const fs=require('node:fs');
const fsp=require('node:fs/promises');
const { Readable }=require('node:stream');
const { pipeline }=require('node:stream/promises');
const {createStreamingWorkbook}=require('./streamingWorkbook');
const {verifyXlsx}=require('./exportFileIntegrity');
const { presentIssue }=require('./gmsImportIssueDetails');

const headers=['Excel Row','ASIN','Date','Brand (Sheet)','Affected Column','Remarks'];
function* reportRows(report){
  for(const raw of report.issues){
    const item=presentIssue(raw);
    yield [item.row??'',item.asin??'',item.date??'',item.brand??'',item.column,item.remarks];
  }
  // Older batches never stored source ASINs or more than the first 200 issues.
  // Do not misrepresent an incomplete historical report as a full one.
  if(report.legacy){
    const missing=Math.max(0,(report.invalid||0)-report.issues.length);
    yield ['', '', '', '', 'Report information', 'This older import did not store all source details.'+
      (missing?' '+missing+' additional validation issues were not retained.':'')+
      ' Upload the original file again to get a complete report with ASINs.'];
  }
}
function csvCell(value){
  // Prevent spreadsheet formula execution in all user-supplied fields, while
  // preserving plain numeric row numbers and ordinary ASIN text.
  let s=String(value??'');
  if(typeof value==='string'&&/^[\s\u0000-\u001f]*[=+\-@]/.test(s)&&s!=='-')s="'"+s;
  return '"'+s.replace(/"/g,'""')+'"';
}
async function writeIssueReport(report,format,filePath){
  if(format==='csv'){
    async function* chunks(){
      yield '\ufeff'+headers.map(csvCell).join(',')+'\r\n';
      for(const row of reportRows(report))yield row.map(csvCell).join(',')+'\r\n';
    }
    await pipeline(Readable.from(chunks()),fs.createWriteStream(filePath,{flags:'wx'}));
    return;
  }
  if(format!=='xlsx')throw new Error('Unsupported error report format');
  const workbook=createStreamingWorkbook({filename:filePath,useStyles:true,useSharedStrings:false});
  const sheet=workbook.addWorksheet('GMS Error Report',{views:[{state:'frozen',ySplit:1}]});
  const widths=[14,20,18,30,27,100];
  sheet.columns=widths.map(width=>({width}));
  const head=sheet.addRow(headers);
  head.font={bold:true,color:{argb:'FFFFFFFF'}};
  head.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF243B53'}};
  head.height=23;
  head.commit();
  let written=1;
  for(const values of reportRows(report)){
    // ExcelJS writes strings as text, not formulas. Row numbers are numbers.
    const row=sheet.addRow(values);
    row.getCell(6).alignment={wrapText:true,vertical:'top'};
    row.height=Math.max(18,Math.min(60,15*Math.ceil(String(values[5]).length/95)));
    row.commit();written++;
  }
  sheet.commit();
  await workbook.commit();
  await verifyXlsx(filePath,{expectedSheets:new Map([['GMS Error Report',written]])});
}
function reportFileName(fileName,format){
  const base=String(fileName||'gms-report').replace(/\.[^.]+$/,'').replace(/[^a-z0-9_-]+/gi,'_').slice(0,100)||'gms-report';
  return base+'_error_report.'+format;
}
module.exports={reportRows,csvCell,writeIssueReport,reportFileName,headers};
