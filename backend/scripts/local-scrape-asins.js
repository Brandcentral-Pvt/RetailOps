/**
 * LOCAL-ONLY ASIN scraper (never committed).
 *
 * Reads a plain asin.txt (one ASIN per line) and scrapes the core fields —
 * title, price, MRP, sold-by, deal badge, availability. No DB writes.
 *
 * Usage:
 *   node backend/scripts/local-scrape-asins.js --file asin.txt --out Deal.csv
 *   node backend/scripts/local-scrape-asins.js --file asin.txt --out Deal.xlsx
 *
 * Options:
 *   --file <path>    ASIN file (default: <repo-root>/asins.txt)
 *   --out <path>     output file — .xlsx writes a formatted Excel workbook
 *                    (styled header, numeric cells, ₹ formats, frozen top row,
 *                    auto-filter); .csv (or no extension) writes a UTF-8 CSV.
 *                    A matching .json with the full records is written alongside
 *   --delay <ms>     pause between ASINs (default 2500)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// The service references an undefined `logger` in its memory/browser-restart
// paths. Local shim so those never blow up mid-run.
global.logger = { info: console.log, warn: console.warn, error: console.error };

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const service = require('../services/playwrightScraperService.js');

const REPO_ROOT = path.join(__dirname, '..', '..');
const DEFAULT_FILE = path.join(REPO_ROOT, 'asins.txt');
const DEFAULT_OUT = path.join(__dirname, 'output', 'scrape-results.csv');

const args = process.argv.slice(2);
const flagValue = (name) => {
    const idx = args.indexOf(name);
    if (idx === -1) return undefined;
    return args[idx + 1];
};

const asinsFile = flagValue('--file') || DEFAULT_FILE;
const outFile = flagValue('--out') || DEFAULT_OUT;
const outIsExcel = /\.xlsx$/i.test(outFile);
const delayMs = parseInt(flagValue('--delay') || process.env.SCRAPER_LOCAL_DELAY_MS || '2500', 10) || 2500;
const OUT_DIR = path.dirname(outFile);

const ASIN_RE = /^[A-Z0-9]{10}$/i;

function parseAsins(file) {
    if (!fs.existsSync(file)) throw new Error(`ASIN file not found: ${file}`);
    const asins = fs.readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#'))
        .map(l => l.toUpperCase());
    const valid = [], invalid = [];
    for (const a of asins) (ASIN_RE.test(a) ? valid : invalid).push(a);
    return { valid: [...new Set(valid)], invalid };
}

function flattenForCsv(row) {
    const sanitize = v => v == null ? '' : String(v).replace(/[\r\n]+/g, ' | ').replace(/,/g, ';');
    const r = { ...row };
    r.hasAplus = r.hasAplus ? 'YES' : '';
    r.bulletPointsText = sanitize(r.bulletPointsText);
    return r;
}

const OUT_FIELDS = [
    'asin', 'title', 'currentPrice', 'mrp', 'soldBy', 'dealBadge', 'availability', 'status', 'error',
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

const PRICE_COLS = new Set(['currentPrice', 'mrp', 'dealPrice', 'savingsAmount']);
const NUMERIC_COLS = new Set(['currentPrice', 'mrp', 'discountPercentage', 'rating', 'reviewCount', 'imagesCount', 'dealPrice', 'savingsAmount', 'bsr', 'subBsr']);

function excelValue(row, header) {
    const v = row[header];
    if (v == null || v === '') return null;
    if (NUMERIC_COLS.has(header)) {
        const n = Number(String(v).replace(/,/g, ''));
        return isNaN(n) ? null : n;
    }
    return String(v);
}

// Number format map (exceljs format codes)
function excelFormat(header) {
    if (PRICE_COLS.has(header)) return '\u20B9#,##0';
    if (header === 'discountPercentage') return '0.0"%"';
    if (header === 'rating') return '0.0';
    if (NUMERIC_COLS.has(header)) return '#,##0';
    return null;
}

async function writeXlsx(filename, results) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Data');

    const headerRow = ws.addRow(OUT_FIELDS);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6D28D9' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 22;

    for (const r of results) {
        const row = ws.addRow(OUT_FIELDS.map(h => excelValue(r, h)));
        row.height = 14;
        for (let i = 0; i < OUT_FIELDS.length; i++) {
            const fmt = excelFormat(OUT_FIELDS[i]);
            if (fmt) row.getCell(i + 1).numFmt = fmt;
            if (row.getCell(i + 1).value == null) row.getCell(i + 1).value = '';
            if (OUT_FIELDS[i] === 'error') row.getCell(i + 1).font = { color: { argb: 'FFDC2626' } };
        }
    }

    const widths = OUT_FIELDS.map((h) => {
        let max = h.length;
        for (const r of results) {
            const v = r[h];
            if (v == null) continue;
            const len = String(v).length;
            if (len > max) max = len;
        }
        return Math.min(Math.max(max + 2, 10), 60);
    });
    ws.columns.forEach((c, i) => { c.width = widths[i]; });

    ws.views = [{ state: 'frozen', ySplit: 1 }];
    ws.autoFilter = { from: 'A1', to: { row: results.length + 1, column: OUT_FIELDS.length } };

    await wb.xlsx.writeFile(filename);
}

async function writeCsv(filename, results) {
    const esc = v => { const s = flattenForCsv(v); return OUT_FIELDS.map(h => `"${(s[h] ?? '').toString().replace(/"/g, '""')}"`).join(','); };
    // UTF-8 BOM so Excel opens ₹ / Hindi correctly
    const body = '\uFEFF' + [OUT_FIELDS.join(','), ...results.map(esc)].join('\n');
    fs.writeFileSync(filename, body, 'utf8');
}

async function main() {
    fs.mkdirSync(OUT_DIR, { recursive: true });

    const { valid, invalid } = parseAsins(asinsFile);
    console.log(`[LocalScrape] File: ${asinsFile}`);
    console.log(`[LocalScrape] ${valid.length} valid ASIN(s), ${invalid.length} invalid, delay ${delayMs}ms between items`);
    if (invalid.length) console.log(`[LocalScrape] Skipping invalid: ${invalid.join(', ')}`);

    const started = Date.now();
    const results = [];

    for (let i = 0; i < valid.length; i++) {
        const asin = valid[i];
        const idx = `${i + 1}/${valid.length}`;
        try {
            console.log(`[LocalScrape] [${idx}] ${asin} scraping (full)...`);
            const data = await service.scrapeAsin(asin, { full: true });
            results.push(flattenForCsv({ ...data, asin, status: 'OK', error: '' }));
            console.log(`[LocalScrape] [${idx}] ${asin} OK — ₹${data.currentPrice} | ${data.rating ?? '-'}★ (${data.reviewCount ?? 0}) | ${data.title ? data.title.slice(0, 60) : '(no title)'}`);
            service.trackAsinSuccess(asin);
        } catch (err) {
            results.push(flattenForCsv({ asin, status: 'FAIL', title: '', error: err.message }));
            console.log(`[LocalScrape] [${idx}] ${asin} FAIL — ${err.message}`);
            service.trackAsinFailure(asin);
        }
        if (i < valid.length - 1) await sleep(delayMs);
    }

    const jsonPath = outFile.replace(/\.(csv|xlsx)$/i, '.json');
    fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
    fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), 'utf8');

    if (outIsExcel) {
        await writeXlsx(outFile, results);
    } else {
        await writeCsv(outFile, results);
    }

    const ok = results.filter(r => r.status === 'OK').length;
    const fail = results.length - ok;
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`\n[LocalScrape] Done in ${secs}s — ${ok} OK, ${fail} failed`);
    console.log(`[LocalScrape] JSON : ${jsonPath}`);
    console.log(`[LocalScrape] ${outIsExcel ? 'Excel' : 'CSV  '}: ${outFile}`);

    await service.close();
    process.exit(fail > 0 ? 1 : 0);
}

process.on('SIGINT', async () => { console.log('\n[LocalScrape] Interrupted — closing browser'); await service.close().catch(() => {}); process.exit(130); });

main().catch(async (err) => { console.error('[LocalScrape] Fatal:', err.message); await service.close().catch(() => {}); process.exit(1); });