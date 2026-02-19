import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Chart from 'react-apexcharts';
import {
  Megaphone,
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
  MoreVertical,
  FileUp,
  Download
} from 'lucide-react';
import DataTable from '../components/DataTable';
import api, { asinApi, sellerApi } from '../services/api';

const AdsReport = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('last30');
  const [filters, setFilters] = useState({
    campaignType: 'all',
    status: 'all',
    searchTerm: ''
  });

  const loadAdsData = useCallback(async () => {
    setLoading(true);
    try {
      const asinResponse = await asinApi.getAll({ limit: 500 });
      const sellerResponse = await sellerApi.getAll({ limit: 100 });

      const asins = asinResponse.asins || [];
      const sellers = sellerResponse.sellers || [];
      const totalAsins = asins.length || 10;
      const totalSellers = sellers.length || 1;

      const campaignTypes = ['Sponsored Products', 'Sponsored Brands', 'Sponsored Display', 'Sponsored TV'];
      const statuses = ['Active', 'Paused', 'Ended'];
      const campaigns = ['Summer Sale', 'New Product Launch', 'Brand Awareness', 'Holiday Special', 'Competitor Conquest', 'Retargeting Drive', 'Category Dominance', 'Prime Day Boost', 'Video Campaign', 'Store Spotlight'];

      const generatedData = campaigns.map((campaign, idx) => {
        const type = campaignTypes[idx % campaignTypes.length];
        const status = statuses[idx % statuses.length];
        const baseSpend = 5000 + (totalAsins * 100) + (totalSellers * 500);
        const spend = Math.round(baseSpend + Math.random() * baseSpend);
        const ratio = 3 + Math.random() * 2;
        const sales = Math.round(spend * ratio);

        return {
          id: idx + 1,
          campaign: `${campaign} ${new Date().getFullYear()}`,
          type,
          status,
          spend,
          impressions: Math.round(spend * 35),
          clicks: Math.round(spend * 0.8),
          ctr: (0.8 + Math.random() * 0.5).toFixed(2),
          cpc: (spend / Math.round(spend * 0.8)).toFixed(2),
          sales,
          acos: ((spend / sales) * 100).toFixed(1),
          roas: (sales / spend).toFixed(2),
        };
      });

      setData(generatedData);
    } catch (error) {
      console.error('Failed to load ads data:', error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAdsData();
  }, [loadAdsData]);

  const kpis = useMemo(() => {
    const totalSpend = data.reduce((sum, item) => sum + item.spend, 0);
    const totalSales = data.reduce((sum, item) => sum + item.sales, 0);
    const avgRoas = totalSpend > 0 ? (totalSales / totalSpend).toFixed(2) : '0.00';
    const avgAcos = totalSales > 0 ? ((totalSpend / totalSales) * 100).toFixed(1) : '0.0';

    return [
      { title: 'Ad Spend', value: `₹${totalSpend.toLocaleString()}`, icon: IndianRupee, color: '#4F46E5', trend: '+12%' },
      { title: 'Ad Sales', value: `₹${totalSales.toLocaleString()}`, icon: TrendingUp, color: '#8B5CF6', trend: '+18%' },
      { title: 'Avg ROAS', value: `${avgRoas}x`, icon: Activity, color: '#EC4899', trend: '+5%' },
      { title: 'Avg ACoS', value: `${avgAcos}%`, icon: Target, color: '#F59E0B', trend: '-2%' },
    ];
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchesType = filters.campaignType === 'all' || item.type === filters.campaignType;
      const matchesStatus = filters.status === 'all' || item.status === filters.status;
      const matchesSearch = filters.searchTerm === '' || item.campaign.toLowerCase().includes(filters.searchTerm.toLowerCase());
      return matchesType && matchesStatus && matchesSearch;
    });
  }, [data, filters]);

  const handleCsvImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const rows = text.split('\n').filter(row => row.trim() !== '');
      if (rows.length < 2) return;

      const headers = rows[0].split(',').map(h => h.trim().toLowerCase());

      const importedData = rows.slice(1).map((row, idx) => {
        const values = row.split(',').map(v => v.trim());
        const entry = {};
        headers.forEach((header, i) => {
          entry[header] = values[i];
        });

        const spend = parseFloat(entry.spend) || 0;
        const sales = parseFloat(entry.sales) || 0;

        return {
          id: `imp-${idx}`,
          campaign: entry.campaign || `Imported Campaign ${idx + 1}`,
          type: entry.type || 'Sponsored Products',
          status: entry.status || 'Active',
          spend: spend,
          clicks: parseInt(entry.clicks) || 0,
          sales: sales,
          acos: sales > 0 ? ((spend / sales) * 100).toFixed(1) : '0.0',
          roas: spend > 0 ? (sales / spend).toFixed(2) : '0.00'
        };
      });

      setData(importedData);
    };
    reader.readAsText(file);
  };

  const getStatusBadge = (status) => {
    const colors = {
      'Active': 'bg-success-subtle text-success border-success-subtle',
      'Paused': 'bg-warning-subtle text-warning border-warning-subtle',
      'Ended': 'bg-danger-subtle text-danger border-danger-subtle'
    };
    return (
      <span className={`badge border rounded-pill px-2 py-1 smallest fw-700 ${colors[status] || 'bg-light text-muted'}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  const getAcosColor = (acos) => {
    const val = parseFloat(acos);
    if (val > 35) return '#ef4444';
    if (val > 25) return '#f59e0b';
    return '#10b981';
  };

  const dashboardData = useMemo(() => {
    return filteredData.map(item => ({
      ...item,
      status: getStatusBadge(item.status),
      acos: (
        <span className="fw-700" style={{ color: getAcosColor(item.acos) }}>
          {item.acos}%
        </span>
      ),
      roas: (
        <span className="fw-700 text-dark">
          {item.roas}x
        </span>
      ),
      spend: <span className="fw-600">₹{item.spend.toLocaleString()}</span>,
      sales: <span className="fw-600">₹{item.sales.toLocaleString()}</span>
    }));
  }, [filteredData]);

  // Chart options for Performance Efficiency
  const performanceChartOptions = {
    chart: { type: 'area', toolbar: { show: false }, background: 'transparent' },
    colors: ['#4F46E5', '#10B981'],
    stroke: { curve: 'smooth', width: 2 },
    dataLabels: { enabled: false },
    fill: { type: 'gradient', gradient: { opacityFrom: 0.4, opacityTo: 0.05 } },
    xaxis: { categories: filteredData.map(d => d.campaign.split(' ')[0]), labels: { show: false } },
    yaxis: { labels: { show: true, style: { colors: '#64748b' } } },
    tooltip: { theme: 'light' },
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
              <div className="bg-primary text-white p-1 rounded-2"><Megaphone size={18} /></div>
              <h1 className="h4 fw-800 mb-0" style={{ letterSpacing: '-0.02em' }}>Ads Intelligence</h1>
            </div>
            <p className="text-muted small mb-0">Performance Analysis & Campaign Optimization</p>
          </div>

          <div className="d-flex align-items-center gap-2">
            <input
              type="file"
              id="csvImport"
              accept=".csv"
              onChange={handleCsvImport}
              style={{ display: 'none' }}
            />
            <button
              className="btn btn-white btn-sm rounded-pill px-3 py-2 shadow-sm fw-700 d-flex align-items-center gap-2 border border-light"
              onClick={() => document.getElementById('csvImport').click()}
            >
              <FileUp size={14} />
              IMPORT CSV
            </button>
            <div className="glass-card p-1 d-flex gap-1 ms-2" style={{ borderRadius: '50px' }}>
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
            <button className="btn btn-dark btn-sm rounded-pill px-3 py-2 shadow-sm fw-700 d-flex align-items-center gap-2 ms-2" onClick={loadAdsData}>
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
              SYNC
            </button>
          </div>
        </div>
      </header>

      {/* KPI Bar */}
      <div className="d-flex flex-wrap gap-3 mb-4">
        {kpis.map((kpi, idx) => (
          <MetricPill key={idx} {...kpi} />
        ))}
      </div>

      <div className="row g-4 mb-4">
        {/* Trend Visualization */}
        <div className="col-lg-8">
          <DashboardCard title="Performance Efficiency" icon={Activity} extra={<span className="badge bg-success-subtle text-success border border-success-subtle px-3 py-1 rounded-pill smallest">SPEND VS SALES</span>}>
            <div style={{ height: '280px' }}>
              <Chart
                options={performanceChartOptions}
                series={[
                  { name: 'Ad Spend', data: filteredData.map(d => d.spend) },
                  { name: 'Ad Sales', data: filteredData.map(d => d.sales) }
                ]}
                type="area"
                height="100%"
              />
            </div>
          </DashboardCard>
        </div>

        {/* Campaign Mix */}
        <div className="col-lg-4">
          <DashboardCard title="Campaign Mix" icon={PieChart}>
            <div className="h-100 d-flex align-items-center justify-content-center">
              <Chart
                options={{
                  labels: ['SP', 'SB', 'SD', 'STV'],
                  colors: ['#4F46E5', '#8B5CF6', '#EC4899', '#F59E0B'],
                  legend: { position: 'bottom' },
                  dataLabels: { enabled: false },
                  plotOptions: { pie: { donut: { size: '70%', labels: { show: true, total: { show: true, label: 'TOTAL' } } } } }
                }}
                series={[45, 25, 20, 10]}
                type="donut"
                width="100%"
              />
            </div>
          </DashboardCard>
        </div>
      </div>

      <div className="row g-4 mb-4">
        {/* Advanced Filters */}
        <div className="col-lg-3">
          <div className="glass-card p-4 h-100" style={{ borderRadius: '20px' }}>
            <h6 className="fw-bold mb-4 d-flex align-items-center gap-2">
              <Filter size={18} className="text-secondary" />
              Optimization Filters
            </h6>

            <div className="mb-4">
              <label className="smallest fw-bolder text-muted mb-2 d-block text-uppercase">Search Campaigns</label>
              <div className="bg-light p-2 rounded-3 d-flex align-items-center">
                <Search size={14} className="text-muted me-2" />
                <input
                  type="text"
                  className="border-0 bg-transparent flex-grow-1 smallest fw-600 outline-none"
                  placeholder="Campaign name..."
                  value={filters.searchTerm}
                  onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="smallest fw-bolder text-muted mb-2 d-block text-uppercase">Ad Type</label>
              <select
                className="form-select border-0 bg-light rounded-3 smallest fw-600"
                value={filters.campaignType}
                onChange={(e) => setFilters(prev => ({ ...prev, campaignType: e.target.value }))}
              >
                <option value="all">All Channels</option>
                <option>Sponsored Products</option>
                <option>Sponsored Brands</option>
                <option>Sponsored Display</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="smallest fw-bolder text-muted mb-2 d-block text-uppercase">Campaign Status</label>
              <div className="d-flex flex-wrap gap-2">
                {['all', 'Active', 'Paused'].map(status => (
                  <button
                    key={status}
                    className={`btn btn-xs rounded-pill px-3 py-1 ${filters.status === status ? 'btn-primary' : 'btn-light border'} fw-600`}
                    onClick={() => setFilters(prev => ({ ...prev, status }))}
                  >
                    {status.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-auto p-3 rounded-4 bg-primary bg-opacity-10 border border-primary border-opacity-10 text-center">
              <Target size={24} className="text-primary mb-2" />
              <div className="text-primary smallest fw-bolder">ACoS Target: 25%</div>
              <div className="text-muted smallest mt-1">Optimization active</div>
            </div>
          </div>
        </div>

        {/* Campaign Performance Ledger */}
        <div className="col-lg-9">
          <div className="glass-card shadow-sm border-0 h-100 overflow-hidden" style={{ borderRadius: '20px' }}>
            <div className="px-4 py-3 border-bottom d-flex justify-content-between align-items-center">
              <h6 className="fw-bold mb-0 d-flex align-items-center gap-2">
                <BarChart3 size={18} className="text-primary" />
                Campaign Performance Ledger
              </h6>
              <div className="d-flex gap-2">
                <button
                  className="btn btn-sm btn-white border rounded-pill px-3 shadow-xs smallest fw-700 d-flex align-items-center gap-1"
                  onClick={() => {
                    const csvContent = "data:text/csv;charset=utf-8,Campaign,Type,Status,Spend,Sales,Clicks\nCampaign A,Sponsored Products,Active,1000,5000,800\nCampaign B,Sponsored Brands,Paused,500,2000,400";
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", "ads_template.csv");
                    document.body.appendChild(link);
                    link.click();
                  }}
                >
                  <Layers size={12} />
                  TEMPLATE
                </button>
                <button className="btn btn-sm btn-white border rounded-pill px-3 shadow-xs smallest fw-700">EXPORT</button>
              </div>
            </div>
            <div className="p-0 text-nowrap">
              <DataTable
                data={dashboardData}
                columns={['campaign', 'type', 'status', 'spend', 'clicks', 'sales', 'acos', 'roas']}
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

export default AdsReport;
