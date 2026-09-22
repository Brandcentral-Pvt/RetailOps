import React from 'react';
import { Menu } from '../../icons/fluent';
import { useSidebar } from '../../contexts/SidebarContext';
import HeaderBrand from './HeaderBrand';
import SearchTrigger from './SearchTrigger';
import DownloadDrawer from './DownloadDrawer';
import CommandPalette from './CommandPalette';
import DateRangeSelector from './DateRangeSelector';
import NotificationCenter from './NotificationCenter';
import QuickActions from './QuickActions';
import UserMenu from './UserMenu';
import '../../styles/header.css';

const GlobalHeader = () => {
  const { toggleMobile, isMobile, isOpen } = useSidebar();

  return (
    <>
      <header className="global-header">
        <button
          type="button"
          className="header-mobile-toggle"
          onClick={toggleMobile}
          aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={isOpen}
          aria-controls="sidebar"
        >
          <Menu size={20} aria-hidden="true" />
        </button>

        <HeaderBrand />

        <SearchTrigger />

        <div className="header-actions">
          <div className="live-status">
            <span className="live-dot" />
            <span>Live</span>
          </div>

          <div className="header-divider" />

          <DateRangeSelector />

          <div className="header-divider" />

          <DownloadDrawer />
          <QuickActions />
          <NotificationCenter />

          <div className="header-divider" />

          <UserMenu />
        </div>
      </header>

      <CommandPalette />
    </>
  );
};

export default GlobalHeader;
