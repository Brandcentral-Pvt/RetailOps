import React from 'react';
import { Input, Select, Button, Tooltip, Space, Badge, Popover } from 'antd';
import {
  SearchOutlined, ReloadOutlined, UploadOutlined,
  FilterOutlined,
} from '@ant-design/icons';

const SellerToolbar = ({
  searchQuery, onSearchChange,
  activeTab, onTabChange,
  marketplaceFilter, onMarketplaceChange,
  managerFilter, onManagerChange,
  statusFilter, onStatusChange,
  canAccessAmazon, canAccessAjio, canAccessMyntra,
  managersList,
  onRefresh, loading,
  isGlobalUser, isBrandManager,
  poolStats, onOpenPool,
  onOpenBulkImport,
  onIngestAll,
  sellersLength, totalItems,
  onReset,
  hasActiveFilters,
}) => {
  const filterCount = [activeTab !== 'all', marketplaceFilter !== 'all', managerFilter !== 'all', searchQuery].filter(Boolean).length;

  const marketplaceOptions = [
    { label: 'All Markets', value: 'all' },
    ...(canAccessAmazon ? [{ label: 'Amazon.in', value: 'amazon.in' }] : []),
    ...(canAccessAjio ? [{ label: 'Ajio', value: 'ajio' }] : []),
    ...(canAccessMyntra ? [{ label: 'Myntra', value: 'myntra' }] : []),
  ];

  const MANAGER_ROLES = ['brand_manager', 'operational_manager', 'admin', 'super_admin', 'developer'];
  const managerOptions = [
    { label: 'All Managers', value: 'all' },
    ...managersList
      .filter(m => MANAGER_ROLES.includes(m.role?.name?.toLowerCase() || ''))
      .map(m => ({ label: `${m.firstName} ${m.lastName}`, value: m._id })),
  ];

  const moreFiltersContent = (
    <div style={{ width: 260, padding: 4 }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-muted, #94a3b8)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Status</div>
        <Select
          value={statusFilter}
          onChange={onStatusChange}
          style={{ width: '100%' }}
          size="small"
          showSearch
          optionFilterProp="label"
          options={[
            { label: 'All Statuses', value: 'all' },
            { label: 'Active', value: 'Active' },
            { label: 'Paused', value: 'Paused' },
          ]}
        />
      </div>
      {isGlobalUser && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-muted, #94a3b8)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Octoparse Pool</div>
          <Button size="small" icon={<FilterOutlined />} onClick={onOpenPool} block style={{ borderRadius: 'var(--radius-md, 8px)', fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>
            Pool ({poolStats.available})
          </Button>
        </div>
      )}
      {isGlobalUser && (
        <div>
          <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-muted, #94a3b8)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Batch Sync</div>
          <Button size="small" onClick={onIngestAll} block style={{ borderRadius: 'var(--radius-md, 8px)', fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>
            Fetch Latest from Octoparse
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div style={{
      padding: '8px 28px', background: '#fcfcfd', borderBottom: '1px solid var(--border-light, #d9e6e9)',
    }}>
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between'
      }}>
        <Space wrap size={6}>
          <Input
            placeholder="Search storefronts..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            prefix={<SearchOutlined style={{ color: 'var(--text-muted, #94a3b8)', fontSize: 'var(--font-size-sm)' }} />}
            style={{ width: 220, borderRadius: 'var(--radius-md, 8px)' }}
            allowClear
            size="small"
          />

          <Select
            value={activeTab}
            onChange={v => { onTabChange(v); onStatusChange('all'); }}
            style={{ width: 130 }}
            size="small"
            showSearch
            optionFilterProp="label"
            options={[
              { label: 'All Statuses', value: 'all' },
              { label: 'Active', value: 'Active' },
              { label: 'Paused', value: 'Paused' },
            ]}
          />

          <Select
            value={marketplaceFilter}
            onChange={onMarketplaceChange}
            style={{ width: 140 }}
            size="small"
            showSearch
            optionFilterProp="label"
            options={marketplaceOptions}
          />

          <Select
            value={managerFilter}
            onChange={onManagerChange}
            style={{ width: 160 }}
            size="small"
            showSearch
            optionFilterProp="label"
            placeholder="Search managers..."
            options={managerOptions}
          />

          <Popover content={moreFiltersContent} title={null} trigger="click" placement="bottom">
            <Badge count={filterCount} size="small" offset={[-4, 4]} style={{ background: 'var(--text-danger, #D32F2F)' }}>
              <Button icon={<FilterOutlined />} size="small" style={{ borderRadius: 'var(--radius-md, 8px)', color: 'var(--text-muted, #94a3b8)' }} />
            </Badge>
          </Popover>
        </Space>

        <Space size={6}>
          {hasActiveFilters && (
            <Button type="link" size="small"
              onClick={onReset}
              style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-danger, #D32F2F)', fontWeight: 600, padding: '0 4px' }}>
              Clear filters
            </Button>
          )}

          {!isBrandManager && (
            <Tooltip title="Bulk Import">
              <Button icon={<UploadOutlined />} onClick={onOpenBulkImport}
                size="small"
                style={{ borderRadius: 'var(--radius-md, 8px)', fontWeight: 600, fontSize: 'var(--font-size-xs)', borderColor: 'var(--border-light, #d9e6e9)', height: 28 }}>
                Import
              </Button>
            </Tooltip>
          )}

          <Tooltip title="Refresh list">
            <Button
              icon={<ReloadOutlined spin={loading} />}
              onClick={onRefresh}
              size="small"
              style={{ borderRadius: 'var(--radius-md, 8px)', borderColor: 'var(--border-light, #d9e6e9)', height: 28 }}
            />
          </Tooltip>
        </Space>
      </div>

      <div style={{
        display: 'flex', justifyContent: 'flex-end', marginTop: 4,
        fontSize: 'var(--font-size-xs)', color: 'var(--text-muted, #94a3b8)', fontWeight: 500,
      }}>
        Showing {sellersLength} of {totalItems} storefronts
      </div>
    </div>
  );
};

export default SellerToolbar;
