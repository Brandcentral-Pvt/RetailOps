import { Spinner } from "@/components/Spinner";
import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Row, Col } from 'antd';
import { useNavigate } from 'react-router-dom';
import { usePageTitle } from '../contexts/PageTitleContext';
import { useDateRange } from '../contexts/DateRangeContext';
import { useDashboardData } from '../hooks/useDashboardData';
import { useCommandPalette } from '../components/dashboard/CommandPalette';

// New Components
import GlobalStatusBar from '../components/dashboard/GlobalStatusBar';
import CriticalActionCenter from '../components/dashboard/CriticalActionCenter';
import LiveOperations from '../components/dashboard/LiveOperations';
import NotificationsFeed from '../components/dashboard/NotificationsFeed';
import CommandPalette from '../components/dashboard/CommandPalette';

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
        transition: { duration: 0.4, ease: 'easeOut', staggerChildren: 0.1 } 
    }
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
        loading, isHydrated, refresh
    } = useDashboardData(filters);

    const kpiValues = useMemo(() => {
        const adsPerf = orch.dashboardRaw?.adsPerformanceSeries || [];
        const adSales = (adsPerf[0]?.data || []).reduce((a, b) => a + b, 0);
        const adSpend = (adsPerf[1]?.data || []).reduce((a, b) => a + b, 0);
        const orders = orch.dashboardRaw?.kpi?.[0]?.trend || 0;
        const acos = adSales > 0 ? (adSpend / adSales) * 100 : 0;
        const units = Math.round(orders * 1.48);

        const targetsList = orch.targets || [];
        let totalTarget = 0, totalAchieved = 0;
        let filteredTargets = targetsList;
        if (filters.sellerId !== 'all') filteredTargets = filteredTargets.filter(t => t.SellerId === filters.sellerId);
        if (filters.managerId !== 'all') filteredTargets = filteredTargets.filter(t => t.BrandManager === filters.managerId);
        if (filters.goalType !== 'all') filteredTargets = filteredTargets.filter(t => (t.GoalType || 'GMS').toUpperCase() === filters.goalType);
        filteredTargets.forEach(t => { totalTarget += (t.TotalTargetValue || 0); totalAchieved += (t.overallAchieved || 0); });
        const achievementRate = totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0;

        return { adSales, adSpend, orders, acos, units, targetTotal: totalTarget, targetAchieved: totalAchieved, achievementRate };
    }, [orch.dashboardRaw, orch.targets, filters]);

    const sparklineData = useMemo(() => {
        const adsPerf = orch.dashboardRaw?.adsPerformanceSeries || [];
        return { adSales: adsPerf[0]?.data || [], orders: orch.dashboardRaw?.ordersSeries || [], acos: orch.dashboardRaw?.acosSeries || [], units: orch.dashboardRaw?.unitsSeries || [] };
    }, [orch.dashboardRaw]);

    const salesTrendLabels = useMemo(() => orch.dashboardRaw?.labels || [], [orch.dashboardRaw]);
    const salesTrendRevenue = useMemo(() => (orch.dashboardRaw?.adsPerformanceSeries || [])[0]?.data || [], [orch.dashboardRaw]);
    const salesTrendSpend = useMemo(() => (orch.dashboardRaw?.adsPerformanceSeries || [])[1]?.data || [], [orch.dashboardRaw]);

    // Mock notifications for demo
    const notifications = useMemo(() => [
        { type: 'success', title: 'Marketplace Sync Complete', description: 'Successfully synced 245 ASINs across 3 sellers', time: '2m ago', read: false },
        { type: 'warning', title: 'Price Dispute Detected', description: '12 products have conflicting prices on Amazon', time: '15m ago', read: false },
        { type: 'info', title: 'AI Image Generated', description: '3 new lifestyle images ready for review', time: '1h ago', read: true },
        { type: 'alert', title: 'Low Stock Alert', description: '5 products are below minimum threshold', time: '2h ago', read: true },
    ], []);

    if (loading && !isHydrated) return <Spinner />;

    return (
        <>
            <CmdPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
            <motion.div variants={containerVariants} initial="hidden" animate="visible"
                style={{ background: '#f4f5f7', minHeight: '100%', padding: '0 24px' }}
            >
                {/* Layer 1: Header + Global Status Bar */}
                <DashboardHeader filters={filters} setFilters={setFilters} userSellers={userSellers} managers={managers} onSync={refresh} loading={loading} />
                <GlobalStatusBar 
                    healthScore={Math.round(kpiValues.achievementRate)}
                    activeAlerts={activityLogs?.filter(a => !a.AcknowledgedAt)?.length || 0}
                    runningAutomations={scrapeTasks?.filter(t => t.status === 'running')?.length || 0}
                    pendingTasks={optimizationTasks?.filter(t => t.status === 'pending')?.length || 0}
                />

                {/* Layer 2: Critical Action Center */}
                <CriticalActionCenter
                    priceDisputes={12}
                    outOfStock={5}
                    failedListings={3}
                    pendingApprovals={8}
                    syncFailures={2}
                    onNavigate={navigate}
                />

                {/* Layer 3: Operational Health (KPIs + Module Status) */}
                <KpiStrip
                    adSales={kpiValues.adSales}
                    adSpend={kpiValues.adSpend}
                    orders={kpiValues.orders}
                    acos={kpiValues.acos}
                    units={kpiValues.units}
                    targetTotal={kpiValues.targetTotal}
                    targetAchieved={kpiValues.targetAchieved}
                    achievementRate={kpiValues.achievementRate}
                    brandCount={0}
                    sparklineData={sparklineData}
                />
                <ModuleStatusGrid moduleStats={moduleStats} />

                {/* Layer 4: Live Operations + Notifications */}
                <Row gutter={[20, 20]} style={{ marginBottom: 20 }}>
                    <Col xs={24} lg={14}>
                        <LiveOperations
                            listingPipeline={scrapeTasks?.length || 0}
                            publishingQueue={5}
                            aiImageGen={3}
                            contentGen={2}
                            validationQueue={8}
                            exports={0}
                            marketplaceSync={scrapeTasks?.filter(t => t.type === 'sync')?.length || 0}
                            onNavigate={navigate}
                        />
                    </Col>
                    <Col xs={24} lg={10}>
                        <NotificationsFeed
                            notifications={notifications}
                            onMarkAllRead={() => {}}
                            onViewAll={() => navigate('/alerts')}
                        />
                    </Col>
                </Row>

                {/* Layer 5: Analytics (Charts + Data) */}
                <Row gutter={[20, 20]} style={{ marginBottom: 20 }}>
                    <Col xs={24} lg={14}>
                        <SalesTrendChart labels={salesTrendLabels} revenueData={salesTrendRevenue} spendData={salesTrendSpend} />
                    </Col>
                    <Col xs={24} lg={10}>
                        <AchievementDonut targets={orch.targets || []} overallRate={kpiValues.achievementRate} />
                    </Col>
                </Row>

                <Row gutter={[20, 20]}>
                    <Col xs={24} md={8}><TopAsinsCard products={topProducts || []} /></Col>
                    <Col xs={24} md={8}><TasksOverviewCard tasks={optimizationTasks} loading={loading} /></Col>
                    <Col xs={24} md={8}><AlertsPipelineCard alerts={activityLogs} pipelineTasks={scrapeTasks} onSyncClick={refresh} syncLoading={loading} /></Col>
                </Row>
            </motion.div>
        </>
    );
};

export default Dashboard;
