/**
 * Ads analytics — every read query the Ads module needs, in one place.
 *
 * Design rules (learned from the audit in docs/ads-module-deep-dive.md):
 *  1. **Scoped by construction.** Every window query goes through `AdsWindow`,
 *     which applies the caller's seller scope (F1) plus the ReportType filter
 *     (F11). There is no code path that queries AdsPerformance without both.
 *  2. **Dates are bound as `YYYY-MM-DD` strings and CAST in SQL.** The pool runs
 *     with `useUTC:false` and TZ=Asia/Kolkata; passing JS `Date` objects to
 *     `sql.Date` shifts the window by a day in IST (the class of bug fixed for
 *     the dashboard in PR #64). Strings are timezone-proof.
 *  3. **Aggregate in SQL, shape in JS.** Buckets, mixes, movers and efficiency
 *     bands are computed by the database; JS only derives ratios and deltas.
 *  4. **No fabricated metrics.** Every derived ratio is `null` when its
 *     denominator is unknown, so the UI renders "—" instead of a fake 0.
 *  5. **Bounded round-trips.** Sparklines and drill-downs fetch only the keys on
 *     screen, chunked below SQL Server's 2,100-parameter ceiling (F3).
 */

const { sql, getPool } = require('../database/db');
const { resolveSellerScope, bindSellerFilter } = require('../utils/sellerScope');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const SORTABLE = new Set([
  'spend', 'sales', 'totalSales', 'orders', 'impressions', 'clicks', 'units', 'pageViews',
  'acos', 'tacos', 'roas', 'ctr', 'cvr', 'cpc', 'costPerOrder', 'delta', 'deltaPct', 'title',
]);

const FLAGS = new Set(['all', 'top', 'rising', 'falling', 'waste', 'no_sales', 'high_acos', 'low_ctr']);

/** Columns every key-level query selects (current + previous window). */
const KEY_COLUMNS = `
    key, sku, title, imageUrl, brand, category, sellerId, sellerName, marketplace, childCount,
    cur_spend AS spend, cur_sales AS sales, cur_organicSales AS organicSales,
    cur_orders AS orders, cur_organicOrders AS organicOrders,
    cur_impressions AS impressions, cur_clicks AS clicks,
    cur_units AS units, cur_pageViews AS pageViews, cur_sameSkuSales AS sameSkuSales,
    cur_sales + cur_organicSales AS totalSales,
    prev_spend AS prevSpend, prev_sales AS prevSales, prev_organicSales AS prevOrganicSales,
    prev_sales + prev_organicSales AS prevTotalSales,
    prev_orders AS prevOrders, prev_impressions AS prevImpressions, prev_clicks AS prevClicks,
    (cur_sales + cur_organicSales) - (prev_sales + prev_organicSales) AS deltaTotalSales,
    (cur_spend - prev_spend) AS deltaSpend,
    cur_sales + cur_organicSales - prev_sales - prev_organicSales AS deltaTotalSales2`;

/* ────────────────────────────── date helpers ───────────────────────────── */

function toDateString(value) {
  if (!value) return null;
  const str = String(value).trim().slice(0, 10);
  return DATE_RE.test(str) ? str : null;
}

function todayString() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(dateStr, delta) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

function daysBetween(start, end) {
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${end}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86400000) + 1;
}

const monthKeyOf = (dateStr) => dateStr.slice(0, 7);

/**
 * Resolve a requested window into a fully specified period: the current window,
 * a previous window of identical length, bucket granularity, and the month keys
 * the window touches (for target lookups).
 */
function resolvePeriod(query = {}) {
  let end = toDateString(query.endDate) || todayString();
  let start = toDateString(query.startDate) || addDays(end, -29);
  if (start > end) [start, end] = [end, start];

  const days = daysBetween(start, end);
  const prevEnd = addDays(start, -1);
  const prevStart = addDays(prevEnd, -(days - 1));

  const requested = String(query.granularity || 'auto').toLowerCase();
  let granularity = requested;
  if (!['day', 'week', 'month'].includes(granularity)) {
    granularity = days <= 45 ? 'day' : days <= 400 ? 'week' : 'month';
  }

  const months = [];
  let cursor = monthKeyOf(start);
  const lastMonth = monthKeyOf(end);
  while (cursor <= lastMonth && months.length < 36) {
    months.push(cursor);
    const [y, m] = cursor.split('-').map(Number);
    cursor = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  }

  return {
    start, end, prevStart, prevEnd, days, granularity, months,
    label: `${start} → ${end}`,
    isSingleDay: days === 1,
  };
}

/** SQL expression producing a sortable bucket key for the given granularity. */
function bucketExpr(granularity, column = 'p.Date') {
  if (granularity === 'month') return `CONVERT(varchar(7), ${column}, 23)`;
  if (granularity === 'week') {
    // 1900-01-01 was a Monday → Monday-of-week, independent of DATEFIRST.
    return `CONVERT(varchar(10), DATEADD(day, -(DATEDIFF(day, 0, ${column}) % 7), ${column}), 23)`;
  }
  return `CONVERT(varchar(10), ${column}, 23)`;
}

/** Dense bucket axis (including gaps) so charts never silently skip days. */
function buildAxis(period) {
  const keys = [];
  if (period.granularity === 'month') {
    let cursor = monthKeyOf(period.start);
    const last = monthKeyOf(period.end);
    while (cursor <= last && keys.length < 60) {
      keys.push(cursor);
      const [y, m] = cursor.split('-').map(Number);
      cursor = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
    }
    return keys;
  }
  if (period.granularity === 'week') {
    let ts = Date.parse(`${period.start}T00:00:00Z`);
    const dow = new Date(ts).getUTCDay();
    ts -= ((dow === 0 ? 6 : dow - 1) * 86400000);
    const endTs = Date.parse(`${period.end}T00:00:00Z`);
    while (ts <= endTs && keys.length < 60) {
      keys.push(new Date(ts).toISOString().slice(0, 10));
      ts += WEEK_MS;
    }
    return keys;
  }
  let cursor = period.start;
  while (cursor <= period.end && keys.length < 400) {
    keys.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return keys;
}

/* ─────────────────────────────── metrics ────────────────────────────────── */

const num = (v) => (v === null || v === undefined ? 0 : Number(v) || 0);

/** Derive every ratio from raw sums. `null` (not 0) when the denominator is unknown. */
function deriveMetrics(raw = {}) {
  const spend = num(raw.spend);
  const sales = num(raw.sales);
  const organicSales = num(raw.organicSales);
  const orders = num(raw.orders);
  const organicOrders = num(raw.organicOrders);
  const impressions = num(raw.impressions);
  const clicks = num(raw.clicks);
  const totalSales = sales + organicSales;
  const totalOrders = orders + organicOrders;

  return {
    spend, sales, organicSales, totalSales, orders, organicOrders, totalOrders,
    impressions, clicks,
    units: num(raw.units), pageViews: num(raw.pageViews), sameSkuSales: num(raw.sameSkuSales),
    acos: sales > 0 ? (spend / sales) * 100 : null,
    tacos: totalSales > 0 ? (spend / totalSales) * 100 : null,
    roas: spend > 0 ? sales / spend : null,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
    cvr: clicks > 0 ? (orders / clicks) * 100 : null,
    cpc: clicks > 0 ? spend / clicks : null,
    cpm: impressions > 0 ? (spend / impressions) * 1000 : null,
    costPerOrder: orders > 0 ? spend / orders : null,
    aov: orders > 0 ? sales / orders : null,
    adSharePct: totalSales > 0 ? (sales / totalSales) * 100 : null,
  };
}

/** Percentage delta; `null` when there is no comparable baseline (never a fake 0%). */
function pctDelta(current, previous) {
  const cur = Number(current);
  const prev = Number(previous);
  if (!Number.isFinite(cur) || !Number.isFinite(prev) || prev === 0) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

/** Absolute delta in points, for rates (ACoS, TACoS, CTR, CVR, ad share). */
function pointDelta(current, previous) {
  const cur = Number(current);
  const prev = Number(previous);
  if (!Number.isFinite(cur) || !Number.isFinite(prev)) return null;
  return cur - prev;
}

const PCT_KEYS = ['spend', 'sales', 'totalSales', 'orders', 'totalOrders', 'organicSales', 'impressions', 'clicks', 'units', 'roas', 'cpc', 'costPerOrder'];
const POINT_KEYS = ['acos', 'tacos', 'ctr', 'cvr', 'adSharePct'];

function deltaSet(current = {}, previous = {}) {
  const out = {};
  for (const key of PCT_KEYS) out[key] = pctDelta(current[key], previous[key]);
  for (const key of POINT_KEYS) {
    out[key] = (current[key] === null || current[key] === undefined || previous[key] === null || previous[key] === undefined)
      ? null
      : pointDelta(current[key], previous[key]);
  }
  return out;
}

/** SUM(CASE WHEN <window> THEN …) blocks for one window, with a column prefix. */
const METRIC_SELECT = (windowSql, prefix) => `
        SUM(CASE WHEN ${windowSql} THEN ISNULL(p.AdSpend, 0) ELSE 0 END) AS ${prefix}spend,
        SUM(CASE WHEN ${windowSql} THEN ISNULL(p.AdSales, 0) ELSE 0 END) AS ${prefix}sales,
        SUM(CASE WHEN ${windowSql} THEN ISNULL(p.OrganicSales, 0) ELSE 0 END) AS ${prefix}organicSales,
        SUM(CASE WHEN ${windowSql} THEN ISNULL(p.Orders, 0) ELSE 0 END) AS ${prefix}orders,
        SUM(CASE WHEN ${windowSql} THEN ISNULL(p.OrganicOrders, 0) ELSE 0 END) AS ${prefix}organicOrders,
        SUM(CASE WHEN ${windowSql} THEN ISNULL(p.Impressions, 0) ELSE 0 END) AS ${prefix}impressions,
        SUM(CASE WHEN ${windowSql} THEN ISNULL(p.Clicks, 0) ELSE 0 END) AS ${prefix}clicks,
        SUM(CASE WHEN ${windowSql} THEN ISNULL(p.PageViews, 0) ELSE 0 END) AS ${prefix}pageViews,
        SUM(CASE WHEN ${windowSql} THEN ISNULL(p.TotalUnits, 0) ELSE 0 END) AS ${prefix}units,
        SUM(CASE WHEN ${windowSql} THEN ISNULL(p.SameSkuSales, 0) ELSE 0 END) AS ${prefix}sameSkuSales`;

/* ─────────────────────────────── query core ─────────────────────────────── */

/**
 * One window of ads data: seller scope, ReportType, date range and optional
 * brand/category/search — plus the parameter binder every query replays.
 */
class AdsWindow {
  constructor({ user, query = {}, pool }) {
    this.pool = pool || null;
    this.period = resolvePeriod(query);
    this.reportType = query.reportType === 'monthly' ? 'monthly' : 'daily';
    this.scope = resolveSellerScope(user, query.sellerId);
    this.filter = {
      brand: query.brand ? String(query.brand).slice(0, 120) : null,
      category: query.category ? String(query.category).slice(0, 120) : null,
      search: query.search ? String(query.search).slice(0, 120) : null,
    };
  }

  get denied() { return this.scope.denied; }
  get empty() { return this.scope.empty; }

  /** Bind every parameter a query built from this window needs. */
  bind(request) {
    request.input('reportType', sql.VarChar, this.reportType);
    request.input('startDate', sql.VarChar, this.period.start);
    request.input('endDate', sql.VarChar, this.period.end);
    request.input('prevStart', sql.VarChar, this.period.prevStart);
    request.input('prevEnd', sql.VarChar, this.period.prevEnd);
    if (this.filter.brand) request.input('brand', sql.NVarChar, this.filter.brand);
    if (this.filter.category) request.input('category', sql.NVarChar, this.filter.category);
    if (this.filter.search) request.input('search', sql.VarChar, `%${this.filter.search}%`);
    this.sellerPredicate = bindSellerFilter(request, this.scope, { alias: 'a', prefix: 'adsScope' });
    return request;
  }

  /** WHERE fragment. `span` = 'current' | 'both'. Dates CAST from strings. */
  where({ span = 'current' } = {}) {
    let text = 'WHERE p.ReportType = @reportType';
    text += span === 'both'
      ? ' AND p.Date >= CAST(@prevStart AS date) AND p.Date <= CAST(@endDate AS date)'
      : ' AND p.Date >= CAST(@startDate AS date) AND p.Date <= CAST(@endDate AS date)';
    text += this.sellerPredicate || '';
    if (this.filter.brand) text += ' AND a.Brand = @brand';
    if (this.filter.category) text += ' AND a.Category = @category';
    if (this.filter.search) text += ' AND (p.Asin LIKE @search OR a.Sku LIKE @search OR a.Title LIKE @search)';
    return text;
  }

  get joins() {
    return `LEFT JOIN Asins a ON p.Asin = a.AsinCode
            LEFT JOIN Sellers s ON s.Id = a.SellerId`;
  }

  get currentWindowSql() {
    return 'p.Date >= CAST(@startDate AS date) AND p.Date <= CAST(@endDate AS date)';
  }

  get previousWindowSql() {
    return 'p.Date >= CAST(@prevStart AS date) AND p.Date <= CAST(@prevEnd AS date)';
  }

  keyExpr(groupBy) {
    return groupBy === 'parent' ? `COALESCE(NULLIF(a.ParentAsin, ''), p.Asin)` : 'p.Asin';
  }

  request() { return this.bind(this.pool.request()); }

  /** Common table expression aggregating both windows per key. */
  keyAggCte(groupBy) {
    return `WITH Agg AS (
      SELECT
        ${this.keyExpr(groupBy)} AS key,
        MAX(a.Sku) AS sku,
        MAX(a.Title) AS title,
        MAX(a.ImageUrl) AS imageUrl,
        MAX(a.Brand) AS brand,
        MAX(a.Category) AS category,
        MAX(a.SellerId) AS sellerId,
        MAX(s.Name) AS sellerName,
        MAX(s.Marketplace) AS marketplace,
        COUNT(DISTINCT p.Asin) AS childCount,
        ${METRIC_SELECT(this.currentWindowSql, 'cur_')},
        ${METRIC_SELECT(this.previousWindowSql, 'prev_')}
      FROM AdsPerformance p
      ${this.joins}
      ${this.where({ span: 'both' })}
      GROUP BY ${this.keyExpr(groupBy)}
    ), Keys AS (
      SELECT ${KEY_COLUMNS}
      FROM Agg
    )`;
  }
}

/** Local switch so tests can inject a pool-less window. */
async function poolFor(win) {
  return win.pool || getPool();
}

/* ─────────────────────────────── queries ────────────────────────────────── */

/**
 * Bucketed series for the current window plus the previous window aligned
 * position-by-position on the same axis (so it can be overlaid directly).
 * One round-trip. Totals equal the sum of buckets, keeping KPIs and charts
 * mathematically consistent.
 */
async function fetchSeries(win) {
  const bucket = bucketExpr(win.period.granularity);
  const request = win.request();
  const result = await request.query(`
    SELECT
      ${bucket} AS bucket,
      CASE WHEN ${win.currentWindowSql} THEN 'cur' ELSE 'prev' END AS win,
      ${METRIC_SELECT(win.currentWindowSql, 'cur_')},
      ${METRIC_SELECT(win.previousWindowSql, 'prev_')}
    FROM AdsPerformance p
    ${win.joins}
    ${win.where({ span: 'both' })}
    GROUP BY ${bucket}, CASE WHEN ${win.currentWindowSql} THEN 'cur' ELSE 'prev' END
    ORDER BY bucket ASC
  `);

  const curByBucket = new Map();
  const prevByBucket = new Map();
  for (const row of result.recordset || []) {
    const metrics = deriveMetrics({
      spend: row.cur_spend, sales: row.cur_sales, organicSales: row.cur_organicSales,
      orders: row.cur_orders, organicOrders: row.cur_organicOrders,
      impressions: row.cur_impressions, clicks: row.cur_clicks,
      units: row.cur_units, pageViews: row.cur_pageViews, sameSkuSales: row.cur_sameSkuSales,
    });
    if (row.win === 'cur') curByBucket.set(row.bucket, metrics);
    else if (row.win === 'prev') prevByBucket.set(row.bucket, deriveMetrics({
      spend: row.prev_spend, sales: row.prev_sales, organicSales: row.prev_organicSales,
      orders: row.prev_orders, organicOrders: row.prev_organicOrders,
      impressions: row.prev_impressions, clicks: row.prev_clicks,
      units: row.prev_units, pageViews: row.prev_pageViews, sameSkuSales: row.prev_sameSkuSales,
    }));
  }

  const axis = buildAxis(win.period);
  const METRIC_KEYS = ['spend', 'sales', 'organicSales', 'totalSales', 'orders', 'organicOrders', 'totalOrders',
    'impressions', 'clicks', 'units', 'pageViews', 'sameSkuSales', 'acos', 'tacos', 'roas', 'ctr', 'cvr', 'cpc', 'costPerOrder', 'adSharePct'];

  const current = {}; const previous = {};
  for (const key of METRIC_KEYS) { current[key] = []; previous[key] = []; }

  const totalsAcc = {};
  const prevTotalsAcc = {};
  const add = (acc, m) => {
    acc.spend = num(acc.spend) + m.spend; acc.sales = num(acc.sales) + m.sales;
    acc.organicSales = num(acc.organicSales) + m.organicSales;
    acc.orders = num(acc.orders) + m.orders; acc.organicOrders = num(acc.organicOrders) + m.organicOrders;
    acc.impressions = num(acc.impressions) + m.impressions; acc.clicks = num(acc.clicks) + m.clicks;
    acc.units = num(acc.units) + m.units; acc.pageViews = num(acc.pageViews) + m.pageViews;
    acc.sameSkuSales = num(acc.sameSkuSales) + m.sameSkuSales;
  };

  const prevAxis = buildAxis({ ...win.period, start: win.period.prevStart, end: win.period.prevEnd });

  for (let i = 0; i < axis.length; i += 1) {
    const bucketKey = axis[i];
    const cur = curByBucket.get(bucketKey) || null;
    for (const key of METRIC_KEYS) current[key].push(cur ? cur[key] : null);
    if (cur) add(totalsAcc, cur);

    // Day granularity → previous bucket is exactly `days` earlier.
    // Week/month → positional alignment on the previous window's own axis.
    const prevKey = win.period.granularity === 'day' ? addDays(bucketKey, -win.period.days) : prevAxis[i];
    const prev = prevKey ? prevByBucket.get(prevKey) || null : null;
    for (const key of METRIC_KEYS) previous[key].push(prev ? prev[key] : null);
    if (prev) add(prevTotalsAcc, prev);
  }

  return {
    series: { keys: axis, current, previous, metrics: METRIC_KEYS, granularity: win.period.granularity },
    currentTotals: deriveMetrics(totalsAcc),
    previousTotals: deriveMetrics(prevTotalsAcc),
    previousAvailable: prevByBucket.size > 0,
  };
}

/** Seller / brand / category mixes with period-over-period comparison. */
async function fetchMix(win) {
  const request = win.request();
  const result = await request.query(`
    SELECT
      CASE WHEN GROUPING(a.SellerId) = 0 THEN 'seller'
           WHEN GROUPING(a.Brand) = 0 THEN 'brand'
           ELSE 'category' END AS dim,
      CASE WHEN GROUPING(a.SellerId) = 0 THEN ISNULL(a.SellerId, '')
           WHEN GROUPING(a.Brand) = 0 THEN ISNULL(a.Brand, '')
           ELSE ISNULL(a.Category, '') END AS name,
      MAX(s.Name) AS sellerName,
      MAX(s.Marketplace) AS marketplace,
      ${METRIC_SELECT(win.currentWindowSql, 'cur_')},
      ${METRIC_SELECT(win.previousWindowSql, 'prev_')}
    FROM AdsPerformance p
    ${win.joins}
    ${win.where({ span: 'both' })}
    GROUP BY GROUPING SETS ((a.SellerId), (a.Brand), (a.Category))
  `);

  const out = { seller: [], brand: [], category: [] };
  const emptyLabel = { seller: '(unattributed)', brand: '(no brand)', category: '(uncategorised)' };

  for (const row of result.recordset || []) {
    const current = deriveMetrics({
      spend: row.cur_spend, sales: row.cur_sales, organicSales: row.cur_organicSales,
      orders: row.cur_orders, organicOrders: row.cur_organicOrders,
      impressions: row.cur_impressions, clicks: row.cur_clicks,
      units: row.cur_units, pageViews: row.cur_pageViews,
    });
    const previous = deriveMetrics({
      spend: row.prev_spend, sales: row.prev_sales, organicSales: row.prev_organicSales,
      orders: row.prev_orders, organicOrders: row.prev_organicOrders,
      impressions: row.prev_impressions, clicks: row.prev_clicks, units: row.prev_units,
    });
    out[row.dim].push({
      id: row.name || null,
      name: row.name || emptyLabel[row.dim],
      sellerName: row.sellerName || null,
      marketplace: row.marketplace || null,
      ...current,
      prevSpend: previous.spend,
      prevTotalSales: previous.totalSales,
      prevAcos: previous.acos,
      deltaTotalSalesPct: pctDelta(current.totalSales, previous.totalSales),
      deltaSpendPct: pctDelta(current.spend, previous.spend),
      deltaAcosPoints: (current.acos === null || previous.acos === null) ? null : pointDelta(current.acos, previous.acos),
    });
  }

  for (const dim of ['seller', 'brand', 'category']) {
    out[dim].sort((a, b) => b.totalSales - a.totalSales || b.spend - a.spend);
    const total = out[dim].reduce((sum, r) => sum + r.totalSales, 0);
    for (const row of out[dim]) row.share = total > 0 ? (row.totalSales / total) * 100 : null;
    out[dim] = out[dim].slice(0, 40);
  }
  return out;
}

/** Convert a Keys-shaped SQL row into the API row shape. */
function shapeKeyRow(row = {}) {
  const current = deriveMetrics(row);
  const previous = deriveMetrics({
    spend: row.prevSpend, sales: row.prevSales, organicSales: row.prevOrganicSales,
    orders: row.prevOrders, impressions: row.prevImpressions, clicks: row.prevClicks,
  });
  const hasPrevious = previous.totalSales > 0 || previous.spend > 0;
  return {
    key: row.key,
    sku: row.sku || null,
    title: row.title || null,
    imageUrl: row.imageUrl || null,
    brand: row.brand || null,
    category: row.category || null,
    sellerId: row.sellerId || null,
    sellerName: row.sellerName || null,
    marketplace: row.marketplace || null,
    childCount: num(row.childCount),
    ...current,
    prevSpend: previous.spend,
    prevSales: previous.sales,
    prevTotalSales: previous.totalSales,
    prevOrders: previous.orders,
    prevAcos: previous.acos,
    prevTacos: previous.tacos,
    prevRoas: previous.roas,
    hasPrevious,
    deltaTotalSales: current.totalSales - previous.totalSales,
    deltaSpend: current.spend - previous.spend,
    deltaTotalSalesPct: hasPrevious ? pctDelta(current.totalSales, previous.totalSales) : null,
    deltaSpendPct: hasPrevious ? pctDelta(current.spend, previous.spend) : null,
    deltaAcosPoints: (current.acos === null || previous.acos === null || !hasPrevious) ? null : pointDelta(current.acos, previous.acos),
    flags: {
      waste: current.spend > 0 && current.sales === 0,
      highAcos: current.sales > 0 && current.acos !== null && current.acos > 40,
      falling: hasPrevious && current.totalSales < previous.totalSales * 0.85,
      rising: hasPrevious && current.totalSales > previous.totalSales * 1.15,
    },
  };
}

const POST_FILTERS = {
  waste: 'spend > @wasteSpendFloor AND sales = 0',
  no_sales: 'sales = 0',
  high_acos: 'sales > 0 AND spend / sales * 100 > @highAcosThreshold',
  low_ctr: 'impressions > 500 AND clicks * 1.0 / impressions * 100 < 0.35',
  top: 'totalSales > 0',
  rising: 'prevTotalSales > 0 AND totalSales > prevTotalSales * 1.15',
  falling: 'prevTotalSales > 0 AND totalSales < prevTotalSales * 0.85',
};

/** Paginated, sortable, filtered key table plus whole-set footer totals. */
async function fetchRows(win, options = {}) {
  const groupBy = options.groupBy === 'parent' ? 'parent' : 'asin';
  const page = Math.max(1, parseInt(options.page, 10) || 1);
  const limit = Math.min(200, Math.max(5, parseInt(options.limit, 10) || 50));
  const sortBy = SORTABLE.has(options.sortBy) ? options.sortBy : 'totalSales';
  const dir = String(options.sortOrder || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const flag = FLAGS.has(options.flag) ? options.flag : 'all';
  const wasteSpendFloor = Math.max(0, parseFloat(options.wasteSpendFloor) || 1000);
  const highAcosThreshold = Math.max(1, parseFloat(options.highAcosThreshold) || 40);
  const minTotalSales = Math.max(0, parseFloat(options.minTotalSales) || 0);

  const sortMap = {
    spend: 'spend', sales: 'sales', totalSales: 'totalSales', orders: 'orders',
    impressions: 'impressions', clicks: 'clicks', units: 'units', pageViews: 'pageViews',
    acos: 'CASE WHEN sales > 0 THEN spend / sales ELSE NULL END',
    tacos: 'CASE WHEN totalSales > 0 THEN spend / totalSales ELSE NULL END',
    roas: 'CASE WHEN spend > 0 THEN sales / spend ELSE NULL END',
    ctr: 'CASE WHEN impressions > 0 THEN clicks * 1.0 / impressions ELSE NULL END',
    cvr: 'CASE WHEN clicks > 0 THEN orders * 1.0 / clicks ELSE NULL END',
    cpc: 'CASE WHEN clicks > 0 THEN spend / clicks ELSE NULL END',
    costPerOrder: 'CASE WHEN orders > 0 THEN spend / orders ELSE NULL END',
    delta: 'deltaTotalSales',
    deltaPct: 'CASE WHEN prevTotalSales > 0 THEN deltaTotalSales * 1.0 / prevTotalSales ELSE NULL END',
    title: 'title',
  };

  const searchClause = options.search
    ? ` AND (key LIKE @rowSearch OR ISNULL(sku, '') LIKE @rowSearch OR ISNULL(title, '') LIKE @rowSearch)`
    : '';
  const flagClause = flag !== 'all' ? ` AND (${POST_FILTERS[flag]})` : '';
  const where = `WHERE totalSales >= @minTotalSales${flagClause}${searchClause}`;

  const bindRowsParams = (request) => {
    request
      .input('wasteSpendFloor', sql.Decimal(18, 2), wasteSpendFloor)
      .input('highAcosThreshold', sql.Decimal(18, 4), highAcosThreshold)
      .input('minTotalSales', sql.Decimal(18, 2), minTotalSales);
    if (options.search) request.input('rowSearch', sql.VarChar, `%${String(options.search).slice(0, 120)}%`);
    return request;
  };

  const rowsRequest = bindRowsParams(win.request())
    .input('offset', sql.Int, (page - 1) * limit)
    .input('limit', sql.Int, limit);

  const totalsRequest = bindRowsParams(win.request());

  const [rowsResult, totalsResult] = await Promise.all([
    rowsRequest.query(`
      ${win.keyAggCte(groupBy)}
      SELECT *, COUNT(*) OVER () AS totalCount
      FROM Keys
      ${where}
      ORDER BY ${sortMap[sortBy]} ${dir}, key ASC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `),
    totalsRequest.query(`
      ${win.keyAggCte(groupBy)}
      SELECT COUNT(*) AS keyCount,
        SUM(spend) AS spend, SUM(sales) AS sales, SUM(organicSales) AS organicSales,
        SUM(orders) AS orders, SUM(impressions) AS impressions, SUM(clicks) AS clicks,
        SUM(units) AS units, SUM(pageViews) AS pageViews,
        SUM(prevSpend) AS prevSpend, SUM(prevSales) AS prevSales, SUM(prevOrganicSales) AS prevOrganicSales
      FROM Keys
      ${where}
    `),
  ]);

  const rows = (rowsResult.recordset || []).map(shapeKeyRow);
  const total = num(rowsResult.recordset?.[0]?.totalCount);
  const rawTotals = totalsResult.recordset?.[0] || {};
  const totals = deriveMetrics(rawTotals);
  const prevTotals = deriveMetrics({
    spend: rawTotals.prevSpend, sales: rawTotals.prevSales, organicSales: rawTotals.prevOrganicSales,
  });

  return {
    groupBy, page, limit, total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    rows,
    totals: { ...totals, keys: num(rawTotals.keyCount) },
    previous: prevTotals,
    delta: deltaSet(totals, prevTotals),
    appliedFilters: {
      flag, minTotalSales, search: options.search || null, sortBy, sortOrder: dir.toLowerCase(),
      wasteSpendFloor, highAcosThreshold,
    },
  };
}

/** Top movers and spend spikes — three bounded queries. */
async function fetchMovers(win, options = {}) {
  const groupBy = options.groupBy === 'parent' ? 'parent' : 'asin';
  const limit = Math.min(20, Math.max(3, parseInt(options.limit, 10) || 6));

  const run = async (orderSql, filterSql) => {
    const request = win.request().input('topN', sql.Int, limit);
    const result = await request.query(`
      ${win.keyAggCte(groupBy)}
      SELECT TOP (@topN) * FROM Keys
      WHERE ${filterSql}
      ORDER BY ${orderSql}
    `);
    return (result.recordset || []).map(shapeKeyRow);
  };

  const [gainers, decliners, spendSpikes] = await Promise.all([
    run('deltaTotalSales DESC', 'totalSales > 0 AND prevTotalSales > 0'),
    run('deltaTotalSales ASC', 'prevTotalSales > 0'),
    run('deltaSpend DESC', 'spend > 0 AND prevSpend > 0'),
  ]);

  return { gainers, decliners, spendSpikes };
}

/** Efficiency bands, scatter sample and waste lists. */
async function fetchEfficiency(win, options = {}) {
  const groupBy = options.groupBy === 'parent' ? 'parent' : 'asin';
  const wasteSpendFloor = Math.max(0, parseFloat(options.wasteSpendFloor) || 1000);

  const bucketCase = `
    CASE
      WHEN sales = 0 AND spend > 0 THEN 'no_sales'
      WHEN spend = 0 THEN 'no_spend'
      WHEN spend / sales <= 0.15 THEN 'acos_le_15'
      WHEN spend / sales <= 0.25 THEN 'acos_15_25'
      WHEN spend / sales <= 0.40 THEN 'acos_25_40'
      ELSE 'acos_gt_40'
    END`;

  const [bucketResult, scatterResult, wasteResult, wasteSummaryResult] = await Promise.all([
    win.request().query(`
      ${win.keyAggCte(groupBy)}
      SELECT ${bucketCase} AS bucket,
        COUNT(*) AS keys_count, SUM(spend) AS spend, SUM(sales) AS sales,
        SUM(totalSales) AS totalSales, SUM(orders) AS orders
      FROM Keys
      GROUP BY ${bucketCase}
    `),
    win.request().input('topN', sql.Int, 60).query(`
      ${win.keyAggCte(groupBy)}
      SELECT TOP (@topN) * FROM Keys
      WHERE spend > 0
      ORDER BY spend DESC
    `),
    win.request().input('wasteSpendFloor', sql.Decimal(18, 2), wasteSpendFloor).input('topN', sql.Int, 8).query(`
      ${win.keyAggCte(groupBy)}
      SELECT TOP (@topN) *, 'zero_sales' AS reason FROM Keys
      WHERE spend >= @wasteSpendFloor AND sales = 0
      ORDER BY spend DESC
    `),
    win.request().input('wasteSpendFloor', sql.Decimal(18, 2), wasteSpendFloor).query(`
      ${win.keyAggCte(groupBy)}
      SELECT
        SUM(CASE WHEN spend >= @wasteSpendFloor AND sales = 0 THEN 1 ELSE 0 END) AS zeroSalesKeys,
        SUM(CASE WHEN spend >= @wasteSpendFloor AND sales = 0 THEN spend ELSE 0 END) AS zeroSalesSpend,
        SUM(CASE WHEN sales > 0 AND spend / sales > 0.40 THEN 1 ELSE 0 END) AS highAcosKeys,
        SUM(CASE WHEN sales > 0 AND spend / sales > 0.40 THEN spend ELSE 0 END) AS highAcosSpend,
        SUM(CASE WHEN sales > 0 AND spend / sales > 0.40 THEN sales ELSE 0 END) AS highAcosSales
      FROM Keys
    `),
  ]);

  const labels = {
    acos_le_15: 'ACoS ≤ 15%', acos_15_25: 'ACoS 15–25%', acos_25_40: 'ACoS 25–40%',
    acos_gt_40: 'ACoS > 40%', no_sales: 'Spend · no sales', no_spend: 'No spend',
  };
  const buckets = (bucketResult.recordset || []).map((row) => ({
    key: row.bucket,
    label: labels[row.bucket] || row.bucket,
    keys: num(row.keys_count),
    spend: num(row.spend),
    sales: num(row.sales),
    totalSales: num(row.totalSales),
    orders: num(row.orders),
  }));
  const order = ['acos_le_15', 'acos_15_25', 'acos_25_40', 'acos_gt_40', 'no_sales', 'no_spend'];
  buckets.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  const totalSpend = buckets.reduce((s, b) => s + b.spend, 0);
  for (const b of buckets) b.spendShare = totalSpend > 0 ? (b.spend / totalSpend) * 100 : null;

  const wasteRow = wasteSummaryResult.recordset?.[0] || {};
  return {
    buckets,
    scatter: (scatterResult.recordset || []).map(shapeKeyRow),
    waste: {
      spendFloor: wasteSpendFloor,
      zeroSales: {
        keys: num(wasteRow.zeroSalesKeys),
        spend: num(wasteRow.zeroSalesSpend),
        rows: (wasteResult.recordset || []).map(shapeKeyRow),
      },
      highAcos: {
        keys: num(wasteRow.highAcosKeys),
        spend: num(wasteRow.highAcosSpend),
        sales: num(wasteRow.highAcosSales),
        thresholdPct: 40,
      },
    },
  };
}

/** ADS + ACoS targets from GmsTargets for the months the window touches. */
async function fetchTargets(win) {
  const sellerIds = win.scope.isGlobal ? null : win.scope.sellerIds;
  if (Array.isArray(sellerIds) && sellerIds.length === 0) {
    return { ads: null, acos: null, sellerTargets: [], months: win.period.months };
  }

  const request = win.request();
  const monthConditions = win.period.months.map((ym) => {
    const [y, m] = ym.split('-').map(Number);
    return `(t.Year = ${y} AND ((t.TargetType = 'MONTHLY' AND t.Month = ${m}) OR (t.TargetType = 'YEARLY' AND b.PeriodValue = ${m})))`;
  }).join(' OR ');

  let sellerClause = '';
  if (Array.isArray(sellerIds)) {
    const placeholders = sellerIds.map((id, i) => {
      const name = `tgtSeller_${i}`;
      request.input(name, sql.VarChar, id);
      return `@${name}`;
    });
    sellerClause = ` AND t.SellerId IN (${placeholders.join(', ')})`;
  }

  const result = await request.query(`
    SELECT t.SellerId, t.GoalType, ISNULL(b.PeriodValue, t.Month) AS Month, t.Year,
           ISNULL(b.TargetValue, t.TotalTargetValue) AS TotalTargetValue
    FROM GmsTargets t
    LEFT JOIN GmsTargetBreakdowns b ON t.Id = b.TargetId AND b.PeriodType = 'MONTH'
    WHERE (${monthConditions || '1 = 0'})
      ${sellerClause}
      AND t.GoalType IN ('ADS', 'ACOS')
  `);

  const rows = (result.recordset || []).map((r) => ({
    sellerId: r.SellerId, goalType: r.GoalType, month: num(r.Month), year: num(r.Year), target: num(r.TotalTargetValue),
  }));

  const sumBy = (goalType) => rows.filter((r) => r.goalType === goalType).reduce((s, r) => s + r.target, 0);
  const adsTarget = sumBy('ADS');
  const acosValues = rows.filter((r) => r.goalType === 'ACOS' && r.target > 0);
  const acosTarget = acosValues.length ? acosValues.reduce((s, r) => s + r.target, 0) / acosValues.length : null;

  return {
    ads: adsTarget > 0 ? { target: adsTarget, months: win.period.months.length } : null,
    acos: acosTarget !== null ? { target: acosTarget, sampleSize: acosValues.length } : null,
    sellerTargets: rows,
    months: win.period.months,
  };
}

/** Coverage and freshness — how much data actually backs this view. */
async function fetchFreshness(win) {
  const [summaryResult, daysResult] = await Promise.all([
    win.request().query(`
      SELECT
        CONVERT(varchar(10), MAX(p.Date), 23) AS lastDate,
        CONVERT(varchar(19), MAX(p.UploadedAt), 120) AS lastUpload,
        COUNT(*) AS rowCount,
        COUNT(DISTINCT p.Asin) AS asinCount
      FROM AdsPerformance p
      ${win.joins}
      ${win.where({ span: 'current' })}
    `),
    win.request().query(`
      SELECT CONVERT(varchar(10), p.Date, 23) AS d
      FROM AdsPerformance p
      ${win.joins}
      ${win.where({ span: 'current' })}
      GROUP BY CONVERT(varchar(10), p.Date, 23)
      ORDER BY d ASC
    `),
  ]);

  const row = summaryResult.recordset?.[0] || {};
  const present = new Set((daysResult.recordset || []).map((r) => r.d));
  const gapDays = [];
  if (present.size > 0) {
    const last = row.lastDate || win.period.end;
    let cursor = win.period.start;
    while (cursor <= win.period.end && cursor <= last && gapDays.length < 90) {
      if (!present.has(cursor)) gapDays.push(cursor);
      cursor = addDays(cursor, 1);
    }
  }

  return {
    lastDate: row.lastDate || null,
    lastUpload: row.lastUpload || null,
    rowCount: num(row.rowCount),
    asinCount: num(row.asinCount),
    daysCovered: present.size,
    daysInWindow: win.period.days,
    gapDays,
    complete: present.size > 0 && gapDays.length === 0,
  };
}

/** Daily history for one key (drill-down). */
async function fetchKeyHistory(win, key, groupBy = 'asin') {
  if (!key) return [];
  const keyExprText = win.keyExpr(groupBy);
  const request = win.request().input('drillKey', sql.VarChar, String(key).slice(0, 64));
  const result = await request.query(`
    SELECT
      CONVERT(varchar(10), p.Date, 23) AS date,
      ${METRIC_SELECT(win.currentWindowSql, 'cur_')}
    FROM AdsPerformance p
    ${win.joins}
    ${win.where({ span: 'current' })}
      AND ${keyExprText} = @drillKey
    GROUP BY CONVERT(varchar(10), p.Date, 23)
    ORDER BY date ASC
  `);
  return (result.recordset || []).map((row) => ({
    date: row.date,
    ...deriveMetrics({
      spend: row.cur_spend, sales: row.cur_sales, organicSales: row.cur_organicSales,
      orders: row.cur_orders, organicOrders: row.cur_organicOrders,
      impressions: row.cur_impressions, clicks: row.cur_clicks,
      units: row.cur_units, pageViews: row.cur_pageViews, sameSkuSales: row.cur_sameSkuSales,
    }),
  }));
}

/** Sparkline series for a bounded set of keys, chunked under the param ceiling. */
async function fetchSparklines(win, keys, groupBy = 'asin') {
  const unique = [...new Set((keys || []).filter(Boolean).map(String))].slice(0, 500);
  if (unique.length === 0) return {};

  const keyExprText = win.keyExpr(groupBy);
  const out = {};
  const CHUNK = 400;

  for (let i = 0; i < unique.length; i += CHUNK) {
    const slice = unique.slice(i, i + CHUNK);
    const request = win.request();
    const placeholders = slice.map((value, idx) => {
      const name = `sparkKey_${idx}`;
      request.input(name, sql.VarChar, value);
      return `@${name}`;
    });
    const result = await request.query(`
      SELECT
        ${keyExprText} AS key,
        CONVERT(varchar(10), p.Date, 23) AS date,
        ${METRIC_SELECT(win.currentWindowSql, 'cur_')}
      FROM AdsPerformance p
      ${win.joins}
      ${win.where({ span: 'current' })}
        AND ${keyExprText} IN (${placeholders.join(', ')})
      GROUP BY ${keyExprText}, CONVERT(varchar(10), p.Date, 23)
      ORDER BY date ASC
    `);
    for (const row of result.recordset || []) {
      const bucket = out[row.key] || (out[row.key] = { dates: [], spend: [], sales: [], totalSales: [], acos: [] });
      const metrics = deriveMetrics({
        spend: row.cur_spend, sales: row.cur_sales, organicSales: row.cur_organicSales,
        orders: row.cur_orders, impressions: row.cur_impressions, clicks: row.cur_clicks,
      });
      bucket.dates.push(row.date);
      bucket.spend.push(metrics.spend);
      bucket.sales.push(metrics.sales);
      bucket.totalSales.push(metrics.totalSales);
      bucket.acos.push(metrics.acos);
    }
  }
  return out;
}

/** Filter options, scoped to what the caller may see. */
async function fetchFilterOptions(win) {
  const result = await win.request().query(`
    SELECT DISTINCT a.SellerId, s.Name AS sellerName, s.Marketplace, a.Brand, a.Category
    FROM AdsPerformance p
    ${win.joins}
    ${win.where({ span: 'current' })}
  `);

  const sellers = new Map();
  const brands = new Set();
  const categories = new Set();
  for (const row of result.recordset || []) {
    if (row.SellerId) {
      sellers.set(row.SellerId, {
        id: row.SellerId, name: row.sellerName || row.SellerId, marketplace: row.Marketplace || null,
      });
    }
    if (row.Brand) brands.add(row.Brand);
    if (row.Category) categories.add(row.Category);
  }

  return {
    sellers: [...sellers.values()].sort((a, b) => a.name.localeCompare(b.name)),
    brands: [...brands].sort((a, b) => a.localeCompare(b)),
    categories: [...categories].sort((a, b) => a.localeCompare(b)),
    scope: {
      isGlobal: win.scope.isGlobal,
      assignedSellers: win.scope.allowed,
      requestedSellers: win.scope.requested,
    },
  };
}

/** Month-by-month breakdown across the window (for the Ads Report surface). */
async function fetchMonthBreakdown(win) {
  const bucket = bucketExpr('month');
  const result = await win.request().query(`
    SELECT
      ${bucket} AS bucket,
      ${METRIC_SELECT(win.currentWindowSql, 'cur_')}
    FROM AdsPerformance p
    ${win.joins}
    ${win.where({ span: 'current' })}
    GROUP BY ${bucket}
    ORDER BY bucket ASC
  `);

  return (result.recordset || []).map((row) => ({
    key: row.bucket,
    monthIndex: Number(String(row.bucket).slice(5, 7)),
    year: Number(String(row.bucket).slice(0, 4)),
    ...deriveMetrics({
      spend: row.cur_spend, sales: row.cur_sales, organicSales: row.cur_organicSales,
      orders: row.cur_orders, organicOrders: row.cur_organicOrders,
      impressions: row.cur_impressions, clicks: row.cur_clicks,
      units: row.cur_units, pageViews: row.cur_pageViews, sameSkuSales: row.cur_sameSkuSales,
    }),
  }));
}

/** The full overview payload: totals, series, mixes, movers, efficiency, targets, freshness. */
async function fetchOverview(win, options = {}) {
  const groupBy = options.groupBy === 'parent' ? 'parent' : 'asin';

  const [seriesData, mix, movers, efficiency, targets, freshness] = await Promise.all([
    fetchSeries(win),
    fetchMix(win),
    fetchMovers(win, { groupBy, limit: options.moverLimit || 6 }),
    fetchEfficiency(win, { groupBy, wasteSpendFloor: options.wasteSpendFloor }),
    fetchTargets(win).catch(() => ({ ads: null, acos: null, sellerTargets: [], months: win.period.months })),
    fetchFreshness(win).catch(() => ({
      lastDate: null, lastUpload: null, rowCount: 0, asinCount: 0,
      daysCovered: 0, daysInWindow: win.period.days, gapDays: [], complete: false,
    })),
  ]);

  // Sparklines for the movers actually being shown (bounded, chunked).
  const moverKeys = [
    ...movers.gainers.slice(0, 6), ...movers.decliners.slice(0, 6), ...movers.spendSpikes.slice(0, 6),
  ].map((r) => r.key);
  let sparks = {};
  if (moverKeys.length > 0) {
    sparks = await fetchSparklines(win, moverKeys, groupBy).catch(() => ({}));
  }
  const withSpark = (rows) => rows.map((row) => ({ ...row, spark: sparks[row.key]?.totalSales || [] }));

  const totals = seriesData.currentTotals;
  const previous = seriesData.previousTotals;
  const delta = deltaSet(totals, previous);

  // Target attainment is derived here so rules + UI agree on the numbers.
  const targetSummary = {
    ads: targets.ads ? {
      target: targets.ads.target,
      actual: totals.spend,
      attainmentPct: targets.ads.target > 0 ? (totals.spend / targets.ads.target) * 100 : null,
      remaining: Math.max(0, targets.ads.target - totals.spend),
      months: targets.ads.months,
    } : null,
    acos: targets.acos ? {
      target: targets.acos.target,
      actual: totals.acos,
      gapPoints: totals.acos === null ? null : totals.acos - targets.acos.target,
      onTarget: totals.acos !== null && totals.acos <= targets.acos.target,
      sampleSize: targets.acos.sampleSize,
    } : null,
    sellerTargets: targets.sellerTargets,
    months: targets.months,
  };

  return {
    period: win.period,
    scope: {
      isGlobal: win.scope.isGlobal,
      assignedSellers: win.scope.allowed,
      requestedSellers: win.scope.requested,
      sellerFilterApplied: !win.scope.isGlobal && !win.scope.unrestricted,
    },
    filters: win.filter,
    reportType: win.reportType,
    groupBy,
    totals,
    previous,
    previousAvailable: seriesData.previousAvailable,
    delta,
    series: seriesData.series,
    mix,
    movers: {
      gainers: withSpark(movers.gainers),
      decliners: withSpark(movers.decliners),
      spendSpikes: withSpark(movers.spendSpikes),
    },
    efficiency,
    targets: targetSummary,
    freshness,
  };
}

module.exports = {
  resolvePeriod,
  deriveMetrics,
  pctDelta,
  pointDelta,
  deltaSet,
  buildAxis,
  bucketExpr,
  shapeKeyRow,
  AdsWindow,
  fetchSeries,
  fetchMix,
  fetchRows,
  fetchMovers,
  fetchEfficiency,
  fetchTargets,
  fetchFreshness,
  fetchKeyHistory,
  fetchSparklines,
  fetchFilterOptions,
  fetchMonthBreakdown,
  fetchOverview,
  SORTABLE,
  FLAGS,
};
