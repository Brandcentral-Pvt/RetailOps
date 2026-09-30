import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Drawer, Typography, Space, Tag, Button, Progress, Tabs, Rate, Input, Spin, Empty, Tooltip, Avatar, Checkbox, App, Badge } from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, RollbackOutlined, ThunderboltOutlined,
  FileTextOutlined, SendOutlined, LeftOutlined, RightOutlined, CloseOutlined, ExportOutlined,
  ExclamationCircleOutlined, SafetyCertificateOutlined, LinkOutlined, MinusCircleOutlined,
  InfoCircleOutlined, CommentOutlined, HistoryOutlined, PaperClipOutlined, LockOutlined,
} from '@ant-design/icons';
import tasksApi from '../services/tasksApi';
import { WORKFLOW_STATUSES, FREQUENCIES, PRIORITIES } from '../constants';
import { calculateHealth, getDueDateLabel } from '../utils/taskHealth';
import { hasPermission, getUserId } from '../utils/rbac';
import { useAuth } from '../../../contexts/AuthContext';
import { formatMinutes } from './ReviewExecutiveKpis';
import dayjs from 'dayjs';

const { Text } = Typography;

const REVIEWABLE = ['SUBMITTED', 'RESUBMITTED', 'ESCALATED', 'UNDER_REVIEW'];
const GLOBAL_ROLES = ['admin', 'super_admin', 'developer', 'operational_manager']; // mirrors backend roleUtils
const SCORE_DIMENSIONS = [
  { key: 'accuracy', label: 'Accuracy' },
  { key: 'completeness', label: 'Completeness' },
  { key: 'evidence', label: 'Evidence quality' },
  { key: 'compliance', label: 'Compliance / SOP' },
];

const parseArr = (v) => { if (Array.isArray(v)) return v; try { const p = JSON.parse(v || '[]'); return Array.isArray(p) ? p : []; } catch { return []; } };
const isHttpUrl = (u) => typeof u === 'string' && /^https?:\/\//i.test(u.trim());
const initials = (n = '') => n.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?';
const fmt = (d, f = 'DD MMM YYYY, h:mm A') => (d ? dayjs(d).format(f) : '—');

const Section = ({ title, icon, right, children }) => (
  <div style={{ marginBottom: 18 }}>
    <div className="rv-card__title" style={{ marginBottom: 8 }}>
      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>{icon}{title}</span>{right}
    </div>
    {children}
  </div>
);

/**
 * Objective readiness checks computed from the real task record.
 * Each: { key, label, state: 'pass' | 'fail' | 'na', value }
 */
function buildChecks(task, subTasks, fixState) {
  const total = subTasks.length;
  const doneSteps = subTasks.filter(st => st.IsCompleted).length;
  const ev = task.evidence?.length || 0;
  const checks = [];

  if (Number(task.Target) > 0) {
    const pct = Number(task.AchievementPct) || 0;
    checks.push({ key: 'target', label: 'Target achieved (≥ 80%)', state: pct >= 80 ? 'pass' : 'fail', value: `${pct}%` });
  } else checks.push({ key: 'target', label: 'Target achieved', state: 'na', value: 'No target' });

  checks.push(total
    ? { key: 'steps', label: 'All SOP steps complete', state: doneSteps === total ? 'pass' : 'fail', value: `${doneSteps}/${total}` }
    : { key: 'steps', label: 'All SOP steps complete', state: 'na', value: 'No steps' });

  checks.push({ key: 'evidence', label: 'Evidence attached', state: ev > 0 ? 'pass' : 'fail', value: `${ev} item${ev === 1 ? '' : 's'}` });
  checks.push({ key: 'notes', label: 'Submission notes provided', state: task.SubmissionRemarks?.trim() ? 'pass' : 'fail', value: task.SubmissionRemarks?.trim() ? 'Yes' : 'Missing' });
  checks.push({ key: 'rework', label: 'No previous rework', state: (task.ReworkCount || 0) === 0 ? 'pass' : 'fail', value: (task.ReworkCount || 0) === 0 ? 'Clean' : `${task.ReworkCount}× reworked` });

  if (task.Source === 'RULESET') {
    checks.push({
      key: 'fix', label: 'Rule no longer flags ASINs',
      state: fixState.status === 'success' ? 'pass' : fixState.status === 'mismatch' ? 'fail' : 'na',
      value: fixState.status === 'success' ? 'Verified' : fixState.status === 'mismatch' ? 'Still flagged' : fixState.status === 'unavailable' ? 'Unavailable' : 'Not checked',
    });
  }
  return checks;
}

export default function ReviewWorkspace({ open, onClose, taskId, onRefresh, queueIds = [], onNavigate }) {
  const { message, modal } = App.useApp();
  const { user: currentUser } = useAuth();
  const meId = getUserId(currentUser);
  const roleName = String(currentUser?.role?.name || currentUser?.role || '').toLowerCase();

  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState('summary');

  const [scores, setScores] = useState({ accuracy: 0, completeness: 0, evidence: 0, compliance: 0 });
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(null); // 'APPROVE' | 'REJECT' | null
  const [feedbackError, setFeedbackError] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(() => localStorage.getItem('review.autoAdvance') !== '0');

  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);
  const [verify, setVerify] = useState({ loading: false, status: null, message: '', checkedAt: null });
  const [myStats, setMyStats] = useState(null);
  const openedAt = useRef(Date.now());

  const canApprove = hasPermission(currentUser, 'review.approve');
  const canReject = hasPermission(currentUser, 'review.reject');

  const loadTask = useCallback(async ({ silent = false } = {}) => {
    if (!taskId) return;
    if (!silent) setLoading(true);
    setLoadError('');
    try {
      const res = await tasksApi.getInstanceById(taskId);
      if (res.success) setTask(res.data); else setLoadError(res.error || 'Task not found');
    } catch (err) { setLoadError(err.message || 'Failed to load task'); }
    finally { if (!silent) setLoading(false); }
  }, [taskId]);

  // Reset per-task state whenever we move to another task.
  useEffect(() => {
    if (!open || !taskId) return;
    setTask(null); setTab('summary'); setFeedback(''); setFeedbackError(false); setCommentText('');
    setScores({ accuracy: 0, completeness: 0, evidence: 0, compliance: 0 });
    setVerify({ loading: false, status: null, message: '', checkedAt: null });
    openedAt.current = Date.now();
    loadTask();
  }, [open, taskId, loadTask]);

  useEffect(() => {
    if (!open) return;
    tasksApi.getReviewStats().then(r => { if (r.success) setMyStats(r.data.mine); }).catch(() => {});
  }, [open, taskId]);

  // Seed the verify state from the last persisted verification (audit trail).
  useEffect(() => {
    if (!task) return;
    const last = (task.auditLogs || []).find(l => l.Action === 'FIX_VERIFIED' || l.Action === 'FIX_NOT_VERIFIED');
    if (last) setVerify(v => (v.status ? v : {
      loading: false, status: last.Action === 'FIX_VERIFIED' ? 'success' : 'mismatch', message: last.Details || '', checkedAt: last.CreatedAt,
    }));
  }, [task]);

  const subTasks = task?.subTasks || [];
  const isRuleTask = !!task && (task.Source === 'RULESET' || task.IsRuleTask);
  const asins = task ? parseArr(task.Asins) : [];
  const checks = useMemo(() => (task ? buildChecks(task, subTasks, verify) : []), [task, subTasks, verify]);
  const failing = checks.filter(c => c.state === 'fail');
  const fixMismatch = verify.status === 'mismatch';
  const reco = failing.length === 0
    ? { cls: 'good', icon: <CheckCircleOutlined />, text: 'All checks pass — looks ready to approve' }
    : (fixMismatch || failing.length >= 3)
      ? { cls: 'bad', icon: <CloseCircleOutlined />, text: `${failing.length} check${failing.length > 1 ? 's' : ''} failing — consider sending back` }
      : { cls: 'warn', icon: <ExclamationCircleOutlined />, text: `${failing.length} check${failing.length > 1 ? 's' : ''} need attention` };

  const ratedDims = SCORE_DIMENSIONS.filter(d => scores[d.key] > 0);
  const qualityScore = ratedDims.length ? Math.round((ratedDims.reduce((s, d) => s + scores[d.key], 0) / ratedDims.length) * 20) : null;

  const reviewable = !!task && REVIEWABLE.includes(task.Status);
  const isOwnTask = !!task && !!meId && task.AssignedTo === meId && !GLOBAL_ROLES.includes(roleName);
  const canDecide = reviewable && !isOwnTask;

  // ── Queue navigation ──
  const idx = queueIds.indexOf(taskId);
  const prevId = idx > 0 ? queueIds[idx - 1] : null;
  const nextIdAfter = (id) => { const i = queueIds.indexOf(id); return i >= 0 ? (queueIds[i + 1] || queueIds[i - 1] || null) : null; };
  const nextId = idx >= 0 ? queueIds[idx + 1] || null : null;

  // ── Decision ──
  const submitDecision = async (decision) => {
    const text = feedback.trim();
    if (decision === 'REJECT' && text.length < 5) {
      setFeedbackError(true); message.warning('Explain what needs to be fixed (at least a few words)'); return;
    }
    setSubmitting(decision);
    try {
      const reviewChecklist = [
        ...ratedDims.map(d => ({ key: d.key, label: d.label, score: scores[d.key] })),
        ...checks.filter(c => c.state !== 'na').map(c => ({ key: `check:${c.key}`, label: c.label, passed: c.state === 'pass' })),
      ];
      const minutes = Math.max(1, Math.round((Date.now() - openedAt.current) / 60000));
      const advanceTo = autoAdvance ? nextIdAfter(taskId) : null;
      // One call: the server claims the task, records the review and applies the transition atomically.
      await tasksApi.submitReview({
        taskInstanceId: taskId, decision, feedback: text, qualityScore,
        reviewChecklist, reviewDurationMinutes: minutes,
      });
      message.success(decision === 'APPROVE' ? `${task.InstanceCode} approved` : `${task.InstanceCode} sent back for rework`);
      onRefresh?.();
      if (advanceTo && onNavigate) onNavigate(advanceTo); else onClose?.();
    } catch (err) {
      message.error(err.message || 'Could not record the review');
      loadTask({ silent: true }); // state may have changed under us (another reviewer)
    } finally { setSubmitting(null); }
  };

  const approve = () => {
    if (failing.length === 0) { submitDecision('APPROVE'); return; }
    modal.confirm({
      title: `Approve with ${failing.length} failing check${failing.length > 1 ? 's' : ''}?`,
      icon: <ExclamationCircleOutlined />,
      content: (
        <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
          {failing.map(c => <li key={c.key} style={{ fontSize: 13 }}>{c.label} — <b>{c.value}</b></li>)}
        </ul>
      ),
      okText: 'Approve anyway', cancelText: 'Go back',
      onOk: () => submitDecision('APPROVE'),
    });
  };

  const postComment = async () => {
    const text = commentText.trim();
    if (!text) return;
    setPosting(true);
    try {
      await tasksApi.addComment(taskId, text);
      setCommentText('');
      await loadTask({ silent: true });
    } catch (err) { message.error(err.message || 'Could not post comment'); }
    finally { setPosting(false); }
  };

  const runVerify = async () => {
    setVerify(v => ({ ...v, loading: true }));
    try {
      const res = await tasksApi.verifyFix(taskId);
      setVerify({ loading: false, status: res.status, message: res.message, checkedAt: res.checkedAt });
      loadTask({ silent: true });
    } catch (err) {
      setVerify(v => ({ ...v, loading: false })); message.error(err.message || 'Verification failed');
    }
  };

  // Keyboard: J / K (or ← →) to move through the queue when not typing.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable || e.metaKey || e.ctrlKey) return;
      if ((e.key === 'j' || e.key === 'ArrowRight') && nextId) onNavigate?.(nextId);
      if ((e.key === 'k' || e.key === 'ArrowLeft') && prevId) onNavigate?.(prevId);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, nextId, prevId, onNavigate]);

  const health = task ? calculateHealth(task) : null;
  const dueLabel = task ? getDueDateLabel(task) : null;
  const statusMeta = task ? WORKFLOW_STATUSES[task.Status] : null;
  const totalActs = subTasks.reduce((s, st) => s + (st.activities?.length || 0), 0);
  const doneActs = subTasks.reduce((s, st) => s + (st.activities?.filter(a => a.IsCompleted).length || 0), 0);
  const waitMin = task?.SubmittedAt ? Math.max(0, Math.round((Date.now() - new Date(task.SubmittedAt).getTime()) / 60000)) : null;
  const comments = task?.comments || [];
  const reviews = task?.reviews || [];
  const evidence = task?.evidence || [];
  const activity = (task?.auditLogs || []).filter(l => l.Action !== 'COMMENT');

  // ═════════════ TABS ═════════════
  const summaryTab = task && (
    <div>
      {/* assignee's submission note — the first thing a reviewer needs */}
      <Section title="Submission notes" icon={<FileTextOutlined />}>
        {task.SubmissionRemarks?.trim()
          ? <div className="rv-card" style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: 'var(--bc-text-body, #334155)' }}>{task.SubmissionRemarks}</div>
          : <div className="rv-card" style={{ color: 'var(--bc-text-muted, #94a3b8)', fontSize: 13 }}>The assignee did not add submission notes.</div>}
      </Section>

      {isRuleTask && (
        <div style={{ padding: '14px 16px', borderRadius: 12, background: 'linear-gradient(135deg,#ecfeff,#ede9fe)', border: '1px solid #bae6fd', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#0891b2,#7c3aed)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ThunderboltOutlined /></div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <Text strong style={{ fontSize: 13, display: 'block' }}>Created by an automation rule</Text>
              <Text style={{ fontSize: 12, color: '#475569' }}>{task.SourceRef ? <>Rule: <b>{task.SourceRef}</b></> : 'Ruleset-generated task'} · {asins.length} ASIN{asins.length === 1 ? '' : 's'}</Text>
            </div>
            <Button size="small" icon={<ExportOutlined />} style={{ borderRadius: 8, fontWeight: 600 }}
              onClick={() => window.open(task.SourceId ? `/rule-sets/${task.SourceId}` : '/rule-sets', '_blank', 'noopener')}>Open rule</Button>
            <Button size="small" type="primary" loading={verify.loading} icon={<SafetyCertificateOutlined />} onClick={runVerify}
              style={{ borderRadius: 8, fontWeight: 600, background: 'linear-gradient(135deg,#0891b2,#7c3aed)', border: 'none' }}>
              {verify.status ? 'Re-verify fix' : 'Verify fix'}
            </Button>
          </div>
          {verify.status && (
            <div style={{ marginTop: 10, fontSize: 12, fontWeight: 600, color: verify.status === 'success' ? '#166534' : verify.status === 'mismatch' ? '#991b1b' : '#92400e' }}>
              {verify.status === 'success' ? <CheckCircleOutlined /> : verify.status === 'mismatch' ? <CloseCircleOutlined /> : <ExclamationCircleOutlined />} {verify.message}
              {verify.checkedAt && <span style={{ fontWeight: 400, color: '#64748b' }}> · checked {fmt(verify.checkedAt, 'DD MMM, h:mm A')}</span>}
            </div>
          )}
          {asins.length > 0 && (
            <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {asins.slice(0, 20).map(a => <Text code key={a} style={{ fontSize: 10, margin: 0 }}>{a}</Text>)}
              {asins.length > 20 && <Text style={{ fontSize: 11, color: '#64748b' }}>+{asins.length - 20} more</Text>}
            </div>
          )}
        </div>
      )}

      <Section title="Performance">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { label: 'Target', value: task.Target || 0, color: '#1976D2' },
            { label: 'Achievement', value: task.Achievement || 0, color: '#2E7D32' },
            { label: 'Achievement %', value: `${task.AchievementPct || 0}%`, color: (task.AchievementPct || 0) >= 80 ? '#2E7D32' : '#ED6C02' },
            { label: 'Variance', value: `${(task.Variance || 0) >= 0 ? '+' : ''}${task.Variance || 0}`, color: (task.Variance || 0) >= 0 ? '#2E7D32' : '#D32F2F' },
            { label: 'Progress', value: `${task.WeightedProgressPct || task.ProgressPct || 0}%`, color: '#7B1FA2' },
          ].map(m => (
            <div key={m.label} style={{ flex: '1 1 110px', padding: '8px 10px', borderRadius: 'var(--radius-md)', background: `${m.color}0D`, border: `1px solid ${m.color}22`, textAlign: 'center' }}>
              <Text style={{ fontSize: 9, color: 'var(--bc-text-muted, #94a3b8)', fontWeight: 700, textTransform: 'uppercase' }}>{m.label}</Text>
              <div style={{ fontSize: 18, fontWeight: 800, color: m.color }}>{m.value}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Details">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8 }}>
          {[
            ['Seller', task.SellerName], ['Department', task.Department], ['Submitted by', task.AssigneeName], ['Reviewer', task.ReviewerName || 'Unassigned'],
            ['Frequency', FREQUENCIES.find(f => f.value === task.Frequency)?.label], ['SLA', task.SLAHours ? `${task.SLAHours}h` : null],
            ['Due', task.DueDate ? fmt(task.DueDate, 'DD MMM YYYY') : null, dueLabel?.color], ['Submitted', task.SubmittedAt ? fmt(task.SubmittedAt) : null],
          ].map(([label, value, color]) => (
            <div key={label} style={{ padding: '8px 10px', background: 'var(--bc-surface-subtle, #f8fafc)', borderRadius: 8, border: '1px solid var(--bc-border-subtle, #f1f5f9)' }}>
              <Text style={{ fontSize: 9, color: 'var(--bc-text-muted, #94a3b8)', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>{label}</Text>
              <Text strong style={{ fontSize: 12, color: color || 'var(--bc-text-heading, #0f172a)' }}>{value || '—'}</Text>
            </div>
          ))}
        </div>
      </Section>

      <Section title={`SOP steps · ${doneActs}/${totalActs}`} icon={<CheckCircleOutlined />}>
        {subTasks.length === 0 ? <Text style={{ fontSize: 12, color: 'var(--bc-text-muted, #94a3b8)' }}>No SOP steps defined for this task.</Text> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {subTasks.map(st => {
              const d = st.activities?.filter(a => a.IsCompleted).length || 0; const t = st.activities?.length || 0;
              return (
                <div key={st.Id} style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${st.IsCompleted ? '#bbf7d0' : 'var(--bc-border-subtle, #e2e8f0)'}`, background: st.IsCompleted ? '#f0fdf4' : 'var(--bc-surface-card, #fff)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {st.IsCompleted ? <CheckCircleOutlined style={{ color: '#2E7D32' }} /> : <ClockCircleOutlined style={{ color: '#94a3b8' }} />}
                    <Text style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{st.Title}</Text>
                    {t > 0 && <Text style={{ fontSize: 11, color: '#64748b' }}>{d}/{t}</Text>}
                  </div>
                  {t > 0 && (
                    <div style={{ marginTop: 6, paddingLeft: 24, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {st.activities.map(a => (
                        <Text key={a.Id} style={{ fontSize: 12, color: a.IsCompleted ? '#475569' : '#94a3b8', textDecoration: a.IsCompleted ? 'none' : 'none' }}>
                          {a.IsCompleted ? '✓' : '○'} {a.Title || a.Description || `Step ${a.StepNo}`}
                        </Text>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );

  const evidenceTab = (
    evidence.length === 0
      ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No evidence was attached to this task" />
      : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {evidence.map(ev => {
            const linkOk = isHttpUrl(ev.FileUrl);
            return (
              <div key={ev.Id} className="rv-card" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--bc-surface-subtle, #f8fafc)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#1976D2' }}>
                  {ev.FileType === 'LINK' ? <LinkOutlined /> : <FileTextOutlined />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text strong style={{ fontSize: 13, display: 'block' }} ellipsis>{ev.FileName || 'Untitled'}</Text>
                  {ev.FileUrl && <Text style={{ fontSize: 11, color: '#64748b', display: 'block' }} ellipsis>{ev.FileUrl}</Text>}
                  <Text style={{ fontSize: 10, color: 'var(--bc-text-muted, #94a3b8)' }}>{ev.UploadedByName || 'Unknown'} · {fmt(ev.UploadedAt)}</Text>
                  {ev.Remarks && <div style={{ marginTop: 6, padding: '6px 8px', background: 'var(--bc-surface-subtle, #f8fafc)', borderRadius: 6, fontSize: 12, color: '#475569' }}>{ev.Remarks}</div>}
                </div>
                <Tooltip title={linkOk ? 'Open in a new tab' : 'No valid link'}>
                  <Button size="small" icon={<ExportOutlined />} disabled={!linkOk}
                    onClick={() => window.open(ev.FileUrl.trim(), '_blank', 'noopener,noreferrer')} style={{ borderRadius: 6 }}>Open</Button>
                </Tooltip>
              </div>
            );
          })}
        </div>
      )
  );

  const discussionTab = (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Input.TextArea
          value={commentText} onChange={e => setCommentText(e.target.value)} maxLength={2000} autoSize={{ minRows: 2, maxRows: 6 }}
          placeholder="Ask the assignee a question or leave a note for the next reviewer…"
          onPressEnter={(e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); postComment(); } }}
        />
        <Button type="primary" icon={<SendOutlined />} loading={posting} disabled={!commentText.trim()} onClick={postComment} style={{ alignSelf: 'flex-end', borderRadius: 6 }}>Post</Button>
      </div>
      {comments.length === 0
        ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No comments yet" />
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {comments.map(c => (
              <div key={c.Id} className="rv-comment">
                <Avatar size={30} style={{ background: c.ActorId === meId ? '#1976D2' : '#64748b', fontWeight: 700, fontSize: 11, flexShrink: 0 }}>{initials(c.ActorName)}</Avatar>
                <div className="rv-comment__bubble">
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 2 }}>
                    <Text strong style={{ fontSize: 12 }}>{c.ActorName || 'Unknown'}</Text>
                    <Text style={{ fontSize: 10, color: 'var(--bc-text-muted, #94a3b8)' }}>{fmt(c.CreatedAt, 'DD MMM, h:mm A')}</Text>
                  </div>
                  <Text style={{ fontSize: 13, whiteSpace: 'pre-wrap', color: 'var(--bc-text-body, #334155)' }}>{c.Details}</Text>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );

  const historyTab = (
    <div>
      <Section title={`Review decisions · ${reviews.length}`} icon={<SafetyCertificateOutlined />}>
        {reviews.length === 0 ? <Text style={{ fontSize: 12, color: 'var(--bc-text-muted, #94a3b8)' }}>No review has been recorded on this task yet.</Text> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {reviews.map(r => {
              const ok = r.Decision === 'APPROVE';
              return (
                <div key={r.Id} className="rv-hist" style={{ '--rv-accent': ok ? '#2E7D32' : '#D32F2F' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Tag style={{ margin: 0, border: 'none', fontWeight: 700, background: ok ? '#ecfdf5' : '#fef2f2', color: ok ? '#166534' : '#991b1b' }}>{ok ? 'Approved' : 'Sent back'}</Tag>
                    <Text strong style={{ fontSize: 12 }}>{r.ReviewerName || 'Reviewer'}</Text>
                    {r.QualityScore != null && <Text style={{ fontSize: 11, color: '#64748b' }}>Quality {r.QualityScore}/100</Text>}
                    <Text style={{ fontSize: 11, color: 'var(--bc-text-muted, #94a3b8)', marginLeft: 'auto' }}>{fmt(r.CreatedAt)}</Text>
                  </div>
                  {r.Feedback && <div style={{ marginTop: 6, fontSize: 13, whiteSpace: 'pre-wrap', color: 'var(--bc-text-body, #334155)' }}>{r.Feedback}</div>}
                </div>
              );
            })}
          </div>
        )}
      </Section>
      <Section title="Activity" icon={<HistoryOutlined />}>
        {activity.length === 0 ? <Text style={{ fontSize: 12, color: 'var(--bc-text-muted, #94a3b8)' }}>No events.</Text> : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {activity.slice(0, 25).map(l => (
              <div key={l.Id} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--bc-border-subtle, #f1f5f9)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#94a3b8', marginTop: 6, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 12, fontWeight: 600 }}>{String(l.Action || '').replace(/_/g, ' ')}{l.FromStatus && l.ToStatus ? ` · ${l.FromStatus} → ${l.ToStatus}` : ''}</Text>
                  {l.Details && <Text style={{ fontSize: 12, color: '#64748b', display: 'block' }} ellipsis>{l.Details}</Text>}
                  <Text style={{ fontSize: 10, color: 'var(--bc-text-muted, #94a3b8)' }}>{l.ActorName || 'System'} · {fmt(l.CreatedAt, 'DD MMM, h:mm A')}</Text>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );

  const tabItems = [
    { key: 'summary', label: <span><InfoCircleOutlined /> Summary</span>, children: summaryTab },
    { key: 'evidence', label: <span><PaperClipOutlined /> Evidence <Badge count={evidence.length} showZero color={evidence.length ? '#1976D2' : '#D32F2F'} size="small" style={{ marginLeft: 4 }} /></span>, children: evidenceTab },
    { key: 'discussion', label: <span><CommentOutlined /> Discussion <Badge count={comments.length} color="#64748b" size="small" style={{ marginLeft: 4 }} /></span>, children: discussionTab },
    { key: 'history', label: <span><HistoryOutlined /> History <Badge count={reviews.length} color="#7B1FA2" size="small" style={{ marginLeft: 4 }} /></span>, children: historyTab },
  ];

  // ═════════════ RENDER ═════════════
  return (
    <Drawer open={open} onClose={onClose} size="min(1180px, 96vw)" destroyOnHidden closable={false}
      styles={{ body: { padding: 0 }, header: { display: 'none' } }}>
      {loading || !task ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 12 }}>
          {loadError ? (
            <>
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={loadError} />
              <Space><Button onClick={() => loadTask()}>Retry</Button><Button onClick={onClose}>Close</Button></Space>
            </>
          ) : <Spin size="large" />}
        </div>
      ) : (
        <div className="rv-ws">
          {/* ═══ HEADER ═══ */}
          <div className="rv-ws__head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flexWrap: 'wrap' }}>
              <Button type="text" icon={<CloseOutlined />} onClick={onClose} aria-label="Close" />
              <span className="rv-code">{task.InstanceCode}</span>
              <Tag style={{ margin: 0, borderRadius: 10, fontWeight: 600, background: statusMeta?.bg, color: statusMeta?.color, border: `1px solid ${statusMeta?.color}30` }}>{statusMeta?.label || task.Status}</Tag>
              <Tag style={{ margin: 0, borderRadius: 6, border: 'none', fontWeight: 600, background: PRIORITIES[task.Priority]?.bg, color: PRIORITIES[task.Priority]?.color }}>{PRIORITIES[task.Priority]?.label || task.Priority}</Tag>
              {isRuleTask && <span className="rv-pill auto"><ThunderboltOutlined /> Automation</span>}
              {(task.ReworkCount || 0) > 0 && <span className="rv-pill rework">Rework ×{task.ReworkCount}</span>}
              <Tooltip title={`Health ${health?.score}/100 · ${health?.label}`}><span style={{ width: 8, height: 8, borderRadius: '50%', background: health?.color }} /></Tooltip>
              <Text strong style={{ fontSize: 15, color: 'var(--bc-text-heading, #0f172a)' }}>{task.Title || task.TemplateName}</Text>
            </div>
            <Space size={10}>
              {waitMin !== null && <Text style={{ fontSize: 12, color: waitMin >= 1440 ? '#D32F2F' : '#64748b' }}><ClockCircleOutlined /> Waiting {formatMinutes(waitMin)}</Text>}
              {dueLabel && <Text strong style={{ fontSize: 12, color: dueLabel.color }}>{dueLabel.text}</Text>}
              {idx >= 0 && (
                <Space.Compact size="small">
                  <Tooltip title="Previous (K / ←)"><Button icon={<LeftOutlined />} disabled={!prevId} onClick={() => onNavigate?.(prevId)} /></Tooltip>
                  <Button disabled style={{ color: '#475569', cursor: 'default' }}>{idx + 1} / {queueIds.length}</Button>
                  <Tooltip title="Next (J / →)"><Button icon={<RightOutlined />} disabled={!nextId} onClick={() => onNavigate?.(nextId)} /></Tooltip>
                </Space.Compact>
              )}
            </Space>
          </div>

          {/* ═══ MAIN ═══ */}
          <div className="rv-ws__main">
            <Tabs activeKey={tab} onChange={setTab} items={tabItems} />
          </div>

          {/* ═══ DECISION RAIL ═══ */}
          <div className="rv-ws__rail">
            <div className="rv-card">
              <div className="rv-card__title"><span>Readiness checks</span><span style={{ textTransform: 'none', letterSpacing: 0 }}>{checks.filter(c => c.state === 'pass').length}/{checks.filter(c => c.state !== 'na').length} pass</span></div>
              {checks.map(c => (
                <div className="rv-check" key={c.key}>
                  {c.state === 'pass' ? <CheckCircleOutlined style={{ color: '#2E7D32' }} /> : c.state === 'fail' ? <CloseCircleOutlined style={{ color: '#D32F2F' }} /> : <MinusCircleOutlined style={{ color: '#cbd5e1' }} />}
                  <span className="rv-check__label">{c.label}</span>
                  <span className="rv-check__val" style={{ color: c.state === 'pass' ? '#2E7D32' : c.state === 'fail' ? '#D32F2F' : '#94a3b8' }}>{c.value}</span>
                </div>
              ))}
              <div className={`rv-reco ${reco.cls}`}>{reco.icon}<span>{reco.text}</span></div>
            </div>

            <div className="rv-card rv-decision">
              <div className="rv-card__title"><span>Your decision</span>{qualityScore !== null && <span style={{ textTransform: 'none', letterSpacing: 0, color: '#1976D2', fontWeight: 800 }}>Quality {qualityScore}/100</span>}</div>

              {!reviewable && (
                <div className="rv-reco warn" style={{ marginTop: 0 }}><LockOutlined /><span>This task is <b>{statusMeta?.label || task.Status}</b> — it is not awaiting review.</span></div>
              )}
              {reviewable && isOwnTask && (
                <div className="rv-reco warn" style={{ marginTop: 0 }}><LockOutlined /><span>This task is assigned to you, so someone else must review it.</span></div>
              )}

              {canDecide && (
                <>
                  <div style={{ marginBottom: 10 }}>
                    <Text style={{ fontSize: 10, fontWeight: 700, color: 'var(--bc-text-muted, #94a3b8)', textTransform: 'uppercase' }}>Quality rating (optional)</Text>
                    {SCORE_DIMENSIONS.map(d => (
                      <div key={d.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0' }}>
                        <Text style={{ fontSize: 12 }}>{d.label}</Text>
                        <Rate value={scores[d.key]} onChange={(v) => setScores(s => ({ ...s, [d.key]: v }))} style={{ fontSize: 15 }} />
                      </div>
                    ))}
                  </div>
                  <Input.TextArea
                    value={feedback} maxLength={4000} autoSize={{ minRows: 3, maxRows: 8 }}
                    status={feedbackError ? 'error' : undefined}
                    onChange={(e) => { setFeedback(e.target.value); if (feedbackError) setFeedbackError(false); }}
                    placeholder="Feedback for the assignee — required to send back, optional to approve"
                  />
                  {feedbackError && <Text type="danger" style={{ fontSize: 11 }}>Feedback is required when sending a task back.</Text>}
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <Button block danger icon={<RollbackOutlined />} disabled={!canReject || !!submitting} loading={submitting === 'REJECT'}
                      onClick={() => submitDecision('REJECT')} style={{ borderRadius: 8, fontWeight: 600 }}>Send back</Button>
                    <Button block type="primary" icon={<CheckCircleOutlined />} disabled={!canApprove || !!submitting} loading={submitting === 'APPROVE'}
                      onClick={approve} style={{ borderRadius: 8, fontWeight: 600, background: '#2E7D32', borderColor: '#2E7D32' }}>Approve</Button>
                  </div>
                  {(!canApprove || !canReject) && <Text style={{ fontSize: 11, color: 'var(--bc-text-muted, #94a3b8)', display: 'block', marginTop: 6 }}>Your role does not allow {!canApprove && !canReject ? 'reviewing' : !canApprove ? 'approving' : 'rejecting'}.</Text>}
                  {queueIds.length > 1 && (
                    <Checkbox checked={autoAdvance} style={{ marginTop: 10, fontSize: 12 }}
                      onChange={(e) => { setAutoAdvance(e.target.checked); localStorage.setItem('review.autoAdvance', e.target.checked ? '1' : '0'); }}>
                      Open the next task after deciding
                    </Checkbox>
                  )}
                </>
              )}
            </div>

            <div className="rv-card">
              <div className="rv-card__title"><span>Your review activity</span><span style={{ textTransform: 'none', letterSpacing: 0 }}>last 30 days</span></div>
              {myStats ? (
                <div className="rv-stat-grid">
                  <div className="rv-stat"><span>Today</span><b style={{ color: '#1976D2' }}>{myStats.reviewsToday}</b></div>
                  <div className="rv-stat"><span>This week</span><b style={{ color: '#1976D2' }}>{myStats.reviewsWeek}</b></div>
                  <div className="rv-stat"><span>Approval rate</span><b style={{ color: '#2E7D32' }}>{myStats.approvalRate == null ? '—' : `${myStats.approvalRate}%`}</b></div>
                  <div className="rv-stat"><span>Avg time spent</span><b style={{ color: '#7B1FA2' }}>{myStats.avgMinutesSpent == null ? '—' : formatMinutes(myStats.avgMinutesSpent)}</b></div>
                </div>
              ) : <Spin size="small" />}
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
}
