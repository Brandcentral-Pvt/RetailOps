// scrape-raw-gl.js
// Run: node scrape-raw-gl.js --input asins.csv --output raw-gl-data.xlsx --concurrency 3 --delay 2000

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { program } = require('commander');

program
  .option('-i, --input <file>', 'Input CSV/JSON/TXT file with ASINs (one per line)', 'asins.txt')
  .option('-o, --output <file>', 'Output Excel file', 'raw-gl-data.xlsx')
  .option('-c, --concurrency <n>', 'Concurrent pages', '3')
  .option('-d, --delay <ms>', 'Delay between requests (ms)', '3000')
  .option('-m, --marketplace <id>', 'Amazon marketplace domain', 'amazon.in')
  .option('--no-headless', 'Run headed (visible browser)')
  .parse();

const { input, output, concurrency, delay, marketplace, headless } = program.opts();

// ─── Read ASINs ───
function readAsins(file) {
  const content = fs.readFileSync(file, 'utf8');
  if (file.endsWith('.json')) {
    return JSON.parse(content);
  }
  return content.split('\n').map(l => l.trim()).filter(Boolean);
}

// Extract ALL category/GL data from page source
function extractAllCategoryData(html, url) {
  const data = {
    asin: null,
    url,
    title: null,
    // Breadcrumb data
    breadcrumbs: [],
    breadcrumbSelectors: [],
    // JSON-LD structured data
    jsonLd: [],
    // Meta tags
    metaTags: {},
    // Script data
    scriptData: {},
    // Amazon-specific data
    amazonData: {},
    // Raw extracted strings
    rawCategoryStrings: [],
    // Success/error
    success: true,
    error: null,
  };

  try {
    // 1. Extract ASIN from URL
    const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/i);
    data.asin = asinMatch ? asinMatch[1] : null;

    // 2. Title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    data.title = titleMatch ? titleMatch[1].trim() : null;

    // 3. Breadcrumbs - multiple selectors
    const breadcrumbSelectors = [
      '#wayfinding-breadcrumbs_feature_div li',
      '#wayfinding-breadcrumbs_container li',
      '.a-breadcrumb li',
      '.a-breadcrumb a',
      '[data-a-breadcrumb] li',
      '[data-a-breadcrumb] a',
      '#breadcrumb li',
      '.breadcrumb li',
      '.breadcrumb a',
    ];

    for (const sel of breadcrumbSelectors) {
      const matches = html.match(new RegExp(`<li[^>]*>\\s*<a[^>]*>([^<]+)</a>\\s*</li>`, 'gi'));
      if (matches) {
        data.breadcrumbSelectors.push({ selector: sel, matches: matches.slice(0, 10) });
      }
    }

    // Extract breadcrumb text from known containers
    const breadcrumbHtml = html.match(/<div[^>]*id=["']wayfinding-breadcrumbs[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    if (breadcrumbHtml) {
      const texts = breadcrumbHtml[1].match(/>([^<]+)</g);
      if (texts) {
        data.breadcrumbs = texts.map(t => t.replace(/[<>]/g, '').trim()).filter(Boolean);
      }
    }

    // 4. JSON-LD structured data
    const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    if (jsonLdMatches) {
      for (const match of jsonLdMatches) {
        try {
          const json = JSON.parse(match.replace(/<script[^>]*>|<\/script>/gi, ''));
          data.jsonLd.push(json);
        } catch (e) {}
      }
    }

    // 5. Meta tags
    const metaMatches = html.match(/<meta[^>]+>/gi);
    if (metaMatches) {
      for (const meta of metaMatches) {
        const nameMatch = meta.match(/name=["']([^"']+)["']/i) || meta.match(/property=["']([^"']+)["']/i);
        const contentMatch = meta.match(/content=["']([^"']*)["']/i);
        if (nameMatch && contentMatch) {
          data.metaTags[nameMatch[1]] = contentMatch[1];
        }
      }
    }

    // 6. Script data - extract ALL script content for analysis
    const scriptMatches = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
    if (scriptMatches) {
      for (let i = 0; i < Math.min(scriptMatches.length, 50); i++) {
        const script = scriptMatches[i];
        // Look for category/GL/product data
        if (/glProductGroup|browseNode|category|breadcrumb|classification/i.test(script)) {
          data.scriptData[`script_${i}`] = script.substring(0, 2000);
        }
      }
    }

    // 7. Amazon-specific patterns - extract ALL occurrences
    const patterns = {
      glProductGroup: /glProductGroup\s*[:=]\s*['"]([^'"]+)['"]/gi,
      browseNodeId: /browseNodeId["']\s*:\s*["']?(\d+)["']?/gi,
      browseNode: /["']browseNode["']\s*:\s*["']?(\d+)["']?/gi,
      category: /["']category["']\s*:\s*["']([^"']+)["']/gi,
      categoryPath: /["']categoryPath["']\s*:\s*["']([^"']+)["']/gi,
      glProductGroupAlt: /gl_product_group["']?\s*[:=]\s*["']([^"']+)["']/gi,
      glCategory: /gl_category["']?\s*[:=]\s*["']([^"']+)["']/gi,
      glSubCategory: /gl_sub_category["']?\s*[:=]\s*["']([^"']+)["']/gi,
      productGroup: /productGroup["']?\s*[:=]\s*["']([^"']+)["']/gi,
      productType: /productType["']?\s*[:=]\s*["']([^"']+)["']/gi,
      department: /department["']?\s*[:=]\s*["']([^"']+)["']/gi,
      merchantCategory: /merchantCategory["']?\s*[:=]\s*["']([^"']+)["']/gi,
      siteCategory: /siteCategory["']?\s*[:=]\s*["']([^"']+)["']/gi,
      taxonomy: /taxonomy["']?\s*[:=]\s*["']([^"']+)["']/gi,
    };

    for (const [key, regex] of Object.entries(patterns)) {
      const matches = [...html.matchAll(regex)];
      if (matches.length) {
        data.amazonData[key] = [...new Set(matches.map(m => m[1]))];
      }
    }

    // 8. Raw category strings from visible text
    const visibleText = html.replace(/<script[\s\S]*?<\/script>/gi, '')
                            .replace(/<style[\s\S]*?<\/style>/gi, '')
                            .replace(/<[^>]+>/g, ' ')
                            .replace(/\s+/g, ' ')
                            .substring(0, 50000);
    
    // Look for category-like words
    const categoryKeywords = ['shirt', 'pant', 'dress', 'top', 'bottom', 'skirt', 'jean', 'pant', 'short', 'dress', 'blouse', 'tunic', 'trouser', 'legging', 'leggings', 'activewear', 'sportswear', 'sleepwear', 'swimwear', 'outerwear', 'innerwear', 'lingerie', 'shoe', 'boot', 'sandal', 'slipper', 'sneaker', 'sneakers'];
    for (const kw of categoryKeywords) {
      const regex = new RegExp(`\\b${kw}\\b`, 'gi');
      const matches = visibleText.match(regex);
      if (matches) {
        data.rawCategoryStrings.push({ keyword: kw, count: matches.length, contexts: matches.slice(0, 3).map(m => m.substring(Math.max(0, matches.index - 50), matches.index + 50)) });
      }
    }

  } catch (e) {
    data.error = e.message;
    data.success = false;
  }

  return data;
}

// Scrape single ASIN
async function scrapeAsin(page, asin, marketplace) {
  const url = `https://www.${marketplace}/dp/${asin}`;
  
  try {
    await page.goto(`https://www.${marketplace}/dp/${asin}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    
    // Wait for key elements
    await Promise.all([
      page.waitForSelector('#productTitle, #title', { timeout: 15000 }).catch(() => {}),
      page.waitForSelector('#wayfinding-breadcrumbs_feature_div, #wayfinding-breadcrumbs_container, .a-breadcrumb', { timeout: 10000 }).catch(() => {}),
    ]);
    
    const html = await page.content();
    return { asin, html, url: page.url(), success: true };
  } catch (err) {
    return { asin, error: err.message, success: false };
  }
}

// Main
async function main() {
  const asins = readAsins(input);
  console.log(`Loaded ${asins.length} ASINs from ${input}`);
  
  const browser = await chromium.launch({ headless: headless !== false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-IN',
    viewport: { width: 1280, height: 720 },
  });

  const results = [];
  const queue = [...asins];
  const running = new Set();

  async function processQueue() {
    while (queue.length > 0 || running.size > 0) {
      while (running.size < concurrency && queue.length > 0) {
        const asin = queue.shift();
        const task = (async () => {
          const page = await context.newPage();
          const result = await scrapeAsin(page, asin, marketplace);
          await page.close();
          
          if (result.success) {
            const extracted = extractAllCategoryData(result.html, result.url);
            extracted.asin = asin;
            results.push(extracted);
            console.log(`✅ ${asin}: ${extracted.amazonData.glProductGroup ? extracted.amazonData.glProductGroup.join(', ') : 'no glProductGroup'} | ${extracted.amazonData.category ? extracted.amazonData.category.join(', ') : 'no category'} | ${extracted.breadcrumbs.length} breadcrumbs`);
          } else {
            results.push({ asin, success: false, error: result.error });
            console.log(`❌ ${asin}: ${result.error}`);
          }
        })().finally(() => running.delete(asin));
      
      running.add(asin);
      await task;
    };
    
    // Wait for all running to complete
    while (running.size > 0) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  await processQueue();
  await context.close();
  await browser.close();

  // Export to Excel with multiple sheets
  const wb = XLSX.utils.book_new();
  
  // Sheet 1: Summary
  const summary = results.map(r => ({
    ASIN: r.asin,
    Title: r.title,
    URL: r.url,
    Success: r.success,
    Error: r.error,
    GL_ProductGroup: r.amazonData.glProductGroup?.join('; ') || '',
    Category: r.amazonData.category?.join('; ') || '',
    CategoryPath: r.amazonData.categoryPath?.join('; ') || '',
    BrowseNodeIds: r.amazonData.browseNodeId?.join('; ') || '',
    ProductGroup: r.amazonData.productGroup?.join('; ') || '',
    ProductType: r.amazonData.productType?.join('; ') || '',
    Department: r.amazonData.department?.join('; ') || '',
    GLProductGroup: r.amazonData.glProductGroup?.join('; ') || '',
    GLProductGroupAlt: r.amazonData.glProductGroupAlt?.join('; ') || '',
    Breadcrumbs: r.breadcrumbs.join(' > '),
    BreadcrumbSelectors: JSON.stringify(r.breadcrumbSelectors),
    MetaTags: JSON.stringify(r.metaTags),
    ScriptDataKeys: Object.keys(r.scriptData).join(', '),
    RawCategoryKeywords: r.rawCategoryStrings.map(k => `${k.keyword}(${k.count})`).join(', '),
    Error: r.error || '',
  }));
  
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Summary');

  // Sheet 2: All extracted patterns (one row per match)
  const patternRows = [];
  for (const r of results) {
    for (const [key, values] of Object.entries(r.amazonData)) {
      for (const v of values) {
        patternRows.push({ ASIN: r.asin, Pattern: key, Value: v });
      }
    }
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(patternRows), 'All_Patterns');

  // Sheet 3: JSON-LD structured data
  const jsonldRows = [];
  for (const r of results) {
    for (const j of r.jsonLd) {
      jsonldRows.push({ ASIN: r.asin, JSON_LD: JSON.stringify(j) });
    }
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(jsonldRows), 'JSON_LD');

  // Sheet 4: Meta tags
  const metaRows = [];
  for (const r of results) {
    for (const [key, value] of Object.entries(r.metaTags)) {
      metaRows.push({ ASIN: r.asin, MetaName: key, Content: value });
    }
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(metaRows), 'Meta_Tags');

  // Sheet 5: Breadcrumbs
  const breadcrumbRows = [];
  for (const r of results) {
    for (const b of r.breadcrumbs) {
      breadcrumbRows.push({ ASIN: r.asin, Breadcrumb: b });
    }
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(breadcrumbRows), 'Breadcrumbs');

  XLSX.writeFile(wb, output);
  
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });

