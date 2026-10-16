#!/usr/bin/env node
/**
 * amazon-scraper.js — STANDALONE Amazon.in product-page scraper.
 *
 * Self-contained (no database, no external service): one file that launches
 * Chromium via Playwright, scrapes ASINs one at a time, and ALWAYS writes
 * results out — on normal completion, on Ctrl+C (SIGINT), and on any crash —
 * so a partial run never loses data.
 *
 * Requirements on the target machine:
 *   npm install                (installs playwright, exceljs, dotenv)
 *   npm run install:browser    (downloads Chromium; add --with-deps on Linux)
 *
 * Usage:
 *   node amazon-scraper.js --file asins.txt --out results.csv
 *   node amazon-scraper.js --file asins.txt --out results.xlsx --delay 4000
 *
 * Options:
 *   --file <path>    ASIN file, one per line, `#` comments allowed
 *                    (default: ./asins.txt)
 *   --out <path>     .xlsx -> formatted Excel workbook; otherwise UTF-8 CSV
 *                    (default: ./results/scrape-results.csv). A matching .json
 *                    with the full records is always written alongside.
 *   --delay <ms>     pause between ASINs — higher is safer (default 2500)
 *   --limit <n>      scrape only the first n ASINs (default: all)
 *   --headed         run with a visible browser window (default: headless)
 *   --max-retries <n> retry attempts per ASIN (default 3)
 *
 * Environment (.env or exports) also honored:
 *   SCRAPER_HEADLESS=false | PROXY_URL=... | SCRAPER_MAX_RETRIES=...
 *   SCRAPER_REQUEST_TIMEOUT | SCRAPER_NAVIGATION_TIMEOUT | SCRAPER_DELAY_MS
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { chromium } = require('playwright');

/* ------------------------------------------------------------------ */
/* CLI / env                                                            */
/* ------------------------------------------------------------------ */

const args = process.argv.slice(2);
const flagValue = (name) => {
    const idx = args.indexOf(name);
    if (idx === -1) return undefined;
    return args[idx + 1];
};
const hasFlag = (name) => args.includes(name);

const ASINS_FILE = flagValue('--file') || path.join(__dirname, 'asins.txt');
const OUT_FILE = flagValue('--out') || path.join(__dirname, 'results', 'scrape-results.csv');
const OUT_DIR = path.dirname(OUT_FILE);
const OUT_IS_EXCEL = /\.xlsx$/i.test(OUT_FILE);
const DELAY_MS = parseInt(flagValue('--delay') || process.env.SCRAPER_DELAY_MS || '2500', 10) || 2500;
const LIMIT = parseInt(flagValue('--limit') || '0', 10) || 0;
const HEADLESS = flagValue('--headed') ? false : process.env.SCRAPER_HEADLESS !== 'false';
const MAX_RETRIES = parseInt(flagValue('--max-retries') || process.env.SCRAPER_MAX_RETRIES || '3', 10) || 3;
const REQUEST_TIMEOUT = parseInt(process.env.SCRAPER_REQUEST_TIMEOUT || '30000', 10);
const NAVIGATION_TIMEOUT = parseInt(process.env.SCRAPER_NAVIGATION_TIMEOUT || '45000', 10);
const PROXY_URL = process.env.PROXY_URL || null;

const ASIN_RE = /^[A-Z0-9]{10}$/i;

/* ------------------------------------------------------------------ */
/* Shared state                                                         */
/* ------------------------------------------------------------------ */

let browser = null;
let context = null;
const results = [];
let flushing = false;

/* ------------------------------------------------------------------ */
/* Helpers / writers                                                    */
/* ------------------------------------------------------------------ */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseAsins(file) {
    if (!fs.existsSync(file)) throw new Error(`ASIN file not found: ${file}`);
    const asins = fs.readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'))
        .map((l) => l.toUpperCase());
    const valid = [], invalid = [];
    for (const a of asins) (ASIN_RE.test(a) ? valid : invalid).push(a);
    return { valid: [...new Set(valid)], invalid };
}

function sanitize(v) {
    return v == null ? '' : String(v).replace(/[\r\n]+/g, ' | ').replace(/,/g, ';');
}

const OUT_FIELDS = [
    'asin', 'title', 'currentPrice', 'mrp', 'discountPercentage', 'soldBy',
    'dealBadge', 'availability', 'status', 'error',
];

const NUMERIC_COLS = new Set(['currentPrice', 'mrp', 'discountPercentage', 'rating', 'reviewCount', 'dealPrice', 'savingsAmount', 'bsr', 'subBsr']);
const PRICE_COLS = new Set(['currentPrice', 'mrp', 'dealPrice', 'savingsAmount']);

function excelValue(row, header) {
    const v = row[header];
    if (v == null || v === '') return null;
    if (NUMERIC_COLS.has(header)) {
        const n = Number(String(v).replace(/,/g, ''));
        return isNaN(n) ? null : n;
    }
    return String(v);
}

function excelFormat(header) {
    if (PRICE_COLS.has(header)) return '\u20B9#,##0';
    if (header === 'discountPercentage') return '0.0"%"';
    if (header === 'rating') return '0.0';
    if (NUMERIC_COLS.has(header)) return '#,##0';
    return null;
}

function csvRow(row) {
    return OUT_FIELDS.map((h) => {
        const v = excelValue(row, h) ?? '';
        return `"${String(v).replace(/"/g, '""')}"`;
    }).join(',');
}

async function writeXlsx(filename) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Data');
    const headerRow = ws.addRow(OUT_FIELDS);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6D28D9' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 22;
    for (const r of results) {
        const row = ws.addRow(OUT_FIELDS.map((h) => excelValue(r, h)));
        row.height = 14;
        for (let i = 0; i < OUT_FIELDS.length; i++) {
            const fmt = excelFormat(OUT_FIELDS[i]);
            if (fmt) row.getCell(i + 1).numFmt = fmt;
            if (OUT_FIELDS[i] === 'error') row.getCell(i + 1).font = { color: { argb: 'FFDC2626' } };
        }
    }
    const widths = OUT_FIELDS.map((h) => {
        let max = h.length;
        for (const r of results) {
            const v = r[h];
            if (v != null) max = Math.max(max, String(v).length);
        }
        return Math.min(Math.max(max + 2, 10), 60);
    });
    ws.columns.forEach((c, i) => { c.width = widths[i]; });
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    ws.autoFilter = { from: 'A1', to: { row: results.length + 1, column: OUT_FIELDS.length } };
    await wb.xlsx.writeFile(filename);
}

function writeCsv(filename) {
    const body = '\uFEFF' + [OUT_FIELDS.join(','), ...results.map(csvRow)].join('\n');
    fs.writeFileSync(filename, body, 'utf8');
}

/** Idempotent — safe from the normal path AND the SIGINT/crash handlers. */
function flushOutput() {
    if (flushing) return;
    flushing = true;
    try {
        fs.mkdirSync(OUT_DIR, { recursive: true });
        const jsonPath = OUT_FILE.replace(/\.(csv|xlsx)$/i, '.json');
        fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), 'utf8');
        if (OUT_IS_EXCEL) {
            writeXlsx(OUT_FILE).then(
                () => console.log(`\n[Scraper] JSON : ${jsonPath}\n[Scraper] Excel: ${OUT_FILE}`),
                (err) => console.error(`[Scraper] Failed to write Excel: ${err.message}`)
            );
        } else {
            writeCsv(OUT_FILE);
            console.log(`\n[Scraper] JSON : ${jsonPath}\n[Scraper] CSV  : ${OUT_FILE}`);
        }
    } catch (err) {
        console.error(`[Scraper] Failed to write output: ${err.message}`);
    }
}

function shutdown(exitCode) {
    flushOutput();
    Promise.resolve(context ? context.close().catch(() => {}) : null)
        .then(() => browser ? browser.close().catch(() => {}) : null)
        .catch(() => {})
        .finally(() => process.exit(exitCode));
}

process.on('SIGINT', () => {
    console.log('\n[Scraper] Interrupted — writing partial results');
    shutdown(130);
});
process.on('uncaughtException', (err) => {
    console.error(`[Scraper] Crash — writing partial results (${err.message})`);
    shutdown(1);
});
process.on('unhandledRejection', (err) => {
    console.error(`[Scraper] Fatal rejection — writing partial results (${err?.message || err})`);
    shutdown(1);
});

/* ------------------------------------------------------------------ */
/* Browser / navigation (portable slice of the in-house service)        */
/* ------------------------------------------------------------------ */

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
];

function randomUserAgent() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

async function getBrowser() {
    if (browser) return browser;
    console.log(`[Scraper] Launching Chromium (${HEADLESS ? 'headless' : 'headed'})${PROXY_URL ? ' via proxy' : ''}...`);
    browser = await chromium.launch({
        headless: HEADLESS,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process',
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
        ],
        proxy: PROXY_URL ? { server: PROXY_URL } : undefined,
    });
    browser.on('disconnected', () => { browser = null; context = null; });
    return browser;
}

/**
 * One warm session context for the whole run. Amazon's bot-check interstitial
 * sets a session cookie when "Continue shopping" is clicked; keeping a single
 * context means later ASIN loads skip the interstitial.
 */
async function getContext() {
    const b = await getBrowser();
    if (context && context.browser() === b) return context;
    context = await b.newContext({
        userAgent: randomUserAgent(),
        locale: 'en-IN',
        viewport: { width: 1366, height: 768 },
        extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
    });
    await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    });
    return context;
}

async function clickContinueShopping(page) {
    try {
        const btn = page.getByRole('button', { name: /continue shopping/i });
        if (!(await btn.count().catch(() => 0))) return false;
        await btn.first().click({ timeout: 8000 }).catch(() => {});
        await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(1500);
        return true;
    } catch {
        return false;
    }
}

/**
 * Navigate to the product URL, transparently clearing Amazon's bot-check
 * interstitial (up to 2 rounds) and waiting for the canonical title. Throws
 * on hard failures (HTTP errors, image CAPTCHA) so the caller can retry.
 */
async function navigateToProduct(page, url) {
    const PICK = 8000;
    const GOTO = 20000;
    let response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: GOTO });

    if (!response || response.status() >= 400) {
        const code = response ? response.status() : 'NO_RESPONSE';
        if (response && response.status() === 503) throw new Error('CAPTCHA_CHALLENGE');
        throw new Error(`HTTP ${code}`);
    }

    await Promise.race([
        page.waitForSelector('#productTitle, #centerCol, #aplus, #aplus_feature_div', { timeout: PICK }),
        page.getByRole('button', { name: /continue shopping/i }).first().waitFor({ state: 'attached', timeout: PICK }),
    ]).catch(() => {});

    const html = await page.content().catch(() => '');
    if (/api\/services\/captcha/i.test(html)) throw new Error('CAPTCHA_CHALLENGE');

    for (let round = 0; round < 2; round++) {
        const hasContinue = (await page.locator('button').filter({ hasText: /continue shopping/i }).count().catch(() => 0)) > 0;
        if (!hasContinue) break;
        await clickContinueShopping(page);
        response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: GOTO }).catch(() => null);
        if (!response) throw new Error('INTERSTITIAL_REDIRECT_FAILED');
        if (response.status() >= 400) {
            if (response.status() === 503) throw new Error('CAPTCHA_CHALLENGE');
            throw new Error('INTERSTITIAL_REDIRECT_FAILED');
        }
        await Promise.race([
            page.waitForSelector('#productTitle, #centerCol, #aplus, #aplus_feature_div', { timeout: PICK }),
            page.getByRole('button', { name: /continue shopping/i }).first().waitFor({ state: 'attached', timeout: PICK }),
        ]).catch(() => {});
    }

    const bodyLen = await page.locator('body').evaluate((el) => el.innerHTML.length, { timeout: 8000 }).catch(() => 0);
    const productEls = await page.locator('#productTitle, #centerCol, #aplus, #aplus_feature_div, #averageCustomerReviews, #productDetails_feature_div').count().catch(() => 0);
    if (bodyLen < 1000 && productEls === 0) throw new Error('TITLE_NOT_FOUND');
    return true;
}

/* ------------------------------------------------------------------ */
/* Extraction (mirrors the in-house service, incl. deal-badge fix)      */
/* ------------------------------------------------------------------ */

function parsePrice(value) {
    if (!value) return 0;
    const cleaned = value.toString().replace(/[^\d.]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
}

function parseInt_(value) {
    if (!value) return 0;
    const cleaned = value.toString().replace(/[^\d]/g, '');
    const parsed = parseInt(cleaned, 10);
    return isNaN(parsed) ? 0 : parsed;
}

function cleanBadgeText(text) {
    return text
        .replace(/\{[\s\S]*?\}/g, ' ')
        .replace(/\.\w+(?=\s|$)/g, ' ')
        .replace(/NO_OF_[A-Z]+\s+[a-z]+/gi, ' ')
        .replace(/\b(?:hours?|minutes?|seconds?)\b/gi, ' ')
        .replace(/deal\s+ends?[^;,]{0,40}/gi, ' ')
        .replace(/\bends?\s+in\b[^;,]{0,40}/gi, ' ')
        .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, ' ')
        .replace(/[-−]\s?\d{1,3}\s*%/g, ' ')
        .replace(/[|•·;,]\s*$/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^(.*?)(?:\s+\1)+$/, '$1')
        .trim();
}

async function extractFullFromPage(page, asin) {
    const count = async (sel) => (await page.locator(sel).count().catch(() => 0));
    const textContent = async (selector) => {
        if (!(await count(selector))) return '';
        const value = await page.locator(selector).first().evaluate((node) => node.textContent || '', null, { timeout: 5000 }).catch(() => '');
        return String(value).trim();
    };
    const collectTexts = async (selector) => {
        const n = await count(selector);
        const out = [];
        for (let i = 0; i < n; i++) {
            const t = await page.locator(selector).nth(i).evaluate((node) => (node.textContent || '').trim(), null, { timeout: 3000 }).catch(() => '');
            if (t) out.push(t);
        }
        return out;
    };

    const title = await textContent('#productTitle');

    const rupee = (t) => { const m = String(t).match(/₹\s*([\d,]+(?:\.\d{1,2})?)/); return m ? parsePrice(m[1]) : 0; };
    const firstPrice = async (selectors) => {
        for (const sel of selectors) {
            const texts = await collectTexts(sel);
            for (const t of texts) {
                const p = parsePrice(t);
                if (p > 0) return p;
            }
        }
        return 0;
    };
    let currentPrice = 0;
    currentPrice = rupee(await textContent('#apex-pricetopay-accessibility-label'));
    if (!currentPrice) {
        currentPrice = rupee(await textContent('#corePriceDisplay_desktop_feature_div .priceToPay, .apexPriceToPay, .priceToPay'));
    }
    if (!currentPrice) {
        currentPrice = await firstPrice([
            '.apexPriceToPay .a-offscreen',
            'span.a-price:not(.a-text-price) span.a-offscreen',
            '#priceblock_ourprice',
            '#priceblock_dealprice',
        ]);
    }

    let mrp = 0;
    const corePriceTexts = await collectTexts('#corePriceDisplay_desktop_feature_div span.aok-offscreen, #corePriceDisplay_desktop_feature_div .a-offscreen');
    const corePriceText = corePriceTexts.join(' | ');
    const mrpMatch = corePriceText.match(/M\.?R\.?P\.[:\s]*₹?([\d,]+(?:\.\d{1,2})?)/i);
    if (mrpMatch) mrp = parsePrice(mrpMatch[1]);
    if (!mrp) {
        const listPrices = await collectTexts('.a-price.a-text-price .a-offscreen, .priceToPay > .a-offscreen');
        for (const lp of listPrices) {
            const p = parsePrice(lp);
            if (p > currentPrice) { mrp = p; break; }
        }
    }
    if (!mrp) mrp = currentPrice;
    const effectiveMrp = mrp;

    let discountPercentage = 0;
    const savingsMatch = corePriceText.match(/with\s+([\d]+)\s*percent\s+savings/i);
    if (savingsMatch) {
        discountPercentage = parseInt(savingsMatch[1], 10) || 0;
    } else if (effectiveMrp > currentPrice && currentPrice > 0) {
        discountPercentage = Math.round(((effectiveMrp - currentPrice) / effectiveMrp) * 10000) / 100;
    }

    let rating = null;
    const ratingRaw = (await textContent('#acrPopover, span[data-hook="rating-out-of-text"]')).replace(/\s+/g, ' ');
    const ratingMatch = ratingRaw.match(/([0-5](?:[.,]\d{1,2})?)\s*out\s*of\s*5/i);
    if (ratingMatch) rating = parseFloat(ratingMatch[1].replace(',', '.'));

    let reviewCount = null;
    const reviewRaw = (await textContent('#acrCustomerReviewText, #averageCustomerReviews a span.a-size-base')).replace(/\s+/g, ' ').trim();
    const reviewMatch = reviewRaw.match(/([\d,]+)\s*(?:customer\s+)?(?:ratings?|global ratings?)/i)
        || reviewRaw.match(/\(([\d,]+)\)/)
        || reviewRaw.match(/^([\d,]+)\s*(?:reviews?)?/i);
    if (reviewMatch) reviewCount = parseInt(reviewMatch[1].replace(/,/g, ''), 10) || null;

    const hasAplus = (await count('#aplus, #aplus_feature_div')) > 0;

    const imageCount = await count('#altImages img');
    let mainImage = '';
    const landingImg = await page.locator('#landingImage').first().getAttribute('src', { timeout: 5000 }).catch(() => null);
    if (!landingImg) {
        mainImage = await page.locator('#imgTagWrapperId img, #altImages img').first().getAttribute('src', { timeout: 5000 }).catch(() => '');
    } else {
        mainImage = landingImg;
    }

    let brand = '';
    const byline = await textContent('#bylineInfo');
    const brandMatch = byline.match(/Visit the\s+([^\s,]+)/i) || byline.match(/Brand:\s*([^,]+)/i);
    if (brandMatch) brand = brandMatch[1].trim();

    let category = '';
    const bcCount = await count('#wayfinding-breadcrumbs_feature_div li');
    if (bcCount > 0) {
        category = (await page.locator('#wayfinding-breadcrumbs_feature_div li').nth(bcCount - 1).evaluate((n) => n.textContent || '', null, { timeout: 5000 }).catch(() => '')).trim();
    }
    if (!category) category = String((await textContent('#wayfinding-breadcrumbs_feature_div ul')).split(/\n|›/).pop() || '').trim();

    let availability = '';
    const availOpts = [
        '#availability span.a-color-success',
        '#availability span.a-color-price',
        '#availability .a-size-medium',
        '#availability',
        '#outOfStock > div',
    ];
    for (const sel of availOpts) {
        const t = (await textContent(sel)).replace(/\s+/g, ' ').trim();
        if (t && t.length > 3 && t.length < 200 && !/^P\.when/i.test(t)) { availability = t; break; }
    }

    let soldBy = '';
    const merchantSelectors = [
        '#merchantInfoFeature_feature_div a',
        '#sellerProfileTriggerId',
        '#sellerProfileTriggerId2',
        '#tabular-buybox-widget_feature_div a[href*="/sp?marketplaceID="]',
    ];
    for (const sel of merchantSelectors) {
        const t = await textContent(sel);
        if (t && t.toLowerCase() !== 'amazon') { soldBy = t; break; }
    }
    if (!soldBy && /sold by amazon/i.test(await textContent('#buybox'))) soldBy = 'Amazon';

    // Deal badge — real deal label (Lightning Deal, Deal of the Day, Mega
    // Festival Deal...) with the countdown/CSS noise stripped. The bare
    // "-71%" savings badge is only a last resort.
    let dealBadge = '';
    const badgeContainer = (await textContent('#dealBadge_feature_div')).replace(/\s+/g, ' ').trim();
    const badgeHooks = (await textContent('span[data-hook="deal-badge"], #dealBadgeSupportingText, .a-color-price .dealText')).replace(/\s+/g, ' ').trim();
    let candidate = cleanBadgeText(badgeContainer);
    if (!candidate) candidate = cleanBadgeText(badgeHooks);
    if (candidate) dealBadge = candidate;
    if (!dealBadge) {
        const savingsBadge = (await textContent('#corePriceDisplay_desktop_feature_div .savingsPercentage, #corePriceDisplay_desktop_feature_div .apex-savings-percent, .savingsPercentage')).replace(/\s+/g, ' ').trim();
        if (/^[-−]?\d{1,3}%/.test(savingsBadge)) dealBadge = savingsBadge;
    }

    let dealPrice = 0;
    dealPrice = parsePrice(await textContent('.apexPriceToPay .a-offscreen, #priceblock_dealprice, .priceToPay .a-offscreen'));

    let savingsAmount = 0;
    const savingsRaw = (await textContent('.savingsPercentage, #apex_desktop .a-color-price, .a-price-savings')).replace(/\s+/g, ' ').trim();
    const saveMatch = savingsRaw.match(/save\s+₹([\d,]+(?:\.\d+)?)/i) || savingsRaw.match(/₹([\d,]+(?:\.\d+)?)\s*\(\d+%\)/i);
    if (saveMatch) savingsAmount = parsePrice(saveMatch[1]);

    let bsr = 0;
    let subBsr = 0;
    let subBsrCategory = '';
    const bsrRows = page.locator('#productDetails_detailBullets_sections1 tr, #productDetails_detailBullets_sections1 .prodDetAttrValue');
    const bsrCount = await bsrRows.count().catch(() => 0);
    for (let i = 0; i < bsrCount; i++) {
        const rowText = (await bsrRows.nth(i).evaluate((n) => n.textContent || '', null, { timeout: 5000 }).catch(() => '')).replace(/\s+/g, ' ');
        const m = rowText.match(/#([\d,]+)\s*in\s+([^(]+)\(?(?:PAID|FREE)?\)?/i);
        if (m) {
            const rank = parseInt_(m[1]);
            if (bsr === 0) bsr = rank;
            else { subBsr = rank; subBsrCategory = m[2].trim(); break; }
        }
    }
    if (!bsr) {
        const hr = (await textContent('#Sales Rank, #productFactsDesktopExpander ul.zg_hrsr')).replace(/\s+/g, ' ').trim();
        const hrMatch = hr.match(/#([\d,]+)\s+in\s+([^(]+)/i);
        if (hrMatch) bsr = parseInt_(hrMatch[1]);
    }

    let bulletPoints = [];
    const bulletCount = await count('#feature-bullets li');
    for (let i = 0; i < bulletCount; i++) {
        const t = (await page.locator('#feature-bullets li').nth(i).evaluate((n) => n.textContent || '', null, { timeout: 5000 }).catch(() => '')).trim();
        if (t && t.length > 3) bulletPoints.push(t);
    }

    let description = '';
    const descSelectors = ['#productDescription', '#productDescription_feature_div .a-expander-content', '#aplus'];
    for (const sel of descSelectors) {
        const t = (await textContent(sel)).trim();
        if (t && t.length > description.length) description = t;
    }

    return {
        asin,
        title,
        currentPrice,
        mrp: effectiveMrp,
        discountPercentage,
        rating,
        reviewCount,
        hasAplus,
        imageUrl: mainImage,
        imagesCount: imageCount,
        brand,
        category,
        availability,
        soldBy,
        dealBadge,
        dealPrice,
        savingsAmount,
        bsr,
        subBsr,
        subBsrCategory,
        bulletPoints,
        bulletPointsText: bulletPoints.join('\n• '),
        description,
        url: page.url(),
        scrapedAt: new Date().toISOString(),
    };
}

/* ------------------------------------------------------------------ */
/* Scrape one ASIN with retry + backoff                                */
/* ------------------------------------------------------------------ */

const isCaptcha = (err) => /CAPTCHA_CHALLENGE/i.test(err.message || '');

async function scrapeAsin(asin) {
    const failures = new Map();
    const url = `https://www.amazon.in/dp/${asin}`;
    let attempt = 0;
    let lastError;

    while (attempt <= MAX_RETRIES) {
        if (attempt > 0) {
            const backoff = Math.min(30000, 1000 * Math.pow(2, attempt) + Math.random() * 500);
            console.log(`[Scraper] retry ${asin} in ${Math.round(backoff / 1000)}s`);
            await sleep(backoff);
        }
        attempt++;

        const context = await getContext();
        const page = await context.newPage();
        page.setDefaultTimeout(NAVIGATION_TIMEOUT);
        if (REQUEST_TIMEOUT) page.setDefaultNavigationTimeout(REQUEST_TIMEOUT);
        try {
            await navigateToProduct(page, url);
            const extracted = await extractFullFromPage(page, asin);
            if (!extracted.title) throw new Error('TITLE_NOT_FOUND');
            return extracted;
        } catch (err) {
            lastError = err;
            failures.set(asin, (failures.get(asin) || 0) + 1);
            if (isCaptcha(err)) {
                // Don't hammer a live CAPTCHA block — fail fast.
                throw err;
            }
        } finally {
            await page.close().catch(() => {});
        }
    }
    throw lastError || new Error(`Failed to scrape ${asin}`);
}

/* ------------------------------------------------------------------ */
/* Main                                                                 */
/* ------------------------------------------------------------------ */

function flattenForCsv(row) {
    const r = { ...row };
    r.hasAplus = r.hasAplus ? 'YES' : '';
    r.bulletPointsText = sanitize(r.bulletPointsText);
    return r;
}

async function main() {
    const { valid, invalid } = parseAsins(ASINS_FILE);
    const batch = LIMIT > 0 ? valid.slice(0, LIMIT) : valid;
    console.log(`[Scraper] File: ${ASINS_FILE}`);
    console.log(`[Scraper] ${batch.length} ASIN(s) (${valid.length} in file), delay ${DELAY_MS}ms, headless=${HEADLESS}`);
    if (invalid.length) console.log(`[Scraper] Skipping invalid: ${invalid.join(', ')}`);

    const started = Date.now();

    for (let i = 0; i < batch.length; i++) {
        const asin = batch[i];
        const idx = `${i + 1}/${batch.length}`;
        try {
            const data = await scrapeAsin(asin);
            results.push(flattenForCsv({ ...data, status: 'OK', error: '' }));
            console.log(`[Scraper] [${idx}] ${asin} OK — ₹${data.currentPrice} (MRP ₹${data.mrp}) | ${data.rating ?? '-'}★ (${data.reviewCount ?? 0}) | deal: ${data.dealBadge || '-'} | ${data.soldBy || data.availability || '-'} | ${(data.title || '').slice(0, 55)}`);
        } catch (err) {
            results.push(flattenForCsv({ asin, status: 'FAIL', title: '', error: err.message }));
            console.log(`[Scraper] [${idx}] ${asin} FAIL — ${err.message}`);
        }
        if (i < batch.length - 1) await sleep(DELAY_MS);
    }

    const ok = results.filter((r) => r.status === 'OK').length;
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`\n[Scraper] Done in ${secs}s — ${ok} OK, ${results.length - ok} failed`);
    shutdown(ok > 0 && results.length === ok ? 0 : 1);
}

main().catch((err) => {
    console.error(`[Scraper] Fatal: ${err.message}`);
    shutdown(1);
});