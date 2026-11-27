const fs=require('node:fs');
const fsp=require('node:fs/promises');
const { Readable }=require('node:stream');
const { pipeline }=require('node:stream/promises');
const ExcelJS=require('exceljs');

const EXCEL_ROWS=1048576,EXCEL_COLS=16384;
const yieldTurn=()=>new Promise(resolve=>setImmediate(resolve));
function ensureActive(signal){
  if(signal?.aborted)throw new Error('GMS export timed out or was cancelled');
}
function csvCell(value){
  let s=String(value??'-');
  if(typeof value==='string'&&s!=='-'&&/^[\s\u0000-\u001f]*[=+\-@]/.test(s))s="'"+s;
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
// Keep one output row at a time, not a second in-memory matrix or ZIP buffer.
// The caller still owns its computed matrix; SQL-source streaming is separate.
async function writeGmsExport({filePath,format,report,columns,signal,onProgress=async()=>{}}){
  const rows=report.matrixRows,headers=columns.map(c=>c.label);
  if(format==='xlsx'&&(headers.length>EXCEL_COLS||rows.length+1>EXCEL_ROWS))
    throw new Error('Matrix exceeds Excel limits; narrow the report or select CSV');
  if(!['xlsx','csv'].includes(format))throw new Error('Unsupported GMS export format');
  ensureActive(signal);
  const partial=filePath+'.partial';
  let output, abortOutput;
  try{
    if(format==='csv'){
      async function* chunks(){
        yield '\ufeff'+headers.map(csvCell).join(',')+'\r\n';
        for(let i=0;i<rows.length;i++){
          ensureActive(signal);
          yield columns.map(c=>csvCell(c.getValue(rows[i]))).join(',')+'\r\n';
          if((i+1)%1000===0)await onProgress(i+1,rows.length);
        }
      }
      output=fs.createWriteStream(partial,{flags:'wx'});
      await pipeline(Readable.from(chunks()),output,{signal});
    }else{
      output=fs.createWriteStream(partial,{flags:'wx'});
      // Use the stream writer, rather than XLSX.write(... type:'buffer').
      let streamError;
      const streamFailure=new Promise((_,reject)=>output.once('error',err=>{streamError=err;reject(err);}));
      streamFailure.catch(()=>{}); // handle early disk errors before commit
      abortOutput=()=>output.destroy(new Error('GMS export cancelled'));
      signal?.addEventListener('abort',abortOutput,{once:true});
      const book=new ExcelJS.stream.xlsx.WorkbookWriter({stream:output,useStyles:false,useSharedStrings:false});
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
      if(streamError)throw streamError;
      await Promise.race([book.commit(),streamFailure]);
    }
    ensureActive(signal);
    const stat=await fsp.stat(partial);
    if(!stat.size)throw new Error('Export file is empty');
    await fsp.rename(partial,filePath);
    return {rowCount:rows.length,fileSize:stat.size};
  }catch(err){
    if(output&&!output.destroyed)output.destroy();
    throw err;
  }finally{
    if(abortOutput)signal?.removeEventListener('abort',abortOutput);
    await fsp.unlink(partial).catch(()=>{});
  }
}
module.exports={writeGmsExport,csvCell,summaryRows,ensureActive};
