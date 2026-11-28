'use strict';
// Phase 1: strict product_daily v1 source parsing. This module has no database side effects.
const contract = require('../contracts/ads-product-daily-v1.json');
const { TextDecoder } = require('node:util');
const { createHash } = require('node:crypto');

const MAX_FILE_BYTES = 32 * 1024 * 1024;
const MAX_ROWS = 200000;
// Retain a separate bound on scanned records, including blank sheet rows.
const MAX_SOURCE_RECORDS = 1000000;
const MAX_ISSUES = 100;
const FIELDS = contract.fields;
const HEADERS = FIELDS.map(f => f.header);
const ADDITIVE = ['sales','spend','clicks','impressions','orders','conversions','total_sales','total_orders',
  'total_units','ordered_revenue','ordered_orders','units_ordered','organic_sales','organic_orders'].map(h => 'metrics.' + h);

class AdsValidationError extends Error {
  constructor(code, message, row = null, column = null) {
    super(message); this.name = 'AdsValidationError'; this.code = code; this.row = row; this.column = column;
  }
}
const reject = (code, message, row, column) => { throw new AdsValidationError(code, message, row, column); };
function identity(value) {
  let s = String(value).trim();
  if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) s = s.slice(1,-1).trim();
  return s;
}
function validDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y,m,d] = s.split('-').map(Number);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  return y >= 1 && m >= 1 && m <= 12 && d >= 1 && d <= [31,leap?29:28,31,30,31,30,31,31,30,31,30,31][m-1];
}
function numberText(s, integer) {
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(s)) throw new Error('Invalid decimal');
  let negative = s[0] === '-';
  const [whole, decimals = ''] = s.replace(/^[+-]/,'').split('.');
  const w = whole.replace(/^0+(?=\d)/,'');
  const d = decimals.replace(/0+$/,'');
  if (integer && d) throw new Error('Fractional integer');
  if (integer) {
    const n = BigInt((negative ? '-' : '') + w);
    if (n < -9223372036854775808n || n > 9223372036854775807n) throw new Error('Integer overflow');
    return n.toString();
  }
  // Fixed SQL DECIMAL(28,10); reject precision loss rather than silently rounding.
  if (w.length > 18 || d.length > 10) throw new Error('Decimal overflow');
  if (w === '0' && !d) negative = false;
  return (negative ? '-' : '') + w + (d ? '.' + d : '');
}
function normalize(field, raw, row) {
  const s = String(raw).trim();
  if (field.type === 'asin') {
    const value = identity(s).toUpperCase();
    if (!/^[A-Z0-9]{10}$/.test(value)) reject('invalid_asin','Expected a 10-character Amazon ASIN.',row,field.header);
    return value;
  }
  if (field.type === 'date') {
    const value = identity(s);
    if (!validDate(value)) reject('invalid_date','Expected a valid YYYY-MM-DD date; no fallback is permitted.',row,field.header);
    return value;
  }
  if (field.type === 'string') {
    const value = identity(s);
    if (!value || /^none$/i.test(value)) return null;
    if (value.length > 255 || /[\u0000]/.test(value)) reject('invalid_sku','SKU exceeds the permitted length or contains a null character.',row,field.header);
    return value;
  }
  if (!s) return null;
  try { return numberText(s, field.type === 'integer'); }
  catch { return reject('invalid_numeric','Invalid number or unsupported precision for this field.',row,field.header); }
}
// Strict CSV state machine: supports BOM, CRLF, escaped quotes and quoted newlines.
// Row numbers are logical CSV records including the header, independent of physical lines.
function* csvRecords(text) {
  let row = [], cell = '', state = 'start', record = 1;
  const finishCell = () => { row.push(cell); cell = ''; state = 'start'; };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (state === 'quoted') {
      if (ch === '"') {
        if (text[i+1] === '"') { cell += '"'; i++; }
        else state = 'closed';
      } else cell += ch;
      continue;
    }
    if (ch === ',' || ch === '\n' || ch === '\r') {
      finishCell();
      if (ch !== ',') {
        if (ch === '\r' && text[i+1] === '\n') i++;
        yield { row: record++, cells: row };
        row = [];
      }
      continue;
    }
    if (state === 'closed') reject('malformed_csv','Unexpected text after a closing quote.',record);
    if (ch === '"') {
      if (state !== 'start') reject('malformed_csv','Unexpected quote in an unquoted field.',record);
      state = 'quoted';
    } else { cell += ch; state = 'plain'; }
  }
  if (state === 'quoted') reject('malformed_csv','Unterminated quoted field.',record);
  if (row.length || cell.length || state !== 'start') {
    finishCell(); yield { row: record, cells: row };
  }
}
// Shared by validation, catalog preflight and transactional replay. Test the
// decoded cells before normalization and width checks: empty spreadsheet rows
// may be bare newlines, comma-only records or quoted/whitespace cells.
// A zero, a placeholder such as None, or any other nonblank text is DATA.
function* dataRecords(it, onBlank) {
  let scanned=0, rows=0;
  for(let next=it.next();!next.done;next=it.next()){
    const record=next.value;
    if(++scanned>MAX_SOURCE_RECORDS)
      reject('source_row_limit','Report exceeds 1,000,000 CSV records including empty rows; remove excess blank rows or split the file.',record.row);
    if(record.cells.every(cell=>cell.trim()==='')){
      onBlank?.();
      continue;
    }
    if(++rows>MAX_ROWS)
      reject('row_limit','Report exceeds 200,000 data records; split by date range.',record.row);
    yield record;
  }
}
function scaled(s) {
  const neg = s.startsWith('-');
  const [w,d=''] = s.replace(/^-/,'').split('.');
  return (neg ? -1n : 1n) * (BigInt(w) * 10000000000n + BigInt(d.padEnd(10,'0')));
}
function unscaled(n) {
  const neg = n < 0n; const s = (neg ? -n : n).toString().padStart(11,'0');
  const d = s.slice(-10).replace(/0+$/,'');
  return (neg ? '-' : '') + s.slice(0,-10) + (d ? '.' + d : '');
}
function prepareReport(input) {
  const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input);
  if (!bytes.length || bytes.length > MAX_FILE_BYTES) reject('invalid_file_size','Select a nonempty CSV no larger than 32 MiB.');
  let text;
  try { text = new TextDecoder('utf-8',{fatal:true}).decode(bytes); }
  catch { reject('invalid_encoding','The report must be valid UTF-8.'); }
  const it = csvRecords(text)[Symbol.iterator]();
  const first = it.next().value;
  if (!first) reject('missing_header','The CSV has no header.');
  const headers = first.cells;
  if (headers.length !== HEADERS.length || new Set(headers).size !== headers.length ||
      headers.some(h => !HEADERS.includes(h))) reject('invalid_header','Expected exactly the 63 unique product_daily v1 headers.');
  const positions = HEADERS.map(h => headers.indexOf(h));
  return {bytes,it,positions};
}
function validateReport(input,{onIssue}={}) {
  const {bytes,it,positions}=prepareReport(input);
  const seen = new Map(), asins = new Set(), dates = new Set();
  const issues = [], coverage = Object.fromEntries(HEADERS.map(h => [h,{populated:0,zero:0}]));
  const sums = Object.fromEntries(ADDITIVE.map(h => [h,0n]));
  let issueCount=0, rows=0, skippedBlankRows=0, validRows=0, invalidRows=0, exactDuplicates=0, conflictingDuplicates=0;
  let adsRows=0, businessRows=0, bothRows=0;
  let issueContext={};
  const addIssue = (code,message,row,column=null) => {
    issueCount++;
    const issue={code,message,row,column,...issueContext};
    if (issues.length < MAX_ISSUES) issues.push(issue);
    if(onIssue)onIssue(issue);
  };
  for (const {row,cells} of dataRecords(it,()=>{skippedBlankRows++;})) {
    issueContext={};
    rows++;
    if (cells.length !== HEADERS.length) { invalidRows++; addIssue('row_width','Expected 63 fields.',row); continue; }
    const asin=identity(cells[positions[HEADERS.indexOf('asin')]]).toUpperCase(),date=identity(cells[positions[HEADERS.indexOf('date')]]);
    if(/^[A-Z0-9]{10}$/.test(asin))issueContext.asin=asin;
    if(validDate(date))issueContext.date=date;
    const values = {};
    let bad=false;
    for (let i=0; i<FIELDS.length; i++) {
      try { values[HEADERS[i]]=normalize(FIELDS[i],cells[positions[i]],row); }
      catch(e) {
        if (!(e instanceof AdsValidationError)) throw e;
        bad=true; addIssue(e.code,e.message,row,e.column);
      }
    }
    if (bad) { invalidRows++; continue; }
    for (const [a,b] of [['total_sales','ordered_revenue'],['total_orders','ordered_orders'],['total_units','units_ordered']]) {
      const x=values['metrics.'+a], y=values['metrics.'+b];
      if (x !== null && y !== null && x !== y) {
        bad=true; addIssue('source_total_mismatch','Explicit total and corresponding ordered metric disagree.',row,'metrics.'+a);
      }
    }
    if (bad) { invalidRows++; continue; }
    const key=values.asin+'|'+values.date;
    const fingerprint=createHash('sha256').update(JSON.stringify(HEADERS.map(h=>values[h]))).digest('hex');
    if (seen.has(key)) {
      const exact=seen.get(key)===fingerprint;
      if (exact) exactDuplicates++; else conflictingDuplicates++;
      addIssue(exact?'exact_duplicate':'conflicting_duplicate','Repeated ASIN/date key; resolve before import.',row,'asin');
      continue;
    }
    seen.set(key,fingerprint); asins.add(values.asin); dates.add(values.date); validRows++;
    for (const h of HEADERS) {
      if (values[h] !== null) coverage[h].populated++;
      if (values[h] === '0' && h !== 'sku') coverage[h].zero++;
    }
    for (const h of ADDITIVE) if (values[h] !== null) sums[h] += scaled(values[h]);
    const ads=values['metrics.spend'] !== null || values['metrics.sales'] !== null;
    const business=values['metrics.total_sales'] !== null || values['metrics.total_orders'] !== null;
    adsRows+=Number(ads); businessRows+=Number(business); bothRows+=Number(ads&&business);
  }
  issueContext={};
  if (!rows) addIssue('no_data','The report contains no data rows.',1);
  const sortedDates=[...dates].sort();
  return {schemaVersion:contract.schemaVersion,reportType:'daily',valid:issueCount===0,rows,skippedBlankRows,sourceRecords:rows+skippedBlankRows,validRows,invalidRows,
    exactDuplicates,conflictingDuplicates,uniqueAsins:asins.size,uniqueDates:dates.size,
    startDate:sortedDates[0]||null,endDate:sortedDates.at(-1)||null,
    populations:{adsRows,businessRows,bothRows,neitherRows:validRows-adsRows-businessRows+bothRows},
    coverage,totals:Object.fromEntries(ADDITIVE.map(h=>[h,coverage[h].populated?unscaled(sums[h]):null])),
    issueCount,issues,issuesTruncated:issueCount>issues.length,sourceFileSha256:createHash('sha256').update(bytes).digest('hex')};
}
// Internal replay of the exact validated bytes. The writer validates first and
// keeps the same private Buffer; any replay inconsistency aborts its transaction.
function* replayValidatedRows(input, expectedSha256) {
  const {bytes,it,positions}=prepareReport(input);
  if(createHash('sha256').update(bytes).digest('hex')!==expectedSha256)
    reject('source_changed','The report changed after validation.');
  for(const {row,cells} of dataRecords(it)){
    if(cells.length!==HEADERS.length)reject('row_width','Invalid validated record.',row);
    const values=FIELDS.map((f,i)=>normalize(f,cells[positions[i]],row));
    yield [row,...values];
  }
}
module.exports={validateReport,replayValidatedRows,AdsValidationError,MAX_FILE_BYTES,MAX_ROWS,HEADERS,normalize,validDate,numberText};
