import React, { useState, useEffect, useMemo } from 'react';
import { Row, Col, Card, Space } from 'antd';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { usePageTitle } from '../contexts/PageTitleContext';
import { useDateRange } from '../contexts/DateRangeContext';
import { useDashboardData } from '../hooks/useDashboardData';
import { useCommandPalette } from '../components/dashboard/CommandPalette';
import DashboardSkeleton from '../components/dashboard/DashboardSkeleton';
import DashboardErrorBoundary from '../components/dashboard/DashboardErrorBoundary';

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

    useEffect(() => {
        api.notificationApi.getNotifications({ page: 1, limit: 20 })
            .then(res => {
                const data = res?.data?.data?.notifications || res?.data?.data || [];
                notifications.set(Array.isArray(data) ? data : []);
            })
            .catch(() => {});
    }, []);

    // State to control skeleton vs. UI display
    const [hasShownUI, setHasShownUI] = useState(false);

    // Show UI after data is hydrated or after 3 seconds, whichever comes first
    useEffect(() => {
        if (isHydrated) {
            setHasShownUI(true);
        }
    }, [isHydrated]);

    useEffect(() => {
        const timer = setTimeout(() => setHasShownUI(true), 3000);
        return () => clearTimeout(timer);
    }, []);

    if (!hasShownUI) {
        return <DashboardSkeleton />;
    }

    if (loading && !isHydrated) return null;

    const kpiValues = useMemo(() => {
        const adsPerf = orch.dashboardRaw?.adsPerformanceSeries || [];
        const adSales = (adsPerf[0]?.data || []).reduce((a, b) => a + b, 0);
        const adSpend = (adsPerf[1]?.data || []).reduce((a, b) => a + b, 0);
        const orders = orch.dashboardRaw?.kpi?.[0]?.trend || 0;
        const acos = adSales > 0 ? (adSpend / adSales) * 100 : 0;
        const unitsSeries = orch.dashboardRaw?.unitsSeries || [];
        const units = unitsSeries.reduce((a, b) => a + b, 0) || Math.round(orders * 1.48);

        const targetsList = orch.targets || [];
        let totalTarget = 0, totalAchieved = 0;
        let filteredTargets = orch.targets || [];
        if (filters.sellerId !== 'all') filteredTargets = filteredTargets.filter(t => t.SellerId === filters.sellerId);
        if (filters.managerId !== 'all') filteredTargets = filteredTargets.filter(t => t.BrandManager === filters.managerId);
        if (filters.goalType !== 'all') filteredTargets = filteredTargets.filter(t => (t.GoalType || 'GMS').toUpperCase() === filters.goalType);
        filteredTargets.forEach(t => { totalTarget += (t.TotalTargetValue || 0); totalAchieved += (t.overallAchieved || 0); });
        const achievementRate = totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0;

        return { adSales, adSpend, orders, acos, units, targetTotal: totalTarget, targetAchieved: totalAchieved, achievementRate };
    }, [orch.dashboardRaw, orch.targets, filters.sellerId, filters.managerId, filters.goalType]);

    const sparklineData = useMemo(() => {
        const adsPerf = orch.dashboardRaw?.adsPerformanceSeries || [];
        return { adSales: adsPerf[0]?.data || [], orders: orch.dashboardRaw?.ordersSeries || [], acos: orch.dashboardRaw?.acosSeries || [], units: orch.dashboardRaw?.unitsSeries || [] };
    }, [orch.dashboardRaw]);

    const salesTrendLabels = useMemo(() => orch.dashboardRaw?.labels || [], [orch.dashboardRaw]);
    const salesTrendRevenue = useMemo(() => (orch.dashboardRaw?.adsPerformanceSeries || [])[0]?.data || [], [orch.dashboardRaw]);
    const salesTrendSpend = useMemo(() => (orch.dashboardRaw?.adsPerformanceSeries || [])[1]?.data || [], [orch.dashboardRaw]);

    const marketplaceCategory = useMemo(() => orch.dashboardRaw?.category || [], [orch.dashboardRaw]);

    return (
        <>
            <CmdPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
            <Row className="dashboard-layout" style={{ background: 'var(--bg-primary, var(--bc-slate-50))', minHeight: '100vh' }}>
                {/* Sidebar: Status & Controls */}
                <Col span={24} md={2} className="dashboard-sidebar">
                    <DashboardErrorBoundary fallbackText="Status bar failed to load">
                        <globalStatusBar 
                            healthScore={Math.round(kpiValues.achievementRate)}
                            activeAlerts={activityLogs?.filter(a => !a.AcknowledgedAt)?.length || 0}
                            runningAutomations={scrapeTasks?.filter(t => t.status === 'RUNNING')?.length || 0}
                            pendingTasks={optimizationTasks?.filter(t => t.status === 'pending')?.length || 0}
                            marketplaceStatus={scrapeTasks?.length > 0 ? 'operational' : 'idle'}
                        />
                    </DashboardErrorBoundary>
                    
                    <Card title="Filters" style={{ marginBottom: 20, border: '1px solid var(--border-color)' }}>
                        {/* Filter controls would go here */}
                    </Card>
                </Col>

                {/* Main Content Area */}
                <Col span={24} md={20} className="dashboard-content">
                    <DashboardHeader filters={filters} setFilters={setFilters} userSellers={userSellers} managers={managers} onSync={refresh} loading={loading} />

                    {/* KPI Strip - Top Priority */}
                    <Row gutter={16} style={{ marginBottom: 24, alignItems: 'center' }}>
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
                    </Row>

                    {/* Primary Metrics Grid */}
                    <Row gutter={24} style={{ marginBottom: 24 }}>
                        <Col span={24}>
                            <Card title="Module Status" style={{ border: '1px solid var(--border-color)' }}>
                                <ModuleStatusGrid moduleStats={moduleStats} />
                            </Card>
                        </Col>
                    </Row>

                    {/* Marketplace Intelligence */}
                    <Row gutter={24} style={{ marginBottom: 24 }}>
                        <Col span={24}>
                            <Card title="Marketplace Distribution" style={{ border: '1px solid var(--border-color)' }}>
                                <MarketplaceIntelligence marketplaces={marketplaceCategory} />
                            </Card>
                        </Col>
                    </Row>

                    {/* Analytics Section */}
                    <Row gutter={24} style={{ marginBottom: 24 }}>
                        <Col span={24} lg={14}>
                            <Card title="Sales Trend" style={{ border: '1px solid var(--border-color)' }}>
                                <SalesTrendChart labels={salesTrendLabels} revenueData={salesTrendRevenue} spendData={salesTrendSpend} />
                            </Card>
                        </Col>
                        <Col span={24} lg={10}>
                            <Card title="Achievement Overview" style={{ border: '1px solid var(--border-color)' }}>
                                <AchievementDonut targets={orch.targets || []} overallRate={kpiValues.achievementRate} />
                            </Card>
                        </Col>
                    </Row>

                    {/* Data Cards Section */}
                    <Row gutter={24} style={{ marginBottom: 24 }}>
                        <Col xs={24} md={8}>
                            <Card title="Top ASINs" style={{ border: '1px solid var(--border-color)' }}>
                                <TopAsinsCard products={topProducts || []} />
                            </Card>
                        </Col>
                        <Col xs={24} md={8}>
                            <Card title="Tasks Overview" style={{ border: '1px solid var(--border-color)' }}>
                                <TasksOverviewCard tasks={optimizationTasks} loading={loading} />
                            </Card>
                        </Col>
                        <Col xs={24} md={8}>
                            <Card title="Alerts Pipeline" style={{ border: '1px solid var(--border-color)' }}>
                                <AlertsPipelineCard alerts={activityLogs} pipelineTasks={scrapeTasks} onSyncClick={refresh} syncLoading={loading} />
                            </Card>
                        </Col>
                    </Row>

                    {/* Activity Timeline */}
                    <Row gutter={24} style={{ marginBottom: 24 }}>
                        <Col xs={24}>
                            <Card title="Recent Activity" style={{ border: '1px solid var(--border-color)' }}>
                                <ActivityTimeline events={activityLogs} />
                            </Card>
                        </Col>
                    </Row>
                </Col>
            </Row>
        </>
    );
};

export default Dashboard;