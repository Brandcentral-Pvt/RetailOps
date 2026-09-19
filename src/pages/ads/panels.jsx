/**
 * Ads Intelligence panels.
 *
 * Same design language as the Operations Command Center: flat panels on a
 * 12-column grid, uppercase micro-labels, tabular numerals, dependency-free
 * SVG charts. Every number comes from `/api/ads/*`; when a metric is unknown
 * the UI renders "—" instead of a zero, and a failed section shows its own
 * retry state instead of masquerading as empty.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Button, Input, Modal, Progress, Select, Tooltip as AntTooltip } from 'antd';
import {
    Panel, MiniState, Delta, Tile, Chip, Segmented, SegmentedBar,
    SortHeader, ShareBar, fmtINR, fmtINRFull, fmtNum, fmtNumFull, timeAgo,
} from '../opsCenter/primitives';
import { Sparkline, TrendChart, Bars, Ring } from '../opsCenter/charts';
import { useAdsHistory } from '../../hooks/useAdsModule';

/* ────────────────────────────── helpers ───────────────────────────────── */

const has = (v) => v !== null && v !== undefined && Number.isFinite(Number(v));
const num = (v) => (has(v) ? Number(v) : 0);
const fmtPct = (v, d = 1) => (has(v) ? `${Number(v).toFixed(d)}%` : '—');
const fmtX = (v) => (has(v) ? `${Number(v).toFixed(2)}×` : '—');
const money = (v) => (has(v) ? fmtINR(Number(v)) : '—');
const moneyFull = (v) => (has(v) ? fmtINRFull(Number(v)) : '—');
const int = (v) => (has(v) ? fmtNum(Number(v)) : '—');
const intFull = (v) => (has(v) ? fmtNumFull(Number(v)) : '—');
const sparkNums = (arr) => (arr || []).map((v) => (has(v) ? Number(v) : 0));
const toneOf = (v, invert = false) => {
    if (!has(v)) return 'none';
    const n = Number(v);
    if (Math.abs(n) < 0.05) return 'flat';
    const good = invert ? n < 0 : n > 0;
    return good ? 'pos' : 'neg';
};

const FLAG_LABEL = {
    waste: { label: 'Spend, no sales', palette: { 'SPEND, NO SALES': { bg: '#fdecea', fg: '#b42318' } } },
    highAcos: { label: 'High ACoS', palette: { 'HIGH ACOS': { bg: '#fef0e6', fg: '#b54708' } } },
    falling: { label: 'Falling', palette: { FALLING: { bg: '#fdecea', fg: '#b42318' } } },
    rising: { label: 'Rising', palette: { RISING: { bg: '#e8f6ee', fg: '#067647' } } },
};

const ChartMode = [
    { value: 'revenue', label: 'Sales' },
    { value: 'spend', label: 'Spend' },
    { value: 'efficiency', label: 'Efficiency' },
    { value: 'traffic', label: 'Traffic' },
    { value: 'orders', label: 'Orders' },
];

const GranularityOptions = [
    { value: 'auto', label: 'Auto' },
    { value: 'day', label: 'Day' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
];

/** Series builder: current window + the positionally-aligned previous window. */
const buildChartSeries = (overview, mode) => {
    const cur = overview?.series?.current || {};
    const prev = overview?.series?.previous || {};
    const s = (key, name, color, source = cur, dashed = false) => ({
        key, name, color, dashed, data: sparkNums(source[key]),
    });
    const defs = {
        revenue: [
            ['totalSales', 'Total sales', '#1349c6'],
            ['sales', 'Ad sales', '#6172f3'],
            ['organicSales', 'Organic', '#0e7490'],
        ],
        spend: [
            ['spend', 'Ad spend', '#b54708'],
            ['sales', 'Ad sales', '#1349c6'],
        ],
        efficiency: [
            ['acos', 'ACoS', '#d92d20'],
            ['tacos', 'TACoS', '#b54708'],
        ],
        traffic: [
            ['impressions', 'Impressions', '#6172f3'],
            ['clicks', 'Clicks', '#0e7490'],
            ['pageViews', 'Page views', '#8896ab'],
        ],
        orders: [
            ['orders', 'Ad orders', '#1349c6'],
            ['totalOrders', 'Total orders', '#067647'],
        ],
    };
    const list = (defs[mode] || defs.revenue).map(([k, n, c]) => s(k, n, c));
    if (overview?.previousAvailable) {
        list.push(...(defs[mode] || defs.revenue).map(([k, n, c]) => s(`prev_${k}`, `${n} · prev`, c, prev, true)));
    }
    return list;
};

const TrendUnit = { revenue: 'inr', spend: 'inr', efficiency: 'pct', traffic: 'num', orders: 'num' };

export const SERIES_MODE = { spend: 'spend', sales: 'revenue', totalSales: 'revenue', organicSales: 'revenue', acos: 'efficiency', tacos: 'efficiency', roas: 'spend', orders: 'orders', totalOrders: 'orders' };

/* ───────────────────────────── KPI strip ──────────────────────────────── */

export const KpiRow = ({ overview, focus, onFocus }) => {
    const t = overview?.totals || {};
    const d = overview?.delta || {};
    const spark = (key) => <Sparkline data={sparkNums(overview?.series?.current?.[key])} />;
    const tile = (props) => (
        <Tile
            key={props.seriesKey || props.label}
            {...props}
            spark={props.seriesKey ? spark(props.seriesKey) : undefined}
            active={focus === props.seriesKey}
            onClick={props.seriesKey ? () => onFocus(props.seriesKey) : undefined}
        />
    );

    return (
        <>
            {tile({
                label: 'Ad spend', value: money(t.spend), seriesKey: 'spend',
                sub: `CPC ${has(t.cpc) ? fmtINR(t.cpc) : '—'} · ${int(t.clicks)} clicks`,
                delta: <Delta value={d.spend} neutral />,
                tip: 'Total advertising cost in the selected window (ReportType is pinned, so daily and monthly rows are never mixed).',
            })}
            {tile({
                label: 'Ad sales', value: money(t.sales), seriesKey: 'sales',
                sub: `${int(t.orders)} orders · AOV ${money(t.aov)}`,
                delta: <Delta value={d.sales} />,
                tip: 'Sales attributed to advertising, from the ads report rows only.',
            })}
            {tile({
                label: 'Total sales', value: money(t.totalSales), seriesKey: 'totalSales',
                sub: `Organic ${money(t.organicSales)} (${fmtPct(t.adSharePct === null ? null : 100 - Number(t.adSharePct))})`,
                delta: <Delta value={d.totalSales} />,
                tip: 'Ad sales + organic sales in the same window.',
            })}
            {tile({
                label: 'ACoS', value: has(t.acos) ? Number(t.acos).toFixed(1) : '—', unit: has(t.acos) ? '%' : '',
                seriesKey: 'acos',
                sub: overview?.targets?.acos ? `Target ${fmtPct(overview.targets.acos.target)}` : `ROAS ${fmtX(t.roas)}`,
                delta: <Delta value={d.acos} invert points label="vs prev" />,
                tip: 'Advertising cost of sale = spend ÷ ad sales. Lower is better.',
            })}
            {tile({
                label: 'TACoS', value: has(t.tacos) ? Number(t.tacos).toFixed(1) : '—', unit: has(t.tacos) ? '%' : '',
                seriesKey: 'tacos',
                sub: `Ad share ${fmtPct(t.adSharePct)}`,
                delta: <Delta value={d.tacos} invert points label="vs prev" />,
                tip: 'Total advertising cost of sale = spend ÷ (ad sales + organic sales). The truest efficiency read.',
            })}
            {tile({
                label: 'ROAS', value: fmtX(t.roas), seriesKey: 'roas',
                sub: `Cost/order ${money(t.costPerOrder)}`,
                delta: <Delta value={d.roas} label="vs prev" />,
                tip: 'Return on ad spend = ad sales ÷ spend.',
            })}
            {tile({
                label: 'Orders', value: int(t.orders), seriesKey: 'orders',
                sub: `CVR ${fmtPct(t.cvr)}`,
                delta: <Delta value={d.orders} label="vs prev" />,
                tip: 'Orders attributed to advertising.',
            })}
            {tile({
                label: 'Traffic', value: int(t.impressions), seriesKey: 'impressions',
                sub: `CTR ${fmtPct(t.ctr, 2)} · ${int(t.clicks)} clicks`,
                delta: <Delta value={d.impressions} label="vs prev" />,
                tip: 'Impressions served. CTR below ~0.35% with high volume usually means relevance, not bids.',
            })}
        </>
    );
};

/* ───────────────────────────── trend panel ────────────────────────────── */

export const TrendPanel = ({
    overview, status, onRetry, granularity, onGranularity,
    mode: modeProp, onMode, focusKey, onFocusKey,
}) => {
    const [internalMode, setInternalMode] = useState('revenue');
    const mode = modeProp || internalMode;
    const setMode = onMode || setInternalMode;
    const [internalFocus, setInternalFocus] = useState(null);
    const focus = focusKey !== undefined ? focusKey : internalFocus;
    const setFocus = onFocusKey || setInternalFocus;
    const [hidden, setHidden] = useState([]);
    const series = useMemo(() => buildChartSeries(overview, mode), [overview, mode]);
    const unit = TrendUnit[mode] || 'inr';

    // Switching metric groups resets the legend/focus rather than carrying
    // series keys that no longer exist (avoids an effect that re-renders twice).
    const changeMode = (next) => {
        setMode(next);
        setHidden([]);
        setFocus(null);
    };

    const toggle = (key) => setHidden((h) => (h.includes(key) ? h.filter((k) => k !== key) : [...h, key]));

    if (status === 'error') {
        return (
            <Panel span={12} kicker="Performance trend" id="panel-trends">
                <MiniState tone="error" title="Trend unavailable" note="The series query failed — totals above are still from the last successful load." onRetry={onRetry} />
            </Panel>
        );
    }

    const period = overview?.period;

    return (
        <Panel
            id="panel-trends"
            span={12}
            kicker="Performance trend"
            meta={period ? `${period.label} · ${period.days} day${period.days === 1 ? '' : 's'} · ${period.granularity} buckets` : null}
            actions={(
                <>
                    <Segmented options={ChartMode} value={mode} onChange={changeMode} ariaLabel="Trend metric" />
                    <Segmented options={GranularityOptions} value={granularity} onChange={onGranularity} ariaLabel="Bucket size" />
                </>
            )}
        >
            {!overview ? (
                <MiniState tone="empty" title="No data loaded" note="Pick a window and seller to load the trend." />
            ) : (
                <>
                    <TrendChart
                        labels={overview.series?.keys || []}
                        series={series.map((s) => ({ ...s, data: s.data.map((v) => (v === null ? 0 : v)) }))}
                        unit={unit}
                        hidden={hidden}
                        onToggle={toggle}
                        focusKey={focus}
                        onFocus={setFocus}
                        granularity={overview.series?.granularity}
                        height={240}
                    />
                    {!overview.previousAvailable && (
                        <div className="ops-muted" style={{ marginTop: 6, fontSize: 11.5 }}>
                            No comparable previous window exists yet — deltas stay blank rather than showing a fabricated baseline.
                        </div>
                    )}
                </>
            )}
        </Panel>
    );
};

/* ─────────────────────────────── mix panel ────────────────────────────── */

const MIX_DIMS = [
    { value: 'seller', label: 'Seller' },
    { value: 'brand', label: 'Brand' },
    { value: 'category', label: 'Category' },
];

export const MixPanel = ({ mix, dim, onDim, status, onRetry, onSelectSeller }) => {
    const [sort, setSort] = useState({ key: 'totalSales', dir: 'desc' });
    const rows = (mix?.[dim] || []).slice();

    rows.sort((a, b) => {
        const av = a[sort.key];
        const bv = b[sort.key];
        const an = has(av) ? Number(av) : -Infinity;
        const bn = has(bv) ? Number(bv) : -Infinity;
        return sort.dir === 'asc' ? an - bn : bn - an;
    });

    const onSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));

    return (
        <Panel
            id="panel-mix"
            span={6}
            kicker="Mix & concentration"
            meta={`${rows.length} ${dim}${rows.length === 1 ? '' : 's'} with ad activity`}
            actions={<Segmented options={MIX_DIMS} value={dim} onChange={onDim} ariaLabel="Mix dimension" />}
        >
            {status === 'error' ? (
                <MiniState tone="error" title="Mix unavailable" note="The grouped mix query failed." onRetry={onRetry} />
            ) : rows.length === 0 ? (
                <MiniState tone="empty" title="No mix data" note="No ads rows in this window for the selected filters." />
            ) : (
                <table className="ops-table ops-table--dense">
                    <thead>
                        <tr>
                            <SortHeader label={dim} sortKey="name" activeKey={sort.key} dir={sort.dir} onSort={onSort} />
                            <SortHeader label="Sales" sortKey="totalSales" activeKey={sort.key} dir={sort.dir} onSort={onSort} numeric />
                            <SortHeader label="Share" sortKey="share" activeKey={sort.key} dir={sort.dir} onSort={onSort} numeric />
                            <SortHeader label="ACoS" sortKey="acos" activeKey={sort.key} dir={sort.dir} onSort={onSort} numeric />
                            <SortHeader label="vs prev" sortKey="deltaTotalSalesPct" activeKey={sort.key} dir={sort.dir} onSort={onSort} numeric />
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr
                                key={row.id || row.name}
                                onClick={dim === 'seller' && onSelectSeller ? () => onSelectSeller(row.id) : undefined}
                                style={dim === 'seller' && onSelectSeller ? { cursor: 'pointer' } : undefined}
                            >
                                <td>
                                    <span className="ops-item__title">{row.name}</span>
                                    {row.marketplace ? <span className="ops-muted"> · {row.marketplace}</span> : null}
                                </td>
                                <td className="ops-table__num ops-num">{money(row.totalSales)}</td>
                                <td className="ops-table__num" style={{ minWidth: 90 }}>
                                    <span className="ops-num">{fmtPct(row.share)}</span>
                                    <ShareBar pct={row.share} />
                                </td>
                                <td className="ops-table__num ops-num">{fmtPct(row.acos)}</td>
                                <td className="ops-table__num"><Delta value={row.deltaTotalSalesPct} compact /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </Panel>
    );
};

/* ────────────────────────────── movers ────────────────────────────────── */

const MoverList = ({ title, rows, tone, metric, onDrill, invert }) => (
    <div style={{ marginBottom: 10 }}>
        <div className="ops-panel__kicker" style={{ marginBottom: 4 }}>{title}</div>
        {rows.length === 0 ? (
            <div className="ops-muted" style={{ fontSize: 11.5, padding: '6px 0' }}>Nothing material in this window.</div>
        ) : (
            <div className="ops-list">
                {rows.map((row) => (
                    <button
                        key={row.key}
                        type="button"
                        className="ops-item ops-item--btn"
                        onClick={() => onDrill({ key: row.key, title: row.title, sku: row.sku })}
                        title={row.title || row.key}
                    >
                        <span style={{ flex: 1, minWidth: 0 }}>
                            <span className="ops-item__title ops-num">{row.key}</span>
                            <span className="ops-item__sub ops-muted">
                                {money(row.spend)} spend · ACoS {fmtPct(row.acos)}
                                {has(row.prevAcos) ? ` (was ${fmtPct(row.prevAcos)})` : ''}
                            </span>
                        </span>
                        <Sparkline data={sparkNums(row.spark)} width={90} height={24} color={tone} />
                        <span className={`ops-num ops-mover__delta ops-delta--${toneOf(metric(row), invert)}`} style={{ minWidth: 76, textAlign: 'right', fontWeight: 600 }}>
                            {metric(row)}
                        </span>
                    </button>
                ))}
            </div>
        )}
    </div>
);

export const MoversPanel = ({ movers, status, onRetry, onDrill }) => (
    <Panel
        id="panel-movers"
        span={6}
        kicker="Movers"
        meta="Largest period-over-period shifts"
    >
        {status === 'error' ? (
            <MiniState tone="error" title="Movers unavailable" note="The movers query failed." onRetry={onRetry} />
        ) : (
            <>
                <MoverList
                    title="Gaining sales"
                    rows={(movers?.gainers || []).slice(0, 4)}
                    tone="#067647"
                    onDrill={onDrill}
                    metric={(r) => (has(r.deltaTotalSales) ? `${r.deltaTotalSales >= 0 ? '+' : '−'}${fmtINR(Math.abs(r.deltaTotalSales))}` : '—')}
                />
                <MoverList
                    title="Losing sales"
                    rows={(movers?.decliners || []).slice(0, 4)}
                    tone="#d92d20"
                    invert
                    onDrill={onDrill}
                    metric={(r) => (has(r.deltaTotalSales) ? `${r.deltaTotalSales >= 0 ? '+' : '−'}${fmtINR(Math.abs(r.deltaTotalSales))}` : '—')}
                />
                <MoverList
                    title="Spend jumps (no sales gain)"
                    rows={(movers?.spendSpikes || []).filter((r) => num(r.deltaTotalSales) <= 0).slice(0, 3)}
                    tone="#b54708"
                    invert
                    onDrill={onDrill}
                    metric={(r) => (has(r.deltaSpend) ? `${r.deltaSpend >= 0 ? '+' : '−'}${fmtINR(Math.abs(r.deltaSpend))}` : '—')}
                />
            </>
        )}
    </Panel>
);

/* ──────────────────────────── efficiency panel ────────────────────────── */

export const EfficiencyPanel = ({ efficiency, status, onRetry, onDrill }) => {
    const buckets = efficiency?.buckets || [];
    const waste = efficiency?.waste || {};
    const zero = waste.zeroSales || {};
    const high = waste.highAcos || {};
    const scatter = efficiency?.scatter || [];

    const bandColors = {
        acos_le_15: '#067647', acos_15_25: '#2e90fa', acos_25_40: '#b54708', acos_gt_40: '#d92d20', no_sales: '#8b1f1b', no_spend: '#8896ab',
    };

    // Spend-vs-sales scatter (top spenders), drawn as a dependency-free SVG.
    const W = 520; const H = 170; const pad = 26;
    const maxX = Math.max(...scatter.map((r) => num(r.spend)), 1);
    const maxY = Math.max(...scatter.map((r) => num(r.totalSales)), 1);

    return (
        <Panel
            id="panel-efficiency"
            span={6}
            kicker="Efficiency bands"
            meta={`Spend floor ${money(waste.spendFloor)} · ACoS threshold ${fmtPct(high.thresholdPct || 40, 0)}`}
        >
            {status === 'error' ? (
                <MiniState tone="error" title="Efficiency unavailable" note="The banding query failed." onRetry={onRetry} />
            ) : (
                <>
                    <SegmentedBar
                        segments={buckets.map((b) => ({ key: b.key, label: `${b.label} · ${money(b.spend)}`, value: num(b.spend), color: bandColors[b.key] || '#51607a' }))}
                        total={buckets.reduce((s, b) => s + num(b.spend), 0)}
                    />

                    <div className="ops-statrow" style={{ marginTop: 12 }}>
                        <div className="ops-stat">
                            <span className="ops-stat__label">Spend with no ad sales</span>
                            <span className="ops-stat__value ops-num" style={{ color: num(zero.spend) > 0 ? '#d92d20' : undefined }}>{money(zero.spend)}</span>
                            <span className="ops-stat__sub ops-muted ops-num">{int(zero.keys)} keys ≥ spend floor</span>
                        </div>
                        <div className="ops-stat">
                            <span className="ops-stat__label">Spend above ACoS ceiling</span>
                            <span className="ops-stat__value ops-num" style={{ color: num(high.spend) > 0 ? '#b54708' : undefined }}>{money(high.spend)}</span>
                            <span className="ops-stat__sub ops-muted ops-num">{int(high.keys)} keys · {money(high.sales)} sales</span>
                        </div>
                    </div>

                    {(zero.rows || []).length > 0 && (
                        <>
                            <div className="ops-panel__kicker" style={{ margin: '12px 0 4px' }}>Biggest zero-sales spenders</div>
                            <table className="ops-table ops-table--dense">
                                <thead>
                                    <tr>
                                        <th>ASIN</th>
                                        <th className="ops-table__num">Spend</th>
                                        <th className="ops-table__num">Impressions</th>
                                        <th className="ops-table__num">Clicks</th>
                                        <th className="ops-table__num">CTR</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(zero.rows || []).slice(0, 6).map((row) => (
                                        <tr key={row.key} onClick={() => onDrill({ key: row.key, title: row.title, sku: row.sku })} style={{ cursor: 'pointer' }}>
                                            <td className="ops-num">{row.key}</td>
                                            <td className="ops-table__num ops-num">{money(row.spend)}</td>
                                            <td className="ops-table__num ops-num">{int(row.impressions)}</td>
                                            <td className="ops-table__num ops-num">{int(row.clicks)}</td>
                                            <td className="ops-table__num ops-num">{fmtPct(row.ctr, 2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </>
                    )}

                    {scatter.length > 1 && (
                        <>
                            <div className="ops-panel__kicker" style={{ margin: '12px 0 4px' }}>Spend vs total sales (top {scatter.length} by spend)</div>
                            <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Spend versus sales scatter">
                                <line x1={pad} y1={H - pad} x2={W - 6} y2={H - pad} stroke="#e3e8ee" />
                                <line x1={pad} y1={6} x2={pad} y2={H - pad} stroke="#e3e8ee" />
                                <line x1={pad} y1={H - pad} x2={W - 6} y2={6} stroke="#cbd5e1" strokeDasharray="4 4" />
                                <text x={W - 8} y={14} textAnchor="end" fontSize="9" fill="#8896ab">break-even</text>
                                {scatter.map((row) => {
                                    const x = pad + (num(row.spend) / maxX) * (W - pad - 8);
                                    const y = H - pad - (num(row.totalSales) / maxY) * (H - pad - 10);
                                    const good = num(row.totalSales) >= num(row.spend);
                                    return (
                                        <circle
                                            key={row.key}
                                            cx={x}
                                            cy={y}
                                            r={Math.max(2.5, Math.min(7, Math.sqrt(num(row.spend)) / 26))}
                                            fill={good ? '#067647' : '#d92d20'}
                                            fillOpacity="0.55"
                                            stroke="#fff"
                                            strokeWidth="0.8"
                                        >
                                            <title>{`${row.key} · spend ${moneyFull(row.spend)} · total sales ${moneyFull(row.totalSales)} · ACoS ${fmtPct(row.acos)}`}</title>
                                        </circle>
                                    );
                                })}
                                <text x={pad} y={H - 6} fontSize="9" fill="#8896ab">spend →</text>
                                <text x={8} y={16} fontSize="9" fill="#8896ab">sales</text>
                            </svg>
                        </>
                    )}
                </>
            )}
        </Panel>
    );
};

/* ───────────────────────────── targets panel ──────────────────────────── */

export const TargetsPanel = ({ targets, totals, scope, status, onRetry }) => {
    const ads = targets?.ads;
    const acos = targets?.acos;
    const attainment = has(ads?.attainmentPct) ? Number(ads.attainmentPct) : null;
    const ringColor = attainment === null ? '#8896ab' : attainment > 110 ? '#b54708' : attainment >= 85 ? '#067647' : '#1349c6';

    return (
        <Panel
            id="panel-targets"
            span={6}
            kicker="Targets & pacing"
            meta={targets?.months?.length ? `${targets.months.join(', ')}` : 'No target rows for this window'}
        >
            {status === 'error' ? (
                <MiniState tone="error" title="Targets unavailable" note="GmsTargets could not be read for this window." onRetry={onRetry} />
            ) : !ads && !acos ? (
                <MiniState
                    tone="empty"
                    title="No ADS/ACoS targets set"
                    note="Add them in Targets to see pacing, attainment and ACoS headroom here. Spend and ACoS are still shown from actuals."
                />
            ) : (
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                    {ads && (
                        <div style={{ textAlign: 'center' }}>
                            <Ring pct={Math.min(attainment || 0, 140)} color={ringColor} label={`${Math.round(attainment || 0)}%`} />
                            <div className="ops-muted" style={{ fontSize: 11 }}>ADS budget used</div>
                            <div className="ops-num" style={{ fontSize: 12 }}>
                                {money(totals?.spend)} / {money(ads.target)}
                            </div>
                        </div>
                    )}
                    <div style={{ flex: 1, minWidth: 180 }}>
                        {ads && (
                            <div className="ops-statrow" style={{ marginBottom: 8 }}>
                                <div className="ops-stat">
                                    <span className="ops-stat__label">Remaining budget</span>
                                    <span className="ops-stat__value ops-num">{money(Math.max(0, num(ads.target) - num(totals?.spend)))}</span>
                                    <span className="ops-stat__sub ops-muted">of {money(ads.target)}</span>
                                </div>
                            </div>
                        )}
                        {acos && (
                            <div className="ops-stat">
                                <span className="ops-stat__label">ACoS vs target</span>
                                <span className="ops-stat__value ops-num" style={{ color: acos.onTarget ? '#067647' : '#d92d20' }}>
                                    {fmtPct(acos.actual)} <small className="ops-muted">/ {fmtPct(acos.target)}</small>
                                </span>
                                <span className="ops-stat__sub ops-muted ops-num">
                                    {has(acos.gapPoints)
                                        ? `${acos.gapPoints > 0 ? '+' : '−'}${Math.abs(acos.gapPoints).toFixed(1)} pts ${acos.onTarget ? 'inside target' : 'over target'}`
                                        : 'No ACoS actual for this window'}
                                    {acos.sampleSize ? ` · ${acos.sampleSize} target row${acos.sampleSize === 1 ? '' : 's'} averaged` : ''}
                                </span>
                            </div>
                        )}
                        {scope && !scope.isGlobal && (
                            <div className="ops-muted" style={{ fontSize: 11, marginTop: 8 }}>
                                Targets are summed for your assigned sellers only.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {(targets?.sellerTargets || []).length > 0 && scope?.isGlobal && (
                <>
                    <div className="ops-panel__kicker" style={{ margin: '12px 0 4px' }}>Target rows read ({targets.sellerTargets.length})</div>
                    <table className="ops-table ops-table--dense">
                        <thead>
                            <tr>
                                <th>Seller</th>
                                <th>Goal</th>
                                <th className="ops-table__num">Target</th>
                            </tr>
                        </thead>
                        <tbody>
                            {targets.sellerTargets.slice(0, 8).map((row, i) => (
                                <tr key={`${row.sellerId}-${row.goalType}-${row.year}-${row.month}-${i}`}>
                                    <td>{row.sellerId}</td>
                                    <td><Chip label={row.goalType} /></td>
                                    <td className="ops-table__num ops-num">{row.goalType === 'ACOS' ? fmtPct(row.target) : money(row.target)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </>
            )}
        </Panel>
    );
};

/* ──────────────────────────── freshness panel ─────────────────────────── */

export const FreshnessPanel = ({ freshness, period, reportType, scope }) => (
    <Panel id="panel-freshness" span={6} kicker="Data coverage" meta={`${reportType || 'daily'} rows`}>
        {!freshness ? (
            <MiniState tone="empty" title="No coverage information" />
        ) : (
            <>
                <div className="ops-statrow">
                    <div className="ops-stat">
                        <span className="ops-stat__label">Last ads row</span>
                        <span className="ops-stat__value ops-num">{freshness.lastDate || '—'}</span>
                        <span className="ops-stat__sub ops-muted">
                            {freshness.lastUpload ? `uploaded ${timeAgo(freshness.lastUpload)}` : 'upload time unavailable'}
                        </span>
                    </div>
                    <div className="ops-stat">
                        <span className="ops-stat__label">Days covered</span>
                        <span className="ops-stat__value ops-num">
                            {int(freshness.daysCovered)}<small className="ops-muted"> / {int(freshness.daysInWindow)}</small>
                        </span>
                        <span className="ops-stat__sub ops-muted">
                            {(freshness.gapDays || []).length === 0 ? 'no gaps in window' : `${freshness.gapDays.length} gap day(s)`}
                        </span>
                    </div>
                    <div className="ops-stat">
                        <span className="ops-stat__label">Rows / ASINs</span>
                        <span className="ops-stat__value ops-num">{intFull(freshness.rowCount)}</span>
                        <span className="ops-stat__sub ops-muted ops-num">{int(freshness.asinCount)} distinct ASINs</span>
                    </div>
                </div>
                {(freshness.gapDays || []).length > 0 && (
                    <div className="ops-muted" style={{ fontSize: 11.5, marginTop: 8 }}>
                        Missing dates: {(freshness.gapDays || []).slice(0, 12).join(', ')}
                        {(freshness.gapDays || []).length > 12 ? ` +${freshness.gapDays.length - 12} more` : ''}
                        {' — '}totals for {period?.label} are understated by those days.
                    </div>
                )}
                {scope?.empty && <div className="ops-muted" style={{ fontSize: 11.5 }}>No sellers are assigned to your account.</div>}
            </>
        )}
    </Panel>
);

/* ─────────────────────────────── insights ─────────────────────────────── */

export const InsightRail = ({ insights, onJump }) => {
    const list = insights?.insights || [];
    if (list.length === 0) {
        return (
            <div className="ops-insights">
                <span className="ops-muted" style={{ fontSize: 12 }}>No rule findings for this window.</span>
            </div>
        );
    }
    return (
        <div className="ops-insights" role="list" aria-label="Rule-based insights">
            {list.slice(0, 10).map((insight) => (
                <button
                    key={insight.id}
                    type="button"
                    role="listitem"
                    className={`ops-insight ops-insight--${insight.tone}`}
                    onClick={() => onJump && insight.target && onJump(insight.target)}
                    title={insight.detail || insight.text}
                >
                    <i />
                    <span>{insight.text}</span>
                </button>
            ))}
            {(insights?.counts?.neg || insights?.counts?.warn) ? (
                <span className="ops-muted" style={{ fontSize: 11.5, alignSelf: 'center' }}>
                    {insights.counts.neg || 0} critical · {insights.counts.warn || 0} warning
                </span>
            ) : null}
        </div>
    );
};

/* ─────────────────────────────── ASIN table ───────────────────────────── */

const FLAG_OPTIONS = [
    { value: 'all', label: 'All' },
    { value: 'rising', label: 'Rising' },
    { value: 'falling', label: 'Falling' },
    { value: 'waste', label: 'Waste' },
    { value: 'high_acos', label: 'High ACoS' },
    { value: 'no_sales', label: 'No sales' },
    { value: 'low_ctr', label: 'Low CTR' },
];

const GROUP_OPTIONS = [
    { value: 'asin', label: 'ASIN' },
    { value: 'parent', label: 'Parent' },
];

export const TablePanel = ({
    table, filters, onFilters, status, onRetry, onDrill, canExport, onExport, exporting, canImport, onImport,
}) => {
    const [search, setSearch] = useState(filters?.search || '');

    // Debounce typing into the server-side query (the table is no longer filtered in the browser).
    useEffect(() => {
        const id = setTimeout(() => {
            if ((filters?.search || '') !== search) onFilters({ search });
        }, 400);
        return () => clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const rows = table?.rows || [];
    const totals = table?.totals || {};
    const total = table?.total || 0;
    const page = table?.page || 1;
    const limit = table?.limit || 50;
    const totalPages = table?.totalPages || 1;
    const sortBy = table?.appliedFilters?.sortBy || 'totalSales';
    const sortOrder = table?.appliedFilters?.sortOrder || 'desc';

    const onSort = (key) => onFilters({
        sortBy: key,
        sortOrder: sortBy === key && sortOrder === 'desc' ? 'asc' : 'desc',
        page: 1,
    });

    return (
        <Panel
            id="panel-table"
            span={12}
            kicker="ASIN performance"
            meta={`${intFull(total)} ${table?.groupBy === 'parent' ? 'parent groups' : 'ASINs'} · page ${page} of ${totalPages}`}
            actions={(
                <>
                    <Segmented
                        options={GROUP_OPTIONS}
                        value={table?.groupBy || 'asin'}
                        onChange={(v) => onFilters({ groupBy: v, page: 1 })}
                        ariaLabel="Group by"
                    />
                    {canImport && <Button size="small" onClick={onImport}>Import</Button>}
                    {canExport && (
                        <Button size="small" type="primary" loading={exporting} onClick={onExport}>Export XLSX</Button>
                    )}
                </>
            )}
        >
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
                <Input
                    size="small"
                    className="ops-search"
                    placeholder="Search ASIN, SKU or title"
                    value={search}
                    allowClear
                    onChange={(e) => setSearch(e.target.value)}
                    onPressEnter={() => onFilters({ search, page: 1 })}
                    style={{ maxWidth: 260 }}
                />
                <Segmented
                    options={FLAG_OPTIONS}
                    value={filters?.flag || 'all'}
                    onChange={(v) => onFilters({ flag: v, page: 1 })}
                    ariaLabel="Row filter"
                />
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className="ops-muted" style={{ fontSize: 11.5 }}>Rows</span>
                    <Select
                        size="small"
                        className="ops-select"
                        value={limit}
                        onChange={(v) => onFilters({ limit: v, page: 1 })}
                        options={[25, 50, 100, 200].map((n) => ({ value: n, label: String(n) }))}
                        style={{ width: 76 }}
                    />
                </span>
            </div>

            {status === 'error' ? (
                <MiniState tone="error" title="Table unavailable" note="The paginated query failed. Filters and totals above are from the last successful load." onRetry={onRetry} />
            ) : rows.length === 0 ? (
                <MiniState
                    tone="empty"
                    title="No rows match these filters"
                    note={`${intFull(total)} rows match the window and seller scope. Clear the flag filter or the search to widen it.`}
                />
            ) : (
                <>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="ops-table">
                            <thead>
                                <tr>
                                    <SortHeader label={table?.groupBy === 'parent' ? 'Parent' : 'ASIN'} sortKey="title" activeKey={sortBy} dir={sortOrder} onSort={onSort} />
                                    <SortHeader label="Spend" sortKey="spend" activeKey={sortBy} dir={sortOrder} onSort={onSort} numeric />
                                    <SortHeader label="Ad sales" sortKey="sales" activeKey={sortBy} dir={sortOrder} onSort={onSort} numeric />
                                    <SortHeader label="Total sales" sortKey="totalSales" activeKey={sortBy} dir={sortOrder} onSort={onSort} numeric tip="Ad sales + organic sales for the same key." />
                                    <SortHeader label="ACoS" sortKey="acos" activeKey={sortBy} dir={sortOrder} onSort={onSort} numeric tip="Spend ÷ ad sales. Lower is better." />
                                    <SortHeader label="TACoS" sortKey="tacos" activeKey={sortBy} dir={sortOrder} onSort={onSort} numeric tip="Spend ÷ total sales." />
                                    <SortHeader label="ROAS" sortKey="roas" activeKey={sortBy} dir={sortOrder} onSort={onSort} numeric />
                                    <SortHeader label="Orders" sortKey="orders" activeKey={sortBy} dir={sortOrder} onSort={onSort} numeric />
                                    <SortHeader label="CTR" sortKey="ctr" activeKey={sortBy} dir={sortOrder} onSort={onSort} numeric />
                                    <SortHeader label="CVR" sortKey="cvr" activeKey={sortBy} dir={sortOrder} onSort={onSort} numeric />
                                    <SortHeader label="Δ sales" sortKey="delta" activeKey={sortBy} dir={sortOrder} onSort={onSort} numeric tip="Change in total sales versus the previous window of equal length." />
                                    <th style={{ width: 92 }}>Trend</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => (
                                    <tr key={row.key} onClick={() => onDrill({ key: row.key, title: row.title, sku: row.sku })} style={{ cursor: 'pointer' }}>
                                        <td style={{ maxWidth: 260 }}>
                                            <span className="ops-item__title ops-num">{row.key}</span>
                                            <span className="ops-item__sub ops-muted" title={row.title || ''}>
                                                {row.sku ? `${row.sku} · ` : ''}{row.title || 'Untitled'}
                                            </span>
                                            <span style={{ display: 'inline-flex', gap: 4, marginLeft: 6 }}>
                                                {row.flags?.waste && <Chip label="spend, no sales" palette={FLAG_LABEL.waste.palette} />}
                                                {row.flags?.highAcos && <Chip label="high acos" palette={FLAG_LABEL.highAcos.palette} />}
                                                {row.childCount > 1 && <Chip label={`${row.childCount} children`} />}
                                            </span>
                                        </td>
                                        <td className="ops-table__num ops-num">{money(row.spend)}</td>
                                        <td className="ops-table__num ops-num">{money(row.sales)}</td>
                                        <td className="ops-table__num ops-num">{money(row.totalSales)}</td>
                                        <td className="ops-table__num ops-num" style={{ color: num(row.acos) > 40 ? '#d92d20' : undefined }}>{fmtPct(row.acos)}</td>
                                        <td className="ops-table__num ops-num">{fmtPct(row.tacos)}</td>
                                        <td className="ops-table__num ops-num">{fmtX(row.roas)}</td>
                                        <td className="ops-table__num ops-num">{int(row.orders)}</td>
                                        <td className="ops-table__num ops-num">{fmtPct(row.ctr, 2)}</td>
                                        <td className="ops-table__num ops-num">{fmtPct(row.cvr, 2)}</td>
                                        <td className="ops-table__num">
                                            <Delta
                                                value={row.deltaTotalSalesPct}
                                                compact
                                                label={has(row.deltaTotalSales) ? `${row.deltaTotalSales >= 0 ? '+' : '−'}${fmtINR(Math.abs(row.deltaTotalSales))}` : undefined}
                                            />
                                        </td>
                                        <td><Sparkline data={sparkNums(row.spark)} width={80} height={22} color={toneOf(row.deltaTotalSalesPct) === 'neg' ? '#d92d20' : '#067647'} /></td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr style={{ fontWeight: 700 }}>
                                    <td>
                                        Totals
                                        <span className="ops-muted" style={{ fontWeight: 400 }}> · {intFull(totals.keys)} keys in filter</span>
                                    </td>
                                    <td className="ops-table__num ops-num">{money(totals.spend)}</td>
                                    <td className="ops-table__num ops-num">{money(totals.sales)}</td>
                                    <td className="ops-table__num ops-num">{money(totals.totalSales)}</td>
                                    <td className="ops-table__num ops-num">{fmtPct(totals.acos)}</td>
                                    <td className="ops-table__num ops-num">{fmtPct(totals.tacos)}</td>
                                    <td className="ops-table__num ops-num">{fmtX(totals.roas)}</td>
                                    <td className="ops-table__num ops-num">{int(totals.orders)}</td>
                                    <td className="ops-table__num ops-num">{fmtPct(totals.ctr, 2)}</td>
                                    <td className="ops-table__num ops-num">{fmtPct(totals.cvr, 2)}</td>
                                    <td className="ops-table__num"><Delta value={table?.delta?.totalSales} compact /></td>
                                    <td />
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
                        <Button size="small" disabled={page <= 1} onClick={() => onFilters({ page: 1 })}>« First</Button>
                        <Button size="small" disabled={page <= 1} onClick={() => onFilters({ page: page - 1 })}>‹ Prev</Button>
                        <span className="ops-muted ops-num" style={{ fontSize: 12 }}>
                            Page {page} / {totalPages} · showing {rows.length} of {intFull(total)}
                        </span>
                        <Button size="small" disabled={page >= totalPages} onClick={() => onFilters({ page: page + 1 })}>Next ›</Button>
                        <Button size="small" disabled={page >= totalPages} onClick={() => onFilters({ page: totalPages })}>Last »</Button>
                        <span className="ops-muted" style={{ fontSize: 11.5, marginLeft: 'auto' }}>
                            Totals in the footer cover the whole filtered set, not just this page.
                        </span>
                    </div>
                </>
            )}
        </Panel>
    );
};

/* ─────────────────────────── drill-down modal ─────────────────────────── */

export const DrillModal = ({ target, filters, onClose }) => {
    const { data, isLoading, isError, error, refetch } = useAdsHistory(target?.key, filters);
    const open = !!target?.key;
    const days = useMemo(() => data?.days || [], [data]);

    const totals = useMemo(() => days.reduce((acc, d) => ({
        spend: acc.spend + num(d.spend),
        sales: acc.sales + num(d.sales),
        totalSales: acc.totalSales + num(d.totalSales),
        orders: acc.orders + num(d.orders),
    }), { spend: 0, sales: 0, totalSales: 0, orders: 0 }), [days]);

    return (
        <Modal
            open={open}
            onCancel={onClose}
            footer={null}
            width={880}
            title={target ? `${target.key}${target.sku ? ` · ${target.sku}` : ''}` : ''}
        >
            {target?.title && <div className="ops-muted" style={{ marginBottom: 8 }}>{target.title}</div>}
            {isLoading && <Progress percent={60} status="active" showInfo={false} />}
            {isError && (
                <MiniState tone="error" title="Drill-down failed" note={error?.message || 'Unknown error'} onRetry={refetch} />
            )}
            {!isLoading && !isError && days.length === 0 && (
                <MiniState tone="empty" title="No daily rows" note="This key has no ads rows inside the selected window." />
            )}
            {days.length > 0 && (
                <>
                    <div className="ops-statrow" style={{ marginBottom: 10 }}>
                        <div className="ops-stat">
                            <span className="ops-stat__label">Spend</span>
                            <span className="ops-stat__value ops-num">{money(totals.spend)}</span>
                        </div>
                        <div className="ops-stat">
                            <span className="ops-stat__label">Total sales</span>
                            <span className="ops-stat__value ops-num">{money(totals.totalSales)}</span>
                        </div>
                        <div className="ops-stat">
                            <span className="ops-stat__label">ACoS</span>
                            <span className="ops-stat__value ops-num">{fmtPct(totals.sales > 0 ? (totals.spend / totals.sales) * 100 : null)}</span>
                        </div>
                        <div className="ops-stat">
                            <span className="ops-stat__label">Orders</span>
                            <span className="ops-stat__value ops-num">{int(totals.orders)}</span>
                        </div>
                    </div>
                    <Bars
                        labels={days.map((d) => d.date.slice(5))}
                        data={sparkNums(days.map((d) => d.totalSales))}
                        height={140}
                        unit="inr"
                        secondary={[{ name: 'Spend', data: sparkNums(days.map((d) => d.spend)), unit: 'inr' }]}
                    />
                    <div style={{ maxHeight: 240, overflow: 'auto', marginTop: 10 }}>
                        <table className="ops-table ops-table--dense">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th className="ops-table__num">Spend</th>
                                    <th className="ops-table__num">Ad sales</th>
                                    <th className="ops-table__num">Organic</th>
                                    <th className="ops-table__num">ACoS</th>
                                    <th className="ops-table__num">Orders</th>
                                    <th className="ops-table__num">CTR</th>
                                    <th className="ops-table__num">CVR</th>
                                </tr>
                            </thead>
                            <tbody>
                                {days.map((d) => (
                                    <tr key={d.date}>
                                        <td className="ops-num">{d.date}</td>
                                        <td className="ops-table__num ops-num">{money(d.spend)}</td>
                                        <td className="ops-table__num ops-num">{money(d.sales)}</td>
                                        <td className="ops-table__num ops-num">{money(d.organicSales)}</td>
                                        <td className="ops-table__num ops-num">{fmtPct(d.acos)}</td>
                                        <td className="ops-table__num ops-num">{int(d.orders)}</td>
                                        <td className="ops-table__num ops-num">{fmtPct(d.ctr, 2)}</td>
                                        <td className="ops-table__num ops-num">{fmtPct(d.cvr, 2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </Modal>
    );
};

/* ──────────────────────────── AI analyst panel ─────────────────────────── */

const ImpactChip = ({ level, kind = 'impact' }) => {
    const map = {
        high: { bg: '#fdecea', fg: '#b42318' },
        medium: { bg: '#fef0e6', fg: '#b54708' },
        low: { bg: '#eef1f5', fg: '#51607a' },
    };
    const palette = kind === 'severity'
        ? { high: { bg: '#fdecea', fg: '#b42318' }, medium: { bg: '#fef0e6', fg: '#b54708' }, low: { bg: '#ecfdf3', fg: '#067647' } }
        : map;
    return <Chip label={level} palette={{ [String(level).toUpperCase()]: palette[level] || palette.low }} />;
};

export const AiAnalystPanel = ({ insights, ai, onRun, question, setQuestion, canRun = true }) => {
    const narrative = ai?.data?.narrative;
    const error = ai?.error;

    return (
        <Panel
            id="panel-ai"
            span={12}
            kicker="AI analyst"
            meta={narrative?.meta?.provider ? `${narrative.meta.provider} · ${(ai.data.latencyMs / 1000).toFixed(1)}s · ${new Date(ai.data.generatedAt).toLocaleTimeString('en-IN')}` : 'Rules run instantly · AI only when you ask'}
            actions={(
                <Button
                    size="small"
                    type="primary"
                    loading={ai?.isPending}
                    disabled={!canRun}
                    onClick={() => onRun()}
                >
                    {narrative ? 'Regenerate review' : 'Generate AI review'}
                </Button>
            )}
        >
            <div className="ops-muted" style={{ fontSize: 11.5, marginBottom: 8 }}>
                The rule engine below is deterministic and free — it runs on every load from the numbers on this page.
                The LLM review is opt-in: it receives a numeric digest only (no titles, no raw rows) and every claim is
                grounded in the figures quoted beside it.
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <Input
                    size="small"
                    placeholder="Ask a question (optional) — e.g. where did ACoS drift come from?"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onPressEnter={() => onRun()}
                    maxLength={400}
                />
            </div>

            {ai?.isPending && (
                <div style={{ marginBottom: 10 }}>
                    <Progress percent={90} status="active" showInfo={false} strokeColor="#1349c6" />
                    <span className="ops-muted" style={{ fontSize: 11.5 }}>Asking the model for a grounded review…</span>
                </div>
            )}

            {error && (
                <div className="ops-banner" role="alert" style={{ marginBottom: 10 }}>
                    <span className="ops-banner__text">
                        <strong>AI review unavailable.</strong>{' '}
                        {error.code === 'ai_unavailable'
                            ? 'The model did not return a usable response — the rule findings below are unaffected and remain authoritative.'
                            : error.message}
                    </span>
                </div>
            )}

            {narrative && (
                <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{narrative.headline}</div>
                    {narrative.summary && <div style={{ fontSize: 12.5, lineHeight: 1.55, marginBottom: 10 }}>{narrative.summary}</div>}

                    {narrative.findings.length > 0 && (
                        <div className="ads-ai-grid">
                            {narrative.findings.map((f, i) => (
                                <div key={`${f.title}-${i}`} className="ads-ai-card">
                                    <div className="ads-ai-card__head">
                                        <span>{f.title}</span>
                                        <ImpactChip level={f.impact} />
                                    </div>
                                    <div className="ads-ai-card__body">{f.detail}</div>
                                    {f.evidence && <div className="ads-ai-card__ev ops-num">evidence: {f.evidence}</div>}
                                </div>
                            ))}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12 }}>
                        {narrative.risks.length > 0 && (
                            <div style={{ flex: 1, minWidth: 260 }}>
                                <div className="ops-panel__kicker" style={{ marginBottom: 6 }}>Risks</div>
                                <div className="ops-list">
                                    {narrative.risks.map((r, i) => (
                                        <div key={`${r.title}-${i}`} className="ops-item">
                                            <span style={{ flex: 1 }}>
                                                <span className="ops-item__title">{r.title}</span>
                                                <span className="ops-item__sub ops-muted">{r.detail}</span>
                                            </span>
                                            <ImpactChip level={r.severity} kind="severity" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {narrative.actions.length > 0 && (
                            <div style={{ flex: 1, minWidth: 260 }}>
                                <div className="ops-panel__kicker" style={{ marginBottom: 6 }}>Recommended actions</div>
                                <div className="ops-list">
                                    {narrative.actions.map((a, i) => (
                                        <div key={`${a.action}-${i}`} className="ops-item">
                                            <span style={{ flex: 1 }}>
                                                <span className="ops-item__title">{a.action}</span>
                                                <span className="ops-item__sub ops-muted">
                                                    {a.rationale}{a.expectedImpact ? ` → ${a.expectedImpact}` : ''}
                                                </span>
                                            </span>
                                            <ImpactChip level={a.effort} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {narrative.confidence?.level && (
                        <div className="ops-muted" style={{ fontSize: 11.5, marginTop: 10 }}>
                            Confidence: <strong>{narrative.confidence.level}</strong>
                            {narrative.confidence.reason ? ` — ${narrative.confidence.reason}` : ''}
                            {ai.data?.grounding?.insightsUsed ? ` · grounded in ${ai.data.grounding.insightsUsed} rule findings` : ''}
                        </div>
                    )}
                </div>
            )}

            <div className="ops-panel__kicker" style={{ marginBottom: 6 }}>
                Rule findings ({insights?.insights?.length || 0})
            </div>
            {(insights?.insights || []).length === 0 ? (
                <MiniState tone="empty" title="No rule findings" note="Either the window has no data or every rule is inside its threshold." />
            ) : (
                <div className="ads-rule-list">
                    {(insights.insights || []).map((insight) => (
                        <div key={insight.id} className={`ads-rule ads-rule--${insight.tone}`}>
                            <div className="ads-rule__head">
                                <i className={`ads-rule__dot ads-rule__dot--${insight.tone}`} />
                                <span>{insight.text}</span>
                                <span className="ops-muted ops-num" style={{ marginLeft: 'auto', fontSize: 10.5 }}>p{insight.priority}</span>
                            </div>
                            {insight.detail && <div className="ads-rule__detail">{insight.detail}</div>}
                            {insight.metrics && Object.keys(insight.metrics).length > 0 && (
                                <div className="ads-rule__metrics">
                                    {Object.entries(insight.metrics).map(([k, v]) => (
                                        <span key={k}><em>{k}</em> <b className="ops-num">{v}</b></span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </Panel>
    );
};

/* ───────────────────────────── report panel ───────────────────────────── */

export const ReportPanel = ({ report, status, onRetry, onOpenMonth }) => {
    const months = report?.months || [];
    const sellers = report?.sellers || [];

    if (status === 'error') {
        return (
            <Panel span={12} kicker="Month-by-month vs targets">
                <MiniState tone="error" title="Report unavailable" note="The monthly aggregation failed." onRetry={onRetry} />
            </Panel>
        );
    }

    return (
        <>
            <Panel
                span={12}
                kicker="Month-by-month vs ADS budget"
                meta={report?.period ? `${report.period.start} → ${report.period.end} · ${report.reportType} rows` : null}
            >
                {months.length === 0 ? (
                    <MiniState tone="empty" title="No monthly data" note="No ads rows for this window with the current filters." />
                ) : (
                    <>
                        <TrendChart
                            labels={months.map((m) => m.key)}
                            series={[
                                { key: 'spend', name: 'Ad spend', color: '#b54708', data: months.map((m) => num(m.spend)) },
                                { key: 'totalSales', name: 'Total sales', color: '#1349c6', data: months.map((m) => num(m.totalSales)) },
                                { key: 'adsTarget', name: 'ADS target', color: '#6172f3', dashed: true, data: months.map((m) => num(m.adsTarget)) },
                            ]}
                            unit="inr"
                            height={220}
                            granularity="month"
                        />
                        <table className="ops-table ops-table--dense" style={{ marginTop: 10 }}>
                            <thead>
                                <tr>
                                    <th>Month</th>
                                    <th className="ops-table__num">Spend</th>
                                    <th className="ops-table__num">Target</th>
                                    <th className="ops-table__num">Attainment</th>
                                    <th className="ops-table__num">Ad sales</th>
                                    <th className="ops-table__num">Total sales</th>
                                    <th className="ops-table__num">ACoS</th>
                                    <th className="ops-table__num">TACoS</th>
                                    <th className="ops-table__num">Orders</th>
                                </tr>
                            </thead>
                            <tbody>
                                {months.map((m) => (
                                    <tr key={m.key} onClick={() => onOpenMonth && onOpenMonth(m)} style={{ cursor: onOpenMonth ? 'pointer' : undefined }}>
                                        <td className="ops-num">{m.key}</td>
                                        <td className="ops-table__num ops-num">{money(m.spend)}</td>
                                        <td className="ops-table__num ops-num">{m.adsTarget ? money(m.adsTarget) : '—'}</td>
                                        <td className="ops-table__num" style={{ minWidth: 110 }}>
                                            {has(m.attainmentPct) ? (
                                                <>
                                                    <span className="ops-num" style={{ color: m.attainmentPct > 110 ? '#b54708' : m.attainmentPct >= 85 ? '#067647' : '#1349c6' }}>
                                                        {fmtPct(m.attainmentPct, 0)}
                                                    </span>
                                                    <ShareBar pct={Math.min(m.attainmentPct, 100)} color={m.attainmentPct > 110 ? '#b54708' : '#067647'} />
                                                </>
                                            ) : '—'}
                                        </td>
                                        <td className="ops-table__num ops-num">{money(m.sales)}</td>
                                        <td className="ops-table__num ops-num">{money(m.totalSales)}</td>
                                        <td className="ops-table__num ops-num" style={{ color: num(m.acos) > 40 ? '#d92d20' : undefined }}>{fmtPct(m.acos)}</td>
                                        <td className="ops-table__num ops-num">{fmtPct(m.tacos)}</td>
                                        <td className="ops-table__num ops-num">{int(m.orders)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </>
                )}
            </Panel>

            <Panel
                span={12}
                kicker="Per-seller attainment"
                meta={`${sellers.length} seller${sellers.length === 1 ? '' : 's'} in scope`}
            >
                {sellers.length === 0 ? (
                    <MiniState tone="empty" title="No seller mix" note="No ads rows for this window." />
                ) : (
                    <table className="ops-table">
                        <thead>
                            <tr>
                                <th>Seller</th>
                                <th className="ops-table__num">Spend</th>
                                <th className="ops-table__num">ADS target</th>
                                <th className="ops-table__num">Attainment</th>
                                <th className="ops-table__num">Ad sales</th>
                                <th className="ops-table__num">Total sales</th>
                                <th className="ops-table__num">ACoS</th>
                                <th className="ops-table__num">ACoS target</th>
                                <th className="ops-table__num">Share</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sellers.map((s) => (
                                <tr key={s.sellerId || s.name}>
                                    <td>
                                        <span className="ops-item__title">{s.name}</span>
                                        {s.marketplace ? <span className="ops-muted"> · {s.marketplace}</span> : null}
                                    </td>
                                    <td className="ops-table__num ops-num">{money(s.spend)}</td>
                                    <td className="ops-table__num ops-num">{s.adsTarget ? money(s.adsTarget) : '—'}</td>
                                    <td className="ops-table__num">
                                        {has(s.attainmentPct) ? (
                                            <>
                                                <span className="ops-num">{fmtPct(s.attainmentPct, 0)}</span>
                                                <ShareBar pct={Math.min(s.attainmentPct, 100)} color={s.attainmentPct > 110 ? '#b54708' : '#067647'} />
                                            </>
                                        ) : '—'}
                                    </td>
                                    <td className="ops-table__num ops-num">{money(s.sales)}</td>
                                    <td className="ops-table__num ops-num">{money(s.totalSales)}</td>
                                    <td className="ops-table__num ops-num" style={{ color: s.onAcosTarget === false ? '#d92d20' : undefined }}>{fmtPct(s.acos)}</td>
                                    <td className="ops-table__num ops-num">
                                        {has(s.acosTarget) ? (
                                            <AntTooltip title={has(s.acosGapPoints) ? `${s.acosGapPoints > 0 ? '+' : '−'}${Math.abs(s.acosGapPoints).toFixed(1)} pts vs target` : undefined}>
                                                <span>{fmtPct(s.acosTarget)}</span>
                                            </AntTooltip>
                                        ) : '—'}
                                    </td>
                                    <td className="ops-table__num ops-num">{fmtPct(s.share)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </Panel>
        </>
    );
};
