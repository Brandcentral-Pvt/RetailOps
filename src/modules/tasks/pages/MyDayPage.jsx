import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button, Skeleton, App, Typography } from 'antd';
import { ReloadOutlined, SmileOutlined, ScheduleOutlined, WarningOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import tasksApi from '../services/tasksApi';
import { useAuth } from '../../../contexts/AuthContext';
import TaskViewResolver from '../components/TaskViewResolver';
import UpNextCard from '../components/myday/UpNextCard';
import DayTimeline from '../components/myday/DayTimeline';
import { WorkdaySettings, HowItWorks, ReviewsCard, MiniList, DoneIcon, WaitIcon } from '../components/myday/MyDayBits';
import { accentFor } from '../components/myday/myDayTheme';
import { buildPlan, DEFAULT_WORKDAY, greeting, formatDuration, FRIENDLY_STATUS } from '../utils/dayPlanner';
import '../myday.css';

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
  const [workspaceTask, setWorkspaceTask] = useState(null);
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
  const openTask = (taskOrId) => {
    if (typeof taskOrId === 'string' || typeof taskOrId === 'number') {
      const allTasks = [
        ...(data?.actionable || []),
        ...(data?.waiting || []),
        ...(data?.doneToday || []),
      ];
      const task = allTasks.find(t => t.Id === taskOrId || t.id === taskOrId);
      if (task) setWorkspaceTask(task);
    } else {
      setWorkspaceTask(taskOrId);
    }
  };

  const healthChip = {
    on_track: { dot: 'good', text: 'On track' },
    tight: { dot: 'warn', text: 'Tight day' },
    overloaded: { dot: 'bad', text: 'Overloaded' },
    clear: { dot: 'good', text: 'All clear' },
  }[summary.health];

  // ── loading / error ──
  if (loading && !data) {
    return (
      <div className="md-page md-loading">
        <Skeleton active paragraph={{ rows: 2 }} />
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    );
  }
  if (error && !data) {
    return (
      <div className="md-page">
        <div className="md-note md-note--bad">
          <WarningOutlined className="md-note__icon" />
          <div className="md-note__body">{error}</div>
          <Button size="small" icon={<ReloadOutlined />} onClick={() => load()}>Try again</Button>
        </div>
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
    id: t.Id, title: t.Title, color: 'var(--md-done)',
    sub: t.Status === 'APPROVED' ? 'Approved' : FRIENDLY_STATUS[t.Status] || t.Status,
  }));

  const waitingCount = (data?.waiting || []).length;
  const allClear = summary.health === 'clear';
  const hasContent = plan.slots.some(s => s.type !== 'break')
    || laterItems.length > 0 || waitingItems.length > 0 || doneItems.length > 0 || summary.reviewCount > 0;

  const dayLabel = plan.isTomorrow ? 'Tomorrow' : 'Today';
  const subLine = allClear
    ? (doneCount > 0 ? `${doneCount} completed · nothing outstanding` : 'Nothing needs you right now')
    : [
      `${planned} task${planned === 1 ? '' : 's'} planned`,
      summary.reviewCount > 0 && `${summary.reviewCount} review${summary.reviewCount === 1 ? '' : 's'}`,
      `about ${formatDuration(summary.plannedMin)}`,
      lastSlot && `finishes around ${dayjs(lastSlot.end).format('h:mm A')}`,
    ].filter(Boolean).join(' · ');

  return (
    <div className="md-page">
      {viewingUserId && (
        <div className="md-note md-note--info">
          <ScheduleOutlined className="md-note__icon" />
          <div className="md-note__body">You are viewing a teammate&rsquo;s day.</div>
        </div>
      )}

      {/* ═══ HEADER ═══ */}
      <header className="md-head">
        <div className="md-head__main">
          <div className="md-head__id">
            <h1 className="md-head__title">{greeting(now)}, {firstName}</h1>
            <div className="md-head__sub">{dayjs(now).format('dddd, D MMMM')} · {subLine}</div>
          </div>
          <div className="md-head__actions">
            <HowItWorks />
            <WorkdaySettings workday={workday} onChange={changeWorkday} />
            <button
              type="button"
              className={`md-btn${loading ? ' md-btn--busy' : ''}`}
              onClick={() => load()}
              disabled={loading}
            >
              <ReloadOutlined /> Refresh
            </button>
          </div>
        </div>

        <div className="md-progress">
          <div className="md-progress__meta">
            <span className="md-progress__label">
              {doneCount} of {doneCount + planned} completed {plan.isTomorrow ? 'in tomorrow’s plan' : 'today'}
            </span>
            <span className="md-progress__value">
              {summary.plannedMin > 0
                ? `${formatDuration(summary.plannedMin)} of ${formatDuration(summary.capacityMin)} available`
                : `${formatDuration(summary.capacityMin)} available`}
            </span>
          </div>
          <div
            className="md-progress__track"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${doneCount} of ${doneCount + planned} tasks completed`}
          >
            <div className={`md-progress__fill${pct >= 100 && doneCount > 0 ? ' is-complete' : ''}`} style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="md-stats">
          <div className={`md-stat${summary.mustCount > 0 ? ' md-stat--danger' : ''}`}>
            <span className="md-stat__label">Must do</span>
            <span className="md-stat__value">{summary.mustCount}</span>
            <span className="md-stat__note">{formatDuration(summary.mustMin)} booked</span>
          </div>
          <div className="md-stat">
            <span className="md-stat__label">If time allows</span>
            <span className="md-stat__value">{summary.shouldCount}</span>
            <span className="md-stat__note">{summary.laterCount} in later</span>
          </div>
          <div className={`md-stat${summary.reviewCount > 0 ? ' md-stat--accent' : ''}`}>
            <span className="md-stat__label">To review</span>
            <span className="md-stat__value">{summary.reviewCount}</span>
            <span className="md-stat__note">{summary.reviewMin > 0 ? `~${formatDuration(summary.reviewMin)} needed` : 'none waiting'}</span>
          </div>
          <div className="md-stat">
            <span className="md-stat__label">With reviewer</span>
            <span className="md-stat__value">{waitingCount}</span>
            <span className="md-stat__note">{waitingCount === 0 ? 'nothing blocked' : 'awaiting sign-off'}</span>
          </div>
          <div className="md-stat">
            <span className="md-stat__label">Done today</span>
            <span className="md-stat__value">{doneCount}</span>
            <span className="md-stat__note">{doneCount > 0 ? 'logged today' : 'none yet'}</span>
          </div>
        </div>

        <div className="md-status">
          <span className={`md-status__item md-status__health md-status__health--${healthChip.dot}`}>
            <span className={`md-status__dot ${healthChip.dot}`} />
            {healthChip.text}
          </span>
          <span className="md-status__item">
            <span className="md-status__dot" />
            <span className="md-status__text">{dayLabel}&rsquo;s capacity <b>{formatDuration(summary.capacityMin)}</b></span>
          </span>
          {overdueCount > 0 && (
            <span className="md-status__item">
              <span className="md-status__dot bad" />
              <span className="md-status__text"><b>{overdueCount}</b> overdue</span>
            </span>
          )}
          {plan.later.length > 0 && (
            <span className="md-status__item">
              <span className="md-status__dot" />
              <span className="md-status__text"><b>{plan.later.length}</b> not scheduled today</span>
            </span>
          )}
        </div>
      </header>

      {summary.health === 'overloaded' && (
        <div className="md-note md-note--bad">
          <WarningOutlined className="md-note__icon" />
          <span>
            Your must-do work is about <b>{formatDuration(summary.overflowMinutes)}</b> longer than the time you have{' '}
            {plan.isTomorrow ? 'tomorrow' : 'left today'}. Move anything that can wait with <b>Do later</b>, or ask your
            lead to re-assign or extend a deadline.
          </span>
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
        <div className="md-card md-clear">
          <SmileOutlined className="md-clear__icon" />
          <h2 className="md-clear__title">
            {doneCount > 0 ? 'Everything is cleared for today' : 'Nothing is assigned to you right now'}
          </h2>
          <Text className="md-quiet">
            {summary.reviewCount > 0
              ? 'You do have reviews waiting — teammates are counting on them.'
              : 'New work will appear here the moment it\'s assigned.'}
          </Text>
          <div className="md-clear__actions">
            <Button onClick={() => navigate('/tasks/operations')}>Browse all tasks</Button>
            {summary.reviewCount > 0 && <Button type="primary" onClick={() => navigate('/tasks/reviews')}>Open review queue</Button>}
          </div>
        </div>
      )}

      {/* ═══ PLAN + SIDE ═══ */}
      {hasContent && (
        <div className="md-grid">
          <div className="md-card">
            <div className="md-card__title">
              <span>{plan.isTomorrow ? 'Tomorrow’s plan' : 'Today’s plan'}</span>
              <span className="md-card__title-aside">
                {formatDuration(summary.plannedMin)} of {formatDuration(summary.capacityMin)} available
              </span>
            </div>
            <DayTimeline plan={plan} now={now} nextKey={nextKey} onOpen={openTask} />
          </div>

          <div className="md-stack">
            <ReviewsCard reviews={data?.reviews || []} />
            <MiniList
              title="Later" icon={<ScheduleOutlined />} items={laterItems} onOpen={openTask}
              renderExtra={(it) => it.deferred
                ? <Button type="link" size="small" onClick={(e) => { e.stopPropagation(); undefer(it.id); }}>Put back</Button>
                : null}
            />
            <MiniList title="With your reviewer" icon={WaitIcon} items={waitingItems} onOpen={openTask} />
            <MiniList title="Done today" icon={DoneIcon} items={doneItems} onOpen={openTask} tone="done" />
          </div>
        </div>
      )}

      <TaskViewResolver
        open={!!workspaceTask}
        onClose={() => setWorkspaceTask(null)}
        task={workspaceTask}
        onRefresh={() => load({ silent: true })}
      />
    </div>
  );
}
