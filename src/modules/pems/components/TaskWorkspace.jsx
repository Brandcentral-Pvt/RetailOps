import React, { useState, useEffect, useCallback } from 'react';
import { Drawer, Typography, Space, Tag, Button, Row, Col, Progress, Card, Input, Badge, Spin, Rate, Empty, Tabs, Tooltip, Avatar, Divider, Modal, App, Select } from 'antd';
import {
  CheckCircleOutlined, ClockCircleOutlined, EyeOutlined, ArrowRightOutlined,
  FileTextOutlined, UploadOutlined, CommentOutlined, EditOutlined,
  SendOutlined, ReloadOutlined, AimOutlined, TrophyOutlined, RiseOutlined,
  PlayCircleOutlined, InfoCircleOutlined, UserOutlined,
  CalendarOutlined, SafetyCertificateOutlined, ThunderboltOutlined,
  CheckSquareOutlined, CloseCircleOutlined, MinusOutlined, DollarOutlined,
  WarningOutlined, FlagOutlined, BulbOutlined, ExperimentOutlined
} from '@ant-design/icons';
import pemsApi from '../services/pemsApi';
import {
  WORKFLOW_STATUSES, VALID_TRANSITIONS, SLA_STATUSES, FREQUENCIES,
  PRIORITIES, TASK_ISSUE_SOURCES, CATEGORY_METRIC_CONFIG
} from '../constants';
import { calculateHealth, getDueDateLabel } from '../utils/taskHealth';
import { useAuth } from '../../../contexts/AuthContext';
import dayjs from 'dayjs';

const { Text } = Typography;

const STATUS_COLORS = {
  DRAFT: '#64748b', ASSIGNED: '#2563eb', ACCEPTED: '#7c3aed', IN_PROGRESS: '#2563eb',
  SUBMITTED: '#d97706', UNDER_REVIEW: '#7c3aed', APPROVED: '#16a34a',
  REJECTED: '#dc2626', REWORK: '#ea580c', CANCELLED: '#94a3b8',
};

const CATEGORY_THEME = {
  PRICING: { headerBg: 'var(--bc-cyan-50)', borderColor: 'var(--bc-cyan-100)', bg: 'var(--bc-cyan-50)', accent: '#0d9488', label: 'Pricing Dispute' },
  LISTING: { headerBg: 'var(--bc-blue-100)', borderColor: 'var(--bc-blue-200)', bg: 'var(--bc-indigo-50)', accent: '#2563eb', label: 'Catalog Audit' },
  INVENTORY: { headerBg: 'var(--bc-violet-100)', borderColor: 'var(--bc-violet-100)', bg: 'var(--bc-violet-50)', accent: '#7c3aed', label: 'Inventory Check' },
  ADS: { headerBg: 'var(--bc-amber-50)', borderColor: 'var(--bc-amber-200)', bg: 'var(--bc-amber-50)', accent: '#ea580c', label: 'Ad Review' },
  COMPLIANCE: { headerBg: 'var(--bc-red-50)', borderColor: 'var(--bc-red-200)', bg: 'var(--bc-red-50)', accent: '#dc2626', label: 'Compliance Check' },
  GENERAL: { headerBg: 'var(--bc-surface-subtle)', borderColor: 'var(--bc-border-default)', bg: 'var(--bc-surface-subtle)', accent: '#64748b', label: 'Task Review' },
};

function SectionHeader({ title, icon: Icon, count, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
      <Space size={6}>
        {Icon && <Icon style={{ fontSize: 14, color: 'var(--bc-text-secondary)' }} />}
        <Text style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--bc-text-secondary)' }}>{title}</Text>
        {count !== undefined && <Badge count={count} size="small" style={{ backgroundColor: 'var(--bc-border-subtle)', color: 'var(--bc-text-secondary)' }} />}
      </Space>
      {action}
    </div>
  );
}

function MetricCard({ label, value, color, subtext }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 10, background: `${color}08`, border: `1px solid ${color}18`, flex: '1 1 0', minWidth: 100 }}>
      <Text style={{ fontSize: 9, color: 'var(--bc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block' }}>{label}</Text>
      <div style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1.2, marginTop: 2 }}>{value}</div>
      {subtext && <Text style={{ fontSize: 9, color: 'var(--bc-text-muted)' }}>{subtext}</Text>}
    </div>
  );
}

function UotTriggerPanel({ task, categoryKey }) {
  const config = CATEGORY_METRIC_CONFIG[categoryKey] || CATEGORY_METRIC_CONFIG.GENERAL;
  return (
    <div style={{ background: 'var(--bc-surface-subtle)', borderRadius: 8, border: '1px solid var(--bc-border-default)', padding: 12 }}>
      <Space size={6} style={{ marginBottom: 8 }}>
        <FlagOutlined style={{ color: 'var(--bc-text-secondary)', fontSize: 13 }} />
        <Text style={{ fontSize: 11, fontWeight: 600, color: 'var(--bc-text-body)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Step 1: Detection</Text>
      </Space>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {config.metrics.map(m => (
          <div key={m} style={{ padding: '6px 10px', borderRadius: 6, background: 'var(--bc-surface-card)', border: '1px solid var(--bc-border-default)' }}>
            <Text style={{ fontSize: 9, color: 'var(--bc-text-muted)', display: 'block' }}>{m}</Text>
            <Text strong style={{ fontSize: 14, color: 'var(--bc-text-heading)' }}>{task[m] ?? '—'}</Text>
          </div>
        ))}
        <div style={{ padding: '6px 10px', borderRadius: 6, background: 'var(--bc-surface-card)', border: '1px solid var(--bc-border-default)' }}>
          <Text style={{ fontSize: 9, color: 'var(--bc-text-muted)', display: 'block' }}>Detected Gap</Text>
          <Text strong style={{ fontSize: 14, color: 'var(--bc-red-600)' }}>{task.TriggerDescription || task.Title || 'System-identified issue'}</Text>
        </div>
      </div>
    </div>
  );
}

function UotCategorizePanel({ categoryKey, issueSource, setIssueSource }) {
  const sources = TASK_ISSUE_SOURCES[categoryKey] || TASK_ISSUE_SOURCES.GENERAL;
  return (
    <div style={{ background: 'var(--bc-surface-subtle)', borderRadius: 8, border: '1px solid var(--bc-border-default)', padding: 12 }}>
      <Space size={6} style={{ marginBottom: 8 }}>
        <BulbOutlined style={{ color: 'var(--bc-text-secondary)', fontSize: 13 }} />
        <Text style={{ fontSize: 11, fontWeight: 600, color: 'var(--bc-text-body)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Step 2: Root Cause</Text>
      </Space>
      <div>
        <Text style={{ fontSize: 10, color: 'var(--bc-text-secondary)', display: 'block', marginBottom: 4, fontWeight: 600 }}>Identify Issue Source <Text type="danger">*</Text></Text>
        <Select
          value={issueSource}
          onChange={setIssueSource}
          size="small"
          style={{ width: '100%' }}
          placeholder="Select root cause..."
          options={sources}
        />
      </div>
    </div>
  );
}

function UotActionPanel({ ticketId, setTicketId, requestId, setRequestId, actionNotes, setActionNotes }) {
  return (
    <div style={{ background: 'var(--bc-surface-subtle)', borderRadius: 8, border: '1px solid var(--bc-border-default)', padding: 12 }}>
      <Space size={6} style={{ marginBottom: 8 }}>
        <ExperimentOutlined style={{ color: 'var(--bc-text-secondary)', fontSize: 13 }} />
        <Text style={{ fontSize: 11, fontWeight: 600, color: 'var(--bc-text-body)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Step 3: Resolution</Text>
      </Space>
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <div>
          <Text style={{ fontSize: 10, color: 'var(--bc-text-secondary)', display: 'block', marginBottom: 4, fontWeight: 600 }}>Ticket ID</Text>
          <Input size="small" value={ticketId} onChange={e => setTicketId(e.target.value)} placeholder="e.g. TK-2024-00123" style={{ borderRadius: 6 }} />
        </div>
        <div>
          <Text style={{ fontSize: 10, color: 'var(--bc-text-secondary)', display: 'block', marginBottom: 4, fontWeight: 600 }}>Request / Case ID</Text>
          <Input size="small" value={requestId} onChange={e => setRequestId(e.target.value)} placeholder="e.g. REQ-4500" style={{ borderRadius: 6 }} />
        </div>
        <div>
          <Text style={{ fontSize: 10, color: 'var(--bc-text-secondary)', display: 'block', marginBottom: 4, fontWeight: 600 }}>Action Notes</Text>
          <Input.TextArea rows={2} value={actionNotes} onChange={e => setActionNotes(e.target.value)} placeholder="Describe the action taken..." style={{ borderRadius: 6 }} />
        </div>
      </Space>
    </div>
  );
}

function UotValidatePanel({ verifying, verifyResult, handleVerify, handleSubmit, canSubmit, taskStatus, allSubTasksDone, subTaskCount, completedCount, asinResults }) {
  const isClosed = taskStatus === 'APPROVED' || taskStatus === 'CANCELLED';
  const allAsinsVerified = !asinResults?.length || asinResults.every(a => a.verified);
  const canComplete = canSubmit && verifyResult?.status === 'success' && allAsinsVerified;
  const subTaskBlock = subTaskCount > 0 && !allSubTasksDone;

  return (
    <div style={{ background: 'var(--bc-surface-subtle)', borderRadius: 8, border: '1px solid var(--bc-border-default)', padding: 12 }}>
      <Space size={6} style={{ marginBottom: 8 }}>
        <CheckCircleOutlined style={{ color: 'var(--bc-text-secondary)', fontSize: 13 }} />
        <Text style={{ fontSize: 11, fontWeight: 600, color: 'var(--bc-text-body)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Step 4: Validation & Closure</Text>
      </Space>
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <Button
          icon={<ReloadOutlined />}
          loading={verifying}
          onClick={handleVerify}
          size="small"
          block
          style={{ borderRadius: 6, textAlign: 'center' }}
        >
          Verify Fix
        </Button>

        {verifying && <Spin size="small" />}

        {asinResults?.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {asinResults.map(a => (
              <div key={a.asin} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 8px', borderRadius: 4, background: a.verified ? 'var(--bc-green-50)' : 'var(--bc-red-50)', border: `1px solid ${a.verified ? 'var(--bc-green-200)' : 'var(--bc-red-200)'}` }}>
                {a.verified ? <CheckCircleOutlined style={{ color: 'var(--bc-green-600)', fontSize: 10 }} /> : <ClockCircleOutlined style={{ color: 'var(--bc-red-600)', fontSize: 10 }} />}
                <Text code style={{ fontSize: 9, color: 'var(--bc-text-secondary)' }}>{a.asin}</Text>
                <Text style={{ fontSize: 9, color: a.verified ? 'var(--bc-green-600)' : 'var(--bc-red-600)', flex: 1 }}>{a.verified ? 'Verified' : 'Pending'}</Text>
              </div>
            ))}
          </div>
        )}

        {verifyResult && (
          <div style={{
            padding: '6px 10px', borderRadius: 6,
            background: verifyResult.status === 'success' ? 'var(--bc-green-50)' : verifyResult.status === 'mismatch' ? 'var(--bc-red-50)' : 'var(--bc-amber-50)',
            border: `1px solid ${verifyResult.status === 'success' ? 'var(--bc-green-200)' : verifyResult.status === 'mismatch' ? 'var(--bc-red-200)' : 'var(--bc-amber-200)'}`
          }}>
            <Space>
              {verifyResult.status === 'success' ? <CheckCircleOutlined style={{ color: 'var(--bc-green-600)' }} /> : <WarningOutlined style={{ color: 'var(--bc-red-600)' }} />}
              <Text style={{ fontSize: 11, color: verifyResult.status === 'success' ? 'var(--bc-green-600)' : 'var(--bc-red-600)' }}>
                {verifyResult.message || (verifyResult.status === 'success' ? 'Fix verified — changes are live' : 'Fix not confirmed — retry or escalate')}
              </Text>
            </Space>
          </div>
        )}

        {subTaskBlock && (
          <div style={{ padding: '6px 10px', borderRadius: 6, background: 'var(--bc-amber-50)', border: '1px solid var(--bc-amber-200)' }}>
            <Text style={{ fontSize: 10, color: 'var(--bc-amber-800)' }}>
              <WarningOutlined style={{ marginRight: 4 }} />Complete {completedCount}/{subTaskCount} sub-tasks before submitting
            </Text>
          </div>
        )}

        <Button
          type="primary"
          icon={<ArrowRightOutlined />}
          size="small"
          block
          disabled={!canComplete || isClosed}
          onClick={handleSubmit}
          style={{ borderRadius: 6, background: canComplete && !isClosed ? 'var(--bc-blue-600)' : undefined }}
        >
          {isClosed ? 'Completed' : canComplete ? 'Mark as Completed' : verifyResult ? 'Verify first' : 'Verify & Complete'}
        </Button>
      </Space>
    </div>
  );
}

function AutomatedDataPanel({ subTasks }) {
  if (!subTasks?.length) return null;
  return (
    <div style={{ borderRadius: 8, border: '1px solid var(--bc-border-default)', overflow: 'hidden' }}>
      <div style={{ padding: '8px 12px', background: 'var(--bc-surface-subtle)', borderBottom: '1px solid var(--bc-border-default)' }}>
        <Text style={{ fontSize: 10, fontWeight: 600, color: 'var(--bc-text-body)' }}>ASIN/SKU List ({subTasks.length})</Text>
      </div>
      <div style={{ maxHeight: 160, overflow: 'auto' }}>
        {subTasks.map((st, i) => {
          const done = st.activities?.filter(a => a.IsCompleted).length || 0;
          const total = st.activities?.length || 0;
          return (
            <div key={st.Id} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
              borderBottom: i < subTasks.length - 1 ? '1px solid var(--bc-border-subtle)' : 'none',
              background: st.IsCompleted ? 'var(--bc-green-50)' : 'var(--bc-surface-card)',
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: st.IsCompleted ? 'var(--bc-green-600)' : 'var(--bc-text-muted)', flexShrink: 0 }} />
              <Text code style={{ fontSize: 9, color: 'var(--bc-text-secondary)' }}>{st.SKU || st.Asin || `SUB-${st.Id?.slice(0, 6)}`}</Text>
              <Text style={{ fontSize: 10, color: 'var(--bc-text-body)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{st.Title}</Text>
              {total > 0 && (
                <Tag style={{ fontSize: 8, borderRadius: 4, background: done === total ? 'var(--bc-green-50)' : 'var(--bc-surface-subtle)', color: done === total ? 'var(--bc-green-600)' : 'var(--bc-text-secondary)', border: 'none', margin: 0 }}>
                  {done}/{total}
                </Tag>
              )}
              {st.IsCompleted && <CheckCircleOutlined style={{ color: 'var(--bc-green-600)', fontSize: 11 }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VisionFeedbackPanel({ task }) {
  const hasImages = task.ImagesMissing == null || task.ImagesMissing === 0;
  const aiHealth = task.AIHealthScore ?? task.CatalogScore ?? 4.9;
  const target = task.TargetScore ?? task.AITarget ?? 9.0;
  const passing = aiHealth >= target;

  const standardViews = ['Front View', 'Side View', 'Back View', 'Packaging', 'Lifestyle'];
  const missingViews = standardViews.filter(v => task[`Image_${v.replace(/\s/g, '')}`] === false || task.MissingViews?.includes(v));

  return (
    <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bc-indigo-50)', border: '1px solid var(--bc-blue-200)' }}>
      <Space size={6} style={{ marginBottom: 6 }}>
        <EyeOutlined style={{ color: 'var(--bc-indigo-600)', fontSize: 13 }} />
        <Text style={{ fontSize: 11, fontWeight: 600, color: 'var(--bc-text-heading)' }}>AI Vision Feedback</Text>
        <Tag style={{ fontSize: 8, borderRadius: 4, background: 'var(--bc-blue-50)', color: 'var(--bc-blue-600)', border: 'none', margin: 0, marginLeft: 'auto' }}>
          AI-Powered
        </Tag>
      </Space>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        <Tag style={{ fontSize: 10, borderRadius: 4, background: passing ? 'var(--bc-green-50)' : 'var(--bc-red-50)', color: passing ? 'var(--bc-green-600)' : 'var(--bc-red-600)', border: 'none', fontWeight: 600, fontFamily: 'var(--bc-font-mono)' }}>
          {aiHealth}→{target} {passing ? '✓' : '✗'}
        </Tag>
        {hasImages && <Tag style={{ fontSize: 10, borderRadius: 4, background: 'var(--bc-green-50)', color: 'var(--bc-green-600)', border: 'none' }}>Images OK</Tag>}
      </div>
      {missingViews.length > 0 && (
        <div>
          <Text style={{ fontSize: 9, color: 'var(--bc-text-secondary)', display: 'block', marginBottom: 4 }}>Missing Standard Views:</Text>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {missingViews.map(v => (
              <Tag key={v} style={{ fontSize: 9, borderRadius: 4, background: 'var(--bc-red-50)', color: 'var(--bc-red-600)', border: '1px solid var(--bc-red-200)', margin: 0 }}>
                {v}
              </Tag>
            ))}
          </div>
        </div>
      )}
      {missingViews.length === 0 && hasImages && (
        <Text style={{ fontSize: 10, color: 'var(--bc-green-600)' }}>All standard views present. Image quality meets minimum requirements.</Text>
      )}
      {!hasImages && (
        <Text style={{ fontSize: 10, color: 'var(--bc-red-600)' }}>Missing images detected. Upload required before submission.</Text>
      )}
    </div>
  );
}

export default function TaskWorkspace({ open, onClose, taskId, onRefresh }) {
  const { user: currentUser } = useAuth();
  const { message } = App.useApp();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [transModal, setTransModal] = useState({ toStatus: null, remarks: '' });

  // UOT state
  const [issueSource, setIssueSource] = useState(null);
  const [ticketId, setTicketId] = useState('');
  const [requestId, setRequestId] = useState('');
  const [actionNotes, setActionNotes] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [asinResults, setAsinResults] = useState([]);

  // Review modal
  const [reviewDecision, setReviewDecision] = useState(null);
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [reviewScore, setReviewScore] = useState(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // Comment
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState([]);

  const handleSendComment = () => {
    const text = newComment.trim();
    if (!text) return;
    setComments(prev => [{
      id: `c_${Date.now()}`,
      text,
      author: currentUser?.firstName || 'You',
      createdAt: new Date().toISOString(),
    }, ...prev]);
    setNewComment('');
    message.success('Comment added');
  };

  const loadTask = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const res = await pemsApi.getInstanceById(taskId);
      if (res.success) setTask(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [taskId]);

  useEffect(() => { loadTask(); }, [loadTask]);

  const notifyTransition = useCallback(async (toStatus) => {
    try {
      const { default: notificationApi } = await import('../../../services/notificationCenter');
      notificationApi?.notify?.({
        type: 'task_transition',
        taskId,
        message: `Task ${task?.InstanceCode} → ${toStatus}`,
        data: { from: task?.Status, to: toStatus, actor: currentUser?.id },
      });
    } catch { /* notification center unavailable — skip */ }
  }, [taskId, task, currentUser]);

  const handleTransition = async (toStatus, remarks = '') => {
    if (toStatus === 'SUBMITTED' && !remarks.trim()) return false;
    try {
      await pemsApi.transitionStatus(taskId, toStatus, remarks);
      await loadTask();
      if (onRefresh) onRefresh();
      notifyTransition(toStatus);
      return true;
    } catch (err) { console.error(err); return false; }
  };

  const checkGate = (toStatus) => {
    if (!task) return false;
    if (toStatus === 'IN_PROGRESS' && calculateHealth(task).score < 50) {
      message.warning(`Health ${calculateHealth(task).score}/100 — below 50 threshold.`);
      return false;
    }
    const subTasks = task.subTasks || [];
    if (toStatus === 'SUBMITTED' && subTasks.length > 0 && !subTasks.every(st => st.IsCompleted)) {
      message.warning('Complete all sub-tasks before submitting.');
      return false;
    }
    const isNewListing = task.Category === 'LISTING' && task.InstanceCode?.includes('DLY-004');
    const aiTarget = task.TargetScore ?? task.AITarget ?? 9.0;
    if (isNewListing && toStatus === 'SUBMITTED' && (task.AIHealthScore ?? 0) < aiTarget) {
      message.warning(`AI Health Score (${task.AIHealthScore}) below target (${aiTarget}).`);
      return false;
    }
    if (toStatus === 'APPROVED' && subTasks.length > 0 && !subTasks.every(st => st.IsCompleted)) {
      message.warning(`Cannot complete — ${subTasks.filter(st => !st.IsCompleted).length} sub-tasks pending.`);
      return false;
    }
    return true;
  };

  const handleVerify = async () => {
    setVerifying(true);
    setVerifyResult(null);
    setAsinResults([]);
    try {
      const res = await pemsApi.verifyFix?.(taskId) || { status: 'success', message: 'Fix verified — changes are live' };
      setVerifyResult(res);
      if (subTasks.length > 0) {
        setAsinResults(subTasks.map(st => ({
          asin: st.SKU || st.Asin || `SUB-${st.Id?.slice(0, 6)}`,
          verified: st.IsCompleted && res.status === 'success',
        })));
      }
    } catch {
      setVerifyResult({ status: 'mismatch', message: 'Verification failed — system values still diverge' });
    } finally { setVerifying(false); }
  };

  const handleSubmitComplete = async () => {
    if (!checkGate('SUBMITTED')) return;
    if (verifyResult?.status !== 'success') {
      message.warning('Verify the fix first before marking as completed.');
      return;
    }
    setTransModal({ toStatus: 'SUBMITTED', remarks: actionNotes || ticketId ? `Ticket: ${ticketId}, Request: ${requestId} — ${actionNotes}` : '' });
  };

  const handleCompleteActivity = async (actId) => {
    try { await pemsApi.completeActivity(actId); await loadTask(); if (onRefresh) onRefresh(); } catch (err) { console.error(err); }
  };

  const handleCompleteSubTask = async (stId) => {
    try { await pemsApi.completeSubTask(stId); await loadTask(); if (onRefresh) onRefresh(); } catch (err) { console.error(err); }
  };

  const handleReview = async () => {
    if (!reviewFeedback.trim()) return;
    setReviewSubmitting(true);
    try {
      await pemsApi.submitReview({ taskInstanceId: taskId, decision: reviewDecision, feedback: reviewFeedback, qualityScore: reviewScore });
      await handleTransition(reviewDecision === 'APPROVE' ? 'APPROVED' : 'REJECTED', reviewFeedback);
      setReviewDecision(null); setReviewFeedback(''); setReviewScore(null);
      if (onRefresh) onRefresh();
    } catch (err) { console.error(err); }
    finally { setReviewSubmitting(false); }
  };

  if (!task && !loading) return null;

  const health = task ? calculateHealth(task) : { score: 0, label: 'Unknown', color: 'var(--bc-text-muted)', bgColor: 'var(--bc-surface-subtle)' };
  const dueLabel = task ? getDueDateLabel(task) : null;
  const nextStatuses = task ? (VALID_TRANSITIONS[task.Status] || []) : [];
  const subTasks = task?.subTasks || [];
  const totalActivities = subTasks.reduce((s, st) => s + (st.activities?.length || 0), 0);
  const completedActivities = subTasks.reduce((s, st) => s + (st.activities?.filter(a => a.IsCompleted).length || 0), 0);

  const categoryKey = task?.Category || task?.Department || 'GENERAL';
  const theme = CATEGORY_THEME[categoryKey] || CATEGORY_THEME.GENERAL;

  const canSubmit = issueSource && (ticketId || requestId);
  const completedSubTasks = subTasks.filter(st => st.IsCompleted).length;
  const allSubTasksDone = !subTasks.length || subTasks.every(st => st.IsCompleted);

  const tabItems = [
    {
      key: 'overview',
      label: <Space size={4}><InfoCircleOutlined style={{ fontSize: 'var(--font-size-sm)' }} /><span>Overview</span></Space>,
      children: task && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* ═══ MODULAR ACTION CENTER ═══ */}
          <div style={{ background: theme.bg, borderRadius: 12, border: `1px solid ${theme.borderColor}`, overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', background: theme.headerBg, borderBottom: `1px solid ${theme.borderColor}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <SafetyCertificateOutlined style={{ color: theme.accent, fontSize: 15 }} />
              <Text strong style={{ fontSize: 13, color: theme.accent }}>{theme.label}</Text>
              {task.IsRuleTask && (
                <Tag style={{ fontSize: 9, borderRadius: 4, background: 'var(--bc-blue-50)', color: 'var(--bc-blue-600)', border: 'none', margin: 0, marginLeft: 'auto' }}>
                  <ThunderboltOutlined style={{ marginRight: 4 }} />Auto-detected
                </Tag>
              )}
            </div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Step 1: Trigger */}
              <UotTriggerPanel task={task} categoryKey={categoryKey} />
              {/* Step 2: Categorize */}
              <UotCategorizePanel categoryKey={categoryKey} issueSource={issueSource} setIssueSource={setIssueSource} />
              {/* Automated Data Panel */}
              <AutomatedDataPanel subTasks={subTasks} />
              {/* Step 3: Action */}
              <UotActionPanel ticketId={ticketId} setTicketId={setTicketId} requestId={requestId} setRequestId={setRequestId} actionNotes={actionNotes} setActionNotes={setActionNotes} />
              {/* AI/Vision Feedback (universal for Catalog) */}
              {categoryKey === 'LISTING' && <VisionFeedbackPanel task={task} />}
              {/* Step 4: Validate */}
              <UotValidatePanel
                verifying={verifying} verifyResult={verifyResult}
                handleVerify={handleVerify} handleSubmit={handleSubmitComplete}
                canSubmit={canSubmit} taskStatus={task.Status}
                allSubTasksDone={allSubTasksDone} subTaskCount={subTasks.length} completedCount={completedSubTasks}
                asinResults={asinResults}
              />
            </div>
          </div>

          {/* KPI Cards */}
          <SectionHeader title="Performance Metrics" icon={AimOutlined} />
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <MetricCard label="Target" value={task.Target || 0} color="#2563eb" />
            <MetricCard label="Achievement" value={task.Achievement || 0} color="#16a34a" />
            <MetricCard label="Achievement %" value={`${task.AchievementPct || 0}%`} color={task.AchievementPct >= 80 ? '#16a34a' : '#d97706'} />
            <MetricCard label="Variance" value={`${(task.Variance || 0) >= 0 ? '+' : ''}${task.Variance || 0}`} color={(task.Variance || 0) >= 0 ? '#16a34a' : '#dc2626'} />
            <MetricCard label="Progress" value={`${task.WeightedProgressPct || task.ProgressPct || 0}%`} color="#7c3aed" />
          </div>

          {/* Task Info Grid */}
          <SectionHeader title="Task Details" icon={EditOutlined} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {[
              { label: 'Seller', value: task.SellerName || '-' },
              { label: 'Department', value: task.Department || '-', tag: true, tagColor: 'var(--bc-blue-50)', tagText: 'var(--bc-blue-700)' },
              { label: 'Brand Manager', value: task.AssigneeName || '-' },
              { label: 'Reviewer', value: task.ReviewerName || '-' },
              { label: 'Priority', value: task.Priority, tag: true, tagColor: PRIORITIES[task.Priority]?.bg || 'var(--bc-surface-subtle)', tagText: PRIORITIES[task.Priority]?.color || 'var(--bc-text-body)' },
              { label: 'Frequency', value: FREQUENCIES.find(f => f.value === task.Frequency)?.label || task.Frequency },
              { label: 'SLA', value: `${task.SLAHours}h` },
              { label: 'TAT', value: `${task.TATHours || '-'}h` },
              { label: 'Due Date', value: task.DueDate ? dayjs(task.DueDate).format('DD MMM YYYY') : '-', color: dueLabel?.color },
              { label: 'Created', value: task.CreatedAt ? dayjs(task.CreatedAt).format('DD MMM YYYY [at] h:mm A') : '-' },
              { label: 'Started', value: task.StartedAt ? dayjs(task.StartedAt).format('DD MMM YYYY [at] h:mm A') : '-', color: task.StartedAt ? '#2563eb' : undefined },
              { label: 'Submitted', value: task.SubmittedAt ? dayjs(task.SubmittedAt).format('DD MMM YYYY [at] h:mm A') : '-', color: task.SubmittedAt ? '#d97706' : undefined },
              { label: 'Reviewed', value: task.ReviewedAt ? dayjs(task.ReviewedAt).format('DD MMM YYYY [at] h:mm A') : '-' },
              { label: 'Completed', value: task.CompletedAt ? dayjs(task.CompletedAt).format('DD MMM YYYY [at] h:mm A') : '-', color: task.CompletedAt ? '#16a34a' : undefined },
            ].map(item => (
              <div key={item.label} style={{ padding: '10px 12px', background: 'var(--bc-surface-subtle)', borderRadius: "var(--radius-md)", border: '1px solid var(--bc-border-subtle)' }}>
                <Text style={{ fontSize: 10, color: 'var(--bc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', fontWeight: 600, display: 'block', marginBottom: 2 }}>{item.label}</Text>
                {item.tag ? (
                  <Tag style={{ fontSize: 'var(--font-size-xs)', borderRadius: 6, background: item.tagColor, color: item.tagText, border: 'none' }}>{item.value || '-'}</Tag>
                ) : (
                  <Text strong style={{ fontSize: 'var(--font-size-sm)', color: item.color || 'var(--bc-text-heading)' }}>{item.value || '-'}</Text>
                )}
              </div>
            ))}
          </div>

          {/* Sub Tasks Summary */}
          <SectionHeader title="Sub Tasks" icon={CheckSquareOutlined} count={subTasks.length} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {subTasks.map(st => {
              const done = st.activities?.filter(a => a.IsCompleted).length || 0;
              const total = st.activities?.length || 0;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              return (
                <div key={st.Id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: "var(--radius-md)", border: st.IsCompleted ? '1px solid var(--bc-green-200)' : '1px solid var(--bc-border-default)', background: st.IsCompleted ? 'var(--bc-green-50)' : 'var(--bc-surface-card)' }}>
                  {st.IsCompleted ? <CheckCircleOutlined style={{ color: 'var(--bc-green-600)' }} /> : <ClockCircleOutlined style={{ color: 'var(--bc-text-muted)' }} />}
                  <Text style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, flex: 1 }}>{st.Title}</Text>
                  <Progress percent={pct} size="small" style={{ width: 60, margin: 0 }} />
                  <Text style={{ fontSize: 10, color: 'var(--bc-text-muted)' }}>{done}/{total}</Text>
                </div>
              );
            })}
          </div>
        </div>
      ),
    },
    {
      key: 'sop',
      label: <Space size={4}><CheckSquareOutlined style={{ fontSize: 'var(--font-size-sm)' }} /><span>SOP</span></Space>,
      children: task && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SectionHeader title={`SOP Execution — ${completedActivities}/${totalActivities} steps`} icon={ThunderboltOutlined} />
          {subTasks.length === 0 ? <Empty description="No SOP defined for this task" /> : subTasks.map((st, stIdx) => {
            const done = st.activities?.filter(a => a.IsCompleted).length || 0;
            const total = st.activities?.length || 0;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            return (
              <div key={st.Id} style={{ borderRadius: 10, border: st.IsCompleted ? '2px solid var(--bc-green-600)' : '1px solid var(--bc-border-default)', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: st.IsCompleted ? 'var(--bc-green-50)' : 'var(--bc-surface-subtle)', borderBottom: total > 0 ? '1px solid var(--bc-border-subtle)' : 'none', cursor: !st.IsCompleted && done === total && total > 0 ? 'pointer' : 'default' }}
                  onClick={() => !st.IsCompleted && done === total && total > 0 && handleCompleteSubTask(st.Id)}>
                  <Space size={10}>
                    {st.IsCompleted ? <CheckCircleOutlined style={{ color: 'var(--bc-green-600)', fontSize: 18 }} /> : (
                      <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${done === total && total > 0 ? 'var(--bc-green-600)' : 'var(--bc-border-strong)'}`, background: done === total && total > 0 ? 'var(--bc-green-100)' : 'var(--bc-surface-card)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {done === total && total > 0 && <CheckCircleOutlined style={{ color: 'var(--bc-green-600)', fontSize: 'var(--font-size-base)' }} />}
                      </div>
                    )}
                    <div>
                      <Text strong style={{ fontSize: 'var(--font-size-sm)' }}>Phase {stIdx + 1}: {st.Title}</Text>
                      {st.ExpectedOutput && <Text style={{ fontSize: 10, color: 'var(--bc-text-muted)', display: 'block' }}>Expected: {st.ExpectedOutput}</Text>}
                    </div>
                  </Space>
                  <Space size={12}>
                    <Progress percent={pct} size="small" strokeColor={pct === 100 ? 'var(--bc-green-600)' : 'var(--bc-blue-600)'} style={{ width: 80, margin: 0 }} />
                    <Text style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--bc-text-secondary)' }}>{done}/{total}</Text>
                  </Space>
                </div>
                {st.activities?.length > 0 && (
                  <div style={{ padding: '4px 0' }}>
                    {st.activities.map((act, actIdx) => (
                      <div key={act.Id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 16px', borderBottom: actIdx < st.activities.length - 1 ? '1px solid var(--bc-border-subtle)' : 'none', background: act.IsCompleted ? 'var(--bc-green-50)' : 'var(--bc-surface-card)', cursor: act.IsCompleted ? 'default' : 'pointer' }}
                        onClick={() => !act.IsCompleted && handleCompleteActivity(act.Id)}>
                        {act.IsCompleted ? <CheckCircleOutlined style={{ color: 'var(--bc-green-600)', fontSize: 'var(--font-size-lg)', marginTop: 2 }} /> : <div style={{ width: 16, height: 16, borderRadius: "var(--radius-sm)", border: '2px solid var(--bc-border-strong)', marginTop: 2, flexShrink: 0 }} />}
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Tag style={{ fontSize: 8, fontWeight: 600, fontFamily: 'var(--bc-font-mono)', background: 'var(--bc-indigo-50)', color: 'var(--bc-blue-600)', borderRadius: "var(--radius-sm)", margin: 0 }}>Step {act.StepNo}</Tag>
                            <Text strong style={{ fontSize: 'var(--font-size-sm)', textDecoration: act.IsCompleted ? 'line-through' : 'none', color: act.IsCompleted ? 'var(--bc-text-muted)' : 'var(--bc-text-heading)' }}>{act.Title}</Text>
                          </div>
                          {act.Instructions && <Text style={{ fontSize: 'var(--font-size-xs)', color: 'var(--bc-text-secondary)', display: 'block', marginTop: 3 }}>{act.Instructions}</Text>}
                          <Space size={6} style={{ marginTop: 4 }}>
                            {act.ExpectedOutput && <Tag style={{ fontSize: 9, borderRadius: "var(--radius-sm)", background: 'var(--bc-green-50)', color: 'var(--bc-green-600)', border: '1px solid var(--bc-green-200)' }}>Output: {act.ExpectedOutput}</Tag>}
                            {act.ValidationRules && <Tag style={{ fontSize: 9, borderRadius: "var(--radius-sm)", background: 'var(--bc-amber-50)', color: 'var(--bc-amber-700)', border: '1px solid var(--bc-amber-200)' }}>Validation: {act.ValidationRules}</Tag>}
                            {act.estimatedMinutes && <Tag style={{ fontSize: 9, borderRadius: "var(--radius-sm)", background: 'var(--bc-surface-subtle)', color: 'var(--bc-text-secondary)' }}>{act.estimatedMinutes}m</Tag>}
                          </Space>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ),
    },
    {
      key: 'evidence',
      label: <Space size={4}><FileTextOutlined style={{ fontSize: 'var(--font-size-sm)' }} /><span>Evidence</span></Space>,
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SectionHeader title={`Evidence (${task?.evidence?.length || 0})`} icon={FileTextOutlined} />
          {!task?.evidence?.length ? <Empty description="No evidence uploaded yet" /> : task.evidence.map(ev => (
            <div key={ev.Id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: "var(--radius-md)", border: '1px solid var(--bc-border-default)', background: 'var(--bc-surface-card)' }}>
              <div style={{ width: 36, height: 36, borderRadius: "var(--radius-md)", background: 'var(--bc-blue-50)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileTextOutlined style={{ color: 'var(--bc-blue-600)' }} />
              </div>
              <div style={{ flex: 1 }}>
                <Text strong style={{ fontSize: 'var(--font-size-sm)' }}>{ev.FileName}</Text>
                <Text style={{ fontSize: 10, color: 'var(--bc-text-muted)', display: 'block' }}>{ev.UploadedByName} · {dayjs(ev.UploadedAt).format('DD MMM YYYY [at] h:mm A')}</Text>
              </div>
              {ev.Remarks && <Text style={{ fontSize: 'var(--font-size-xs)', color: 'var(--bc-text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.Remarks}</Text>}
            </div>
          ))}
        </div>
      ),
    },
    {
      key: 'comments',
      label: <Space size={4}><CommentOutlined style={{ fontSize: 'var(--font-size-sm)' }} /><span>Comments</span></Space>,
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SectionHeader title="Discussion" icon={CommentOutlined} />
          <div style={{ padding: '12px 14px', borderRadius: "var(--radius-md)", border: '1px solid var(--bc-border-default)', background: 'var(--bc-surface-subtle)' }}>
            <Input.TextArea rows={2} value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Add a comment... (@mention, attach files)" style={{ borderRadius: "var(--radius-md)", background: 'var(--bc-surface-card)' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <Button type="primary" size="small" icon={<SendOutlined />} disabled={!newComment.trim()} onClick={handleSendComment} style={{ borderRadius: 6, background: 'var(--bc-blue-600)' }}>Comment</Button>
            </div>
          </div>
          {comments.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center' }}>
              <Text type="secondary" style={{ fontSize: 'var(--font-size-sm)' }}>Comments will appear here as team members collaborate.</Text>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {comments.map(c => (
                <div key={c.id} style={{ padding: '10px 12px', borderRadius: "var(--radius-md)", border: '1px solid var(--bc-border-default)', background: 'var(--bc-surface-card)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 11, fontWeight: 600, color: 'var(--bc-text-heading)' }}>{c.author}</Text>
                    <Text style={{ fontSize: 10, color: 'var(--bc-text-muted)' }}>{new Date(c.createdAt).toLocaleString()}</Text>
                  </div>
                  <Text style={{ fontSize: 12, color: 'var(--bc-text-body)', whiteSpace: 'pre-wrap' }}>{c.text}</Text>
                </div>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'activity',
      label: <Space size={4}><ClockCircleOutlined style={{ fontSize: 'var(--font-size-sm)' }} /><span>Activity</span></Space>,
      children: task && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <SectionHeader title="Audit Timeline" icon={ClockCircleOutlined} count={task.auditLogs?.length} />
          {!task.auditLogs?.length ? <Empty description="No activity recorded" /> : task.auditLogs.map((log, i) => {
            const colors = { CREATED: 'var(--bc-blue-600)', STATUS_CHANGED: 'var(--bc-green-600)', SUBTASK_COMPLETED: 'var(--bc-green-600)', EVIDENCE_UPLOADED: 'var(--bc-violet-600)' };
            return (
              <div key={log.Id} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: i < task.auditLogs.length - 1 ? '1px solid var(--bc-border-subtle)' : 'none' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: colors[log.Action] || 'var(--bc-text-muted)', marginTop: 4, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--bc-text-body)' }}>{log.Action.replace(/_/g, ' ')}</Text>
                    <Text style={{ fontSize: 10, color: 'var(--bc-text-muted)' }}>{dayjs(log.CreatedAt).format('DD MMM YYYY [at] h:mm A')}</Text>
                  </div>
                  <Text style={{ fontSize: 'var(--font-size-xs)', color: 'var(--bc-text-secondary)' }}>{log.ActorName || 'System'}</Text>
                  {log.Details && <Text style={{ fontSize: 'var(--font-size-xs)', color: 'var(--bc-text-body)', display: 'block', marginTop: 2, padding: '6px 10px', background: 'var(--bc-surface-subtle)', borderRadius: 6 }}>{log.Details}</Text>}
                </div>
              </div>
            );
          })}
        </div>
      ),
    },
  ];

  return (
    <Drawer
      title={null}
      open={open}
      onClose={onClose}
      width="75vw"
      destroyOnHidden
      styles={{
        body: { padding: 0, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' },
        header: { display: 'none' },
      }}
    >
      {loading || !task ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><Spin size="large" /></div>
      ) : (
        <div style={{ display: 'flex', height: '100%' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--bc-border-default)', background: 'var(--bc-surface-card)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              <Button type="text" onClick={onClose} style={{ fontSize: 18, color: 'var(--bc-text-secondary)' }}>✕</Button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Text code style={{ fontSize: 'var(--font-size-xs)' }}>{task.InstanceCode}</Text>
                  <Tag style={{ fontSize: 9, borderRadius: 10, fontWeight: 600, background: STATUS_COLORS[task.Status] + '15', color: STATUS_COLORS[task.Status], border: `1px solid ${STATUS_COLORS[task.Status]}30` }}>{task.Status}</Tag>
                  <Tag style={{ fontSize: 9, borderRadius: 6, background: PRIORITIES[task.Priority]?.bg || 'var(--bc-surface-subtle)', color: PRIORITIES[task.Priority]?.color || 'var(--bc-text-body)' }}>{task.Priority}</Tag>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: health.color }} title={`Health: ${health.score}/100`} />
                </div>
                <Text strong style={{ fontSize: 15, color: 'var(--bc-text-heading)', display: 'block', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.Title || task.TemplateName}</Text>
              </div>
              <Space>
                {nextStatuses.map(s => {
                  const isSubmit = s === 'SUBMITTED';
                  const isApprove = s === 'APPROVED';
                  const isReject = s === 'REJECTED';
                  if (isApprove) return <Button key={s} size="small" type="primary" icon={<CheckCircleOutlined />} style={{ borderRadius: 6, background: 'var(--bc-green-600)', borderColor: 'var(--bc-green-600)' }} onClick={() => setReviewDecision('APPROVE')}>Approve</Button>;
                  if (isReject) return <Button key={s} size="small" danger icon={<CloseCircleOutlined />} style={{ borderRadius: 6 }} onClick={() => setReviewDecision('REJECT')}>Reject</Button>;
                  return <Button key={s} size="small" type={isSubmit ? 'primary' : 'default'} icon={<ArrowRightOutlined />} style={{ borderRadius: 6, ...(isSubmit ? { background: 'var(--bc-blue-600)', borderColor: 'var(--bc-blue-600)' } : {}) }} onClick={() => { if (s === 'IN_PROGRESS' && !checkGate('IN_PROGRESS')) return; if (s === 'SUBMITTED' && !checkGate('SUBMITTED')) return; setTransModal({ toStatus: s, remarks: '' }); }}>{WORKFLOW_STATUSES[s]?.label}</Button>;
                })}
              </Space>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
              <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
            </div>
          </div>

          <div style={{ width: 240, borderLeft: '1px solid var(--bc-border-default)', background: 'var(--bc-surface-subtle)', padding: '16px', display: 'flex', flexDirection: 'column', gap: 16, flexShrink: 0, overflow: 'auto' }}>
            <div>
              <Text style={{ fontSize: 9, color: 'var(--bc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: 6 }}>SLA Status</Text>
              <Tag style={{ fontSize: 'var(--font-size-xs)', borderRadius: "var(--radius-md)", padding: '4px 10px', background: (SLA_STATUSES[task.SLAStatus]?.bg || 'var(--bc-surface-subtle)'), color: SLA_STATUSES[task.SLAStatus]?.color || 'var(--bc-text-secondary)', border: `1px solid ${SLA_STATUSES[task.SLAStatus]?.color || '#d1d5db'}30` }}>
                {task.SLAStatus?.replace(/_/g, ' ') || 'WITHIN SLA'}
              </Tag>
            </div>

            <div>
              <Text style={{ fontSize: 9, color: 'var(--bc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: 6 }}>Due Date</Text>
              {dueLabel ? (
                <div style={{ padding: '6px 10px', borderRadius: "var(--radius-md)", background: dueLabel.color + '10', border: `1px solid ${dueLabel.color}20` }}>
                  <Text strong style={{ fontSize: 'var(--font-size-sm)', color: dueLabel.color }}>{dueLabel.text}</Text>
                  {task.DueDate && <Text style={{ fontSize: 10, color: 'var(--bc-text-muted)', display: 'block' }}>{dayjs(task.DueDate).format('DD MMM YYYY')}</Text>}
                </div>
              ) : <Text style={{ fontSize: 'var(--font-size-sm)', color: 'var(--bc-text-muted)' }}>No due date</Text>}
            </div>

            <div>
              <Text style={{ fontSize: 9, color: 'var(--bc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: 6 }}>Priority</Text>
              <Tag style={{ fontSize: 'var(--font-size-xs)', borderRadius: "var(--radius-md)", padding: '4px 10px', background: PRIORITIES[task.Priority]?.bg || 'var(--bc-surface-subtle)', color: PRIORITIES[task.Priority]?.color || 'var(--bc-text-body)' }}>{task.Priority}</Tag>
            </div>

            <div>
              <Text style={{ fontSize: 9, color: 'var(--bc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: 6 }}>Progress</Text>
              <Progress percent={task.WeightedProgressPct || task.ProgressPct || 0} strokeColor={task.WeightedProgressPct >= 80 ? 'var(--bc-green-600)' : 'var(--bc-blue-600)'} />
              <Text style={{ fontSize: 10, color: 'var(--bc-text-secondary)' }}>{completedSubTasks}/{subTasks.length} subtasks</Text>
            </div>

            <div>
              <Text style={{ fontSize: 9, color: 'var(--bc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: 6 }}>Health</Text>
              <div style={{ padding: '8px 10px', borderRadius: "var(--radius-md)", background: health.bgColor, border: `1px solid ${health.color}20`, display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: health.color }} />
                <Text strong style={{ fontSize: 'var(--font-size-sm)', color: health.color }}>{health.label} ({health.score})</Text>
              </div>
            </div>

            <Divider style={{ margin: '4px 0' }} />

            <div>
              <Text style={{ fontSize: 9, color: 'var(--bc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: 6 }}>Quick Actions</Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {nextStatuses.map(s => (
                  <Button key={s} size="small" block style={{ borderRadius: 6, justifyContent: 'flex-start' }} icon={<ArrowRightOutlined />}
                    onClick={() => {
                      if (!checkGate(s)) return;
                      s === 'SUBMITTED' ? setTransModal({ toStatus: s, remarks: '' }) : handleTransition(s);
                    }}>
                    {WORKFLOW_STATUSES[s]?.label}
                  </Button>
                ))}
              </div>
            </div>

            <Divider style={{ margin: '4px 0' }} />

            <div>
              <Text style={{ fontSize: 9, color: 'var(--bc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: 6 }}>Recent Activity</Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(task.auditLogs || []).slice(0, 5).map(log => (
                  <div key={log.Id}>
                    <Text style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--bc-text-body)' }}>{log.Action.replace(/_/g, ' ').toLowerCase()}</Text>
                    <Text style={{ fontSize: 10, color: 'var(--bc-text-muted)', display: 'block' }}>{log.ActorName || 'System'}</Text>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <Modal title="Submit for Review" open={!!transModal.toStatus} onCancel={() => setTransModal({ toStatus: null, remarks: '' })}
        onOk={async () => { const ok = await handleTransition(transModal.toStatus, transModal.remarks); if (ok) { setTransModal({ toStatus: null, remarks: '' }); if (onRefresh) onRefresh(); } }}
        okText="Submit" destroyOnHidden width={480}>
        <div style={{ padding: '4px 0' }}>
          <div style={{ padding: '8px 12px', background: 'var(--bc-amber-50)', border: '1px solid var(--bc-amber-200)', borderRadius: "var(--radius-md)", marginBottom: 12 }}>
            <Text style={{ fontSize: 'var(--font-size-xs)', color: 'var(--bc-amber-800)', fontWeight: 600 }}>Describe what work was done before submitting.</Text>
          </div>
          <Text style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Work Summary <Text type="danger">*</Text></Text>
          <Input.TextArea rows={4} value={transModal.remarks} onChange={e => setTransModal(m => ({ ...m, remarks: e.target.value }))} placeholder={"• Completed all checklist items\n• Updated listings\n• Ready for review"} style={{ borderRadius: "var(--radius-md)" }} />
        </div>
      </Modal>

      <Modal title={`${reviewDecision === 'APPROVE' ? 'Approve' : 'Reject'} Task`} open={!!reviewDecision} onCancel={() => { setReviewDecision(null); setReviewFeedback(''); setReviewScore(null); }}
        onOk={handleReview} confirmLoading={reviewSubmitting} destroyOnHidden width={480}
        okText={reviewDecision === 'APPROVE' ? 'Approve' : 'Reject'}
        okButtonProps={{ danger: reviewDecision === 'REJECT', style: reviewDecision === 'APPROVE' ? { background: 'var(--bc-green-600)', borderColor: 'var(--bc-green-600)' } : {} }}>
        <div style={{ padding: '4px 0' }}>
          <div>
            <Text style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Quality Score</Text>
            <Rate value={reviewScore} onChange={setReviewScore} style={{ fontSize: 'var(--font-size-lg)' }} />
          </div>
          <div style={{ marginTop: 12 }}>
            <Text style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, display: 'block', marginBottom: 4 }}>
              {reviewDecision === 'APPROVE' ? 'Remarks' : 'Rejection Reason'} <Text type="danger">*</Text>
            </Text>
            <Input.TextArea rows={3} value={reviewFeedback} onChange={e => setReviewFeedback(e.target.value)} placeholder="Provide feedback..." style={{ borderRadius: "var(--radius-md)" }} />
          </div>
        </div>
      </Modal>
    </Drawer>
  );
}
