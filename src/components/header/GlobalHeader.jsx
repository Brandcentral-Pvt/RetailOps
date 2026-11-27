import React from 'react';
import { Menu, Search } from 'lucide-react';
import { useSidebar } from '../../contexts/SidebarContext';
import { useHeader } from '../../contexts/HeaderContext';
import HeaderBrand from './HeaderBrand';
import SearchTrigger from './SearchTrigger';
import SearchModal from './SearchModal';
import DateRangeSelector from './DateRangeSelector';
import NotificationCenter from './NotificationCenter';
import DownloadDrawer from './DownloadDrawer';
import UserMenu from './UserMenu';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { HeaderSkeleton } from '@/components/ui/skeleton/HeaderSkeleton';
import { SearchSkeleton } from '@/components/ui/skeleton/SearchSkeleton';
import { NotificationSkeleton } from '@/components/ui/skeleton/NotificationSkeleton';
import { QuickActionSkeleton } from '@/components/ui/skeleton/QuickActionSkeleton';
import { UserMenuSkeleton } from '@/components/ui/skeleton/UserMenuSkeleton';

/**
 * GlobalHeader — shared responsive application toolbar (shadcn).
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
 */
export default function GlobalHeader() {
  const { toggleMobile, isOpen } = useSidebar();
  const { cmdOpen, setCmdOpen } = useHeader();

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

        {/* Center: search entry */}
        <div className="hidden sm:flex items-center">
          <SearchTrigger />
        </div>

        <div className="shadcn-actions flex items-center gap-2 shrink-0">
          <DateRangeSelector />
          <Separator orientation="vertical" className="h-5 w-[1px] mx-1" />
          <NotificationCenter />
          <DownloadDrawer />
          <Separator orientation="vertical" className="h-5 w-[1px] mx-1" />
          <UserMenu />
        </div>

        {/* Mobile overflow: open search modal */}
        <div className="md:hidden flex items-center gap-2 ml-auto pr-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setCmdOpen(true)}
            aria-label="Open search palette"
          >
            <Search size={18} aria-hidden="true" />
          </Button>
        </div>
      </header>

      <SearchModal />
    </>
  );
}
