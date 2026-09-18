import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Dropdown, Avatar, Tooltip } from 'antd';
import {
  LogOut, PanelLeftClose, PanelLeftOpen, Menu,
  Search, User, Settings, Users, KeyRound, HelpCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSidebar } from '../../contexts/SidebarContext';
import { useNavigationItems } from '../../hooks/useNavigationItems';
import { useHeader } from '../../contexts/HeaderContext';
import DateRangeSelector from '../header/DateRangeSelector';
import NotificationCenter from '../header/NotificationCenter';
import CommandPalette from '../header/CommandPalette';
import { useKeyboardShortcut, usePlatform } from '../header/headerHooks';
import '../../styles/header.css';
import './corp.css';

const SECTION_ORDER = {
  overview: { label: 'Overview', items: [] },
  catalog: { label: 'Catalog & Ads', items: [] },
  automation: { label: 'Automation & Tasks', items: [] },
  intelligence: { label: 'Analytics & Finance', items: [] },
  system: { label: 'System & Control', items: [] },
};

function CorpSidebar({ mobile }) {
  const { user, logout } = useAuth();
  const { collapsed, toggle, isMobile, isOpen, toggleMobile } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();
  const navItems = useNavigationItems();

  const closed = collapsed && !mobile;

  const sections = Object.keys(SECTION_ORDER)
    .map((key) => ({ ...SECTION_ORDER[key], items: navItems[key] || [] }))
    .filter((s) => s.items.length > 0);

  const activeItem = sections
    .flatMap((s) => s.items)
    .find((item) =>
      location.pathname === item.path ||
      (item.path !== '/' && location.pathname.startsWith(item.path))
    );

  const handleNavigate = (to) => {
    navigate(to);
    if (isMobile && isOpen) toggleMobile();
  };

  const initials = (
    (user?.firstName?.[0] || '') + (user?.lastName?.[0] || user?.firstName?.[1] || '')
  ).toUpperCase() || (user?.email?.[0] || 'U').toUpperCase();
  const displayName = user?.fullName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'User';
  const roleName = user?.role?.displayName || user?.role?.name || 'User';

  return (
    <aside className={`corp-sb ${closed ? 'corp-sb--collapsed' : ''} ${isMobile && isOpen ? 'corp-sb--mobile-open' : ''}`}>
      <div className="corp-sb__brand">
        <div className="corp-sb__brand-logo">R</div>
        {!closed && (
          <div style={{ minWidth: 0 }}>
            <div className="corp-sb__brand-name">RetailOps</div>
            <div className="corp-sb__brand-sub">Operations Console</div>
          </div>
        )}
      </div>

      <nav className="corp-sb__nav">
        {!closed && sections.map((s) => (
          <div key={s.label}>
            <div className="corp-sb__section-label">{s.label}</div>
            {s.items.map((item) => <NavItem key={item.key} item={item} active={activeItem?.key === item.key} onClick={() => handleNavigate(item.path)} />)}
          </div>
        ))}
        {closed && sections.flatMap((s) => s.items).map((item) => (
          <Tooltip key={item.key} title={item.label} placement="right">
            <div>
              <NavItem item={item} active={activeItem?.key === item.key} onClick={() => handleNavigate(item.path)} />
            </div>
          </Tooltip>
        ))}
      </nav>

      <div className="corp-sb__collapse" onClick={toggle} role="button" title={closed ? 'Expand sidebar' : 'Collapse sidebar'}>
        {closed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
      </div>

      <div className="corp-sb__user">
        <div className="corp-sb__avatar">{initials}</div>
        {!closed && (
          <>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="corp-sb__user-name">{displayName}</div>
              <div className="corp-sb__user-role">{roleName}</div>
            </div>
            <Tooltip title="Sign out">
              <button className="corp-sb__logout" onClick={() => logout && logout()} aria-label="Sign out">
                <LogOut size={15} />
              </button>
            </Tooltip>
          </>
        )}
      </div>
    </aside>
  );
}

const NavItem = ({ item, active, onClick }) => {
  const Icon = item.icon;
  return (
    <button
      type="button"
      className={`corp-sb__item ${active ? 'corp-sb__item--active' : ''}`}
      onClick={onClick}
    >
      {Icon ? <span className="corp-sb__item-icon"><Icon size={16} /></span> : null}
      {item.label !== undefined && <span className="corp-sb__item-label">{item.label}</span>}
      {item.badge !== undefined && item.badge !== null && <span className="corp-sb__item-badge">{item.badge}</span>}
    </button>
  );
};

function CorpTopbar() {
  const { user, logout } = useAuth();
  const { toggleMobile } = useSidebar();
  const { pageMeta, setCmdOpen } = useHeader();
  const navigate = useNavigate();
  const { modKey } = usePlatform();

  useKeyboardShortcut(['k'], () => setCmdOpen(true), { metaKey: true, ctrlKey: true, preventDefault: true });

  const initials = (
    (user?.firstName?.[0] || '') + (user?.lastName?.[0] || user?.firstName?.[1] || '')
  ).toUpperCase() || (user?.email?.[0] || 'U').toUpperCase();
  const displayName = user?.fullName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'User';
  const roleName = user?.role?.displayName || user?.role?.name || 'User';

  const menuItems = [
    { key: 'profile', icon: <User size={14} />, label: 'My Profile', onClick: () => navigate('/profile') },
    { key: 'team', icon: <Users size={14} />, label: 'Team & Workspace', onClick: () => navigate('/team-management') },
    { type: 'divider' },
    { key: 'settings', icon: <Settings size={14} />, label: 'Settings', onClick: () => navigate('/settings') },
    { key: 'keys', icon: <KeyRound size={14} />, label: 'API Keys', onClick: () => navigate('/api-keys') },
    { key: 'help', icon: <HelpCircle size={14} />, label: 'Help & Support' },
    { type: 'divider' },
    { key: 'logout', icon: <LogOut size={14} />, label: 'Sign out', danger: true, onClick: () => logout && logout() },
  ];

  return (
    <header className="corp-tb">
      <div className="corp-tb__left">
        <button className="corp-tb__mobile-btn" onClick={toggleMobile} aria-label="Toggle navigation">
          <Menu size={18} />
        </button>
        <div className="corp-tb__crumbs">
          {(pageMeta?.breadcrumbs || []).map((crumb, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="corp-tb__sep">/</span>}
              <span>{crumb.label}</span>
            </React.Fragment>
          ))}
        </div>
        <div className="corp-tb__title">{pageMeta?.title || 'Operations'}</div>
      </div>

      <div className="corp-tb__right">
        <button className="corp-tb__search" onClick={() => setCmdOpen(true)}>
          <Search size={14} />
          <span className="corp-tb__search-label">Search ASINs, sellers, reports...</span>
          <span className="corp-tb__kbd">{modKey} K</span>
        </button>

        <DateRangeSelector />
        <NotificationCenter />

        <div className="corp-tb__divider" />

        <div className="corp-tb__user">
          <Dropdown menu={{ items: menuItems }} placement="bottomRight" trigger={['click']}>
            <button className="corp-tb__user-btn" aria-label="Account menu">
              <Avatar
                size={32}
                style={{ background: '#1976d2', fontSize: 11, fontWeight: 600, fontFamily: 'Inter', flexShrink: 0, borderRadius: 8 }}
              >
                {initials}
              </Avatar>
              <span className="corp-tb__user-info">
                <span className="corp-tb__user-name">{displayName.split(' ')[0]}</span>
                <br />
                <span className="corp-tb__user-role">{roleName}</span>
              </span>
            </button>
          </Dropdown>
        </div>
      </div>
    </header>
  );
}

const CorpLayout = ({ children }) => {
  const { isMobile, isOpen, toggleMobile } = useSidebar();
  return (
    <div className="corp-root corp-shell">
      {isMobile && isOpen && (
        <div className="corp-sb-backdrop" onClick={toggleMobile} />
      )}
      <CorpSidebar />
      <div className="corp-main">
<CorpTopbar />
          <main className="corp-content main-content routes-container">
            {children}
          </main>
      </div>
      <CommandPalette />
    </div>
  );
};

export default CorpLayout;