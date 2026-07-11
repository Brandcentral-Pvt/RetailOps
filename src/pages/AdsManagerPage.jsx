import { Spinner } from "@/components/Spinner";
import { LoadError, EmptyState } from "@/components/LoadError";
import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { Card, Button, Tag, Select, Spin } from 'antd';
import { RefreshCw, Download, Upload, BarChart3, ChevronUp } from 'lucide-react';
import { usePageTitle } from '../contexts/PageTitleContext';
import { useAdsData } from '../hooks/useAdsData';
import { useAdsFilters } from '../hooks/useAdsFilters';
import { useAdsChart } from '../hooks/useAdsChart';
import ExecutiveKPIs from '../components/ads/ExecutiveKPIs';
import InsightPanel from '../components/ads/InsightPanel';
import AdsFilters from '../components/ads/AdsFilters';
import AdsImportModal from '../components/ads/AdsImportModal';
import Chart from 'react-apexcharts';

const AdsManagerPage = () => {
  const { setPageTitle } = usePageTitle();
  const [showImportModal, setShowImportModal] = useState(false);
  const [showChart, setShowChart] = useState(true);

  useEffect(() => {
    setPageTitle('Ads Manager');
  }, [setPageTitle]);

  const filters = useAdsFilters();
  const { data, loading, filterLoading, error, globalChartData, summary, fetchData, debouncedFetch } = useAdsData();
  const { selectedMetrics, setSelectedMetrics, chartState, chartOptions, metricOptions } = useAdsChart(globalChartData);

  const handleRefresh = useCallback(() => {
    fetchData(filters.getFilterParams(), true);
  }, [fetchData, filters.getFilterParams]);

  useEffect(() => {
    fetchData(filters.getFilterParams());
  }, [fetchData, filters.getFilterParams]);

  // Debounced filter changes
  useEffect(() => {
    debouncedFetch(filters.getFilterParams());
  }, [filters.searchQuery, filters.groupBy, filters.selectedSeller, filters.startDate, filters.endDate]);

  const btnStyle = { borderRadius: 8, fontWeight: 600, fontSize: 11, height: 32 };

  if (loading && !data.length) return <Spinner />;

  return (
    <div style={{ background: '#f4f5f7', minHeight: '100%', padding: '16px 24px' }}>
      {error && <LoadError message={error} onRetry={handleRefresh} />}

      <AdsImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        selectedSeller={filters.selectedSeller}
        onComplete={() => { setShowImportModal(false); handleRefresh(); }}
      />

      <ExecutiveKPIs data={data} />
      <InsightPanel data={data} />

      <AdsFilters
        searchQuery={filters.searchQuery}
        setSearchQuery={filters.setSearchQuery}
        groupBy={filters.groupBy}
        setGroupBy={filters.setGroupBy}
        startDate={filters.startDate}
        endDate={filters.endDate}
        handleDateChange={filters.handleDateChange}
        selectedSeller={filters.selectedSeller}
        setSelectedSeller={filters.setSelectedSeller}
        fetchSellerDropdownData={filters.fetchSellerDropdownData}
        fetchSellerItem={filters.fetchSellerItem}
        onRefresh={handleRefresh}
        onImport={() => setShowImportModal(true)}
        loading={loading || filterLoading}
      />

      <Card 
        size="small" 
        style={{ borderRadius: 10 }} 
        styles={{ body: { padding: 0 } }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 3, height: 14, background: '#4F46E5', borderRadius: 2 }} />
              <span style={{ fontWeight: 600, color: '#18181b', fontSize: 14 }}>Ads Performance</span>
              {filterLoading && <Spin size="small" style={{ marginLeft: 8 }} />}
              <Tag color="default" style={{ borderRadius: 20, fontSize: 10 }}>
                {data.length} records
              </Tag>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Select mode="multiple" value={selectedMetrics} onChange={setSelectedMetrics}
                style={{ minWidth: 200, maxWidth: 320 }} size="small" placeholder="Chart metrics"
                maxTagCount="responsive"
                options={metricOptions}
              />
              <Button size="small" icon={showChart ? <ChevronUp size={13} /> : <BarChart3 size={13} />}
                onClick={() => setShowChart(!showChart)} style={btnStyle}>
                {showChart ? 'Hide Chart' : 'Show Chart'}
              </Button>
            </div>
          </div>
        }
      >
        {showChart && (
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f4f4f5' }}>
            <div style={{ height: 280 }}>
              {chartState.series.length > 0 ? (
                <Chart height="100%" type="line" series={chartState.series} options={chartOptions} />
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 12 }}>
                  Select metrics to view chart
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ overflow: 'auto' }}>
          {data.length === 0 ? (
            <EmptyState 
              title="No ads data found"
              description="Import your ads data or adjust filters"
              action={
                <Button type="primary" onClick={() => setShowImportModal(true)} icon={<Download size={13} />} style={btnStyle}>
                  Import Data
                </Button>
              }
            />
          ) : (
            <div style={{ padding: 16, color: '#71717a', fontSize: 12 }}>
              Table data loaded — {data.length} records
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default AdsManagerPage;
