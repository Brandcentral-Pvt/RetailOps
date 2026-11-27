const fs=require('node:fs');
const fsp=require('node:fs/promises');
const { Readable }=require('node:stream');
const { pipeline,finished }=require('node:stream/promises');
const ExcelJS=require('exceljs');
const {createStreamingWorkbook}=require('./streamingWorkbook');
const {verifyXlsx,checkFileEnvelope}=require('./exportFileIntegrity');

const EXCEL_ROWS=1048576,EXCEL_COLS=16384;
const yieldTurn=()=>new Promise(resolve=>setImmediate(resolve));
function ensureActive(signal){
  if(signal?.aborted)throw new Error('GMS export timed out or was cancelled');
}
function csvCell(value){
  let s=String(value??'-');
  if(typeof value==='string'&&s!=='-'&&!/^[+-]?\d+(?:\.\d+)?$/.test(s)&&/^[\s\u0000-\u001f]*[=+\-@]/.test(s))s="'"+s;
  return '"'+s.replace(/"/g,'""')+'"';
}
function summaryRows(report){
  const c=report.comparison;
  return [
    ['Selected start',report.selectedWindow.from||'All time'],
    ['Selected end',report.selectedWindow.to||'All time'],
    ['Current records',report.meta.records],
    ['Unmatched records',report.meta.unmatchedRecords],
    ['Prior start',c.window?.from||'-'],
    ['Prior end',c.window?.to||'-'],
    ['Current observed days',c.currentCoverage.observedDays],
    ['Current expected days',c.currentCoverage.expectedDays??'-'],
    ['Prior observed days',c.previousCoverage?.observedDays??'-'],
    [],
    ['Metric','Current','Prior','Change (% or percentage points for ratios)'],
    ...Object.keys(report.kpis).map(k=>[k,report.kpis[k]??'-',c.baseline[k]??'-',c.changes[k]??'-']),
  ];
}
const formats={
  money:'#,##0.00;[Red](#,##0.00);0.00',
  units:'#,##0;[Red](#,##0);0',
  ratio:'0.00%;[Red]-0.00%;0.00%',
  pp:'0.00" pp";[Red]-0.00" pp";0.00" pp"',
  percent100:'0.00"%";[Red]-0.00"%";0.00"%"',
  text:'@'
};
function styleHeader(row){
  row.font={bold:true,color:{argb:'FFFFFFFF'},size:11};
  row.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF243B53'}};
  row.alignment={vertical:'middle',wrapText:true};
  row.height=32;
}
function matrixSheet(report,columns){
  return {name:'GMS Matrix',rowCount:report.matrixRows.length,
    columns:columns.map(c=>({label:c.label,width:/Product Title/i.test(c.label)?48:/Seller|Brand/i.test(c.label)?25:19,
      kind:/\(%\)/.test(c.label)?'percent100':/Units/i.test(c.label)?'units':/Seller|ASIN|Title|Brand|Store/i.test(c.label)?'text':'money'})),
    rows:function*(){for(const r of report.matrixRows)yield columns.map(c=>c.getValue(r)??null);}};
}
async function writeTable(book,descriptor,signal,onProgress,checkError,{streaming,expectedSheets}){
  const commitRow=row=>{if(streaming)row.commit();};
  const commitSheet=sheet=>{if(streaming)sheet.commit();};
  const {columns}=descriptor;
  if(columns.length>EXCEL_COLS)throw new Error('Report exceeds Excel column limits; use weekly or monthly matrix granularity');
  if(descriptor.summary){
    const sheet=book.addWorksheet(descriptor.name,{views:[{state:'frozen',ySplit:1}]});
    sheet.columns=columns.map(c=>({width:c.width}));
    let n=0,metrics=false;
    for(const values of descriptor.rows()){
      ensureActive(signal);checkError();n++;
      const row=sheet.addRow(values);
      if(n===1||values[0]==='Metric'){styleHeader(row);if(values[0]==='Metric')metrics=true;}
      else if(metrics){
        const ratio=values[4]==='pp';
        row.getCell(2).numFmt=ratio?formats.ratio:/Units|Returns/.test(values[0])?formats.units:formats.money;
        row.getCell(3).numFmt=row.getCell(2).numFmt;
        row.getCell(4).numFmt=ratio?formats.pp:formats.ratio;
        row.getCell(1).font={bold:true};
      }else if(typeof values[1]==='string'&&values[1].length>48){
        row.getCell(2).alignment={wrapText:true,vertical:'top'};
        row.height=Math.min(90,15*Math.ceil(values[1].length/45));
      }
      commitRow(row);
    }
    expectedSheets.set(descriptor.name,null); // Blank separator rows may be omitted.
    commitSheet(sheet);
    return;
  }
  // Excel has a hard row limit. Split long tables without omitting records.
  const perSheet=EXCEL_ROWS-1;
  let count=0,sheet=null,part=0;
  function startSheet(){
    if(sheet)commitSheet(sheet);
    part++;
    const suffix=part===1?'':' '+part;
    const sheetName=descriptor.name.slice(0,31-suffix.length)+suffix;
    sheet=book.addWorksheet(sheetName,{views:[{state:'frozen',ySplit:1,xSplit:Math.min(2,columns.length)}]});
    sheet.columns=columns.map(c=>({width:c.width||18,style:{numFmt:formats[c.kind]||'General'}}));
    const remaining=Math.min(perSheet,Math.max(0,descriptor.rowCount-count));
    if(remaining)sheet.autoFilter={from:{row:1,column:1},to:{row:remaining+1,column:columns.length}};
    expectedSheets.set(sheetName,remaining+1);
    const head=sheet.addRow(columns.map(c=>c.label));styleHeader(head);commitRow(head);
  }
  startSheet();
  for(const values of descriptor.rows()){
    ensureActive(signal);checkError();
    if(count>0&&count%perSheet===0)startSheet();
    const row=sheet.addRow(values.map(v=>v??null));
    commitRow(row);count++;
    if(count%256===0)await yieldTurn();
    if(count%1000===0)await onProgress(count,descriptor.rowCount);
  }
  commitSheet(sheet);
  if(count!==descriptor.rowCount)throw new Error('Report row-count reconciliation failed for '+descriptor.name);
}
// Split very wide historical matrices horizontally, retaining identity fields.
function matrixParts(descriptor,fixedCount){
  if(descriptor.columns.length<=EXCEL_COLS)return [descriptor];
  const parts=[],step=EXCEL_COLS-fixedCount;
  for(let offset=fixedCount;offset<descriptor.columns.length;offset+=step){
    const indices=[...Array.from({length:fixedCount},(_,i)=>i),...Array.from({length:Math.min(step,descriptor.columns.length-offset)},(_,i)=>offset+i)];
    parts.push({name:'GMS Matrix '+(parts.length+1),rowCount:descriptor.rowCount,columns:indices.map(i=>descriptor.columns[i]),
      rows:function*(){for(const row of descriptor.rows())yield indices.map(i=>row[i]);}});
  }
  return parts;
}
// Keep one output row at a time, not a second in-memory matrix or ZIP buffer.
// The caller still owns its computed matrix; SQL-source streaming is separate.
async function writeGmsExport({filePath,format,report,columns,complete=null,matrixFixedCount=7,signal,onProgress=async()=>{}}){
  const rows=report.matrixRows,headers=columns.map(c=>c.label);
  if(!complete&&format==='xlsx'&&(headers.length>EXCEL_COLS||rows.length+1>EXCEL_ROWS))
    throw new Error('Matrix exceeds Excel limits; narrow the report or select CSV');
  if(!['xlsx','csv'].includes(format))throw new Error('Unsupported GMS export format');
  ensureActive(signal);
  const partial=filePath+'.partial';
  let output, abortOutput;
  try{
    if(format==='csv'){
      async function* chunks(){
        const source=complete?.raw;
        yield '\ufeff'+(source?source.columns.map(c=>c.label):headers).map(csvCell).join(',')+'\r\n';
        let count=0;
        for(const row of source?source.rows():rows){
          ensureActive(signal);
          yield (source?row.map(v=>v??''):columns.map(c=>c.getValue(row))).map(csvCell).join(',')+'\r\n';
          count++;
          if(count%1000===0)await onProgress(count,source?source.rowCount:rows.length);
        }
        if(source&&count!==source.rowCount)throw new Error('CSV row-count reconciliation failed');
      }
      output=fs.createWriteStream(partial,{flags:'wx'});
      await pipeline(Readable.from(chunks()),output,{signal});
    }else{
      const descriptors=complete?[...complete.sheets,...matrixParts(matrixSheet(report,columns),matrixFixedCount)]:null;
      const expectedSheets=new Map();
      const estimate=descriptors?.reduce((n,x)=>n+(x.rowCount+1)*x.columns.length,0)??Infinity;
      // The conventional workbook writer is used for ordinary reports. Retain
      // the streaming writer for large reports to avoid a large cell graph.
      const streaming=!(complete&&estimate<=150000&&complete.selectedCount<=5000);
      if(!streaming){
        const book=new ExcelJS.Workbook();
        let total=descriptors.reduce((n,x)=>n+x.rowCount,0),done=0;
        for(const descriptor of descriptors){
          await writeTable(book,descriptor,signal,n=>onProgress(done+n,total),()=>{}, {streaming:false,expectedSheets});
          done+=descriptor.rowCount;await onProgress(done,total);
        }
        ensureActive(signal);
        await book.xlsx.writeFile(partial);
      }else{
      output=fs.createWriteStream(partial,{flags:'wx'});
      // Use the stream writer, rather than XLSX.write(... type:'buffer').
      let streamError;
      const streamFailure=new Promise((_,reject)=>output.once('error',err=>{streamError=err;reject(err);}));
      streamFailure.catch(()=>{}); // handle early disk errors before commit
      abortOutput=()=>output.destroy(new Error('GMS export cancelled'));
      signal?.addEventListener('abort',abortOutput,{once:true});
      const book=createStreamingWorkbook({stream:output,useStyles:Boolean(complete),useSharedStrings:false});
      if(complete){
        let total=descriptors.reduce((n,x)=>n+x.rowCount,0),done=0;
        for(const descriptor of descriptors){
          await writeTable(book,descriptor,signal,(n)=>onProgress(done+n,total),()=>{if(streamError)throw streamError;},{streaming:true,expectedSheets});
          done+=descriptor.rowCount;
          await onProgress(done,total);
        }
      }else{
      const sheet=book.addWorksheet('GMS Matrix',{views:[{state:'frozen',ySplit:1}]});
      sheet.addRow(headers).commit();
      for(let i=0;i<rows.length;i++){
        ensureActive(signal);
        if(streamError)throw streamError;
        sheet.addRow(columns.map(c=>c.getValue(rows[i])??'-')).commit();
        // Yield to the event loop so timeout/cancellation and HTTP requests
        // can progress even while generating a very wide workbook.
        if((i+1)%256===0)await yieldTurn();
        if((i+1)%1000===0)await onProgress(i+1,rows.length);
      }
      sheet.commit();
      const summary=book.addWorksheet('Summary');
      for(const row of summaryRows(report))summary.addRow(row).commit();
      summary.commit();
      expectedSheets.set('GMS Matrix',rows.length+1);
      expectedSheets.set('Summary',null);
      }
      if(streamError)throw streamError;
      await Promise.race([book.commit(),streamFailure]);
      await finished(output,{cleanup:true});
      }
      ensureActive(signal);
      // Publish only a fully written, readable ZIP/XML workbook with every
      // expected sheet and data row. A malformed file never becomes completed.
      await verifyXlsx(partial,{signal,expectedSheets});
    }
    ensureActive(signal);
    const stat=await checkFileEnvelope(partial,format);
    if(!stat.size)throw new Error('Export file is empty');
    await fsp.rename(partial,filePath);
    return {rowCount:complete?complete.selectedCount:rows.length,fileSize:stat.size};
  }catch(err){
    if(output&&!output.destroyed)output.destroy();
    throw err;
  }finally{
    if(abortOutput)signal?.removeEventListener('abort',abortOutput);
    await fsp.unlink(partial).catch(()=>{});
  }
}
module.exports={writeGmsExport,csvCell,summaryRows,ensureActive};
