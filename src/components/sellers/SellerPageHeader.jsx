import React from 'react';
import { Button, Space, Tooltip } from 'antd';
import {
  PlusOutlined, DownloadOutlined, ThunderboltOutlined, ReloadOutlined
} from '@ant-design/icons';

const btnStyle = {
  borderRadius: 'var(--radius-md, 8px)',
  fontWeight: 600,
  fontSize: 'var(--font-size-xs)',
  height: 30,
  borderColor: 'var(--border-light, #d9e6e9)',
  color: 'var(--text-primary, #0f172a)',
  background: '#fff',
};

const SellerPageHeader = ({
  totalItems,
  onOpenAddStore,
  onOpenCsvImport,
  globalSyncing,
  handleGlobalLiveSync,
  onRestartOctoparse,
  isBrandManager,
}) => {
  return (
    <div style={{
      padding: '16px 28px 14px', background: '#ffffff', borderBottom: '1px solid var(--border-light, #d9e6e9)',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 12,
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary, #0f172a)', lineHeight: '20px' }}>
            Seller Management
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted, #94a3b8)', marginTop: 2 }}>
            {totalItems} storefront{totalItems === 1 ? '' : 's'}
          </div>
        </div>

        <Space size={8} wrap>
          {!isBrandManager && (
            <>
              <Button icon={<DownloadOutlined />} onClick={onOpenCsvImport} size="small" style={btnStyle}>
                Import CSV
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={onOpenAddStore}
                size="small"
                style={{
                  borderRadius: 'var(--radius-md, 8px)', fontWeight: 600, fontSize: 'var(--font-size-xs)', height: 30,
                  background: '#D32F2F', borderColor: '#D32F2F',
                }}>
                Add Store
              </Button>
            </>
          )}

          <Button
            icon={<ThunderboltOutlined />} onClick={handleGlobalLiveSync}
            size="small" loading={globalSyncing} disabled={globalSyncing}
            style={btnStyle}
          >
            {globalSyncing ? 'Syncing…' : 'Sync All Brands'}
          </Button>

          <Tooltip title="Stops all Octoparse tasks, clears locks, and restarts fresh scraping for every active seller">
            <Button icon={<ReloadOutlined />} onClick={onRestartOctoparse} size="small" style={btnStyle}>
              Restart Octoparse
            </Button>
          </Tooltip>
        </Space>
      </div>
    </div>
  );
};

export default SellerPageHeader;