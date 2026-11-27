import React from 'react';
import { Button, Divider, Tooltip } from 'antd';
import { MenuOutlined, SearchOutlined } from '@ant-design/icons';
import { useSidebar } from '../../contexts/SidebarContext';
import { useHeader } from '../../contexts/HeaderContext';
import HeaderBrand from './HeaderBrand';
import SearchTrigger from './SearchTrigger';
import SearchModal from './SearchModal';
import DateRangeSelector from './DateRangeSelector';
import NotificationCenter from './NotificationCenter';
import DownloadDrawer from './DownloadDrawer';
import UserMenu from './UserMenu';
import './global-header-antd.css';

/**
 * Application-wide toolbar. HeaderContext and existing drawer providers remain
 * the source of truth. Responsive controls are unique, never duplicated.
 */
export default function GlobalHeader() {
  const { toggleMobile, isOpen } = useSidebar();
  const { setCmdOpen } = useHeader();

  return (
    <>
      <header className="global-header ro-global-header" role="banner">
        <div className="ro-header-leading">
          <Tooltip title="Toggle navigation">
            <Button
              className="ro-header-mobile-toggle"
              type="text"
              icon={<MenuOutlined />}
              onClick={toggleMobile}
              aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={Boolean(isOpen)}
              aria-controls="sidebar"
            />
          </Tooltip>
          <HeaderBrand />
        </div>

        <div className="ro-header-search">
          <SearchTrigger />
        </div>

        <div className="ro-header-actions">
          <div className="ro-header-date"><DateRangeSelector /></div>
          <Tooltip title="Search">
            <Button
              type="text"
              className="ro-header-search-mobile"
              icon={<SearchOutlined />}
              onClick={() => setCmdOpen(true)}
              aria-label="Open search"
            />
          </Tooltip>
          <Divider type="vertical" className="ro-header-divider ro-header-date-divider" />
          <NotificationCenter />
          <DownloadDrawer />
          <Divider type="vertical" className="ro-header-divider ro-header-account-divider" />
          <UserMenu />
        </div>
      </header>
      <SearchModal />
    </>
  );
}
