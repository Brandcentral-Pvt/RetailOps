import React from 'react';
import { Typography, Tag, Button } from 'antd';
import {
  CheckCircle, AlertTriangle, Info, Bell,
  Clock, Send, Upload, Eye, Trash2, Edit
} from 'lucide-react';

const { Text } = Typography;

const getEventConfig = (type, severity) => {
  const t = (type || '').toLowerCase();
  const s = (severity || '').toLowerCase();

  if (s === 'error' || t.includes('error') || t.includes('failure')) {
    return { icon: Bell, color: 'var(--text-danger, #D32F2F)', bg: 'var(--bg-danger-subtle, #fef2f2)', eventType: 'alert' };
  }
  if (s === 'warning' || t.includes('warning') || t.includes('delete')) {
    return { icon: AlertTriangle, color: 'var(--text-warning, #ED6C02)', bg: 'var(--bg-warning-subtle, #fffbeb)', eventType: 'warning' };
  }
  if (t.includes('create') || t.includes('insert') || t.includes('success')) {
    return { icon: CheckCircle, color: 'var(--text-success, #2E7D32)', bg: 'var(--bg-success-subtle, #ecfdf5)', eventType: 'success' };
  }
  if (t.includes('update') || t.includes('edit')) {
    return { icon: Edit, color: 'var(--text-brand, #1976D2)', bg: 'var(--bg-info-subtle, #eff6ff)', eventType: 'action' };
  }
  if (t.includes('upload') || t.includes('import')) {
    return { icon: Upload, color: 'var(--text-brand, #0288D1)', bg: 'var(--bg-info-subtle, #ecfeff)', eventType: 'upload' };
  }
  if (t.includes('view') || t.includes('read')) {
    return { icon: Eye, color: 'var(--text-secondary, #64748b)', bg: 'var(--bg-tertiary, #f4f4f5)', eventType: 'view' };
  }
  return { icon: Info, color: 'var(--text-brand, #1976D2)', bg: 'var(--bg-info-subtle, #eff6ff)', eventType: 'info' };
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

const TimelineEvent = ({ log }) => {
  const title = log.entityTitle || log.EntityTitle || log.title || 'System Event';
  const description = log.description || log.Description || log.type || '';
  const user = log.user?.firstName ? `${log.user.firstName} ${log.user.lastName || ''}`.trim() : (log.user || '');
  const time = log.createdAt || log.CreatedAt;
  const entityType = log.entityType || log.EntityType || '';
  const severity = log.severity || log.Severity || log.type || '';
  const { icon: Icon, color, bg } = getEventConfig(log.type || log.Type, severity);

  return (
    <div style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border-light, #f4f4f5)' }}>
      <div style={{ position: 'relative' }}>
        <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-md, 8px)', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={14} color={color} />
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>{title}</Text>
          {entityType && <Tag style={{ fontSize: 'var(--font-size-xs)', borderRadius: 3, margin: 0, padding: '0 4px' }}>{entityType}</Tag>}
        </div>
        <Text style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary, #64748b)', display: 'block', marginBottom: 3 }}>{description}</Text>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary, #a1a1aa)' }}>{formatTime(time)}</Text>
          {user && <Text style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary, #64748b)' }}>by {user}</Text>}
        </div>
      </div>
    </div>
  );
};

const ActivityTimeline = ({ events = [] }) => {
  const displayEvents = events.length > 0 ? events.slice(0, 10) : [];

  return (
    <div style={{
      padding: '16px 20px',
      background: 'var(--bg-primary, #fff)',
      borderRadius: 'var(--radius-xl, 16px)',
      border: '1px solid var(--border-light, #d9e6e9)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 'var(--radius-md, 8px)', background: 'var(--bg-tertiary, #f4f4f5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={14} color="var(--text-secondary, #64748b)" />
          </div>
          <Text strong style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-primary, #0f172a)' }}>Activity Timeline</Text>
        </div>
      </div>
      <div style={{ maxHeight: 400, overflowY: 'auto' }}>
        {displayEvents.length > 0 ? (
          displayEvents.map((event, i) => (
            <TimelineEvent key={event._id || event.Id || i} log={event} />
          ))
        ) : (
          <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--text-tertiary, #9CA3AF)', fontSize: 'var(--font-size-sm)' }}>
            No recent activity
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityTimeline;
