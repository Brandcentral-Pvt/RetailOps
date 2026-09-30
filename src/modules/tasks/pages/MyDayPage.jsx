import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button, Progress, Skeleton, Empty, App, Typography } from 'antd';
import { ReloadOutlined, ThunderboltOutlined, SmileOutlined, ScheduleOutlined, WarningOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import tasksApi from '../services/tasksApi';
import { useAuth } from '../../../contexts/AuthContext';
import TaskWorkspace from '../components/TaskWorkspace';
import UpNextCard from '../components/myday/UpNextCard';
import DayTimeline from '../components/myday/DayTimeline';
import { WorkdaySettings, HowItWorks, ReviewsCard, MiniList, DoneIcon, WaitIcon } from '../components/myday/MyDayBits';
import { accentFor } from '../components/myday/myDayTheme';
import { buildPlan, DEFAULT_WORKDAY, greeting, formatDuration, FRIENDLY_STATUS } from '../utils/dayPlanner';
import '../tasks.css';

const { Text } = Typography;

const WORKDAY_KEY = 'myday.workday';
const todayKey = () => `myday.deferred.${dayjs().format('YYYY-MM-DD')}`;

function readJson(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v ?? fallback; } catch { return fallback; }
}

/** Re-render every `ms` so "now", the NOW marker and the plan stay current. */
function useNow(ms = 60000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return [now, setNow];
}

export default function MyDayPage() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const viewingUserId = searchParams.get('userId') || undefined;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useNow(60000);
  const [workday, setWorkday] = useState(() => ({ ...DEFAULT_WORKDAY, ...readJson(WORKDAY_KEY, {}) }));
  const [deferred, setDeferred] = useState(() => readJson(todayKey(), []));
  const [workspaceId, setWorkspaceId] = useState(null);
  const inFlight = useRef(false);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (!silent) setLoading(true);
    try {
      const res = await tasksApi.getMyDay(viewingUserId);
      if (res.success) { setData(res.data); setError(''); }
      setNow(Date.now());
    } catch (err) {
      if (!silent) setError(err.message || 'Could not load your day');
    } finally { inFlight.current = false; if (!silent) setLoading(false); }
  }, [viewingUserId, setNow]);

  // Mark the session as greeted so visiting "/" later shows the dashboard (see HomeRoute in App.jsx).
  useEffect(() => { try { sessionStorage.setItem('landing.myday', '1'); } catch { /* private mode */ } }, []);

  useEffect(() => { load(); }, [load]);

  // Stay fresh without the user doing anything: on tab focus and every 5 minutes.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') load({ silent: true }); };
    document.addEventListener('visibilitychange', onVisible);
    const t = setInterval(() => load({ silent: true }), 5 * 60 * 1000);
    return () => { document.removeEventListener('visibilitychange', onVisible); clearInterval(t); };
  }, [load]);

  const changeWorkday = (w) => { setWorkday(w); localStorage.setItem(WORKDAY_KEY, JSON.stringify(w)); };
  const persistDeferred = (list) => { setDeferred(list); localStorage.setItem(todayKey(), JSON.stringify(list)); };
  const defer = (id) => { persistDeferred([...new Set([...deferred, id])]); message.info('Moved to Later — it won\'t be in today\'s plan'); };
  const undefer = (id) => persistDeferred(deferred.filter(x => x !== id));

  const plan = useMemo(() => buildPlan({
    tasks: data?.actionable || [], reviews: data?.reviews || [], now, workday, deferred,
  }), [data, now, workday, deferred]);

  const { summary } = plan;
  const doneCount = data?.doneToday?.length || 0;
  const planned = summary.mustCount + summary.shouldCount;
  const pct = doneCount + planned > 0 ? Math.round((doneCount / (doneCount + planned)) * 100) : (doneCount > 0 ? 100 : 0);
  const overdueCount = plan.must.filter(e => e.urgency === 'overdue').length;
  const lastSlot = [...plan.slots].reverse().find(s => s.type !== 'break');
  const firstName = user?.firstName || user?.FirstName || (user?.fullName || '').split(' ')[0] || 'there';
  const nextSlot = plan.slots.find(s => s.type === 'task');
  const nextKey = nextSlot?.key;
  const openTask = (id) => setWorkspaceId(id);

  const healthChip = {
    on_track: { cls: 'good', text: 'On track' },
    tight: { cls: 'warn', text: 'Tight day' },
    overloaded: { cls: 'bad', text: 'Overloaded' },
    clear: { cls: 'good', text: 'All clear' },
  }[summary.health];

  // ── loading / error ──
  if (loading && !data) {
    return <div className="md-page"><Skeleton active paragraph={{ rows: 2 }} /><Skeleton active paragraph={{ rows: 6 }} /></div>;
  }
  if (error && !data) {
    return (
      <div className="md-page">
        <Empty description={error}><Button type="primary" icon={<ReloadOutlined />} onClick={() => load()}>Try again</Button></Empty>
      </div>
    );
  }

  const laterItems = plan.later.map(e => ({
    id: e.task.Id, title: e.task.Title || e.task.TemplateName, color: accentFor(e.task), deferred: e.deferred,
    sub: `${e.deferred ? 'Moved to later' : (e.task.DueDate ? `Due ${dayjs(e.task.DueDate).format('D MMM')}` : 'No due date')} · ${formatDuration(e.minutes)}`,
  }));
  const waitingItems = (data?.waiting || []).map(t => ({
    id: t.Id, title: t.Title, color: accentFor(t),
    sub: `${FRIENDLY_STATUS[t.Status]}${t.ReviewerName ? ` · ${t.ReviewerName}` : ''}${t.SubmittedAt ? ` · sent ${dayjs(t.SubmittedAt).format('D MMM, h:mm A')}` : ''}`,
  }));
  const doneItems = (data?.doneToday || []).map(t => ({
    id: t.Id, title: t.Title, color: '#2E7D32',
    sub: t.Status === 'APPROVED' ? 'Approved' : FRIENDLY_STATUS[t.Status] || t.Status,
  }));

  const allClear = summary.health === 'clear';

  return (
    <div className="md-page">
      {viewingUserId && <div className="md-note info"><ScheduleOutlined /> You are viewing a teammate's day.</div>}

      {/* ═══ HERO ═══ */}
      <div className="md-hero">
        <div className="md-ring">
          <Progress type="circle" percent={pct} size={92} strokeColor="#fff" railColor="rgba(255,255,255,.25)" strokeWidth={9}
            format={() => <span style={{ color: '#fff', fontWeight: 800 }}>{doneCount}/{doneCount + planned}</span>} />
          <div className="md-ring-label">done today</div>
        </div>
        <div style={{ flex: 1, minWidth: 260 }}>
          <h1 className="md-hero__title">{greeting(now)}, {firstName}</h1>
          <div className="md-hero__sub">
            {dayjs(now).format('dddd, D MMMM')}
            {' · '}
            {allClear
              ? (doneCount > 0 ? 'You\'ve cleared everything — great work.' : 'Nothing needs you right now.')
              : [
                planned > 0 && `${planned} task${planned === 1 ? '' : 's'}`,
                summary.reviewCount > 0 && 'a review block',
                `about ${formatDuration(summary.plannedMin)}`,
                lastSlot && `wraps up around ${dayjs(lastSlot.end).format('h:mm A')}`,
              ].filter(Boolean).join(' · ')}
          </div>
          <div className="md-hero__chips">
            <span className={`md-chip ${healthChip.cls}`}>{healthChip.text}</span>
            {overdueCount > 0 && <span className="md-chip bad"><WarningOutlined /> {overdueCount} overdue</span>}
            {summary.mustCount > 0 && <span className="md-chip">{summary.mustCount} must-do</span>}
            {summary.shouldCount > 0 && <span className="md-chip">{summary.shouldCount} if time allows</span>}
            {summary.reviewCount > 0 && <span className="md-chip">{summary.reviewCount} to review</span>}
            {plan.later.length > 0 && <span className="md-chip">{plan.later.length} later</span>}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
          <HowItWorks />
          <div style={{ display: 'flex', gap: 8 }}>
            <WorkdaySettings workday={workday} onChange={changeWorkday} />
            <Button size="small" icon={<ReloadOutlined />} loading={loading} onClick={() => load()} style={{ borderRadius: 6 }}>Refresh</Button>
          </div>
        </div>
      </div>

      {summary.health === 'overloaded' && (
        <div className="md-note bad">
          <WarningOutlined style={{ marginTop: 3 }} />
          <span>Your must-do work is about <b>{formatDuration(summary.overflowMinutes)}</b> longer than the time you have {plan.isTomorrow ? 'tomorrow' : 'left today'}. Move anything that can wait with <b>Do later</b>, or ask your lead to re-assign or extend a deadline.</span>
        </div>
      )}

      {/* ═══ UP NEXT ═══ */}
      {plan.next ? (
        <UpNextCard
          key={plan.next.task.Id}
          entry={plan.next}
          eyebrow={plan.isTomorrow ? 'First thing tomorrow' : (plan.next.task.Status === 'IN_PROGRESS' || plan.next.task.Status === 'REWORK' ? 'Continue' : 'Up next')}
          onOpen={openTask}
          onDefer={defer}
          onChanged={() => load({ silent: true })}
        />
      ) : allClear && (
        <div className="md-card" style={{ textAlign: 'center', padding: '36px 20px' }}>
          <SmileOutlined style={{ fontSize: 40, color: '#2E7D32' }} />
          <h2 style={{ margin: '10px 0 4px', fontSize: 20 }}>{doneCount > 0 ? 'Everything is done for today 🎉' : 'Nothing is assigned to you right now'}</h2>
          <Text style={{ color: 'var(--bc-text-muted, #64748b)' }}>
            {summary.reviewCount > 0 ? 'You do have reviews waiting — teammates are counting on them.' : 'New work will appear here the moment it\'s assigned.'}
          </Text>
          <div style={{ marginTop: 14, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button onClick={() => navigate('/tasks/tasks')}>Browse all tasks</Button>
            {summary.reviewCount > 0 && <Button type="primary" onClick={() => navigate('/tasks/reviews')}>Open review queue</Button>}
          </div>
        </div>
      )}

      {/* ═══ PLAN + SIDE ═══ */}
      {(plan.slots.some(s => s.type !== 'break') || laterItems.length > 0 || waitingItems.length > 0 || doneItems.length > 0 || summary.reviewCount > 0) && (
        <div className="md-grid">
          <div className="md-card">
            <div className="md-card__title"><span><ThunderboltOutlined /> {plan.isTomorrow ? 'Tomorrow\'s plan' : 'Today\'s plan'}</span><span style={{ textTransform: 'none', letterSpacing: 0 }}>{formatDuration(summary.plannedMin)} of {formatDuration(summary.capacityMin)} available</span></div>
            <DayTimeline plan={plan} now={now} nextKey={nextKey} onOpen={openTask} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <ReviewsCard reviews={data?.reviews || []} />
            <MiniList
              title="Later" icon={<ScheduleOutlined />} items={laterItems} onOpen={openTask}
              renderExtra={(it) => it.deferred
                ? <Button type="link" size="small" onClick={(e) => { e.stopPropagation(); undefer(it.id); }}>Put back</Button>
                : null}
            />
            <MiniList title="With your reviewer" icon={WaitIcon} items={waitingItems} onOpen={openTask} />
            <MiniList title="Done today" icon={DoneIcon} items={doneItems} onOpen={openTask} tone="#2E7D32" />
          </div>
        </div>
      )}

      <TaskWorkspace open={!!workspaceId} taskId={workspaceId} onClose={() => setWorkspaceId(null)} onRefresh={() => load({ silent: true })} />
    </div>
  );
}
