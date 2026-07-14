import React from 'react';
import { Button, Space, Dropdown, Tooltip } from 'antd';
import {
  PlusOutlined, DownloadOutlined, EllipsisOutlined, ThunderboltOutlined, ReloadOutlined
} from '@ant-design/icons';

const SellerPageHeader = ({
  totalItems,
  onOpenAddStore,
  onOpenCsvImport,
  globalSyncing,
  handleGlobalLiveSync,
  onRestartOctoparse,
  isBrandManager,
}) => {
  const moreMenuItems = [
    ...(!isBrandManager ? [
      {
        key: 'add',
        icon: <PlusOutlined />,
        label: 'Add Store',
        onClick: onOpenAddStore,
      },
      {
        key: 'csv',
        icon: <DownloadOutlined />,
        label: 'Import CSV',
        onClick: onOpenCsvImport,
      },
    ] : []),
    { type: 'divider' },
    {
      key: 'sync',
      icon: <ThunderboltOutlined />,
      label: globalSyncing ? 'Syncing...' : 'Sync All Brands',
      disabled: globalSyncing,
      onClick: handleGlobalLiveSync,
    },
    {
      key: 'restart-octo',
      icon: <ReloadOutlined />,
      label: 'Restart All Octoparse',
      onClick: onRestartOctoparse,
    },
  ];

  return (
    <div style={{
      padding: '14px 28px 10px', background: '#ffffff', borderBottom: '1px solid var(--border-light, #d9e6e9)',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
        flexWrap: 'wrap', gap: 8,
      }}>
        <Space size={6}>
          {!isBrandManager && (
            <>
              <Button icon={<DownloadOutlined />} size="small"
                style={{ borderRadius: 'var(--radius-md, 8px)', fontWeight: 600, fontSize: 'var(--font-size-xs)', borderColor: 'var(--border-light, #d9e6e9)', height: 28 }}>
                Export
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={onOpenAddStore}
                size="small"
                style={{
                  borderRadius: 'var(--radius-md, 8px)', fontWeight: 600, fontSize: 'var(--font-size-xs)', height: 28,
                  background: 'linear-gradient(135deg, #d94033, #D32F2F)',
                  borderColor: '#d94033',
                }}>
                Add Store
              </Button>
            </>
          )}
          <Dropdown menu={{ items: moreMenuItems }} trigger={['click']} placement="bottomRight">
            <Button icon={<EllipsisOutlined />} size="small"
              style={{ borderRadius: 'var(--radius-md, 8px)', borderColor: 'var(--border-light, #d9e6e9)', height: 28 }} />
          </Dropdown>
        </Space>
      </div>
    </div>
  );
};

export default SellerPageHeader;
