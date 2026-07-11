import { Spinner } from "@/components/Spinner";
import { LoadError } from "@/components/LoadError";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, Button, Tag, Select, Spin, Typography } from 'antd';
const { Text } = Typography;
import { RefreshCw, Download, Upload, BarChart3, ChevronUp } from 'lucide-react';
import { usePageTitle } from '../contexts/PageTitleContext';
import { useDateRange } from '../contexts/DateRangeContext';
import { adsApi, sellerApi } from '../services/api';
import ExecutiveKPIs from '../components/ads/ExecutiveKPIs';
import InsightPanel from '../components/ads/InsightPanel';
import AdsTable from '../components/ads/AdsTable';
import AdsImportModal from '../components/ads/AdsImportModal';
import Chart from 'react-apexcharts';
import { format } from 'date-fns';
import dayjs from 'dayjs';

const formatCompact = (val) => {
  if (typeof val !== 'number') return '0';
  if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
  if (val >= 1000) return (val / 1000).toFixed(1) + 'K';
  return val.toFixed(0);
};

const METRIC_MAP = {
  spend: { label: 'Ads Spend', color: '#D32F2F', type: 'currency', seriesType: 'column' },
  sales: { label: 'Ads Sales', color: '#2E7D32', type: 'currency', seriesType: 'column' },
  acos: { label: 'ACOS', color: '#C62828', type: 'percent', seriesType: 'line' },
  roas: { label: 'ROAS', color: '#E65100', type: 'ratio', seriesType: 'line' },
  orders: { label: 'Ads Orders', color: '#9333ea', type: 'number', seriesType: 'column' },
  impressions: { label: 'Impressions', color: '#94a3b8', type: 'number', seriesType: 'column' },
  clicks: { label: 'Clicks', color: '#94a3b8', type: 'number', seriesType: 'column' },
  cvr: { label: 'CVR', color: '#0d9488', type: 'percent', seriesType: 'line' },
  ctr: { label: 'CTR', color: '#9C27B0', type: 'percent', seriesType: 'line' },
};

const normalizeDateStr = (dateInput) => {
  if (!dateInput) return '';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return typeof dateInput === 'string' ? dateInput.substring(0, 10) : '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  } catch (e) { return ''; }
};

const generateHistoryStructureFromDates = (sortedDates) => {
  if (!sortedDates || sortedDates.length === 0) return [{ label: 'N/A', dates: [] }];
  const recentDates = sortedDates.slice(-7);
  return [{
    label: 'Last 7 Days',
    dates: recentDates.map(dateStr => {
      const date = new Date(dateStr + 'T00:00:00');
      return {
        raw: dateStr,
        label: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        day: date.toLocaleDateString('en-IN', { day: '2-digit' }),
        month: date.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase()
      };
    })
  }];
};

export default function AdsManagerPage() {
  const { setPageTitle } = usePageTitle();
  const { startDate, endDate, updateDateRange } = useDateRange();

  useEffect(() => { setPageTitle('Ads Manager'); }, [setPageTitle]);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [globalChartData, setGlobalChartData] = useState([]);
  const [groupBy, setGroupBy] = useState('asin');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeller, setSelectedSeller] = useState(() => localStorage.getItem('selectedSeller') || '');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sortBy, setSortBy] = useState('sales');
  const [sortOrder, setSortOrder] = useState('desc');
  const [showDashboardCharts, setShowDashboardCharts] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [activeHistoryRow, setActiveHistoryRow] = useState(null);
  const [chartConfigMetrics, setChartConfigMetrics] = useState(['spend', 'sales', 'acos']);
  const [expandedCols, setExpandedCols] = useState({
    totalSales: false, impressions: false, clicks: false, spend: false,
    sales: false, acos: false, tacos: false, adSalesPct: false,
    roas: false, orders: false, cvr: false, pageViews: false, organicSales: false
  });
  const [expandedParents, setExpandedParents] = useState(new Set());

  useEffect(() => { localStorage.setItem('selectedSeller', selectedSeller); }, [selectedSeller]);
  useEffect(() => { setExpandedParents(new Set()); setPage(1); }, [groupBy]);

  const toggleCol = (colKey) => setExpandedCols(prev => ({ ...prev, [colKey]: !prev[colKey] }));
  const toggleParentExpand = (key) => setExpandedParents(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const fetchSellerDropdownData = useCallback(async (pg = 1, search = '') => {
    try {
      const r = await sellerApi.getAll({ page: pg, limit: 1000, search });
      if (r.success) return { data: r.data.sellers || [], hasMore: r.data.pagination?.page < r.data.pagination?.totalPages };
    } catch (e) {}
    return { data: [], hasMore: false };
  }, []);

  const fetchSellerItem = useCallback(async (id) => {
    try { const r = await sellerApi.getById(id); if (r.success && r.seller) return r.seller; } catch (e) {}
    return null;
  }, []);

  const fetchAdsData = useCallback(async () => {
    try {
      setLoading(true);
      const params = { groupBy, search: searchQuery, page, limit: pageSize, sortBy, sortOrder };
      if (selectedSeller) params.sellerId = selectedSeller;
      if (startDate) params.startDate = format(startDate, 'yyyy-MM-dd');
      if (endDate) params.endDate = format(endDate, 'yyyy-MM-dd');
      const res = await adsApi.getAdsManagerData(params);
      if (res.success) {
        setData(res.data || []);
        setTotalCount(res.total || 0);
        setGlobalChartData(res.globalChartData || []);
      }
    } catch (err) { console.error('Failed to fetch ads data:', err); }
    finally { setLoading(false); }
  }, [groupBy, searchQuery, startDate, endDate, selectedSeller, page, pageSize, sortBy, sortOrder]);

  useEffect(() => { fetchAdsData(); }, [fetchAdsData]);

  const handleDateChange = (dates) => {
    if (dates && dates[0] && dates[1]) {
      updateDateRange({ startDate: dates[0].toDate(), endDate: dates[1].toDate(), rangeType: 'custom' });
    }
  };

  const handleSort = (field) => {
    const nextOrder = sortBy === field && sortOrder === 'desc' ? 'asc' : 'desc';
    setSortBy(field);
    setSortOrder(nextOrder);
    setPage(1);
  };

  const summaryData = useMemo(() => {
    const sum = { impressions: 0, clicks: 0, spend: 0, sales: 0, orders: 0, pageViews: 0, organicSales: 0, organicOrders: 0, totalOrders: 0 };
    data.forEach(d => {
      sum.impressions += Number(d.impressions || 0); sum.clicks += Number(d.clicks || 0);
      sum.spend += Number(d.spend || 0); sum.sales += Number(d.sales || 0);
      sum.orders += Number(d.orders || 0); sum.pageViews += Number(d.pageViews || 0);
      sum.organicSales += Number(d.organicSales || 0); sum.organicOrders += Number(d.organicOrders || 0);
    });
    sum.totalSales = sum.sales + sum.organicSales;
    sum.acos = sum.sales > 0 ? (sum.spend / sum.sales) * 100 : 0;
    sum.roas = sum.spend > 0 ? (sum.sales / sum.spend) : 0;
    sum.cvr = sum.clicks > 0 ? (sum.orders / sum.clicks) * 100 : 0;
    sum.ctr = sum.impressions > 0 ? (sum.clicks / sum.impressions) * 100 : 0;
    sum.tacos = sum.totalSales > 0 ? (sum.spend / sum.totalSales) * 100 : 0;
    sum.totalOrders = sum.orders + sum.organicOrders;
    return sum;
  }, [data]);

  const historyStructure = useMemo(() => {
    if (data.length === 0) return [{ label: 'W1', dates: [] }];
    const dateMap = new Map();
    data.forEach(row => { if (row.weekHistory) row.weekHistory.forEach(h => { const dk = normalizeDateStr(h.date); if (dk) dateMap.set(dk, true); }); });
    return generateHistoryStructureFromDates(Array.from(dateMap.keys()).sort());
  }, [data]);
  const activeDates = historyStructure[0]?.dates || [];

  const dynamicChartState = useMemo(() => {
    if (!globalChartData || globalChartData.length === 0) return { series: [], yaxis: [], colors: [] };
    const series = chartConfigMetrics.map(mk => {
      const c = METRIC_MAP[mk];
      return { name: c.label, type: c.seriesType, data: globalChartData.map(d => Number(d[mk] || 0).toFixed(c.type === 'currency' ? 2 : c.type === 'number' ? 0 : 2)) };
    });
    const colors = chartConfigMetrics.map(m => METRIC_MAP[m].color);
    const yaxis = chartConfigMetrics.map((mk, idx) => {
      const c = METRIC_MAP[mk]; const isP = ['percent', 'ratio'].includes(c.type); const isC = c.type === 'currency';
      const firstN = chartConfigMetrics.findIndex(k => !['percent', 'ratio'].includes(METRIC_MAP[k].type));
      const firstP = chartConfigMetrics.findIndex(k => ['percent', 'ratio'].includes(METRIC_MAP[k].type));
      const show = idx === firstN || idx === firstP;
      return { seriesName: c.label, opposite: isP, show, axisTicks: { show: false }, axisBorder: { show: false },
        title: { style: { fontSize: '9px', fontWeight: 600, color: c.color } },
        labels: { show, style: { fontSize: '10px', fontWeight: 500, colors: '#64748b' },
          formatter: (v) => { const val = Number(v); if (isP) return val.toFixed(1) + '%'; if (isC) { if (val >= 100000) return (val / 100000).toFixed(1) + 'L'; if (val >= 1000) return (val / 1000).toFixed(1) + 'k'; return val.toFixed(0); } return val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val.toFixed(0); } }
      };
    });
    return { series, yaxis, colors };
  }, [chartConfigMetrics, globalChartData]);

  const btnStyle = { borderRadius: 8, fontWeight: 600, fontSize: 11, height: 32 };

  if (loading && !data.length) return <Spinner />;

  return (
    <div style={{ background: '#f4f5f7', minHeight: '100%', padding: '16px 24px' }}>
      <AdsImportModal isOpen={showImportModal} onClose={() => setShowImportModal(false)} selectedSeller={selectedSeller} onComplete={() => { setShowImportModal(false); fetchAdsData(); }} />

      <ExecutiveKPIs data={data} />
      <InsightPanel data={data} />

      {/* FILTERS */}
      <Card size="small" style={{ marginBottom: 16, borderRadius: 10 }} styles={{ body: { padding: '12px 16px' } }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <input placeholder="Search ASIN, SKU..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            style={{ width: 220, height: 32, borderRadius: 8, border: '1px solid #d9d9d9', padding: '0 11px', fontSize: 12, outline: 'none' }} />
          <select value={groupBy} onChange={e => setGroupBy(e.target.value)}
            style={{ height: 32, borderRadius: 8, border: '1px solid #d9d9d9', padding: '0 11px', fontSize: 12, outline: 'none', background: '#fff' }}>
            <option value="asin">ASIN Level</option>
            <option value="parent">Parent Level</option>
          </select>
          <input type="date" value={startDate ? format(startDate, 'yyyy-MM-dd') : ''} onChange={e => { if (e.target.value) { const d = new Date(e.target.value); handleDateChange([dayjs(d), dayjs(d)]); } }}
            style={{ height: 32, borderRadius: 8, border: '1px solid #d9d9d9', padding: '0 11px', fontSize: 12, outline: 'none' }} />
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <Button onClick={fetchAdsData} loading={loading} icon={<RefreshCw size={13} />} style={btnStyle}>Refresh</Button>
            <Button type="primary" onClick={() => setShowImportModal(true)} icon={<Download size={13} />} style={btnStyle}>Import</Button>
          </div>
        </div>
      </Card>

      {/* KPI STRIP */}
      <div style={{ marginBottom: 16, overflow: 'hidden', background: '#f8fafc', border: '1px solid #e4e4e7', borderRadius: 8, padding: '8px 16px', display: 'flex', gap: 8, overflowX: 'auto' }}>
        {[
          { label: 'Ads Spend', key: 'spend', color: '#D32F2F' },
          { label: 'Ads Sales', key: 'sales', color: '#15803d' },
          { label: 'ACOS', key: 'acos', color: '#b91c1c' },
          { label: 'ROAS', key: 'roas', color: '#a16207' },
          { label: 'Orders', key: 'orders', color: '#6d28d9' },
        ].map((kpi, idx) => (
          <div key={idx} style={{ height: 32, minWidth: 'max-content', flexShrink: 0, borderRadius: 4, border: '1px solid #e5e7eb', background: '#ffffff', display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: kpi.color }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: kpi.color }}>{kpi.label}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>{formatCompact(summaryData[kpi.key] || 0)}</span>
          </div>
        ))}
      </div>

      {/* CHART */}
      {showDashboardCharts && (
        <Card size="small" style={{ marginBottom: 16, borderRadius: 10 }} styles={{ body: { padding: '10px 14px' } }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 8, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 3, height: 14, background: '#D32F2F', borderRadius: 2 }} />
              <Text strong style={{ color: '#0f172a', fontSize: 13 }}>Campaign Trends</Text>
            </div>
            <Select mode="multiple" value={chartConfigMetrics} onChange={setChartConfigMetrics}
              style={{ minWidth: 200, maxWidth: 320 }} size="small" placeholder="Select metrics"
              maxTagCount="responsive"
              options={Object.keys(METRIC_MAP).map(k => ({ label: METRIC_MAP[k].label, value: k }))}
            />
          </div>
          <div style={{ height: 320 }}>
            {dynamicChartState.series.length > 0 ? (
              <Chart height="100%" type="line" series={dynamicChartState.series}
                options={{
                  chart: { type: 'line', toolbar: { show: false }, zoom: { enabled: false }, fontFamily: 'Inter, system-ui, sans-serif' },
                  stroke: { width: dynamicChartState.series.map(s => s.type === 'line' ? 2.5 : 0), curve: 'smooth' },
                  colors: dynamicChartState.colors,
                  dataLabels: { enabled: false },
                  xaxis: { categories: globalChartData.map(d => new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })), axisBorder: { show: false }, axisTicks: { show: false }, labels: { style: { colors: '#64748b', fontWeight: 600, fontSize: '10px' } } },
                  yaxis: dynamicChartState.yaxis,
                  grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
                  legend: { show: true, position: 'top', horizontalAlign: 'center', fontWeight: 700, fontSize: '10px' },
                  tooltip: { shared: true, intersect: false, theme: 'light' }
                }}
              />
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 12 }}>Select metrics to view chart</div>
            )}
          </div>
        </Card>
      )}

      {/* TOGGLE BAR */}
      <div style={{ background: '#ffffff', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Button type={showDashboardCharts ? 'primary' : 'default'} icon={showDashboardCharts ? <ChevronUp size={13} /> : <BarChart3 size={13} />}
          onClick={() => setShowDashboardCharts(!showDashboardCharts)} style={btnStyle}>
          {showDashboardCharts ? 'Hide Analytics' : 'View Analytics'}
        </Button>
        <span style={{ fontSize: 10, fontWeight: 600, color: '#64748b', background: '#f8fafc', border: '1px solid #e5e7eb', padding: '4px 12px', borderRadius: 20 }}>
          Showing <span style={{ color: '#0f172a', fontWeight: 700 }}>{data.length}</span> of <span style={{ color: '#0f172a', fontWeight: 700 }}>{totalCount}</span>
        </span>
      </div>

      {/* TABLE */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
        <AdsTable
          data={data}
          loading={loading}
          groupBy={groupBy}
          pagination={{ page, limit: pageSize, total: totalCount, totalPages: Math.ceil(totalCount / pageSize) }}
          sortBy={sortBy}
          sortOrder={sortOrder}
          selectedSeller={selectedSeller}
          activeDates={activeDates}
          expandedCols={expandedCols}
          expandedParents={expandedParents}
          onSort={handleSort}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
          onExpandCol={toggleCol}
          onExpandParent={toggleParentExpand}
          onSetActiveHistoryRow={setActiveHistoryRow}
        />
      </div>
    </div>
  );
}
