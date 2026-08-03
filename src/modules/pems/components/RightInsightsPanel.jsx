import React, { useState, useEffect } from 'react';
import { Typography, Button, Badge, Space, Divider } from 'antd';
import {
  ClockCircleOutlined, EyeOutlined, WarningOutlined,
  ThunderboltOutlined, ReloadOutlined, CheckCircleOutlined,
  CalendarOutlined, ArrowRightOutlined
} from '@ant-design/icons';
import pemsApi from '../services/pemsApi';
import { WORKFLOW_STATUSES, PRIORITIES } from '../constants';
import { calculateHealth, getDueDateLabel, isOverdue } from '../utils/taskHealth';
import dayjs from 'dayjs';

const { Text } = Typography;

function InsightSection({ title, icon: Icon, count, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 10,
      }}>
        <Space size={8}>
          <Icon style={{ fontSize: 13, color: 'var(--bc-text-secondary)' }} />
          <Text style={{
            fontSize: 11, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.05em',
            color: 'var(--bc-text-secondary)',
          }}>{title}</Text>
        </Space>
        {count !== undefined && (
          <div style={{
            background: 'var(--bc-surface-subtle)', color: 'var(--bc-text-body)',
            borderRadius: 10, padding: '0 8px',
            fontSize: 10, fontWeight: 600, lineHeight: '18px',
          }}>{count}</div>
        )}
      </div>
      {children}
    </div>
  );
}

function TaskRow({ task, onClick }) {
  const health = calculateHealth(task);
  const due = getDueDateLabel(task);
  const prCfg = PRIORITIES[task.Priority] || {};
  return (
    <div
      onClick={() => onClick?.(task)}
      style={{
        padding: '10px 12px',
        borderRadius: 'var(--bc-radius-lg)',
        border: '1px solid var(--bc-border-subtle)',
        background: 'var(--bc-surface-card)',
        marginBottom: 6,
        cursor: 'pointer',
        transition: 'all 0.1s ease',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = '#2563EB30';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(37,99,235,0.08)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--bc-border-subtle)';
        e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.03)';
      }}
    >
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: 6,
      }}>
        <Text style={{
          fontSize: 12, fontWeight: 600, color: 'var(--bc-text-heading)',
          lineHeight: 1.3, flex: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{task.Title || 'Untitled'}</Text>
        <div style={{
          width: 7, height: 7, borderRadius: '50%',
          background: health.color, flexShrink: 0, marginTop: 5,
          boxShadow: `0 0 0 2px ${health.color}20`,
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space size={6}>
          <Text style={{ fontSize: 10, color: 'var(--bc-text-muted)', fontFamily: 'var(--bc-font-mono)' }}>{task.InstanceCode}</Text>
          {task.Priority && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 3,
              padding: '1px 6px', borderRadius: 4,
              background: prCfg.bg, color: prCfg.color,
              fontSize: 9, fontWeight: 600,
            }}>
              <div style={{
                width: 4, height: 4, borderRadius: '50%',
                background: prCfg.color,
              }} />
              {task.Priority}
            </div>
          )}
        </Space>
        {due && (
          <Text style={{
            fontSize: 10, fontWeight: 600, color: due.color,
            display: 'flex', alignItems: 'center', gap: 3,
          }}>
            <CalendarOutlined style={{ fontSize: 9 }} />
            {due.text}
          </Text>
        )}
      </div>
    </div>
  );
}

export default function RightInsightsPanel({ onTaskClick, refreshKey }) {
  const [upcoming, setUpcoming] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [liveRes, feedRes] = await Promise.all([
        pemsApi.getLiveTasks({ status: 'UNDER_REVIEW' }),
        pemsApi.getActivityFeed(),
      ]);
      if (liveRes.success) setReviews(liveRes.data?.slice(0, 5) || []);
      if (feedRes.success) setRecent(feedRes.data?.slice(0, 8) || []);
      const upcomingRes = await pemsApi.getLiveTasks({});
      if (upcomingRes.success) {
        const tasks = (upcomingRes.data || [])
          .filter(t => t.DueDate && !isOverdue(t))
          .sort((a, b) => new Date(a.DueDate) - new Date(b.DueDate))
          .slice(0, 5);
        setUpcoming(tasks);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [refreshKey]);

  const actionIcons = {
    CREATED: <ThunderboltOutlined style={{ fontSize: 10 }} />,
    STATUS_CHANGED: <CheckCircleOutlined style={{ fontSize: 10 }} />,
  };

  return (
    <div style={{
      width: 280,
      background: 'var(--bc-surface-card)',
      borderRadius: 'var(--bc-radius-2xl)',
      border: '1px solid var(--bc-border-default)',
      padding: '18px',
      flexShrink: 0,
      overflowY: 'auto',
      maxHeight: 'calc(100vh - 280px)',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--bc-border-subtle)',
      }}>
        <Text style={{ fontSize: 14, fontWeight: 700, color: 'var(--bc-text-heading)' }}>Insights</Text>
        <Button
          type="text" size="small" icon={<ReloadOutlined />} onClick={loadData}
          style={{ fontSize: 11, color: 'var(--bc-text-muted)' }}
        />
      </div>

      <InsightSection title="Upcoming Deadlines" icon={ClockCircleOutlined} count={upcoming.length}>
        {upcoming.length === 0 ? (
          <Text style={{ fontSize: 11, color: 'var(--bc-text-muted)', padding: '8px 0', display: 'block' }}>No upcoming tasks</Text>
        ) : upcoming.map(t => <TaskRow key={t.Id} task={t} onClick={onTaskClick} />)}
      </InsightSection>

      <Divider style={{ margin: '4px 0 16px', borderColor: 'var(--bc-border-subtle)' }} />

      <InsightSection title="My Reviews" icon={EyeOutlined} count={reviews.length}>
        {reviews.length === 0 ? (
          <Text style={{ fontSize: 11, color: 'var(--bc-text-muted)', padding: '8px 0', display: 'block' }}>No pending reviews</Text>
        ) : reviews.map(t => <TaskRow key={t.Id} task={t} onClick={onTaskClick} />)}
      </InsightSection>

      <Divider style={{ margin: '4px 0 16px', borderColor: 'var(--bc-border-subtle)' }} />

      <InsightSection title="Recent Activity" icon={WarningOutlined}>
        {recent.length === 0 ? (
          <Text style={{ fontSize: 11, color: 'var(--bc-text-muted)', padding: '8px 0', display: 'block' }}>No recent activity</Text>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recent.slice(0, 6).map(a => (
              <div key={a.Id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div style={{
                  width: 20, height: 20, borderRadius: 6,
                  background: a.Action === 'CREATED' ? 'var(--bc-blue-50)' : 'var(--bc-green-50)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, marginTop: 1,
                }}>
                  {actionIcons[a.Action] || <ThunderboltOutlined style={{ fontSize: 9, color: 'var(--bc-blue-600)' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{
                    fontSize: 11, color: 'var(--bc-text-body)', lineHeight: 1.3,
                    display: 'block',
                  }}>
                    <span style={{ fontWeight: 600 }}>{a.ActorName || 'System'}</span>{' '}
                    {a.Action.replace(/_/g, ' ').toLowerCase()}
                  </Text>
                  <Text style={{
                    fontSize: 10, color: 'var(--bc-text-muted)',
                    display: 'flex', alignItems: 'center', gap: 4, marginTop: 1,
                  }}>
                    {a.InstanceCode && <><span style={{ fontFamily: 'var(--bc-font-mono)' }}>{a.InstanceCode}</span><span>·</span></>}
                    {dayjs(a.CreatedAt).fromNow?.() || dayjs(a.CreatedAt).format('HH:mm')}
                  </Text>
                </div>
              </div>
            ))}
          </div>
        )}
      </InsightSection>
    </div>
  );
}
