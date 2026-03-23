import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import NumberChart from '../components/common/NumberChart';
import Chart from 'react-apexcharts';
import Box from '@mui/material/Box';
import { LineChart } from '@mui/x-charts/LineChart';
import {
  Megaphone, TrendingUp, IndianRupee, Activity, Target, ArrowUpRight,
  ArrowDownRight, BarChart3, Layers, Search, RefreshCw, Calendar, FileUp,
  X, MousePointer, Eye, ShoppingCart, DollarSign, Download, ChevronLeft,
  ChevronRight, Copy, Check, ArrowUp, ArrowDown, Minus, Upload, PieChart,
  Filter, BarChart2, Settings, Percent, Zap, XCircle
} from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import api from '../services/api';
import './AdsReport.css';

// ─── Utility Helpers ────────────────────────────────────────────
const fmt = (val, prefix = '₹') => {
  if (!val || val === 0) return '—';
  const n = Number(val);
  if (isNaN(n)) return '—';
  if (n >= 10000000) return `${prefix}${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `${prefix}${(n / 100000).toFixed(2)}L`;
  if (n >= 1000) return `${prefix}${(n / 1000).toFixed(1)}K`;
  return `${prefix}${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

const fmtFull = (val, prefix = '₹') => {
  if (!val || val === 0) return '—';
  return `${prefix}${Number(val).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

const fmtPct = (val) => {
  if (!val || val === 0) return '—';
  return `${Number(val).toFixed(2)}%`;
};

const fmtX = (val) => {
  if (!val || val === 0) return '—';
  return `${Number(val).toFixed(2)}×`;
};

const fmtNum = (val) => {
  if (!val || val === 0) return '—';
  return Number(val).toLocaleString('en-IN');
};

const getDelta = (curr, prev) => {
  if (!prev || prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
};

const getDateRangeMs = (key) => {
  const day = 86400000;
  const map = { '7d': 7, '30d': 30, '90d': 90, '6m': 180, '1y': 365 };
  return map[key] ? map[key] * day : null;
};

const formatDateShort = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
};

const daysBetween = (a, b) => {
  if (!a || !b) return 0;
  return Math.ceil(Math.abs(new Date(b) - new Date(a)) / 86400000) + 1;
};

// ─── Component ──────────────────────────────────────────────────
const AdsReport = () => {
  const [data, setData] = useState([]);
  const [dailyData, setDailyData] = useState([]);
  const [prevData, setPrevData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30d');
  const [customStart, setCustomStart] = useState(null);
  const [customEnd, setCustomEnd] = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const [chartMode, setChartMode] = useState('revenue');
  const [tableSearch, setTableSearch] = useState('');
  const [perfFilter, setPerfFilter] = useState('all');
  const [sortKey, setSortKey] = useState('ad_sales');
  const [sortDir, setSortDir] = useState('desc');
  const [tablePage, setTablePage] = useState(1);
  const [drawerAsin, setDrawerAsin] = useState(null);
  const [selectedAsin, setSelectedAsin] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncDone, setSyncDone] = useState(false);
  const [copiedAsin, setCopiedAsin] = useState(false);
  const fileRef = useRef(null);
  const [reportType] = useState('daily');
  const TABLE_PAGE_SIZE = 10;

  // ─── Date Computation ───────────────────────────────────────
  const { startDate, endDate, prevStartDate, prevEndDate } = useMemo(() => {
    const now = new Date();
    let end = now.toISOString().split('T')[0];
    let start;

    if (dateRange === 'custom' && customStart) {
      start = customStart.toISOString().split('T')[0];
      if (customEnd) end = customEnd.toISOString().split('T')[0];
    } else if (dateRange === 'all') {
      start = '2020-01-01';
    } else {
      const ms = getDateRangeMs(dateRange) || 30 * 86400000;
      start = new Date(now.getTime() - ms).toISOString().split('T')[0];
    }

    const rangeDays = daysBetween(start, end);
    const pe = new Date(new Date(start).getTime() - 86400000);
    const ps = new Date(pe.getTime() - (rangeDays - 1) * 86400000);
    return { startDate: start, endDate: end, prevStartDate: ps.toISOString().split('T')[0], prevEndDate: pe.toISOString().split('T')[0] };
  }, [dateRange, customStart, customEnd]);

  // ─── Data Loading ───────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { startDate, endDate, reportType };
      if (selectedAsin) params.asin = selectedAsin;
      const res = await api.get('/data/ads-report', params);
      setData(res.data || []);
      setDailyData(res.dailyData || []);

      if (compareMode) {
        const prevParams = { startDate: prevStartDate, endDate: prevEndDate, reportType };
        const prevRes = await api.get('/data/ads-report', prevParams);
        setPrevData(prevRes.data || []);
      } else {
        setPrevData([]);
      }
    } catch (e) {
      console.error('Failed to load ads data:', e);
    }
    setLoading(false);
  }, [startDate, endDate, prevStartDate, prevEndDate, compareMode, reportType, selectedAsin]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { setTablePage(1); }, [tableSearch, perfFilter, sortKey, sortDir]);

  // ─── KPI Computation ───────────────────────────────────────
  const kpis = useMemo(() => {
    const sum = (arr, k) => arr.reduce((s, i) => s + (i[k] || 0), 0);
    const ts = sum(data, 'ad_spend'), tsa = sum(data, 'ad_sales');
    const tc = sum(data, 'clicks'), ti = sum(data, 'impressions');
    const to = sum(data, 'orders'), os = sum(data, 'organic_sales');

    const pts = sum(prevData, 'ad_spend'), ptsa = sum(prevData, 'ad_sales');
    const ptc = sum(prevData, 'clicks'), pti = sum(prevData, 'impressions');
    const pto = sum(prevData, 'orders'), pos = sum(prevData, 'organic_sales');

    const acos = tsa > 0 ? (ts / tsa) * 100 : 0;
    const roas = ts > 0 ? tsa / ts : 0;
    const ctr = ti > 0 ? (tc / ti) * 100 : 0;

    const pAcos = ptsa > 0 ? (pts / ptsa) * 100 : 0;
    const pRoas = pts > 0 ? ptsa / pts : 0;
    const pCtr = pti > 0 ? (ptc / pti) * 100 : 0;

    return [
      { label: 'Total Spend', value: fmt(ts), icon: IndianRupee, color: '#4f46e5', raw: ts, prev: pts },
      { label: 'Ad Sales', value: fmt(tsa), icon: TrendingUp, color: '#8b5cf6', raw: tsa, prev: ptsa },
      { label: 'Organic Sales', value: fmt(os), icon: ShoppingCart, color: '#10b981', raw: os, prev: pos },
      { label: 'Total Orders', value: fmtNum(to), icon: Layers, color: '#f59e0b', raw: to, prev: pto },
      { label: 'Total Clicks', value: fmtNum(tc), icon: MousePointer, color: '#06b6d4', raw: tc, prev: ptc },
      { label: 'ACoS', value: fmtPct(acos), icon: ArrowDownRight, color: '#ef4444', raw: acos, prev: pAcos, inverted: true },
      { label: 'ROAS', value: fmtX(roas), icon: ArrowUpRight, color: '#10b981', raw: roas, prev: pRoas },
      { label: 'CTR', value: fmtPct(ctr), icon: Target, color: '#4f46e5', raw: ctr, prev: pCtr },
    ];
  }, [data, prevData]);

  // ─── Budget Distribution ────────────────────────────────────
  const budgetDist = useMemo(() => {
    let zero = 0, low = 0, mid = 0, high = 0;
    data.forEach(d => {
      const s = d.ad_spend || 0;
      if (s === 0) zero++;
      else if (s < 100) low++;
      else if (s <= 500) mid++;
      else high++;
    });
    const total = data.length || 1;
    const topSpenders = [...data].sort((a, b) => (b.ad_spend || 0) - (a.ad_spend || 0));
    const top2pct = Math.max(1, Math.ceil(total * 0.02));
    const topSpend = topSpenders.slice(0, top2pct).reduce((s, d) => s + (d.ad_spend || 0), 0);
    const totalSpend = data.reduce((s, d) => s + (d.ad_spend || 0), 0) || 1;
    const top2share = ((topSpend / totalSpend) * 100).toFixed(0);
    const zeroPct = ((zero / total) * 100).toFixed(0);
    return {
      series: [zero, low, mid, high],
      labels: ['No Spend', '<₹100', '₹100–500', '>₹500'],
      insight: `Top 2% of ASINs consumed ${top2share}% of budget. ${zeroPct}% of catalog had zero ad spend.`
    };
  }, [data]);

  // ─── Efficiency Scorecard ───────────────────────────────────
  const efficiencyMetrics = useMemo(() => {
    const sum = (k) => data.reduce((s, i) => s + (i[k] || 0), 0);
    const ts = sum('ad_spend'), tsa = sum('ad_sales');
    const tc = sum('clicks'), ti = sum('impressions'), to = sum('orders');
    const roas = ts > 0 ? tsa / ts : 0;
    const acos = tsa > 0 ? (ts / tsa) * 100 : 0;
    const cpc = tc > 0 ? ts / tc : 0;
    const convRate = tc > 0 ? (to / tc) * 100 : 0;
    const ctr = ti > 0 ? (tc / ti) * 100 : 0;
    const aov = to > 0 ? tsa / to : 0;
    const bbArr = data.filter(d => d.buy_box_percentage > 0);
    const bb = bbArr.length > 0 ? bbArr.reduce((s, d) => s + d.buy_box_percentage, 0) / bbArr.length : 0;
    return [
      { label: 'ROAS', value: `${roas.toFixed(2)}×`, pct: Math.min((roas / 10) * 100, 100), benchmark: '>4×', color: roas >= 4 ? '#10b981' : roas >= 2 ? '#f59e0b' : '#ef4444' },
      { label: 'ACoS', value: `${acos.toFixed(1)}%`, pct: Math.min((acos / 50) * 100, 100), benchmark: '<15%', color: acos <= 15 ? '#10b981' : acos <= 25 ? '#f59e0b' : '#ef4444' },
      { label: 'CPC', value: `₹${cpc.toFixed(2)}`, pct: Math.min((cpc / 20) * 100, 100), benchmark: '<₹5', color: cpc <= 5 ? '#10b981' : cpc <= 10 ? '#f59e0b' : '#ef4444' },
      { label: 'Conv. Rate', value: `${convRate.toFixed(2)}%`, pct: Math.min((convRate / 5) * 100, 100), benchmark: '>1%', color: convRate >= 1 ? '#10b981' : convRate >= 0.5 ? '#f59e0b' : '#ef4444' },
      { label: 'CTR', value: `${ctr.toFixed(2)}%`, pct: Math.min((ctr / 2) * 100, 100), benchmark: '>0.5%', color: ctr >= 0.5 ? '#10b981' : ctr >= 0.2 ? '#f59e0b' : '#ef4444' },
      { label: 'AOV', value: `₹${aov.toFixed(0)}`, pct: Math.min((aov / 1000) * 100, 100), benchmark: '>₹300', color: aov >= 300 ? '#10b981' : aov >= 150 ? '#f59e0b' : '#ef4444' },
      { label: 'Buy Box', value: bb > 0 ? `${bb.toFixed(1)}%` : '—', pct: Math.min(bb, 100), benchmark: '>80%', color: bb >= 80 ? '#10b981' : bb >= 50 ? '#f59e0b' : '#ef4444' },
    ];
  }, [data]);

  // ─── Chart Config ───────────────────────────────────────────
  const chartConfig = useMemo(() => {
    const dates = dailyData.map(d => d.date);
    const base = {
      chart: { background: 'transparent', toolbar: { show: true, tools: { download: true, selection: false, zoom: true, pan: true, reset: true } }, animations: { enabled: true, easing: 'easeinout', speed: 600 } },
      grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
      xaxis: {
        categories: dates,
        axisBorder: { show: false }, axisTicks: { show: false },
        labels: { style: { colors: '#64748b', fontSize: '10px' }, rotate: -45, rotateAlways: dates.length > 14 }
      },
      legend: { position: 'top', horizontalAlign: 'right', fontSize: '11px', fontWeight: 600, labels: { colors: '#64748b' } },
      tooltip: { theme: 'light' },
      markers: { size: 3, strokeWidth: 0, hover: { size: 5 } },
      dataLabels: { enabled: false },
    };

    switch (chartMode) {
      case 'revenue':
        return {
          options: { ...base, chart: { ...base.chart, type: 'line' }, colors: ['#4F46E5', '#10B981', '#8B5CF6'],
            stroke: { curve: 'smooth', width: [2, 2, 2], dashArray: [5, 0, 0] },
            fill: { type: 'solid', opacity: [0, 0.08, 0.08] },
            yaxis: { labels: { style: { colors: '#64748b' }, formatter: v => fmt(v) } }, xaxis: base.xaxis },
          series: [
            { name: 'Ad Spend', data: dailyData.map(d => d.ad_spend || 0) },
            { name: 'Ad Sales', data: dailyData.map(d => d.ad_sales || 0) },
            { name: 'Organic Sales', data: dailyData.map(d => d.organic_sales || 0) },
          ],
          type: 'line'
        };
      case 'roas':
        return {
          options: { ...base, chart: { ...base.chart, type: 'area' }, colors: ['#10B981'],
            stroke: { curve: 'smooth', width: 2 },
            fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05 } },
            yaxis: { labels: { style: { colors: '#64748b' }, formatter: v => `${v.toFixed(1)}×` } },
            annotations: { yaxis: [
              { y: 1, borderColor: '#ef4444', strokeDashArray: 4, label: { text: 'Break-even', style: { background: '#ef4444', color: '#fff', fontSize: '10px' } } },
              { y: 5, borderColor: '#10b981', strokeDashArray: 4, label: { text: 'Target', style: { background: '#10b981', color: '#fff', fontSize: '10px' } } },
            ] }, xaxis: base.xaxis },
          series: [{ name: 'ROAS', data: dailyData.map(d => d.roas || 0) }],
          type: 'area'
        };
      case 'acos':
        return {
          options: { ...base, chart: { ...base.chart, type: 'area' }, colors: ['#F59E0B'],
            stroke: { curve: 'smooth', width: 2 },
            fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05 } },
            yaxis: { labels: { style: { colors: '#64748b' }, formatter: v => `${v.toFixed(1)}%` } },
            annotations: { yaxis: [
              { y: 15, borderColor: '#f59e0b', strokeDashArray: 4, label: { text: 'Target 15%', style: { background: '#f59e0b', color: '#fff', fontSize: '10px' } } },
            ] }, xaxis: base.xaxis },
          series: [{ name: 'ACoS', data: dailyData.map(d => d.acos || 0) }],
          type: 'area'
        };
      case 'clicks':
        return {
          options: { ...base, chart: { ...base.chart, type: 'line' }, colors: ['#4F46E5', '#06b6d4'],
            stroke: { curve: 'smooth', width: [0, 2] },
            plotOptions: { bar: { borderRadius: 3, columnWidth: '50%' } },
            yaxis: [
              { title: { text: 'Clicks', style: { color: '#64748b', fontSize: '11px' } }, labels: { style: { colors: '#64748b' }, formatter: v => fmtNum(v) } },
              { opposite: true, title: { text: 'Impressions', style: { color: '#64748b', fontSize: '11px' } }, labels: { style: { colors: '#64748b' }, formatter: v => fmt(v, '') } }
            ], xaxis: base.xaxis },
          series: [
            { name: 'Clicks', type: 'column', data: dailyData.map(d => d.clicks || 0) },
            { name: 'Impressions', type: 'line', data: dailyData.map(d => d.impressions || 0) },
          ],
          type: 'line'
        };
      case 'funnel':
        return {
          options: { ...base, chart: { ...base.chart, type: 'area', stacked: true }, colors: ['#e2e8f0', '#4F46E5', '#10B981'],
            stroke: { curve: 'smooth', width: 1 },
            fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.5, opacityTo: 0.1 } },
            yaxis: { labels: { style: { colors: '#64748b' }, formatter: v => fmtNum(v) } }, xaxis: base.xaxis },
          series: [
            { name: 'Impressions', data: dailyData.map(d => d.impressions || 0) },
            { name: 'Clicks', data: dailyData.map(d => d.clicks || 0) },
            { name: 'Orders', data: dailyData.map(d => d.orders || 0) },
          ],
          type: 'area'
        };
      default:
        return { options: base, series: [], type: 'line' };
    }
  }, [chartMode, dailyData]);

  // ─── Table Data ─────────────────────────────────────────────
  const filteredTableData = useMemo(() => {
    let rows = [...data];
    if (tableSearch) {
      const q = tableSearch.toLowerCase();
      rows = rows.filter(r => (r.asin && r.asin.toLowerCase().includes(q)) || (r.sku && r.sku.toLowerCase().includes(q)));
    }
    switch (perfFilter) {
      case 'high_roas': rows = rows.filter(r => (r.roas || 0) > 10); break;
      case 'high_acos': rows = rows.filter(r => (r.acos || 0) > 30); break;
      case 'zero_sales': rows = rows.filter(r => !r.ad_sales || r.ad_sales === 0); break;
      case 'top_spenders': rows = [...rows].sort((a, b) => (b.ad_spend || 0) - (a.ad_spend || 0)).slice(0, 20); break;
      default: break;
    }
    rows.sort((a, b) => {
      const va = a[sortKey] || 0, vb = b[sortKey] || 0;
      return sortDir === 'asc' ? va - vb : vb - va;
    });
    return rows;
  }, [data, tableSearch, perfFilter, sortKey, sortDir]);

  const pagedData = useMemo(() => {
    const start = (tablePage - 1) * TABLE_PAGE_SIZE;
    return filteredTableData.slice(start, start + TABLE_PAGE_SIZE);
  }, [filteredTableData, tablePage]);

  const totalPages = Math.ceil(filteredTableData.length / TABLE_PAGE_SIZE);

  const drawerData = useMemo(() => {
    if (!drawerAsin) return null;
    return data.find(d => d.asin === drawerAsin) || null;
  }, [drawerAsin, data]);

  // ─── Handlers ───────────────────────────────────────────────
  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const handleSync = async () => {
    setSyncing(true); await loadData(); setSyncing(false);
    setSyncDone(true); setTimeout(() => setSyncDone(false), 2000);
  };

  const handleExport = () => {
    const headers = ['ASIN', 'Spend', 'Sales', 'Orders', 'Clicks', 'Impressions', 'CTR', 'CPC', 'Conv Rate', 'ROAS', 'ACoS', 'Organic Sales', 'AOV'];
    const csvRows = [headers.join(',')];
    filteredTableData.forEach(r => {
      csvRows.push([r.asin, r.ad_spend || 0, r.ad_sales || 0, r.orders || 0, r.clicks || 0, r.impressions || 0,
        (r.ctr || 0).toFixed(2), (r.cpc || 0).toFixed(2), (r.conversion_rate || 0).toFixed(2),
        (r.roas || 0).toFixed(2), (r.acos || 0).toFixed(2), r.organic_sales || 0, (r.aov || 0).toFixed(2)].join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `ads_report_${startDate}_${endDate}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleCsvImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('reportType', 'daily');
    // Fallback date — the backend reads per-row dates from 'date'/'Date'/'Day' column first
    formData.append('date', new Date().toISOString().split('T')[0]);
    try {
      const result = await api.post('/upload/upload-ads', formData);
      const msg = [
        `✅ Import complete: ${result.processed || 0} rows processed`,
        result.skipped ? `⏭️ ${result.skipped} skipped` : '',
        result.errors ? `❌ ${result.errors} errors` : '',
      ].filter(Boolean).join('\n');
      alert(msg);
      loadData();
    } catch (err) {
      console.error('Upload failed:', err);
      alert(`❌ Upload failed: ${err.message}\n\nMake sure your CSV has columns like: ASIN, Date, Spend, Sales, Clicks, Impressions, Orders`);
    }
    setLoading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const copyAsin = (asin) => { navigator.clipboard.writeText(asin); setCopiedAsin(true); setTimeout(() => setCopiedAsin(false), 1500); };

  // ─── Table Cell Renderer ───────────────────────────────────
  const tableColumns = [
    { key: 'asin', label: 'ASIN', align: 'left' },
    { key: 'ad_spend', label: 'Spend', align: 'right' },
    { key: 'ad_sales', label: 'Sales', align: 'right' },
    { key: 'orders', label: 'Orders', align: 'right' },
    { key: 'clicks', label: 'Clicks', align: 'right' },
    { key: 'impressions', label: 'Impr.', align: 'right' },
    { key: 'ctr', label: 'CTR', align: 'right' },
    { key: 'cpc', label: 'CPC', align: 'right' },
    { key: 'conversion_rate', label: 'Conv %', align: 'right' },
    { key: 'roas', label: 'ROAS', align: 'right' },
    { key: 'acos', label: 'ACoS', align: 'right' },
    { key: 'organic_sales', label: 'Organic', align: 'right' },
    { key: 'aov', label: 'AOV', align: 'right' },
  ];

  const getCellValue = (row, key) => {
    const v = row[key];
    switch (key) {
      case 'asin': return <span className="asin-cell">{v}</span>;
      case 'ad_spend': case 'ad_sales': case 'organic_sales': case 'cpc': case 'aov': return fmtFull(v);
      case 'orders': case 'clicks': case 'impressions': return fmtNum(v);
      case 'ctr': case 'conversion_rate': return fmtPct(v);
      case 'roas': {
        const val = v || 0;
        const barW = Math.min((val / 25) * 100, 100);
        const barColor = val >= 4 ? '#10b981' : val >= 1 ? '#f59e0b' : '#ef4444';
        return (<div className="roas-bar-wrap"><span>{fmtX(val)}</span><div className="roas-bar"><div className="roas-bar-fill" style={{ width: `${barW}%`, background: barColor }} /></div></div>);
      }
      case 'acos': {
        const val = v || 0;
        const cls = val === 0 ? '' : val <= 10 ? 'acos-green' : val <= 20 ? 'acos-amber' : 'acos-red';
        return <span className={cls} style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>{val === 0 ? '—' : `${val.toFixed(1)}%`}</span>;
      }
      default: return v || '—';
    }
  };

  // ─── Config ─────────────────────────────────────────────────
  const ranges = [
    { key: '7d', label: '7D' }, { key: '30d', label: '30D' }, { key: '90d', label: '90D' },
    { key: '6m', label: '6M' }, { key: '1y', label: '1Y' }, { key: 'all', label: 'ALL' },
  ];

  const chartModes = [
    { key: 'revenue', label: 'Spend vs Sales' },
    { key: 'roas', label: 'ROAS Trend' },
    { key: 'acos', label: 'ACoS Trend' },
    { key: 'clicks', label: 'Clicks & Impr' },
    { key: 'funnel', label: 'Funnel' },
  ];

  // ─── DashboardCard (same as Dashboard.jsx) ──────────────────
  const DashboardCard = ({ title, icon: Icon, children, extra, subtitle }) => (
    <div className="glass-card shadow-sm h-100" style={{ borderRadius: '16px', padding: '1.25rem', display: 'flex', flexDirection: 'column', border: '1px solid rgba(0,0,0,0.05)' }}>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h6 className="mb-0 d-flex align-items-center gap-2 fw-800 text-dark" style={{ fontSize: '0.9rem', letterSpacing: '-0.01em' }}>
            {Icon && <Icon size={18} className="text-secondary" strokeWidth={2.5} />}
            {title}
          </h6>
          {subtitle && <p className="text-muted smallest mb-0 mt-1" style={{ fontSize: '10px' }}>{subtitle}</p>}
        </div>
        {extra}
      </div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );

  // ─── Render ─────────────────────────────────────────────────
  return (
    <div className="dashboard-container p-3" style={{ backgroundColor: '#fdfdfd', minHeight: '100vh' }}>
      {/* ══ HEADER ══════════════════════════════════════════════ */}
      <header className="mb-3">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-0">
              <div className="bg-primary text-white p-1 rounded-2"><Megaphone size={16} /></div>
              <h1 className="h5 fw-800 mb-0" style={{ letterSpacing: '-0.02em' }}>Ads Intelligence</h1>
            </div>
            <p className="text-muted smallest mb-0">Performance Analysis · {formatDateShort(startDate)} – {formatDateShort(endDate)}</p>
          </div>

          <div className="d-flex align-items-center gap-2">
            {/* Compare toggle */}
            <label className="d-flex align-items-center gap-1 smallest fw-600 text-muted" style={{ cursor: 'pointer', fontSize: '10px' }}>
              <input type="checkbox" checked={compareMode} onChange={() => setCompareMode(!compareMode)} style={{ accentColor: '#4F46E5' }} />
              COMPARE
            </label>

            {/* Import */}
            <input ref={fileRef} type="file" accept=".csv,.xlsx" onChange={handleCsvImport} style={{ display: 'none' }} />
            <button className="btn btn-white btn-sm shadow-sm border border-light rounded-pill px-2 py-1 fw-600 d-flex align-items-center gap-1" style={{ fontSize: '11px' }} onClick={() => fileRef.current?.click()}>
              <Upload size={12} /> IMPORT
            </button>

            {/* Export */}
            <button className="btn btn-white btn-sm shadow-sm border border-light rounded-pill px-2 py-1 fw-600 d-flex align-items-center gap-1" style={{ fontSize: '11px' }} onClick={handleExport}>
              <Download size={12} /> EXPORT
            </button>

            {/* Date range pills */}
            <div className="glass-card p-1 d-flex gap-1" style={{ borderRadius: '50px' }}>
              {ranges.map(r => (
                <button key={r.key}
                  className={`btn btn-sm px-2 rounded-pill border-0 transition-base ${dateRange === r.key ? 'btn-primary shadow-sm' : 'btn-light bg-transparent text-muted'}`}
                  style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px' }}
                  onClick={() => setDateRange(r.key)}
                >{r.label}</button>
              ))}
              <button
                className={`btn btn-sm px-2 rounded-pill border-0 transition-base ${dateRange === 'custom' ? 'btn-primary shadow-sm' : 'btn-light bg-transparent text-muted'}`}
                style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px' }}
                onClick={() => setDateRange('custom')}
              ><Calendar size={10} /></button>
            </div>

            {dateRange === 'custom' && (
              <div className="d-flex align-items-center bg-white border rounded-pill px-3 py-1 shadow-sm" style={{ height: '32px' }}>
                <Calendar size={12} className="text-muted me-2" />
                <DatePicker selectsRange startDate={customStart} endDate={customEnd}
                  onChange={([s, e]) => { setCustomStart(s); setCustomEnd(e); }}
                  dateFormat="MMM d, yyyy" placeholderText="Select range" isClearable
                  className="border-0 bg-transparent smallest fw-600 outline-none" style={{ width: '140px' }} />
              </div>
            )}

            <button className="btn btn-dark btn-sm rounded-pill px-3 py-1 shadow-sm fw-700 d-flex align-items-center gap-1" style={{ fontSize: '11px' }} onClick={handleSync}>
              <RefreshCw size={12} className={syncing ? 'spin' : ''} />
              {syncDone ? '✓ SYNCED' : 'SYNC'}
            </button>
          </div>
        </div>
      </header>

      {/* ══ PERIOD BANNER ════════════════════════════════════════ */}
      <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
        <span className="badge bg-light text-muted border px-3 py-1 rounded-pill smallest fw-600" style={{ fontSize: '10px' }}>
          <Calendar size={10} className="me-1" />
          {formatDateShort(startDate)} – {formatDateShort(endDate)} · {data.length} ASINs · {daysBetween(startDate, endDate)} days
        </span>
        {selectedAsin && (
          <button className="btn btn-xs btn-outline-danger rounded-pill px-2 py-1 d-flex align-items-center gap-1 fw-700" style={{ fontSize: '10px' }} onClick={() => setSelectedAsin(null)}>
            <XCircle size={12} /> VIEWING: {selectedAsin} — BACK TO ALL
          </button>
        )}
        {compareMode && (
          <span className="ads-compare-pill">
            vs {formatDateShort(prevStartDate)} – {formatDateShort(prevEndDate)}
          </span>
        )}
      </div>

      {/* ══ KPI CARDS ════════════════════════════════════════════ */}
      <div className="row g-3 mb-3">
        {kpis.map((k, i) => {
          const delta = compareMode ? getDelta(k.raw, k.prev) : undefined;
          const deltaType = delta !== undefined && delta !== null ? (k.inverted ? (delta < 0 ? 'positive' : 'negative') : (delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'neutral')) : undefined;
          return (
            <div key={i} className="col-md-3 col-6">
              <NumberChart
                label={k.label}
                value={k.value}
                icon={k.icon}
                color={k.color}
                delta={delta !== undefined && delta !== null ? Math.abs(delta).toFixed(1) : undefined}
                deltaType={deltaType}
              />
            </div>
          );
        })}
      </div>

      {/* ══ CHARTS ROW ═══════════════════════════════════════════ */}
      <div className="row g-3 mb-3">
        {/* Main Chart */}
        <div className="col-lg-8">
          <DashboardCard
            title={selectedAsin ? `Performance: ${selectedAsin}` : "Revenue & Efficiency"}
            icon={TrendingUp}
            extra={
              <div className="ads-chart-toggles">
                {chartModes.map(m => (
                  <button key={m.key} className={`ads-chart-toggle ${chartMode === m.key ? 'active' : ''}`} onClick={() => setChartMode(m.key)}>{m.label}</button>
                ))}
              </div>
            }
          >
            <div style={{ minHeight: '300px' }}>
              {dailyData.length > 0 ? (
                chartMode === 'revenue' ? (
                  <Box sx={{ width: '100%', height: 300 }}>
                    <LineChart
                      series={[
                        { data: dailyData.map(d => d.ad_spend || 0), label: 'Ad Spend', color: '#4F46E5' },
                        { data: dailyData.map(d => d.ad_sales || 0), label: 'Ad Sales', color: '#10B981' },
                        { data: dailyData.map(d => d.organic_sales || 0), label: 'Organic Sales', color: '#8B5CF6' },
                      ]}
                      xAxis={[{ scaleType: 'point', data: dailyData.map(d => d.date), tickLabelStyle: { fontSize: 10, fill: '#64748b' } }]}
                      yAxis={[{ width: 60, tickLabelStyle: { fontSize: 10, fill: '#64748b' }, valueFormatter: v => fmt(v) }]}
                      margin={{ right: 24, left: 8, top: 30, bottom: 30 }}
                      slotProps={{ legend: { position: { vertical: 'top', horizontal: 'right' }, labelStyle: { fontSize: 11, fill: '#475569' } } }}
                      sx={{ '.MuiLineElement-root': { strokeWidth: 2 }, '.MuiMarkElement-root': { display: 'none' } }}
                    />
                  </Box>
                ) : (
                  <Chart options={chartConfig.options} series={chartConfig.series} type={chartConfig.type} height={280} />
                )
              ) : (
                <div className="d-flex align-items-center justify-content-center h-100 text-muted smallest">No daily data available</div>
              )}
            </div>
          </DashboardCard>
        </div>

        {/* Donut */}
        <div className="col-lg-4">
          <DashboardCard title="Spend Distribution" icon={PieChart}>
            <div className="d-flex flex-column align-items-center">
              <Chart
                options={{
                  labels: budgetDist.labels,
                  colors: ['#e2e8f0', '#93c5fd', '#4F46E5', '#8B5CF6'],
                  legend: { position: 'bottom', fontSize: '11px', fontWeight: 600, labels: { colors: '#64748b' } },
                  dataLabels: { enabled: false },
                  stroke: { width: 0 },
                  plotOptions: { pie: { donut: { size: '75%', labels: { show: true, total: { show: true, label: 'TOTAL', color: '#64748b', fontSize: '11px', formatter: () => `${data.length} ASINs` } } } } },
                  tooltip: { theme: 'light' }
                }}
                series={budgetDist.series}
                type="donut" width="100%" height={240}
              />
              <div className="ads-insight">{budgetDist.insight}</div>
            </div>
          </DashboardCard>
        </div>
      </div>

      {/* ══ SCORECARD + TABLE ROW ════════════════════════════════ */}
      <div className="row g-3 mb-3">
        {/* Efficiency Scorecard */}
        <div className="col-lg-3">
          <div className="glass-card p-3 h-100" style={{ borderRadius: '16px' }}>
            <h6 className="fw-bold mb-3 d-flex align-items-center gap-2" style={{ fontSize: '0.85rem' }}>
              <Target size={16} className="text-primary" />
              Efficiency Scorecard
            </h6>
            {efficiencyMetrics.map((m, i) => (
              <div key={i} className="ads-score-row">
                <span className="ads-score-label">{m.label}</span>
                <div className="ads-score-bar-wrap">
                  <div className="ads-score-bar" style={{ width: `${m.pct}%`, background: m.color }} />
                </div>
                <span className="ads-score-value">{m.value}</span>
                <span className="ads-score-benchmark">{m.benchmark}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Product Performance Ledger */}
        <div className="col-lg-9">
          <div className="glass-card shadow-sm border-0 h-100" style={{ borderRadius: '16px', overflow: 'hidden' }}>
            <div className="px-3 py-2 border-bottom d-flex justify-content-between align-items-center">
              <h6 className="fw-bold mb-0 d-flex align-items-center gap-2" style={{ fontSize: '0.85rem' }}>
                <BarChart3 size={16} className="text-primary" />
                Product Performance Ledger
              </h6>
              <div className="d-flex gap-2">
                <button className="btn btn-sm btn-white border rounded-pill px-2 py-1 shadow-xs smallest fw-700 d-flex align-items-center gap-1" style={{ fontSize: '10px' }} onClick={handleExport}>
                  <Download size={10} /> CSV
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="ads-filter-bar">
              <div className="ads-search-box">
                <Search size={13} className="text-muted" style={{ flexShrink: 0 }} />
                <input placeholder="Search by ASIN or SKU..." value={tableSearch} onChange={e => setTableSearch(e.target.value)} />
              </div>
              <select className="ads-select" value={perfFilter} onChange={e => setPerfFilter(e.target.value)}>
                <option value="all">All Performance</option>
                <option value="high_roas">High ROAS (&gt;10×)</option>
                <option value="high_acos">High ACoS (&gt;30%)</option>
                <option value="zero_sales">Zero Sales</option>
                <option value="top_spenders">Top Spenders</option>
              </select>
            </div>

            {/* Table */}
            <div className="ads-table-wrap">
              <table className="ads-table">
                <thead>
                  <tr>
                    {tableColumns.map(col => (
                      <th key={col.key} style={{ textAlign: col.align }} onClick={() => handleSort(col.key)}>
                        {col.label}
                        <span className={`sort-icon ${sortKey === col.key ? 'active' : ''}`}>
                          {sortKey === col.key ? (sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />) : <span style={{ opacity: 0.3 }}>↕</span>}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedData.length > 0 ? pagedData.map((row, idx) => (
                    <tr key={idx} onClick={() => setDrawerAsin(row.asin)}>
                      {tableColumns.map(col => (
                        <td key={col.key} style={{ textAlign: col.align }}>{getCellValue(row, col.key)}</td>
                      ))}
                    </tr>
                  )) : (
                    <tr><td colSpan={tableColumns.length} className="text-center py-5 text-muted smallest">No data available</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {filteredTableData.length > 0 && (
              <div className="ads-pagination">
                <span className="smallest fw-700 text-muted" style={{ fontSize: '10px' }}>
                  SHOWING {Math.min(pagedData.length, TABLE_PAGE_SIZE)} OF {filteredTableData.length} ASINs
                </span>
                <div className="d-flex align-items-center gap-1">
                  <button className="ads-page-btn" disabled={tablePage <= 1} onClick={() => setTablePage(p => p - 1)}><ChevronLeft size={14} /></button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let page;
                    if (totalPages <= 5) page = i + 1;
                    else if (tablePage <= 3) page = i + 1;
                    else if (tablePage >= totalPages - 2) page = totalPages - 4 + i;
                    else page = tablePage - 2 + i;
                    return (<button key={page} className={`ads-page-btn ${tablePage === page ? 'active' : ''}`} onClick={() => setTablePage(page)}>{page}</button>);
                  })}
                  <button className="ads-page-btn" disabled={tablePage >= totalPages} onClick={() => setTablePage(p => p + 1)}><ChevronRight size={14} /></button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══ ASIN DETAIL DRAWER ═══════════════════════════════════ */}
      <div className={`ads-drawer-overlay ${drawerAsin ? 'open' : ''}`} onClick={() => setDrawerAsin(null)} />
      <div className={`ads-drawer ${drawerAsin ? 'open' : ''}`}>
        {drawerData && (
          <>
            <div className="ads-drawer-header">
              <div className="d-flex align-items-center gap-2">
                <span className="fw-800 text-primary" style={{ fontFamily: 'monospace', fontSize: '16px' }}>{drawerAsin}</span>
                <button className="btn btn-light btn-sm rounded-2 p-1" style={{ lineHeight: 1 }} onClick={() => copyAsin(drawerAsin)}>
                  {copiedAsin ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                </button>
              </div>
              <button className="btn btn-light btn-sm rounded-2 p-1" onClick={() => setDrawerAsin(null)}><X size={14} /></button>
            </div>

            {/* Sparkline */}
            <div style={{ padding: '12px 20px 0' }}>
              <div className="smallest fw-700 text-muted text-uppercase mb-2" style={{ fontSize: '9px', letterSpacing: '0.05em' }}>Daily Trend</div>
              <Chart
                options={{
                  chart: { type: 'area', sparkline: { enabled: true }, background: 'transparent' },
                  colors: ['#4F46E5', '#10B981'],
                  stroke: { curve: 'smooth', width: 2 },
                  fill: { type: 'gradient', gradient: { opacityFrom: 0.3, opacityTo: 0 } },
                  tooltip: { theme: 'light', x: { show: true }, y: { formatter: v => `₹${v?.toLocaleString() || 0}` } },
                  xaxis: { categories: dailyData.map(d => d.date) }
                }}
                series={[
                  { name: 'Spend', data: dailyData.map(d => d.ad_spend || 0) },
                  { name: 'Sales', data: dailyData.map(d => d.ad_sales || 0) },
                ]}
                type="area" height="80"
              />
            </div>

            {/* Stats Grid */}
            <div className="ads-drawer-stats">
              {[
                { label: 'Spend', value: fmtFull(drawerData.ad_spend) },
                { label: 'Sales', value: fmtFull(drawerData.ad_sales) },
                { label: 'Orders', value: fmtNum(drawerData.orders) },
                { label: 'Clicks', value: fmtNum(drawerData.clicks) },
                { label: 'Impressions', value: fmtNum(drawerData.impressions) },
                { label: 'CTR', value: fmtPct(drawerData.ctr) },
                { label: 'CPC', value: fmtFull(drawerData.cpc) },
                { label: 'Conv. Rate', value: fmtPct(drawerData.conversion_rate) },
                { label: 'ROAS', value: fmtX(drawerData.roas) },
                { label: 'ACoS', value: fmtPct(drawerData.acos) },
                { label: 'AOV', value: fmtFull(drawerData.aov) },
                { label: 'Organic Sales', value: fmtFull(drawerData.organic_sales) },
                { label: 'Same SKU Sales', value: fmtFull(drawerData.same_sku_sales) },
                { label: 'Sessions', value: fmtNum(drawerData.sessions) },
              ].map((s, i) => (
                <div key={i} className="ads-drawer-stat">
                  <div className="label">{s.label}</div>
                  <div className="value">{s.value}</div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div style={{ padding: '12px 20px 20px' }}>
              <button className="btn btn-primary w-100 rounded-3 fw-700" style={{ fontSize: '12px' }} onClick={() => { setSelectedAsin(drawerAsin); setDrawerAsin(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                View Full ASIN Report
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdsReport;
