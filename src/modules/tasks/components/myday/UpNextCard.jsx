import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, Checkbox, Input, Modal, Skeleton, Space, Typography, App, Tooltip } from 'antd';
import {
  ClockCircleOutlined, CalendarOutlined, ArrowRightOutlined, PauseCircleOutlined,
  PaperClipOutlined, CheckCircleFilled, ExclamationCircleOutlined, ExportOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import tasksApi from '../../services/tasksApi';
import { primaryAction, formatDuration, FRIENDLY_STATUS } from '../../utils/dayPlanner';
import { accentFor } from './myDayTheme';

const { Text } = Typography;

/**
 * The "do this now" card. A person should be able to start, work through every
 * step and submit a task from here without opening anything else.
 */
/** Render SOP text with clickable links (plain URLs only — never raw HTML). */
function linkify(text) {
  return String(text || '').split(/(https?:\/\/[^\s)]+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? <a key={i} href={part} target="_blank" rel="noopener noreferrer">{part}</a> : part);
}

export default function UpNextCard({ entry, eyebrow = 'Up next', onOpen, onDefer, onChanged }) {
  const { message } = App.useApp();
  const task = entry.task;
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');
  const accent = accentFor(task);

  const loadDetail = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const res = await tasksApi.getInstanceById(task.Id);
      if (res.success) setDetail(res.data);
    } catch { /* the card still works from list data */ }
    finally { if (!silent) setLoading(false); }
  }, [task.Id]);

  useEffect(() => { setDetail(null); setNote(''); loadDetail(); }, [loadDetail]);

  // Latest status/feedback comes from the detail (fresh after each action).
  const live = detail || task;
  const subTasks = detail?.subTasks || [];

  // "Steps left" = open activities, plus open sub-tasks that have no activities.
  const stepsLeft = useMemo(() => subTasks.reduce((n, st) => {
    if (st.IsCompleted) return n;
    const acts = st.activities || [];
    return n + (acts.length ? acts.filter(a => !a.IsCompleted).length : 1);
  }, 0), [subTasks]);

  const action = primaryAction(live, detail ? stepsLeft : 0);
  const lastFeedback = task.LastFeedback || detail?.reviews?.[0]?.Feedback;
  const showFeedback = (live.Status === 'REJECTED' || live.Status === 'REWORK') && lastFeedback;

  const run = async (toStatus, remarks = '') => {
    setBusy(true);
    try {
      await tasksApi.transitionStatus(task.Id, toStatus, remarks);
      message.success(toStatus === 'IN_PROGRESS' ? 'Started — you\'re on the clock' : toStatus === 'REWORK' ? 'Fixing started' : 'Sent for review 🎉');
      setNoteOpen(false); setNote('');
      await loadDetail({ silent: true });
      onChanged?.();
    } catch (err) { message.error(err.message || 'Could not update the task'); }
    finally { setBusy(false); }
  };

  const onPrimary = () => {
    if (!action.next) { onOpen?.(task.Id); return; }
    if (action.needsNote) { setNoteOpen(true); return; }
    run(action.next);
  };

  // Ticking the last step of a sub-task completes the sub-task too — one click, not two.
  const [howOpen, setHowOpen] = useState({});
  const toggleHow = (id) => setHowOpen(o => ({ ...o, [id]: !o[id] }));

  const tickActivity = async (st, act) => {
    if (act.IsCompleted || live.Status === 'ASSIGNED' || live.Status === 'ACCEPTED') return;
    setDetail(d => ({ ...d, subTasks: d.subTasks.map(s => (s.Id !== st.Id ? s : { ...s, activities: s.activities.map(a => (a.Id === act.Id ? { ...a, IsCompleted: true } : a)) })) }));
    try {
      await tasksApi.completeActivity(act.Id);
      const allDone = st.activities.every(a => a.Id === act.Id || a.IsCompleted);
      if (allDone) await tasksApi.completeSubTask(st.Id);
      await loadDetail({ silent: true });
      onChanged?.();
    } catch (err) { message.error(err.message || 'Could not save that step'); loadDetail({ silent: true }); }
  };

  const tickSubTask = async (st) => {
    if (st.IsCompleted || live.Status === 'ASSIGNED' || live.Status === 'ACCEPTED') return;
    try { await tasksApi.completeSubTask(st.Id); await loadDetail({ silent: true }); onChanged?.(); }
    catch (err) { message.error(err.message || 'Could not save that step'); }
  };

  const due = task.DueDate ? dayjs(task.DueDate) : null;
  const notStarted = live.Status === 'ASSIGNED' || live.Status === 'ACCEPTED';
  const totalSteps = subTasks.reduce((n, st) => n + ((st.activities || []).length || 1), 0);
  const evidence = detail?.evidence?.length ?? task.EvidenceCount ?? 0;

  return (
    <div className="md-next" style={{ '--md-accent': accent }}>
      <div className="md-next__bar" />
      <div className="md-next__body">
        <div className="md-next__left">
          <div className="md-eyebrow">{eyebrow} · {FRIENDLY_STATUS[live.Status] || live.Status}</div>
          <h2 className="md-next__title">{task.Title || task.TemplateName}</h2>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {entry.reasons.map(r => <span key={r.text} className={`md-reason ${r.tone}`}>{r.text}</span>)}
          </div>
          <Space size={16} wrap style={{ color: 'var(--bc-text-muted, #64748b)', fontSize: 13 }}>
            <span><ClockCircleOutlined /> about {formatDuration(entry.minutes)}</span>
            {due && <span><CalendarOutlined /> due {due.format('ddd D MMM, h:mm A')}</span>}
            {task.SellerName && <span>{task.SellerName}</span>}
            {task.SourceRef && task.Source === 'RULESET' && <span>Rule: {task.SourceRef}</span>}
          </Space>

          {showFeedback && (
            <div className="md-feedback"><b>Reviewer said:</b> {lastFeedback}</div>
          )}

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
            <Tooltip title={action.blocked ? 'Tick the remaining steps on the right first' : ''}>
              <Button type="primary" size="large" className="md-cta" loading={busy} disabled={action.blocked} onClick={onPrimary}
                icon={action.next ? <ArrowRightOutlined /> : undefined} style={{ background: action.blocked ? undefined : accent, borderColor: action.blocked ? undefined : accent }}>
                {action.label}
              </Button>
            </Tooltip>
            <Button onClick={() => onOpen?.(task.Id)} icon={<ExportOutlined />}>Full details</Button>
            <Button type="text" icon={<PauseCircleOutlined />} onClick={() => onDefer?.(task.Id)} style={{ color: 'var(--bc-text-muted, #64748b)' }}>Do later</Button>
          </div>

          {!loading && evidence === 0 && (live.Status === 'IN_PROGRESS' || live.Status === 'REWORK') && stepsLeft === 0 && (
            <Text style={{ fontSize: 12, color: '#9a3412' }}><ExclamationCircleOutlined /> No evidence attached yet — reviewers usually ask for it. <a onClick={() => onOpen?.(task.Id)}>Add a link</a></Text>
          )}
        </div>

        <div className="md-next__right">
          <div className="md-card__title" style={{ marginBottom: 6 }}>
            <span>Steps</span>
            <span style={{ textTransform: 'none', letterSpacing: 0 }}>{loading ? '' : `${totalSteps - stepsLeft}/${totalSteps} done`}</span>
          </div>
          {loading ? <Skeleton active paragraph={{ rows: 4 }} title={false} /> : subTasks.length === 0 ? (
            <Text style={{ fontSize: 13, color: 'var(--bc-text-muted, #94a3b8)' }}>This task has no checklist — just do it and submit.</Text>
          ) : (
            <>
              {notStarted && <div className="md-note info" style={{ marginBottom: 8, padding: '6px 10px', fontSize: 12 }}>Start the task to begin ticking steps.</div>}
              {subTasks.map(st => {
                const acts = st.activities || [];
                return (
                  <div key={st.Id}>
                    {acts.length > 0 && !(acts.length === 1 && acts[0].Title === st.Title) && <div className="md-step__group">{st.Title}</div>}
                    {acts.length === 0 ? (
                      <div className={`md-step${st.IsCompleted ? ' done' : ''}`}>
                        <Checkbox checked={!!st.IsCompleted} disabled={notStarted || st.IsCompleted} onChange={() => tickSubTask(st)} />
                        <span className="t">{st.Title}</span>
                      </div>
                    ) : acts.map(a => (
                      <div key={a.Id} className={`md-step${a.IsCompleted ? ' done' : ''}`}>
                        <Checkbox checked={!!a.IsCompleted} disabled={notStarted || a.IsCompleted} onChange={() => tickActivity(st, a)} />
                        <span className="t" style={{ flex: 1 }}>
                          {a.Title}
                          {a.Instructions && !a.IsCompleted && (
                            <button type="button" className="md-how__toggle" onClick={() => toggleHow(a.Id)}>{howOpen[a.Id] ? 'Hide steps' : 'How?'}</button>
                          )}
                          {a.ExpectedOutput && !a.IsCompleted ? <small style={{ display: 'block', color: 'var(--bc-text-muted, #94a3b8)' }}>{a.ExpectedOutput}</small> : null}
                          {howOpen[a.Id] && !a.IsCompleted && <div className="md-how">{linkify(a.Instructions)}</div>}
                        </span>
                        {a.IsCompleted && <CheckCircleFilled style={{ color: '#2E7D32' }} />}
                      </div>
                    ))}
                  </div>
                );
              })}
              {evidence > 0 && <Text style={{ fontSize: 12, color: 'var(--bc-text-muted, #64748b)', display: 'block', marginTop: 8 }}><PaperClipOutlined /> {evidence} evidence item{evidence > 1 ? 's' : ''} attached</Text>}
            </>
          )}
        </div>
      </div>

      <Modal
        open={noteOpen} onCancel={() => !busy && setNoteOpen(false)} destroyOnHidden
        title={action.next === 'RESUBMITTED' ? 'Resubmit for review' : 'Submit for review'}
        okText="Send to reviewer" confirmLoading={busy} okButtonProps={{ disabled: note.trim().length < 3 }}
        onOk={() => run(action.next, note.trim())}
      >
        <Text style={{ fontSize: 13, color: 'var(--bc-text-body, #475569)' }}>One line for your reviewer — what did you do?</Text>
        <Input.TextArea autoFocus rows={3} maxLength={1000} showCount value={note} onChange={(e) => setNote(e.target.value)} style={{ marginTop: 10 }}
          placeholder="e.g. Updated title and bullets for 12 ASINs, images replaced" />
      </Modal>
    </div>
  );
}
