import React, { useMemo, useState } from 'react';
import {
    Panel, Tile, MiniState, Chip, SegmentedBar, Segmented, Delta, ShareBar, Tip, useNow,
    fmtINR, fmtINRFull, fmtNum, fmtNumFull, fmtPct, pctDelta, pointDelta, timeAgo,
    OPS_COLOR, TASK_STATUS_COLORS, PIPELINE_COLORS, PRIORITY_CHIP,
} from './primitives';
import { Sparkline, Ring } from './charts';
import { AreaTrendChart } from './AreaTrendChart';

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
    returns: { label: 'ROAS', unit: 'x' },
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
    roas: { mode: 'returns', series: 'roas' },
    cvr:{mode:'efficiency',series:'cvr'},
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
            { key: 'gms', name: 'GMS', color: OPS_COLOR.accent, data: gms,summaryValue:dashboardRaw?.gms?.revenue },
            { key: 'adSales', name: 'Ad sales', color: OPS_COLOR.pos, data: adSales,summaryValue:dashboardRaw?.ads?.adSales },
            { key: 'organic', name: 'Organic sales', color: OPS_COLOR.violet, data: organic,summaryValue:dashboardRaw?.ads?.organicSales,dashed: true },
            { key: 'adSpend', name: 'Ad spend', color: OPS_COLOR.warn, data: adSpend,summaryValue:dashboardRaw?.ads?.adSpend },
        ].filter((s) => s.data.length > 0),
        volume: [
            { key: 'gmsUnits', name: 'Units (GMS)', color: OPS_COLOR.accent, data: gmsUnits,summaryValue:dashboardRaw?.gms?.units },
            { key: 'adOrders', name: 'Ad orders', color: OPS_COLOR.pos, data: dashboardRaw?.ordersSeries || [],summaryValue:dashboardRaw?.ads?.orders },
        ].filter((s) => s.data.length > 0),
        efficiency: [
            { key: 'acos', name: 'ACoS', color: OPS_COLOR.warn, data: dashboardRaw?.acosSeries || [],summaryValue:dashboardRaw?.ads?.acos },
            { key: 'tacos', name: 'TACoS', color: OPS_COLOR.accent, data: tacos,summaryValue:dashboardRaw?.ads?.tacos },
            { key: 'ctr', name: 'CTR', color: OPS_COLOR.violet, data: dashboardRaw?.ctrSeries || [],summaryValue:dashboardRaw?.ads?.ctr },
            { key: 'cvr', name: 'CVR', color: OPS_COLOR.pos, data: dashboardRaw?.cvrSeries || [],summaryValue:dashboardRaw?.ads?.cvr },
        ].filter((s) => s.data.length > 0),
        returns:[{key:'roas',name:'ROAS',color:OPS_COLOR.pos,data:dashboardRaw?.roasSeries||[],summaryValue:dashboardRaw?.ads?.roas}].filter(s=>s.data.length>0),
    };
};

// ── KPI strip ─────────────────────────────────────────────────────────

export const KpiRow = ({ dashboardRaw, focus, onFocus, span = 2 }) => {
    const adsPerf = dashboardRaw?.adsPerformanceSeries || [];
    const adsBlock = dashboardRaw?.ads;
    const gms = dashboardRaw?.gms;
    const days = dashboardRaw?.period?.days;
    const vs = days ? `vs prev ${days}d` : 'vs prev period';

    const numeric=v=>v==null?null:Number(v);
    const adSales=numeric(adsBlock?.adSales),adSpend=numeric(adsBlock?.adSpend),adOrders=numeric(adsBlock?.orders);
    const acos=numeric(adsBlock?.acos),roas=numeric(adsBlock?.roas);
    const dailySpend=days>0&&adSpend!=null?adSpend/days:null;
    const show=(v,fmt)=>v==null?'N/A':fmt(v);
    const metricDelta=key=>adsBlock?.comparison?.metrics?.[key]??null;
    const ratioDelta=key=>adsBlock?.comparison?.ratios?.[key]??null;
    const hasGms = !!gms;
    const gmsRevenue=numeric(gms?.revenue);
    const gmsUnits=numeric(gms?.units);
    const tacos=numeric(adsBlock?.tacos),adShare=numeric(adsBlock?.adShare);

    const tiles = [
        {
            key: 'gms', label: 'GMS', tip: 'Gross merchandise sales — ordered revenue from the GMS daily feed (not ads data).',
            value: show(gmsRevenue,fmtINR),
            sub: gmsRevenue==null?'GMS unavailable':gms.coverage?.complete===false?`Observed ${gms.coverage.observedDays} of ${gms.coverage.expectedDays} days`:`${fmtINR(gms.dailyAverage)} / day · ${fmtNum(gms.asinsWithSales)} ASINs selling`,
            delta: hasGms ? <Delta value={gms.deltaPct} label={vs} compact /> : null,
            spark: <Sparkline data={gms?.series || []} color={OPS_COLOR.accent} />,
        },
        {
            key: 'units', label: 'Units', tip: 'Ordered units from the GMS daily feed.',
            value: show(gmsUnits,fmtNum),
            sub: hasGms && gmsUnits > 0 ? `ASP ${fmtINRFull(gms.asp)} · returns ${fmtPct(gms.returnRate)}` : 'ordered units',
            delta: hasGms ? <Delta value={gms.unitsDeltaPct} label={vs} compact /> : null,
            spark: <Sparkline data={gms?.unitsSeries || []} color={OPS_COLOR.accent} />,
        },
        {
            key: 'adSales', label: 'Ad sales', tip: 'Observed ad-attributed sales in INR from canonical facts.',
            value: show(adSales,fmtINR),
            sub: adShare !== null ? `${fmtPct(adShare)} of reported total sales · ${show(adOrders,fmtNum)} ad orders` : `${show(adOrders,fmtNum)} ad orders`,
            delta: <Delta value={metricDelta('AdSales',adSales,prev?.adSales)} label={vs} compact />,
            spark: <Sparkline data={adsPerf[0]?.data || []} color={OPS_COLOR.pos} />,
        },
        {
            key: 'adSpend', label: 'Ad spend', tip: 'Observed advertising spend in INR. Missing observations are unknown.',
            value: show(adSpend,fmtINR),
            sub: tacos !== null ? `TACoS ${fmtPct(tacos)} · ${show(dailySpend,fmtINR)} / day` : `${show(dailySpend,fmtINR)} / day`,
            delta: <Delta value={metricDelta('AdSpend',adSpend,prev?.adSpend)} label={vs} compact neutral />,
            spark: <Sparkline data={adsPerf[1]?.data || []} color={OPS_COLOR.warn} />,
        },
        {
            key: 'acos', label: 'ACoS', tip: 'Ad spend ÷ ad sales. Lower is better; change shown in percentage points.',
            value: show(acos,fmtPct),
            sub: 'spend ÷ ad sales · lower is better',
            delta: <Delta value={ratioDelta('acos',acos,prev?.acos,pointDelta)} label={vs} compact invert points />,
            spark: <Sparkline data={dashboardRaw?.acosSeries || []} color={OPS_COLOR.warn} />,
        },
        {
            key: 'roas', label: 'ROAS', tip: 'Ad-attributed sales divided by spend. Trend uses the same ratio, not reciprocal ACoS.',
            value: roas==null?'N/A':roas.toFixed(2), unit: roas==null?'':'×',
            sub: 'ad sales ÷ spend',
            delta: <Delta value={ratioDelta('roas',roas,prev?.roas,pctDelta)} label={vs} compact />,
            spark: <Sparkline data={dashboardRaw?.roasSeries||[]} color={OPS_COLOR.pos} />,
        },
    ];

    // Keep the original six tiles and provide a separately focusable TACoS KPI.
    tiles.push({
        key:'tacos',label:'TACoS',tip:'Canonical ad spend divided by reported total sales, not GMS. Missing paired observations are unknown.',
        value:show(tacos,fmtPct),sub:adsBlock?.comparison?.coverage?.comparable?'Comparable reporting windows':'Review reported coverage',
        delta:<Delta value={ratioDelta('tacos')} label={vs} compact invert points/>,
        spark:<Sparkline data={gms?.tacosSeries||[]} color={OPS_COLOR.accent}/>,
    });
    tiles.push({key:'cvr',label:'CVR',tip:'Ad conversions divided by clicks. Distinct from orders.',value:show(adsBlock?.cvr,fmtPct),sub:'conversions ÷ clicks',delta:<Delta value={ratioDelta('cvr')} label={vs} compact points/>,spark:<Sparkline data={dashboardRaw?.cvrSeries||[]} color={OPS_COLOR.pos}/>});
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
    const hasAny = series.some(s=>s.data.some(v=>v!=null&&Number.isFinite(Number(v))));

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
            {status==='loading'?<MiniState title="Loading trend" />:status === 'error' ? (
                <MiniState tone="error" title="Trend unavailable" note="Revenue history could not be loaded." onRetry={onRetry} />
            ) : !ready ? (
                <MiniState tone="empty" title="No trend data" note="No series available for this selection and period." />
            ) : !hasAny ? (
                <MiniState tone="empty" title={`No ${CHART_MODES[mode].label.toLowerCase()} recorded`} note="No observed values are available for the selected series and period." />
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
    const canSelect = (r) => r.sellerId!=null && typeof onSelectSeller === 'function' && (!selectable || selectable.has(String(r.sellerId)));

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
            {status==='loading'?<MiniState title="Loading report" />:status === 'error' ? (
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
            {status==='loading'?<MiniState title="Loading report" />:status === 'error' ? (
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

const GOAL_LABELS={GMS:'GMS revenue',ADS:'Ad spend cap',ACOS:'ACoS ceiling'};
const TARGET_STATES={met:'Met',below_target:'Below target',in_progress:'In progress',over_limit:'Over limit',within_limit:'Within limit',unknown:'Insufficient coverage',not_started:'Not started'};
export const AchievementPanel=({targets=[],status,onRetry})=>{
    const [selected,setSelected]=useState('all');
    const rows=targets.filter(t=>selected==='all'||t.GoalType===selected);
    const counts=rows.reduce((a,t)=>({...a,[t.status]:(a[t.status]||0)+1}),{});
    return <Panel id="ops-goals" span={8} kicker="Target performance" meta="Separate full-period goals; actuals through today. No overlapping-target sums.">
        {status==='loading'?<MiniState title="Loading targets"/>:status==='error'?<MiniState tone="error" title="Target analytics unavailable" onRetry={onRetry}/>:targets.length===0?<MiniState tone="empty" title="No targets in view"/>:<>
            <Segmented ariaLabel="Target goal type" value={selected} onChange={setSelected} options={[{value:'all',label:'All'},...Object.keys(GOAL_LABELS).map(k=>({value:k,label:k}))]}/>
            <div style={{display:'flex',flexWrap:'wrap',gap:8,margin:'10px 0'}}>{Object.entries(counts).map(([k,n])=><span key={k} className="ops-chip">{TARGET_STATES[k]||k}: {n}</span>)}</div>
            <div className="ops-goal__targets" style={{maxHeight:340,overflow:'auto'}}>
            {rows.map(t=>{
                const fmt=t.GoalType==='ACOS'?fmtPct:fmtINR;
                const actual=t.overallAchieved;
                const tone=['below_target','over_limit'].includes(t.status)?OPS_COLOR.neg:['met','within_limit'].includes(t.status)?OPS_COLOR.pos:OPS_COLOR.slate;
                return <div key={t.Id} style={{padding:'10px 4px',borderBottom:'1px solid #eef1f5'}}>
                    <div style={{display:'flex',justifyContent:'space-between',gap:10}}><strong>{t.SellerName||t.SellerId} · {GOAL_LABELS[t.GoalType]||t.GoalType}</strong><span style={{color:tone}}>{TARGET_STATES[t.status]||'Unknown'}</span></div>
                    <div className="ops-muted">{t.period?.start} to {t.period?.end} · {t.coverage?.coveredDays??0}/{t.coverage?.expectedDays??0} elapsed days observed</div>
                    <div style={{display:'flex',justifyContent:'space-between',gap:10,marginTop:5}}><span>{fmt(actual)} / {fmt(t.TotalTargetValue)}</span>{t.progress!=null&&<span className="ops-num">{fmtPct(t.progress,1)} {t.GoalType==='ADS'?'used':'achieved'}</span>}</div>
                    {actual==null&&t.observedActual!=null&&<div className="ops-muted">Observed only: {fmt(t.observedActual)}. Incomplete data is not a decision-ready actual.</div>}
                    {t.progress!=null&&<ShareBar pct={Math.min(100,t.progress)} color={tone}/>}
                </div>
            })}
            {rows.length===0&&<MiniState tone="empty" title="No targets of this type"/>}
            </div>
        </>}
    </Panel>;
};

export const PortfolioPanel=({portfolio:p,status,onRetry})=><Panel id="ops-portfolio" span={12} kicker="GMS portfolio concentration" meta="Full scoped population, not only the top 200 rows">
    {status==='loading'?<MiniState title="Loading portfolio"/>:status==='error'?<MiniState tone="error" title="Portfolio unavailable" onRetry={onRetry}/>:!p||p.positiveProducts===0?<MiniState tone="empty" title="No mapped positive product revenue"/>:<>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:16,padding:'8px 0'}}>
            <div><div className="ops-muted">Revenue-driving products</div><strong className="ops-num">{fmtNum(p.headProducts)} / {fmtNum(p.positiveProducts)}</strong><div>{fmtPct(p.headProductShare)} of positive sellers' ASINs</div></div>
            <div><div className="ops-muted">Revenue share</div><strong className="ops-num">{fmtPct(p.headRevenueShare)}</strong><div>{fmtINR(p.headRevenue)} of {fmtINR(p.positiveRevenue)}</div></div>
            <div><div className="ops-muted">Remaining positive products</div><strong className="ops-num">{fmtNum(p.tailProducts)}</strong><div>{fmtINR(p.tailRevenue)}</div></div>
            <div><div className="ops-muted">Top three product share</div><strong className="ops-num">{fmtPct(p.top3RevenueShare)}</strong><div>{fmtINR(p.top3Revenue)}</div></div>
        </div>
        <SegmentedBar total={p.positiveRevenue} segments={[{label:'Products reaching at least 80% of positive revenue',value:p.headRevenue,color:OPS_COLOR.accent},{label:'Remaining positive revenue',value:p.tailRevenue,color:OPS_COLOR.slate}]}/>
        <div className="ops-muted" style={{marginTop:8}}>Observed {p.observedDays}/{p.expectedDays} days. {p.unknownProducts} unknown, {p.unmatchedProducts} unmatched, {p.zeroProducts} zero and {p.negativeProducts} negative revenue groups excluded from this denominator. {p.status==='observed_partial'?'Partial observed portfolio; do not treat as complete coverage.':''}</div>
    </>}
</Panel>;

// ── ASIN health ───────────────────────────────────────────────────────

export const AsinHealthPanel = ({ stats, gms }) => {
    const total = Number(stats?.totalAsins) || 0;
    const active = Number(stats?.activeAsins) || 0;
    const oos = Number(stats?.outOfStockAsins) || 0;
    const fresh = Number(stats?.newThisMonthAsins) || 0;
    const selling = Number(gms?.asinsWithSales) || 0;
    const segments = [
        { label: 'Active, not flagged OOS', value: Math.max(0,active-oos), color: OPS_COLOR.pos },
        { label: 'Out of stock', value: oos, color: OPS_COLOR.neg },
        { label: 'Other', value: Math.max(0, total - active), color: '#c7d0dc' },
    ];
    return (
        <Panel id="ops-catalog" span={4} kicker="Catalog health" meta={`${fmtNum(total)} catalog rows · live snapshot`}>
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
                            {gms ? fmtNum(selling) : '—'}
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

export const TasksPanel = ({ tasks = [], summary, error, loading, onRetry }) => {
    const [filter, setFilter] = useState(null);
    const now = useNow();
    const counts=summary?.counts||{};
    const segments = Object.keys(TASK_STATUS_COLORS)
        .filter((s) => counts[s] > 0)
        .map((s) => ({ key: s, label: s.replace('_', ' '), value: counts[s], color: TASK_STATUS_COLORS[s] }));
    const overdue=summary?.overdue??0;

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
        <Panel id="ops-tasks" span={4} kicker="Task pipeline" meta={summary?`${summary.total} workspace instances · ${overdue} overdue · ${summary.slaBreached} SLA breached`:'Live workspace snapshot'} linkTo="/tasks/operations" linkLabel="Workspace">
            {loading?<MiniState title="Loading tasks" />:error ? (
                <MiniState tone="error" title="Tasks unavailable" note={String(error)} onRetry={onRetry} />
             ) : !summary||summary.total===0 ? (
                <MiniState tone="empty" title="No active tasks" note="Nothing in the task workspace for this selection." />
            ) : (
                <>
                    <SegmentedBar segments={segments} onSelect={setFilter} selected={filter} />
                    <div className="ops-muted" style={{marginTop:6,fontSize:11}}>Showing up to 5 priority instances from the selected status; totals cover the complete scoped population.</div>
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

export const AlertsPanel = ({ alerts = [], status, onRetry, canOpen=true }) => {
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
        <Panel id="ops-alerts" span={4} kicker="Alerts" meta={`${counts.critical} critical · ${counts.warning} warnings`} linkTo={canOpen?'/alerts':null} linkLabel={canOpen?'All alerts':undefined}>
            {status==='loading'?<MiniState title="Loading alerts" />:status === 'error' ? (
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
            {status==='loading'?<MiniState title="Loading pipeline" />:status === 'error' ? (
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
