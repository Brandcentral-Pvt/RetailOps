import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Chart from 'react-apexcharts';
import {
  LayoutDashboard,
  TrendingUp,
  BarChart2,
  Users,
  Package,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  AlertTriangle,
  Clock,
  CheckCircle2,
  PlayCircle,
  IndianRupee,
  ShoppingBag,
  Zap,
  MoreVertical,
  MousePointer2,
  Target,
  FileBarChart,
  Settings,
  PieChart,
  ChevronRight,
  MessageSquareCode
} from 'lucide-react';
import DataTable from '../components/DataTable';
import api, { seedApi } from '../services/api';

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [dateRange, setDateRange] = useState('last30');
  const [refreshInterval, setRefreshInterval] = useState(0);
  const [data, setData] = useState({
    kpis: [],
    revenueData: [],
    categoryData: [],
    topProducts: [],
    userStats: null,
    teamStats: null,
    alerts: [],
  });
  const [error, setError] = useState(null);

  // Load dashboard data from database
  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const periodMap = {
        'last7': '7d',
        'last30': '30d',
        'last90': '90d',
        'thisYear': '1y'
      };
      const response = await api.dashboardApi.getSummary(periodMap[dateRange] || '30d');
      const { kpi, revenue, units, category, tableData, userStats, teamStats, alerts } = response;

      setData({
        kpis: kpi || [],
        revenueData: revenue?.[0]?.data || [],
        categoryData: category || [],
        topProducts: tableData?.map((p, idx) => ({ ...p, rank: idx + 1, name: p.title })) || [],
        userStats,
        teamStats,
        alerts: alerts || [],
      });

    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError('Failed to load dashboard data. Please check your connection.');
    }
    setLoading(false);
  }, [dateRange]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(loadDashboardData, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [refreshInterval, loadDashboardData]);

  const handleSeedDemoData = async () => {
    setSeeding(true);
    setError(null);
    try {
      const result = await seedApi.seedAll();
      if (result.success) {
        alert('Demo data seeded successfully!');
        loadDashboardData();
      }
    } catch (err) {
      console.error('Seeding failed:', err);
      setError('Failed to seed demo data.');
    }
    setSeeding(false);
  };

  // ApexCharts Configurations
  const revenueChartOptions = {
    chart: {
      id: 'revenue-trend',
      toolbar: { show: false },
      background: 'transparent',
      sparkline: { enabled: false },
    },
    colors: ['#4F46E5'],
    stroke: { curve: 'smooth', width: 3 },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.45,
        opacityTo: 0.1,
        stops: [0, 100]
      }
    },
    xaxis: {
      categories: data.revenueData.map((_, i) => `${i + 1}`),
      labels: { show: false },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: { labels: { show: true, style: { colors: '#64748b' } } },
    grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
    dataLabels: { enabled: false },
    tooltip: { theme: 'light' }
  };

  const categoryChartOptions = {
    chart: { type: 'donut' },
    labels: data.categoryData.map(c => c.name),
    colors: ['#4F46E5', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'],
    legend: { position: 'bottom', fontSize: '12px' },
    dataLabels: { enabled: false },
    plotOptions: {
      pie: {
        donut: {
          size: '75%',
          labels: {
            show: true,
            total: {
              show: true,
              label: 'Total ASINs',
              formatter: () => data.kpis.find(k => k.title === 'Active ASINs')?.value || 0
            }
          }
        }
      }
    }
  };

  const MetricPill = ({ title, value, icon: Icon, color }) => (
    <div className="stat-pill py-1 px-3">
      <div className="stat-pill-icon" style={{ backgroundColor: `${color}15`, color: color, width: '22px', height: '22px' }}>
        <Icon size={12} />
      </div>
      <div>
        <div className="stat-pill-label" style={{ fontSize: '10px' }}>{title}</div>
        <div className="stat-pill-value" style={{ fontSize: '0.85rem' }}>{value}</div>
      </div>
    </div>
  );

  const DashboardCard = ({ title, icon: Icon, children, extra }) => (
    <div className="glass-card h-100" style={{ borderRadius: '16px', padding: '1rem', display: 'flex', flexDirection: 'column' }}>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="mb-0 d-flex align-items-center gap-2 fw-bold text-dark" style={{ fontSize: '0.85rem' }}>
          <Icon size={16} className="text-primary" />
          {title}
        </h6>
        {extra}
      </div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );

  return (
    <div className="dashboard-container p-3" style={{ backgroundColor: '#fdfdfd', minHeight: '100vh' }}>
      {/* Header Command Center */}
      <header className="mb-3">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-0">
              <div className="bg-primary text-white p-1 rounded-2"><Zap size={16} /></div>
              <h1 className="h5 fw-800 mb-0" style={{ letterSpacing: '-0.02em' }}>Analytics HQ</h1>
            </div>
            <p className="text-muted smallest mb-0">Market Intelligence Command Center</p>
          </div>

          <div className="d-flex align-items-center gap-2">
            {/* Compact Tools */}
            <div className="d-flex gap-2">
              <button className="btn btn-white btn-sm shadow-sm border border-light rounded-pill px-2 py-1 fw-600 d-flex align-items-center gap-1" style={{ fontSize: '11px' }} onClick={loadDashboardData}>
                <RefreshCw size={12} className={loading ? 'spin' : ''} />
                SYNC
              </button>
              <div className="glass-card p-1 d-flex gap-1" style={{ borderRadius: '50px' }}>
                {['last7', 'last30', 'last90'].map((range) => (
                  <button
                    key={range}
                    className={`btn btn-sm px-2 rounded-pill border-0 transition-base ${dateRange === range ? 'btn-primary shadow-sm' : 'btn-light bg-transparent text-muted'}`}
                    style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px' }}
                    onClick={() => setDateRange(range)}
                  >
                    {range === 'last7' ? '7D' : range === 'last30' ? '30D' : '90D'}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={handleSeedDemoData} className="btn btn-dark btn-sm rounded-pill px-3 py-1 shadow-sm fw-700" style={{ fontSize: '11px' }} disabled={seeding}>
              {seeding ? 'SEEDING...' : 'POPULATE'}
            </button>
          </div>
        </div>
      </header>

      {/* Metric Bar */}
      <div className="d-flex flex-wrap gap-2 mb-3">
        {data.kpis.map((kpi, idx) => (
          <MetricPill
            key={idx}
            title={kpi.title}
            value={kpi.value}
            icon={kpi.icon.includes('shop') ? ShoppingBag : kpi.icon.includes('box') ? Package : kpi.icon.includes('rupee') ? IndianRupee : TrendingUp}
            color={idx % 2 === 0 ? '#4F46E5' : '#8B5CF6'}
          />
        ))}
      </div>

      <div className="row g-3 mb-3">
        {/* Main Trend Chart */}
        <div className="col-lg-8">
          <DashboardCard title="Revenue Intelligence" icon={TrendingUp} extra={<span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-0.5 rounded-pill smallest" style={{ fontSize: '10px' }}>LIVE TREND</span>}>
            <div style={{ minHeight: '260px' }}>
              {data.revenueData.length > 0 ? (
                <Chart options={revenueChartOptions} series={[{ name: 'Valuation', data: data.revenueData }]} type="area" height={260} />
              ) : (
                <div className="d-flex align-items-center justify-content-center h-100 text-muted smallest">No trend data available</div>
              )}
            </div>
          </DashboardCard>
        </div>

        {/* Category Breakdown */}
        <div className="col-lg-4">
          <DashboardCard title="Portfolio Mix" icon={PieChart} extra={<button className="btn btn-link btn-sm p-0 text-muted"><Settings size={12} /></button>}>
            <div className="d-flex align-items-center justify-content-center h-100">
              {data.categoryData.length > 0 ? (
                <Chart options={categoryChartOptions} series={data.categoryData.map(c => c.data[0])} type="donut" width="100%" height={260} />
              ) : (
                <div className="text-muted smallest">No category data</div>
              )}
            </div>
          </DashboardCard>
        </div>
      </div>

      <div className="row g-3 mb-3">
        {/* Quick Access Column */}
        <div className="col-lg-3">
          <div className="glass-card p-3 h-100" style={{ borderRadius: '16px' }}>
            <h6 className="fw-bold mb-3 d-flex align-items-center gap-2" style={{ fontSize: '0.85rem' }}>
              <MousePointer2 size={16} className="text-primary" />
              Quick Access
            </h6>
            <div className="d-grid gap-1">
              {[
                { label: 'Inventory Hub', icon: Package, href: '/inventory', color: '#4f46e5' },
                { label: 'Strategic OKRs', icon: Target, href: '/actions', color: '#8b5cf6' },
                { label: 'Market Scraper', icon: Zap, href: '/scrape-tasks', color: '#f59e0b' },
                { label: 'Alert Manager', icon: AlertCircle, href: '/alerts', color: '#ef4444' },
                { label: 'Performance', icon: FileBarChart, href: '/performance-reports', color: '#10b981' },
              ].map((item, idx) => (
                <a key={idx} href={item.href} className="btn text-start p-2 rounded-3 transition-base border border-transparent hover-bg-light d-flex align-items-center justify-content-between group" style={{ minHeight: '44px' }}>
                  <div className="d-flex align-items-center gap-2">
                    <div className="p-1.5 rounded-2 d-flex align-items-center justify-content-center" style={{ backgroundColor: `${item.color}15`, color: item.color, width: '28px', height: '28px' }}>
                      <item.icon size={14} />
                    </div>
                    <span className="fw-600" style={{ fontSize: '12px' }}>{item.label}</span>
                  </div>
                  <ChevronRight size={12} className="text-muted opacity-0 group-hover-opacity-100 transition-base" />
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Action Center Side-by-Side */}
        <div className="col-lg-9">
          <div className="row g-3 h-100">
            {/* Personal Actions */}
            <div className="col-md-6">
              <div className="glass-card p-3 h-100 d-flex flex-column" style={{ borderRadius: '16px' }}>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h6 className="fw-bold mb-0 d-flex align-items-center gap-2" style={{ fontSize: '0.85rem' }}>
                    <ShoppingBag size={16} className="text-primary" />
                    My Operations
                  </h6>
                  <span className="badge bg-primary rounded-pill smallest px-2" style={{ fontSize: '10px' }}>{data.userStats?.total || 0} ITEMS</span>
                </div>

                <div className="row g-2 flex-grow-1">
                  {[
                    { label: 'TO DO', value: data.userStats?.pending || 0, icon: Clock, color: '#64748b' },
                    { label: 'ACTIVE', value: data.userStats?.inProgress || 0, icon: PlayCircle, color: '#3b82f6' },
                    { label: 'REVIEW', value: data.userStats?.review || 0, icon: MessageSquareCode, color: '#f59e0b' },
                    { label: 'DONE', value: data.userStats?.completed || 0, icon: CheckCircle2, color: '#10b981' }
                  ].map((s, idx) => (
                    <div key={idx} className="col-6">
                      <div className="p-2 border rounded-3 h-100 transition-base hover-shadow-sm bg-white bg-opacity-50">
                        <div className="d-flex align-items-center gap-2 mb-1">
                          <s.icon size={14} style={{ color: s.color }} />
                          <div className="smallest fw-700 text-muted" style={{ fontSize: '9px', letterSpacing: '0.05em' }}>{s.label}</div>
                        </div>
                        <div className="h5 fw-bold mb-0" style={{ fontSize: '1.1rem' }}>{s.value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Team Throughput */}
            <div className="col-md-6">
              <div className="glass-card p-3 h-100 d-flex flex-column" style={{ borderRadius: '16px' }}>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h6 className="fw-bold mb-0 d-flex align-items-center gap-2" style={{ fontSize: '0.85rem' }}>
                    <Users size={16} className="text-secondary" />
                    Team Health
                  </h6>
                  <div className="d-flex align-items-center gap-1 text-success smallest fw-700" style={{ fontSize: '10px' }}>
                    <TrendingUp size={10} />
                    {data.teamStats?.total ? Math.round((data.teamStats.completed / data.teamStats.total) * 100) : 0}% EFF.
                  </div>
                </div>

                <div className="row g-2 flex-grow-1">
                  {[
                    { label: 'WAITING', value: data.teamStats?.pending || 0, color: '#64748b' },
                    { label: 'WORKING', value: data.teamStats?.inProgress || 0, color: '#3b82f6' },
                    { label: 'VERIFY', value: data.teamStats?.review || 0, color: '#f59e0b' },
                    { label: 'SUCCESS', value: data.teamStats?.completed || 0, color: '#10b981' }
                  ].map((s, idx) => (
                    <div key={idx} className="col-6">
                      <div className="p-2 border rounded-3 h-100 transition-base bg-white bg-opacity-20 d-flex align-items-center justify-content-between" style={{ minHeight: '56px' }}>
                        <div>
                          <div className="smallest fw-700 text-muted" style={{ fontSize: '9px', letterSpacing: '0.05em' }}>{s.label}</div>
                          <div className="h6 fw-bold mb-0" style={{ fontSize: '1rem' }}>{s.value}</div>
                        </div>
                        <div style={{ width: '3px', height: '16px', borderRadius: '4px', backgroundColor: s.color }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3">
        {/* Alerts / Activity */}
        <div className="col-lg-4">
          <DashboardCard title="Real-time Alerts" icon={AlertCircle} extra={<button className="btn btn-light btn-sm rounded-circle p-1"><MoreVertical size={12} /></button>}>
            <div className="d-grid gap-2">
              {data.alerts.length > 0 ? data.alerts.map(alert => (
                <div key={alert.id} className="d-flex align-items-start gap-2 p-2 rounded-3 bg-white border shadow-xs border-light">
                  <div className={`p-1.5 rounded-2 mt-0.5 ${alert.type === 'critical' ? 'bg-danger-subtle text-danger' : 'bg-warning-subtle text-warning'}`}>
                    <AlertTriangle size={12} />
                  </div>
                  <div>
                    <div className="fw-700" style={{ fontSize: '12px', lineHeight: '1.2' }}>{alert.message}</div>
                    <div className="text-muted smallest mt-0.5" style={{ fontSize: '10px' }}>{alert.time}</div>
                  </div>
                </div>
              )) : <div className="text-center py-4 text-muted smallest">All systems operational</div>}
            </div>
          </DashboardCard>
        </div>

        {/* Top Products Table */}
        <div className="col-lg-8">
          <div className="glass-card shadow-sm border-0 h-100" style={{ borderRadius: '16px', overflow: 'hidden' }}>
            <div className="px-3 py-2 border-bottom d-flex justify-content-between align-items-center">
              <h6 className="fw-bold mb-0 d-flex align-items-center gap-2" style={{ fontSize: '0.85rem' }}>
                <ShoppingBag size={16} className="text-primary" />
                Performance Ledger
              </h6>
              <button className="btn btn-sm btn-white border rounded-pill px-2 py-1 shadow-xs smallest fw-700" style={{ fontSize: '10px' }}>VIEW FULL LEDGER</button>
            </div>
            <div className="p-0">
              {data.topProducts.length > 0 ? (
                <DataTable
                  data={data.topProducts}
                  columns={['name', 'asin', 'revenue', 'units', 'growth']}
                  searchable={false}
                  compact={true}
                />
              ) : (
                <div className="p-4 text-center text-muted smallest">No data available</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>

  );
};

export default Dashboard;
