/**
 * Keyword analytics — everything the Keyword Research module derives from a
 * live product-search result set, plus the link to our own catalog.
 *
 * Design notes
 *  - The upstream data is a *snapshot* of one search page (10–50 products), so
 *    every function here reports its own sample size and refuses to over-claim:
 *    `sample: { products, priced, rated, ranked }` travels with the numbers and
 *    the UI prints "—" instead of a fabricated statistic.
 *  - No persistence: the module caches snapshots in memory (keywordCache.js)
 *    but never writes to the database, so nothing here is stateful.
 *  - Pure functions first (`computeMarketAnalytics`, `buildInsights`,
 *    `linkCatalog`) so they can be unit-tested without a pool; the only I/O in
 *    this file is `fetchCatalogMatches`, which reads Asins/Sellers under the
 *    caller's seller scope.
 */

const { sql } = require('../database/db');
const { bindSellerFilter } = require('../utils/sellerScope');

const round = (v, d = 0) => (v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(Number(v).toFixed(d)));
const num = (v) => (v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));
const isNum = (v) => v !== null && v !== undefined && !Number.isNaN(Number(v));
const median = (arr) => {
  const a = arr.filter(isNum).map(Number).sort((x, y) => x - y);
  if (a.length === 0) return null;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
};
const mean = (arr) => {
  const a = arr.filter(isNum).map(Number);
  return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
};
const percentile = (arr, p) => {
  const a = arr.filter(isNum).map(Number).sort((x, y) => x - y);
  if (a.length === 0) return null;
  const idx = Math.min(a.length - 1, Math.max(0, Math.ceil((p / 100) * a.length) - 1));
  return a[idx];
};
const share = (part, whole) => (isNum(whole) && Number(whole) > 0 ? (Number(part) / Number(whole)) * 100 : null);
const norm = (w) => String(w || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'you', 'your', 'are', 'was', 'were', 'has', 'have', 'had',
  'not', 'but', 'all', 'can', 'will', 'one', 'two', 'set', 'new', 'pack', 'pcs', 'piece', 'pieces', 'inch', 'cm',
  'mm', 'kg', 'gm', 'ml', 'ltr', 'size', 'color', 'colour', 'free', 'best', 'buy', 'online', 'india', 'amazon',
  'shipping', 'offer', 'offers', 'price', 'piece', 'without', 'includes', 'include', 'made', 'use', 'used', 'using',
]);

const PRICE_BANDS = [
  { key: 'band_0_250', label: '≤ ₹250', max: 250 },
  { key: 'band_250_500', label: '₹251–500', max: 500 },
  { key: 'band_500_1000', label: '₹501–1,000', max: 1000 },
  { key: 'band_1000_2000', label: '₹1,001–2,000', max: 2000 },
  { key: 'band_2000_5000', label: '₹2,001–5,000', max: 5000 },
  { key: 'band_5000_plus', label: '₹5,000+', max: Infinity },
];

const RATING_BANDS = [
  { key: 'r_lt_3', label: '< 3.0', test: (r) => r < 3 },
  { key: 'r_3_4', label: '3.0–4.0', test: (r) => r >= 3 && r < 4 },
  { key: 'r_4_45', label: '4.0–4.5', test: (r) => r >= 4 && r < 4.5 },
  { key: 'r_45_plus', label: '4.5+', test: (r) => r >= 4.5 },
];

/** Extract single words / bigrams / trigrams from titles, ignoring boilerplate. */
function extractTerms(titles = [], { limit = 15 } = {}) {
  const single = new Map();
  const bigram = new Map();
  const trigram = new Map();

  const bump = (map, key) => map.set(key, (map.get(key) || 0) + 1);

  for (const title of titles) {
    const tokens = norm(title).split(' ').filter((t) => t && t.length > 2 && !STOP_WORDS.has(t) && !/^\d+$/.test(t));
    tokens.forEach((t) => bump(single, t));
    for (let i = 0; i < tokens.length - 1; i += 1) bump(bigram, `${tokens[i]} ${tokens[i + 1]}`);
    for (let i = 0; i < tokens.length - 2; i += 1) bump(trigram, `${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`);
  }

  // A term has to appear in more than one title to mean anything about the market.
  const top = (map, n) => [...map.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([term, count]) => ({ term, count, share: share(count, titles.length) }));

  return { words: top(single, limit), bigrams: top(bigram, Math.ceil(limit / 2)), trigrams: top(trigram, Math.ceil(limit / 3)) };
}

/**
 * Derive the market picture for one keyword's result page.
 * @param {Array} items  items from keywordResearchService.searchItems()
 * @param {{keyword?: string, totalResultCount?: number}} [context]
 */
function computeMarketAnalytics(items = [], context = {}) {
  const products = items || [];
  const prices = products.map((p) => num(p.price)).filter(isNum);
  const mrps = products.map((p) => num(p.mrp)).filter(isNum);
  const ratings = products.map((p) => num(p.rating)).filter(isNum);
  const reviews = products.map((p) => num(p.reviewCount)).filter(isNum);
  const bsrs = products.map((p) => num(p.mainBSR)).filter(isNum);

  const sample = {
    products: products.length,
    priced: prices.length,
    rated: ratings.length,
    ranked: bsrs.length,
    totalResultCount: num(context.totalResultCount) ?? products.length,
    keyword: context.keyword || null,
  };

  /* ── price ─────────────────────────────────────────────────────────── */
  const bands = PRICE_BANDS.map((band, i) => {
    const lower = i === 0 ? 0 : PRICE_BANDS[i - 1].max;
    const members = products.filter((p) => isNum(p.price) && Number(p.price) > (i === 0 ? -1 : lower) && Number(p.price) <= band.max);
    const bandPrices = members.map((m) => Number(m.price));
    return {
      key: band.key,
      label: band.label,
      count: members.length,
      share: share(members.length, prices.length),
      avgRating: round(mean(members.map((m) => num(m.rating))), 2),
      medianReviews: round(median(members.map((m) => num(m.reviewCount))), 0),
      avgBsr: round(mean(members.map((m) => num(m.mainBSR))), 0),
      cheapest: bandPrices.length ? Math.min(...bandPrices) : null,
      dearest: bandPrices.length ? Math.max(...bandPrices) : null,
    };
  });

  const discounts = products.map((p) => num(p.discountPercent)).filter(isNum);
  const priceStats = {
    min: prices.length ? Math.min(...prices) : null,
    max: prices.length ? Math.max(...prices) : null,
    mean: round(mean(prices), 0),
    median: round(median(prices), 0),
    p25: round(percentile(prices, 25), 0),
    p75: round(percentile(prices, 75), 0),
    avgMrp: round(mean(mrps), 0),
    avgDiscountPct: round(mean(discounts), 1),
    discountedShare: share(products.filter((p) => isNum(p.discountPercent) && Number(p.discountPercent) > 0).length, prices.length),
    bands,
  };

  /* ── ratings & the review moat ─────────────────────────────────────── */
  const byReviews = [...products].filter((p) => isNum(p.reviewCount)).sort((a, b) => Number(b.reviewCount) - Number(a.reviewCount));
  const totalReviews = reviews.reduce((s, r) => s + r, 0);
  const top3Reviews = byReviews.slice(0, 3).reduce((s, p) => s + Number(p.reviewCount), 0);
  const reviewWeightedRating = totalReviews > 0
    ? round(products.reduce((s, p) => s + (isNum(p.rating) && isNum(p.reviewCount) ? Number(p.rating) * Number(p.reviewCount) : 0), 0) / totalReviews, 2)
    : null;

  const ratingStats = {
    avg: round(mean(ratings), 2),
    weightedAvg: reviewWeightedRating,
    totalReviews,
    medianReviews: round(median(reviews), 0),
    distribution: RATING_BANDS.map((band) => {
      const members = products.filter((p) => isNum(p.rating) && band.test(Number(p.rating)));
      return { key: band.key, label: band.label, count: members.length, share: share(members.length, ratings.length) };
    }),
    reviewMoat: {
      top3Reviews,
      top3Share: share(top3Reviews, totalReviews),
      leader: byReviews[0] ? { asin: byReviews[0].asin, title: byReviews[0].title, reviews: num(byReviews[0].reviewCount), rating: num(byReviews[0].rating) } : null,
    },
    weakListingShare: share(products.filter((p) => (isNum(p.rating) && Number(p.rating) < 4) || (isNum(p.reviewCount) && Number(p.reviewCount) < 50)).length, products.length),
  };

  /* ── sales-rank proxy ──────────────────────────────────────────────── */
  const bsrStats = {
    median: round(median(bsrs), 0),
    best: bsrs.length ? Math.min(...bsrs) : null,
    worst: bsrs.length ? Math.max(...bsrs) : null,
    top10kShare: share(bsrs.filter((b) => b <= 10000).length, bsrs.length),
    top50kShare: share(bsrs.filter((b) => b <= 50000).length, bsrs.length),
  };

  /* ── brands ────────────────────────────────────────────────────────── */
  const brandMap = new Map();
  for (const p of products) {
    const brand = (p.brand || '').trim() || '(unbranded)';
    const entry = brandMap.get(brand) || { brand, count: 0, reviews: 0, prices: [], ratings: [], bsrs: [] };
    entry.count += 1;
    if (isNum(p.reviewCount)) entry.reviews += Number(p.reviewCount);
    if (isNum(p.price)) entry.prices.push(Number(p.price));
    if (isNum(p.rating)) entry.ratings.push(Number(p.rating));
    if (isNum(p.mainBSR)) entry.bsrs.push(Number(p.mainBSR));
    brandMap.set(brand, entry);
  }
  const brandRows = [...brandMap.values()].map((b) => ({
    brand: b.brand,
    count: b.count,
    countShare: share(b.count, products.length),
    reviews: b.reviews,
    reviewShare: share(b.reviews, totalReviews),
    avgPrice: round(mean(b.prices), 0),
    avgRating: round(mean(b.ratings), 2),
    bestBsr: b.bsrs.length ? Math.min(...b.bsrs) : null,
  })).sort((a, b) => b.count - a.count || b.reviews - a.reviews);

  const hhi = products.length > 0
    ? Math.round([...brandMap.values()].reduce((s, b) => s + ((b.count / products.length) * 100) ** 2, 0))
    : null;

  const brandStats = {
    unique: brandMap.size,
    hhi,
    topBrand: brandRows[0] || null,
    topShare: brandRows[0] ? brandRows[0].countShare : null,
    top3Share: round(brandRows.slice(0, 3).reduce((s, b) => s + (b.countShare || 0), 0), 1),
    rows: brandRows.slice(0, 12),
  };

  /* ── sellers / fulfilment ──────────────────────────────────────────── */
  const sellerMap = new Map();
  let outOfStock = 0;
  let buyBoxCount = 0;
  for (const p of products) {
    const seller = (p.seller || '').trim() || '(unknown)';
    sellerMap.set(seller, (sellerMap.get(seller) || 0) + 1);
    if (p.isBuyBoxWinner) buyBoxCount += 1;
    if (String(p.availability || '').toLowerCase().includes('out') || String(p.availability || '').toLowerCase().includes('unavailable')) outOfStock += 1;
  }
  const sellerStats = {
    unique: sellerMap.size,
    rows: [...sellerMap.entries()].map(([seller, count]) => ({ seller, count, share: share(count, products.length) })).sort((a, b) => b.count - a.count).slice(0, 10),
    outOfStockShare: share(outOfStock, products.length),
    buyBoxShare: share(buyBoxCount, products.length),
  };

  /* ── titles ────────────────────────────────────────────────────────── */
  const terms = extractTerms(products.map((p) => p.title));

  /* ── composite opportunity score ───────────────────────────────────── */
  const score = opportunityScore({ priceStats, ratingStats, bsrStats, brandStats, sample });

  return {
    sample,
    price: priceStats,
    ratings: ratingStats,
    bsr: bsrStats,
    brands: brandStats,
    sellers: sellerStats,
    terms,
    opportunity: score,
  };
}

/**
 * Deterministic 0–100 opportunity score for a keyword.
 * Weighted blend of four measurable pressures, each normalised to 0–100 where
 * a *higher* number means "easier to win". Components are returned so the UI
 * can show the working instead of a black-box number.
 */
function opportunityScore({ priceStats, ratingStats, bsrStats, brandStats, sample }) {
  const demand = (() => {
    const bsr = bsrStats?.median;
    if (!isNum(bsr)) return { value: null, note: 'no sales-rank data' };
    if (bsr <= 5000) return { value: 92, note: 'median BSR under 5k — proven demand' };
    if (bsr <= 20000) return { value: 78, note: 'median BSR under 20k — healthy demand' };
    if (bsr <= 100000) return { value: 58, note: 'median BSR under 100k — moderate demand' };
    return { value: 34, note: 'median BSR above 100k — thin demand' };
  })();

  const moat = (() => {
    const top3 = ratingStats?.reviewMoat?.top3Share;
    if (!isNum(top3)) return { value: null, note: 'no review data' };
    if (top3 >= 75) return { value: 15, note: 'top 3 listings hold ≥75% of reviews — entrenched' };
    if (top3 >= 60) return { value: 32, note: 'top 3 hold ≥60% of reviews — hard to displace' };
    if (top3 >= 40) return { value: 58, note: 'review spread is contestable' };
    return { value: 82, note: 'reviews are evenly spread — open field' };
  })();

  const concentration = (() => {
    const top = brandStats?.topShare;
    if (!isNum(top)) return { value: null, note: 'no brand data' };
    if (top >= 50) return { value: 20, note: 'one brand dominates the first page' };
    if (top >= 35) return { value: 45, note: 'a leading brand holds a third of the page' };
    if (top >= 20) return { value: 68, note: 'no dominant brand' };
    return { value: 85, note: 'brand mix is fragmented' };
  })();

  const listingQuality = (() => {
    const weak = ratingStats?.weakListingShare;
    if (!isNum(weak)) return { value: null, note: 'no rating data' };
    if (weak >= 50) return { value: 80, note: 'half the page is under 4★ or under 50 reviews' };
    if (weak >= 30) return { value: 62, note: 'a third of the page looks beatable' };
    if (weak >= 15) return { value: 44, note: 'most listings are established' };
    return { value: 28, note: 'the page is well-optimised' };
  })();

  const parts = [demand, moat, concentration, listingQuality].filter((p) => isNum(p.value));
  const weights = { demand: 0.35, moat: 0.3, concentration: 0.2, listingQuality: 0.15 };
  const named = { demand, moat, concentration, listingQuality };

  let total = 0;
  let totalWeight = 0;
  for (const [key, part] of Object.entries(named)) {
    if (!isNum(part.value)) continue;
    total += part.value * weights[key];
    totalWeight += weights[key];
  }
  const scoreValue = totalWeight > 0 ? Math.round(total / totalWeight) : null;

  const band = scoreValue === null ? 'unknown'
    : scoreValue >= 75 ? 'strong'
      : scoreValue >= 55 ? 'workable'
        : scoreValue >= 35 ? 'crowded' : 'avoid';

  return {
    score: scoreValue,
    band,
    components: { demand, moat, concentration, listingQuality },
    coverage: sample?.products || 0,
    disclaimer: 'Composite of four measurable pressures (demand proxy, review moat, brand concentration, listing weakness) — not a search-volume estimate.',
  };
}

/* ─────────────────────────── catalog linking ─────────────────────────── */

/**
 * Read our own listings for a set of ASINs, restricted to the caller's sellers.
 * @returns {Promise<Map<string, Array<object>>>} asin -> our listings
 */
async function fetchCatalogMatches(pool, asins = [], scope) {
  const list = [...new Set((asins || []).filter(Boolean).map(String))].slice(0, 500);
  if (list.length === 0) return new Map();

  const map = new Map();
  const CHUNK = 200;              // keep well under SQL Server's 2,100-parameter ceiling
  for (let i = 0; i < list.length; i += CHUNK) {
    const slice = list.slice(i, i + CHUNK);
    const request = pool.request();
    const placeholders = slice.map((asin, idx) => {
      const name = `kwAsin_${idx}`;
      request.input(name, sql.VarChar, asin);
      return `@${name}`;
    });
    const scopeClause = bindSellerFilter(request, scope, { alias: 'a', prefix: 'kwScope' });

    const result = await request.query(`
      SELECT a.AsinCode, a.Sku, a.Title, a.Brand, a.Category, a.SellerId, s.Name AS SellerName,
             a.Status, a.StockLevel, a.CurrentPrice, a.BSR, a.Rating, a.ReviewCount, a.LQS,
             a.BuyBoxWin, a.ParentAsin, a.ImageUrl, a.BulletPointsText, a.UpdatedAt
      FROM Asins a
      LEFT JOIN Sellers s ON s.Id = a.SellerId
      WHERE a.AsinCode IN (${placeholders.join(', ')})${scopeClause}
    `);

    for (const row of result.recordset || []) {
      const key = String(row.AsinCode);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    }
  }
  return map;
}

/**
 * Attach our own listings (and the gaps against them) to each market ASIN.
 * Pure: takes the map produced by fetchCatalogMatches.
 */
function linkCatalog(items = [], catalogMap = new Map(), market = {}) {
  const marketMedianPrice = market?.price?.median ?? null;
  const marketTop3Reviews = market?.ratings?.reviewMoat?.top3Reviews ?? null;
  const marketTerms = (market?.terms?.bigrams || []).concat(market?.terms?.words || []);

  const rows = (items || []).map((item, index) => {
    const ours = catalogMap.get(String(item.asin)) || [];
    const primary = ours[0] || null;
    const ourTerms = norm(`${primary?.Title || ''} ${primary?.BulletPointsText || ''}`);
    const missingTerms = primary
      ? marketTerms.filter((t) => t.term && !ourTerms.includes(t.term)).slice(0, 8).map((t) => ({ term: t.term, count: t.count }))
      : [];

    return {
      ...item,
      position: index + 1,
      inCatalog: ours.length > 0,
      ourListings: ours.map((o) => ({
        sellerId: o.SellerId,
        sellerName: o.SellerName || o.SellerId,
        sku: o.Sku,
        status: o.Status,
        stockLevel: num(o.StockLevel),
        price: num(o.CurrentPrice),
        bsr: num(o.BSR),
        rating: num(o.Rating),
        reviewCount: num(o.ReviewCount),
        lqs: num(o.LQS),
        buyBoxWin: !!o.BuyBoxWin,
        priceDeltaPct: (isNum(o.CurrentPrice) && isNum(item.price) && Number(item.price) > 0)
          ? ((Number(o.CurrentPrice) - Number(item.price)) / Number(item.price)) * 100
          : null,
        priceVsMarketMedianPct: (isNum(o.CurrentPrice) && isNum(marketMedianPrice) && Number(marketMedianPrice) > 0)
          ? ((Number(o.CurrentPrice) - Number(marketMedianPrice)) / Number(marketMedianPrice)) * 100
          : null,
        reviewGapToTop3: (isNum(o.ReviewCount) && isNum(marketTop3Reviews)) ? Math.max(0, Number(marketTop3Reviews) - Number(o.ReviewCount)) : null,
        missingTerms,
      })),
    };
  });

  const matched = rows.filter((r) => r.inCatalog);
  const sellers = new Map();
  for (const row of matched) {
    for (const listing of row.ourListings) {
      const entry = sellers.get(listing.sellerId) || { sellerId: listing.sellerId, sellerName: listing.sellerName, count: 0, bestPosition: null, prices: [] };
      entry.count += 1;
      entry.bestPosition = entry.bestPosition === null ? row.position : Math.min(entry.bestPosition, row.position);
      if (isNum(listing.price)) entry.prices.push(listing.price);
      sellers.set(listing.sellerId, entry);
    }
  }

  const priceGaps = matched
    .flatMap((r) => r.ourListings.map((l) => l.priceVsMarketMedianPct))
    .filter(isNum);

  return {
    rows,
    summary: {
      matchedCount: matched.length,
      coveragePct: share(matched.length, rows.length),
      bestPosition: matched.length ? Math.min(...matched.map((r) => r.position)) : null,
      sellers: [...sellers.values()].map((s) => ({
        ...s,
        avgPrice: round(mean(s.prices), 0),
      })).sort((a, b) => b.count - a.count),
      avgPriceVsMarketPct: round(mean(priceGaps), 1),
      missingTermCount: [...new Set(matched.flatMap((r) => r.ourListings.flatMap((l) => l.missingTerms.map((t) => t.term))))].length,
    },
  };
}

/* ───────────────────────────── insights ─────────────────────────────── */

const fmtINR = (v) => (isNum(v) ? `₹${Math.round(Number(v)).toLocaleString('en-IN')}` : '—');
const fmtPct = (v, d = 1) => (isNum(v) ? `${Number(v).toFixed(d)}%` : '—');

/**
 * Deterministic rule engine over the derived market picture + the catalog link.
 * Every insight quotes only numbers present in those inputs.
 */
function buildInsights(market, catalog, { keyword, thresholds = {} } = {}) {
  const t = {
    thinSample: 8,
    moatTight: 60,
    weakListings: 30,
    discountWar: 30,
    bandCrowding: 45,
    brandDominance: 35,
    priceGapPct: 10,
    ...thresholds,
  };
  const out = [];
  const push = (i) => out.push({ metrics: {}, ...i });

  const sample = market?.sample || {};
  const products = sample.products || 0;

  if (products < t.thinSample) {
    push({
      id: 'thin-sample', tone: 'warn', priority: 92, target: 'panel-market',
      title: `Only ${products} product${products === 1 ? '' : 's'} in this sample`,
      detail: 'The upstream API returned a short page, so every statistic below is shaky. Widen the filters or re-run before acting on it.',
      metrics: { Products: products, 'Total results reported': isNum(sample.totalResultCount) ? sample.totalResultCount : '—' },
    });
  }

  const moat = market?.ratings?.reviewMoat;
  if (isNum(moat?.top3Share) && moat.top3Share >= t.moatTight) {
    push({
      id: 'review-moat', tone: 'neg', priority: 86, target: 'panel-competition',
      title: `Top 3 listings hold ${fmtPct(moat.top3Share, 0)} of all reviews`,
      detail: `Leader: ${moat.leader?.title ? `${String(moat.leader.title).slice(0, 60)}…` : moat.leader?.asin || 'unknown'} with ${fmtINR(moat.leader?.reviews)} reviews. Entering here means buying visibility against an entrenched review base — expect a long ACoS curve.`,
      metrics: { 'Top-3 reviews': fmtINR(moat.top3Reviews), 'Share of reviews': fmtPct(moat.top3Share, 0), 'Total reviews': fmtINR(market.ratings.totalReviews) },
    });
  } else if (isNum(moat?.top3Share) && moat.top3Share < 40) {
    push({
      id: 'open-field', tone: 'pos', priority: 78, target: 'panel-competition',
      title: 'Reviews are evenly spread — no entrenched leader',
      detail: `The top 3 listings hold only ${fmtPct(moat.top3Share, 0)} of ${fmtINR(market.ratings.totalReviews)} reviews. A well-ranked listing with strong imagery can move up without out-reviewing anyone.`,
      metrics: { 'Top-3 share': fmtPct(moat.top3Share, 0), 'Median reviews': fmtINR(market.ratings.medianReviews) },
    });
  }

  if (isNum(market?.ratings?.weakListingShare) && market.ratings.weakListingShare >= t.weakListings) {
    push({
      id: 'weak-listings', tone: 'pos', priority: 74, target: 'panel-competition',
      title: `${fmtPct(market.ratings.weakListingShare, 0)} of the page is under 4★ or under 50 reviews`,
      detail: 'These are the listings a better title, better images and an A+ page can outrank. Target the mid-page, not the leader.',
      metrics: { 'Average rating': market.ratings.avg ?? '—', 'Weighted rating': market.ratings.weightedAvg ?? '—' },
    });
  }

  if (isNum(market?.price?.avgDiscountPct) && market.price.avgDiscountPct >= t.discountWar) {
    push({
      id: 'discount-war', tone: 'warn', priority: 70, target: 'panel-price',
      title: `Average discount is ${fmtPct(market.price.avgDiscountPct)}`,
      detail: `Median price ${fmtINR(market.price.median)} against a median MRP of ${fmtINR(market.price.avgMrp)}. Deep, permanent discounting means margin, not advertising, decides this keyword.`,
      metrics: { 'Avg discount': fmtPct(market.price.avgDiscountPct), 'Median price': fmtINR(market.price.median), 'Discounted listings': fmtPct(market.price.discountedShare, 0) },
    });
  }

  const crowdedBand = (market?.price?.bands || []).filter((b) => isNum(b.share) && b.share >= t.bandCrowding).sort((a, b) => b.share - a.share)[0];
  if (crowdedBand) {
    push({
      id: 'band-crowding', tone: 'info', priority: 58, target: 'panel-price',
      title: `${fmtPct(crowdedBand.share, 0)} of listings sit in ${crowdedBand.label}`,
      detail: `Crowded bands win on review count and A+ content. ${crowdedBand.medianReviews !== null ? `Median reviews in that band: ${fmtINR(crowdedBand.medianReviews)}.` : ''} A price point just outside the cluster is usually easier to own.`,
      metrics: { Band: crowdedBand.label, Share: fmtPct(crowdedBand.share, 0), 'Listings': crowdedBand.count },
    });
  }

  if (isNum(market?.brands?.topShare) && market.brands.topShare >= t.brandDominance) {
    push({
      id: 'brand-dominance', tone: 'warn', priority: 72, target: 'panel-brands',
      title: `${market.brands.topBrand?.brand} owns ${fmtPct(market.brands.topShare, 0)} of the first page`,
      detail: `${market.brands.unique} brands appear in this sample; the top 3 hold ${fmtPct(market.brands.top3Share, 0)}. Competing directly on brand terms is expensive — long-tail variants are where the openings are.`,
      metrics: { Brand: market.brands.topBrand?.brand || '—', 'Listings': market.brands.topBrand?.count ?? '—', 'Reviews': fmtINR(market.brands.topBrand?.reviews) },
    });
  }

  if (isNum(market?.bsr?.median)) {
    push({
      id: 'demand-proxy',
      tone: market.bsr.median <= 50000 ? 'pos' : 'info',
      priority: 50,
      target: 'panel-market',
      title: `Median sales rank ${market.bsr.median.toLocaleString('en-IN')} across ${market.sample.ranked} ranked listings`,
      detail: market.bsr.median <= 20000
        ? 'Best-seller ranks this low mean the keyword carries real, recurring demand — worth a listing of its own.'
        : 'Ranks are high, so demand is thin per listing. Broad-match ads on this term usually run a high ACoS.',
      metrics: { Median: market.bsr.median.toLocaleString('en-IN'), Best: isNum(market.bsr.best) ? market.bsr.best.toLocaleString('en-IN') : '—', '≤10k share': fmtPct(market.bsr.top10kShare, 0) },
    });
  }

  /* ── catalog-relative rules ─────────────────────────────────────────── */
  const summary = catalog?.summary;
  if (catalog && summary) {
    if (summary.matchedCount === 0) {
      push({
        id: 'catalog-absent', tone: 'warn', priority: 88, target: 'panel-catalog',
        title: 'None of your sellers appear in this keyword’s top results',
        detail: `Checked ${catalog.rows.length} listings against your catalog (assigned sellers only). Either the keyword is off-catalogue or you are outside the first page — a low-bid exact-match campaign is the cheapest way to test it.`,
        metrics: { 'Your listings matched': 0, 'Positions checked': catalog.rows.length },
      });
    } else {
      push({
        id: 'catalog-present',
        tone: 'info',
        priority: 76,
        target: 'panel-catalog',
        title: `You already rank in this keyword (${summary.matchedCount} listing${summary.matchedCount === 1 ? '' : 's'}, best position ${summary.bestPosition})`,
        detail: `Average price ${fmtPct(summary.avgPriceVsMarketPct, 1)} versus the market median. ${summary.missingTermCount > 0 ? `${summary.missingTermCount} high-frequency market terms are missing from your titles.` : 'Your titles already cover the high-frequency market terms.'}`,
        metrics: { Matched: summary.matchedCount, 'Coverage': fmtPct(summary.coveragePct, 0), 'Best position': summary.bestPosition, 'Price vs market': fmtPct(summary.avgPriceVsMarketPct, 1) },
      });

      if (isNum(summary.avgPriceVsMarketPct) && Math.abs(summary.avgPriceVsMarketPct) >= t.priceGapPct) {
        const above = summary.avgPriceVsMarketPct > 0;
        push({
          id: above ? 'price-above-market' : 'price-below-market',
          tone: above ? 'neg' : 'pos',
          priority: above ? 80 : 62,
          target: 'panel-catalog',
          title: above
            ? `Your price is ${fmtPct(summary.avgPriceVsMarketPct, 1)} above the market median`
            : `Your price is ${fmtPct(Math.abs(summary.avgPriceVsMarketPct), 1)} below the market median`,
          detail: above
            ? 'You are winning this keyword only if conversion or reviews justify the premium; otherwise the click cost will not pay for itself.'
            : 'You are the value option on this keyword — make sure the title says so, or the click goes to a better-optimised listing at a similar price.',
          metrics: { 'Your avg price': fmtINR(summary.sellers?.[0]?.avgPrice), 'Market median': fmtINR(market.price.median) },
        });
      }
    }
  }

  out.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  return {
    keyword: keyword || sample.keyword || null,
    insights: out,
    headline: out[0] ? out[0].title : 'No material signal in this sample.',
    counts: out.reduce((acc, i) => { acc[i.tone] = (acc[i.tone] || 0) + 1; return acc; }, { pos: 0, neg: 0, warn: 0, info: 0 }),
  };
}

module.exports = {
  computeMarketAnalytics,
  extractTerms,
  linkCatalog,
  fetchCatalogMatches,
  buildInsights,
  opportunityScore,
  // exported for tests / reuse
  helpers: { median, mean, percentile, share, norm, round },
  PRICE_BANDS,
  RATING_BANDS,
};
