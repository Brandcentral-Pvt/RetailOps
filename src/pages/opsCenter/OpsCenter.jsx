import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Select, Button } from 'antd';
import { usePageTitle } from '../../contexts/PageTitleContext';
import { useDateRange } from '../../contexts/DateRangeContext';
import { useDashboardData } from '../../hooks/useDashboardData';
import { marketSyncApi } from '../../services/api';
import { Panel, MiniState, SkeletonPage, fmtNum, timeAgo } from './primitives';
import {
    KpiRow, TrendPanel, MixPanel, AchievementPanel, AsinHealthPanel,
    TasksPanel, AlertsPanel, PipelinePanel, TopAsinsPanel, ActivityPanel,
} from './panels';
import './ops.css';

/**
 * OpsCenter — the Operations Command Center, redesigned from scratch.
 *
 * Corporate, data-driven layout: flat panels on a 12-column grid, uppercase
 * micro-labels, tabular numerals, dependency-free SVG charts. Built entirely
 * on the hardened data layer (useDashboardData): one task source (PEMS
 * workspace), goal-type-separated achievement math, filter-consistent
 * targets, explicit per-section error/empty states — no misleading zeros.
 *
 * No component from the legacy dashboard (src/components/dashboard/*) is
 * imported here.
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

const OpsCenter = () => {
    const { setPageTitle } = usePageTitle();
    const { startDate, endDate } = useDateRange();

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
        optimizationTasks, orch,
        loading, isHydrated, refresh, matchesManagerFilter,
        tasksError, sectionStatus,
    } = useDashboardData(dashboardFilters);

    // ── Sync (real ingestion, not just a reload) ────────────────────────
    const [syncing, setSyncing] = useState(false);
    const handleSync = useCallback(async () => {
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
    }, [syncing, refresh]);

    // ── "Updated X ago" ticker ──────────────────────────────────────────
    const [, setTick] = useState(0);
    const tickRef = useRef();
    useEffect(() => {
        tickRef.current = setInterval(() => setTick((t) => t + 1), 30000);
        return () => clearInterval(tickRef.current);
    }, []);

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

    if (loading && !isHydrated) return <SkeletonPage />;

    const conn = CONNECTION_LABEL[orch.connectionStatus] || CONNECTION_LABEL.offline;
    const stats = orch.dashboardRaw?.stats || {};
    const kpisErrored = sectionStatus?.kpis === 'error';

    return (
        <div className="ops">
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
                            Updated {timeAgo(orch.syncTimestamp || new Date())}
                            {' · '}
                            {fmtNum(stats.totalSellers)} sellers · {fmtNum(stats.totalAsins)} ASINs
                        </span>
                    </div>
                </div>
                <div className="ops-head__controls">
                    <Select
                        size="small"
                        className="ops-select"
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
                    <Button size="small" type="primary" loading={syncing} onClick={handleSync}>
                        Sync
                    </Button>
                </div>
            </div>

            {/* ── Section failure banner ────────────────────────────── */}
            {orchErrors.length > 0 && (
                <div className="ops-banner" role="alert">
                    <span className="ops-banner__text">
                        <strong>{orchErrors.length} section{orchErrors.length === 1 ? '' : 's'} failed to load.</strong>
                        {' '}
                        {orchErrors.map(([section]) => section).join(', ')} — figures for those sections are hidden, not zeroed.
                    </span>
                    <button type="button" className="ops-retry" onClick={refresh}>Retry all</button>
                </div>
            )}

            {/* ── Grid ──────────────────────────────────────────────── */}
            <div className="ops-grid">
                {kpisErrored ? (
                    <Panel span={12} kicker="Key metrics">
                        <MiniState
                            tone="error"
                            title="KPI metrics unavailable"
                            note="Ad sales, spend, orders, units, ACoS and ROAS could not be loaded."
                            onRetry={refresh}
                        />
                    </Panel>
                ) : (
                    <KpiRow dashboardRaw={orch.dashboardRaw} />
                )}

                <TrendPanel dashboardRaw={orch.dashboardRaw} status={sectionStatus?.revenueSeries} onRetry={refresh} />
                <MixPanel dashboardRaw={orch.dashboardRaw} status={sectionStatus?.categories} onRetry={refresh} />

                <AchievementPanel targets={visibleTargets} status={sectionStatus?.targets} onRetry={refresh} />
                <AsinHealthPanel stats={stats} />

                <TasksPanel tasks={optimizationTasks} error={tasksError} onRetry={refresh} />
                <AlertsPanel alerts={orch.alerts || []} status={sectionStatus?.alerts} onRetry={refresh} />
                <PipelinePanel tasks={scrapeTasks} onRetry={refresh} />

                <TopAsinsPanel products={orch.topProducts || []} status={sectionStatus?.topProducts} onRetry={refresh} />
                <ActivityPanel logs={activityLogs} />
            </div>
        </div>
    );
};

export default OpsCenter;
