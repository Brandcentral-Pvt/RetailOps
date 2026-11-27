import React from 'react';
import { Button, Divider, Tooltip } from 'antd';
import { MenuOutlined } from '@ant-design/icons';
import { useSidebar } from '../../contexts/SidebarContext';
import HeaderBrand from './HeaderBrand';
import SearchTrigger from './SearchTrigger';
import SearchModal from './SearchModal';
import DateRangeSelector from './DateRangeSelector';
import NotificationCenter from './NotificationCenter';
import DownloadDrawer from './DownloadDrawer';
import UserMenu from './UserMenu';
import './global-header-antd.css';

export default function GlobalHeader() {
  const { toggleMobile, isOpen } = useSidebar();

  return (
    <>
      <header className="global-header ro-global-header" data-testid="global-header">
        <div className="ro-header-leading">
          <Tooltip title="Toggle navigation">
            <Button
              type="text"
              className="ro-header-mobile-toggle"
              icon={<MenuOutlined />}
              onClick={toggleMobile}
              aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={Boolean(isOpen)}
              aria-controls="sidebar"
            />
          </Tooltip>
          <HeaderBrand />
        </div>
        <div className="ro-header-search"><SearchTrigger /></div>
        <div className="ro-header-actions">
          <DateRangeSelector />
          <Divider type="vertical" className="ro-header-divider" />
          <NotificationCenter />
          <DownloadDrawer />
          <Divider type="vertical" className="ro-header-divider" />
          <UserMenu />
        </div>
      </header>
      <SearchModal />
    </>
  );
}
