import React, { useState, useEffect } from 'react';
import { Badge, Button, Typography, Space, Divider, Tooltip, Empty, Spin } from 'antd';
import {
  BellOutlined, CheckCircleOutlined, ClockCircleOutlined, WarningOutlined,
  ThunderboltOutlined, EyeOutlined, CloseCircleOutlined, CheckOutlined
} from '@ant-design/icons';
import pemsApi from '../services/pemsApi';
import { useAuth } from '../../../contexts/AuthContext';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Text } = Typography;

const TYPE_CONFIG = {
  TASK_ASSIGNED: { icon: <ClockCircleOutlined />, color: '#2563eb', bg: '#eff6ff' },
  TASK_ACCEPTED: { icon: <CheckCircleOutlined />, color: '#2E7D32', bg: '#f0fdf4' },
  TASK_SUBMITTED: { icon: <EyeOutlined />, color: '#9333ea', bg: '#f5f3ff' },
  TASK_APPROVED: { icon: <CheckCircleOutlined />, color: '#2E7D32', bg: '#f0fdf4' },
  TASK_REJECTED: { icon: <CloseCircleOutlined />, color: '#D32F2F', bg: '#fef2f2' },
  SLA_WARNING: { icon: <WarningOutlined />, color: '#ED6C02', bg: '#fffbeb' },
  SLA_BREACH: { icon: <ThunderboltOutlined />, color: '#D32F2F', bg: '#fef2f2' },
  REVIEW_ASSIGNED: { icon: <EyeOutlined />, color: '#9333ea', bg: '#f5f3ff' },
};

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // SECURITY (audit #10): identity comes from AuthContext — never hand-decode
  // the JWT payload client-side (atob on the token segment).
  const { user } = useAuth();
  const currentUserId = user?.Id || user?._id || user?.id || null;

  // NOTE: no userId query param is sent — server-side scoping by token identity
  // is authoritative (backend notificationController.getNotifications reads
  // req.user.Id; a client-supplied userId is ignored and must not be trusted).
  const loadNotifications = async () => {
    try {
      const res = await pemsApi.getNotifications({});
      if (res.success) {
        setNotifications(res.data || []);
        setUnreadCount(res.unreadCount || 0);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    // Loading state is flipped in this event handler (not in an effect) and
    // every fetch is awaited before further setState calls.
    if (next && currentUserId) {
      setLoading(true);
      loadNotifications();
    }
  };

  // Poll for new notifications every 30s
  useEffect(() => {
    if (!currentUserId) return;
    const interval = setInterval(async () => {
      try {
        const res = await pemsApi.getNotifications({ unreadOnly: 'true' });
        if (res.success) setUnreadCount(res.unreadCount || 0);
      } catch {}
    }, 30000);
    return () => clearInterval(interval);
  }, [currentUserId]);

  const markAsRead = async (id) => {
    try {
      await pemsApi.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.Id === id ? { ...n, IsRead: 1 } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {}
  };

  const markAllAsRead = async () => {
    try {
      await pemsApi.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, IsRead: 1 })));
      setUnreadCount(0);
    } catch {}
  };

  return (
    <>
      <Tooltip title="Notifications">
        <Badge count={unreadCount} size="small" offset={[-2, 2]}>
          <Button
            type="text"
            icon={<BellOutlined />}
            onClick={toggleOpen}
            style={{ fontSize: 'var(--font-size-lg)', color: unreadCount > 0 ? '#2563eb' : '#64748b' }}
          />
        </Badge>
      </Tooltip>

      {/* Dropdown panel */}
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 999 }} />
          <div style={{
            position: 'fixed', top: 48, right: 24, width: 360, maxHeight: 480,
            background: '#fff', borderRadius: "var(--radius-lg)", boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
            border: '1px solid #e5e7eb', zIndex: 1000, overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text strong style={{ fontSize: 'var(--font-size-sm)' }}>Notifications</Text>
              {unreadCount > 0 && (
                <Button type="text" size="small" icon={<CheckOutlined />} onClick={markAllAsRead} style={{ fontSize: 'var(--font-size-xs)', color: '#2563eb' }}>
                  Mark all read
                </Button>
              )}
            </div>

            {/* Notification list */}
            <div style={{ maxHeight: 400, overflow: 'auto' }}>
              {loading ? (
                <div style={{ padding: 40, textAlign: 'center' }}><Spin /></div>
              ) : notifications.length === 0 ? (
                <Empty description="No notifications" style={{ padding: '30px 0' }} />
              ) : (
                notifications.slice(0, 20).map(n => {
                  const cfg = TYPE_CONFIG[n.Type] || TYPE_CONFIG.TASK_ASSIGNED;
                  return (
                    <div
                      key={n.Id}
                      onClick={() => markAsRead(n.Id)}
                      style={{
                        padding: '10px 16px', borderBottom: '1px solid #f8fafc',
                        background: n.IsRead ? '#fff' : '#f8fafc',
                        cursor: 'pointer', transition: 'background 0.1s',
                        display: 'flex', gap: 10, alignItems: 'flex-start',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                      onMouseLeave={e => e.currentTarget.style.background = n.IsRead ? '#fff' : '#f8fafc'}
                    >
                      <div style={{
                        width: 28, height: 28, borderRadius: 7,
                        background: cfg.bg, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', color: cfg.color, fontSize: 'var(--font-size-sm)', flexShrink: 0,
                      }}>
                        {cfg.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: 'var(--font-size-sm)', fontWeight: n.IsRead ? 400 : 600, color: '#334155', display: 'block' }}>
                          {n.Title}
                        </Text>
                        {n.Message && (
                          <Text style={{ fontSize: 'var(--font-size-xs)', color: '#94a3b8', display: 'block', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {n.Message}
                          </Text>
                        )}
                        <Text style={{ fontSize: 10, color: '#94a3b8' }}>
                          {dayjs(n.CreatedAt).fromNow()}
                        </Text>
                      </div>
                      {!n.IsRead && (
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#2563eb', marginTop: 4, flexShrink: 0 }} />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
