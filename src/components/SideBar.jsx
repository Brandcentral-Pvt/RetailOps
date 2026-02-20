import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Sidebar.css';

const Sidebar = () => {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();

  const navItems = [
    { path: '/dashboard', icon: 'bi-grid-3x3-gap', label: 'Dashboard', permission: 'dashboard_view' },
    { path: '/sellers', icon: 'bi-shop', label: 'Sellers', permission: 'sellers_view' },
    { path: '/asin-tracker', icon: 'bi-upc-scan', label: 'ASIN Manager', permission: 'sellers_view' },
    { path: '/scrape-tasks', icon: 'bi-cloud-download', label: 'Scrape Tasks', permission: 'scraping_view' },
    { path: '/actions', icon: 'bi-kanban', label: 'Actions', permission: 'actions_view' },
    { path: '/actions/achievement-report', icon: 'bi-bar-chart-line', label: 'Performance Report', permission: 'reports_monthly_view' },
    { path: '/activity-log', icon: 'bi-journal-text', label: 'Activity Log', permission: 'settings_view' },
    { path: '/chat', icon: 'bi-chat-dots', label: 'Direct Chat' },
    { path: '/revenue-calculator', icon: 'bi-calculator', label: 'Revenue Calculator', permission: 'calculator_view' },
    { path: '/sku-report', icon: 'bi-box-seam', label: 'SKU Report', permission: 'reports_sku_view' },
    { path: '/parent-asin-report', icon: 'bi-collection', label: 'Parent ASIN', permission: 'reports_parent_view' },
    { path: '/month-wise-report', icon: 'bi-calendar3', label: 'Monthly Report', permission: 'reports_monthly_view' },
    { path: '/ads-report', icon: 'bi-megaphone', label: 'Ads Report', permission: 'reports_ads_view' },
    { path: '/profit-loss', icon: 'bi-currency-dollar', label: 'Profit & Loss', permission: 'reports_profit_view' },
    { path: '/inventory', icon: 'bi-box-seam', label: 'Inventory', permission: 'reports_inventory_view' },
    { path: '/alerts', icon: 'bi-bell', label: 'Alerts', permission: 'dashboard_view' },
    { path: '/users', icon: 'bi-people', label: 'Users', permission: 'users_view' },
    { path: '/roles', icon: 'bi-shield-check', label: 'Roles', permission: 'roles_view' },
    { path: '/settings', icon: 'bi-gear', label: 'Settings', permission: 'settings_view' },
    { path: '/upload-export', icon: 'bi-arrow-left-right', label: 'Upload/Export', permission: 'sellers_manage_asins' },
  ];

  const filteredItems = navItems.filter(item => !item.permission || hasPermission(item.permission));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <i className="bi bi-bar-chart-fill"></i>
          </div>
          <span className="sidebar-logo-text">Seller Hub</span>
        </div>
      </div>
      <nav className="sidebar-nav">
        <ul className="nav flex-column">
          {filteredItems.map((item) => (
            <li key={item.path} className="sidebar-nav-item">
              <NavLink
                to={item.path}
                className={({ isActive }) => `sidebar-nav-link ${isActive ? 'active' : ''}`}
              >
                <span className="sidebar-nav-icon">
                  <i className={`bi ${item.icon}`}></i>
                </span>
                <span className="sidebar-nav-text">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* User Profile & Logout */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">
            <i className="bi bi-person-circle"></i>
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user?.fullName || user?.firstName || 'User'}</div>
            <div className="sidebar-user-email">{user?.email || ''}</div>
          </div>
        </div>
        <button onClick={handleLogout} className="sidebar-logout-btn" title="Logout">
          <i className="bi bi-box-arrow-right"></i>
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
