import React, { useState, useEffect, useMemo } from 'react';
import { Card, Segmented, Select, DatePicker, Button, Typography, Row, Col, Tabs } from 'antd';
import { 
  BarChart3, TrendingUp, ShoppingCart, Download, 
  Calendar, Filter, RefreshCw
} from 'lucide-react';
import { usePageTitle } from '../../contexts/PageTitleContext';
import { useDateRange } from '../../contexts/DateRangeContext';
import { useAdsData } from '../../hooks/useAdsData';
import { Spinner } from '@/components/Spinner';
import { LoadError } from '@/components/LoadError';
import ReportSummary from '../../components/ads/reports/ReportSummary';
import ReportCharts from '../../components/ads/reports/ReportCharts';
import MarketplaceComparison from '../../components/ads/reports/MarketplaceComparison';
import ReportExport from '../../components/ads/reports/ReportExport';
import dayjs from 'dayjs';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const AdsReportsPage = () => {
  const { setPageTitle } = usePageTitle();
  const { startDate, endDate, updateDateRange } = useDateRange();
  const [reportType, setReportType] = useState('performance');
  const [chartType, setChartType] = useState('bar');
  const [dateRange, setDateRange] = useState('30d');

  useEffect(() => {
    setPageTitle('Ads Reports');
  }, [setPageTitle]);

  const { data, loading, error, summary, fetchData } = useAdsData();

  useEffect(() => {
    const params = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    fetchData(params);
  }, [fetchData, startDate, endDate]);

  const handleDateChange = (dates) => {
    if (dates && dates[0] && dates[1]) {
      updateDateRange({
        startDate: dates[0].toDate(),
        endDate: dates[1].toDate(),
        rangeType: 'custom'
      });
    }
  };

  const btnStyle = { borderRadius: 8, fontWeight: 600, fontSize: 11, height: 32 };

  if (loading && !data.length) return <Spinner />;

  return (
    <div style={{ background: '#f4f5f7', minHeight: '100%', padding: '16px 24px' }}>
      {error && <LoadError message={error} onRetry={() => fetchData({})} />}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#18181b', margin: 0 }}>Ads Reports</h2>
          <p style={{ fontSize: 12, color: '#71717a', margin: 0, marginTop: 4 }}>Comprehensive advertising analytics and insights</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Segmented 
            value={reportType}
            onChange={setReportType}
            size="small"
            options={[
              { label: 'Performance', value: 'performance', icon: <BarChart3 size={12} /> },
              { label: 'Marketplace', value: 'marketplace', icon: <ShoppingCart size={12} /> },
              { label: 'Trend', value: 'trend', icon: <TrendingUp size={12} /> }
            ]}
          />
          <RangePicker
            value={startDate && endDate ? [dayjs(startDate), dayjs(endDate)] : null}
            onChange={handleDateChange}
            format="DD MMM YYYY"
            style={{ borderRadius: 8, width: 220 }}
            size="small"
            presets={[
              { label: 'Last 7 Days', value: [dayjs().subtract(6, 'day'), dayjs()] },
              { label: 'Last 30 Days', value: [dayjs().subtract(29, 'day'), dayjs()] },
              { label: 'This Month', value: [dayjs().startOf('month'), dayjs()] },
              { label: 'Last Month', value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
            ]}
          />
          <Button icon={<RefreshCw size={13} />} onClick={() => fetchData({})} loading={loading} style={btnStyle}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary */}
      <ReportSummary data={data} previousData={[]} />

      {/* Charts */}
      <ReportCharts data={data} chartType={chartType} setChartType={setChartType} />

      {/* Marketplace Comparison */}
      {reportType === 'marketplace' && (
        <MarketplaceComparison data={data} />
      )}

      {/* Export */}
      <ReportExport data={data} filters={{ startDate, endDate }} />
    </div>
  );
};

export default AdsReportsPage;
