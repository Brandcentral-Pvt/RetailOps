import React from 'react';
import { Avatar, Button, Dropdown, Space, Typography } from 'antd';
import {
  UserOutlined, SettingOutlined, LogoutOutlined, TeamOutlined,
  SearchOutlined, DownOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useHeader } from '../../contexts/HeaderContext';

const getName = (user) =>
  user?.fullName?.trim() ||
  [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
  user?.email || 'User';

export default function UserMenu({ loading = false }) {
  const { user, logout, hasPermission } = useAuth();
  const { setCmdOpen } = useHeader();
  const navigate = useNavigate();

  const name = getName(user);
  const role = typeof user?.role === 'object'
    ? (user.role?.displayName || user.role?.name || 'User')
    : (user?.role || 'User');
  const initials = name.split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase();

  const items = [
    { key: 'profile', label: 'My profile', icon: <UserOutlined /> },
    ...(hasPermission('roles_view') ? [{ key: 'team', label: 'Team & workspace', icon: <TeamOutlined /> }] : []),
    ...(hasPermission('settings_manage') ? [{ key: 'settings', label: 'Settings', icon: <SettingOutlined /> }] : []),
    { type: 'divider' },
    { key: 'search', label: 'Search & commands', icon: <SearchOutlined /> },
    { type: 'divider' },
    { key: 'logout', label: 'Sign out', icon: <LogoutOutlined />, danger: true },
  ];

  if (!user) return null;

  const handleMenu = ({ key }) => {
    if (key === 'profile') navigate('/profile');
    if (key === 'team') navigate('/team-management');
    if (key === 'settings') navigate('/settings');
    if (key === 'search') setCmdOpen(true);
    if (key === 'logout') logout?.();
  };

  return (
    <Dropdown
      trigger={['click']}
      placement="bottomRight"
      menu={{ items, onClick: handleMenu }}
      popupRender={(menu) => (
        <div className="ro-header-user-dropdown">
          <div className="ro-header-user-dropdown-intro">
            <Typography.Text strong ellipsis>{name}</Typography.Text>
            <Typography.Text type="secondary" ellipsis>{user.email || role}</Typography.Text>
          </div>
          {menu}
        </div>
      )}
    >
      <Button
        loading={loading}
        type="text"
        className="ro-header-user-trigger"
        aria-label="User menu"
        aria-haspopup="menu"
      >
        <Space size={9}>
          <Avatar size={32} className="ro-header-avatar">{initials || <UserOutlined />}</Avatar>
          <span className="ro-header-user-details">
            <span className="ro-header-user-name">{name}</span>
            <span className="ro-header-user-role">{role}</span>
          </span>
          <DownOutlined className="ro-header-user-chevron" />
        </Space>
      </Button>
    </Dropdown>
  );
}
