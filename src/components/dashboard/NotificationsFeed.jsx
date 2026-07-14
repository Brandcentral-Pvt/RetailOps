import React from 'react';
import { Typography, Badge, Button } from 'antd';
import {
  CheckCircle, AlertTriangle, Info, Bell, Clock
} from 'lucide-react';

const { Text } = Typography;

const getNotificationConfig = (type) => {
  const t = (type || '').toLowerCase();
  if (t.includes('success') || t.includes('complete') || t.includes('sync')) {
    return { icon: CheckCircle, color: 'var(--text-success, #2E7D32)', bg: 'var(--bg-success-subtle, #ecfdf5)' };
  }
  if (t.includes('warning') || t.includes('price') || t.includes('low')) {
    return { icon: AlertTriangle, color: 'var(--text-warning, #ED6C02)', bg: 'var(--bg-warning-subtle, #fffbeb)' };
  }
  if (t.includes('error') || t.includes('fail') || t.includes('alert')) {
    return { icon: Bell, color: 'var(--text-danger, #D32F2F)', bg: 'var(--bg-danger-subtle, #fef2f2)' };
  }
  return { icon: Info, color: 'var(--text-brand, #1976D2)', bg: 'var(--bg-info-subtle, #eff6ff)' };
};

const formatTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const NotificationItem = ({ notification }) => {
  const type = notification.type || notification.Type || 'info';
  const title = notification.title || notification.Type || 'Notification';
  const description = notification.description || notification.Message || '';
  const time = notification.time || notification.CreatedAt || notification.createdAt;
  const isRead = notification.read ?? notification.IsRead ?? false;

  const { icon: Icon, color, bg } = getNotificationConfig(type);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      padding: '10px 0',
      borderBottom: '1px solid var(--border-light, #f4f4f5)',
      opacity: isRead ? 0.6 : 1
    }}>
      <div style={{ width: 28, height: 28, borderRadius: 'var(--radius-md, 7px)', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={14} color={color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary, #0f172a)', display: 'block', marginBottom: 1 }}>{title}</Text>
        <Text style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary, #64748b)', display: 'block' }}>{description}</Text>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        <Text style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary, #a1a1aa)' }}>{formatTime(time)}</Text>
        {!isRead && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--bg-brand, #1976D2)' }} />}
      </div>
    </div>
  );
};

const NotificationsFeed = ({
  notifications = [],
  onMarkAllRead,
  onViewAll
}) => {
  const unreadCount = notifications.filter(n => !n.read && !n.IsRead).length;

  return (
    <div style={{
      padding: '16px 20px',
      background: 'var(--bg-primary, #fff)',
      borderRadius: 'var(--radius-xl, 16px)',
      border: '1px solid var(--border-light, #d9e6e9)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 'var(--radius-md, 8px)', background: 'var(--bg-info-subtle, #eff6ff)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bell size={14} color="var(--text-brand, #1976D2)" />
          </div>
          <Text strong style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-primary, #0f172a)' }}>Activity Feed</Text>
          {unreadCount > 0 && <Badge count={unreadCount} style={{ backgroundColor: 'var(--bg-brand, #1976D2)' }} />}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {unreadCount > 0 && (
            <Button type="link" size="small" onClick={onMarkAllRead} style={{ fontSize: 'var(--font-size-xs)', padding: 0 }}>
              Mark all read
            </Button>
          )}
          <Button type="link" size="small" onClick={onViewAll} style={{ fontSize: 'var(--font-size-xs)', padding: 0 }}>
            View All
          </Button>
        </div>
      </div>
      <div style={{ maxHeight: 320, overflowY: 'auto' }}>
        {notifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-tertiary, #a1a1aa)', fontSize: 'var(--font-size-sm)' }}>
            No recent activity
          </div>
        ) : (
          notifications.slice(0, 8).map((notification, i) => (
            <NotificationItem key={notification.Id || notification._id || i} notification={notification} />
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationsFeed;
