import React, { useState } from 'react';
import { Card, Input, Select, Button, DatePicker, Segmented, Collapse, Tag, Space, Tooltip } from 'antd';
import { 
  Search, Filter, Calendar, RefreshCw, Download, Upload, 
  ChevronDown, X, Save, Bookmark
} from 'lucide-react';
import InfiniteScrollSelect from '../common/InfiniteScrollSelect';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const FilterChip = ({ label, value, onRemove }) => (
  <Tag 
    closable 
    onClose={onRemove}
    style={{ 
      borderRadius: 6, 
      padding: '2px 8px', 
      fontSize: 'var(--font-size-xs)',
      fontWeight: 500,
      background: '#eff6ff',
      color: '#1976D2',
      border: '1px solid #bfdbfe'
    }}
  >
    {label}: {value}
  </Tag>
);

const AdsFilters = ({
  searchQuery, setSearchQuery,
  groupBy, setGroupBy,
  startDate, endDate, handleDateChange,
  selectedSeller, setSelectedSeller,
  fetchSellerDropdownData, fetchSellerItem,
  onRefresh, onImport, loading,
  activeFilters = []
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card 
      size="small" 
      style={{ marginBottom: 16, borderRadius: 10 }} 
      styles={{ body: { padding: isExpanded ? '12px 16px' : '8px 16px' } }}
    >
      {/* Main Filter Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Input
          prefix={<Search size={14} style={{ color: '#71717a' }} />}
          placeholder="Search ASIN, SKU, product..."
          allowClear
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ width: 240, borderRadius: "var(--radius-md)" }}
          size="small"
        />
        
        <Segmented 
          value={groupBy} 
          onChange={setGroupBy}
          size="small"
          options={[
            { label: 'ASIN', value: 'asin' },
            { label: 'Parent', value: 'parent' }
          ]}
        />
        
        <RangePicker
          value={startDate && endDate ? [dayjs(startDate), dayjs(endDate)] : null}
          onChange={handleDateChange}
          format="DD MMM YYYY"
          style={{ borderRadius: "var(--radius-md)", width: 200 }}
          size="small"
          presets={[
            { label: 'Last 7 Days', value: [dayjs().subtract(6, 'day'), dayjs()] },
            { label: 'Last 30 Days', value: [dayjs().subtract(29, 'day'), dayjs()] },
            { label: 'This Month', value: [dayjs().startOf('month'), dayjs()] },
            { label: 'Last Month', value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
          ]}
        />

        <Button 
          size="small" 
          icon={<Filter size={13} />}
          onClick={() => setIsExpanded(!isExpanded)}
          style={{ borderRadius: "var(--radius-md)" }}
        >
          {isExpanded ? 'Less' : 'More'}
        </Button>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <Tooltip title="Save current filter as view">
            <Button size="small" icon={<Save size={13} />} style={{ borderRadius: "var(--radius-md)" }} />
          </Tooltip>
          <Button size="small" icon={<RefreshCw size={13} />} onClick={onRefresh} loading={loading} style={{ borderRadius: "var(--radius-md)" }}>
            Refresh
          </Button>
          <Button size="small" icon={<Download size={13} />} style={{ borderRadius: "var(--radius-md)" }}>
            Export
          </Button>
          <Button type="primary" size="small" icon={<Upload size={13} />} onClick={onImport} style={{ borderRadius: "var(--radius-md)" }}>
            Import
          </Button>
        </div>
      </div>

      {/* Expanded Filters */}
      {isExpanded && (
        <div style={{ 
          marginTop: 12, 
          paddingTop: 12, 
          borderTop: '1px solid #f4f4f5',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 10
        }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#71717a', marginBottom: 4 }}>Seller</div>
            <InfiniteScrollSelect 
              fetchData={fetchSellerDropdownData} 
              fetchItem={fetchSellerItem} 
              value={selectedSeller} 
              onSelect={setSelectedSeller} 
              placeholder="All Sellers" 
            />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#71717a', marginBottom: 4 }}>Brand</div>
            <Select size="small" placeholder="All Brands" style={{ width: '100%' }} allowClear />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#71717a', marginBottom: 4 }}>Category</div>
            <Select size="small" placeholder="All Categories" style={{ width: '100%' }} allowClear />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#71717a', marginBottom: 4 }}>Campaign Status</div>
            <Select size="small" placeholder="All Statuses" style={{ width: '100%' }} allowClear
              options={[
                { label: 'Active', value: 'active' },
                { label: 'Paused', value: 'paused' },
                { label: 'Archived', value: 'archived' }
              ]}
            />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#71717a', marginBottom: 4 }}>Target Status</div>
            <Select size="small" placeholder="All Targets" style={{ width: '100%' }} allowClear
              options={[
                { label: 'On Track', value: 'on_track' },
                { label: 'At Risk', value: 'at_risk' },
                { label: 'Behind', value: 'behind' }
              ]}
            />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#71717a', marginBottom: 4 }}>Performance</div>
            <Select size="small" placeholder="Filter by performance" style={{ width: '100%' }} allowClear
              options={[
                { label: 'High ACOS (>30%)', value: 'high_acos' },
                { label: 'Low ACOS (<20%)', value: 'low_acos' },
                { label: 'No Sales', value: 'no_sales' },
                { label: 'Top Performers', value: 'top' }
              ]}
            />
          </div>
        </div>
      )}

      {/* Active Filters */}
      {activeFilters.length > 0 && (
        <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {activeFilters.map((filter, i) => (
            <FilterChip key={i} label={filter.label} value={filter.value} onRemove={filter.onRemove} />
          ))}
          <Button type="link" size="small" icon={<X size={12} />} style={{ fontSize: 'var(--font-size-xs)', padding: 0 }}>
            Clear all
          </Button>
        </div>
      )}
    </Card>
  );
};

export default AdsFilters;
