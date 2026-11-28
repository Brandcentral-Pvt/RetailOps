'use strict';
const {METRICS,RATIOS}=require('./adsCanonicalMetrics');
// Excel cannot represent more than 15 significant decimal digits reliably.
// Retain exceptional values as exact text rather than silently rounding.
function numericCell(text,percentage=false){
  if(text===null||text===undefined)return {value:null};
  if(typeof text!=='string'||!/^[-+]?\d+(?:\.\d+)?$/.test(text))throw Error('Expected canonical numeric text');
  const significant=text.replace(/[-+.]/g,'').replace(/^0+/,'').replace(/0+$/,'').length;
  const value=Number(text)/(percentage?100:1);
  if(significant>15||!Number.isFinite(value))return {value:text,numFmt:'@'};
  return {value,numFmt:percentage?'0.00%':'#,##0.##########;[Red](#,##0.##########);0'};
}
const PCT=new Set(['acos','tacos','ctr','cvr','orderRate','adSharePct']);
const metricKeys=Object.keys(METRICS),ratioKeys=Object.keys(RATIOS);
const headers=[...metricKeys.flatMap(k=>[k,k+' coverage',k+' populated']),...ratioKeys.flatMap(k=>[k,k+' coverage']), 'source rows','unmapped rows'];
function values(summary){
  return [...metricKeys.flatMap(k=>[numericCell(summary?.totals?.[k]),summary?.coverage?.[k]?.status||'unknown',numericCell(summary?.coverage?.[k]?.populated)]),
    ...ratioKeys.flatMap(k=>[numericCell(summary?.ratios?.[k]?.value,PCT.has(k)),summary?.ratios?.[k]?.status||'unknown']),
    numericCell(summary?.rowCount),numericCell(summary?.unmappedRows)];
}
function add(sheet,items){
  const row=sheet.addRow(items.map(x=>typeof x==='object'&&x!==null&&'value'in x?x.value:x));
  items.forEach((x,i)=>{if(x&&typeof x==='object'&&x.numFmt)row.getCell(i+1).numFmt=x.numFmt;});
  row.commit();
}
function sheetOf(workbook,name,columns){
  const sheet=workbook.addWorksheet(name,{views:[{state:'frozen',ySplit:1}]});
  sheet.columns=columns.map((h,i)=>({key:'c'+i,width:Math.min(36,Math.max(15,h.length+2))}));
  const row=sheet.addRow(columns);
  row.font={bold:true,color:{argb:'FFFFFFFF'}};
  row.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF243B53'}};
  row.commit();
  return sheet;
}
async function writeCanonicalWorkbook({ExcelJS,filePath,report,filters}){
  const workbook=new ExcelJS.stream.xlsx.WorkbookWriter({filename:filePath,useStyles:true,useSharedStrings:false});
  const info=sheetOf(workbook,'Report Scope',['Property','Value']);
  for(const pair of [['Source','canonical_v1'],['Current start',report.period.startDate],['Current end',report.period.endDate],
    ['Previous start',report.period.prevStart],['Previous end',report.period.prevEnd],['Grouping',report.groupBy],['Granularity',report.granularity],
    ['Entities',String(report.total)],['Coverage','Blank means unknown; partial and unmatched coverage labelled.'],['Precision','Values exceeding Excel numeric precision retained as text.'],
    ['Currency','Currencies are separate; no FX conversion.'],['Filters',JSON.stringify(filters)]])add(info,pair);
  info.commit();
  const summary=sheetOf(workbook,'Summary',['Period','Currency',...headers]);
  for(const [period,list] of [['current',report.current],['previous',report.previous]])for(const s of list)add(summary,[period,s.currency,...values(s)]);
  summary.commit();
  const products=sheetOf(workbook,'Entity Comparisons',['Period','Seller ID','Seller','Marketplace','Currency','Entity','Title','Brand','Category',...headers]);
  for(const r of report.rows)for(const period of ['current','previous']){
    const s=r[period];
    // Missing period is explicit; never manufacture zero rows.
    add(products,[period,r.sellerId,r.sellerName,r.marketplace,r.currency,r.entityKey,r.title,r.brand,r.category,...values(s)]);
  }
  products.commit();
  const history=sheetOf(workbook,'History',['Period','Bucket','Currency',...headers]);
  for(const s of report.series)add(history,[s.periodKey,s.bucket,s.currency,...values(s)]);
  history.commit();
  await workbook.commit();
}
module.exports={numericCell,writeCanonicalWorkbook};
