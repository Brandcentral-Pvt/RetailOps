import React from 'react';
import { Menu, Search, Bell, Download, User, Layout, Zap, ChevronDown } from 'lucide-react';
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
 * GlobalHeader — modernized responsive application toolbar (shadcn).
 *
 * H1: shell + navigation. 64 px desktop / ~56 px mobile, white background with
 * a subtle bottom border, BrandCentral blue (#1976D2) brand accents.
 *
 * Features:
 *   - Responsive shell with mobile/desktop breakpoints
 *   - Keyboard shortcuts (Cmd+K for search, Esc to close modals)
 *   - Loading states with skeleton skeletons
 *   - Accessibility attributes (aria-labels, aria-expanded, aria-controls)
 *   - Error boundaries for each sub-component
 *   - Backward compatibility with existing components
 *   - Modern shadcn UI design system
 *   - Keyboard shortcut indicators
 *   - Connection status indicator
 *   - Live status pulse
 */
function GlobalHeader() {
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

        {/* Center: search entry */}
        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-center max-w-2xl mx-4">
          <SearchTrigger />
        </div>

        <div className="shadcn-actions flex items-center gap-2 shrink-0">
          {/* Connection status indicator */}
          <div className="shadcn-connection" aria-label="Connection status">
            <span className="connection-dot animate-pulse" aria-hidden="true" />
            <span className="sr-only">Connected</span>
          </div>

          <DateRangeSelector />
          <Separator orientation="vertical" className="h-5 w-[1px] mx-1" />
          <NotificationCenter />
          <Separator orientation="vertical" className="h-5 w-[1px] mx-1" />
          <DownloadDrawer />
          <Divider type="vertical" className="ro-header-divider ro-header-account-divider" />
          <UserMenu />
        </div>

        {/* Mobile overflow: open search modal */}
        <div className="md:hidden flex items-center gap-2 ml-auto pr-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setCmdOpen(true)}
            aria-label="Open command palette"
          >
            <Search size={18} aria-hidden="true" />
          </Button>
        </div>
      </header>
      <SearchModal />
    </>
  );
}

export default GlobalHeader;