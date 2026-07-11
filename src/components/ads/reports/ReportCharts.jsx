import React, { useMemo } from 'react';
import { Card, Select, Typography, Segmented } from 'antd';
import { BarChart3, TrendingUp, PieChart } from 'lucide-react';
import Chart from 'react-apexcharts';

const { Text } = Typography;

const COLORS = ['#4F46E5', '#2E7D32', '#D32F2F', '#ED6C02', '#9C27B0', '#0288D1', '#E65100', '#0d9488'];

const ReportCharts = ({ data = [], chartType = 'bar', setChartType }) => {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return { series: [], labels: [] };

    // Aggregate by date
    const dateMap = {};
    data.forEach(d => {
      const date = new Date(d.date || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      if (!dateMap[date]) dateMap[date] = { spend: 0, sales: 0, orders: 0, impressions: 0, clicks: 0 };
      dateMap[date].spend += Number(d.spend || 0);
      dateMap[date].sales += Number(d.sales || 0);
      dateMap[date].orders += Number(d.orders || 0);
      dateMap[date].impressions += Number(d.impressions || 0);
      dateMap[date].clicks += Number(d.clicks || 0);
    });

    const labels = Object.keys(dateMap);
    const values = Object.values(dateMap);

    return {
      labels,
      series: [
        { name: 'Spend', data: values.map(v => v.spend) },
        { name: 'Sales', data: values.map(v => v.sales) },
        { name: 'Orders', data: values.map(v => v.orders) }
      ]
    };
  }, [data]);

  const barOptions = useMemo(() => ({
    chart: { type: 'bar', toolbar: { show: false }, fontFamily: 'Inter, system-ui, sans-serif' },
    colors: COLORS,
    plotOptions: { bar: { columnWidth: '60%', borderRadius: 4 } },
    dataLabels: { enabled: false },
    xaxis: { 
      categories: chartData.labels,
      labels: { style: { fontSize: '10px', fontWeight: 600 } },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: { 
      labels: { 
        style: { fontSize: '10px' },
        formatter: (v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v
      }
    },
    grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
    legend: { position: 'top', fontSize: '10px', fontWeight: 600 },
    tooltip: { shared: true, intersect: false }
  }), [chartData]);

  const lineOptions = useMemo(() => ({
    chart: { type: 'line', toolbar: { show: false }, fontFamily: 'Inter, system-ui, sans-serif' },
    colors: COLORS,
    stroke: { width: 2.5, curve: 'smooth' },
    markers: { size: 4, strokeWidth: 1 },
    dataLabels: { enabled: false },
    xaxis: { 
      categories: chartData.labels,
      labels: { style: { fontSize: '10px', fontWeight: 600 } },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: { 
      labels: { 
        style: { fontSize: '10px' },
        formatter: (v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v
      }
    },
    grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
    legend: { position: 'top', fontSize: '10px', fontWeight: 600 },
    tooltip: { shared: true, intersect: false }
  }), [chartData]);

  const stackedOptions = useMemo(() => ({
    chart: { type: 'bar', stacked: true, toolbar: { show: false }, fontFamily: 'Inter, system-ui, sans-serif' },
    colors: COLORS,
    plotOptions: { bar: { columnWidth: '60%', borderRadius: 4 } },
    dataLabels: { enabled: false },
    xaxis: { 
      categories: chartData.labels,
      labels: { style: { fontSize: '10px', fontWeight: 600 } },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: { 
      labels: { 
        style: { fontSize: '10px' },
        formatter: (v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v
      }
    },
    grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
    legend: { position: 'top', fontSize: '10px', fontWeight: 600 },
    tooltip: { shared: true, intersect: false }
  }), [chartData]);

  const options = chartType === 'bar' ? barOptions : chartType === 'line' ? lineOptions : stackedOptions;

  return (
    <Card 
      size="small"
      style={{ borderRadius: 10, marginBottom: 16 }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 3, height: 14, background: '#4F46E5', borderRadius: 2 }} />
            <Text strong style={{ fontSize: 13 }}>Performance Trends</Text>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Segmented 
              value={chartType} 
              onChange={setChartType}
              size="small"
              options={[
                { label: 'Bar', value: 'bar', icon: <BarChart3 size={12} /> },
                { label: 'Line', value: 'line', icon: <TrendingUp size={12} /> },
                { label: 'Stacked', value: 'stacked', icon: <PieChart size={12} /> }
              ]}
            />
          </div>
        </div>
      }
    >
      <div style={{ height: 350 }}>
        {chartData.series.length > 0 ? (
          <Chart height="100%" type={chartType === 'line' ? 'line' : 'bar'} series={chartData.series} options={options} />
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
            No data available for charts
          </div>
        )}
      </div>
    </Card>
  );
};

export default ReportCharts;
