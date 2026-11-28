import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Select, Button } from 'antd';
import { usePageTitle } from '../../contexts/PageTitleContext';
import { useDateRange } from '../../contexts/DateRangeContext';
import { useAuth } from '../../contexts/AuthContext';
import { dashboardPrincipal,canDashboardPermission } from '../../utils/dashboardScope.mjs';
import { useDashboardData } from '../../hooks/useDashboardData';
import { marketSyncApi } from '../../services/api';
import { Panel, MiniState, fmtNum, timeAgo, useNow } from './primitives';
import {
    KpiRow, TrendPanel, MixPanel, AchievementPanel, AsinHealthPanel,
    TasksPanel, AlertsPanel, PipelinePanel, ActivityPanel,
    BrandLeaderboardPanel, InsightsPanel, PortfolioPanel, FOCUS_MAP,
} from './panels';
import { TopProductsPanel } from './topProducts';
import { buildInsights } from './insights';
import './ops.css';

/**
 * OpsCenter — the Operations Command Center.
 *
 * Corporate, data-driven layout: flat panels on a 12-column grid, uppercase
 * micro-labels, tabular numerals, dependency-free SVG charts. Built on the
 * hardened data layer (useDashboardData): one task source (task workspace),
 * goal-type-separated achievement math, filter-consistent targets, explicit
 * per-section error/empty states — no misleading zeros.
 *
 * GMS-first: the revenue KPIs, the trend and the top-products table are
 * defined by the ASIN's ordered revenue (GMS feed). Advertising figures are
 * context (ad share, TACoS, ACoS), never the ranking basis.
 *
 * Interactions: KPI tiles focus the trend chart; the chart has hover
 * tooltips and legend toggles; brands filter the whole page; product rows
 * drill down; status legends filter their lists; insights jump to panels.
 */

const sellerMatches = (t, sellerId) => {
    if (!sellerId || sellerId === 'all') return true;
    const ids = String(sellerId).split(',').map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) return true;
    return ids.includes(String(t?.SellerId ?? ''));
};

const CONNECTION_LABEL = {
    connected: { label: 'Live', cls: 'ops-pill--live' },
    reconnecting: { label: 'Reconnecting', cls: 'ops-pill--reconnecting' },
    offline: { label: 'Offline', cls: 'ops-pill--offline' },
};

const fmtRange = (start, end) => {
    if (!start || !end) return '';
    const o = { day: '2-digit', month: 'short' };
    return `${new Date(start).toLocaleDateString('en-IN', o)} – ${new Date(end).toLocaleDateString('en-IN', o)}`;
};

const ScopedOpsCenter = () => {
    const { setPageTitle } = usePageTitle();
    const { startDate, endDate } = useDateRange();
    const {user}=useAuth();
    const hasPermission=useCallback(permission=>canDashboardPermission(user,permission),[user]);

    useEffect(() => {
        setPageTitle('Operations Command Center');
    }, [setPageTitle]);

    const [filters, setFilters] = useState({
        sellerId: 'all',
        managerId: 'all',
        goalType: 'all',
    });

    // ✅ The global date range lives in the app header (DateRangeContext) —
    // derived here instead of mirrored into state, so no sync effect needed.
    const dashboardFilters = useMemo(() => ({
        ...filters,
        dateRange: { start: startDate, end: endDate },
    }), [filters, startDate, endDate]);

    const {
        userSellers, managers, activityLogs, scrapeTasks,
        optimizationTasks, topProducts, orch,
        refresh, matchesManagerFilter,
        canTasks,canPipeline,canLogs,optionsError,pipelineStatus,activityStatus,tasksLoading,taskSummary,
        tasksError, sectionStatus,
    } = useDashboardData(dashboardFilters);

    // ── KPI tile ⇄ trend chart focus ────────────────────────────────────
    const [focus, setFocus] = useState('gms');
    const [chartMode, setChartMode] = useState('revenue');
    const handleFocus = useCallback((key) => {
        setFocus(key);
        const map = FOCUS_MAP[key];
        if (map) setChartMode(map.mode);
    }, []);
    const handleMode = useCallback((mode) => {
        setChartMode(mode);
        // Keep the focused tile consistent with the visible mode.
        setFocus((f) => (FOCUS_MAP[f]?.mode === mode ? f : null));
    }, []);
    const focusSeries = FOCUS_MAP[focus]?.mode === chartMode ? FOCUS_MAP[focus].series : null;
    const handleFocusSeries = useCallback((seriesKey) => {
        const entry = Object.entries(FOCUS_MAP).find(([, v]) => v.series === seriesKey && v.mode === chartMode);
        if (entry) setFocus(entry[0]);
    }, [chartMode]);

    // ── Sync (real ingestion, not just a reload) ────────────────────────
    const [syncing, setSyncing] = useState(false);
    const handleSync = useCallback(async () => {
        if(!hasPermission('scraping_manage')||!orch.scope?.unrestricted)return;
        if (syncing) return;
        setSyncing(true);
        try {
            try {
                await marketSyncApi.ingestAllResults();
            } catch {
                await marketSyncApi.syncAll().catch(() => {});
            }
        } catch { /* non-fatal — still refresh what we have */ }
        try {
            await refresh();
        } finally {
            setSyncing(false);
        }
    }, [syncing, refresh,hasPermission,orch.scope]);

    // ── "Updated X ago" ticker (also refreshes overdue/insight clocks) ──
    const now = useNow(30000);

    // ── Derived selections ──────────────────────────────────────────────
    const visibleTargets = useMemo(() => {
        const list = orch.targets || [];
        let filtered = list;
        if (filters.sellerId !== 'all') filtered = filtered.filter((t) => sellerMatches(t, filters.sellerId));
        if (filters.managerId !== 'all') filtered = filtered.filter((t) => matchesManagerFilter(t, filters.managerId));
        if (filters.goalType !== 'all') {
            filtered = filtered.filter((t) => (t.GoalType || 'GMS').toUpperCase() === filters.goalType);
        }
        return filtered;
    }, [orch.targets, filters.sellerId, filters.managerId, filters.goalType, matchesManagerFilter]);

    const orchErrors = useMemo(
        () => Object.entries(orch.errors || {}).filter(([, v]) => !!v),
        [orch.errors]
    );

    const selectableSellers = useMemo(() => new Set(userSellers.map((s) => String(s.id))), [userSellers]);

    const insights = useMemo(() => buildInsights({
        dashboardRaw: orch.dashboardRaw,
        products: topProducts || [],
        portfolio:orch.portfolio,taskSummary,
        targets: visibleTargets,
        tasks: optimizationTasks || [],
        pipeline: scrapeTasks || [],
        now,
    }), [orch.dashboardRaw, orch.portfolio,taskSummary, topProducts, visibleTargets, optimizationTasks, scrapeTasks, now]);

    const jumpTo = useCallback((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ops-panel--flash');
        setTimeout(() => el.classList.remove('ops-panel--flash'), 1400);
    }, []);

    const links = useMemo(() => ({
        gmsTracker: hasPermission('gms_tracker_view') ? '/gms-tracker' : null,
        skuReport: hasPermission('skureport_view') ? '/sku-report' : null,
    }), [hasPermission]);


    const conn = CONNECTION_LABEL[orch.connectionStatus] || CONNECTION_LABEL.offline;
    const raw = orch.dashboardRaw;
    const stats = raw?.stats || {};
    const period = raw?.period;
    const kpisErrored = sectionStatus?.kpis === 'error';
    const kpisLoading=sectionStatus?.kpis==='loading';
    const activeSeller = filters.sellerId !== 'all' ? userSellers.find((s) => String(s.id) === String(filters.sellerId)) : null;

    return (
        <div className="ops">
            {optionsError&&<div role="alert">Seller and manager options unavailable. <button onClick={refresh}>Retry</button></div>}
            {orch.scope?.empty&&<div role="status">No authorized sellers match the selected filters.</div>}
            {/* ── Page head ─────────────────────────────────────────── */}
            <div className="ops-head">
                <div>
                    <div className="ops-head__title">Operations Command Center</div>
                    <div className="ops-head__sub">
                        <span className={`ops-pill ${conn.cls}`}>
                            <span className="ops-pill__dot" />
                            {conn.label}
                        </span>
                        <span>
                            {orch.syncTimestamp?`Updated ${timeAgo(orch.syncTimestamp)}`:'Loading selected period'}
                            {' · '}
                            {fmtNum(stats.totalSellers)} sellers · {fmtNum(stats.totalAsins)} ASINs
                            {period ? (
                                <>
                                    {' · '}
                                    <span className="ops-num">{fmtRange(period.startDate, period.endDate)}</span>
                                    {' '}
                                    <span className="ops-muted">vs {fmtRange(period.prevStartDate, period.prevEndDate)}</span>
                                </>
                            ) : null}
                            {activeSeller ? (
                                <>
                                    {' · '}
                                    <button type="button" className="ops-filterchip" onClick={() => setFilters((f) => ({ ...f, sellerId: 'all' }))} title="Clear brand filter">
                                        {activeSeller.name} ×
                                    </button>
                                </>
                            ) : null}
                        </span>
                    </div>
                </div>
                <div className="ops-head__controls">
                    <Select
                        size="small"
                        className="ops-select"
                        showSearch
                        optionFilterProp="label"
                        value={filters.sellerId}
                        onChange={(v) => setFilters((f) => ({ ...f, sellerId: v }))}
                        options={[
                            { value: 'all', label: 'All brands' },
                            ...userSellers.map((s) => ({ value: s.id, label: s.name })),
                        ]}
                    />
                    <Select
                        size="small"
                        className="ops-select"
                        showSearch
                        optionFilterProp="label"
                        value={filters.managerId}
                        onChange={(v) => setFilters((f) => ({ ...f, managerId: v }))}
                        options={[
                            { value: 'all', label: 'All managers' },
                            ...managers.map((m) => ({ value: m.id, label: m.name })),
                        ]}
                    />
                    <Select
                        size="small"
                        className="ops-select"
                        style={{ minWidth: 110 }}
                        value={filters.goalType}
                        onChange={(v) => setFilters((f) => ({ ...f, goalType: v }))}
                        options={[
                            { value: 'all', label: 'All goals' },
                            { value: 'GMS', label: 'GMS' },
                            { value: 'ADS', label: 'ADS' },
                            { value: 'ACOS', label: 'ACoS' },
                        ]}
                    />
                    {hasPermission('scraping_manage')&&orch.scope?.unrestricted&&<Button size="small" type="primary" loading={syncing} onClick={handleSync}>
                        Sync
                    </Button>}
                </div>
            </div>

            {/* ── Section failure banner ────────────────────────────── */}
            {kpisLoading&&<div className="ops-banner" role="status">Loading financial data for the selected date range...</div>}
            {orchErrors.length > 0 && (
                <div className="ops-banner" role="alert">
                    <span className="ops-banner__text">
                        <strong>{orchErrors.length} section{orchErrors.length === 1 ? '' : 's'} failed to load.</strong>
                        {' '}
                        {orchErrors.map(([section,message]) => `${section}: ${message}`).join(' · ')} — figures for those sections are hidden, not zeroed.
                    </span>
                    <button type="button" className="ops-retry" onClick={refresh}>Retry all</button>
                </div>
            )}

            {/* ── Insights (rule-based, from the loaded data only) ──── */}
            {!kpisErrored && !kpisLoading && <InsightsPanel insights={insights} onJump={jumpTo} />}

            {/* ── Grid ──────────────────────────────────────────────── */}
            <div className="ops-grid">
                {kpisLoading?<Panel span={12} kicker="Key metrics"><MiniState title="Loading key metrics" note="Fetching the selected reporting period." /></Panel>:kpisErrored ? (
                    <Panel span={12} kicker="Key metrics">
                        <MiniState
                            tone="error"
                            title="KPI metrics unavailable"
                            note="GMS, units, ad sales, spend, ACoS and ROAS could not be loaded."
                            onRetry={refresh}
                        />
                    </Panel>
                ) : (
                    <KpiRow dashboardRaw={raw} focus={focus} onFocus={handleFocus} span={3} />
                )}

                <TrendPanel
                    dashboardRaw={raw}
                    status={sectionStatus?.revenueSeries}
                    onRetry={refresh}
                    mode={chartMode}
                    onMode={handleMode}
                    focusSeries={focusSeries}
                    onFocusSeries={handleFocusSeries}
                />
                <BrandLeaderboardPanel
                    rows={raw?.gmsBySeller || []}
                    status={sectionStatus?.kpis}
                    onRetry={refresh}
                    activeSellerId={filters.sellerId !== 'all' ? filters.sellerId : null}
                    onSelectSeller={(id) => setFilters((f) => ({ ...f, sellerId: id }))}
                    selectable={selectableSellers}
                    periodDays={period?.days}
                />

                <PortfolioPanel portfolio={orch.portfolio} status={sectionStatus?.topProducts} onRetry={refresh}/>
                <TopProductsPanel
                    products={topProducts || []}
                    status={sectionStatus?.topProducts}
                    onRetry={refresh}
                    labels={raw?.labels || []}
                    granularity={period?.granularity || 'day'}
                    periodDays={period?.days || 0}
                    periodTotal={orch.productsRevenue}
                    links={links}
                />

                {hasPermission('targets_view')&&<AchievementPanel targets={visibleTargets} status={sectionStatus?.targets} onRetry={refresh} />}
                <MixPanel dashboardRaw={raw} status={sectionStatus?.categories} onRetry={refresh} />

                {raw?<AsinHealthPanel stats={stats} gms={raw.gms}/>:null}
                {canTasks&&<TasksPanel tasks={optimizationTasks} summary={taskSummary} error={tasksError} loading={tasksLoading} onRetry={refresh} />}
                <AlertsPanel alerts={orch.alerts || []} status={sectionStatus?.alerts} onRetry={refresh} canOpen={hasPermission('activitylogs_view')} />

                {canPipeline&&<PipelinePanel tasks={scrapeTasks} status={pipelineStatus} onRetry={refresh} />}
                {canLogs&&(activityStatus==='loading'?<Panel kicker="Recent activity"><MiniState title="Loading activity" /></Panel>:activityStatus==='error'?<Panel kicker="Activity unavailable"><button onClick={refresh}>Retry</button></Panel>:<ActivityPanel logs={activityLogs} />)}
            </div>
        </div>
    );
};

export default function OpsCenter(){
    const {user}=useAuth();
    return <ScopedOpsCenter key={dashboardPrincipal(user)}/>;
}
