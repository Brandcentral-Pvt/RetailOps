'use strict';
const {createWriteStream}=require('node:fs');
const {finished}=require('node:stream/promises');
const {once}=require('node:events');
const fs=require('node:fs/promises');
const {SOURCE_FIELDS,rawReconciler,abort}=require('./adsExportSnapshot');
const {RAW_META}=require('./adsCompleteWorkbook');
const numeric=new Set([...SOURCE_FIELDS.filter(f=>['integer','decimal'].includes(f.type)).map(f=>f.canonicalColumn),'CatalogMatches','SourceRowNumber','SourceSchemaVersion']);
function csvCell(value,isNumeric=false){
 if(value==null)return '';
 let s=String(value);
 // Preserve source numeric sign and precision; neutralize spreadsheet formulas in text.
 if(!isNumeric&&/^[\s\u0000-\u001f]*[=+\-@]/.test(s))s="'"+s;
 return '"'+s.replace(/"/g,'""')+'"';
}
async function writeDailyCsv({filePath,report,rawCount,rawRows,signal}){
 abort(signal);
 const stream=createWriteStream(filePath,{flags:'wx'});
 const done=finished(stream,{cleanup:true});done.catch(()=>{});
 const cancel=()=>stream.destroy(new Error('Export interrupted'));
 signal?.addEventListener('abort',cancel,{once:true});
 const fields=[...SOURCE_FIELDS.map(f=>[f.canonicalColumn,f.header]),...RAW_META];
 const put=async line=>{abort(signal);if(!stream.write(line))await Promise.race([once(stream,'drain'),done.then(()=>{throw Error('CSV stream ended early');})]);};
 try{
  await put('\uFEFF'+fields.map(([,h])=>csvCell(h)).join(',')+'\r\n');
  const reconcile=rawReconciler(report);let count=0;
  for await(const row of rawRows()){
   abort(signal);reconcile.add(row);
   await put(fields.map(([k])=>csvCell(row[k],numeric.has(k))).join(',')+'\r\n');
   count++;
  }
  reconcile.finish(rawCount);
  stream.end();await done;abort(signal);
  return {rawCount:count,entityCount:report.total};
 }catch(e){stream.destroy();await done.catch(()=>{});await fs.unlink(filePath).catch(()=>{});throw e;}
 finally{signal?.removeEventListener('abort',cancel);}
}
module.exports={writeDailyCsv,csvCell};
