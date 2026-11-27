const fs=require('node:fs/promises');
const {createReadStream}=require('node:fs');
const {createInflateRaw}=require('node:zlib');
const {Writable}=require('node:stream');
const {pipeline}=require('node:stream/promises');
const path=require('node:path');
const {StringDecoder}=require('node:string_decoder');
const unzipper=require('unzipper');
const {SaxesParser}=require('saxes');
const crc32=require('crc-32');

const XLSX_MIME='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const REQUIRED=['[Content_Types].xml','_rels/.rels','xl/workbook.xml','xl/_rels/workbook.xml.rels'];
const aborted=signal=>{if(signal?.aborted)throw new Error('Export verification cancelled');};
function integrityError(){
  const err=new Error('The saved spreadsheet is incomplete or invalid. Generate a new export and try again.');
  err.code='EXPORT_INVALID_FILE';
  return err;
}
function safeExportName(download){
  const id=String(download?.Id??''),name=String(download?.FileName??'');
  // Generated job IDs and names are ASCII. Never search by substring or use
  // the stored FilePath as an arbitrary local filesystem path.
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id)||!/^[a-zA-Z0-9_.-]{1,240}$/.test(name)||name==='.'||name==='..')throw integrityError();
  const extension=path.extname(name).toLowerCase();
  if(!['.csv','.xlsx'].includes(extension))throw integrityError();
  if(download.Format&&String(download.Format).toLowerCase()!==extension.slice(1))throw integrityError();
  return {name,diskName:id+'_'+name,format:extension.slice(1)};
}
async function checkFileEnvelope(file,format,expectedSize){
  const info=await fs.lstat(file);
  if(!info.isFile()||info.isSymbolicLink()||info.size===0)throw integrityError();
  if(expectedSize!=null&&Number(expectedSize)>0&&Number(expectedSize)!==info.size)throw integrityError();
  const fd=await fs.open(file,'r');
  try{
    const head=Buffer.alloc(Math.min(info.size,512));
    await fd.read(head,0,head.length,0);
    const isZip=head.length>=4&&head.readUInt32LE(0)===0x04034b50;
    if(format==='xlsx'){
      if(!isZip||info.size<22)throw integrityError();
      // ZIP/ZIP64 always ends with an ordinary end-of-central-directory
      // record (and optional comment). Detect partial or mislabeled files.
      const tail=Buffer.alloc(Math.min(info.size,65557));
      await fd.read(tail,0,tail.length,info.size-tail.length);
      let valid=false;
      for(let i=tail.length-22;i>=0;i--){
        if(tail.readUInt32LE(i)===0x06054b50&&i+22+tail.readUInt16LE(i+20)===tail.length){valid=true;break;}
      }
      if(!valid)throw integrityError();
    }else if(format==='csv'){
      const prefix=head.toString('utf8').replace(/^\uFEFF/,'').trimStart();
      if(isZip||/^(?:<!doctype\s+html|<html\b|<\?xml\b|\{\s*"|\[\s*\{)/i.test(prefix)||head.includes(0))throw integrityError();
    }else throw integrityError();
    return info;
  }finally{await fd.close();}
}
const attr=(tag,name)=>tag.attributes[name]?.value??tag.attributes[name];
const mainNs='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const relNs='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
function sheetTarget(target){
  if(typeof target!=='string'||!target||target.includes('\\')||target.includes('\0'))throw integrityError();
  const value=path.posix.resolve('/xl',target).slice(1);
  if(!/^xl\/worksheets\/[^/]+\.xml$/.test(value))throw integrityError();
  return value;
}
// Stream exactly the compressed byte range identified by the ZIP central
// directory. A streaming ZIP writer may put zero placeholders in its local
// header and append a data descriptor; those placeholders are not the sizes
// or CRC against which its contents should be validated.
async function readZipEntry(file,entry,archiveSize,consume,signal){
  aborted(signal);
  const offset=Number(entry.offsetToLocalFileHeader),compressed=Number(entry.compressedSize);
  const expected=Number(entry.uncompressedSize),method=Number(entry.compressionMethod),flags=Number(entry.flags);
  if(![offset,compressed,expected,flags,method].every(Number.isSafeInteger)||
      offset<0||compressed<0||expected<0||offset+30>archiveSize||
      (flags&1)||![0,8].includes(method))throw integrityError();
  const fd=await fs.open(file,'r');
  let start;
  try{
    const local=Buffer.alloc(30);
    if((await fd.read(local,0,30,offset)).bytesRead!==30||local.readUInt32LE(0)!==0x04034b50||
       local.readUInt16LE(8)!==method||(local.readUInt16LE(6)&1))throw integrityError();
    const nameLength=local.readUInt16LE(26),extraLength=local.readUInt16LE(28);
    const name=Buffer.alloc(nameLength);
    if((await fd.read(name,0,nameLength,offset+30)).bytesRead!==nameLength||name.toString('utf8')!==entry.path)throw integrityError();
    start=offset+30+nameLength+extraLength;
    if(start+compressed>archiveSize)throw integrityError();
  }finally{await fd.close();}
  if(!compressed){if(expected!==0)throw integrityError();return;}
  let size=0;
  const sink=new Writable({write(chunk,_encoding,cb){
    try{
      aborted(signal);size+=chunk.length;
      if(size>expected)throw integrityError();
      consume(chunk);cb();
    }catch(err){cb(err);}
  }});
  const source=createReadStream(file,{start,end:start+compressed-1});
  if(method===8)await pipeline(source,createInflateRaw(),sink,{signal});
  else await pipeline(source,sink,{signal});
}
// Validate the complete ZIP and every XML part without loading a second
// workbook into memory. Strict XML parsing catches malformed XML that a
// permissive spreadsheet reader might accept. This is not Office schema QA.
async function verifyXlsx(file,{signal,expectedSheets}={}){
  aborted(signal);
  const info=await checkFileEnvelope(file,'xlsx');
  const archive=await unzipper.Open.file(file);
  const files=new Map();
  for(const entry of archive.files){
    if(entry.type==='Directory'||entry.path.endsWith('/'))continue;
    if(files.has(entry.path))throw integrityError();
    files.set(entry.path,entry);
  }
  if(REQUIRED.some(name=>!files.has(name)))throw integrityError();
  const sheets=[],relationships=new Map(),sheetRows=new Map();
  for(const [name,entry] of files){
    aborted(signal);
    const xml=/\.(?:xml|rels)$/i.test(name);
    const decoder=xml?new StringDecoder('utf8'):null;
    const parser=xml?new SaxesParser({xmlns:true}):null;
    let size=0,crc=0,rows=0,root=null;
    if(parser){
      parser.on('error',err=>{throw err;});
      parser.on('doctype',()=>{throw integrityError();});
      parser.on('opentag',tag=>{
        if(root===null)root=tag.local;
        if(name==='xl/workbook.xml'&&tag.local==='sheet'&&tag.uri===mainNs){
          const rel=Object.values(tag.attributes).find(a=>a.local==='id'&&a.uri===relNs);
          sheets.push({name:attr(tag,'name'),id:rel?.value});
        }
        if(name==='xl/_rels/workbook.xml.rels'&&tag.local==='Relationship'){
          const id=attr(tag,'Id');
          if(relationships.has(id))throw integrityError();
          relationships.set(id,{type:attr(tag,'Type'),target:attr(tag,'Target'),mode:attr(tag,'TargetMode')});
        }
        if(/^xl\/worksheets\/[^/]+\.xml$/.test(name)&&tag.local==='row'&&tag.uri===mainNs)rows++;
      });
    }
    const expectedSize=Number(entry.uncompressedSize),expectedCrc=Number(entry.crc32)>>>0;
    await readZipEntry(file,entry,info.size,chunk=>{
      size+=chunk.length;crc=crc32.buf(chunk,crc);
      if(parser)parser.write(decoder.write(chunk));
    },signal);
    if(parser){parser.write(decoder.end());parser.close();}
    if(size!==expectedSize||(crc>>>0)!==expectedCrc){
      // Diagnostic details stay in server logs, never in the response.
      const err=integrityError();
      err.message+=' [ZIP entry '+name+'; size '+size+'/'+expectedSize+'; CRC '+(crc>>>0)+'/'+expectedCrc+']';
      throw err;
    }
    if(/^xl\/worksheets\/[^/]+\.xml$/.test(name)){
      if(root!=='worksheet')throw integrityError();
      sheetRows.set(name,rows);
    }
  }
  if(!sheets.length||new Set(sheets.map(s=>String(s.name).toLowerCase())).size!==sheets.length)throw integrityError();
  const counts=new Map(),targets=new Set();
  for(const sheet of sheets){
    const r=relationships.get(sheet.id);
    if(!sheet.name||!sheet.id||!r||r.mode==='External'||!String(r.type||'').endsWith('/worksheet'))throw integrityError();
    const target=sheetTarget(r.target);
    if(!sheetRows.has(target)||targets.has(target))throw integrityError();
    targets.add(target);
    counts.set(sheet.name,sheetRows.get(target));
  }
  if(expectedSheets){
    if(counts.size!==expectedSheets.size)throw integrityError();
    for(const [name,count] of expectedSheets){
      if(!counts.has(name)||(count!=null&&counts.get(name)!==count))throw integrityError();
    }
  }
  return {size:info.size,sheets:counts};
}
module.exports={XLSX_MIME,integrityError,safeExportName,checkFileEnvelope,verifyXlsx};
