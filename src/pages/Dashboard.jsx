import { Spinner } from "@/components/Spinner";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Alert, Row, Col } from 'antd';
import { useNavigate } from 'react-router-dom';
import { usePageTitle } from '../contexts/PageTitleContext';
import { useDateRange } from '../contexts/DateRangeContext';
import { useSocket } from '../contexts/SocketContext';
import { useDashboardData } from '../hooks/useDashboardData';
import { useCommandPalette } from '../components/dashboard/CommandPalette';
import api, { marketSyncApi } from '../services/api';
import DashboardErrorBoundary from '../components/dashboard/DashboardErrorBoundary';
import SectionState from '../components/dashboard/SectionState';
import { computeBlendedAchievement } from '../utils/targetMetrics';
import '../components/dashboard/shared/glass.css';
import '../components/dashboard/dashboard-animations.css';

// Layer Components
import GlobalStatusBar from '../components/dashboard/GlobalStatusBar';
import CriticalActionCenter from '../components/dashboard/CriticalActionCenter';
import LiveOperations from '../components/dashboard/LiveOperations';
import NotificationsFeed from '../components/dashboard/NotificationsFeed';
import CommandPalette from '../components/dashboard/CommandPalette';
import MarketplaceIntelligence from '../components/dashboard/MarketplaceIntelligence';
import ActivityTimeline from '../components/dashboard/ActivityTimeline';

// Existing Components
import DashboardHeader from '../components/dashboard/DashboardHeader';
import KpiStrip from '../components/dashboard/KpiStrip';
import ModuleStatusGrid from '../components/dashboard/ModuleStatusGrid';
import SalesTrendChart from '../components/dashboard/SalesTrendChart';
import AchievementDonut from '../components/dashboard/AchievementDonut';
import TopAsinsCard from '../components/dashboard/TopAsinsCard';
import TasksOverviewCard from '../components/dashboard/TasksOverviewCard';
import AlertsPipelineCard from '../components/dashboard/AlertsPipelineCard';
import AutomationRulesCard from '../components/dashboard/AutomationRulesCard';

const containerVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { 
        opacity: 1, 
        y: 0,
        transition: { duration: 0.4, ease: 'easeOut', staggerChildren: 0.05 } 
    }
};

// ✅ Filter helper — seller filters may be comma-separated id lists
// (manager → seller resolution). String equality against the raw filter
// missed every list-valued filter. (Manager matching is handled by the
// matchesManagerFilter helper from useDashboardData.)
const sellerMatches = (t, sellerId) => {
    if (!sellerId || sellerId === 'all') return true;
    const ids = String(sellerId).split(',').map(s => s.trim()).filter(Boolean);
    if (ids.length === 0) return true;
    return ids.includes(String(t?.SellerId ?? ''));
};

const Dashboard = () => {
    const navigate = useNavigate();
    const { setPageTitle } = usePageTitle();
    const { startDate, endDate } = useDateRange();
    const { open: paletteOpen, setOpen: setPaletteOpen, CommandPalette: CmdPalette } = useCommandPalette();

    useEffect(() => {
        setPageTitle('Operations Command Center');
    }, [setPageTitle]);

    const [filters, setFilters] = useState({
        sellerId: 'all',
        managerId: 'all',
        goalType: 'all',
        dateRange: { start: startDate, end: endDate }
    });

    useEffect(() => {
        setFilters(prev => ({ ...prev, dateRange: { start: startDate, end: endDate } }));
    }, [startDate, endDate]);

    const {
        userSellers, managers, activityLogs, scrapeTasks,
        optimizationTasks, topProducts, orch, moduleStats,
        loading, isHydrated, refresh, matchesManagerFilter,
        tasksError, sectionStatus
    } = useDashboardData(filters);

    const [notifications, setNotifications] = useState([]);

    useEffect(() => {
        api.notificationApi.getNotifications({ page: 1, limit: 20 })
            .then(res => {
                // ✅ Envelope-tolerant unwrap: the notifications API returns
                // { success, data: [...] } — handle both wrapped and bare lists.
                const body = res?.data ?? res ?? {};
                const data = body?.data?.notifications ?? body?.notifications ?? body?.data ?? [];
                setNotifications(Array.isArray(data) ? data : []);
            })
            .catch(() => {});
    }, []);

    // ✅ Sync button now triggers a real data ingestion pipeline run
    // (previously it only re-fetched the dashboard, never pulling new data).
    const [syncing, setSyncing] = useState(false);

    // Live progress for the sync run, fed by the scrape socket. Additive only:
    // the KPI/donut/target pipeline below is unchanged.
    const [syncProgress, setSyncProgress] = useState({
        isRunning: false, count: 0, total: 0, status: 'idle'
    });

    const socket = useSocket();

    useEffect(() => {
        if (!socket) return;

        const handleBatchStart = (data) => {
            setSyncProgress({ isRunning: true, count: 0, total: data?.total || 0, status: 'starting' });
        };
        const handleBatchComplete = (data) => {
            setSyncProgress((prev) => ({
                ...prev,
                count: prev.count + (data?.count || 0),
                status: 'processing',
            }));
        };

        socket.on('scrape_batch_start', handleBatchStart);
        socket.on('scrape_batch_complete', handleBatchComplete);
        return () => {
            socket.off?.('scrape_batch_start', handleBatchStart);
            socket.off?.('scrape_batch_complete', handleBatchComplete);
        };
    }, [socket]);

    const handleSync = useCallback(async () => {
        if (syncing) return;
        setSyncing(true);
        setSyncProgress((prev) => ({ ...prev, isRunning: true, status: 'initiating' }));
        try {
            try {
                await marketSyncApi.ingestAllResults();
            } catch {
                await marketSyncApi.syncAll().catch(() => {});
            }
        } catch { /* ingestion failure is non-fatal — still refresh what we have */ }
        try {
            await refresh();
        } finally {
            setSyncing(false);
            setSyncProgress((prev) => ({ ...prev, isRunning: false, status: 'completed' }));
        }
    }, [syncing, refresh]);

    // ✅ Filter consistency: ONE seller/manager-filtered target list shared by
    // the KPI strip and the achievement donut — the donut previously computed
    // its tier mix from the UNFILTERED target list.
    const visibleTargets = useMemo(() => {
        const targetsList = orch.targets || [];
        let filtered = targetsList;
        if (filters.sellerId !== 'all') filtered = filtered.filter(t => sellerMatches(t, filters.sellerId));
        // Match manager by UserId OR BrandManager name (case-insensitive)
        if (filters.managerId !== 'all') filtered = filtered.filter(t => matchesManagerFilter(t, filters.managerId));
        return filtered;
    }, [orch.targets, filters.sellerId, filters.managerId, matchesManagerFilter]);

    const kpiValues = useMemo(() => {
        const adsPerf = orch.dashboardRaw?.adsPerformanceSeries || [];
        const adSales = (adsPerf[0]?.data || []).reduce((a, b) => a + b, 0);
        const adSpend = (adsPerf[1]?.data || []).reduce((a, b) => a + b, 0);
        const orders = orch.dashboardRaw?.kpi?.[0]?.trend || 0;
        const acos = adSales > 0 ? (adSpend / adSales) * 100 : 0;
        const unitsSeries = orch.dashboardRaw?.unitsSeries || [];
        // Units are the actual orders series from the backend (no estimator).
        const units = unitsSeries.reduce((a, b) => a + b, 0) || orders;

        let goalTargets = visibleTargets;
        if (filters.goalType !== 'all') goalTargets = goalTargets.filter(t => (t.GoalType || 'GMS').toUpperCase() === filters.goalType);

        // ✅ Goal separation: currency goals (GMS/ADS) blended by value;
        // ratio goals (ACoS) excluded from the blend (inverted math applied
        // per-target instead of polluting the revenue achievement rate).
        const blended = computeBlendedAchievement(goalTargets);

        return {
            adSales, adSpend, orders, acos, units,
            targetTotal: blended.totalTarget,
            targetAchieved: blended.totalAchieved,
            achievementRate: blended.rate,
        };
    }, [orch.dashboardRaw, visibleTargets, filters.goalType]);

    // ✅ Surface orchestration errors — previously failures were silent and
    // sections just showed skeletons forever.
    const orchErrors = useMemo(
        () => Object.entries(orch.errors || {}).filter(([, v]) => !!v),
        [orch.errors]
    );

    const sparklineData = useMemo(() => {
        const adsPerf = orch.dashboardRaw?.adsPerformanceSeries || [];
        return { adSales: adsPerf[0]?.data || [], orders: orch.dashboardRaw?.ordersSeries || [], acos: orch.dashboardRaw?.acosSeries || [], units: orch.dashboardRaw?.unitsSeries || [] };
    }, [orch.dashboardRaw]);

    const salesTrendLabels = useMemo(() => orch.dashboardRaw?.labels || [], [orch.dashboardRaw]);
    const salesTrendRevenue = useMemo(() => (orch.dashboardRaw?.adsPerformanceSeries || [])[0]?.data || [], [orch.dashboardRaw]);
    const salesTrendSpend = useMemo(() => (orch.dashboardRaw?.adsPerformanceSeries || [])[1]?.data || [], [orch.dashboardRaw]);

    const marketplaceCategory = useMemo(() => orch.dashboardRaw?.category || [], [orch.dashboardRaw]);

    if (loading && !isHydrated) return <Spinner tip="Loading your dashboard data..." minHeight={400} />;

    return (
        <>
            <CmdPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
            <motion.div variants={containerVariants} initial="hidden" animate="visible"
                className="dashboard-mesh"
                style={{ minHeight: '100%', padding: '0 24px' }}
            >
                {/* Layer 1: Header + Global Status Bar */}
                <DashboardHeader filters={filters} setFilters={setFilters} userSellers={userSellers} managers={managers} onSync={handleSync} loading={loading || syncing} />
                {orchErrors.length > 0 && (
                    <Alert
                        type="error"
                        showIcon
                        style={{ marginBottom: 16 }}
                        message="Some dashboard sections failed to load"
                        description={`${orchErrors.map(([section, msg]) => `${section}: ${msg}`).join(' · ')} — use Sync to retry.`}
                    />
                )}
                <DashboardErrorBoundary fallbackText="Status bar failed to load">
                    {/* ✅ Honest counts: activeAlerts counts unacknowledged ALERTS
                        (activity logs have no acknowledged state) and pendingTasks
                        comes from the normalized module stats. */}
                    <GlobalStatusBar 
                        healthScore={Math.round(kpiValues.achievementRate)}
                        activeAlerts={(orch.alerts || []).filter(a => !(a.acknowledged ?? a.Acknowledged)).length}
                        runningAutomations={scrapeTasks?.filter(t => t.status === 'RUNNING')?.length || 0}
                        pendingTasks={moduleStats.tasks?.pending || 0}
                        marketplaceStatus={scrapeTasks?.some(t => t.status === 'RUNNING') ? 'operational' : 'idle'}
                    />
                </DashboardErrorBoundary>

                {/* Layer 2: Critical Action Center */}
                <DashboardErrorBoundary fallbackText="Action center failed to load">
                    <CriticalActionCenter
                        criticalAlerts={moduleStats.alerts?.critical || 0}
                        outOfStock={moduleStats.asins?.outOfStock || 0}
                        pipelineFailed={moduleStats.pipeline?.failed || 0}
                        pendingTasks={moduleStats.tasks?.pending || 0}
                        overdueTasks={moduleStats.tasks?.overdue || 0}
                        onNavigate={navigate}
                    />
                </DashboardErrorBoundary>

                {/* Layer 3: Operations Control Center */}
                {(sectionStatus?.kpis) === 'error' ? (
                    <SectionState title="KPI metrics unavailable" message="Ad sales, spend, orders and targets could not be loaded." onRetry={refresh} height={150} />
                ) : (
                    <KpiStrip
                        adSales={kpiValues.adSales}
                        adSpend={kpiValues.adSpend}
                        orders={kpiValues.orders}
                        acos={kpiValues.acos}
                        units={kpiValues.units}
                        targetTotal={kpiValues.targetTotal}
                        targetAchieved={kpiValues.targetAchieved}
                        achievementRate={kpiValues.achievementRate}
                        brandCount={userSellers?.length || 0}
                        sparklineData={sparklineData}
                    />
                )}
                {(sectionStatus?.kpis) === 'error' ? (
                    <SectionState title="Module status unavailable" message="Module health could not be loaded." onRetry={refresh} height={140} />
                ) : (
                    <ModuleStatusGrid moduleStats={moduleStats} />
                )}

                {/* Layer 4: Marketplace Intelligence */}
                {(sectionStatus?.categories) === 'error' ? (
                    <SectionState title="Marketplace mix unavailable" message="Marketplace distribution could not be loaded." onRetry={refresh} height={180} />
                ) : (
                    <MarketplaceIntelligence marketplaces={marketplaceCategory} />
                )}

                {/* Layer 6: Live Operations + Notifications */}
                <Row gutter={[20, 20]} style={{ marginBottom: 20 }}>
                    <Col xs={24} lg={14}>
                        <DashboardErrorBoundary fallbackText="Live operations failed to load">
                            <LiveOperations
                                pipelineTotal={scrapeTasks?.length || 0}
                                running={moduleStats.pipeline?.running || 0}
                                completed={moduleStats.pipeline?.completed || 0}
                                failed={moduleStats.pipeline?.failed || 0}
                                idle={moduleStats.pipeline?.idle || 0}
                                tasksInProgress={moduleStats.tasks?.inProgress || 0}
                                onNavigate={navigate}
                            />
                        </DashboardErrorBoundary>
                    </Col>
                    <Col xs={24} lg={10}>
                        <DashboardErrorBoundary fallbackText="Notifications failed to load">
                            <NotificationsFeed
                                notifications={notifications}
                                onMarkAllRead={() => api.notificationApi.markAllAsRead().then(() => setNotifications(prev => prev.map(n => ({ ...n, IsRead: true }))))}
                                onViewAll={() => navigate('/alerts')}
                            />
                        </DashboardErrorBoundary>
                    </Col>
                </Row>

                {/* Layer 7: Analytics */}
                <Row gutter={[20, 20]} style={{ marginBottom: 20 }}>
                    <Col xs={24} lg={14}>
                        {(sectionStatus?.revenueSeries) === 'error' ? (
                            <SectionState title="Sales trend unavailable" message="Revenue and spend history could not be loaded." onRetry={refresh} height={300} />
                        ) : (
                            <SalesTrendChart labels={salesTrendLabels} revenueData={salesTrendRevenue} spendData={salesTrendSpend} />
                        )}
                    </Col>
                    <Col xs={24} lg={10}>
                        {(sectionStatus?.targets) === 'error' ? (
                            <SectionState title="Achievement status unavailable" message="Target achievement could not be loaded." onRetry={refresh} height={300} />
                        ) : (
                            <AchievementDonut targets={visibleTargets} overallRate={kpiValues.achievementRate} goalType={filters.goalType} />
                        )}
                    </Col>
                </Row>

                {/* Layer 9: Data Cards */}
                <Row gutter={[20, 20]} style={{ marginBottom: 20 }}>
                    <Col xs={24} md={8}>
                    {(sectionStatus?.topProducts) === 'error' ? (
                        <SectionState title="Top ASINs unavailable" message="Product performance could not be loaded." onRetry={refresh} height={280} />
                    ) : (
                    <DashboardErrorBoundary fallbackText="Top ASINs failed to load"><TopAsinsCard products={topProducts || []} /></DashboardErrorBoundary>
                    )}
</Col>
                    <Col xs={24} md={8}>
                    {tasksError ? (
                        <SectionState title="Tasks unavailable" message={tasksError} onRetry={refresh} height={280} />
                    ) : (
                    <DashboardErrorBoundary fallbackText="Tasks failed to load"><TasksOverviewCard tasks={optimizationTasks} loading={loading} /></DashboardErrorBoundary>
                    )}
</Col>
                    <Col xs={24} md={8}>
                    {(sectionStatus?.alerts) === 'error' ? (
                        <SectionState title="Alerts unavailable" message="The alert feed could not be loaded." onRetry={refresh} height={280} />
                    ) : (
                    <DashboardErrorBoundary fallbackText="Alerts failed to load"><AlertsPipelineCard alerts={orch.alerts || []} pipelineTasks={scrapeTasks} onSyncClick={refresh} syncLoading={loading} /></DashboardErrorBoundary>
                    )}
</Col>
                </Row>

                {/* Layer 10: Automation Rules */}
                <Row gutter={[20, 20]} style={{ marginBottom: 20 }}>
                    <Col xs={24} lg={14}>
                        <DashboardErrorBoundary fallbackText="Automation rules failed to load">
                            <AutomationRulesCard />
                        </DashboardErrorBoundary>
                    </Col>
                    <Col xs={24} lg={10}>
                        <ActivityTimeline events={activityLogs} />
                    </Col>
                </Row>
            </motion.div>
        </>
    );
};

export default Dashboard;
