import React from 'react';
import { Button, Skeleton, Tooltip } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useHeader } from '../../contexts/HeaderContext';
import { usePlatform } from './headerHooks';

export default function SearchTrigger({ loading = false }) {
  const { setCmdOpen } = useHeader();
  const { modKey } = usePlatform();
  if (loading) return <Skeleton.Input active block size="small" />;
  return (
    <Tooltip title="Search pages and commands">
      <Button
        type="default"
        className="ro-header-search-trigger"
        onClick={() => setCmdOpen(true)}
        aria-label="Open command palette"
        icon={<SearchOutlined />}
      >
        <span className="ro-header-search-label">Search pages and commands...</span>
        <kbd className="ro-header-shortcut">{modKey} K</kbd>
      </Button>
    </Tooltip>
  );
}
