/**
 * Ads Intelligence controller.
 *
 * One module, three surfaces (Ads Manager, Ads Report, AI Analyst) over a
 * single scoped analytics service. Every endpoint:
 *   1. is behind `authenticate` + an explicit ads permission (route level),
 *   2. resolves the caller's seller scope before touching the database,
 *   3. returns 403 `forbidden_seller` when the caller asked for a seller they
 *      are not assigned to — never a silently widened or narrowed result,
 *   4. returns empty data (not "everything") when the scope resolves to nothing.
 */

const { getPool } = require('../database/db');
const analytics = require('../services/adsAnalytics');
const { buildInsights } = require('../services/adsInsights');
const { generateNarrative } = require('../services/adsAiService');

const ok = (res, data, extra = {}) => res.json({ success: true, data, ...extra });

const fail = (res, status, code, message, details = {}) =>
  res.status(status).json({ success: false, code, message, ...details });

/** Build a scoped window from the request (adds the pool once per request). */
async function makeWindow(req, queryOverride = null) {
  const pool = await getPool();
  return new analytics.AdsWindow({
    user: req.user,
    query: queryOverride || { ...req.query, ...req.body },
    pool,
  });
}

/** 403 payload carrying enough context for the UI to explain the block. */
function denyScope(res, win) {
  return fail(res, 403, 'forbidden_seller', 'You do not have access to the requested seller(s).', {
    requestedSellers: win.scope.requested,
    assignedSellers: win.scope.allowed,
  });
}

const emptyScopePayload = (win) => ({
  period: win.period,
  scope: {
    isGlobal: win.scope.isGlobal,
    assignedSellers: win.scope.allowed,
    sellerFilterApplied: true,
    empty: true,
  },
  totals: analytics.deriveMetrics({}),
  previous: analytics.deriveMetrics({}),
  series: { keys: [], current: {}, previous: {}, metrics: [] },
  mix: { seller: [], brand: [], category: [] },
  movers: { gainers: [], decliners: [], spendSpikes: [] },
  efficiency: { buckets: [], scatter: [], waste: { zeroSales: { keys: 0, spend: 0, rows: [] }, highAcos: { keys: 0, spend: 0, sales: 0, thresholdPct: 40 } } },
  targets: { ads: null, acos: null, sellerTargets: [], months: [] },
  freshness: { lastDate: null, lastUpload: null, rowCount: 0, asinCount: 0, daysCovered: 0, daysInWindow: win.period.days, gapDays: [], complete: false },
  empty: true,
});

/* ───────────────────────────── Ads Manager ─────────────────────────────── */

/**
 * GET /api/ads/overview
 * Everything the manager dashboard needs in one round-trip: KPIs, chart series,
 * mixes, movers, efficiency bands, target attainment, freshness and the
 * deterministic insight list.
 */
exports.getOverview = async (req, res) => {
  try {
    const win = await makeWindow(req);
    if (win.denied) return denyScope(res, win);
    if (win.empty) return ok(res, { ...emptyScopePayload(win), insights: { insights: [], counts: {}, headline: 'No sellers assigned.' } });

    const overview = await analytics.fetchOverview(win, {
      groupBy: req.query.groupBy,
      moverLimit: req.query.moverLimit,
      wasteSpendFloor: req.query.wasteSpendFloor,
    });

    const insights = buildInsights(overview);
    return ok(res, { ...overview, insights });
  } catch (error) {
    console.error('[adsController.getOverview]', error);
    return fail(res, 500, 'overview_failed', error.message);
  }
};

/** GET /api/ads/series — chart-only refresh when granularity changes. */
exports.getSeries = async (req, res) => {
  try {
    const win = await makeWindow(req);
    if (win.denied) return denyScope(res, win);
    if (win.empty) return ok(res, { series: { keys: [], current: {}, previous: {}, metrics: [] }, currentTotals: analytics.deriveMetrics({}), previousTotals: analytics.deriveMetrics({}), previousAvailable: false });

    const data = await analytics.fetchSeries(win);
    return ok(res, { ...data, period: win.period, scope: { isGlobal: win.scope.isGlobal } });
  } catch (error) {
    console.error('[adsController.getSeries]', error);
    return fail(res, 500, 'series_failed', error.message);
  }
};

/**
 * GET /api/ads/table
 * Server-side paginated/sorted/filtered key table. This is the fix for F3:
 * the old page fetched every row and paginated in the browser.
 */
exports.getTable = async (req, res) => {
  try {
    const win = await makeWindow(req);
    if (win.denied) return denyScope(res, win);

    const empty = win.empty
      ? { groupBy: req.query.groupBy === 'parent' ? 'parent' : 'asin', page: 1, limit: Number(req.query.limit) || 50, total: 0, totalPages: 1, rows: [], totals: analytics.deriveMetrics({}), previous: analytics.deriveMetrics({}), delta: {}, appliedFilters: {} }
      : await analytics.fetchRows(win, {
        groupBy: req.query.groupBy,
        page: req.query.page,
        limit: req.query.limit,
        sortBy: req.query.sortBy,
        sortOrder: req.query.sortOrder,
        flag: req.query.flag,
        search: req.query.search,
        minTotalSales: req.query.minTotalSales,
        wasteSpendFloor: req.query.wasteSpendFloor,
        highAcosThreshold: req.query.highAcosThreshold,
      });

    // Sparklines for this page only (bounded: max 200 keys, chunked in SQL).
    if (!win.empty && empty.rows.length > 0) {
      const sparks = await analytics
        .fetchSparklines(win, empty.rows.map((r) => r.key), empty.groupBy)
        .catch(() => ({}));
      empty.rows = empty.rows.map((row) => ({ ...row, spark: sparks[row.key]?.totalSales || [] }));
    }

    return ok(res, { ...empty, period: win.period, scope: { isGlobal: win.scope.isGlobal } });
  } catch (error) {
    console.error('[adsController.getTable]', error);
    return fail(res, 500, 'table_failed', error.message);
  }
};

/** GET /api/ads/history?key=… — daily drill-down for one ASIN/parent. */
exports.getHistory = async (req, res) => {
  try {
    const key = req.query.key || req.query.asin;
    if (!key) return fail(res, 400, 'key_required', 'A key (ASIN or parent ASIN) is required.');
    const win = await makeWindow(req);
    if (win.denied) return denyScope(res, win);
    if (win.empty) return ok(res, { key, groupBy: req.query.groupBy === 'parent' ? 'parent' : 'asin', days: [] });

    const days = await analytics.fetchKeyHistory(win, key, req.query.groupBy);
    const totals = days.reduce((acc, day) => {
      const merged = analytics.deriveMetrics({});
      return { ...acc, ...merged };
    }, {});
    return ok(res, { key, groupBy: req.query.groupBy === 'parent' ? 'parent' : 'asin', period: win.period, days, totals });
  } catch (error) {
    console.error('[adsController.getHistory]', error);
    return fail(res, 500, 'history_failed', error.message);
  }
};

/** GET /api/ads/filter-options — scope-aware dropdown contents. */
exports.getFilterOptions = async (req, res) => {
  try {
    const win = await makeWindow(req);
    if (win.denied) return denyScope(res, win);
    if (win.empty) {
      return ok(res, {
        sellers: win.scope.allowed.map((id) => ({ id, name: id, marketplace: null })),
        brands: [], categories: [], scope: { isGlobal: win.scope.isGlobal, assignedSellers: win.scope.allowed },
      });
    }
    const options = await analytics.fetchFilterOptions(win);
    return ok(res, options);
  } catch (error) {
    console.error('[adsController.getFilterOptions]', error);
    return fail(res, 500, 'filter_options_failed', error.message);
  }
};

/* ───────────────────────────── Ads Report ──────────────────────────────── */

/** Aggregate GmsTargets rows into month buckets and per-seller totals. */
function rollUpTargets(rows = []) {
  const byMonth = new Map();
  const bySeller = new Map();
  for (const row of rows) {
    const monthKey = `${row.year}-${String(row.month).padStart(2, '0')}`;
    if (row.goalType === 'ADS') {
      byMonth.set(monthKey, (byMonth.get(monthKey) || 0) + row.target);
      const seller = bySeller.get(row.sellerId) || { ads: 0, acosSum: 0, acosCount: 0 };
      seller.ads += row.target;
      bySeller.set(row.sellerId, seller);
    } else if (row.goalType === 'ACOS' && row.target > 0) {
      const seller = bySeller.get(row.sellerId) || { ads: 0, acosSum: 0, acosCount: 0 };
      seller.acosSum += row.target;
      seller.acosCount += 1;
      bySeller.set(row.sellerId, seller);
    }
  }
  return { byMonth, bySeller };
}

/**
 * GET /api/ads/report
 * Month-by-month performance against ADS/ACoS targets, plus per-seller
 * attainment. Replaces the legacy Ads Report page.
 */
exports.getReport = async (req, res) => {
  try {
    const query = { ...req.query, ...req.body };
    const today = new Date();
    if (!query.startDate) {
      const months = Math.min(24, Math.max(3, parseInt(query.months, 10) || 12));
      const start = new Date(today.getFullYear(), today.getMonth() - (months - 1), 1);
      query.startDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`;
    }
    if (!query.endDate) {
      query.endDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }
    query.granularity = query.granularity || 'month';

    const win = await makeWindow(req, query);
    if (win.denied) return denyScope(res, win);
    if (win.empty) {
      return ok(res, { period: win.period, months: [], sellers: [], mix: { seller: [], brand: [], category: [] }, targets: {}, freshness: emptyScopePayload(win).freshness, empty: true });
    }

    const [monthRows, mix, targets, freshness] = await Promise.all([
      analytics.fetchMonthBreakdown(win),
      analytics.fetchMix(win),
      analytics.fetchTargets(win).catch(() => ({ ads: null, acos: null, sellerTargets: [], months: win.period.months })),
      analytics.fetchFreshness(win).catch(() => ({ lastDate: null, rowCount: 0, gapDays: [], daysCovered: 0, daysInWindow: win.period.days })),
    ]);

    const { byMonth, bySeller } = rollUpTargets(targets.sellerTargets || []);

    const months = monthRows.map((row) => {
      const adsTarget = byMonth.get(row.key) || 0;
      return {
        ...row,
        adsTarget: adsTarget || null,
        attainmentPct: adsTarget > 0 ? (row.spend / adsTarget) * 100 : null,
        remaining: adsTarget > 0 ? adsTarget - row.spend : null,
      };
    });

    const sellers = (mix.seller || []).map((seller) => {
      const target = bySeller.get(seller.id) || null;
      const acosTarget = target && target.acosCount > 0 ? target.acosSum / target.acosCount : null;
      return {
        sellerId: seller.id,
        name: seller.name,
        marketplace: seller.marketplace,
        spend: seller.spend,
        sales: seller.sales,
        organicSales: seller.organicSales,
        totalSales: seller.totalSales,
        orders: seller.orders,
        acos: seller.acos,
        tacos: seller.tacos,
        roas: seller.roas,
        share: seller.share,
        adsTarget: target && target.ads > 0 ? target.ads : null,
        attainmentPct: target && target.ads > 0 ? (seller.spend / target.ads) * 100 : null,
        acosTarget,
        acosGapPoints: acosTarget !== null && seller.acos !== null ? seller.acos - acosTarget : null,
        onAcosTarget: acosTarget !== null && seller.acos !== null ? seller.acos <= acosTarget : null,
      };
    });

    const totals = months.reduce((acc, month) => ({
      spend: acc.spend + month.spend,
      sales: acc.sales + month.sales,
      organicSales: acc.organicSales + month.organicSales,
      totalSales: acc.totalSales + month.totalSales,
      orders: acc.orders + month.orders,
      impressions: acc.impressions + month.impressions,
      clicks: acc.clicks + month.clicks,
      units: acc.units + month.units,
      adsTarget: acc.adsTarget + (month.adsTarget || 0),
    }), { spend: 0, sales: 0, organicSales: 0, totalSales: 0, orders: 0, impressions: 0, clicks: 0, units: 0, adsTarget: 0 });

    return ok(res, {
      period: win.period,
      reportType: win.reportType,
      scope: { isGlobal: win.scope.isGlobal, assignedSellers: win.scope.allowed },
      filters: win.filter,
      months,
      sellers,
      mix: { brand: mix.brand, category: mix.category },
      targets: {
        ads: targets.ads,
        acos: targets.acos,
        byMonth: Object.fromEntries(byMonth),
      },
      totals: {
        ...analytics.deriveMetrics(totals),
        adsTarget: totals.adsTarget || null,
        attainmentPct: totals.adsTarget > 0 ? (totals.spend / totals.adsTarget) * 100 : null,
      },
      freshness,
    });
  } catch (error) {
    console.error('[adsController.getReport]', error);
    return fail(res, 500, 'report_failed', error.message);
  }
};

/* ───────────────────────────── AI Analyst ──────────────────────────────── */

/**
 * GET /api/ads/insights
 * Deterministic rules only — free, instant, always available. The Analyser
 * page renders this without any AI call.
 */
exports.getInsights = async (req, res) => {
  try {
    const win = await makeWindow(req);
    if (win.denied) return denyScope(res, win);
    if (win.empty) {
      return ok(res, buildInsights(emptyScopePayload(win)));
    }
    const overview = await analytics.fetchOverview(win, {
      groupBy: req.query.groupBy,
      wasteSpendFloor: req.query.wasteSpendFloor,
    });
    return ok(res, buildInsights(overview));
  } catch (error) {
    console.error('[adsController.getInsights]', error);
    return fail(res, 500, 'insights_failed', error.message);
  }
};

/**
 * POST /api/ads/ai-review
 * On-demand LLM narrative. The overview is recomputed server-side from the
 * caller's own scope — the client never supplies the numbers, so a crafted
 * request body cannot feed the model fabricated data.
 *
 * Body: { ...same filters as /overview, question?: string, force?: boolean }
 */
exports.postAiReview = async (req, res) => {
  try {
    const question = req.body?.question ? String(req.body.question).slice(0, 400) : null;
    const win = await makeWindow(req);
    if (win.denied) return denyScope(res, win);

    if (win.empty) {
      return fail(res, 422, 'no_scope', 'No sellers are assigned to your account, so there is nothing to analyse.');
    }

    const overview = await analytics.fetchOverview(win, {
      groupBy: req.body?.groupBy || req.query.groupBy,
      wasteSpendFloor: req.body?.wasteSpendFloor || req.query.wasteSpendFloor,
    });
    const insights = buildInsights(overview);

    if (!overview.freshness?.lastDate) {
      return fail(res, 422, 'no_data', 'No ads rows exist for this window — an AI review would have nothing to reason about.', {
        period: win.period,
      });
    }

    const { narrative, provider, ms, error } = await generateNarrative({ overview, insights: insights.insights, question });

    if (!narrative) {
      // The deterministic layer still works; the UI shows it and this message.
      return fail(res, 502, 'ai_unavailable', error || 'The AI provider did not return a usable response.', {
        fallback: { insights: insights.insights, headline: insights.headline },
      });
    }

    return ok(res, {
      narrative,
      provider,
      latencyMs: ms,
      period: win.period,
      scope: { isGlobal: win.scope.isGlobal, assignedSellers: win.scope.allowed },
      generatedAt: new Date().toISOString(),
      grounding: {
        insightsUsed: insights.insights.length,
        ruleIds: insights.insights.map((i) => i.id),
      },
    });
  } catch (error) {
    console.error('[adsController.postAiReview]', error);
    return fail(res, 500, 'ai_review_failed', error.message);
  }
};

/** GET /api/ads/meta — thresholds and capabilities, so the UI explains itself. */
exports.getMeta = async (req, res) => {
  const insights = buildInsights(emptyScopePayload({ period: analytics.resolvePeriod({}), scope: { isGlobal: !req.user?.assignedSellers?.length, allowed: [], requested: [] }, freshness: {} }));
  return ok(res, {
    thresholds: insights.thresholds,
    sortable: [...analytics.SORTABLE],
    flags: [...analytics.FLAGS],
    granularities: ['auto', 'day', 'week', 'month'],
  });
};
