import { Spinner } from "@/components/Spinner";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Alert, Row, Col } from 'antd';
import { useNavigate } from 'react-router-dom';
import { usePageTitle } from '../contexts/PageTitleContext';
import { useDateRange } from '../contexts/DateRangeContext';
import { useDashboardData } from '../hooks/useDashboardData';
import { useCommandPalette } from '../components/dashboard/CommandPalette';
import api, { marketSyncApi } from '../services/api';
import DashboardErrorBoundary from '../components/dashboard/DashboardErrorBoundary';
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
        loading, isHydrated, refresh, matchesManagerFilter
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
    const handleSync = useCallback(async () => {
        if (syncing) return;
        setSyncing(true);
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
        }
    }, [syncing, refresh]);

    const kpiValues = useMemo(() => {
        const adsPerf = orch.dashboardRaw?.adsPerformanceSeries || [];
        const adSales = (adsPerf[0]?.data || []).reduce((a, b) => a + b, 0);
        const adSpend = (adsPerf[1]?.data || []).reduce((a, b) => a + b, 0);
        const orders = orch.dashboardRaw?.kpi?.[0]?.trend || 0;
        const acos = adSales > 0 ? (adSpend / adSales) * 100 : 0;
        const unitsSeries = orch.dashboardRaw?.unitsSeries || [];
        // ✅ Fix: removed the orders*1.48 estimation fallback — units are the
        // actual orders series from the backend now.
        const units = unitsSeries.reduce((a, b) => a + b, 0) || orders;

        const targetsList = orch.targets || [];
        let totalTarget = 0, totalAchieved = 0;
        let filteredTargets = targetsList;
        if (filters.sellerId !== 'all') filteredTargets = filteredTargets.filter(t => sellerMatches(t, filters.sellerId));
        // ✅ Fix: match manager by UserId OR BrandManager name (case-insensitive)
        if (filters.managerId !== 'all') filteredTargets = filteredTargets.filter(t => matchesManagerFilter(t, filters.managerId));
        if (filters.goalType !== 'all') filteredTargets = filteredTargets.filter(t => (t.GoalType || 'GMS').toUpperCase() === filters.goalType);
        filteredTargets.forEach(t => { totalTarget += (t.TotalTargetValue || 0); totalAchieved += (t.overallAchieved || 0); });
        const achievementRate = totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0;

        return { adSales, adSpend, orders, acos, units, targetTotal: totalTarget, targetAchieved: totalAchieved, achievementRate };
    }, [orch.dashboardRaw, orch.targets, filters, matchesManagerFilter]);

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
                    <GlobalStatusBar 
                        healthScore={Math.round(kpiValues.achievementRate)}
                        activeAlerts={activityLogs?.filter(a => !a.AcknowledgedAt)?.length || 0}
                        runningAutomations={scrapeTasks?.filter(t => t.status === 'RUNNING')?.length || 0}
                        pendingTasks={optimizationTasks?.filter(t => t.status === 'pending')?.length || 0}
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
                <DashboardErrorBoundary fallbackText="KPI strip failed to load">
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
                </DashboardErrorBoundary>
                <DashboardErrorBoundary fallbackText="Module status failed to load">
                    <ModuleStatusGrid moduleStats={moduleStats} />
                </DashboardErrorBoundary>

                {/* Layer 4: Marketplace Intelligence */}
                <DashboardErrorBoundary fallbackText="Marketplace intelligence failed to load">
                    <MarketplaceIntelligence marketplaces={marketplaceCategory} />
                </DashboardErrorBoundary>

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
                        <DashboardErrorBoundary fallbackText="Sales chart failed to load">
                            <SalesTrendChart labels={salesTrendLabels} revenueData={salesTrendRevenue} spendData={salesTrendSpend} />
                        </DashboardErrorBoundary>
                    </Col>
                    <Col xs={24} lg={10}>
                        <DashboardErrorBoundary fallbackText="Achievement chart failed to load">
                            <AchievementDonut targets={orch.targets || []} overallRate={kpiValues.achievementRate} goalType={filters.goalType} />
                        </DashboardErrorBoundary>
                    </Col>
                </Row>

                {/* Layer 9: Data Cards */}
                <Row gutter={[20, 20]} style={{ marginBottom: 20 }}>
                    <Col xs={24} md={8}><DashboardErrorBoundary fallbackText="Top ASINs failed to load"><TopAsinsCard products={topProducts || []} /></DashboardErrorBoundary></Col>
                    <Col xs={24} md={8}><DashboardErrorBoundary fallbackText="Tasks failed to load"><TasksOverviewCard tasks={optimizationTasks} loading={loading} /></DashboardErrorBoundary></Col>
                    <Col xs={24} md={8}><DashboardErrorBoundary fallbackText="Alerts failed to load"><AlertsPipelineCard alerts={activityLogs} pipelineTasks={scrapeTasks} onSyncClick={refresh} syncLoading={loading} /></DashboardErrorBoundary></Col>
                </Row>

                {/* Layer 8: Activity Timeline */}
                <DashboardErrorBoundary fallbackText="Activity timeline failed to load">
                    <ActivityTimeline events={activityLogs} />
                </DashboardErrorBoundary>
            </motion.div>
        </>
    );
};

export default Dashboard;
