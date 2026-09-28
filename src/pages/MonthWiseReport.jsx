import { Spinner } from "@/components/Spinner";
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import DateRangePicker from '../components/common/DateRangePicker';
import { LoadingIndicator } from '@/components/application/loading-indicator/loading-indicator';
import Chart from 'react-apexcharts';
import {
  Calendar,
  TrendingUp,
  IndianRupee,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Search,
  RefreshCw,
  PieChart,
  Filter,
  Package,
  ShoppingCart,
  Percent,
  ChevronRight,
  CalendarDays,
  LineChart,
  Trophy,
  Target
} from 'lucide-react';
import DataTable from '../components/DataTable';
import api, { asinApi, sellerApi } from '../services/api';
import { X } from 'lucide-react';
import { useDateRange } from '../contexts/DateRangeContext';
import { format } from 'date-fns';

const MonthWiseReport = () => {
  const { startDate, endDate } = useDateRange();
  const [filters, setFilters] = useState({
    searchTerm: ''
  });
  const [data, setData] = useState([]);
  const [prevData, setPrevData] = useState(null);
  const [loading, setLoading] = useState(false);

  const startStr = useMemo(() => startDate ? format(startDate, 'yyyy-MM-dd') : null, [startDate]);
  const endStr = useMemo(() => endDate ? format(endDate, 'yyyy-MM-dd') : null, [endDate]);

  const loadMonthlyData = useCallback(async () => {
    if (!startStr || !endStr) return;
    setLoading(true);
    try {
      // The endpoint aggregates by calendar year and ignores startDate/
      // endDate, so the year is derived from the range instead of being
      // left to the server default.
      const year = Number(format(endDate, 'yyyy'));
      const params = { year: String(year) };

      // Clean params: remove null/undefined/string "null"
      const cleanParams = Object.fromEntries(
        Object.entries(params).filter(([_, v]) => v !== null && v !== undefined && v !== 'null')
      );

      const query = new URLSearchParams(cleanParams).toString();
      const response = await api.get(`/data/month-wise-report?${query}`);
      const rows = response.data || [];
      const monthData = rows.map((item, idx) => ({
        id: idx + 1,
        month: item._id || item.month,
        monthNum: item.month_num,
        revenue: item.revenue || 0,
        units: item.units || 0,
        adSpend: item.ad_spend || 0,
        adSales: item.ad_sales || 0,
        aov: item.units > 0 ? (item.revenue / item.units).toFixed(2) : '0.00',
        acos: item.ad_sales > 0 ? ((item.ad_spend / item.ad_sales) * 100).toFixed(1) : '—',
        roas: item.ad_spend > 0 ? (item.ad_sales / item.ad_spend).toFixed(2) : '—',
        sessions: 0,
        conversion: '—',
        growth: '0.0'
      }));

      setData(monthData);

      // Year-over-year baseline. The current year is usually incomplete, so
      // the prior year is restricted to the same elapsed months; comparing a
      // 9-month 2026 against a full 2025 would overstate every delta.
      try {
        // Only numeric month numbers are usable for truncation. A missing or
        // non-numeric value would make Math.max() NaN and silently empty the
        // baseline, so it falls back to a full-year comparison instead.
        const monthsElapsed = rows.map(r => Number(r.month_num)).filter(n => Number.isFinite(n) && n >= 1 && n <= 12);
        const maxMonth = monthsElapsed.length ? Math.max(...monthsElapsed) : 12;
        const prevRes = await api.get(`/data/month-wise-report?year=${year - 1}`);
        const prevAll = prevRes?.data || [];
        const prevRows = prevAll.filter((r) => {
          const m = Number(r.month_num);
          if (!Number.isFinite(m)) return true;   // no month number -> keep
          return m <= maxMonth;
        });
        setPrevData(prevRows.map((item, idx) => ({
          id: idx + 1,
          month: item._id || item.month,
          monthNum: item.month_num,
          revenue: item.revenue || 0,
          units: item.units || 0,
          adSpend: item.ad_spend || 0,
          adSales: item.ad_sales || 0,
        })));
      } catch (e) {
        console.warn('Year-over-year comparison unavailable:', e.message);
        setPrevData(null);
      }
    } catch (error) {
      console.error('Failed to load monthly data:', error);
    }
    setLoading(false);
  }, [startStr, endStr, endDate]);

  useEffect(() => {
    loadMonthlyData();
  }, [loadMonthlyData]);

  // Real year-over-year deltas. Null when there is no comparable prior year
  // or the baseline is zero, so the UI can say "n/a" instead of inventing 0%.
  const pct = useCallback((cur, prior) => {
    const p = Number(prior);
    if (!p || !Number.isFinite(p)) return null;
    return ((Number(cur) - p) / Math.abs(p)) * 100;
  }, []);

  const kpis = useMemo(() => {
    const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);
    const totalUnits = data.reduce((sum, item) => sum + item.units, 0);
    const adSpend = data.reduce((sum, item) => sum + item.adSpend, 0);
    const adSales = data.reduce((sum, item) => sum + item.adSales, 0);
    const acos = adSales > 0 ? ((adSpend / adSales) * 100).toFixed(1) : null;
    const roas = adSpend > 0 ? (adSales / adSpend).toFixed(2) : null;

    let deltas = null;
    if (prevData) {
      const pRevenue = prevData.reduce((s, i) => s + i.revenue, 0);
      const pUnits = prevData.reduce((s, i) => s + i.units, 0);
      const pAdSpend = prevData.reduce((s, i) => s + i.adSpend, 0);
      const pAdSales = prevData.reduce((s, i) => s + i.adSales, 0);
      const pAcos = pAdSales > 0 ? (pAdSpend / pAdSales) * 100 : null;
      const pRoas = pAdSpend > 0 ? pAdSales / pAdSpend : null;
      deltas = {
        revenue: pct(totalRevenue, pRevenue),
        units: pct(totalUnits, pUnits),
        acos: pct(acos, pAcos),
        roas: pct(roas, pRoas),
      };
    }

    return [
      { title: 'Annual Revenue', value: `₹${totalRevenue.toLocaleString()}`, icon: IndianRupee, color: '#4F46E5', delta: deltas?.revenue, inv: false },
      { title: 'Portfolio Units', value: totalUnits.toLocaleString(), icon: Package, color: '#8B5CF6', delta: deltas?.units, inv: false },
      { title: 'Mean ACoS', value: acos === null ? '—' : `${acos}%`, icon: Target, color: '#EC4899', delta: deltas?.acos, inv: true },
      { title: 'Portfolio ROAS', value: roas === null ? '—' : `${roas}x`, icon: Trophy, color: '#10B981', delta: deltas?.roas, inv: false },
    ];
  }, [data, prevData, pct]);

  const filteredData = useMemo(() => {
    return data.filter(item =>
      filters.searchTerm === '' || item.month.toLowerCase().includes(filters.searchTerm.toLowerCase())
    );
  }, [data, filters]);

  const dashboardData = useMemo(() => {
    return filteredData.map(item => ({
      ...item,
      month: <span className="fw-700 text-primary">{item.month}</span>,
      revenue: <span className="fw-600">₹{item.revenue.toLocaleString()}</span>,
      units: <span className="fw-600 text-dark">{item.units.toLocaleString()}</span>,
      acos: (
        <span className="fw-700" style={{ color: parseFloat(item.acos) < 20 ? '#2E7D32' : '#ED6C02' }}>
          {item.acos}%
        </span>
      ),
      growth: (
        <span className={`smallest fw-700 ${parseFloat(item.growth) >= 0 ? 'text-success' : 'text-danger'}`}>
          {parseFloat(item.growth) >= 0 ? '↑' : '↓'} {Math.abs(item.growth)}%
        </span>
      )
    }));
  }, [filteredData]);

  const trendChartOptions = {
    chart: { type: 'area', toolbar: { show: false }, background: 'transparent' },
    colors: ['#4F46E5', '#10B981'],
    stroke: { curve: 'smooth', width: 2 },
    fill: { type: 'gradient', gradient: { opacityFrom: 0.4, opacityTo: 0.05 } },
    dataLabels: { enabled: false },
    xaxis: { categories: [...data].reverse().map(d => d.month.split(' ')[0]), labels: { style: { colors: '#64748b', fontWeight: 600 } } },
    yaxis: { labels: { formatter: (val) => `₹${(val / 100000).toFixed(1)}L` } },
    tooltip: { theme: 'light', y: { formatter: (val) => `₹${val.toLocaleString()}` } },
    grid: { show: true, borderColor: '#f1f5f9', strokeDashArray: 4 }
  };

  const MetricPill = ({ title, value, icon: Icon, color, delta, inv }) => {
    const hasDelta = delta !== null && delta !== undefined;
    const pos = hasDelta && delta > 0;
    const flat = hasDelta && Math.abs(delta) < 0.05;
    const good = inv ? !pos : pos;
    // Flat deltas read as "0.0%", never "-0.0%".
    const label = !hasDelta
      ? null
      : flat
        ? '0.0%'
        : `${pos ? '+' : ''}${delta.toFixed(1)}%`;
    const color_ = !hasDelta || flat ? '#8c8e8f' : good ? '#2E7D32' : '#D32F2F';
    return (
      <div className="stat-pill">
        <div className="stat-pill-icon" style={{ backgroundColor: `${color}15`, color: color }}>
          <Icon size={14} />
        </div>
        <div>
          <div className="stat-pill-label">
            {title}{' '}
            <span
              className="ms-1"
              style={{ fontSize: '9px', color: color_ }}
              title={hasDelta ? 'Compared with the same elapsed months last year' : 'No comparable prior year'}
            >
              {hasDelta ? (
                <>
                  <span aria-hidden="true">{label}</span>
                  <span className="sr-only">{flat ? 'unchanged' : pos ? 'up' : 'down'} versus same period last year</span>
                </>
              ) : (
                <span>n/a</span>
              )}
            </span>
          </div>
          <div className="stat-pill-value">{value}</div>
        </div>
      </div>
    );
  };

  const DashboardCard = ({ title, icon: Icon, children, extra }) => (
    <div className="glass-card h-100" style={{ borderRadius: '20px', padding: '1.25rem' }}>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h6 className="mb-0 d-flex align-items-center gap-2 fw-bold text-dark">
          <Icon size={18} className="text-secondary" />
          {title}
        </h6>
        {extra}
      </div>
      {children}
    </div>
  );

  if (loading && data.length === 0) {
    return (
      <div className="dashboard-container p-4 d-flex flex-column justify-content-center align-items-center" style={{ backgroundColor: '#fdfdfd', minHeight: '100vh' }}>
        <div style={{ width: '300px', textAlign: 'center' }}>
          <p className="text-muted small mb-3 fw-600">Loading Monthly Intelligence...</p>
          <LoadingIndicator type="line-simple" size="md" />
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container p-4" style={{ backgroundColor: '#fdfdfd', minHeight: '100vh' }}>
      {loading && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}>
          <LoadingIndicator type="line-simple" size="md" />
        </div>
      )}
      <header className="mb-4">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-4">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <div className="bg-secondary text-white p-1 rounded-2"><CalendarDays size={18} /></div>
            </div>
            <p className="text-muted small mb-0">Fiscal Performance & Multi-Month Trends</p>
          </div>

          <div className="d-flex align-items-center gap-2">
            <button className="btn btn-dark btn-sm rounded-pill px-3 py-2 shadow-sm fw-700 d-flex align-items-center gap-2" onClick={loadMonthlyData}>
              {loading ? <span className="icon-[svg-spinners--eclipse]" style={{ fontSize: 14 }} aria-hidden="true" /> : <RefreshCw size={14} />}
              REFRESH
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
        {/* Trend Visualization */}
        <div className="col-lg-8">
          <DashboardCard title="Revenue Growth Trend" icon={LineChart} extra={<span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle px-3 py-1 rounded-pill smallest">FISCAL YEAR</span>}>
            <div style={{ height: '300px' }}>
              <Chart
                options={trendChartOptions}
                series={[{ name: 'Revenue', data: [...data].reverse().map(d => d.revenue) }]}
                type="area"
                height="100%"
              />
            </div>
          </DashboardCard>
        </div>

        {/* Performance Breakdown */}
        <div className="col-lg-4">
          <DashboardCard title="Conversion Efficiency" icon={Activity}>
            <div className="h-100 d-flex flex-column justify-content-center gap-4 py-2">
              {[
                { label: 'Q1 (Jan-Mar)', value: 85, color: '#4F46E5' },
                { label: 'Q2 (Apr-Jun)', value: 92, color: '#10B981' },
                { label: 'Q3 (Jul-Sep)', value: 78, color: '#F59E0B' },
                { label: 'Q4 (Oct-Dec)', value: 95, color: '#8B5CF6' }
              ].map((q, idx) => (
                <div key={idx}>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="smallest fw-800 text-muted">{q.label}</span>
                    <span className="smallest fw-800" style={{ color: q.color }}>{q.value}% Target</span>
                  </div>
                  <div className="progress" style={{ height: '6px', borderRadius: '10px' }}>
                    <div className="progress-bar" style={{ width: `${q.value}%`, backgroundColor: q.color }}></div>
                  </div>
                </div>
              ))}
            </div>
          </DashboardCard>
        </div>
      </div>

      <div className="row g-4">
        {/* Sidebar */}
        <div className="col-lg-3">
          <div className="glass-card p-4 h-100" style={{ borderRadius: '20px' }}>
            <h6 className="fw-bold mb-4 d-flex align-items-center gap-2">
              <Filter size={18} className="text-secondary" />
              Fiscal Discovery
            </h6>

            <div className="mb-4">
              <label className="smallest fw-bolder text-muted mb-2 d-block text-uppercase">Month Search</label>
              <div className="bg-light p-2 rounded-3 d-flex align-items-center">
                <Search size={14} className="text-muted me-2" />
                <input
                  type="text"
                  className="border-0 bg-transparent flex-grow-1 smallest fw-600 outline-none"
                  placeholder="E.g. Oct 2024..."
                  value={filters.searchTerm}
                  onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                />
              </div>
            </div>

            <div className="p-3 rounded-4 bg-secondary bg-opacity-10 border border-secondary border-opacity-10">
              <div className="d-flex align-items-center gap-2 mb-2">
                <Activity size={18} className="text-secondary" />
                <span className="text-secondary smallest fw-bolder">Growth Target: +25%</span>
              </div>
              <div className="progress" style={{ height: '6px', borderRadius: '10px' }}>
                <div className="progress-bar bg-secondary" style={{ width: '65%' }}></div>
              </div>
              <div className="text-muted smallest mt-2 text-center">Current Progress: 18.2%</div>
            </div>

            <div className="mt-4 pt-4 border-top">
              <button className="btn btn-outline-secondary btn-sm w-100 rounded-pill smallest fw-800 py-2">DOWNLOAD ANNEXURE</button>
            </div>
          </div>
        </div>

        {/* Ledger */}
        <div className="col-lg-9">
          <div className="glass-card shadow-sm border-0 h-100 overflow-hidden" style={{ borderRadius: '20px' }}>
            <div className="px-4 py-3 border-bottom d-flex justify-content-between align-items-center">
              <h6 className="fw-bold mb-0 d-flex align-items-center gap-2">
                <BarChart3 size={18} className="text-secondary" />
                Monthly Performance Ledger
              </h6>
              <button className="btn btn-sm btn-dark rounded-pill px-3 shadow-sm smallest fw-700">EXPORT REPORT</button>
            </div>
            <div className="p-0 text-nowrap">
              <DataTable
                data={dashboardData}
                columns={['month', 'revenue', 'units', 'acos', 'roas', 'conversion', 'growth']}
                pagination={true}
                pageSize={12}
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

export default MonthWiseReport;
