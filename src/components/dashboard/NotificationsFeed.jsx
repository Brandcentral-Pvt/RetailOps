import React from 'react';
import { Typography, Badge, Button, Tag } from 'antd';
import { 
  CheckCircle, AlertTriangle, Info, Bell, 
  ShoppingCart, RefreshCw, Image, FileText, Clock 
} from 'lucide-react';

const { Text } = Typography;

const NotificationItem = ({ type, title, description, time, read, onClick }) => {
  const typeConfig = {
    success: { icon: CheckCircle, color: '#2E7D32', bg: '#ecfdf5' },
    warning: { icon: AlertTriangle, color: '#ED6C02', bg: '#fffbeb' },
    info: { icon: Info, color: '#1976D2', bg: '#eff6ff' },
    alert: { icon: Bell, color: '#C62828', bg: '#fef2f2' },
  };

  const config = typeConfig[type] || typeConfig.info;
  const Icon = config.icon;

  return (
    <div 
      onClick={onClick}
      style={{ 
        display: 'flex', 
        alignItems: 'flex-start', 
        gap: 10, 
        padding: '10px 0',
        borderBottom: '1px solid #f4f4f5',
        cursor: 'pointer',
        opacity: read ? 0.6 : 1
      }}
    >
      <div style={{ width: 28, height: 28, borderRadius: 7, background: config.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={14} color={config.color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 12, fontWeight: 600, color: '#18181b', display: 'block', marginBottom: 1 }}>{title}</Text>
        <Text style={{ fontSize: 11, color: '#71717a', display: 'block' }}>{description}</Text>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        <Text style={{ fontSize: 10, color: '#a1a1aa' }}>{time}</Text>
        {!read && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4F46E5' }} />}
      </div>
    </div>
  );
};

const NotificationsFeed = ({ 
  notifications = [], 
  onMarkAllRead,
  onViewAll 
}) => {
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div style={{ 
      padding: '16px 20px', 
      background: '#fff', 
      borderRadius: 12, 
      border: '1px solid #e4e4e7'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bell size={14} color="#1976D2" />
          </div>
          <Text strong style={{ fontSize: 14, color: '#18181b' }}>Activity Feed</Text>
          {unreadCount > 0 && <Badge count={unreadCount} style={{ backgroundColor: '#4F46E5' }} />}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {unreadCount > 0 && (
            <Button type="link" size="small" onClick={onMarkAllRead} style={{ fontSize: 11, padding: 0 }}>
              Mark all read
            </Button>
          )}
          <Button type="link" size="small" onClick={onViewAll} style={{ fontSize: 11, padding: 0 }}>
            View All
          </Button>
        </div>
      </div>
      <div style={{ maxHeight: 320, overflowY: 'auto' }}>
        {notifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: '#a1a1aa', fontSize: 12 }}>
            No recent activity
          </div>
        ) : (
          notifications.slice(0, 8).map((notification, i) => (
            <NotificationItem key={i} {...notification} />
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationsFeed;
