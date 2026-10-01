import React, { useState, useEffect } from 'react';
import {
  ClockCircleOutlined, EyeOutlined, WarningOutlined,
  ThunderboltOutlined, ReloadOutlined, CalendarOutlined
} from '@ant-design/icons';
import tasksApi from '../services/tasksApi';
import { PRIORITIES } from '../constants';
import { calculateHealth, getDueDateLabel, isOverdue } from '../utils/taskHealth';
import dayjs from 'dayjs';

function InsightSection({ title, icon: Icon, count, empty, children }) {
  return (
    <section className="tasks-panel-section">
      <header className="tasks-panel-section__head">
        <span className="tasks-panel-section__title"><Icon /> {title}</span>
        {count !== undefined && <span className="tasks-panel-section__count">{count}</span>}
      </header>
      {count === 0 ? <p className="tasks-panel-empty">{empty}</p> : children}
    </section>
  );
}

function TaskRow({ task, onClick }) {
  const health = calculateHealth(task);
  const due = getDueDateLabel(task);
  return (
    <button type="button" className="tasks-panel-item" onClick={() => onClick?.(task)}>
      <span className="tasks-panel-dot" style={{ background: health.color }} />
      <span className="tasks-panel-item__body">
        <span className="tasks-panel-item__title">{task.Title || 'Untitled'}</span>
        <span className="tasks-panel-item__meta">
          <span style={{ fontFamily: 'var(--bc-font-mono)' }}>{task.InstanceCode}</span>
          {task.Priority && task.Priority !== 'MEDIUM' && (
            <span className={`tasks-priority tasks-priority--${String(task.Priority).toLowerCase()}`}>{task.Priority}</span>
          )}
          {due && (
            <span style={{ color: due.color, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <CalendarOutlined style={{ fontSize: 9 }} />
              {due.text}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

export default function RightInsightsPanel({ onTaskClick, refreshKey }) {
  const [upcoming, setUpcoming] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [recent, setRecent] = useState([]);
  const [autoTasks, setAutoTasks] = useState([]);
  const [autoStats, setAutoStats] = useState({ total: 0, open: 0, overdue: 0 });
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [liveRes, feedRes, autoRes, upRes, autoStatsRes] = await Promise.all([
        tasksApi.getLiveTasks({ status: 'UNDER_REVIEW' }),
        tasksApi.getActivityFeed(),
        tasksApi.getLiveTasks({ isAutomated: true, limit: 5 }).catch(() => ({ success: false })),
        tasksApi.getLiveTasks({}),
        tasksApi.getAutomationStats().catch(() => ({ total:0, open:0, overdue:0, byRuleset:[] })),
      ]);
      if (liveRes.success) setReviews(liveRes.data?.slice(0, 5) || []);
      if (feedRes.success) setRecent(feedRes.data?.slice(0, 8) || []);
      setAutoStats(autoStatsRes || { total:0, open:0, overdue:0 });
      if (autoRes.success) setAutoTasks((autoRes.data || []).slice(0, 5));
      if (upRes.success) {
        const tasks = (upRes.data || [])
          .filter(t => t.DueDate && !isOverdue(t))
          .sort((a, b) => new Date(a.DueDate) - new Date(b.DueDate))
          .slice(0, 5);
        setUpcoming(tasks);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [refreshKey]);

  if (loading) {
    return (
      <div className="tasks-insights-panel__inner">
        <div className="tasks-panel-section">
          <span className="tasks-panel-section__title">Insights</span>
        </div>
        <div className="tasks-panel-section">
          <p className="tasks-panel-empty">Loading current deadlines, reviews, and activity…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tasks-insights-panel__inner">
      <div className="tasks-panel-section">
        <div className="tasks-panel-section__head" style={{ marginBottom: 0 }}>
          <span className="tasks-panel-section__title" style={{ fontSize: 12, letterSpacing: '0.02em', textTransform: 'none', color: 'var(--tec-text, #0f172a)' }}>
            Insights
          </span>
          <button type="button" className="tasks-chip__remove" onClick={loadData} aria-label="Refresh insights" title="Refresh">
            <ReloadOutlined style={{ fontSize: 11 }} />
          </button>
        </div>
      </div>

      <InsightSection
        title="Automation queue"
        icon={ThunderboltOutlined}
        count={autoTasks.length || autoStats.open || 0}
        empty={autoStats.total > 0
          ? `${autoStats.total} automation tasks recorded, none open right now.`
          : 'No ruleset-generated tasks yet.'}
      >
        {autoTasks.map(t => <TaskRow key={t.Id} task={t} onClick={onTaskClick} />)}
        {autoStats.total > 0 && (
          <button
            type="button"
            className="tasks-clearall"
            style={{ marginTop: 8 }}
            onClick={() => window.open('/rule-sets', '_blank')}
          >
            Configure rulesets
          </button>
        )}
      </InsightSection>

      <InsightSection title="Upcoming deadlines" icon={ClockCircleOutlined} count={upcoming.length} empty="No upcoming deadlines.">
        {upcoming.map(t => <TaskRow key={t.Id} task={t} onClick={onTaskClick} />)}
      </InsightSection>

      <InsightSection title="My reviews" icon={EyeOutlined} count={reviews.length} empty="No pending reviews.">
        {reviews.map(t => <TaskRow key={t.Id} task={t} onClick={onTaskClick} />)}
      </InsightSection>

      <InsightSection title="Recent activity" icon={WarningOutlined} empty="No recent activity.">
        {recent.slice(0, 6).map(a => (
          <div key={a.Id} className="tasks-panel-item">
            <span className="tasks-panel-item__body">
              <span className="tasks-panel-item__title">
                <b style={{ fontWeight: 600 }}>{a.ActorName || 'System'}</b>{' '}
                {String(a.Action || '').replace(/_/g, ' ').toLowerCase()}
              </span>
              <span className="tasks-panel-item__meta">
                {a.InstanceCode && <span style={{ fontFamily: 'var(--bc-font-mono)' }}>{a.InstanceCode}</span>}
                <span>{dayjs(a.CreatedAt).fromNow?.() || dayjs(a.CreatedAt).format('HH:mm')}</span>
              </span>
            </span>
          </div>
        ))}
      </InsightSection>
    </div>
  );
}
