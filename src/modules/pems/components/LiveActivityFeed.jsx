import React, { useState, useEffect } from 'react';
import { Typography, Tag, Space } from 'antd';
import { ThunderboltOutlined, CheckCircleOutlined, ClockCircleOutlined, EyeOutlined, EditOutlined } from '@ant-design/icons';
import pemsApi from '../services/pemsApi';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Text } = Typography;

const ACTION_CONFIG = {
  CREATED: { icon: <ThunderboltOutlined style={{ fontSize: 9 }} />, color: 'var(--bc-blue-600)', bg: 'var(--bc-blue-50)' },
  STATUS_CHANGED: { icon: <CheckCircleOutlined style={{ fontSize: 9 }} />, color: 'var(--bc-green-600)', bg: 'var(--bc-green-50)' },
  SUBTASK_COMPLETED: { icon: <CheckCircleOutlined style={{ fontSize: 9 }} />, color: 'var(--bc-green-600)', bg: 'var(--bc-green-50)' },
  EVIDENCE_UPLOADED: { icon: <EditOutlined style={{ fontSize: 9 }} />, color: 'var(--bc-violet-600)', bg: 'var(--bc-violet-50)' },
};

export default function LiveActivityFeed({ compact = false }) {
  const [activities, setActivities] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await pemsApi.getActivityFeed();
        if (res.success) setActivities(res.data || []);
      } catch {}
    };
    load();
    const interval = setInterval(load, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  // Auto-rotate through activities
  useEffect(() => {
    if (activities.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIdx(prev => (prev + 1) % activities.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [activities.length]);

  if (activities.length === 0) return null;

  const current = activities[currentIdx] || activities[0];
  const cfg = ACTION_CONFIG[current.Action] || ACTION_CONFIG.CREATED;

  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: 'var(--bc-surface-subtle)', border: '1px solid var(--bc-border-subtle)', maxWidth: 300, overflow: 'hidden' }}>
        <div style={{ width: 18, height: 18, borderRadius: 5, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cfg.color, flexShrink: 0 }}>
          {cfg.icon}
        </div>
        <Text style={{ fontSize: 10, color: 'var(--bc-text-body)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <Text strong>{current.ActorName || 'System'}</Text> {current.Action.replace(/_/g, ' ').toLowerCase()}
          {current.InstanceCode && <> <Text style={{ color: 'var(--bc-blue-600)' }}>{current.InstanceCode}</Text></>}
        </Text>
        <Text style={{ fontSize: 9, color: 'var(--bc-text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>{dayjs(current.CreatedAt).fromNow()}</Text>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: "var(--bc-radius-md)", background: 'var(--bc-surface-subtle)', border: '1px solid var(--bc-border-subtle)' }}>
      <div style={{ width: 20, height: 20, borderRadius: 5, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cfg.color, flexShrink: 0 }}>
        {cfg.icon}
      </div>
      <Text style={{ fontSize: 'var(--font-size-xs)', color: 'var(--bc-text-body)', flex: 1 }}>
        <Text strong>{current.ActorName || 'System'}</Text>{' '}
        {current.Action.replace(/_/g, ' ').toLowerCase()}
        {current.InstanceCode && <> <Text strong style={{ color: 'var(--bc-blue-600)' }}>{current.InstanceCode}</Text></>}
        {current.Title && <> — {current.Title}</>}
      </Text>
      <Text style={{ fontSize: 10, color: 'var(--bc-text-muted)', whiteSpace: 'nowrap' }}>{dayjs(current.CreatedAt).fromNow()}</Text>
      {/* Dots indicator */}
      <div style={{ display: 'flex', gap: 3 }}>
        {activities.slice(0, 5).map((_, i) => (
          <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: i === currentIdx ? 'var(--bc-blue-600)' : 'var(--bc-border-strong)' }} />
        ))}
      </div>
    </div>
  );
}
