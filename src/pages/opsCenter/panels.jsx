import React from 'react';
import { Panel, Tile, MiniState, Chip, SegmentedBar, fmtINR, fmtNum, fmtPct, timeAgo, OPS_COLOR, TASK_STATUS_COLORS, PIPELINE_COLORS, PRIORITY_CHIP } from './primitives';
import { Sparkline, TrendChart, Ring } from './charts';

/**
 * OpsCenter panels — pure presentation over the data supplied by
 * useDashboardData (patch 1–3 data layer). Each panel renders an explicit
 * error or empty state; none of them fabricate values.
 */

// ── KPI strip ─────────────────────────────────────────────────────────

export const KpiRow = ({ dashboardRaw, span = 2 }) => {
    const adsPerf = dashboardRaw?.adsPerformanceSeries || [];
    const adSales = (adsPerf[0]?.data || []).reduce((a, b) => a + b, 0);
    const adSpend = (adsPerf[1]?.data || []).reduce((a, b) => a + b, 0);
    const ordersSeries = dashboardRaw?.ordersSeries || [];
    const unitsSeries = dashboardRaw?.unitsSeries || [];
    const acosSeries = dashboardRaw?.acosSeries || [];
    const orders = ordersSeries.reduce((a, b) => a + b, 0) || dashboardRaw?.kpi?.[0]?.trend || 0;
    const units = unitsSeries.reduce((a, b) => a + b, 0);
    const acos = adSales > 0 ? (adSpend / adSales) * 100 : 0;
    const roas = dashboardRaw?.roas || '0.00';
    const dailySpend = Number(dashboardRaw?.dailySpend || 0);

    const tiles = [
        { label: 'Ad Sales', value: fmtINR(adSales), sub: 'ad revenue in period', spark: <Sparkline data={adsPerf[0]?.data || []} color={OPS_COLOR.accent} /> },
        { label: 'Ad Spend', value: fmtINR(adSpend), sub: `${fmtINR(dailySpend)} / day`, spark: <Sparkline data={adsPerf[1]?.data || []} color={OPS_COLOR.slate} /> },
        { label: 'Orders', value: fmtNum(orders), sub: 'placed in period', spark: <Sparkline data={ordersSeries} color={OPS_COLOR.pos} /> },
        { label: 'Units', value: fmtNum(units), sub: 'units ordered', spark: <Sparkline data={unitsSeries} color={OPS_COLOR.pos} /> },
        { label: 'ACoS', value: fmtPct(acos), sub: 'spend ÷ ad sales', spark: <Sparkline data={acosSeries} color={OPS_COLOR.warn} /> },
        { label: 'ROAS', value: roas, unit: '×', sub: 'ad sales ÷ spend' },
    ];

    return tiles.map((t) => (
        <Tile key={t.label} span={span} label={t.label} value={t.value} unit={t.unit} sub={t.sub} spark={t.spark} />
    ));
};

// ── Revenue & spend trend ─────────────────────────────────────────────

export const TrendPanel = ({ dashboardRaw, status, onRetry }) => {
    const labels = dashboardRaw?.labels || [];
    const adsPerf = dashboardRaw?.adsPerformanceSeries || [];
    const ready = status !== 'error' && labels.length > 0 && adsPerf.length >= 2;

    return (
        <Panel
            span={8}
            kicker="Revenue vs ad spend"
            meta={`${labels.length} data points`}
        >
            {status === 'error' ? (
                <MiniState tone="error" title="Trend unavailable" note="Revenue history could not be loaded." onRetry={onRetry} />
            ) : !ready ? (
                <MiniState tone="empty" title="No trend data" note="No sales recorded for this selection and period." />
            ) : (
                <TrendChart
                    labels={labels}
                    series={[
                        { name: 'Total sales', color: OPS_COLOR.accent, data: adsPerf[0]?.data || [] },
                        { name: 'Ad spend', color: OPS_COLOR.warn, data: adsPerf[1]?.data || [] },
                    ]}
                />
            )}
        </Panel>
    );
};

// ── Marketplace mix ───────────────────────────────────────────────────

export const MixPanel = ({ dashboardRaw, status, onRetry }) => {
    const rows = (dashboardRaw?.category || [])
        .map((c) => ({ label: c.name, value: (c.data || [0])[0] || 0 }))
        .filter((r) => r.value > 0)
        .sort((a, b) => b.value - a.value);
    const total = rows.reduce((s, r) => s + r.value, 0);
    const palette = [OPS_COLOR.accent, '#6172f3', '#84caff', '#b2ddff', '#94a3b8'];

    return (
        <Panel span={4} kicker="Marketplace mix" meta={total > 0 ? `${fmtNum(total)} ASINs` : undefined}>
            {status === 'error' ? (
                <MiniState tone="error" title="Mix unavailable" note="Marketplace distribution could not be loaded." onRetry={onRetry} />
            ) : rows.length === 0 ? (
                <MiniState tone="empty" title="No ASINs" note="No catalog data for this selection." />
            ) : (
                <div style={{ paddingTop: 2 }}>
                    {rows.map((r, i) => (
                        <div className="ops-hbar" key={r.label}>
                            <div className="ops-hbar__top">
                                <b>{r.label}</b>
                                <span className="ops-num">{fmtNum(r.value)} · {((r.value / total) * 100).toFixed(0)}%</span>
                            </div>
                            <div className="ops-hbar__track">
                                <span className="ops-hbar__fill" style={{ width: `${(r.value / total) * 100}%`, background: palette[i % palette.length] }} />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Panel>
    );
};

// ── Goal achievement (GMS / ADS / ACoS separated) ─────────────────────

const GOAL_DISPLAY = [
    { type: 'GMS', name: 'GMS', color: OPS_COLOR.accent, note: 'Merchandise value vs target' },
    { type: 'ADS', name: 'Ad revenue', color: OPS_COLOR.pos, note: 'Ad sales vs target' },
    { type: 'ACOS', name: 'ACoS', color: OPS_COLOR.warn, note: 'Target ÷ actual — lower is better', lower: true },
];

export const AchievementPanel = ({ targets, status, onRetry }) => {
    const groups = GOAL_DISPLAY
        .map((g) => {
            const list = targets.filter((t) => (t.GoalType || 'GMS').toUpperCase() === g.type);
            const totalTarget = list.reduce((s, t) => s + (Number(t.TotalTargetValue) || 0), 0);
            const totalAchieved = list.reduce((s, t) => s + (Number(t.overallAchieved) || 0), 0);
            const pct = g.lower
                ? (totalAchieved > 0 ? (totalTarget / totalAchieved) * 100 : 0)
                : (totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0);
            return { ...g, list, totalTarget, totalAchieved, pct };
        })
        .filter((g) => g.list.length > 0);

    return (
        <Panel span={8} kicker="Goal achievement" meta={`${targets.length} targets in view`}>
            {status === 'error' ? (
                <MiniState tone="error" title="Achievement unavailable" note="Targets could not be loaded." onRetry={onRetry} />
            ) : groups.length === 0 ? (
                <MiniState tone="empty" title="No targets in view" note="No targets match the current brand / manager selection." />
            ) : (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {groups.map((g) => (
                        <div className="ops-goal" key={g.type}>
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
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Panel>
    );
};

// ── ASIN health ───────────────────────────────────────────────────────

export const AsinHealthPanel = ({ stats }) => {
    const total = Number(stats?.totalAsins) || 0;
    const active = Number(stats?.activeAsins) || 0;
    const oos = Number(stats?.outOfStockAsins) || 0;
    const fresh = Number(stats?.newThisMonthAsins) || 0;
    const segments = [
        { label: 'Active', value: active, color: OPS_COLOR.pos },
        { label: 'Out of stock', value: oos, color: OPS_COLOR.neg },
        { label: 'Other', value: Math.max(0, total - active - oos), color: '#c7d0dc' },
    ];
    return (
        <Panel span={4} kicker="Catalog health" meta={`${fmtNum(total)} ASINs`}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2 }}>
                <SegmentedBar segments={segments} total={total} />
                <div style={{ marginTop: 10 }}>
                    <div className="ops-statrow">
                        <span className="ops-statrow__label">Active / scraping</span>
                        <span className="ops-statrow__value ops-num">{fmtNum(active)}</span>
                    </div>
                    <div className="ops-statrow">
                        <span className="ops-statrow__label">Out of stock</span>
                        <span className="ops-statrow__value ops-num" style={{ color: oos > 0 ? OPS_COLOR.neg : undefined }}>{fmtNum(oos)}</span>
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

// ── Tasks (PEMS workspace source) ─────────────────────────────────────

const TASK_ORDER = { IN_PROGRESS: 0, PENDING: 1, IN_REVIEW: 2, TODO: 3, COMPLETED: 4, CANCELLED: 5 };

export const TasksPanel = ({ tasks = [], error, onRetry }) => {
    const counts = {};
    tasks.forEach((t) => {
        const s = String(t.status || 'TODO').toUpperCase();
        counts[s] = (counts[s] || 0) + 1;
    });
    const segments = Object.keys(TASK_STATUS_COLORS)
        .filter((s) => counts[s] > 0)
        .map((s) => ({ label: s.replace('_', ' '), value: counts[s], color: TASK_STATUS_COLORS[s] }));

    const top = [...tasks]
        .sort((a, b) => {
            const sa = TASK_ORDER[String(a.status).toUpperCase()] ?? 9;
            const sb = TASK_ORDER[String(b.status).toUpperCase()] ?? 9;
            if (sa !== sb) return sa - sb;
            return new Date(a.dueDate || '2999-01-01') - new Date(b.dueDate || '2999-01-01');
        })
        .slice(0, 5);

    return (
        <Panel span={4} kicker="Task pipeline" meta={`${tasks.length} open workspace tasks`} linkTo="/pems/tasks" linkLabel="Workspace">
            {error ? (
                <MiniState tone="error" title="Tasks unavailable" note={String(error)} onRetry={onRetry} />
            ) : tasks.length === 0 ? (
                <MiniState tone="empty" title="No active tasks" note="Nothing in the task workspace for this selection." />
            ) : (
                <>
                    <SegmentedBar segments={segments} />
                    <div className="ops-list" style={{ marginTop: 8 }}>
                        {top.map((t) => (
                            <div className="ops-item" key={t.id}>
                                <span className="ops-item__dot" style={{ background: TASK_STATUS_COLORS[String(t.status).toUpperCase()] || OPS_COLOR.slate }} />
                                <div className="ops-item__body">
                                    <div className="ops-item__title">{t.title}</div>
                                    <div className="ops-item__sub">
                                        {t.sellerName ? `${t.sellerName} · ` : ''}{String(t.status).replace('_', ' ')}
                                        {t.dueDate ? ` · due ${timeAgo(t.dueDate)}` : ''}
                                    </div>
                                </div>
                                <Chip label={t.priority} palette={PRIORITY_CHIP} />
                            </div>
                        ))}
                    </div>
                </>
            )}
        </Panel>
    );
};

// ── Alerts ────────────────────────────────────────────────────────────

const SEVERITY_COLOR = { critical: OPS_COLOR.neg, error: OPS_COLOR.neg, warning: OPS_COLOR.warn, info: OPS_COLOR.accent };

export const AlertsPanel = ({ alerts = [], status, onRetry }) => {
    const sevOf = (a) => String(a.Severity || a.severity || a.type || 'info').toLowerCase();
    const critical = alerts.filter((a) => sevOf(a).includes('critical') || sevOf(a).includes('error')).length;
    const warn = alerts.filter((a) => sevOf(a).includes('warn')).length;
    const top = alerts.slice(0, 5);

    return (
        <Panel span={4} kicker="Alerts" meta={`${critical} critical · ${warn} warnings`} linkTo="/alerts" linkLabel="All alerts">
            {status === 'error' ? (
                <MiniState tone="error" title="Alerts unavailable" note="The alert feed could not be loaded." onRetry={onRetry} />
            ) : alerts.length === 0 ? (
                <MiniState tone="empty" title="No active alerts" note="Nothing needs attention for this selection." />
            ) : (
                <div className="ops-list">
                    {top.map((a) => {
                        const sev = sevOf(a);
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
            )}
        </Panel>
    );
};

// ── Sync pipeline ─────────────────────────────────────────────────────

export const PipelinePanel = ({ tasks = [], onRetry, status }) => {
    const count = (s) => tasks.filter((t) => String(t.status || '').toUpperCase() === s).length;
    const running = count('RUNNING');
    const completed = count('COMPLETED');
    const failed = count('FAILED');
    const idle = tasks.length - running - completed - failed;
    const segments = [
        { label: 'Running', value: running, color: PIPELINE_COLORS.running },
        { label: 'Completed', value: completed, color: PIPELINE_COLORS.completed },
        { label: 'Failed', value: failed, color: PIPELINE_COLORS.failed },
        { label: 'Idle', value: Math.max(0, idle), color: PIPELINE_COLORS.idle },
    ];
    const top = tasks.slice(0, 4);

    return (
        <Panel span={4} kicker="Sync pipeline" meta={`${tasks.length} tracked runs`}>
            {status === 'error' ? (
                <MiniState tone="error" title="Pipeline unavailable" note="Sync status could not be loaded." onRetry={onRetry} />
            ) : tasks.length === 0 ? (
                <MiniState tone="empty" title="No sync activity" note="No marketplace sync runs recorded yet." />
            ) : (
                <>
                    <SegmentedBar segments={segments} />
                    <div className="ops-list" style={{ marginTop: 8 }}>
                        {top.map((t, i) => {
                            const s = String(t.status || 'IDLE').toUpperCase();
                            const color = s === 'RUNNING' ? PIPELINE_COLORS.running : s === 'COMPLETED' ? PIPELINE_COLORS.completed : s === 'FAILED' ? PIPELINE_COLORS.failed : PIPELINE_COLORS.idle;
                            return (
                                <div className="ops-item" key={t.id || t.taskId || i}>
                                    <span className="ops-item__dot" style={{ background: color }} />
                                    <div className="ops-item__body">
                                        <div className="ops-item__title">{t.sellerName || t.sellerId || 'Seller sync'}</div>
                                        <div className="ops-item__sub">{t.type ? String(t.type) : 'marketplace sync'}</div>
                                    </div>
                                    <span className="ops-item__time">{s}</span>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </Panel>
    );
};

// ── Top ASINs table ───────────────────────────────────────────────────

export const TopAsinsPanel = ({ products = [], status, onRetry }) => {
    const rows = products.slice(0, 8);
    return (
        <Panel span={8} kicker="Top products" meta="by units in period" linkTo="/asins-table" linkLabel="Full report">
            {status === 'error' ? (
                <MiniState tone="error" title="Top products unavailable" note="Product performance could not be loaded." onRetry={onRetry} />
            ) : rows.length === 0 ? (
                <MiniState tone="empty" title="No product sales" note="No ASIN recorded sales for this selection and period." />
            ) : (
                <table className="ops-table">
                    <thead>
                        <tr>
                            <th>ASIN / SKU</th>
                            <th>Title</th>
                            <th>Seller</th>
                            <th className="ops-table__num">Revenue</th>
                            <th className="ops-table__num">Units</th>
                            <th className="ops-table__num">ACoS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={r.asin || r.sku}>
                                <td className="ops-table__code ops-num">{r.asin || r.sku}</td>
                                <td className="ops-table__title-cell">{r.title}</td>
                                <td>{r.sellerName || r.seller || '—'}</td>
                                <td className="ops-table__num ops-num" style={{ fontWeight: 700 }}>{fmtINR(r.revenue)}</td>
                                <td className="ops-table__num ops-num">{fmtNum(r.units)}</td>
                                <td className="ops-table__num ops-num">
                                    <span style={{ color: parseFloat(r.acos) > 30 ? OPS_COLOR.neg : OPS_COLOR.pos }}>{r.acos}</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </Panel>
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
        <Panel span={4} kicker="Activity log" meta={`${logs.length} recent events`}>
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
