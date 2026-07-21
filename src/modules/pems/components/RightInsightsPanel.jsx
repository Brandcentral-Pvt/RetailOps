import React, { useState, useEffect } from 'react';
import { Typography, Tag, Button, Badge, Space, Progress, Divider } from 'antd';
import {
  ClockCircleOutlined, EyeOutlined, WarningOutlined,
  ThunderboltOutlined, ReloadOutlined, CheckCircleOutlined,
  CalendarOutlined, ArrowRightOutlined
} from '@ant-design/icons';
import pemsApi from '../services/pemsApi';
import { WORKFLOW_STATUSES, SLA_STATUSES, PRIORITIES } from '../constants';
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
          <Icon style={{ fontSize: 13, color: '#64748B' }} />
          <Text style={{
            fontSize: 11, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.05em',
            color: '#64748B',
          }}>{title}</Text>
        </Space>
        {count !== undefined && (
          <div style={{
            background: '#F1F5F9', color: '#475569',
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
        borderRadius: 10,
        border: '1px solid #F1F5F9',
        background: '#FFFFFF',
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
        e.currentTarget.style.borderColor = '#F1F5F9';
        e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.03)';
      }}
    >
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: 6,
      }}>
        <Text style={{
          fontSize: 12, fontWeight: 600, color: '#0F172A',
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
          <Text style={{ fontSize: 10, color: '#94A3B8', fontFamily: 'monospace' }}>{task.InstanceCode}</Text>
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

export default function RightInsightsPanel({ onTaskClick }) {
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

  useEffect(() => { loadData(); }, []);

  const actionIcons = {
    CREATED: <ThunderboltOutlined style={{ fontSize: 10 }} />,
    STATUS_CHANGED: <CheckCircleOutlined style={{ fontSize: 10 }} />,
  };

  return (
    <div style={{
      width: 260,
      background: '#FFFFFF',
      borderRadius: 14,
      border: '1px solid #E5E7EB',
      padding: '18px',
      flexShrink: 0,
      overflowY: 'auto',
      maxHeight: 'calc(100vh - 280px)',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #F1F5F9',
      }}>
        <Text style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Insights</Text>
        <Button
          type="text" size="small" icon={<ReloadOutlined />} onClick={loadData}
          style={{ fontSize: 11, color: '#94A3B8' }}
        />
      </div>

      <InsightSection title="Upcoming Deadlines" icon={ClockCircleOutlined} count={upcoming.length}>
        {upcoming.length === 0 ? (
          <Text style={{ fontSize: 11, color: '#94A3B8', padding: '8px 0', display: 'block' }}>No upcoming tasks</Text>
        ) : upcoming.map(t => <TaskRow key={t.Id} task={t} onClick={onTaskClick} />)}
      </InsightSection>

      <Divider style={{ margin: '4px 0 16px', borderColor: '#F1F5F9' }} />

      <InsightSection title="My Reviews" icon={EyeOutlined} count={reviews.length}>
        {reviews.length === 0 ? (
          <Text style={{ fontSize: 11, color: '#94A3B8', padding: '8px 0', display: 'block' }}>No pending reviews</Text>
        ) : reviews.map(t => <TaskRow key={t.Id} task={t} onClick={onTaskClick} />)}
      </InsightSection>

      <Divider style={{ margin: '4px 0 16px', borderColor: '#F1F5F9' }} />

      <InsightSection title="Recent Activity" icon={WarningOutlined}>
        {recent.length === 0 ? (
          <Text style={{ fontSize: 11, color: '#94A3B8', padding: '8px 0', display: 'block' }}>No recent activity</Text>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recent.slice(0, 6).map(a => (
              <div key={a.Id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div style={{
                  width: 20, height: 20, borderRadius: 6,
                  background: a.Action === 'CREATED' ? '#EEF4FF' : '#F0FDF4',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, marginTop: 1,
                }}>
                  {actionIcons[a.Action] || <ThunderboltOutlined style={{ fontSize: 9, color: '#2563EB' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{
                    fontSize: 11, color: '#334155', lineHeight: 1.3,
                    display: 'block',
                  }}>
                    <span style={{ fontWeight: 600 }}>{a.ActorName || 'System'}</span>{' '}
                    {a.Action.replace(/_/g, ' ').toLowerCase()}
                  </Text>
                  <Text style={{
                    fontSize: 10, color: '#94A3B8',
                    display: 'flex', alignItems: 'center', gap: 4, marginTop: 1,
                  }}>
                    {a.InstanceCode && <><span style={{ fontFamily: 'monospace' }}>{a.InstanceCode}</span><span>·</span></>}
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
