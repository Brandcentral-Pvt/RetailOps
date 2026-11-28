'use strict';
// Offline CLI: never connect to the database. Output includes aggregate financial values;
// run privately and share only sanitized diagnostics.
const fs=require('node:fs');
const {validateReport,AdsValidationError,MAX_FILE_BYTES}=require('../services/adsProductContract');
try {
  if (process.argv.length!==3) throw new Error('Usage: node scripts/validateAdsProductReport.js <report.csv>');
  const file=process.argv[2];
  if (fs.statSync(file).size>MAX_FILE_BYTES) throw new Error('File exceeds 32 MiB');
  const report=validateReport(fs.readFileSync(file));
  console.log(JSON.stringify(report,null,2));
  if (!report.valid) process.exitCode=2;
} catch(e) {
  console.error(e instanceof AdsValidationError?JSON.stringify({code:e.code,message:e.message,row:e.row,column:e.column}):'Validation could not run. Check the CSV path and file size.');
  process.exitCode=1;
}
