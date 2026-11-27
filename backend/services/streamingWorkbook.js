const ExcelJS=require('exceljs');

// ExcelJS 3.10 uses archiver 4 / compress-commons 3 / crc32-stream 3.
// For buffered DEFLATE entries that stack calls DeflateCRC32Stream.end(buffer).
// Modern Node Writable.end bypasses the overridden write() byte/CRC counter.
// Store the small buffered OPC parts (metadata, theme, styles) instead.
// Worksheet streams still use DEFLATE with normal pipe/write accounting.
// Apply this compatibility adapter only to this workbook instance; never
// monkey-patch Node streams or shared library prototypes.
function createStreamingWorkbook(options={}){
  const book=new ExcelJS.stream.xlsx.WorkbookWriter({
    ...options,zip:{...options.zip,store:true},
  });
  // The constructor already queued the initial metadata entries under STORE.
  // ExcelJS exposes its archiver instance as book.zip in the locked version.
  // Fail closed if a future dependency changes this integration contract.
  if(!book.zip||typeof book.zip.append!=='function')throw new Error('Unsupported streaming workbook writer');
  const append=book.zip.append.bind(book.zip);
  book.zip.append=(source,data={})=>append(source,{
    ...data,store:!(source&&typeof source.pipe==='function')
  });
  return book;
}
module.exports={createStreamingWorkbook};
