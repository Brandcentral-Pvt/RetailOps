// scrape-raw-gl.cjs
// Run: node scrape-raw-gl.cjs --input MEELANA.csv --output MEELANA.xlsx --concurrency 3 --delay 2000
//
// Resumable: writes a progress sidecar (<output>.progress.json) and checkpoints
// the workbook periodically, so an interrupted run can be continued by simply
// running the same command again.

const { chromium } = require('playwright');
const fs = require('fs');
const XLSX = require('xlsx');
const { program } = require('commander');
// Verified glProductGroup extractor (priority-ordered; handles hidden inputs,
// rhapsodyARIngress JS object literals, data-* attributes, etc.)
const { extract: extractGlProductGroup } = require('./gl_product_group.cjs');

program
  .option('-i, --input <file>', 'Input CSV/JSON/TXT file with ASINs (one per line)', 'asins.txt')
  .option('-o, --output <file>', 'Output Excel file', 'raw-gl-data.xlsx')
  .option('-c, --concurrency <n>', 'Concurrent pages', '3')
  .option('-d, --delay <ms>', 'Delay between requests (ms)', '3000')
  .option('-m, --marketplace <id>', 'Amazon marketplace domain', 'amazon.in')
  .option('--keep-duplicates', 'Do not de-duplicate ASINs')
  .option('--fresh', 'Ignore any existing progress file and start over')
  .option('--no-headless', 'Run headed (visible browser)')
  .parse();

const opts = program.opts();
const input = opts.input;
const output = opts.output;
const CONCURRENCY = Math.max(1, parseInt(opts.concurrency, 10) || 3);
const DELAY = Math.max(0, parseInt(opts.delay, 10) || 0);
const MARKETPLACE = opts.marketplace;
const HEADLESS = opts.headless !== false;
const KEEP_DUPLICATES = !!opts.keepDuplicates;
const FRESH = !!opts.fresh;

const PROGRESS_FILE = output.replace(/\.(xlsx|xls)$/i, '') + '.progress.json';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function decodeEntities(s) {
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

const isAsin = (v) => /^[A-Z0-9]{10}$/.test(v);

// ─── Read ASINs (CSV / JSON / TXT, header-aware) ───
function readAsins(file) {
  const content = fs.readFileSync(file, 'utf8');

  if (file.toLowerCase().endsWith('.json')) {
    const parsed = JSON.parse(content);
    const arr = Array.isArray(parsed) ? parsed : parsed.asins || [];
    return arr.map((v) => String(v).trim().toUpperCase()).filter(isAsin);
  }

  let rows = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Drop a header row (e.g. "ASIN")
  if (rows.length && /^["']?asin["']?$/i.test(rows[0])) rows = rows.slice(1);

  return rows
    .map((line) => line.split(',')[0].trim().replace(/^["']|["']$/g, '').toUpperCase())
    .filter(isAsin);
}

function unique(list) {
  const seen = new Set();
  const out = [];
  for (const v of list) {
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

// Extract ALL category/GL data from a rendered page
function extractAllCategoryData(html, url) {
  const data = {
    asin: null,
    url,
    title: null,
    breadcrumbs: [],
    jsonLd: [],
    metaTags: {},
    scriptDataKeys: [],
    amazonData: {},
    rawCategoryStrings: [],
    // ── Authoritative GL (global product group) result ──
    glProductGroup: null,
    glGroup: null,
    glMatchedBy: null,
    glAgreement: null,
    glWebsiteDisplayGroup: null,
    glBlocked: false,
    glSources: {},
    success: true,
    error: null,
  };

  try {
    // 1. ASIN from URL
    const asinMatch =
      url.match(/\/dp\/([A-Z0-9]{10})/i) || url.match(/\/gp\/product\/([A-Z0-9]{10})/i);
    data.asin = asinMatch ? asinMatch[1].toUpperCase() : null;

    // 2. Title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    data.title = titleMatch ? decodeEntities(titleMatch[1].trim()) : null;

    // 3. glProductGroup — authoritative extraction via verified patterns
    const gl = extractGlProductGroup(html);
    data.glProductGroup = gl.value;
    data.glGroup = gl.group;
    data.glMatchedBy = gl.matched_by;
    data.glAgreement = gl.agreement;
    data.glWebsiteDisplayGroup = gl.website_display_group;
    data.glBlocked = gl.blocked;
    data.glSources = gl.sources;
    if (gl.value) data.amazonData.glProductGroup = [gl.value];

    // 4. Breadcrumbs
    const breadcrumbHtml = html.match(
      /<div[^>]*id=["']wayfinding-breadcrumbs[^"']*["'][^>]*>([\s\S]*?)<\/div>/i
    );
    if (breadcrumbHtml) {
      const texts = breadcrumbHtml[1].match(/>([^<]+)</g);
      if (texts) {
        data.breadcrumbs = texts
          .map((t) => decodeEntities(t.replace(/[<>]/g, '').trim()))
          .filter(Boolean);
      }
    }

    // 5. JSON-LD structured data
    const jsonLdMatches = html.match(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    );
    if (jsonLdMatches) {
      for (const match of jsonLdMatches) {
        try {
          const json = JSON.parse(match.replace(/<script[^>]*>|<\/script>/gi, ''));
          data.jsonLd.push(json);
        } catch (e) {}
      }
    }

    // 6. Meta tags
    const metaMatches = html.match(/<meta[^>]+>/gi);
    if (metaMatches) {
      for (const meta of metaMatches) {
        const nameMatch =
          meta.match(/name=["']([^"']+)["']/i) || meta.match(/property=["']([^"']+)["']/i);
        const contentMatch = meta.match(/content=["']([^"']*)["']/i);
        if (nameMatch && contentMatch) {
          data.metaTags[nameMatch[1]] = decodeEntities(contentMatch[1]);
        }
      }
    }

    // 7. Script keys only (content is not used in any output sheet — avoids memory bloat)
    const scriptMatches = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
    if (scriptMatches) {
      for (let i = 0; i < Math.min(scriptMatches.length, 100); i++) {
        if (/glProductGroup|browseNode|category|breadcrumb|classification/i.test(scriptMatches[i])) {
          data.scriptDataKeys.push(`script_${i}`);
        }
      }
    }

    // 8. Amazon-specific patterns (tolerant of quotes/backticks)
    const patterns = {
      glProductGroup: /glProductGroup["']?\s*[:=]\s*["'`]?(gl_[A-Za-z0-9_]+)["'`]?/gi,
      browseNodeId: /browseNodeId["']?\s*:\s*["']?(\d+)["']?/gi,
      browseNode: /["']browseNode["']\s*:\s*["']?(\d+)["']?/gi,
      category: /["']category["']\s*:\s*["']([^"']+)["']/gi,
      categoryPath: /["']categoryPath["']\s*:\s*["']([^"']+)["']/gi,
      glProductGroupAlt: /gl_product_group["']?\s*[:=]\s*["'`]?([A-Za-z0-9_]+)["'`]?/gi,
      productGroup: /productGroup["']?\s*[:=]\s*["'`]?([A-Za-z0-9_]+)["'`]?/gi,
      productType: /productType["']?\s*[:=]\s*["'`]?([A-Za-z0-9_]+)["'`]?/gi,
      department: /department["']?\s*[:=]\s*["'`]?([A-Za-z0-9_]+)["'`]?/gi,
      merchantCategory: /merchantCategory["']?\s*[:=]\s*["'`]?([A-Za-z0-9_]+)["'`]?/gi,
      siteCategory: /siteCategory["']?\s*[:=]\s*["'`]?([A-Za-z0-9_]+)["'`]?/gi,
      taxonomy: /taxonomy["']?\s*[:=]\s*["'`]?([A-Za-z0-9_]+)["'`]?/gi,
    };

    for (const [key, regex] of Object.entries(patterns)) {
      const matches = [...html.matchAll(regex)];
      if (matches.length) {
        data.amazonData[key] = [...new Set(matches.map((m) => m[1]))];
      }
    }
    if (gl.value) data.amazonData.glProductGroup = [gl.value];

    // 9. Raw category strings from visible text
    const visibleText = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .substring(0, 50000);

    const categoryKeywords = [
      'shirt', 'pant', 'dress', 'top', 'bottom', 'skirt', 'jean', 'short', 'blouse',
      'tunic', 'trouser', 'legging', 'leggings', 'activewear', 'sportswear', 'sleepwear',
      'swimwear', 'outerwear', 'innerwear', 'lingerie', 'shoe', 'boot', 'sandal',
      'slipper', 'sneaker', 'sneakers', 'kitchen', 'furniture', 'home', 'grocery',
    ];
    for (const kw of categoryKeywords) {
      const regex = new RegExp(`\\b${kw}\\b`, 'gi');
      const matches = visibleText.match(regex);
      if (matches) {
        data.rawCategoryStrings.push({ keyword: kw, count: matches.length });
      }
    }
  } catch (e) {
    data.error = e.message;
    data.success = false;
  }

  return data;
}

// Scrape a single ASIN (owns its page lifecycle)
async function scrapeAsin(context, asin, market) {
  const page = await context.newPage();
  const url = `https://www.${market}/dp/${asin}`;

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

    await Promise.all([
      page.waitForSelector('#productTitle, #title', { timeout: 15000 }).catch(() => {}),
      page
        .waitForSelector(
          '#wayfinding-breadcrumbs_feature_div, #wayfinding-breadcrumbs_container, .a-breadcrumb',
          { timeout: 10000 }
        )
        .catch(() => {}),
    ]);

    await page.waitForTimeout(500);
    const html = await page.content();
    return { asin, html, url: page.url(), success: true };
  } catch (err) {
    return { asin, error: err.message, success: false };
  } finally {
    await page.close().catch(() => {});
  }
}

function emptyResult(asin, error) {
  return {
    asin,
    success: false,
    error,
    glProductGroup: null,
    glGroup: null,
    glMatchedBy: null,
    glAgreement: null,
    glWebsiteDisplayGroup: null,
    glBlocked: false,
    glSources: {},
    title: null,
    url: null,
    breadcrumbs: [],
    metaTags: {},
    scriptDataKeys: [],
    amazonData: {},
    rawCategoryStrings: [],
    jsonLd: [],
  };
}

async function processAsin(context, asin) {
  let result = await scrapeAsin(context, asin, MARKETPLACE);
  if (!result.success) return emptyResult(asin, result.error);

  let extracted = extractAllCategoryData(result.html, result.url);
  extracted.asin = asin;

  // Retry once if the page looked like a bot-check or the GL value is missing.
  if (extracted.glBlocked || !extracted.glProductGroup) {
    await sleep(1500);
    const retry = await scrapeAsin(context, asin, MARKETPLACE);
    if (retry.success) {
      const ex2 = extractAllCategoryData(retry.html, retry.url);
      ex2.asin = asin;
      if (ex2.glProductGroup || !extracted.glProductGroup) extracted = ex2;
    }
  }

  return extracted;
}

// ─── Output writers ───
function buildWorkbook(results) {
  const wb = XLSX.utils.book_new();

  const summary = results.map((r) => ({
    ASIN: r.asin,
    GL_Value: r.glProductGroup || '',
    GL_Group: r.glGroup || '',
    GL_MatchedBy: r.glMatchedBy || '',
    GL_Agreement: r.glAgreement || '',
    GL_WebsiteDisplayGroup: r.glWebsiteDisplayGroup || '',
    Blocked: r.glBlocked || false,
    Title: r.title || '',
    URL: r.url || '',
    Success: r.success,
    Error: r.error || '',
    Category: (r.amazonData && r.amazonData.category ? r.amazonData.category : []).join('; '),
    CategoryPath: (r.amazonData && r.amazonData.categoryPath ? r.amazonData.categoryPath : []).join('; '),
    BrowseNodeIds: (r.amazonData && r.amazonData.browseNodeId ? r.amazonData.browseNodeId : []).join('; '),
    ProductGroup: (r.amazonData && r.amazonData.productGroup ? r.amazonData.productGroup : []).join('; '),
    ProductType: (r.amazonData && r.amazonData.productType ? r.amazonData.productType : []).join('; '),
    Department: (r.amazonData && r.amazonData.department ? r.amazonData.department : []).join('; '),
    Breadcrumbs: (r.breadcrumbs || []).join(' > '),
    RawCategoryKeywords: (r.rawCategoryStrings || [])
      .map((k) => `${k.keyword}(${k.count})`)
      .join(', '),
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Summary');

  const patternRows = [];
  for (const r of results) {
    for (const [key, values] of Object.entries(r.amazonData || {})) {
      for (const v of values) patternRows.push({ ASIN: r.asin, Pattern: key, Value: v });
    }
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(patternRows), 'All_Patterns');

  const jsonldRows = [];
  for (const r of results) {
    for (const j of r.jsonLd || []) jsonldRows.push({ ASIN: r.asin, JSON_LD: JSON.stringify(j) });
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(jsonldRows), 'JSON_LD');

  const metaRows = [];
  for (const r of results) {
    for (const [key, value] of Object.entries(r.metaTags || {})) {
      metaRows.push({ ASIN: r.asin, MetaName: key, Content: value });
    }
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(metaRows), 'Meta_Tags');

  const breadcrumbRows = [];
  for (const r of results) {
    for (const b of r.breadcrumbs || []) breadcrumbRows.push({ ASIN: r.asin, Breadcrumb: b });
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(breadcrumbRows), 'Breadcrumbs');

  return wb;
}

function writeOutputs(results) {
  XLSX.writeFile(buildWorkbook(results), output);
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(results));
}

function loadProgress() {
  if (FRESH || !fs.existsSync(PROGRESS_FILE)) return [];
  try {
    const arr = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    console.warn(`Could not read progress file ${PROGRESS_FILE}: ${e.message}`);
    return [];
  }
}

// Main
async function main() {
  let asins = readAsins(input);
  if (!KEEP_DUPLICATES) asins = unique(asins);
  if (!asins.length) {
    console.error(`No valid ASINs found in ${input}`);
    process.exit(1);
  }
  console.log(`Loaded ${asins.length} unique ASINs from ${input}`);

  const previous = loadProgress();
  const results = previous.slice();
  const doneSet = new Set(previous.map((r) => r.asin));
  const queue = asins.filter((a) => !doneSet.has(a));

  if (previous.length) {
    console.log(`Resuming: ${previous.length} already done, ${queue.length} remaining.`);
  }

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-IN',
    viewport: { width: 1280, height: 720 },
  });

  let done = previous.length;
  let completedSinceCheckpoint = 0;

  const checkpoint = () => {
    try {
      writeOutputs(results);
    } catch (e) {
      console.warn(`Checkpoint failed: ${e.message}`);
    }
  };

  // Persist whatever we have on Ctrl+C / termination.
  const onSignal = () => {
    console.log('\nInterrupted — saving progress...');
    checkpoint();
    process.exit(130);
  };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);

  async function worker() {
    while (queue.length > 0) {
      const asin = queue.shift();
      let extracted;
      try {
        extracted = await processAsin(context, asin);
      } catch (e) {
        extracted = emptyResult(asin, e.message);
      }
      results.push(extracted);
      done++;
      completedSinceCheckpoint++;

      if (extracted.success === false) {
        console.log(`❌ [${done}/${asins.length}] ${asin}: ${extracted.error}`);
      } else {
        const flag = extracted.glProductGroup ? '✅' : '⚠️ ';
        console.log(
          `${flag} [${done}/${asins.length}] ${asin}: GL=${extracted.glProductGroup || 'NOT FOUND'} ` +
            `(${extracted.glMatchedBy || 'n/a'}) | ${extracted.breadcrumbs.length} breadcrumbs`
        );
      }

      // Checkpoint periodically so a crash never loses the whole run.
      if (completedSinceCheckpoint >= 10) {
        completedSinceCheckpoint = 0;
        checkpoint();
      }

      if (DELAY) await sleep(DELAY);
    }
  }

  const workerCount = Math.min(CONCURRENCY, Math.max(queue.length, 1));
  console.log(`Scraping with ${workerCount} worker(s), ${DELAY}ms delay...`);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  await context.close();
  await browser.close();

  writeOutputs(results);

  const resolved = results.filter((r) => r.glProductGroup).length;
  console.log(`\nDone. GL resolved ${resolved}/${results.length}. Wrote ${output}`);
  // Keep the progress file only if something failed, so a re-run can retry.
  if (resolved === results.length) {
    try {
      fs.unlinkSync(PROGRESS_FILE);
    } catch (e) {}
  }
}
main().catch((e) => {
  console.error('FATAL:', e);
  try {
    process.exit(1);
  } catch (e2) {}
});
