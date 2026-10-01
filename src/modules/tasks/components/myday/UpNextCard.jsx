import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, Checkbox, Input, Modal, Skeleton, Space, Typography, App, Tooltip } from 'antd';
import {
  ClockCircleOutlined, CalendarOutlined, ArrowRightOutlined, PauseCircleOutlined,
  PaperClipOutlined, CheckCircleFilled, ExclamationCircleOutlined, ExportOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import BrandChecklist from '../BrandChecklist';
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

  const brands = detail?.brands || [];
  const brandsLeft = brands.filter(b => !b.IsCompleted).length;
  const action = primaryAction(live, detail ? stepsLeft + brandsLeft : 0);
  const lastFeedback = task.LastFeedback || detail?.reviews?.[0]?.Feedback;
  const showFeedback = (live.Status === 'REJECTED' || live.Status === 'REWORK') && lastFeedback;

  const run = async (toStatus, remarks = '') => {
    setBusy(true);
    try {
      await tasksApi.transitionStatus(task.Id, toStatus, remarks);
      message.success(toStatus === 'IN_PROGRESS' ? 'Task started' : toStatus === 'REWORK' ? 'Fixing started' : 'Sent for review');
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

  const [brandBusy, setBrandBusy] = useState(false);
  const toggleBrand = async (b, completed) => {
    setDetail(d => ({ ...d, brands: d.brands.map(x => (x.Id === b.Id ? { ...x, IsCompleted: completed } : x)) }));
    try { await tasksApi.setBrandCheck(task.Id, b.Id, completed); onChanged?.(); }
    catch (err) { message.error(err.message || 'Could not save that brand'); loadDetail({ silent: true }); }
  };
  const toggleAllBrands = async (completed) => {
    setBrandBusy(true);
    setDetail(d => ({ ...d, brands: d.brands.map(x => ({ ...x, IsCompleted: completed })) }));
    try { await tasksApi.setBrandCheck(task.Id, null, completed); onChanged?.(); }
    catch (err) { message.error(err.message || 'Could not save brands'); loadDetail({ silent: true }); }
    finally { setBrandBusy(false); }
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
  const accent = accentFor(task);

  return (
    <div className="md-next" style={{ '--md-accent': accent }}>
      <div className="md-next__bar" />
      <div className="md-next__body">
        <div className="md-next__left">
          <div className="md-eyebrow">{eyebrow} · {FRIENDLY_STATUS[live.Status] || live.Status}</div>
          <h2 className="md-next__title">{task.Title || task.TemplateName}</h2>
          <div className="md-reasons">
            {entry.reasons.map(r => <span key={r.text} className={`md-reason md-reason--${r.tone}`}>{r.text}</span>)}
          </div>
          <Space size={16} wrap className="md-meta">
            <span><ClockCircleOutlined /> about {formatDuration(entry.minutes)}</span>
            {due && <span><CalendarOutlined /> due {due.format('ddd D MMM, h:mm A')}</span>}
            {task.SellerName && <span>{task.SellerName}</span>}
            {task.SourceRef && task.Source === 'RULESET' && <span>Rule: {task.SourceRef}</span>}
          </Space>

          {showFeedback && (
            <div className="md-feedback">
              <b className="md-feedback__label">Reviewer said:</b> {lastFeedback}
            </div>
          )}

          <div className="md-next__actions">
            <Tooltip title={action.blocked ? 'Tick the remaining steps on the right first' : ''}>
              <Button
                type="primary"
                size="large"
                className={`md-cta md-cta--accent${action.blocked ? ' md-cta--blocked' : ''}`}
                loading={busy}
                disabled={action.blocked}
                onClick={onPrimary}
                icon={action.next ? <ArrowRightOutlined /> : undefined}
              >
                {action.label}
              </Button>
            </Tooltip>
            <Button onClick={() => onOpen?.(task.Id)} icon={<ExportOutlined />}>Full details</Button>
            <Button type="text" className="md-quiet" icon={<PauseCircleOutlined />} onClick={() => onDefer?.(task.Id)}>Do later</Button>
          </div>

          {!loading && evidence === 0 && (live.Status === 'IN_PROGRESS' || live.Status === 'REWORK') && stepsLeft === 0 && (
            <Text className="md-hint warn">
              <ExclamationCircleOutlined /> No evidence attached yet — reviewers usually ask for it.{' '}
              <a onClick={() => onOpen?.(task.Id)}>Add a link</a>
            </Text>
          )}
        </div>

        <div className="md-next__right">
          <div className="md-card__title">
            <span>Steps</span>
            <span className="md-card__title-aside">{loading ? '' : `${totalSteps - stepsLeft}/${totalSteps} done`}</span>
          </div>
          {loading ? <Skeleton active paragraph={{ rows: 4 }} title={false} /> : subTasks.length === 0 ? (
            <Text className="md-sub">This task has no checklist — just do it and submit.</Text>
          ) : (
            <>
              {notStarted && (
                <div className="md-note md-note--info md-note--sm">Start the task to begin ticking steps.</div>
              )}
              {subTasks.map(st => {
                const acts = st.activities || [];
                return (
                  <div key={st.Id}>
                    {acts.length > 0 && !(acts.length === 1 && acts[0].Title === st.Title) && (
                      <div className="md-step__group">{st.Title}</div>
                    )}
                    {acts.length === 0 ? (
                      <div className={`md-step${st.IsCompleted ? ' done' : ''}`}>
                        <Checkbox checked={!!st.IsCompleted} disabled={notStarted || st.IsCompleted} onChange={() => tickSubTask(st)} />
                        <span className="md-step__body">
                          <span className="md-step__label">{st.Title}</span>
                        </span>
                      </div>
                    ) : acts.map(a => (
                      <div key={a.Id} className={`md-step${a.IsCompleted ? ' done' : ''}`}>
                        <Checkbox checked={!!a.IsCompleted} disabled={notStarted || a.IsCompleted} onChange={() => tickActivity(st, a)} />
                        <span className="md-step__body">
                          <span className="md-step__label">
                            {a.Title}
                            {a.Instructions && !a.IsCompleted && (
                              <button type="button" className="md-how__toggle" onClick={() => toggleHow(a.Id)}>
                                {howOpen[a.Id] ? 'Hide steps' : 'How?'}
                              </button>
                            )}
                          </span>
                          {a.ExpectedOutput && !a.IsCompleted && <small className="md-step__output">{a.ExpectedOutput}</small>}
                          {howOpen[a.Id] && !a.IsCompleted && <div className="md-how">{linkify(a.Instructions)}</div>}
                        </span>
                        {a.IsCompleted && <CheckCircleFilled className="md-step__done" />}
                      </div>
                    ))}
                  </div>
                );
              })}
              <BrandChecklist
                brands={brands}
                busy={brandBusy}
                canEdit={!notStarted && !['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'].includes(live.Status)}
                hint="Start the task to tick brands."
                onToggle={toggleBrand}
                onToggleAll={toggleAllBrands}
              />
              {evidence > 0 && (
                <Text className="md-tiny md-evidence">
                  <PaperClipOutlined /> {evidence} evidence item{evidence > 1 ? 's' : ''} attached
                </Text>
              )}
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
        <Text className="md-sub">One line for your reviewer — what did you do?</Text>
        <Input.TextArea
          autoFocus rows={3} maxLength={1000} showCount value={note}
          onChange={(e) => setNote(e.target.value)}
          className="md-note-input"
          placeholder="e.g. Updated title and bullets for 12 ASINs, images replaced"
        />
      </Modal>
    </div>
  );
}