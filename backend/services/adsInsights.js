/**
 * Ads insights — the deterministic rules engine.
 *
 * The Ads Analyst view always renders *these*: pure functions over the payload
 * built by `adsAnalytics.fetchOverview()`. No network calls, no randomness, no
 * invented numbers — every insight quotes a metric that exists in the payload.
 *
 * Rule shape matches the frontend convention used across opsCenter:
 *   { id, tone: 'pos'|'neg'|'warn'|'info', priority: 0-100, text, detail,
 *     target, metrics: { label: value } }
 * `target` is a DOM/panel id the UI scrolls to when the insight is clicked.
 */

const TONE_ORDER = { neg: 0, warn: 1, pos: 2, info: 3 };

const fmtINR = (value) => {
  const n = Number(value) || 0;
  if (Math.abs(n) >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (Math.abs(n) >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  if (Math.abs(n) >= 1e3) return `₹${(n / 1e3).toFixed(1)} K`;
  return `₹${n.toFixed(0)}`;
};
const fmtPct = (value, digits = 2) => (value === null || value === undefined || Number.isNaN(Number(value))
  ? '—'
  : `${Number(value).toFixed(digits)}%`);
const fmtNum = (value) => new Intl.NumberFormat('en-IN').format(Math.round(Number(value) || 0));
const signed = (value, digits = 1, suffix = '%') => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  const n = Number(value);
  return `${n > 0 ? '+' : ''}${n.toFixed(digits)}${suffix}`;
};

/** Elapsed share of the calendar month containing `dateStr` (for budget pacing). */
function monthProgress(dateStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  if (!y || !m || !d) return null;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { elapsed: d, daysInMonth, pct: (d / daysInMonth) * 100 };
}

function round(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  const f = 10 ** digits;
  return Math.round(Number(value) * f) / f;
}

/**
 * Build the insight list.
 * @param {object} overview - payload from fetchOverview()
 * @param {object} [options] - thresholds (all overridable for tests/tenants)
 * @returns {{generatedFor: object, insights: Array, counts: object}}
 */
function buildInsights(overview = {}, options = {}) {
  const t = {
    minWasteSpend: 1000,
    highAcos: 40,
    targetAcos: 30,
    lowCtr: 0.35,
    minImpressionsForCtr: 5000,
    lowCvr: 5,
    minClicksForCvr: 50,
    staleDays: 2,
    concentrationPct: 60,
    materialDeltaPct: 5,
    ...options,
  };

  const totals = overview.totals || {};
  const previous = overview.previous || {};
  const delta = overview.delta || {};
  const freshness = overview.freshness || {};
  const targets = overview.targets || {};
  const efficiency = overview.efficiency || {};
  const mix = overview.mix || {};
  const movers = overview.movers || {};
  const period = overview.period || {};
  const insights = [];

  const push = (insight) => {
    if (!insight || !insight.text) return;
    insights.push({
      tone: 'info',
      priority: 50,
      metrics: {},
      ...insight,
    });
  };

  /* ── 1. Data integrity first: never analyse numbers we can't trust. ────── */
  if (!freshness.lastDate) {
    push({
      id: 'no-data',
      tone: 'warn',
      priority: 100,
      target: 'panel-freshness',
      text: `No ${overview.reportType || 'daily'} ads rows found for ${period.start} → ${period.end}.`,
      detail: 'Nothing to analyse until uploads cover this window. Every other insight below is suppressed by design.',
      metrics: { Window: period.label || '—', 'Days in window': fmtNum(period.days) },
    });
  } else {
    const lagDays = Math.round((Date.parse(`${period.end}T00:00:00Z`) - Date.parse(`${freshness.lastDate}T00:00:00Z`)) / 86400000);
    if (lagDays > t.staleDays) {
      push({
        id: 'stale-data',
        tone: 'warn',
        priority: 92,
        target: 'panel-freshness',
        text: `Ads data ends ${freshness.lastDate} — ${lagDays} days before the end of the selected window.`,
        detail: `Totals for ${period.label} are understated by the missing days. Re-upload the daily ads export before acting on budget pacing.`,
        metrics: { 'Last row': freshness.lastDate, 'Days behind': fmtNum(lagDays), 'Days covered': `${freshness.daysCovered}/${freshness.daysInWindow}` },
      });
    }
    if ((freshness.gapDays || []).length > 0) {
      push({
        id: 'coverage-gaps',
        tone: 'warn',
        priority: 78,
        target: 'panel-freshness',
        text: `${freshness.gapDays.length} day(s) have no ads rows inside this window.`,
        detail: `Missing: ${freshness.gapDays.slice(0, 6).join(', ')}${freshness.gapDays.length > 6 ? '…' : ''}. ACoS moves on partial windows are usually quoting a reporting gap, not a real shift.`,
        metrics: { 'Gaps': fmtNum(freshness.gapDays.length), 'Rows in window': fmtNum(freshness.rowCount) },
      });
    }
  }

  const hasData = Number(freshness.rowCount) > 0 && Number(totals.spend) >= 0;
  const analysable = hasData && Number(totals.impressions) + Number(totals.spend) > 0;

  if (analysable) {
    /* ── 2. Target tracking (ADS spend + ACoS), when targets exist. ─────── */
    if (targets.acos && targets.acos.target > 0 && totals.acos !== null) {
      const gap = Number(targets.acos.target) - Number(totals.acos);
      if (gap >= 0) {
        push({
          id: 'acos-target-met',
          tone: 'pos',
          priority: 84,
          target: 'panel-targets',
          text: `ACoS ${fmtPct(totals.acos)} is inside the ${fmtPct(targets.acos.target)} target for ${targets.months?.length || 1} month(s) in view.`,
          detail: `${fmtINR(totals.spend)} spend produced ${fmtINR(totals.sales)} ad sales — ${fmtPct(Math.abs(gap), 1)} of headroom before the ceiling is hit.`,
          metrics: { ACoS: fmtPct(totals.acos), Target: fmtPct(targets.acos.target), Headroom: `${fmtPct(gap, 1)} pts` },
        });
      } else {
        push({
          id: 'acos-target-miss',
          tone: 'neg',
          priority: 96,
          target: 'panel-targets',
          text: `ACoS ${fmtPct(totals.acos)} is ${fmtPct(Math.abs(gap), 1)} pts over the ${fmtPct(targets.acos.target)} target.`,
          detail: `At this rate the month closes ${fmtINR(Number(totals.spend) - (Number(totals.sales) * Number(targets.acos.target)) / 100)} above the spend the target implies. Trim the >40% ACoS band first — it is the fastest lever.`,
          metrics: { ACoS: fmtPct(totals.acos), Target: fmtPct(targets.acos.target), 'Over by': `${fmtPct(Math.abs(gap), 1)} pts` },
        });
      }
    }

    if (targets.ads && targets.ads.target > 0) {
      const attainment = Number(targets.ads.attainmentPct) || 0;
      const progress = monthProgress(period.end);
      const expected = progress ? progress.pct : null;
      const behind = expected !== null && attainment < expected - 10;
      const ahead = expected !== null && attainment > expected + 10;
      push({
        id: behind ? 'ads-budget-behind' : ahead ? 'ads-budget-ahead' : 'ads-budget-onpace',
        tone: behind ? 'warn' : ahead ? 'info' : 'pos',
        priority: behind ? 74 : 60,
        target: 'panel-targets',
        text: `ADS spend ${fmtINR(totals.spend)} is ${fmtPct(attainment, 0)} of the ${fmtINR(targets.ads.target)} target${expected !== null ? ` with ${fmtPct(expected, 0)} of the month elapsed` : ''}.`,
        detail: behind
          ? `Under-pacing by ~${fmtPct(expected - attainment, 0)} of the budget. Confirm this is deliberate; if not, check paused campaigns and out-of-stock ASINs in the table below.`
          : ahead
            ? `Pacing ahead of the calendar. Verify the spend is converting — see the ACoS band split before adding more.`
            : 'Spend is tracking the calendar; no action required on pace alone.',
        metrics: { Spend: fmtINR(totals.spend), Target: fmtINR(targets.ads.target), Attainment: fmtPct(attainment, 0) },
      });
    }

    /* ── 3. Period-over-period efficiency. ─────────────────────────────── */
    if (overview.previousAvailable && (Number(previous.spend) > 0 || Number(previous.totalSales) > 0)) {
      const acosMove = (totals.acos !== null && previous.acos !== null) ? totals.acos - previous.acos : null;
      const salesMove = delta.totalSales;

      if (acosMove !== null && Math.abs(acosMove) >= 3) {
        const worse = acosMove > 0;
        push({
          id: worse ? 'acos-worsening' : 'acos-improving',
          tone: worse ? 'neg' : 'pos',
          priority: worse ? 90 : 76,
          target: 'panel-trends',
          text: `ACoS moved ${signed(acosMove, 1, ' pts')} vs the previous ${period.days}-day period (${fmtPct(previous.acos)} → ${fmtPct(totals.acos)}).`,
          detail: `Ad sales ${worse ? 'grew slower than' : 'outpaced'} spend: sales ${signed(delta.sales, 1)} vs spend ${signed(delta.spend, 1)}. ${worse ? 'The mix shifted toward expensive placements or bids were raised without a matching conversion gain.' : 'Efficiency improved while volume was preserved.'}`,
          metrics: { 'ACoS now': fmtPct(totals.acos), 'ACoS before': fmtPct(previous.acos), 'Δ spend': signed(delta.spend), 'Δ ad sales': signed(delta.sales) },
        });
      }

      if (salesMove !== null && Math.abs(salesMove) >= t.materialDeltaPct) {
        const up = salesMove > 0;
        const spendMove = Number(delta.spend) || 0;
        const efficiencyGain = up && spendMove < salesMove;
        push({
          id: up ? (efficiencyGain ? 'growth-efficient' : 'growth-costly') : 'sales-decline',
          tone: up ? (efficiencyGain ? 'pos' : 'warn') : 'neg',
          priority: up ? (efficiencyGain ? 70 : 80) : 86,
          target: 'panel-trends',
          text: `Total sales ${signed(salesMove)} to ${fmtINR(totals.totalSales)} vs ${fmtINR(previous.totalSales)} last period.`,
          detail: `Spend ${signed(spendMove)} and organic sales ${signed(delta.organicSales)}. ${efficiencyGain ? 'Growth is cheaper than last period — protect what is working.' : up ? 'Spend is climbing faster than sales; the incremental rupees are less efficient.' : 'Decline is driven by the keys listed under Movers — check them before reallocating budget.'}`,
          metrics: { 'Total sales': fmtINR(totals.totalSales), 'Ad sales': fmtINR(totals.sales), 'Organic': fmtINR(totals.organicSales), 'Δ total': signed(salesMove) },
        });
      }

      const spendSpikes = movers.spendSpikes || [];
      const unproductive = spendSpikes.filter((r) => (r.deltaTotalSales ?? 0) <= 0).slice(0, 3);
      if (unproductive.length > 0) {
        const extra = unproductive.reduce((s, r) => s + Math.max(0, Number(r.deltaSpend) || 0), 0);
        push({
          id: 'spend-without-sales',
          tone: 'neg',
          priority: 88,
          target: 'panel-movers',
          text: `${unproductive.length} key(s) added ${fmtINR(extra)} spend without adding sales.`,
          detail: `${unproductive.map((r) => `${r.key} (+${fmtINR(r.deltaSpend)} spend, ${signed(r.deltaTotalSalesPct, 0)} sales)`).join('; ')}.`,
          metrics: { Keys: fmtNum(unproductive.length), 'Extra spend': fmtINR(extra) },
          rows: unproductive,
        });
      }
    }

    /* ── 4. Waste and efficiency bands. ───────────────────────────────── */
    const zero = efficiency.waste?.zeroSales;
    if (zero && Number(zero.spend) >= t.minWasteSpend) {
      const share = Number(totals.spend) > 0 ? (Number(zero.spend) / Number(totals.spend)) * 100 : null;
      push({
        id: 'zero-sales-waste',
        tone: 'neg',
        priority: 95,
        target: 'panel-efficiency',
        text: `${fmtNum(zero.keys)} key(s) spent ${fmtINR(zero.spend)} with zero ad sales${share !== null ? ` — ${fmtPct(share, 1)} of total spend` : ''}.`,
        detail: `Spend floor used: ${fmtINR(efficiency.waste?.spendFloor ?? t.minWasteSpend)}. ${(zero.rows || []).slice(0, 3).map((r) => `${r.key} (${fmtINR(r.spend)})`).join(', ') || 'No single key dominates'} — these are the first candidates for bid cuts or negative targeting.`,
        metrics: { Keys: fmtNum(zero.keys), Spend: fmtINR(zero.spend), 'Share of spend': share === null ? '—' : fmtPct(share, 1) },
        rows: zero.rows || [],
      });
    }

    const high = efficiency.waste?.highAcos;
    if (high && Number(high.spend) > 0) {
      push({
        id: 'high-acos-band',
        tone: high.keys > 0 ? 'warn' : 'pos',
        priority: 82,
        target: 'panel-efficiency',
        text: `${fmtNum(high.keys)} key(s) run above ${high.thresholdPct}% ACoS on ${fmtINR(high.spend)} spend.`,
        detail: `That band produced ${fmtINR(high.sales)} of ad sales. Cutting the worst third to the ${fmtPct(t.highAcos)} line would lift blended ACoS without touching volume that pays for itself.`,
        metrics: { Keys: fmtNum(high.keys), Spend: fmtINR(high.spend), Sales: fmtINR(high.sales) },
      });
    }

    const buckets = efficiency.buckets || [];
    const noSpend = buckets.find((b) => b.key === 'no_spend');
    if (noSpend && Number(noSpend.totalSales) > 0) {
      push({
        id: 'unadvertised-sales',
        tone: 'info',
        priority: 66,
        target: 'panel-efficiency',
        text: `${fmtNum(noSpend.keys)} key(s) sell ${fmtINR(noSpend.totalSales)} organically with no ad spend at all.`,
        detail: 'Most efficient place to test a first ad: the listing already converts. Start at a conservative bid and hold ACoS under the target for two weeks before scaling.',
        metrics: { Keys: fmtNum(noSpend.keys), 'Organic sales': fmtINR(noSpend.totalSales) },
      });
    }

    if (Number(totals.impressions) >= t.minImpressionsForCtr) {
      const ctr = Number(totals.ctr) || 0;
      if (ctr < t.lowCtr) {
        push({
          id: 'low-ctr',
          tone: 'warn',
          priority: 72,
          target: 'panel-trends',
          text: `CTR is ${fmtPct(ctr, 2)} on ${fmtNum(totals.impressions)} impressions — below the ${fmtPct(t.lowCtr)} working floor.`,
          detail: `Ads are being served but not clicked: usually main-image/title relevance or over-broad match types. ${fmtNum(Number(totals.impressions) - Number(totals.clicks))} impressions produced no click.`,
          metrics: { CTR: fmtPct(ctr, 2), Impressions: fmtNum(totals.impressions), Clicks: fmtNum(totals.clicks) },
        });
      }
    }

    if (Number(totals.clicks) >= t.minClicksForCvr) {
      const cvr = Number(totals.cvr) || 0;
      if (cvr < t.lowCvr) {
        push({
          id: 'low-cvr',
          tone: 'warn',
          priority: 70,
          target: 'panel-trends',
          text: `Conversion rate ${fmtPct(cvr, 2)} on ${fmtNum(totals.clicks)} clicks costs ${fmtINR(totals.costPerOrder)} per order.`,
          detail: 'Clicks arrive and do not convert: check price versus the buy box, stock state and the detail page rather than raising bids — extra spend on a weak listing raises ACoS linearly.',
          metrics: { CVR: fmtPct(cvr, 2), Clicks: fmtNum(totals.clicks), Orders: fmtNum(totals.orders), 'Cost/order': fmtINR(totals.costPerOrder) },
        });
      }
    }

    if (Number(totals.cpc) > 0 && Number(totals.aov) > 0) {
      const margin = Number(totals.cpc) / Number(totals.aov) * 100;
      if (margin > 15) {
        push({
          id: 'cpc-heavy',
          tone: 'warn',
          priority: 64,
          target: 'panel-efficiency',
          text: `Cost per click ${fmtINR(totals.cpc)} equals ${fmtPct(margin, 1)} of average order value.`,
          detail: `At ${fmtPct(totals.cvr, 2)} CVR each order needs ${fmtINR(totals.costPerOrder)} of spend against ${fmtINR(totals.aov)} of revenue — thin unless margin is high.`,
          metrics: { CPC: fmtINR(totals.cpc), AOV: fmtINR(totals.aov), 'Cost/order': fmtINR(totals.costPerOrder) },
        });
      }
    }

    /* ── 5. Concentration and mix. ────────────────────────────────────── */
    const brandMix = mix.brand || [];
    if (brandMix.length > 1) {
      const top = brandMix[0];
      if (Number(top.share) >= t.concentrationPct) {
        push({
          id: 'brand-concentration',
          tone: 'info',
          priority: 58,
          target: 'panel-mix',
          text: `${top.name} carries ${fmtPct(top.share, 1)} of ad sales (${fmtINR(top.totalSales)}).`,
          detail: `Top-3 brands hold ${fmtPct(brandMix.slice(0, 3).reduce((s, b) => s + (Number(b.share) || 0), 0), 1)} of the mix. Concentration is fine until its ACoS slips — watch it as a single line, not as ${brandMix.length} brands.`,
          metrics: { Brand: top.name, Share: fmtPct(top.share, 1), ACoS: fmtPct(top.acos) },
        });
      }
    }

    const sellerMix = mix.seller || [];
    if (sellerMix.length > 1) {
      const top = sellerMix[0];
      if (Number(top.share) >= 80) {
        push({
          id: 'seller-concentration',
          tone: 'info',
          priority: 52,
          target: 'panel-mix',
          text: `${top.name} accounts for ${fmtPct(top.share, 1)} of ad sales in this view.`,
          detail: 'Use the seller selector to review each account on its own targets before judging blended ACoS — blended numbers hide the account that is missing.',
          metrics: { Seller: top.name, Share: fmtPct(top.share, 1), ACoS: fmtPct(top.acos) },
        });
      }
    }

    /* ── 6. Movers worth an action. ───────────────────────────────────── */
    const gainers = (movers.gainers || []).slice(0, 1);
    const decliners = (movers.decliners || []).slice(0, 1);
    if (decliners.length > 0 && Number(decliners[0].deltaTotalSales) < 0) {
      const r = decliners[0];
      push({
        id: 'top-decliner',
        tone: 'neg',
        priority: 80,
        target: 'panel-movers',
        text: `${r.key} lost ${fmtINR(Math.abs(r.deltaTotalSales))} of sales period-over-period (${signed(r.deltaTotalSalesPct, 0)}).`,
        detail: `Now ${fmtINR(r.totalSales)} total sales on ${fmtINR(r.spend)} spend, ACoS ${fmtPct(r.acos)} (was ${fmtPct(r.prevAcos)}). Check stock, price and buy-box before touching bids.`,
        metrics: { Key: r.key, 'Δ sales': fmtINR(r.deltaTotalSales), 'ACoS now': fmtPct(r.acos), 'ACoS before': fmtPct(r.prevAcos) },
        rows: [r],
      });
    }
    if (gainers.length > 0 && Number(gainers[0].deltaTotalSales) > 0) {
      const r = gainers[0];
      push({
        id: 'top-gainer',
        tone: 'pos',
        priority: 68,
        target: 'panel-movers',
        text: `${r.key} added ${fmtINR(r.deltaTotalSales)} of sales (${signed(r.deltaTotalSalesPct, 0)}).`,
        detail: `ACoS ${fmtPct(r.acos)} on ${fmtINR(r.spend)} spend${r.deltaAcosPoints !== null ? ` (${signed(r.deltaAcosPoints, 1, ' pts')} vs last period)` : ''}. If it is still inside the target, this is the pattern to copy.`,
        metrics: { Key: r.key, 'Δ sales': fmtINR(r.deltaTotalSales), ACoS: fmtPct(r.acos), Spend: fmtINR(r.spend) },
        rows: [r],
      });
    }

    /* ── 7. Structural read: ad dependence. ───────────────────────────── */
    if (totals.adSharePct !== null && Number(totals.totalSales) > 0) {
      const share = Number(totals.adSharePct);
      push({
        id: 'ad-dependence',
        tone: share > 70 ? 'warn' : share < 25 ? 'info' : 'pos',
        priority: 46,
        target: 'panel-mix',
        text: `Ads drive ${fmtPct(share, 1)} of total sales; organic contributes ${fmtINR(totals.organicSales)}.`,
        detail: share > 70
          ? 'Heavy ad dependence: a bid or budget shock hits revenue almost directly. Watch organic sales as the hedge.'
          : share < 25
            ? 'Organic-led mix: cheap to defend, and usually the best place to test incremental ad spend.'
            : 'Balanced mix between paid and organic.',
        metrics: { 'Ad sales': fmtINR(totals.sales), Organic: fmtINR(totals.organicSales), 'Ad share': fmtPct(share, 1) },
      });
    }
  }

  insights.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return (TONE_ORDER[a.tone] ?? 9) - (TONE_ORDER[b.tone] ?? 9);
  });

  const counts = insights.reduce((acc, i) => {
    acc[i.tone] = (acc[i.tone] || 0) + 1;
    return acc;
  }, { pos: 0, neg: 0, warn: 0, info: 0 });

  return {
    generatedFor: {
      period: { start: period.start, end: period.end, label: period.label, days: period.days, granularity: period.granularity },
      reportType: overview.reportType || 'daily',
      scope: overview.scope || null,
      rulesEvaluated: 24,
    },
    headline: insights[0] ? `${insights[0].text}` : 'No material ads movement in this window.',
    insights,
    counts,
    thresholds: t,
  };
}

/**
 * Compact numeric digest for the LLM. Deliberately numbers-only — no row
 * payloads, no titles, no images — so the prompt stays small, fast and free of
 * anything the model could hallucinate from.
 */
function buildAiDigest(overview = {}, insights = []) {
  const totals = overview.totals || {};
  const previous = overview.previous || {};
  const delta = overview.delta || {};
  const pick = (obj, keys) => keys.reduce((acc, k) => { acc[k] = obj[k]; return acc; }, {});

  return {
    window: {
      current: overview.period?.label || null,
      days: overview.period?.days || null,
      previous: `${overview.period?.prevStart} → ${overview.period?.prevEnd}`,
      granularity: overview.period?.granularity || null,
      reportType: overview.reportType || 'daily',
      hasPrevious: !!overview.previousAvailable,
    },
    scope: {
      global: !!overview.scope?.isGlobal,
      sellersInView: overview.scope?.assignedSellers?.length ?? 0,
      filters: overview.filters || {},
    },
    totals: pick(totals, ['spend', 'sales', 'organicSales', 'totalSales', 'orders', 'impressions', 'clicks', 'acos', 'tacos', 'roas', 'ctr', 'cvr', 'cpc', 'adSharePct']),
    previous: pick(previous, ['spend', 'sales', 'organicSales', 'totalSales', 'orders', 'impressions', 'clicks', 'acos', 'tacos', 'roas', 'ctr', 'cvr', 'cpc', 'adSharePct']),
    delta,
    targets: overview.targets || null,
    freshness: {
      lastDate: overview.freshness?.lastDate || null,
      daysCovered: overview.freshness?.daysCovered ?? null,
      daysInWindow: overview.freshness?.daysInWindow ?? null,
      gapDays: (overview.freshness?.gapDays || []).slice(0, 10),
      asinCount: overview.freshness?.asinCount ?? null,
    },
    efficiency: {
      buckets: (overview.efficiency?.buckets || []).map((b) => ({
        band: b.label, keys: b.keys, spend: round(b.spend), sales: round(b.sales), spendSharePct: round(b.spendShare),
      })),
      zeroSalesSpend: overview.efficiency?.waste?.zeroSales?.spend ?? null,
      zeroSalesKeys: overview.efficiency?.waste?.zeroSales?.keys ?? null,
      highAcosSpend: overview.efficiency?.waste?.highAcos?.spend ?? null,
      highAcosKeys: overview.efficiency?.waste?.highAcos?.keys ?? null,
    },
    mix: {
      brands: (overview.mix?.brand || []).slice(0, 6).map((b) => ({ brand: b.name, totalSales: round(b.totalSales), acos: round(b.acos), sharePct: round(b.share), deltaPct: round(b.deltaTotalSalesPct) })),
      sellers: (overview.mix?.seller || []).slice(0, 6).map((s) => ({ seller: s.name, totalSales: round(s.totalSales), acos: round(s.acos), sharePct: round(s.share) })),
      categories: (overview.mix?.category || []).slice(0, 5).map((c) => ({ category: c.name, totalSales: round(c.totalSales), acos: round(c.acos) })),
    },
    movers: {
      gainers: (overview.movers?.gainers || []).slice(0, 4).map((r) => ({ key: r.key, deltaTotalSales: round(r.deltaTotalSales), acos: round(r.acos), spend: round(r.spend) })),
      decliners: (overview.movers?.decliners || []).slice(0, 4).map((r) => ({ key: r.key, deltaTotalSales: round(r.deltaTotalSales), acos: round(r.acos), spend: round(r.spend) })),
      spendSpikes: (overview.movers?.spendSpikes || []).slice(0, 4).map((r) => ({ key: r.key, deltaSpend: round(r.deltaSpend), deltaTotalSales: round(r.deltaTotalSales) })),
    },
    ruleFindings: insights.slice(0, 8).map((i) => ({ id: i.id, tone: i.tone, text: i.text })),
  };
}

module.exports = { buildInsights, buildAiDigest, monthProgress, round, fmtINR, fmtPct };
