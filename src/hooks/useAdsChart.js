import { useState, useMemo } from 'react';

const METRIC_MAP = {
  spend: { label: 'Ads Spend', color: '#D32F2F', type: 'currency', seriesType: 'column' },
  sales: { label: 'Ads Sales', color: '#2E7D32', type: 'currency', seriesType: 'column' },
  totalSales: { label: 'Total Sales', color: '#0284c7', type: 'currency', seriesType: 'column' },
  organicSales: { label: 'Organic Sales', color: '#2E7D32', type: 'currency', seriesType: 'column' },
  acos: { label: 'ACOS', color: '#C62828', type: 'percent', seriesType: 'line' },
  tacos: { label: 'TACOS', color: '#0284c7', type: 'percent', seriesType: 'line' },
  roas: { label: 'ROAS', color: '#E65100', type: 'ratio', seriesType: 'line' },
  cvr: { label: 'CVR', color: '#0d9488', type: 'percent', seriesType: 'line' },
  cpc: { label: 'CPC', color: '#ea580c', type: 'currency', seriesType: 'line' },
  ctr: { label: 'CTR', color: '#9C27B0', type: 'percent', seriesType: 'line' },
  orders: { label: 'Ads Orders', color: '#9333ea', type: 'number', seriesType: 'column' },
  organicOrders: { label: 'Organic Orders', color: '#db2777', type: 'number', seriesType: 'column' },
  totalOrders: { label: 'Total Orders', color: '#9C27B0', type: 'number', seriesType: 'column' },
  adSalesPct: { label: 'Ads Sales (%)', color: '#ea580c', type: 'percent', seriesType: 'line' },
  impressions: { label: 'Impressions', color: '#94a3b8', type: 'number', seriesType: 'column' },
  clicks: { label: 'Clicks', color: '#94a3b8', type: 'number', seriesType: 'column' }
};

export function useAdsChart(globalChartData = []) {
  const [selectedMetrics, setSelectedMetrics] = useState(['spend', 'sales', 'acos']);

  const chartState = useMemo(() => {
    if (!globalChartData || globalChartData.length === 0) {
      return { series: [], yaxis: [], colors: [], labels: [] };
    }

    const series = selectedMetrics.map(metricKey => {
      const config = METRIC_MAP[metricKey];
      return {
        name: config.label,
        type: config.seriesType,
        data: globalChartData.map(d => 
          Number(d[metricKey] || 0).toFixed(config.type === 'currency' ? 2 : config.type === 'number' ? 0 : 2)
        )
      };
    });

    const colors = selectedMetrics.map(m => METRIC_MAP[m].color);

    const labels = globalChartData.map(d => 
      new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
    );

    const yaxis = selectedMetrics.map((mKey, idx) => {
      const config = METRIC_MAP[mKey];
      const isPercent = ['percent', 'ratio'].includes(config.type);
      const isCurrency = config.type === 'currency';
      const firstNonPctIdx = selectedMetrics.findIndex(k => !['percent', 'ratio'].includes(METRIC_MAP[k].type));
      const firstPctIdx = selectedMetrics.findIndex(k => ['percent', 'ratio'].includes(METRIC_MAP[k].type));
      const shouldShow = idx === firstNonPctIdx || idx === firstPctIdx;
      
      return {
        seriesName: config.label,
        opposite: isPercent,
        show: shouldShow,
        axisTicks: { show: false },
        axisBorder: { show: false },
        title: { style: { fontSize: '9px', fontWeight: 600, color: config.color } },
        labels: {
          show: shouldShow,
          style: { fontSize: '10px', fontWeight: 500, colors: '#64748b' },
          formatter: (v) => {
            const val = Number(v);
            if (isPercent) return val.toFixed(1) + '%';
            if (isCurrency) {
              if (val >= 100000) return (val / 100000).toFixed(1) + 'L';
              if (val >= 1000) return (val / 1000).toFixed(1) + 'k';
              return val.toFixed(0);
            }
            return val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val.toFixed(0);
          }
        }
      };
    });

    return { series, yaxis, colors, labels };
  }, [selectedMetrics, globalChartData]);

  const chartOptions = useMemo(() => ({
    chart: { 
      type: 'line', 
      toolbar: { show: false }, 
      zoom: { enabled: false },
      fontFamily: 'Inter, system-ui, sans-serif'
    },
    stroke: { 
      width: chartState.series.map(s => s.type === 'line' ? 2.5 : 0), 
      curve: 'smooth' 
    },
    colors: chartState.colors,
    plotOptions: { bar: { columnWidth: '45%', borderRadius: 3 } },
    fill: { opacity: chartState.series.map(s => s.type === 'line' ? 1 : 0.85) },
    markers: { 
      size: chartState.series.map(s => s.type === 'line' ? 3 : 0), 
      strokeWidth: 1 
    },
    dataLabels: { enabled: false },
    xaxis: {
      categories: chartState.labels,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { style: { colors: '#64748b', fontWeight: 600, fontSize: '10px' } }
    },
    yaxis: chartState.yaxis,
    grid: { 
      borderColor: '#f1f5f9', 
      strokeDashArray: 4, 
      padding: { top: 5, right: 15, bottom: 10, left: 15 } 
    },
    legend: { 
      show: true, 
      position: 'top', 
      horizontalAlign: 'center', 
      fontWeight: 700, 
      fontSize: '10px', 
      markers: { radius: 2 } 
    },
    tooltip: { shared: true, intersect: false, theme: 'light' }
  }), [chartState]);

  return {
    selectedMetrics,
    setSelectedMetrics,
    chartState,
    chartOptions,
    metricOptions: Object.keys(METRIC_MAP).map(k => ({ 
      label: METRIC_MAP[k].label, 
      value: k 
    }))
  };
}

export { METRIC_MAP };
