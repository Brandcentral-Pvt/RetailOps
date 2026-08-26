/**
 * Data Quality Audit Report v2
 * ----------------------------
 * Columns: Brand | ASIN | Assigned Users (brand-level via UserSellers) |
 * Title | Title Length | Bullets | Images | Latest Price/BSR/SubBSR |
 * Days of Data | FULL Price/BSR/SubBSR history | Remarks.
 *
 * Colour code (per parameter, distinct):
 *   RED    - hard fail: <5 bullets, <5 images, title len out of range,
 *            <7 days data, no metric data at all
 *   ORANGE - price parameter issues / <30 days data / short title warning
 *   BLUE   - BSR parameter issues
 *   PURPLE - SubBSR parameter issues
 *   GREY   - unassigned brand
 *   Light-red row tint = ASIN fails at least one criterion.
 *
 * Run: node scripts/dataQualityReport.js [--seller <name>] [--limit N]
 */
const path = require('path');
const fs = require('fs');

process.env.DB_REQUEST_TIMEOUT_MS = process.env.DB_REQUEST_TIMEOUT_MS || '300000';

const { getPool, sql } = require('../database/db');
const ExcelJS = require('exceljs');

const args = process.argv.slice(2);
function argOf(name) { const i = args.indexOf(name); return i !== -1 ? args[i + 1] : null; }
const sellerFilter = argOf('--seller');
const limit = parseInt(argOf('--limit') || '0', 10);

// Criteria thresholds
const TITLE_MIN = 50, TITLE_MAX = 200, TITLE_WARN = 80;
const MIN_BULLETS = 5, MIN_IMAGES = 5;

// Palette
const F_RED     = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };
const F_ORANGE  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8CBAD' } };
const F_BLUE    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBDD7EE' } };
const F_PURPLE  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE4DFEC' } };
const F_GREEN   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD8EFD3' } };
const F_GREY    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
const F_ROWTINT = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDECEA' } }; // faint red row wash
const F_HEAD    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
const FONT_RED  = { color: { argb: 'FF9C0006' }, bold: true };

function jsonCount(val) {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return val;
    const s = String(val).trim();
    if (!s || s === '[]' || s === 'null') return 0;
    if (s.startsWith('[')) { try { return JSON.parse(s).length; } catch { return 0; } }
    return 0;
}
function bulletCountOf(row) {
    const n = parseInt(row.BulletPoints);
    if (!Number.isNaN(n) && n > 0) return n;
    const txt = row.BulletPointsText;
    if (!txt) return 0;
    const s = String(txt).trim();
    if (s.startsWith('[')) { try { return JSON.parse(s).length; } catch { return 0; } }
    return s.split(/[\n\r•]+/).map(t => t.trim()).filter(Boolean).length;
}
function imageCountOf(row) {
    const c = jsonCount(row.ImagesCount);
    if (c > 0) return c;
    const imgs = jsonCount(row.Images);
    if (imgs > 0) return imgs;
    if (row.ImageUrl && String(row.ImageUrl).trim()) {
        try { const p = JSON.parse(row.ImageUrl); if (Array.isArray(p)) return p.length; } catch { }
        return 1;
    }
    return 0;
}
function valOf(v) {
    if (v === null || v === undefined) return '';
    const s = String(v).trim();
    return s === '' ? '' : s;
}

async function main() {
    console.log('Connecting to SQL Server...');
    const pool = await getPool();

    // ── 1. ASIN base rows ────────────────────────────────────────────────
    console.log('Loading ASINs...');
    let asinWhere = "WHERE (a.Status IS NULL OR a.Status != 'Inactive')";
    if (sellerFilter) asinWhere += ' AND s.Name = @seller';
    const asinReq = pool.request();
    if (sellerFilter) asinReq.input('seller', sql.NVarChar, sellerFilter);
    // Narrow ordering pass first (sorting wide rows incl. NVARCHAR(MAX) Title
    // server-side spills and stalls); details are then fetched per id-chunk.
    let asins;
    if (limit > 0) {
        asins = (await asinReq.query(`
            SELECT TOP ${limit}
                a.Id, a.AsinCode, a.Title,
                COALESCE(NULLIF(a.Brand, ''), s.Name) AS BrandName,
                a.BulletPoints, a.BulletPointsText, a.ImagesCount, a.Images, a.ImageUrl
            FROM Asins a WITH (NOLOCK)
            LEFT JOIN Sellers s WITH (NOLOCK) ON a.SellerId = s.Id
            ${asinWhere}
        `)).recordset;
    } else {
        const ids = (await asinReq.query(`
            SELECT a.Id
            FROM Asins a WITH (NOLOCK)
            LEFT JOIN Sellers s WITH (NOLOCK) ON a.SellerId = s.Id
            ${asinWhere}
            ORDER BY COALESCE(NULLIF(a.Brand, ''), s.Name), a.AsinCode
        `)).recordset.map(r => r.Id);
        console.log(`IDs: ${ids.length}; fetching details in chunks...`);
        asins = [];
        {
            const DETAIL_CHUNK = 1000;
            for (let i = 0; i < ids.length; i += DETAIL_CHUNK) {
                const dq = pool.request();
                const ph = ids.slice(i, i + DETAIL_CHUNK).map((id, j) => { dq.input(`d${j}`, sql.VarChar, id); return `@d${j}`; }).join(',');
                const res = await dq.query(`
                    SELECT a.Id, a.AsinCode, a.Title,
                           COALESCE(NULLIF(a.Brand, ''), s.Name) AS BrandName,
                           a.BulletPoints, a.BulletPointsText, a.ImagesCount, a.Images, a.ImageUrl
                    FROM Asins a WITH (NOLOCK)
                    LEFT JOIN Sellers s WITH (NOLOCK) ON a.SellerId = s.Id
                    WHERE a.Id IN (${ph})
                `);
                asins.push(...res.recordset);
                if ((i / DETAIL_CHUNK) % 20 === 0) console.log(`  details ${Math.min(i + DETAIL_CHUNK, ids.length)}/${ids.length}`);
            }
        }
    }
    console.log(`ASINs: ${asins.length}`);

    // ── 2. Brand-level assigned users (UserSellers is the source of truth)
    console.log('Resolving brand assignees...');
    const sellersResult = await pool.request().query(`
        SELECT us.SellerId, ua.FirstName + ISNULL(' ' + ua.LastName, '') AS UserName
        FROM UserSellers us WITH (NOLOCK)
        JOIN Users ua WITH (NOLOCK) ON ua.Id = us.UserId
        WHERE ua.IsActive = 1
        ORDER BY ua.FirstName
    `);
    const usersBySeller = new Map();
    for (const r of sellersResult.recordset) {
        if (!usersBySeller.has(r.SellerId)) usersBySeller.set(r.SellerId, []);
        usersBySeller.get(r.SellerId).push(r.UserName);
    }
    // Id -> SellerId map (chunked)
    const sidMap = new Map();
    {
        const SID_CHUNK = 1000;
        for (let i = 0; i < asins.length; i += SID_CHUNK) {
            const chunk = asins.slice(i, i + SID_CHUNK);
            const rq = pool.request();
            const ph = chunk.map((_, j) => { rq.input(`i${j}`, sql.VarChar, chunk[j].Id); return `@i${j}`; }).join(',');
            const res = await rq.query(`SELECT Id, SellerId FROM Asins WITH (NOLOCK) WHERE Id IN (${ph})`);
            for (const r of res.recordset) sidMap.set(r.Id, r.SellerId);
        }
    }

    // ── 3. Workbook setup ────────────────────────────────────────────────
    const wb = new ExcelJS.Workbook();
    wb.creator = 'RetailOps Data Quality Bot';
    wb.created = new Date();
    const ws = wb.addWorksheet('Data Quality', { views: [{ state: 'frozen', xSplit: 3, ySplit: 1 }] });
    ws.columns = [
        { header: 'Brand', key: 'brand', width: 20 },
        { header: 'ASIN', key: 'asin', width: 12 },
        { header: 'Assigned User(s)', key: 'users', width: 22 },
        { header: 'Title', key: 'title', width: 46 },
        { header: 'Title Len', key: 'tlen', width: 9 },
        { header: 'Bullets', key: 'bullets', width: 8 },
        { header: 'Images', key: 'imgs', width: 8 },
        { header: 'Latest Price', key: 'price', width: 11 },
        { header: 'Latest BSR', key: 'bsr', width: 11 },
        { header: 'Latest SubBSR', key: 'subbsr', width: 12 },
        { header: 'Days of Data', key: 'days', width: 11 },
        { header: 'Price History', key: 'hprice', width: 34 },
        { header: 'BSR History', key: 'hbsr', width: 30 },
        { header: 'SubBSR History', key: 'hsubbsr', width: 30 },
        { header: 'Remarks', key: 'remarks', width: 48 },
    ];
    ws.getRow(1).eachCell(c => {
        c.fill = F_HEAD;
        c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });
    ws.getRow(1).height = 26;
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columns.length } };

    const stats = { rows: 0, failAny: 0, noHist: 0, lowBullets: 0, lowImgs: 0, badTitle: 0, missP: 0, missB: 0, missS: 0, unassigned: 0 };

    // ── 4. Process in chunks: fetch full history per chunk, emit rows ────
    const CHUNK = 800;
    const totalChunks = Math.ceil(asins.length / CHUNK);
    for (let ci = 0; ci < totalChunks; ci++) {
        const chunk = asins.slice(ci * CHUNK, (ci + 1) * CHUNK);

        // full history rows for this chunk
        const hr = pool.request();
        const ph = chunk.map((_, j) => { hr.input(`c${j}`, sql.VarChar, chunk[j].Id); return `@c${j}`; }).join(',');
        const histRows = (await hr.query(`
            SELECT h.AsinId, CONVERT(varchar(10), h.Date, 120) AS D,
                   h.Price, h.BSR, h.SubBSR
            FROM AsinHistory h WITH (NOLOCK)
            WHERE h.AsinId IN (${ph})
            ORDER BY h.AsinId, h.Date
        `)).recordset;

        const histByAsin = new Map();
        for (const r of histRows) {
            let e = histByAsin.get(r.AsinId);
            if (!e) { e = []; histByAsin.set(r.AsinId, e); }
            e.push(r);
        }

        for (const a of chunk) {
            const hist = histByAsin.get(a.Id) || [];
            const sellerId = sidMap.get(a.Id);
            const users = usersBySeller.get(sellerId) || [];

            // Build metric series
            const ser = { price: [], bsr: [], subbsr: [] };
            let missP = 0, missB = 0, missS = 0;
            const seenDates = new Set();
            let lastP = '', lastB = '', lastS = '';
            for (const r of hist) {
                seenDates.add(r.D);
                const p = valOf(r.Price), b = valOf(r.BSR), s = valOf(r.SubBSR);
                if (p === '') { missP++; ser.price.push(`${r.D}: --`); } else { lastP = p; ser.price.push(`${r.D}: ${p}`); }
                if (b === '') { missB++; ser.bsr.push(`${r.D}: --`); } else { lastB = b; ser.bsr.push(`${r.D}: ${b}`); }
                if (s === '') { missS++; ser.subbsr.push(`${r.D}: --`); } else { lastS = s; ser.subbsr.push(`${r.D}: ${s}`); }
            }
            const days = seenDates.size;
            const tlen = a.Title ? String(a.Title).length : 0;
            const bullets = bulletCountOf(a);
            const imgs = imageCountOf(a);

            // Criteria evaluation
            const issues = [];
            if (!sellerId || users.length === 0) issues.push('Brand not assigned to any user');
            if (hist.length === 0) issues.push('No history data');
            else {
                if (missP > 0) issues.push(`Price missing ${missP}d`);
                if (missB > 0) issues.push(`BSR missing ${missB}d`);
                if (missS > 0) issues.push(`SubBSR missing ${missS}d`);
            }
            if (bullets < MIN_BULLETS) issues.push(`Only ${bullets} bullet points`);
            if (imgs < MIN_IMAGES) issues.push(`Only ${imgs} images`);
            if (tlen < TITLE_MIN) issues.push(`Title too short (${tlen})`);
            else if (tlen > TITLE_MAX) issues.push(`Title too long (${tlen})`);

            const failsAny = issues.length > 0;
            stats.rows++;
            if (failsAny) stats.failAny++;
            if (hist.length === 0) stats.noHist++;
            if (bullets < MIN_BULLETS) stats.lowBullets++;
            if (imgs < MIN_IMAGES) stats.lowImgs++;
            if (tlen < TITLE_MIN || tlen > TITLE_MAX) stats.badTitle++;
            if (missP > 0) stats.missP++;
            if (missB > 0) stats.missB++;
            if (missS > 0) stats.missS++;
            if (!sellerId || users.length === 0) stats.unassigned++;

            const row = ws.addRow({
                brand: a.BrandName || '',
                asin: a.AsinCode,
                users: users.length ? users.join(', ') : '(none)',
                title: a.Title || '',
                tlen,
                bullets, imgs,
                price: lastP, bsr: lastB, subbsr: lastS,
                days,
                hprice: ser.price.join('\n'),
                hbsr: ser.bsr.join('\n'),
                hsubbsr: ser.subbsr.join('\n'),
                remarks: failsAny ? issues.join('; ') : 'OK',
            });

            // Base formatting
            row.alignment = { vertical: 'top', wrapText: true };
            if (failsAny) row.eachCell(c => { c.fill = F_ROWTINT; }); // faint red wash = failed criteria

            // Per-parameter colours (override wash)
            const uCell = row.getCell('users');
            if (!sellerId || users.length === 0) { uCell.fill = F_GREY; uCell.font = FONT_RED; }

            const tlCell = row.getCell('tlen');
            if (tlen < TITLE_MIN || tlen > TITLE_MAX) { tlCell.fill = F_RED; tlCell.font = FONT_RED; }
            else if (tlen < TITLE_WARN) tlCell.fill = F_ORANGE;
            else tlCell.fill = F_GREEN;
            row.getCell('title').fill = (tlen < TITLE_MIN || tlen > TITLE_MAX) ? F_RED : row.getCell('title').fill;

            const bCell = row.getCell('bullets');
            if (bullets < MIN_BULLETS) { bCell.fill = F_RED; bCell.font = FONT_RED; } else bCell.fill = F_GREEN;
            const iCell = row.getCell('imgs');
            if (imgs < MIN_IMAGES) { iCell.fill = F_RED; iCell.font = FONT_RED; } else iCell.fill = F_GREEN;

            // Metric-parameter colour families
            const pCell = row.getCell('price'), hpCell = row.getCell('hprice');
            if (hist.length === 0) { pCell.fill = F_RED; pCell.font = FONT_RED; hpCell.fill = F_RED; }
            else if (missP > 0) { pCell.fill = F_ORANGE; hpCell.fill = F_ORANGE; }
            else { pCell.fill = F_GREEN; hpCell.fill = F_GREEN; }

            const bsrCell = row.getCell('bsr'), hbCell = row.getCell('hbsr');
            if (hist.length === 0) { bsrCell.fill = F_RED; bsrCell.font = FONT_RED; hbCell.fill = F_RED; }
            else if (lastB === '') { bsrCell.fill = F_RED; hbCell.fill = F_RED; }
            else if (missB > 0) { bsrCell.fill = F_BLUE; hbCell.fill = F_BLUE; }
            else { bsrCell.fill = F_GREEN; hbCell.fill = F_GREEN; }

            const sbCell = row.getCell('subbsr'), hsCell = row.getCell('hsubbsr');
            if (hist.length === 0) { sbCell.fill = F_RED; sbCell.font = FONT_RED; hsCell.fill = F_RED; }
            else if (lastS === '') { sbCell.fill = F_RED; hsCell.fill = F_RED; }
            else if (missS > 0) { sbCell.fill = F_PURPLE; hsCell.fill = F_PURPLE; }
            else { sbCell.fill = F_GREEN; hsCell.fill = F_GREEN; }

            const dCell = row.getCell('days');
            if (days === 0) { dCell.fill = F_RED; dCell.font = FONT_RED; }
            else if (days < 7) { dCell.fill = F_RED; dCell.font = FONT_RED; }
            else if (days < 30) dCell.fill = F_ORANGE;
            else dCell.fill = F_GREEN;

            const rCell = row.getCell('remarks');
            if (!failsAny) { rCell.fill = F_GREEN; rCell.font = { bold: true, color: { argb: 'FF1E6F18' } }; }
            else rCell.font = { color: { argb: 'FF9C0006' } };
        }
        if ((ci + 1) % 20 === 0 || ci === totalChunks - 1) console.log(`  processed ${(ci + 1) * chunk.length >= asins.length ? asins.length : (ci + 1) * CHUNK}/${asins.length}`);
    }

    await pool.close();

    // ── 5. Summary sheet ────────────────────────────────────────────────
    const sum = wb.addWorksheet('Summary', { views: [{ state: 'frozen', ySplit: 1 }] });
    sum.columns = [{ header: 'Metric', key: 'm', width: 40 }, { header: 'Value', key: 'v', width: 18 }];
    sum.getRow(1).eachCell(c => { c.fill = F_HEAD; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; });
    [
        { m: 'Generated at', v: new Date().toLocaleString() },
        { m: 'Seller scope', v: sellerFilter || 'ALL sellers' },
        { m: 'Total ASINs', v: stats.rows },
        { m: 'ASINs failing at least one criterion', v: stats.failAny },
        { m: '-- Content criteria --', v: '' },
        { m: `Titles <${TITLE_MIN} or >${TITLE_MAX} chars`, v: stats.badTitle },
        { m: `ASINs with <${MIN_BULLETS} bullet points`, v: stats.lowBullets },
        { m: `ASINs with <${MIN_IMAGES} images`, v: stats.lowImgs },
        { m: '-- Data coverage --', v: '' },
        { m: 'ASINs with no history', v: stats.noHist },
        { m: 'ASINs with missing-price days', v: stats.missP },
        { m: 'ASINs with missing-BSR days', v: stats.missB },
        { m: 'ASINs with missing-SubBSR days', v: stats.missS },
        { m: 'Brands with no assigned user', v: stats.unassigned },
        { m: '', v: '' },
        { m: 'COLOUR LEGEND', v: '' },
    ].forEach(r => sum.addRow(r));
    [[F_RED, 'RED - hard fail (<5 bullets/<5 images/title length/no data/<7 days)'],
     [F_ORANGE, 'ORANGE - PRICE parameter has missing days / short-title warning / <30 days'],
     [F_BLUE, 'BLUE - BSR parameter has missing days'],
     [F_PURPLE, 'PURPLE - SubBSR parameter has missing days'],
     [F_GREY, 'GREY - brand not assigned to any user'],
     [F_GREEN, 'GREEN - parameter OK'],
     [F_ROWTINT, 'FAINT RED ROW - ASIN fails at least one criterion']].forEach(([f, label]) => {
        const r = sum.addRow({ m: label });
        r.getCell('m').fill = f;
    });

    const outDir = path.join(__dirname, '..', 'reports');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
    const outFile = path.join(outDir, `Data_Quality_Report_v2_${stamp}.xlsx`);
    console.log('Writing workbook (may take a while)...');
    await wb.xlsx.writeFile(outFile);
    console.log(`Done: ${outFile}`);
    console.log(JSON.stringify(stats));
}

main().catch(err => { console.error('Report failed:', err.message); process.exit(1); });
