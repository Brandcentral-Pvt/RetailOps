import React from 'react';
import { Menu, Search } from 'lucide-react';
import { useSidebar } from '../../contexts/SidebarContext';
import { useHeader } from '../../contexts/HeaderContext';
import HeaderBrand from './HeaderBrand';
import SearchTrigger from './SearchTrigger';
import DateRangeSelector from './DateRangeSelector';
import CommandPalette from './CommandPalette';
import NotificationCenter from './NotificationCenter';
import DownloadDrawer from './DownloadDrawer';
import QuickActions from './QuickActions';
import UserMenu from './UserMenu';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import '../../styles/header.css';

/**
 * GlobalHeader — shared responsive application toolbar (shadcn).
 *
 * H1: shell + navigation. 64 px desktop / ~56 px mobile, white background with
 * a subtle bottom border, BrandCentral blue (#1976D2) brand accents.
 *
 * Backward compatible: DateRangeSelector / NotificationCenter / DownloadDrawer
 * still render their existing overlays (H3/H4 migrations are subsequent
 * phases) but are now hosted inside the shadcn shell.
 */
export default function GlobalHeader() {
  const { toggleMobile, isOpen } = useSidebar();
  const { setCmdOpen } = useHeader();

  return (
    <>
      <header className="global-header shadcn-header">
        {/* Mobile nav toggle — preserved SidebarContext integration */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shadcn-mobile-toggle md:hidden"
          onClick={toggleMobile}
          aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={isOpen}
          aria-controls="sidebar"
        >
          <Menu size={20} aria-hidden="true" />
        </Button>

        <HeaderBrand />

        {/* Center: search / command palette entry */}
        <div className="hidden sm:flex items-center">
          <SearchTrigger />
        </div>

        <div className="shadcn-actions flex items-center gap-2 shrink-0">
          <DateRangeSelector />
          <Separator orientation="vertical" className="h-5 w-[1px] mx-1" />
          <QuickActions />
          <NotificationCenter />
          <DownloadDrawer />
          <Separator orientation="vertical" className="h-5 w-[1px] mx-1" />
          <UserMenu />
        </div>

        {/* Mobile overflow: open command palette (functional search on mobile) */}
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

      <CommandPalette />
    </>
  );
}
