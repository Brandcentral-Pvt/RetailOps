/**
 * Data Quality Audit Report
 * -------------------------
 * Per-ASIN sheet: Brand, ASIN, assigned user, days of history, dates with
 * missing Pricing / BSR / SubBSR, bullet-point & image counts (<5 flagged),
 * remarks column, and color formatting.
 *
 * Run:  node scripts/dataQualityReport.js [--seller <sellerName>] [--limit N]
 * Out:  reports/Data_Quality_Report_<timestamp>.xlsx
 */
const path = require('path');
const fs = require('fs');

// History scans can take longer than the default pool request timeout.
process.env.DB_REQUEST_TIMEOUT_MS = process.env.DB_REQUEST_TIMEOUT_MS || '300000';

const { getPool, sql } = require('../database/db');
const ExcelJS = require('exceljs');

const args = process.argv.slice(2);
function argOf(name) {
    const i = args.indexOf(name);
    return i !== -1 ? args[i + 1] : null;
}
const sellerFilter = argOf('--seller');
const limit = parseInt(argOf('--limit') || '0', 10);

const MAX_DATES_LISTED = 20; // per column, then "+N more"

function jsonCount(val) {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number') return val;
    const s = String(val).trim();
    if (!s || s === '[]' || s === 'null') return 0;
    if (s.startsWith('[')) {
        try { return JSON.parse(s).length; } catch { return null; }
    }
    return null;
}

function bulletCountOf(row) {
    const n = parseInt(row.BulletPoints);
    if (!Number.isNaN(n) && n > 0) return n;
    const txt = row.BulletPointsText;
    if (!txt) return 0;
    const s = String(txt).trim();
    if (s.startsWith('[')) {
        try { return JSON.parse(s).length; } catch { return 0; }
    }
    return s.split(/[\n\r•]+/).map(t => t.trim()).filter(Boolean).length;
}

function imageCountOf(row) {
    const c = jsonCount(row.ImagesCount);
    if (c !== null && c > 0) return c;
    const imgs = jsonCount(row.Images);
    if (imgs !== null) return imgs;
    if (row.ImageUrl && String(row.ImageUrl).trim()) {
        try {
            const parsed = JSON.parse(row.ImageUrl);
            if (Array.isArray(parsed)) return parsed.length;
        } catch { /* plain url */ }
        return 1;
    }
    return 0;
}

async function main() {
    console.log('Connecting to SQL Server…');
    const pool = await getPool();

    // ── 1. ASIN base rows ────────────────────────────────────────────────
    console.log('Loading ASINs…');
    let asinWhere = "WHERE (a.Status IS NULL OR a.Status != 'Inactive')";
    if (sellerFilter) asinWhere += ' AND s.Name = @seller';
    const asinReq = pool.request();
    if (sellerFilter) asinReq.input('seller', sql.NVarChar, sellerFilter);
    const limitWrap = limit > 0 ? { open: `SELECT TOP ${limit} * FROM (`, close: ' ) t' } : { open: '', close: '' };
    const asinResult = await asinReq.query(`
        ${limitWrap.open}
        SELECT
            a.Id,
            a.AsinCode,
            COALESCE(NULLIF(a.Brand, ''), s.Name) AS BrandName,
            s.Name AS SellerName,
            a.BulletPoints,
            a.BulletPointsText,
            a.ImagesCount,
            a.Images,
            a.ImageUrl,
            (SELECT TOP 1 ua.FirstName + ' ' + ua.LastName
               FROM Tasks t LEFT JOIN Users ua ON t.AssignedTo = ua.Id
              WHERE t.AsinId = a.Id AND ua.Id IS NOT NULL
              ORDER BY t.CreatedAt DESC) AS AssignedUserName
        FROM Asins a
        LEFT JOIN Sellers s ON a.SellerId = s.Id
        ${asinWhere}
        ${limitWrap.close}
        ORDER BY BrandName, AsinCode
    `);
    const asins = asinResult.recordset;
    console.log(`ASINs: ${asins.length}`);

    // ── 2. History aggregates (days of data + null counts) ──────────────
    console.log('Aggregating AsinHistory…');
    const histReq = pool.request();
    if (sellerFilter) {
        histReq.input('seller', sql.NVarChar, sellerFilter);
        histReq.input('seller2', sql.NVarChar, sellerFilter);
    }
    const sellerJoin = sellerFilter ? 'JOIN Sellers s2 ON a2.SellerId = s2.Id AND s2.Name = @seller2' : '';
    const agg = await histReq.query(`
        SELECT
            h.AsinId,
            COUNT(DISTINCT CAST(h.Date AS date))                       AS DaysOfData,
            MIN(CAST(h.Date AS date))                                  AS FirstDate,
            MAX(CAST(h.Date AS date))                                  AS LastDate,
            SUM(CASE WHEN NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(64), h.Price))), '') IS NULL THEN 1 ELSE 0 END) AS MissPriceRows,
            SUM(CASE WHEN h.BSR IS NULL THEN 1 ELSE 0 END)             AS MissBsrRows,
            SUM(CASE WHEN h.SubBSR IS NULL THEN 1 ELSE 0 END)          AS MissSubBsrRows
        FROM AsinHistory h
        JOIN Asins a2 ON a2.Id = h.AsinId
        ${sellerJoin}
        GROUP BY h.AsinId
    `);
    const histByAsin = new Map(agg.recordset.map(r => [r.AsinId, r]));

    // ── 3. Problem dates per ASIN (only rows with any gap) ──────────────
    console.log('Collecting gap dates…');
    const gapReq = pool.request();
    if (sellerFilter) {
        gapReq.input('seller', sql.NVarChar, sellerFilter);
        gapReq.input('seller2', sql.NVarChar, sellerFilter);
    }
    const gaps = await gapReq.query(`
        SELECT
            h.AsinId,
            CONVERT(varchar(10), h.Date, 120) AS D,
            CASE WHEN NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(64), h.Price))), '') IS NULL THEN 1 ELSE 0 END AS P,
            CASE WHEN h.BSR IS NULL THEN 1 ELSE 0 END AS B,
            CASE WHEN h.SubBSR IS NULL THEN 1 ELSE 0 END AS S
        FROM AsinHistory h
        JOIN Asins a2 ON a2.Id = h.AsinId
        ${sellerJoin}
        WHERE NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(64), h.Price))), '') IS NULL
           OR h.BSR IS NULL
           OR h.SubBSR IS NULL
        ORDER BY h.AsinId, h.Date
    `);
    const gapsByAsin = new Map();
    for (const g of gaps.recordset) {
        let e = gapsByAsin.get(g.AsinId);
        if (!e) { e = { price: [], bsr: [], subbsr: [] }; gapsByAsin.set(g.AsinId, e); }
        if (g.P) e.price.push(g.D);
        if (g.B) e.bsr.push(g.D);
        if (g.S) e.subbsr.push(g.D);
    }

    // Also capture SubBSR gaps recorded only in SubBsrHistory (per-date absence
    // cannot be inferred there without a calendar spine — skip; AsinHistory is
    // the canonical daily row source written by live sync).

    await pool.close();

    // ── 4. Build workbook ────────────────────────────────────────────────
    console.log('Building workbook…');
    const wb = new ExcelJS.Workbook();
    wb.creator = 'RetailOps Data Quality Bot';
    wb.created = new Date();

    const ws = wb.addWorksheet('Data Quality', {
        views: [{ state: 'frozen', ySplit: 1 }],
    });

    const cols = [
        { header: 'Brand', key: 'brand', width: 22 },
        { header: 'ASIN', key: 'asin', width: 13 },
        { header: 'Assigned User', key: 'user', width: 20 },
        { header: 'Days of Data', key: 'days', width: 12 },
        { header: 'First Data', key: 'first', width: 12 },
        { header: 'Last Data', key: 'last', width: 12 },
        { header: '# Missing Price', key: 'missP', width: 13 },
        { header: '# Missing BSR', key: 'missB', width: 13 },
        { header: '# Missing SubBSR', key: 'missS', width: 14 },
        { header: 'Missing Price Dates', key: 'datesP', width: 42 },
        { header: 'Missing BSR Dates', key: 'datesB', width: 42 },
        { header: 'Missing SubBSR Dates', key: 'datesS', width: 42 },
        { header: 'Bullet Points', key: 'bullets', width: 12 },
        { header: 'Images', key: 'imgs', width: 9 },
        { header: 'Remarks', key: 'remarks', width: 60 },
    ];
    ws.columns = cols;

    const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
    ws.getRow(1).eachCell(c => {
        c.fill = HEADER_FILL;
        c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        c.border = { bottom: { style: 'thin', color: { argb: 'FF999999' } } };
    });
    ws.getRow(1).height = 24;
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };

    // Fill palette
    const RED = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };   // critical
    const ORANGE = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8C3A0' } };// warning
    const YELLOW = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEB9C' } };// minor
    const GREEN = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD8EFD3' } };// ok
    const RED_FONT = { color: { argb: 'FF9C0006' }, bold: true };

    function fmtDates(list) {
        if (!list || list.length === 0) return '';
        if (list.length <= MAX_DATES_LISTED) return list.join(', ');
        return list.slice(0, MAX_DATES_LISTED).join(', ') + ` …(+${list.length - MAX_DATES_LISTED} more)`;
    }

    let noHist = 0;
    asins.forEach((a, idx) => {
        const h = histByAsin.get(a.Id);
        const g = gapsByAsin.get(a.Id) || { price: [], bsr: [], subbsr: [] };
        const bullets = bulletCountOf(a);
        const imgs = imageCountOf(a);

        const days = h ? h.DaysOfData : 0;
        if (!h) noHist++;

        const issues = [];
        if (!h) issues.push('NO HISTORY DATA');
        else {
            if (g.price.length > 0) issues.push(`Price missing on ${g.price.length} day(s)`);
            if (g.bsr.length > 0) issues.push(`BSR missing on ${g.bsr.length} day(s)`);
            if (g.subbsr.length > 0) issues.push(`SubBSR missing on ${g.subbsr.length} day(s)`);
        }
        if (bullets < 5) issues.push(`<5 bullet points (${bullets})`);
        if (imgs < 5) issues.push(`<5 images (${imgs})`);

        const row = ws.addRow({
            brand: a.BrandName || '',
            asin: a.AsinCode,
            user: a.AssignedUserName || '— Unassigned —',
            days,
            first: h && h.FirstDate ? h.FirstDate.toISOString().slice(0, 10) : '',
            last: h && h.LastDate ? h.LastDate.toISOString().slice(0, 10) : '',
            missP: g.price.length,
            missB: g.bsr.length,
            missS: g.subbsr.length,
            datesP: fmtDates(g.price),
            datesB: fmtDates(g.bsr),
            datesS: fmtDates(g.subbsr),
            bullets,
            imgs,
            remarks: issues.length ? issues.join('; ') : 'OK',
        });
        row.alignment = { vertical: 'top', wrapText: true };

        // Row tint by severity
        const hardIssues = issues.filter(i => i !== 'OK').length;
        if (hardIssues >= 3 || !h) {
            row.eachCell(c => { if (!c.fill || c.fill.fgColor?.argb === undefined) c.fill = RED; });
            row.getCell('remarks').fill = RED;
            row.getCell('remarks').font = RED_FONT;
        } else if (hardIssues >= 1) {
            row.eachCell(c => { c.fill = YELLOW; });
            row.getCell('remarks').fill = YELLOW;
        } else {
            row.getCell('remarks').fill = GREEN;
            row.getCell('remarks').font = { color: { argb: 'FF1E6F18' }, bold: true };
        }

        // Targeted cell colors (override row tint for signal columns)
        const daysCell = row.getCell('days');
        if (!h) { daysCell.fill = RED; daysCell.font = RED_FONT; }
        else if (days < 7) { daysCell.fill = RED; daysCell.font = RED_FONT; }
        else if (days < 30) { daysCell.fill = ORANGE; }
        else daysCell.fill = GREEN;

        for (const k of ['missP', 'missB', 'missS']) {
            const c = row.getCell(k);
            if (c.value > 0) { c.fill = RED; c.font = RED_FONT; }
            else c.fill = GREEN;
        }
        for (const k of ['bullets', 'imgs']) {
            const c = row.getCell(k);
            if (c.value < 5) { c.fill = RED; c.font = RED_FONT; }
            else c.fill = GREEN;
        }

        if ((idx + 1) % 500 === 0) console.log(`  rows: ${idx + 1}`);
    });

    // ── Summary sheet ────────────────────────────────────────────────────
    const sum = wb.addWorksheet('Summary', { views: [{ state: 'frozen', ySplit: 1 }] });
    sum.columns = [
        { header: 'Metric', key: 'm', width: 44 },
        { header: 'Value', key: 'v', width: 16 },
    ];
    sum.getRow(1).eachCell(c => { c.fill = HEADER_FILL; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; });
    const totMissP = gaps.recordset.filter(r => r.P).length;
    const totMissB = gaps.recordset.filter(r => r.B).length;
    const totMissS = gaps.recordset.filter(r => r.S).length;
    const lowBullets = asins.filter(a => bulletCountOf(a) < 5).length;
    const lowImgs = asins.filter(a => imageCountOf(a) < 5).length;
    const unassigned = asins.filter(a => !a.AssignedUserName).length;
    [
        { m: 'Generated at', v: new Date().toLocaleString() },
        { m: 'Seller scope', v: sellerFilter || 'ALL sellers' },
        { m: 'Total ASINs', v: asins.length },
        { m: 'ASINs with NO history', v: noHist },
        { m: 'History rows w/ missing Price', v: totMissP },
        { m: 'History rows w/ missing BSR', v: totMissB },
        { m: 'History rows w/ missing SubBSR', v: totMissS },
        { m: 'ASINs with <5 bullet points', v: `${lowBullets} (${Math.round(lowBullets / Math.max(asins.length, 1) * 100)}%)` },
        { m: 'ASINs with <5 images', v: `${lowImgs} (${Math.round(lowImgs / Math.max(asins.length, 1) * 100)}%)` },
        { m: 'ASINs with no assigned user', v: unassigned },
    ].forEach(r => sum.addRow(r));
    sum.addRow({});
    sum.addRow({ m: 'LEGEND', v: '' }).font = { bold: true };
    [['RED', 'Critical: no history, <7 days data, missing metric dates, or <5 bullets/images'],
     ['ORANGE', 'Warning: <30 days of data'],
     ['YELLOW', 'Minor: 1–2 issues'],
     ['GREEN', 'OK / complete']].forEach(([k, v]) => {
        const r = sum.addRow({ m: k, v });
        r.getCell('m').fill = k === 'RED' ? RED : k === 'ORANGE' ? ORANGE : k === 'YELLOW' ? YELLOW : GREEN;
    });

    // ── Save ─────────────────────────────────────────────────────────────
    const outDir = path.join(__dirname, '..', 'reports');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
    const outFile = path.join(outDir, `Data_Quality_Report_${stamp}.xlsx`);
    await wb.xlsx.writeFile(outFile);
    console.log(`✅ Report written: ${outFile}`);
    console.log(`   ASINs: ${asins.length} | no-history: ${noHist} | <5 bullets: ${lowBullets} | <5 images: ${lowImgs}`);
}

main().catch(err => {
    console.error('❌ Report failed:', err.message);
    process.exit(1);
});
