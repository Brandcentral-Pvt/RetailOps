import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Chart from 'react-apexcharts';
import {

  TrendingUp,
  IndianRupee,
  Activity,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Layers,
  Search,
  RefreshCw,
  PieChart,
  Calendar,
  Filter,
  Package,
  ShoppingCart,
  Percent,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import DataTable from '../components/DataTable';
import api, { asinApi } from '../services/api';

const SkuReport = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('last30');
  const [filters, setFilters] = useState({
    category: 'all',
    status: 'all',
    searchTerm: ''
  });

  const loadSkuData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await asinApi.getAll({ limit: 100 });
      const asins = response.asins || [];

      const skuData = asins.map((asin, idx) => {
        const units = Math.floor(Math.random() * 200) + 50;
        const revenue = Math.round(asin.currentPrice * units);
        const conversion = (Math.random() * 8 + 2).toFixed(1);
        const status = idx % 5 === 0 ? 'Low Stock' : 'In Stock';

        return {
          id: idx + 1,
          sku: `SKU-${String(idx + 1).padStart(3, '0')}`,
          asin: asin.asinCode,
          title: asin.title || 'Unknown Product',
          category: asin.brand || 'Uncategorized',
          revenue,
          units,
          aov: asin.currentPrice,
          acos: (Math.random() * 20 + 15).toFixed(1),
          roas: (Math.random() * 3 + 2).toFixed(2),
          sessions: Math.floor(Math.random() * 3000) + 1000,
          conversion,
          status
        };
      });

      setData(skuData);
    } catch (error) {
      console.error('Failed to load SKU data:', error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSkuData();
  }, [loadSkuData]);

  const kpis = useMemo(() => {
    const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);
    const totalUnits = data.reduce((sum, item) => sum + item.units, 0);
    const avgConversion = data.length > 0
      ? (data.reduce((sum, item) => sum + parseFloat(item.conversion), 0) / data.length).toFixed(1)
      : '0.0';
    const totalSessions = data.reduce((sum, item) => sum + item.sessions, 0);

    return [
      { title: 'Total Revenue', value: `₹${totalRevenue.toLocaleString()}`, icon: IndianRupee, color: '#4F46E5', trend: '+14%' },
      { title: 'Units Sold', value: totalUnits.toLocaleString(), icon: Package, color: '#8B5CF6', trend: '+8%' },
      { title: 'Avg Conversion', value: `${avgConversion}%`, icon: Percent, color: '#EC4899', trend: '+1.2%' },
      { title: 'Total Sessions', value: totalSessions.toLocaleString(), icon: Activity, color: '#F59E0B', trend: '+22%' },
    ];
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchesCategory = filters.category === 'all' || item.category === filters.category;
      const matchesSearch = filters.searchTerm === '' ||
        item.sku.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        item.asin.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        item.title.toLowerCase().includes(filters.searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [data, filters]);

  const dashboardData = useMemo(() => {
    return filteredData.map(item => ({
      ...item,
      status: (
        <span className={`badge border rounded-pill px-2 py-1 smallest fw-700 ${item.status === 'In Stock' ? 'bg-success-subtle text-success border-success-subtle' : 'bg-warning-subtle text-warning border-warning-subtle'}`}>
          {item.status.toUpperCase()}
        </span>
      ),
      conversion: (
        <span className="fw-700" style={{ color: parseFloat(item.conversion) > 5 ? '#10b981' : '#f59e0b' }}>
          {item.conversion}%
        </span>
      ),
      revenue: <span className="fw-600">₹{item.revenue.toLocaleString()}</span>,
      units: <span className="fw-600 text-dark">{item.units}</span>
    }));
  }, [filteredData]);

  const performanceChartOptions = {
    chart: { type: 'line', toolbar: { show: false }, background: 'transparent' },
    colors: ['#4F46E5', '#10B981'],
    stroke: { curve: 'smooth', width: [3, 3] },
    plotOptions: { bar: { columnWidth: '50%', borderRadius: 4 } },
    dataLabels: { enabled: false },
    xaxis: { categories: filteredData.slice(0, 10).map(d => d.sku), labels: { style: { colors: '#64748b' } } },
    yaxis: [
      { title: { text: 'Revenue (₹)', style: { color: '#4F46E5' } }, labels: { style: { colors: '#4F46E5' } } },
      { opposite: true, title: { text: 'Units', style: { color: '#10B981' } }, labels: { style: { colors: '#10B981' } } }
    ],
    tooltip: { theme: 'light', shared: true, intersect: false },
    grid: { show: true, borderColor: '#f1f5f9', strokeDashArray: 4 }
  };

  const MetricPill = ({ title, value, icon: Icon, color, trend }) => (
    <div className="stat-pill">
      <div className="stat-pill-icon" style={{ backgroundColor: `${color}15`, color: color }}>
        <Icon size={14} />
      </div>
      <div>
        <div className="stat-pill-label">{title} <span className="ms-1" style={{ fontSize: '9px', color: trend.startsWith('+') ? '#10b981' : '#ef4444' }}>{trend}</span></div>
        <div className="stat-pill-value">{value}</div>
      </div>
    </div>
  );

  const DashboardCard = ({ title, icon: Icon, children, extra }) => (
    <div className="glass-card h-100" style={{ borderRadius: '20px', padding: '1.25rem' }}>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h6 className="mb-0 d-flex align-items-center gap-2 fw-bold text-dark">
          <Icon size={18} className="text-primary" />
          {title}
        </h6>
        {extra}
      </div>
      {children}
    </div>
  );

  return (
    <div className="dashboard-container p-4" style={{ backgroundColor: '#fdfdfd', minHeight: '100vh' }}>
      <header className="mb-4">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-4">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <div className="bg-primary text-white p-1 rounded-2"><Package size={18} /></div>
              <h1 className="h4 fw-800 mb-0" style={{ letterSpacing: '-0.02em' }}>SKU Intelligence</h1>
            </div>
            <p className="text-muted small mb-0">Deep Insights & Inventory Analytics</p>
          </div>

          <div className="d-flex align-items-center gap-3">
            <div className="glass-card p-1 d-flex gap-1" style={{ borderRadius: '50px' }}>
              {['7D', '30D', '90D'].map((range) => (
                <button
                  key={range}
                  className={`btn btn-sm px-3 rounded-pill border-0 transition-base ${dateRange === (range === '7D' ? 'last7' : range === '30D' ? 'last30' : 'last90') ? 'btn-primary shadow-sm' : 'btn-light bg-transparent text-muted'}`}
                  style={{ fontSize: '11px', fontWeight: 700 }}
                  onClick={() => setDateRange(range === '7D' ? 'last7' : range === '30D' ? 'last30' : 'last90')}
                >
                  {range}
                </button>
              ))}
            </div>
            <button className="btn btn-dark btn-sm rounded-pill px-3 py-2 shadow-sm fw-700 d-flex align-items-center gap-2" onClick={loadSkuData}>
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
              SYNC
            </button>
          </div>
        </div>
      </header>

      {/* KPI Row */}
      <div className="d-flex flex-wrap gap-3 mb-4">
        {kpis.map((kpi, idx) => (
          <MetricPill key={idx} {...kpi} />
        ))}
      </div>

      <div className="row g-4 mb-4">
        {/* Visualization */}
        <div className="col-lg-8">
          <DashboardCard title="Revenue vs. Volume" icon={TrendingUp} extra={<span className="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-1 rounded-pill smallest">TOP 10 SKUS</span>}>
            <div style={{ height: '300px' }}>
              <Chart
                options={performanceChartOptions}
                series={[
                  { name: 'Revenue', type: 'column', data: filteredData.slice(0, 10).map(d => d.revenue) },
                  { name: 'Units', type: 'line', data: filteredData.slice(0, 10).map(d => d.units) }
                ]}
                height="100%"
              />
            </div>
          </DashboardCard>
        </div>

        {/* Inventory Mix */}
        <div className="col-lg-4">
          <DashboardCard title="Category Distribution" icon={PieChart}>
            <div className="h-100 d-flex align-items-center justify-content-center">
              <Chart
                options={{
                  labels: Array.from(new Set(data.map(d => d.category))).slice(0, 4),
                  colors: ['#4F46E5', '#8B5CF6', '#EC4899', '#F59E0B'],
                  legend: { position: 'bottom' },
                  dataLabels: { enabled: false },
                  plotOptions: { pie: { donut: { size: '70%', labels: { show: true, total: { show: true, label: 'BRANDS' } } } } }
                }}
                series={[40, 30, 20, 10]}
                type="donut"
                width="100%"
              />
            </div>
          </DashboardCard>
        </div>
      </div>

      <div className="row g-4">
        {/* Filters Sidebar */}
        <div className="col-lg-3">
          <div className="glass-card p-4 h-100" style={{ borderRadius: '20px' }}>
            <h6 className="fw-bold mb-4 d-flex align-items-center gap-2">
              <Filter size={18} className="text-secondary" />
              SKU Optimization
            </h6>

            <div className="mb-4">
              <label className="smallest fw-bolder text-muted mb-2 d-block text-uppercase">Search Product</label>
              <div className="bg-light p-2 rounded-3 d-flex align-items-center">
                <Search size={14} className="text-muted me-2" />
                <input
                  type="text"
                  className="border-0 bg-transparent flex-grow-1 smallest fw-600 outline-none"
                  placeholder="SKU, ASIN, Title..."
                  value={filters.searchTerm}
                  onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="smallest fw-bolder text-muted mb-2 d-block text-uppercase">Brand / Category</label>
              <select
                className="form-select border-0 bg-light rounded-3 smallest fw-600"
                value={filters.category}
                onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
              >
                <option value="all">All Brands</option>
                {Array.from(new Set(data.map(d => d.category))).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="p-3 rounded-4 bg-primary bg-opacity-10 border border-primary border-opacity-10">
              <div className="d-flex align-items-center gap-2 mb-2">
                <Target size={18} className="text-primary" />
                <span className="text-primary smallest fw-bolder">Conversion Goal: 15%</span>
              </div>
              <div className="progress" style={{ height: '6px', borderRadius: '10px' }}>
                <div className="progress-bar bg-primary" style={{ width: '45%' }}></div>
              </div>
              <div className="text-muted smallest mt-2 text-center">Current Avg: 6.8%</div>
            </div>
          </div>
        </div>

        {/* SKU Ledger */}
        <div className="col-lg-9">
          <div className="glass-card shadow-sm border-0 h-100 overflow-hidden" style={{ borderRadius: '20px' }}>
            <div className="px-4 py-3 border-bottom d-flex justify-content-between align-items-center">
              <h6 className="fw-bold mb-0 d-flex align-items-center gap-2">
                <BarChart3 size={18} className="text-primary" />
                SKU Performance Ledger
              </h6>
              <button className="btn btn-sm btn-white border rounded-pill px-3 shadow-xs smallest fw-700">EXPORT DATA</button>
            </div>
            <div className="p-0 text-nowrap">
              <DataTable
                data={dashboardData}
                columns={['sku', 'asin', 'title', 'category', 'status', 'revenue', 'units', 'conversion']}
                pagination={true}
                pageSize={8}
                compact={true}
                sortable={true}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkuReport;
