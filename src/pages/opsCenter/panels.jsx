import React, { useMemo, useState } from 'react';
import {
    Panel, Tile, MiniState, Chip, SegmentedBar, Segmented, Delta, ShareBar, Tip, useNow,
    fmtINR, fmtINRFull, fmtNum, fmtNumFull, fmtPct, pctDelta, pointDelta, timeAgo,
    OPS_COLOR, TASK_STATUS_COLORS, PIPELINE_COLORS, PRIORITY_CHIP,
} from './primitives';
import { Sparkline, Ring } from './charts';
import { AreaTrendChart } from './AreaTrendChart';
import { targetAchievementPct } from '../../utils/targetMetrics';

/**
 * OpsCenter panels — pure presentation over the data supplied by
 * useDashboardData. Each panel renders an explicit error or empty state;
 * none of them fabricate values, and every "vs previous" comparison is
 * suppressed (not zeroed) when there is no prior data.
 */

// ── Metric registry: KPI tiles ⇄ trend chart ─────────────────────────

/** Chart modes group series that share a unit. */
export const CHART_MODES = {
    revenue: { label: 'Revenue', unit: 'inr' },
    volume: { label: 'Volume', unit: 'num' },
    efficiency: { label: 'Efficiency', unit: 'pct' },
};

/** focusKey → { mode, seriesKey } */
export const FOCUS_MAP = {
    gms: { mode: 'revenue', series: 'gms' },
    adSales: { mode: 'revenue', series: 'adSales' },
    adSpend: { mode: 'revenue', series: 'adSpend' },
    units: { mode: 'volume', series: 'gmsUnits' },
    orders: { mode: 'volume', series: 'adOrders' },
    acos: { mode: 'efficiency', series: 'acos' },
    tacos: { mode: 'efficiency', series: 'tacos' },
    roas: { mode: 'efficiency', series: 'acos' },
};

/** Build all chart series from the payload (bucket-aligned with labels). */
export const buildSeries = (dashboardRaw) => {
    const adsPerf = dashboardRaw?.adsPerformanceSeries || [];
    const adSales = adsPerf[0]?.data || [];
    const adSpend = adsPerf[1]?.data || [];
    const gms = dashboardRaw?.gms?.series || [];
    const gmsUnits = dashboardRaw?.gms?.unitsSeries || [];
    const tacos = dashboardRaw?.gms?.tacosSeries || [];
    const organic = (dashboardRaw?.stackedBarSeries || [])[2]?.data || [];
    return {
        revenue: [
            { key: 'gms', name: 'GMS', color: OPS_COLOR.accent, data: gms },
            { key: 'adSales', name: 'Ad sales', color: OPS_COLOR.pos, data: adSales },
            { key: 'organic', name: 'Organic sales', color: OPS_COLOR.violet, data: organic, dashed: true },
            { key: 'adSpend', name: 'Ad spend', color: OPS_COLOR.warn, data: adSpend },
        ].filter((s) => s.data.length > 0),
        volume: [
            { key: 'gmsUnits', name: 'Units (GMS)', color: OPS_COLOR.accent, data: gmsUnits },
            { key: 'adOrders', name: 'Ad orders', color: OPS_COLOR.pos, data: dashboardRaw?.ordersSeries || [] },
        ].filter((s) => s.data.length > 0),
        efficiency: [
            { key: 'acos', name: 'ACoS', color: OPS_COLOR.warn, data: dashboardRaw?.acosSeries || [] },
            { key: 'tacos', name: 'TACoS', color: OPS_COLOR.accent, data: tacos },
        ].filter((s) => s.data.length > 0),
    };
};

// ── KPI strip ─────────────────────────────────────────────────────────

export const KpiRow = ({ dashboardRaw, focus, onFocus, span = 2 }) => {
    const adsPerf = dashboardRaw?.adsPerformanceSeries || [];
    const adsBlock = dashboardRaw?.ads;
    const gms = dashboardRaw?.gms;
    const prev = dashboardRaw?.previous;
    const days = dashboardRaw?.period?.days;
    const vs = days ? `vs prev ${days}d` : 'vs prev period';

    const adSales = adsBlock ? Number(adsBlock.adSales) : (adsPerf[0]?.data || []).reduce((a, b) => a + b, 0);
    const adSpend = adsBlock ? Number(adsBlock.adSpend) : (adsPerf[1]?.data || []).reduce((a, b) => a + b, 0);
    const adOrders = adsBlock ? Number(adsBlock.orders) : (dashboardRaw?.ordersSeries || []).reduce((a, b) => a + b, 0);
    const acos = adSales > 0 ? (adSpend / adSales) * 100 : 0;
    const roas = adSpend > 0 ? adSales / adSpend : 0;
    const dailySpend = days > 0 ? adSpend / days : Number(dashboardRaw?.dailySpend || 0);
    const hasGms = !!gms;
    const gmsRevenue = Number(gms?.revenue) || 0;
    const gmsUnits = Number(gms?.units) || 0;
    const tacos = gmsRevenue > 0 ? (adSpend / gmsRevenue) * 100 : null;
    const adShare = gmsRevenue > 0 ? (adSales / gmsRevenue) * 100 : null;

    const tiles = [
        {
            key: 'gms', label: 'GMS', tip: 'Gross merchandise sales — ordered revenue from the GMS daily feed (not ads data).',
            value: hasGms ? fmtINR(gmsRevenue) : '—',
            sub: hasGms
                ? (gmsRevenue > 0 ? `${fmtINR(gms.dailyAverage)} / day · ${fmtNum(gms.asinsWithSales)} ASINs selling` : 'no GMS recorded in period')
                : 'GMS feed unavailable',
            delta: hasGms ? <Delta value={gms.deltaPct} label={vs} compact /> : null,
            spark: <Sparkline data={gms?.series || []} color={OPS_COLOR.accent} />,
        },
        {
            key: 'units', label: 'Units', tip: 'Ordered units from the GMS daily feed.',
            value: hasGms ? fmtNum(gmsUnits) : '—',
            sub: hasGms && gmsUnits > 0 ? `ASP ${fmtINRFull(gms.asp)} · returns ${fmtPct(gms.returnRate)}` : 'ordered units',
            delta: hasGms ? <Delta value={gms.unitsDeltaPct} label={vs} compact /> : null,
            spark: <Sparkline data={gms?.unitsSeries || []} color={OPS_COLOR.accent} />,
        },
        {
            key: 'adSales', label: 'Ad sales', tip: 'Ad-attributed sales in the period (AdsPerformance).',
            value: fmtINR(adSales),
            sub: adShare !== null ? `${fmtPct(adShare)} of GMS · ${fmtNum(adOrders)} ad orders` : `${fmtNum(adOrders)} ad orders`,
            delta: <Delta value={prev ? pctDelta(adSales, prev.adSales) : null} label={vs} compact />,
            spark: <Sparkline data={adsPerf[0]?.data || []} color={OPS_COLOR.pos} />,
        },
        {
            key: 'adSpend', label: 'Ad spend', tip: 'Advertising spend in the period. Change is informational (neither good nor bad on its own).',
            value: fmtINR(adSpend),
            sub: tacos !== null ? `TACoS ${fmtPct(tacos)} · ${fmtINR(dailySpend)} / day` : `${fmtINR(dailySpend)} / day`,
            delta: <Delta value={prev ? pctDelta(adSpend, prev.adSpend) : null} label={vs} compact neutral />,
            spark: <Sparkline data={adsPerf[1]?.data || []} color={OPS_COLOR.warn} />,
        },
        {
            key: 'acos', label: 'ACoS', tip: 'Ad spend ÷ ad sales. Lower is better; change shown in percentage points.',
            value: fmtPct(acos),
            sub: 'spend ÷ ad sales · lower is better',
            delta: <Delta value={prev && prev.adSales > 0 ? pointDelta(acos, prev.acos) : null} label={vs} compact invert points />,
            spark: <Sparkline data={dashboardRaw?.acosSeries || []} color={OPS_COLOR.warn} />,
        },
        {
            key: 'roas', label: 'ROAS', tip: 'Ad sales ÷ ad spend. Shown as ACoS on the trend chart.',
            value: roas.toFixed(2), unit: '×',
            sub: 'ad sales ÷ spend',
            delta: <Delta value={prev && prev.adSpend > 0 ? pctDelta(roas, prev.roas) : null} label={vs} compact />,
            spark: <Sparkline data={(dashboardRaw?.acosSeries || []).map((v) => (v > 0 ? 100 / v : 0))} color={OPS_COLOR.pos} />,
        },
    ];

    return tiles.map((t) => (
        <Tile
            key={t.key}
            span={span}
            label={t.label}
            tip={t.tip}
            value={t.value}
            unit={t.unit}
            sub={t.sub}
            spark={t.spark}
            delta={t.delta}
            active={focus === t.key}
            onClick={onFocus ? () => onFocus(t.key) : undefined}
        />
    ));
};

// ── Revenue / volume / efficiency trend ───────────────────────────────

export const TrendPanel = ({ dashboardRaw, status, onRetry, mode, onMode, focusSeries, onFocusSeries }) => {
    const labels = dashboardRaw?.labels || [];
    const all = useMemo(() => buildSeries(dashboardRaw), [dashboardRaw]);
    const series = all[mode] || [];
    const [hidden, setHidden] = useState(() => ({ revenue: ['organic'], volume: [], efficiency: [] }));
    const granularity = dashboardRaw?.period?.granularity || 'day';
    const days = dashboardRaw?.period?.days;
    const ready = status !== 'error' && labels.length > 0 && series.length > 0;
    const hasAny = series.some((s) => s.data.some((v) => Number(v) > 0));

    const toggle = (key) => setHidden((h) => {
        const cur = new Set(h[mode] || []);
        if (cur.has(key)) cur.delete(key); else cur.add(key);
        return { ...h, [mode]: Array.from(cur) };
    });

    return (
        <Panel
            id="ops-trend"
            span={8}
            kicker="Trend"
            meta={`${labels.length} ${granularity === 'week' ? 'weekly' : 'daily'} points${days ? ` · ${days}d` : ''} · hover for values`}
            actions={(
                <Segmented
                    ariaLabel="Chart mode"
                    value={mode}
                    onChange={onMode}
                    options={Object.entries(CHART_MODES).map(([value, m]) => ({ value, label: m.label }))}
                />
            )}
        >
            {status === 'error' ? (
                <MiniState tone="error" title="Trend unavailable" note="Revenue history could not be loaded." onRetry={onRetry} />
            ) : !ready ? (
                <MiniState tone="empty" title="No trend data" note="No series available for this selection and period." />
            ) : !hasAny ? (
                <MiniState tone="empty" title={`No ${CHART_MODES[mode].label.toLowerCase()} recorded`} note="Every point in this period is zero for the selected series." />
            ) : (
                <AreaTrendChart
                    labels={labels}
                    series={series}
                    unit={CHART_MODES[mode].unit}
                    hidden={hidden[mode] || []}
                    onToggle={toggle}
                    focusKey={focusSeries}
                    onFocus={onFocusSeries}
                    granularity={granularity}
                />
            )}
        </Panel>
    );
};

// ── Brand leaderboard (GMS by seller) ─────────────────────────────────

export const BrandLeaderboardPanel = ({ rows = [], status, onRetry, activeSellerId, onSelectSeller, selectable, periodDays }) => {
    const [showAll, setShowAll] = useState(false);
    const list = showAll ? rows : rows.slice(0, 8);
    const max = Math.max(...rows.map((r) => Number(r.revenue) || 0), 1);
    const vs = periodDays ? `vs prev ${periodDays}d` : 'vs prev period';
    const canSelect = (r) => typeof onSelectSeller === 'function' && (!selectable || selectable.has(String(r.sellerId)));

    return (
        <Panel
            id="ops-brands"
            span={4}
            kicker="Brands by GMS"
            meta={rows.length > 0 ? `${rows.length} brand${rows.length === 1 ? '' : 's'} · click to filter` : undefined}
            actions={rows.length > 8 ? (
                <button type="button" className="ops-linkbtn" onClick={() => setShowAll((v) => !v)}>
                    {showAll ? 'Top 8' : `All ${rows.length}`}
                </button>
            ) : null}
        >
            {status === 'error' ? (
                <MiniState tone="error" title="Brand GMS unavailable" note="Seller-level GMS could not be loaded." onRetry={onRetry} />
            ) : rows.length === 0 ? (
                <MiniState tone="empty" title="No brand GMS" note="No seller recorded ordered revenue for this selection and period." />
            ) : (
                <div className="ops-lb">
                    {list.map((r, i) => {
                        const active = activeSellerId && String(activeSellerId) === String(r.sellerId);
                        const clickable = canSelect(r);
                        return (
                            <button
                                key={r.sellerId || i}
                                type="button"
                                className={`ops-lb__row ${active ? 'ops-lb__row--on' : ''} ${clickable ? '' : 'ops-lb__row--static'}`}
                                onClick={clickable ? () => onSelectSeller(active ? 'all' : String(r.sellerId)) : undefined}
                                disabled={!clickable}
                                title={clickable ? (active ? 'Clear brand filter' : `Filter dashboard to ${r.sellerName}`) : r.sellerName}
                            >
                                <span className="ops-lb__rank ops-num">{i + 1}</span>
                                <span className="ops-lb__body">
                                    <span className="ops-lb__top">
                                        <b>{r.sellerName}</b>
                                        <span className="ops-num">{fmtINR(r.revenue)} · {fmtPct(r.share, 0)}</span>
                                    </span>
                                    <ShareBar pct={r.revenue} max={max} color={active ? OPS_COLOR.accent : '#84caff'} />
                                    <span className="ops-lb__sub ops-num">
                                        <Delta value={r.deltaPct} label={vs} compact />
                                        <span>{fmtNumFull(r.units)} units · {r.asinsWithSales} ASIN{r.asinsWithSales === 1 ? '' : 's'} · {r.marketplace}</span>
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}
        </Panel>
    );
};

// ── Marketplace mix ───────────────────────────────────────────────────

const MP_ORDER = ['amazon', 'ajio', 'myntra'];
const MP_COLORS = {
    amazon: '#FF9900',
    ajio: '#D32F2F',
    myntra: '#FF3F6C',
};
const MP_LABELS = {
    amazon: 'Amazon',
    ajio: 'Ajio',
    myntra: 'Myntra',
};

export const MixPanel = ({ dashboardRaw, status, onRetry }) => {
    const [basis, setBasis] = useState('gms');
    const [showDonut, setShowDonut] = useState(false);

    const normKey = (k) => String(k).toLowerCase().replace(/\.| /g, '');
    const mpKeyMap = { amazonin: 'amazon', ajio: 'ajio', myntra: 'myntra' };
    const getMpKey = (raw) => mpKeyMap[normKey(raw)] || normKey(raw);

    const gmsByMp = (dashboardRaw?.gmsByMarketplace || [])
        .reduce((acc, m) => {
            const key = getMpKey(m.name);
            acc[key] = { revenue: Number(m.revenue) || 0, sellers: m.sellers || 0 };
            return acc;
        }, {});

    const asinsByMp = (dashboardRaw?.category || [])
        .reduce((acc, c) => {
            const key = getMpKey(c.name);
            acc[key] = (c.data || [0])[0] || 0;
            return acc;
        }, {});

    const trendByMp = (dashboardRaw?.gmsTrendByMarketplace || [])
        .reduce((acc, m) => {
            const key = getMpKey(m.marketplace);
            acc[key] = m.points || [];
            return acc;
        }, {});

    const rows = MP_ORDER.map((key) => {
        const gms = gmsByMp[key]?.revenue || 0;
        const sellers = gmsByMp[key]?.sellers || 0;
        const asins = asinsByMp[key] || 0;
        const trend = trendByMp[key] || [];
        return {
            key,
            label: MP_LABELS[key] || key,
            color: MP_COLORS[key] || '#94a3b8',
            gms,
            sellers,
            asins,
            trend,
        };
    });

    const hasGms = rows.some(r => r.gms > 0);
    const effective = basis === 'gms' && hasGms ? 'gms' : 'asins';

    const sortedRows = [...rows].sort((a, b) => {
        const av = effective === 'gms' ? a.gms : a.asins;
        const bv = effective === 'gms' ? b.gms : b.asins;
        return bv - av;
    });

    const total = rows.reduce((s, r) => s + (effective === 'gms' ? r.gms : r.asins), 0);
    const fmt = effective === 'gms' ? fmtINR : fmtNum;

    const renderTrend = (points, color) => {
        if (!points?.length) return <span className="ops-muted">—</span>;
        return <Sparkline data={points.map(p => p.revenue || p.value || 0)} width={80} height={18} color={color} />;
    };

    const renderDonut = () => {
        if (total === 0) return null;
        const circumference = 2 * Math.PI * 40; // r=40
        let offset = 0;
        return (
            <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                {sortedRows
                    .filter(r => (effective === 'gms' ? r.gms : r.asins) > 0)
                    .map((r, i) => {
                        const value = effective === 'gms' ? r.gms : r.asins;
                        const pct = total > 0 ? value / total : 0;
                        const strokeDash = `${pct * circumference} ${circumference}`;
                        const strokeOffset = offset;
                        offset += pct * circumference;
                        return (
                            <circle
                                key={r.key}
                                cx="50"
                                cy="50"
                                r="40"
                                fill="none"
                                stroke={r.color}
                                strokeWidth="16"
                                strokeDasharray={strokeDash}
                                strokeDashoffset={strokeOffset}
                                strokeLinecap="round"
                            />
                        );
                    })}
            </svg>
        );
    };

    return (
        <Panel
            id="ops-mix"
            span={4}
            kicker="Marketplace mix"
            meta={total > 0 ? (effective === 'gms' ? `${fmtINR(total)} GMS` : `${fmtNum(total)} ASINs`) : undefined}
            actions={(
                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Segmented
                        ariaLabel="Mix basis"
                        value={effective}
                        onChange={setBasis}
                        options={[
                            { value: 'gms', label: 'GMS', title: hasGms ? 'Share of ordered revenue' : 'No GMS in period' },
                            { value: 'asins', label: 'ASINs', title: 'Share of catalog count' },
                        ]}
                    />
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={showDonut}
                            onChange={e => setShowDonut(e.target.checked)}
                        />
                        Donut
                    </label>
                </span>
            )}
        >
            {status === 'error' ? (
                <MiniState tone="error" title="Mix unavailable" note="Marketplace distribution could not be loaded." onRetry={onRetry} />
            ) : rows.length === 0 ? (
                <MiniState tone="empty" title={effective === 'gms' ? 'No GMS by marketplace' : 'No ASINs'} note="No data for this selection." />
            ) : (
                <div style={{ paddingTop: 2 }}>
                    {showDonut && (
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                            {renderDonut()}
                        </div>
                    )}
                    <div style={{ paddingTop: 2 }}>
                        {rows.map((r) => {
                            const value = effective === 'gms' ? r.gms : r.asins;
                            const pct = total > 0 ? (value / total) * 100 : 0;
                            return (
                                <div className="ops-hbar" key={r.key} style={{ marginBottom: 10 }}>
                                    <div className="ops-hbar__top" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                                            <b>{r.label}{r.sellers ? <span className="ops-muted"> · {r.sellers} seller{r.sellers === 1 ? '' : 's'}</span> : null}</b>
                                        </div>
                                        <span className="ops-num">{fmt(value)} · {pct.toFixed(0)}%</span>
                                    </div>
                                    <div className="ops-hbar__track" style={{ height: 8, borderRadius: 4, background: '#e2e8f0', overflow: 'hidden' }}>
                                        <span className="ops-hbar__fill" style={{ width: `${pct}%`, background: r.color, height: '100%', display: 'block', borderRadius: 4, transition: 'width 0.3s ease' }} />
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, fontSize: 11 }}>
                                        <span className="ops-muted">Trend:</span>
                                        <span style={{ minWidth: 80 }}>{renderTrend(r.trend, r.color)}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </Panel>
    );
};

// ── Goal achievement (GMS / ADS / ACoS separated, drill-down per type) ─

const GOAL_DISPLAY = [
    { type: 'GMS', name: 'GMS', color: OPS_COLOR.accent, note: 'Merchandise value vs target' },
    { type: 'ADS', name: 'Ad revenue', color: OPS_COLOR.pos, note: 'Ad sales vs target' },
    { type: 'ACOS', name: 'ACoS', color: OPS_COLOR.warn, note: 'Target ÷ actual — lower is better', lower: true },
];

const targetLabel = (t) => t.SellerName || t.sellerName || t.Seller?.Name || t.SellerId || 'Target';

export const AchievementPanel = ({ targets, status, onRetry }) => {
    const [open, setOpen] = useState(null);
    const groups = GOAL_DISPLAY
        .map((g) => {
            const list = targets.filter((t) => (t.GoalType || 'GMS').toUpperCase() === g.type);
            const totalTarget = list.reduce((s, t) => s + (Number(t.TotalTargetValue) || 0), 0);
            const totalAchieved = list.reduce((s, t) => s + (Number(t.overallAchieved) || 0), 0);
            const pct = g.lower
                ? (totalAchieved > 0 ? (totalTarget / totalAchieved) * 100 : 0)
                : (totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0);
            const detailed = list
                .map((t) => ({ t, pct: targetAchievementPct(t) }))
                .sort((a, b) => a.pct - b.pct);
            const atRisk = detailed.filter((d) => d.pct < 50).length;
            return { ...g, list, totalTarget, totalAchieved, pct, detailed, atRisk };
        })
        .filter((g) => g.list.length > 0);
    const openGroup = groups.find((g) => g.type === open);

    return (
        <Panel id="ops-goals" span={8} kicker="Goal achievement" meta={`${targets.length} targets in view · click a goal for its targets`}>
            {status === 'error' ? (
                <MiniState tone="error" title="Achievement unavailable" note="Targets could not be loaded." onRetry={onRetry} />
            ) : groups.length === 0 ? (
                <MiniState tone="empty" title="No targets in view" note="No targets match the current brand / manager selection." />
            ) : (
                <>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {groups.map((g) => (
                            <button
                                type="button"
                                className={`ops-goal ops-goal--btn ${open === g.type ? 'ops-goal--on' : ''}`}
                                key={g.type}
                                onClick={() => setOpen(open === g.type ? null : g.type)}
                                aria-expanded={open === g.type}
                            >
                                <Ring pct={g.pct} color={g.color} label={g.name} size={86} />
                                <div className="ops-goal__info">
                                    <div className="ops-goal__type">
                                        {g.name}
                                        {g.lower && <span className="ops-tag">LOWER IS BETTER</span>}
                                    </div>
                                    <div className="ops-goal__values ops-num">
                                        {g.lower
                                            ? <>target {fmtPct(g.totalTarget, 0)}<span> · actual {fmtPct(g.totalAchieved, 0)}</span></>
                                            : <>{fmtINR(g.totalAchieved)}<span> of {fmtINR(g.totalTarget)}</span></>}
                                    </div>
                                    <div className="ops-goal__note">
                                        {g.note} · {g.list.length} target{g.list.length === 1 ? '' : 's'}
                                        {g.atRisk > 0 && <span className="ops-goal__risk"> · {g.atRisk} at risk</span>}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                    {openGroup && (
                        <div className="ops-goal__targets">
                            {openGroup.detailed.slice(0, 8).map(({ t, pct }, i) => {
                                const tone = pct >= 100 ? OPS_COLOR.pos : pct >= 50 ? OPS_COLOR.accent : OPS_COLOR.neg;
                                return (
                                    <div className="ops-goal__trow" key={t.Id || t.id || i}>
                                        <span className="ops-goal__tname">
                                            <b>{targetLabel(t)}</b>
                                            <span className="ops-muted"> · {t.BrandManager || 'unassigned'} · {t.TargetType || ''} {t.Month ? `${t.Month}/` : ''}{t.Year || ''}</span>
                                        </span>
                                        <span className="ops-goal__tvals ops-num">
                                            {openGroup.lower
                                                ? `${fmtPct(t.overallAchieved, 1)} actual · ${fmtPct(t.TotalTargetValue, 1)} target`
                                                : `${fmtINR(t.overallAchieved)} of ${fmtINR(t.TotalTargetValue)}`}
                                        </span>
                                        <span className="ops-goal__tbar"><ShareBar pct={Math.min(pct, 100)} color={tone} /></span>
                                        <span className="ops-goal__tpct ops-num" style={{ color: tone }}>{Math.round(pct)}%</span>
                                    </div>
                                );
                            })}
                            {openGroup.detailed.length > 8 && (
                                <div className="ops-muted" style={{ fontSize: 11, paddingTop: 6 }}>
                                    Showing the 8 lowest of {openGroup.detailed.length} targets.
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </Panel>
    );
};

// ── ASIN health ───────────────────────────────────────────────────────

export const AsinHealthPanel = ({ stats, gms }) => {
    const total = Number(stats?.totalAsins) || 0;
    const active = Number(stats?.activeAsins) || 0;
    const oos = Number(stats?.outOfStockAsins) || 0;
    const fresh = Number(stats?.newThisMonthAsins) || 0;
    const selling = Number(gms?.asinsWithSales) || 0;
    const segments = [
        { label: 'Active', value: active, color: OPS_COLOR.pos },
        { label: 'Out of stock', value: oos, color: OPS_COLOR.neg },
        { label: 'Other', value: Math.max(0, total - active - oos), color: '#c7d0dc' },
    ];
    return (
        <Panel id="ops-catalog" span={4} kicker="Catalog health" meta={`${fmtNum(total)} ASINs`}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2 }}>
                <SegmentedBar segments={segments} total={total} />
                <div style={{ marginTop: 10 }}>
                    <div className="ops-statrow">
                        <span className="ops-statrow__label">Active / scraping</span>
                        <span className="ops-statrow__value ops-num">{fmtNum(active)}</span>
                    </div>
                    <div className="ops-statrow">
                        <span className="ops-statrow__label">Out of stock</span>
                        <span className="ops-statrow__value ops-num" style={{ color: oos > 0 ? OPS_COLOR.neg : undefined }}>
                            {fmtNum(oos)}{active > 0 && oos > 0 ? <small className="ops-muted"> · {fmtPct((oos / active) * 100, 0)}</small> : null}
                        </span>
                    </div>
                    <div className="ops-statrow">
                        <span className="ops-statrow__label"><Tip text="ASINs with ordered revenue in the period">Selling in period</Tip></span>
                        <span className="ops-statrow__value ops-num">
                            {gms ? fmtNum(selling) : '—'}{gms && active > 0 && selling > 0 ? <small className="ops-muted"> · {fmtPct((selling / active) * 100, 0)} of active</small> : null}
                        </span>
                    </div>
                    <div className="ops-statrow">
                        <span className="ops-statrow__label">New this month</span>
                        <span className="ops-statrow__value ops-num">{fmtNum(fresh)}</span>
                    </div>
                    <div className="ops-statrow">
                        <span className="ops-statrow__label">Sellers tracked</span>
                        <span className="ops-statrow__value ops-num">{fmtNum(stats?.totalSellers)}</span>
                    </div>
                </div>
            </div>
        </Panel>
    );
};

// ── Tasks (task workspace source) ─────────────────────────────────────

const TASK_ORDER = { IN_PROGRESS: 0, PENDING: 1, IN_REVIEW: 2, TODO: 3, COMPLETED: 4, CANCELLED: 5 };

export const TasksPanel = ({ tasks = [], error, onRetry }) => {
    const [filter, setFilter] = useState(null);
    const now = useNow();
    const counts = {};
    tasks.forEach((t) => {
        const s = String(t.status || 'TODO').toUpperCase();
        counts[s] = (counts[s] || 0) + 1;
    });
    const segments = Object.keys(TASK_STATUS_COLORS)
        .filter((s) => counts[s] > 0)
        .map((s) => ({ key: s, label: s.replace('_', ' '), value: counts[s], color: TASK_STATUS_COLORS[s] }));
    const overdue = tasks.filter((t) => !['COMPLETED', 'CANCELLED'].includes(String(t.status).toUpperCase()) && t.dueDate && new Date(t.dueDate).getTime() < now).length;

    const top = [...tasks]
        .filter((t) => !filter || String(t.status).toUpperCase() === filter)
        .sort((a, b) => {
            const sa = TASK_ORDER[String(a.status).toUpperCase()] ?? 9;
            const sb = TASK_ORDER[String(b.status).toUpperCase()] ?? 9;
            if (sa !== sb) return sa - sb;
            return new Date(a.dueDate || '2999-01-01') - new Date(b.dueDate || '2999-01-01');
        })
        .slice(0, 5);

    return (
        <Panel id="ops-tasks" span={4} kicker="Task pipeline" meta={`${tasks.length} workspace tasks${overdue > 0 ? ` · ${overdue} overdue` : ''}`} linkTo="/tasks/tasks" linkLabel="Workspace">
            {error ? (
                <MiniState tone="error" title="Tasks unavailable" note={String(error)} onRetry={onRetry} />
            ) : tasks.length === 0 ? (
                <MiniState tone="empty" title="No active tasks" note="Nothing in the task workspace for this selection." />
            ) : (
                <>
                    <SegmentedBar segments={segments} onSelect={setFilter} selected={filter} />
                    <div className="ops-list" style={{ marginTop: 8 }}>
                        {top.length === 0 && <MiniState tone="empty" title="No tasks in this status" />}
                        {top.map((t) => {
                            const late = t.dueDate && new Date(t.dueDate).getTime() < now && !['COMPLETED', 'CANCELLED'].includes(String(t.status).toUpperCase());
                            return (
                                <div className="ops-item" key={t.id}>
                                    <span className="ops-item__dot" style={{ background: TASK_STATUS_COLORS[String(t.status).toUpperCase()] || OPS_COLOR.slate }} />
                                    <div className="ops-item__body">
                                        <div className="ops-item__title">{t.title}</div>
                                        <div className="ops-item__sub">
                                            {t.sellerName ? `${t.sellerName} · ` : ''}{String(t.status).replace('_', ' ')}
                                            {t.dueDate ? <span style={{ color: late ? OPS_COLOR.neg : undefined }}> · {late ? 'overdue ' : 'due '}{timeAgo(t.dueDate)}</span> : ''}
                                        </div>
                                    </div>
                                    <Chip label={t.priority} palette={PRIORITY_CHIP} />
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </Panel>
    );
};

// ── Alerts ────────────────────────────────────────────────────────────

const SEVERITY_COLOR = { critical: OPS_COLOR.neg, error: OPS_COLOR.neg, warning: OPS_COLOR.warn, info: OPS_COLOR.accent };
const sevBucket = (a) => {
    const s = String(a.Severity || a.severity || a.type || 'info').toLowerCase();
    if (s.includes('critical') || s.includes('error')) return 'critical';
    if (s.includes('warn')) return 'warning';
    return 'info';
};

export const AlertsPanel = ({ alerts = [], status, onRetry }) => {
    const [filter, setFilter] = useState(null);
    const counts = { critical: 0, warning: 0, info: 0 };
    alerts.forEach((a) => { counts[sevBucket(a)] += 1; });
    const segments = [
        { key: 'critical', label: 'Critical', value: counts.critical, color: OPS_COLOR.neg },
        { key: 'warning', label: 'Warning', value: counts.warning, color: OPS_COLOR.warn },
        { key: 'info', label: 'Info', value: counts.info, color: OPS_COLOR.accent },
    ].filter((s) => s.value > 0);
    const top = alerts.filter((a) => !filter || sevBucket(a) === filter).slice(0, 5);

    return (
        <Panel id="ops-alerts" span={4} kicker="Alerts" meta={`${counts.critical} critical · ${counts.warning} warnings`} linkTo="/alerts" linkLabel="All alerts">
            {status === 'error' ? (
                <MiniState tone="error" title="Alerts unavailable" note="The alert feed could not be loaded." onRetry={onRetry} />
            ) : alerts.length === 0 ? (
                <MiniState tone="empty" title="No active alerts" note="Nothing needs attention for this selection." />
            ) : (
                <>
                    <SegmentedBar segments={segments} onSelect={setFilter} selected={filter} />
                    <div className="ops-list" style={{ marginTop: 8 }}>
                        {top.map((a) => {
                            const sev = sevBucket(a);
                            return (
                                <div className="ops-item" key={a.id || a.Id || a._id}>
                                    <span className="ops-item__dot" style={{ background: SEVERITY_COLOR[sev] || OPS_COLOR.accent }} />
                                    <div className="ops-item__body">
                                        <div className="ops-item__title">{a.Message || a.message || 'Alert'}</div>
                                        {a.SellerName || a.seller?.name ? (
                                            <div className="ops-item__sub">{a.SellerName || a.seller?.name}</div>
                                        ) : null}
                                    </div>
                                    <span className="ops-item__time">{timeAgo(a.CreatedAt || a.createdAt)}</span>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </Panel>
    );
};

// ── Sync pipeline ─────────────────────────────────────────────────────

export const PipelinePanel = ({ tasks = [], onRetry, status }) => {
    const [filter, setFilter] = useState(null);
    const statusOf = (t) => {
        const s = String(t.status || 'IDLE').toUpperCase();
        return ['RUNNING', 'COMPLETED', 'FAILED'].includes(s) ? s : 'IDLE';
    };
    const count = (s) => tasks.filter((t) => statusOf(t) === s).length;
    const segments = [
        { key: 'RUNNING', label: 'Running', value: count('RUNNING'), color: PIPELINE_COLORS.running },
        { key: 'COMPLETED', label: 'Completed', value: count('COMPLETED'), color: PIPELINE_COLORS.completed },
        { key: 'FAILED', label: 'Failed', value: count('FAILED'), color: PIPELINE_COLORS.failed },
        { key: 'IDLE', label: 'Idle', value: count('IDLE'), color: PIPELINE_COLORS.idle },
    ];
    const top = tasks.filter((t) => !filter || statusOf(t) === filter).slice(0, 4);
    const colorOf = (s) => (s === 'RUNNING' ? PIPELINE_COLORS.running : s === 'COMPLETED' ? PIPELINE_COLORS.completed : s === 'FAILED' ? PIPELINE_COLORS.failed : PIPELINE_COLORS.idle);

    return (
        <Panel id="ops-pipeline" span={6} kicker="Sync pipeline" meta={`${tasks.length} tracked runs`}>
            {status === 'error' ? (
                <MiniState tone="error" title="Pipeline unavailable" note="Sync status could not be loaded." onRetry={onRetry} />
            ) : tasks.length === 0 ? (
                <MiniState tone="empty" title="No sync activity" note="No marketplace sync runs recorded yet." />
            ) : (
                <>
                    <SegmentedBar segments={segments} onSelect={setFilter} selected={filter} />
                    <div className="ops-list" style={{ marginTop: 8 }}>
                        {top.length === 0 && <MiniState tone="empty" title="No runs in this status" />}
                        {top.map((t, i) => {
                            const s = statusOf(t);
                            return (
                                <div className="ops-item" key={t.id || t.taskId || i}>
                                    <span className="ops-item__dot" style={{ background: colorOf(s) }} />
                                    <div className="ops-item__body">
                                        <div className="ops-item__title">{t.sellerName || t.sellerId || 'Seller sync'}</div>
                                        <div className="ops-item__sub">
                                            {t.type ? String(t.type) : 'marketplace sync'}
                                            {t.updatedAt || t.completedAt || t.startedAt ? ` · ${timeAgo(t.updatedAt || t.completedAt || t.startedAt)}` : ''}
                                        </div>
                                    </div>
                                    <span className="ops-item__time" style={{ color: s === 'FAILED' ? OPS_COLOR.neg : undefined }}>{s}</span>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </Panel>
    );
};

// ── Insights strip ────────────────────────────────────────────────────

export const InsightsPanel = ({ insights = [], onJump }) => {
    if (insights.length === 0) return null;
    return (
        <section className="ops-insights" aria-label="Insights">
            <span className="ops-insights__kicker">Insights</span>
            <div className="ops-insights__list">
                {insights.map((it) => (
                    <button
                        key={it.id}
                        type="button"
                        className={`ops-insight ops-insight--${it.tone}`}
                        onClick={() => onJump && onJump(it.target)}
                        title="Jump to the related panel"
                    >
                        <i />
                        <span className="ops-num">{it.text}</span>
                    </button>
                ))}
            </div>
        </section>
    );
};

// ── Activity log ──────────────────────────────────────────────────────

export const ActivityPanel = ({ logs = [] }) => {
    const dotColor = (l) => {
        const t = String(l.Type || l.type || '').toUpperCase();
        if (t.includes('ERROR') || t.includes('FAILURE')) return OPS_COLOR.neg;
        if (t.includes('DELETE')) return OPS_COLOR.warn;
        return OPS_COLOR.accent;
    };
    const titleOf = (l) => l.description || l.Description || (l.entityTitle ? `${l.entityType || 'Record'}: ${l.entityTitle}` : (l.type || 'Event'));
    return (
        <Panel id="ops-activity" span={6} kicker="Activity log" meta={`${logs.length} recent events`}>
            {logs.length === 0 ? (
                <MiniState tone="empty" title="No recent activity" note="System events will appear here as they happen." />
            ) : (
                <div className="ops-list">
                    {logs.slice(0, 6).map((l, i) => (
                        <div className="ops-item" key={l.id || l._id || l.Id || i}>
                            <span className="ops-item__dot" style={{ background: dotColor(l) }} />
                            <div className="ops-item__body">
                                <div className="ops-item__title">{titleOf(l)}</div>
                                <div className="ops-item__sub">
                                    {l.user?.firstName ? `${l.user.firstName} ${l.user.lastName || ''} · ` : ''}
                                    {l.entityType || l.Type || 'system'}
                                </div>
                            </div>
                            <span className="ops-item__time">{timeAgo(l.createdAt || l.CreatedAt)}</span>
                        </div>
                    ))}
                </div>
            )}
        </Panel>
    );
};
