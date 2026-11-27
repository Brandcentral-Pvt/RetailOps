const XLSX = require('xlsx');
const { isMainThread, parentPort, workerData } = require('node:worker_threads');
const { dateOnly } = require('../utils/gmsPhase1');
const { issue } = require('./gmsImportIssueDetails');

const MAX_ROWS = 500000;
const MAX_COLS = 64;
const MAX_ISSUES = 200;
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const fields = {
  asin: ['asin'],
  date: ['date', 'day'],
  brand: ['brand'],
  storeCode: ['storecode', 'marketplace'],
  orderedRevenue: ['orderedrevenue'],
  orderedUnits: ['orderedunits'],
  shippedRevenue: ['shippedrevenue'],
  shippedCOGS: ['shippedcogs'],
  shippedUnits: ['shippedunits'],
  customerReturns: ['customerreturns'],
};
const moneyFields = ['orderedRevenue', 'shippedRevenue', 'shippedCOGS'];
const unitFields = ['orderedUnits', 'shippedUnits', 'customerReturns'];
const normalizeHeader = v => String(v ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
function normalizeStore(v) {
  const s = String(v ?? '').trim().toLowerCase();
  return ['in', 'amazon.in', 'amazon_in', 'amazon india', 'india'].includes(s) ? 'IN' : null;
}
function isIndiaSeller(v) {
  return String(v ?? '').trim().toLowerCase() === 'amazon' || normalizeStore(v) === 'IN';
}

const isBlank = value => value == null || (typeof value === 'string' && value.trim() === '');

// Blank financial cells are explicitly zero by business policy. Preserve
// signed adjustments and reject malformed nonblank values, not just parseFloat.
function money(value) {
  if (isBlank(value)) return '0.00';
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER / 100) throw new Error('Numeric precision exceeds Excel-safe range; use exact text values');
    const rounded = value.toFixed(2);
    // Suppress only insignificant binary floating-point artifacts from Excel.
    const tolerance = Math.min(1e-7, Math.max(Math.abs(value), 1) * Number.EPSILON * 8);
    if (Math.abs(value - Number(rounded)) > tolerance) throw new Error('Invalid monetary value: more than two significant decimal places');
    value = rounded;
  }
  let s = String(value).trim().replace(/\u2212/g, '-');
  // Accounting negatives: (1,234.50), (₹1,234.50), -₹1,234.50.
  const accounting = /^\((.+)\)$/.exec(s);
  if (accounting) {
    s = accounting[1].trim();
    if (/^[+-]/.test(s)) throw new Error('Invalid monetary sign');
  }
  const signFirst = /^([+-])\s*(?:INR|₹)\s*/i.exec(s);
  s = signFirst ? signFirst[1] + s.slice(signFirst[0].length) : s.replace(/^(?:INR\s*|₹\s*)/i, '');
  if (accounting && /^[+-]/.test(s)) throw new Error('Invalid monetary sign');
  if (!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3})(?:\.\d{1,2})?$/.test(s)) throw new Error('Invalid monetary value');
  s = s.replace(/,/g, '');
  const negative = Boolean(accounting) || s.startsWith('-');
  const [whole, fraction = ''] = s.replace(/^[+-]/, '').split('.');
  const digits = whole.replace(/^0+(?=\d)/, '');
  if (digits.length > 16) throw new Error('Monetary value exceeds supported precision');
  const decimal = digits + '.' + fraction.padEnd(2, '0');
  return negative && decimal !== '0.00' ? '-' + decimal : decimal;
}
function units(value) {
  if (isBlank(value)) return 0;
  let s = String(value).trim().replace(/\u2212/g, '-');
  const accounting = /^\(([^()]+)\)$/.exec(s);
  if (accounting) {
    s = accounting[1].trim();
    if (/^[+-]/.test(s)) throw new Error('Invalid unit sign');
    s = '-' + s;
  }
  if (!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3})$/.test(s)) throw new Error('Units must be signed whole numbers');
  const n = Number(s.replace(/,/g, ''));
  if (!Number.isSafeInteger(n) || n < -2147483648 || n > 2147483647) throw new Error('Unit count exceeds supported range');
  return n === 0 ? 0 : n;
}
function reportDate(value, date1904 = false) {
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 1 || (!date1904 && value === 60)) throw new Error('Invalid Excel date');
    const parsed = XLSX.SSF.parse_date_code(value, { date1904 });
    if (!parsed) throw new Error('Invalid Excel date');
    value = [String(parsed.y).padStart(4, '0'), String(parsed.m).padStart(2, '0'), String(parsed.d).padStart(2, '0')].join('-');
  }
  let s = String(value ?? '').trim();
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (dmy) s = [dmy[3], dmy[2].padStart(2,'0'), dmy[1].padStart(2,'0')].join('-');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error('Use YYYY-MM-DD or DD/MM/YYYY');
  const day = dateOnly(s);
  if (day < '2000-01-01' || day > '2099-12-31') throw new Error('Date outside supported reporting years');
  return day;
}
function validateRows(matrix, date1904 = false, cellProblems = new Map()) {
  const issues = [], allIssues = [];
  let invalid = 0, total = 0, duplicates = 0, defaultedCells = 0, defaultedRows = 0, negativeRows = 0;
  const addIssue = (row, code, message, context) => {
    invalid++;
    const item = issue(row, code, message, context);
    allIssues.push(item);
    if (issues.length < MAX_ISSUES) issues.push(item);
  };
  if (!Array.isArray(matrix) || matrix.length < 2) {
    addIssue(1, 'EMPTY_REPORT', 'The report has no data rows');
    return { rows: [], issues, allIssues, invalid, total, duplicates, defaultedCells, defaultedRows, negativeRows };
  }
  const headerProblem = cellProblems.get(1);
  if (headerProblem) addIssue(1, headerProblem.code, headerProblem.message, { column: headerProblem.column });
  const headers = matrix[0].map(normalizeHeader);
  const columns = {};
  for (const [field, aliases] of Object.entries(fields)) {
    const matches = headers.map((h,i) => aliases.includes(h) ? i : -1).filter(i => i >= 0);
    if (matches.length !== 1) addIssue(1, 'HEADER', 'Missing or duplicate required column: ' + field);
    else columns[field] = matches[0];
  }
  if (invalid) return { rows: [], issues, allIssues, invalid, total: matrix.length - 1, duplicates, defaultedCells, defaultedRows, negativeRows };
  if (matrix.length - 1 > MAX_ROWS) throw new Error('Report exceeds 500,000 data rows; split it into smaller reports');
  const seen = new Map();
  for (let i = 1; i < matrix.length; i++) {
    const cells = matrix[i];
    const problem = cellProblems.get(i + 1);
    if (!problem && !cells.some(v => v !== null && v !== undefined && String(v).trim() !== '')) continue;
    total++;
    const get = field => cells[columns[field]];
    let sourceDate = get('date');
    try { sourceDate = reportDate(sourceDate,date1904); } catch (_) { /* retain original invalid date */ }
    const context = { asin: get('asin') ?? '', date: sourceDate ?? '', brand: get('brand') ?? '' };
    if (problem) {
      addIssue(i+1, problem.code, problem.message, { ...context, column:problem.column });
      continue;
    }
    try {
      const asin = String(get('asin') ?? '').trim().toUpperCase();
      if (!/^[A-Z0-9]{10}$/.test(asin)) throw new Error('Invalid ASIN');
      const date = reportDate(get('date'), date1904);
      const brand = isBlank(get('brand')) ? '-' : String(get('brand')).trim();
      if (brand.length > 255) throw new Error('Brand is too long');
      const storeCode = isBlank(get('storeCode')) ? 'IN' : normalizeStore(get('storeCode'));
      if (!storeCode) throw new Error('Only explicit Amazon India (IN) store codes are supported');
      const row = { asin, date, brand, storeCode };
      for (const field of moneyFields) {
        try { row[field] = money(get(field)); } catch (err) { throw new Error(field + ': ' + err.message); }
      }
      for (const field of unitFields) {
        try { row[field] = units(get(field)); } catch (err) { throw new Error(field + ': ' + err.message); }
      }
      const blanks = [...moneyFields, ...unitFields].filter(field => isBlank(get(field))).length;
      defaultedCells += blanks;
      if (blanks) defaultedRows++;
      if ([...moneyFields, ...unitFields].some(field => Number(row[field]) < 0)) negativeRows++;
      const key = asin + '|' + date;
      if (seen.has(key)) {
        const first = seen.get(key);
        if (JSON.stringify(first.values) === JSON.stringify(row)) duplicates++;
        else addIssue(i + 1, 'CONFLICTING_DUPLICATE', 'Conflicting values for the same ASIN and date; first row ' + first.line, context);
      } else seen.set(key, { values: row, line: i + 1 });
    } catch (err) { addIssue(i + 1, 'INVALID_ROW', err.message, context); }
  }
  if (!total) addIssue(1, 'EMPTY_REPORT', 'The report has no data rows');
  return { rows: [...seen.values()].map(r => ({ ...r.values, line: r.line })), issues, allIssues, invalid, total, duplicates, defaultedCells, defaultedRows, negativeRows };
}
function parseFile(filePath, name) {
  const isCsv = /\.csv$/i.test(name);
  const book = XLSX.readFile(filePath, { raw: isCsv, dense: true, cellFormula: true, sheets: 0 });
  if (!book.SheetNames.length) throw new Error('No worksheet found');
  if (book.SheetNames.length !== 1) throw new Error('Report must contain exactly one worksheet');
  const sheet = book.Sheets[book.SheetNames[0]];
  if (!sheet['!ref']) return validateRows([]);
  const range = XLSX.utils.decode_range(sheet['!fullref'] || sheet['!ref']);
  if (range.e.r >= MAX_ROWS + 1 || range.e.c >= MAX_COLS) throw new Error('Report exceeds 500,000 data rows or 64 columns; split it into smaller reports');
  // Preserve the first offending cell per source row, including formula
  // and error cells that otherwise become blank when converted to JSON.
  // This keeps the existing reject-on-invalid policy, but identifies the ASIN.
  const problems = new Map();
  const header = Array.isArray(sheet) ? sheet[0] || [] : null;
  const note = (r,c,cell) => {
    if (problems.has(r+1) || !(cell?.f || cell?.F || cell?.t==='e')) return;
    const headerCell = header ? header[c] : sheet[XLSX.utils.encode_cell({r:0,c})];
    const column = XLSX.utils.encode_col(c) + (headerCell?.v ? ' ('+String(headerCell.v).slice(0,70)+')' : '');
    const formula = Boolean(cell.f || cell.F);
    problems.set(r+1, { code:formula?'FORMULA_CELL':'EXCEL_ERROR_CELL', message:formula?'Formula cells are not supported':'Excel error cells are not supported', column });
  };
  if (Array.isArray(sheet)) {
    sheet.forEach((row,r)=>{ if(Array.isArray(row))row.forEach((cell,c)=>note(r,c,cell)); });
  } else {
    for (const key of Object.keys(sheet)) {
      if (key.startsWith('!')) continue;
      const cell=sheet[key];
      if (!(cell?.f || cell?.F || cell?.t==='e')) continue;
      const {r,c}=XLSX.utils.decode_cell(key);
      note(r,c,cell);
    }
  }
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0, raw: true, defval: null, blankrows: true });
  return validateRows(matrix, Boolean(book.Workbook?.WBProps?.date1904), problems);
}
module.exports = { MAX_ROWS, MAX_ISSUES, MAX_FILE_BYTES, normalizeStore, isIndiaSeller, money, units, reportDate, validateRows, parseFile };
if (!isMainThread) {
  try { parentPort.postMessage({ ok: true, result: parseFile(workerData.path, workerData.name) }); }
  catch (err) { parentPort.postMessage({ ok: false, message: err.message }); }
}
