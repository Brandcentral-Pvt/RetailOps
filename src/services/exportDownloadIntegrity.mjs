const XLSX_MIME='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const invalid=()=>new Error('The downloaded file is incomplete or is not a valid spreadsheet. Generate a new export and try again.');
const extension=name=>String(name||'').match(/\.(xlsx|csv)$/i)?.[1]?.toLowerCase()||null;
export function exportResponseFormat(headers,expectedFileName){
  const mime=(headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
  const disposition=headers.get('content-disposition')||'';
  const name=/filename\s*=\s*"([^"]+)"/i.exec(disposition)?.[1]||/filename\s*=\s*([^;\s]+)/i.exec(disposition)?.[1];
  const requested=extension(expectedFileName),delivered=extension(name);
  if(requested&&delivered&&requested!==delivered)throw invalid();
  const format=requested||delivered||(mime===XLSX_MIME?'xlsx':mime==='text/csv'?'csv':null);
  const allowed=format==='xlsx'?[XLSX_MIME,'application/octet-stream','application/zip']:format==='csv'?['text/csv','application/csv','text/plain','application/octet-stream']:[];
  if(!allowed.includes(mime))throw invalid();
  return format;
}
export async function validateExportBlob(blob,format,expectedSize){
  if(!blob.size)throw invalid();
  const size=Number(expectedSize);
  if(Number.isSafeInteger(size)&&size>0&&size!==blob.size)throw invalid();
  const bytes=new Uint8Array(await blob.slice(0,Math.min(blob.size,512)).arrayBuffer());
  const zip=bytes.length>=4&&bytes[0]===80&&bytes[1]===75&&bytes[2]===3&&bytes[3]===4;
  if(format==='xlsx'){
    if(!zip||blob.size<22)throw invalid();
    const tail=await blob.slice(Math.max(0,blob.size-65557)).arrayBuffer();
    const view=new DataView(tail);
    let found=false;
    for(let i=view.byteLength-22;i>=0;i--){
      if(view.getUint32(i,true)===0x06054b50&&i+22+view.getUint16(i+20,true)===view.byteLength){found=true;break;}
    }
    if(!found)throw invalid();
  }else if(format==='csv'){
    const prefix=new TextDecoder().decode(bytes).trimStart();
    if(zip||bytes.includes(0)||/^(?:<!doctype\s+html|<html\b|<\?xml\b|\{\s*"|\[\s*\{)/i.test(prefix))throw invalid();
  }else throw invalid();
  return blob;
}
