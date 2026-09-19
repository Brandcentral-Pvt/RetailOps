/**
 * Keyword Research → XLSX.
 *
 * The UI already holds the full result payload (it renders it), so export is a
 * pure formatting step: the browser posts the dataset it is showing and gets a
 * workbook back. No upstream API call is made, nothing is written to disk, and
 * the numbers in the file are the numbers on the screen.
 *
 * Exports are gated by `keywords_export` at the route level.
 */

const ExcelJS = require('exceljs');

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1349C6' } };
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
const TITLE_FONT = { bold: true, size: 14, color: { argb: 'FF0F172A' } };
const MUTED_FONT = { italic: true, size: 9, color: { argb: 'FF64748B' } };

const CURRENCY_FMT = '₹#,##0.00';
const INT_FMT = '#,##0';
const PCT_FMT = '0.0"%"';

const isNum = (v) => v !== null && v !== undefined && v !== '' && !Number.isNaN(Number(v));
const n = (v, d = 2) => (isNum(v) ? Number(Number(v).toFixed(d)) : null);
const s = (v) => (v === null || v === undefined ? '' : String(v));

function sanitizeSheetName(name) {
  return String(name).replace(/[\\/*?:[\]]/g, '-').slice(0, 31);
}

/** Add a titled sheet with a styled, frozen header row and auto-filter. */
function addTable(workbook, title, columns, rows, { freeze = true, autoFilter = true } = {}) {
  const sheet = workbook.addWorksheet(sanitizeSheetName(title));
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width || 16, style: c.style }));
  rows.forEach((row) => sheet.addRow(row));

  const header = sheet.getRow(1);
  header.font = HEADER_FONT;
  header.fill = HEADER_FILL;
  header.height = 18;
  header.alignment = { vertical: 'middle' };
  if (freeze) sheet.views = [{ state: 'frozen', ySplit: 1 }];
  if (autoFilter && rows.length > 0) {
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  }
  columns.forEach((c, i) => {
    if (c.style && c.style.numFmt) {
      const letter = sheet.getColumn(i + 1).letter;
      for (let r = 2; r <= rows.length + 1; r += 1) sheet.getCell(`${letter}${r}`).numFmt = c.style.numFmt;
    }
  });
  return sheet;
}

function addKeyValueSheet(workbook, title, pairs, notes = []) {
  const sheet = workbook.addWorksheet(sanitizeSheetName(title));
  sheet.columns = [{ header: 'Metric', key: 'k', width: 34 }, { header: 'Value', key: 'v', width: 52 }];
  const header = sheet.getRow(1);
  header.font = HEADER_FONT;
  header.fill = HEADER_FILL;
  pairs.forEach(([k, v]) => sheet.addRow({ k, v: isNum(v) ? Number(v) : s(v) }));
  if (notes.length) {
    sheet.addRow({});
    notes.forEach((note) => {
      const row = sheet.addRow({ k: '', v: note });
      row.font = MUTED_FONT;
    });
  }
  return sheet;
}

const PRODUCT_COLUMNS = [
  { header: 'Keyword', key: 'keyword', width: 24 },
  { header: 'Position', key: 'position', width: 9 },
  { header: 'ASIN', key: 'asin', width: 13 },
  { header: 'Title', key: 'title', width: 60 },
  { header: 'Brand', key: 'brand', width: 20 },
  { header: 'In our catalog', key: 'inCatalog', width: 14 },
  { header: 'Our seller', key: 'ourSeller', width: 20 },
  { header: 'Price', key: 'price', width: 13, style: { numFmt: CURRENCY_FMT } },
  { header: 'MRP', key: 'mrp', width: 13, style: { numFmt: CURRENCY_FMT } },
  { header: 'Discount %', key: 'discountPercent', width: 12, style: { numFmt: PCT_FMT } },
  { header: 'Rating', key: 'rating', width: 9 },
  { header: 'Reviews', key: 'reviewCount', width: 11, style: { numFmt: INT_FMT } },
  { header: 'Main BSR', key: 'mainBSR', width: 11, style: { numFmt: INT_FMT } },
  { header: 'Sub BSR', key: 'subBSR', width: 11, style: { numFmt: INT_FMT } },
  { header: 'Seller', key: 'seller', width: 24 },
  { header: 'Amazon seller id', key: 'sellerId', width: 18 },
  { header: 'Availability', key: 'availability', width: 18 },
  { header: 'Condition', key: 'condition', width: 12 },
  { header: 'Category', key: 'category', width: 22 },
  { header: 'Buy box', key: 'buyBox', width: 10 },
  { header: 'Our price', key: 'ourPrice', width: 13, style: { numFmt: CURRENCY_FMT } },
  { header: 'Our price vs market %', key: 'ourPriceVsMarket', width: 18, style: { numFmt: PCT_FMT } },
  { header: 'Missing title terms', key: 'missingTerms', width: 40 },
  { header: 'URL', key: 'url', width: 46 },
];

function productRow(item, keyword) {
  const ours = (item.ourListings || [])[0] || null;
  return {
    keyword: keyword || '',
    position: item.position ?? null,
    asin: item.asin || '',
    title: item.title || '',
    brand: item.brand || '',
    inCatalog: item.inCatalog ? 'YES' : 'no',
    ourSeller: ours?.sellerName || '',
    price: n(item.price),
    mrp: n(item.mrp),
    discountPercent: n(item.discountPercent, 1),
    rating: n(item.rating, 2),
    reviewCount: n(item.reviewCount, 0),
    mainBSR: n(item.mainBSR, 0),
    subBSR: n(item.subBSR, 0),
    seller: item.seller || '',
    sellerId: item.sellerId || '',
    availability: item.availability || '',
    condition: item.condition || '',
    category: item.category || '',
    buyBox: item.isBuyBoxWinner ? 'yes' : '',
    ourPrice: n(ours?.price),
    ourPriceVsMarket: n(ours?.priceVsMarketMedianPct, 1),
    missingTerms: (ours?.missingTerms || []).map((t) => t.term).join(', '),
    url: item.detailPageURL || '',
  };
}

function addProductsSheet(workbook, rows) {
  return addTable(workbook, 'Products', PRODUCT_COLUMNS, rows);
}

/* ─────────────────────────── single keyword ─────────────────────────── */

function buildSingle(workbook, dataset, label) {
  const keyword = dataset.keyword || label || '';
  const market = dataset.market || {};
  const sample = market.sample || {};
  const catalogSummary = dataset.catalog?.summary || {};
  const insights = dataset.insights?.insights || [];

  addKeyValueSheet(workbook, 'Summary', [
    ['Keyword', keyword],
    ['Marketplace', dataset.raw?.marketplace || 'www.amazon.in'],
    ['Reported total results', sample.totalResultCount ?? ''],
    ['Products analysed (sample)', sample.products ?? 0],
    ['Listings with a price', sample.priced ?? 0],
    ['Listings with a rating', sample.rated ?? 0],
    ['Listings with a sales rank', sample.ranked ?? 0],
    ['Opportunity score (0–100)', market.opportunity?.score ?? ''],
    ['Opportunity band', market.opportunity?.band || ''],
    ['Median price', n(market.price?.median, 0)],
    ['Price range', isNum(market.price?.min) ? `${Math.round(market.price.min)} – ${Math.round(market.price.max)}` : ''],
    ['Average discount %', n(market.price?.avgDiscountPct, 1)],
    ['Average rating', n(market.ratings?.avg, 2)],
    ['Review-weighted rating', n(market.ratings?.weightedAvg, 2)],
    ['Total reviews in sample', n(market.ratings?.totalReviews, 0)],
    ['Top 3 share of reviews %', n(market.ratings?.reviewMoat?.top3Share, 1)],
    ['Median sales rank', n(market.bsr?.median, 0)],
    ['Distinct brands', market.brands?.unique ?? ''],
    ['Leading brand', market.brands?.topBrand?.brand || ''],
    ['Leading brand share %', n(market.brands?.topShare, 1)],
    ['Distinct sellers', market.sellers?.unique ?? ''],
    ['Out-of-stock share %', n(market.sellers?.outOfStockShare, 1)],
    ['Your listings in this result', catalogSummary.matchedCount ?? 0],
    ['Your best position', catalogSummary.bestPosition ?? '—'],
    ['Your avg price vs market median %', n(catalogSummary.avgPriceVsMarketPct, 1)],
    ['Catalog data available', dataset.raw?.catalogAvailable === false ? 'no' : 'yes'],
    ['Served from cache', dataset.raw?.cached ? 'yes' : 'no'],
  ], [
    'Sample note: the upstream API returns one page of results, so every statistic above describes that page — not the whole keyword.',
    market.opportunity?.disclaimer ? `Score: ${market.opportunity.disclaimer}` : '',
  ].filter(Boolean));

  addProductsSheet(workbook, (dataset.items || []).map((i) => productRow(i, keyword)));

  if (insights.length) {
    addTable(workbook, 'Insights', [
      { header: 'Tone', key: 'tone', width: 10 },
      { header: 'Priority', key: 'priority', width: 10 },
      { header: 'Signal', key: 'title', width: 60 },
      { header: 'What it means', key: 'detail', width: 100 },
      { header: 'Metrics', key: 'metrics', width: 60 },
    ], insights.map((i) => ({
      tone: i.tone,
      priority: i.priority,
      title: i.title,
      detail: i.detail,
      metrics: Object.entries(i.metrics || {}).map(([k, v]) => `${k}: ${v}`).join(' · '),
    })));
  }

  const ourListings = (dataset.catalog?.rows || []).flatMap((row) => (row.ourListings || []).map((l) => ({ ...l, asin: row.asin, marketPrice: row.price, position: row.position })));
  if (ourListings.length) {
    addTable(workbook, 'Your Catalog', [
      { header: 'ASIN', key: 'asin', width: 13 },
      { header: 'Market position', key: 'position', width: 14 },
      { header: 'Seller', key: 'sellerName', width: 22 },
      { header: 'SKU', key: 'sku', width: 18 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Stock', key: 'stockLevel', width: 10, style: { numFmt: INT_FMT } },
      { header: 'Our price', key: 'price', width: 13, style: { numFmt: CURRENCY_FMT } },
      { header: 'Market price', key: 'marketPrice', width: 13, style: { numFmt: CURRENCY_FMT } },
      { header: 'Vs market %', key: 'priceVsMarketMedianPct', width: 13, style: { numFmt: PCT_FMT } },
      { header: 'Our rating', key: 'rating', width: 11 },
      { header: 'Our reviews', key: 'reviewCount', width: 12, style: { numFmt: INT_FMT } },
      { header: 'Reviews behind top 3', key: 'reviewGapToTop3', width: 18, style: { numFmt: INT_FMT } },
      { header: 'BSR', key: 'bsr', width: 11, style: { numFmt: INT_FMT } },
      { header: 'LQS', key: 'lqs', width: 9 },
      { header: 'Buy box', key: 'buyBoxWin', width: 10 },
      { header: 'Missing title terms', key: 'missingTerms', width: 40 },
    ], ourListings.map((l) => ({
      ...l,
      buyBoxWin: l.buyBoxWin ? 'yes' : 'no',
      missingTerms: (l.missingTerms || []).map((t) => t.term).join(', '),
    })));
  }

  addTable(workbook, 'Price Bands', [
    { header: 'Band', key: 'label', width: 18 },
    { header: 'Listings', key: 'count', width: 10, style: { numFmt: INT_FMT } },
    { header: 'Share %', key: 'share', width: 10, style: { numFmt: PCT_FMT } },
    { header: 'Avg rating', key: 'avgRating', width: 11 },
    { header: 'Median reviews', key: 'medianReviews', width: 14, style: { numFmt: INT_FMT } },
    { header: 'Avg BSR', key: 'avgBsr', width: 12, style: { numFmt: INT_FMT } },
  ], (market.price?.bands || []).map((b) => ({ ...b, share: n(b.share, 1) })));

  addTable(workbook, 'Brands', [
    { header: 'Brand', key: 'brand', width: 26 },
    { header: 'Listings', key: 'count', width: 10, style: { numFmt: INT_FMT } },
    { header: 'Share %', key: 'countShare', width: 10, style: { numFmt: PCT_FMT } },
    { header: 'Reviews', key: 'reviews', width: 12, style: { numFmt: INT_FMT } },
    { header: 'Review share %', key: 'reviewShare', width: 14, style: { numFmt: PCT_FMT } },
    { header: 'Avg price', key: 'avgPrice', width: 13, style: { numFmt: CURRENCY_FMT } },
    { header: 'Avg rating', key: 'avgRating', width: 11 },
    { header: 'Best BSR', key: 'bestBsr', width: 12, style: { numFmt: INT_FMT } },
  ], (market.brands?.rows || []).map((b) => ({ ...b, countShare: n(b.countShare, 1), reviewShare: n(b.reviewShare, 1) })));

  const terms = [
    ...(market.terms?.trigrams || []).map((t) => ({ ...t, kind: '3-word' })),
    ...(market.terms?.bigrams || []).map((t) => ({ ...t, kind: '2-word' })),
    ...(market.terms?.words || []).map((t) => ({ ...t, kind: 'word' })),
  ];
  if (terms.length) {
    addTable(workbook, 'Search Terms', [
      { header: 'Term', key: 'term', width: 34 },
      { header: 'Type', key: 'kind', width: 10 },
      { header: 'Titles', key: 'count', width: 10, style: { numFmt: INT_FMT } },
      { header: 'Share %', key: 'share', width: 10, style: { numFmt: PCT_FMT } },
    ], terms.map((t) => ({ ...t, share: n(t.share, 1) })));
  }

  return workbook;
}

/* ─────────────────────────── batch / compare ─────────────────────────── */

function buildBatch(workbook, dataset, label) {
  const results = dataset.results || [];

  addKeyValueSheet(workbook, 'Summary', [
    ['Report', 'Keyword batch comparison'],
    ['Label', label || ''],
    ['Keywords', results.length],
    ['Failed keywords', (dataset.meta?.failed ?? results.filter((r) => r.error).length) || 0],
    ['Served from cache', dataset.meta?.cached ?? 0],
    ['Fresh upstream calls', dataset.meta?.fresh ?? ''],
    ['Elapsed (seconds)', isNum(dataset.meta?.elapsedMs) ? Number((dataset.meta.elapsedMs / 1000).toFixed(1)) : ''],
  ], ['One row per keyword below; the Products sheet carries every listing with its keyword.']);

  addTable(workbook, 'Keywords', [
    { header: 'Keyword', key: 'keyword', width: 26 },
    { header: 'Products', key: 'products', width: 10, style: { numFmt: INT_FMT } },
    { header: 'Opportunity', key: 'opportunity', width: 12 },
    { header: 'Band', key: 'band', width: 11 },
    { header: 'Median price', key: 'medianPrice', width: 13, style: { numFmt: CURRENCY_FMT } },
    { header: 'Avg discount %', key: 'avgDiscount', width: 14, style: { numFmt: PCT_FMT } },
    { header: 'Avg rating', key: 'avgRating', width: 11 },
    { header: 'Median reviews', key: 'medianReviews', width: 14, style: { numFmt: INT_FMT } },
    { header: 'Median BSR', key: 'medianBsr', width: 12, style: { numFmt: INT_FMT } },
    { header: 'Top-3 review share %', key: 'top3Share', width: 18, style: { numFmt: PCT_FMT } },
    { header: 'Leading brand', key: 'topBrand', width: 22 },
    { header: 'Our listings', key: 'ourListings', width: 12, style: { numFmt: INT_FMT } },
    { header: 'Our best position', key: 'bestPosition', width: 15, style: { numFmt: INT_FMT } },
    { header: 'Error', key: 'error', width: 30 },
  ], results.map((r) => ({
    keyword: r.keyword,
    products: r.market?.sample?.products ?? 0,
    opportunity: r.market?.opportunity?.score ?? '',
    band: r.market?.opportunity?.band || '',
    medianPrice: n(r.market?.price?.median, 0),
    avgDiscount: n(r.market?.price?.avgDiscountPct, 1),
    avgRating: n(r.market?.ratings?.avg, 2),
    medianReviews: n(r.market?.ratings?.medianReviews, 0),
    medianBsr: n(r.market?.bsr?.median, 0),
    top3Share: n(r.market?.ratings?.reviewMoat?.top3Share, 1),
    topBrand: r.market?.brands?.topBrand?.brand || '',
    ourListings: r.catalog?.summary?.matchedCount ?? 0,
    bestPosition: r.catalog?.summary?.bestPosition ?? '',
    error: r.error || '',
  })));

  addProductsSheet(workbook, results.flatMap((r) => (r.items || []).map((i) => productRow(i, r.keyword))));

  const insightRows = results.flatMap((r) => (r.insights?.insights || []).map((i) => ({ keyword: r.keyword, ...i })));
  if (insightRows.length) {
    addTable(workbook, 'Insights', [
      { header: 'Keyword', key: 'keyword', width: 22 },
      { header: 'Tone', key: 'tone', width: 10 },
      { header: 'Priority', key: 'priority', width: 10 },
      { header: 'Signal', key: 'title', width: 60 },
      { header: 'What it means', key: 'detail', width: 100 },
    ], insightRows.map((i) => ({ keyword: i.keyword, tone: i.tone, priority: i.priority, title: i.title, detail: i.detail })));
  }

  const ourListings = results.flatMap((r) => (r.catalog?.rows || []).flatMap((row) => (row.ourListings || []).map((l) => ({ ...l, keyword: r.keyword, asin: row.asin }))));
  if (ourListings.length) {
    addTable(workbook, 'Your Catalog', [
      { header: 'Keyword', key: 'keyword', width: 22 },
      { header: 'ASIN', key: 'asin', width: 13 },
      { header: 'Seller', key: 'sellerName', width: 22 },
      { header: 'SKU', key: 'sku', width: 18 },
      { header: 'Stock', key: 'stockLevel', width: 10, style: { numFmt: INT_FMT } },
      { header: 'Our price', key: 'price', width: 13, style: { numFmt: CURRENCY_FMT } },
      { header: 'Our reviews', key: 'reviewCount', width: 12, style: { numFmt: INT_FMT } },
      { header: 'Missing title terms', key: 'missingTerms', width: 40 },
    ], ourListings.map((l) => ({
      ...l,
      missingTerms: (l.missingTerms || []).map((t) => t.term).join(', '),
    })));
  }

  return workbook;
}

/* ─────────────────────────── AI analysis ─────────────────────────── */

function buildAnalysis(workbook, dataset) {
  const analysis = dataset.analysis || {};
  const keyword = dataset.keyword || '';

  addKeyValueSheet(workbook, 'Summary', [
    ['Seed keyword', keyword],
    ['Best opportunity', analysis.summary?.bestOpportunity || ''],
    ['Strategy', analysis.summary?.strategy || ''],
    ['Suggested keywords', (analysis.suggestedKeywords || []).length],
    ['Gap categories', (analysis.keywordGaps || []).length],
    ['Trending terms', (analysis.trendingTerms || []).length],
    ['Products analysed', dataset.market?.sample?.products ?? (dataset.items || []).length],
    ['Opportunity score (0–100)', dataset.market?.opportunity?.score ?? ''],
    ['Source', dataset.source || 'AI analysis'],
  ], ['Deterministic market statistics and catalog flags are attached to this export; the AI sections are model output and should be treated as suggestions.']);

  addTable(workbook, 'AI Keywords', [
    { header: 'Keyword', key: 'keyword', width: 34 },
    { header: 'Type', key: 'type', width: 10 },
    { header: 'Volume', key: 'searchVolume', width: 12 },
    { header: 'Competition', key: 'competition', width: 13 },
    { header: 'Opportunity', key: 'opportunityScore', width: 12, style: { numFmt: INT_FMT } },
    { header: 'Rationale', key: 'rationale', width: 80 },
  ], (analysis.suggestedKeywords || []).map((k) => ({
    keyword: k.keyword, type: k.type, searchVolume: k.searchVolume, competition: k.competition,
    opportunityScore: n(k.opportunityScore, 0), rationale: k.rationale,
  })));

  if ((analysis.keywordGaps || []).length) {
    addTable(workbook, 'Gaps', [
      { header: 'Category', key: 'category', width: 26 },
      { header: 'Missing keywords', key: 'missing', width: 90 },
    ], analysis.keywordGaps.map((g) => ({ category: g.category || 'General', missing: (g.missingKeywords || []).join(', ') })));
  }

  if ((analysis.categoryOpportunities || []).length) {
    addTable(workbook, 'Categories', [
      { header: 'Category', key: 'category', width: 26 },
      { header: 'Suggested keywords', key: 'suggested', width: 90 },
    ], analysis.categoryOpportunities.map((c) => ({ category: c.category, suggested: (c.suggestedKeywords || []).join(', ') })));
  }

  if ((analysis.trendingTerms || []).length) {
    addTable(workbook, 'Trending', [{ header: 'Term', key: 'term', width: 40 }], analysis.trendingTerms.map((t) => ({ term: t })));
  }

  if ((dataset.items || []).length) {
    addProductsSheet(workbook, dataset.items.map((i) => productRow(i, keyword)));
  }

  return workbook;
}

async function buildWorkbook({ kind = 'single', dataset = {}, label = '', scope } = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'RetailOps';
  workbook.created = new Date();
  workbook.properties.date1904 = false;

  const meta = workbook.addWorksheet('_meta');
  meta.addRow(['Generated', new Date().toISOString()]);
  meta.addRow(['Kind', kind]);
  meta.addRow(['Seller scope', scope?.isGlobal ? 'all sellers (global role)' : (scope?.sellerIds || []).join(', ') || 'none']);
  meta.getRow(1).font = MUTED_FONT;
  meta.getRow(2).font = MUTED_FONT;
  meta.getRow(3).font = MUTED_FONT;
  meta.state = 'veryHidden';

  if (kind === 'batch') buildBatch(workbook, dataset, label);
  else if (kind === 'analysis') buildAnalysis(workbook, dataset, label);
  else buildSingle(workbook, dataset, label);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function fileName({ kind = 'single', label = '' } = {}) {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const safeLabel = String(label || kind).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  return `keyword-research-${safeLabel || 'export'}-${stamp}.xlsx`;
}

module.exports = { buildWorkbook, fileName, PRODUCT_COLUMNS };
