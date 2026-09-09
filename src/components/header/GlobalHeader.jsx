import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import HeaderBrand from './HeaderBrand';
import SearchTrigger from './SearchTrigger';
import DownloadDrawer from './DownloadDrawer';
import CommandPalette from './CommandPalette';
import ScheduleDate from './ScheduleDate';
import NotificationCenter from './NotificationCenter';
import QuickActions from './QuickActions';
import UserMenu from './UserMenu';
import { useNavigationItems } from '../../hooks/useNavigationItems';
import '../../styles/header.css';

const GlobalHeader = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const navItems = useNavigationItems();

  const pageTabs = useMemo(() => {
    const sections = [
      navItems.overview,
      navItems.catalog,
      navItems.automation,
      navItems.intelligence,
      navItems.system,
    ].filter(Boolean);

    const activeItem = sections.flat().find((item) =>
      location.pathname === item.path ||
      (item.path !== '/' && location.pathname.startsWith(`${item.path}/`))
    );

    return {
      items: activeItem
        ? sections.find((section) => section.some((item) => item.path === activeItem.path)) || []
        : [],
      activePath: activeItem?.path,
    };
  }, [location.pathname, navItems]);

  return (
    <>
      <header className="global-header">
        <div className="header-main-row">
          <HeaderBrand />

          <SearchTrigger />

          <div className="header-actions">
            <div className="live-status">
              <span className="live-dot" />
              <span>Live</span>
            </div>

            <div className="header-divider" />

            <ScheduleDate />

            <div className="header-divider" />

            <DownloadDrawer />
            <QuickActions />
            <NotificationCenter />

            <div className="header-divider" />

            <UserMenu />
          </div>
        </div>

        {pageTabs.items.length > 0 && (
          <div className="header-tabs-scroll" role="tablist" aria-label="Page navigation">
            <div className="header-tabs">
              {pageTabs.items.map((item) => {
                const Icon = item.icon;
                const isActive = item.path === pageTabs.activePath;

                return (
                  <button
                    key={item.path}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`header-tab ${isActive ? 'is-active' : ''}`}
                    onClick={() => navigate(item.path)}
                  >
                    <Icon size={15} strokeWidth={1.8} aria-hidden="true" />
                    <span>{item.label}</span>
                    {item.badge !== undefined && (
                      <span className="header-tab-badge">{item.badge}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </header>

      <CommandPalette />
    </>
  );
};

export default GlobalHeader;
