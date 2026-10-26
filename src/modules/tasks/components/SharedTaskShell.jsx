import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Drawer, Typography, Space, Tag, Button, Row, Col, Progress, Card, Badge, Spin, Empty, Tabs, Tooltip, Avatar, Divider, Modal, App, Select } from 'antd';
import {
  CheckCircleOutlined, ClockCircleOutlined, EyeOutlined, ArrowRightOutlined,
  FileTextOutlined, UploadOutlined, CommentOutlined, EditOutlined,
  SendOutlined, ReloadOutlined, AimOutlined, TrophyOutlined, RiseOutlined,
  PlayCircleOutlined, InfoCircleOutlined, UserOutlined,
  CalendarOutlined, SafetyCertificateOutlined, ThunderboltOutlined,
  CheckSquareOutlined, CloseCircleOutlined, MinusOutlined, DollarOutlined,
  WarningOutlined, FlagOutlined, BulbOutlined, ExperimentOutlined,
  LinkOutlined, PlusOutlined, ShopOutlined, ExportOutlined,
  TableOutlined, DatabaseOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import tasksApi from '../../services/tasksApi';
import { useAuth } from '../../../contexts/AuthContext';
import dayjs from 'dayjs';
import { resolveViewForTask, getView, getWidget } from '../view-registry/taskViewRegistry';
import GenericTaskView from '../views/generic/GenericTaskView';
import { WORKFLOW_STATUSES, VALID_TRANSITIONS, calculateHealth, STATUS_COLORS } from '../constants';

const { Text } = Typography;

const STATUS_COLORS = {
  DRAFT: '#64748b', ASSIGNED: '#2563eb', ACCEPTED: '#7c3aed', IN_PROGRESS: '#2563eb',
  SUBMITTED: '#d97706', UNDER_REVIEW: '#7c3aed', APPROVED: '#16a34a',
  REJECTED: '#dc2626', REWORK: '#ea580c', CANCELLED: '#94a3b8',
};

const STEPS = [
  ['DRAFT', 'Draft'], ['ASSIGNED', 'Assigned'], ['IN_PROGRESS', 'In progress'],
  ['SUBMITTED', 'Submitted'], ['UNDER_REVIEW', 'In review'], ['APPROVED', 'Done'],
];
const STEP_INDEX = {
  DRAFT: 0, ASSIGNED: 1, ACCEPTED: 1, IN_PROGRESS: 2, ESCALATED: 2, REWORK: 2,
  SUBMITTED: 3, RESUBMITTED: 3, UNDER_REVIEW: 4, REJECTED: 4, APPROVED: 5, CANCELLED: -1,
};
const EXCEPTION_STATUSES = new Set(['REJECTED', 'REWORK', 'ESCALATED', 'CANCELLED']);

function parseJsonArray(v) {
  if (Array.isArray(v)) return v;
  if (!v) return [];
  try { const x = JSON.parse(v); return Array.isArray(x) ? x : []; } catch { return []; }
}

function initials(name) {
  return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?';
}

function WorkflowStepper({ status }) {
  const idx = STEP_INDEX[status] ?? 0;
  const cancelled = status === 'CANCELLED';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 12, opacity: cancelled ? 0.45 : 1 }}>
      {STEPS.map(([key, label], i) => {
        const done = i < idx || (status === 'APPROVED' && i <= idx);
        const current = i === idx && status !== 'APPROVED';
        const color = done ? '#16a34a' : current ? '#2563eb' : '#cbd5e1';
        return (
          <React.Fragment key={key}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done ? '#16a34a' : current ? '#fff' : '#fff', border: `2px solid ${color}`,
                boxShadow: current ? '0 0 0 4px rgba(37,99,235,0.14)' : 'none', color: '#fff', fontSize: 10,
              }}>
                {done ? <CheckCircleOutlined style={{ fontSize: 11 }} /> : current ? <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563eb' }} /> : null}
              </div>
              <Text style={{ fontSize: 11, fontWeight: current ? 700 : 500, color: done || current ? 'var(--bc-text-heading)' : 'var(--bc-text-muted)' }}>{label}</Text>
            </div>
            {i < STEPS.length - 1 && <div style={{ flex: 1, height: 2, margin: '0 8px', minWidth: 12, background: i < idx ? '#16a34a' : '#e2e8f0', borderRadius: 2 }} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

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
      <Text style={{ fontSize: 10, color: 'var(--bc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: 2 }}>{label}</Text>
      <div style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1.2, marginTop: 2 }}>{value}</div>
      {subtext && <Text style={{ fontSize: 9, color: 'var(--bc-text-muted)' }}>{subtext}</Text>}
    </div>
  );
}

export default function SharedTaskShell({ open, onClose, taskId, onRefresh }) {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { message } = App.useApp();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [viewData, setViewData] = useState(null);
  const [transModal, setTransModal] = useState({ toStatus: null, remarks: '' });

  const loadTask = useCallback(async (opts = {}) => {
    if (!taskId) return;
    if (!opts.silent) setTimeout(() => setLoading(true), 0);
    try {
      const res = await tasksApi.getInstanceById(taskId);
      if (res.success) {
        const taskData = res.data;
        setTask(taskData);
        const viewResult = await tasksApi.getTaskView(taskId);
        if (viewResult.success) setViewData(viewResult.data);
      }
    } catch (err) { console.error(err); }
    finally { if (!opts.silent) setLoading(false); }
  }, [taskId]);

  useEffect(() => { loadTask(); }, [taskId, loadTask]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setViewData(null);
      setActiveTab('overview');
    }, 0);
    return () => clearTimeout(timer);
  }, [taskId]);

  const taskLoadedId = task?.Id;
  useEffect(() => {
    if (!taskLoadedId) return;
    const timer = setTimeout(() => {
      setActiveTab(task?.Source === 'RULESET' || task?.IsRuleTask ? 'resolve' : 'overview');
    }, 0);
    return () => clearTimeout(timer);
  }, [taskLoadedId, task?.Source, task?.IsRuleTask]);

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
      await tasksApi.transitionStatus(taskId, toStatus, remarks);
      await loadTask();
      if (onRefresh) onRefresh();
      notifyTransition(toStatus);
      return true;
    } catch (err) { console.error(err); return false; }
  };

  const checkGate = (toStatus, task) => {
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
    const openBrands = (task.brands || []).filter(b => !b.IsCompleted).length;
    if (toStatus === 'SUBMITTED' && openBrands > 0) {
      message.warning(`${openBrands} brand${openBrands > 1 ? 's' : ''} not covered yet.`);
      return false;
    }
    return true;
  };

  const loadTaskView = async () => {
    if (!taskId) return;
    try {
      const res = await tasksApi.getTaskView(taskId);
      if (res.success) setViewData(res.data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (taskId) loadTaskView();
  }, [taskId]);

  if (!task && !loading) return null;

  const { viewKey, definition, fallback } = useMemo(
    () => resolveViewForTask({ ...task, viewDefinition: viewData }),
    [task, viewData]
  );

  const ViewComponent = getView(viewKey) || GenericTaskView;

  const forwardStatuses = task ? (VALID_TRANSITIONS[task.Status] || []).filter(st => st !== 'APPROVED' && st !== 'REJECTED' && st !== 'CANCELLED') : [];
  const reviewStatuses = task ? (VALID_TRANSITIONS[task.Status] || []).filter(st => st === 'APPROVED' || st === 'REJECTED') : [];
  const primaryStatus = forwardStatuses[0];

  const checkGateWrapper = (st) => checkGate(st, task);
  const startTransition = (st) => { if (checkGateWrapper(st)) setTransModal({ toStatus: st, remarks: '' }); };

  if (loading || !task) {
    return (
      <Drawer
        title={null}
        open={open}
        onClose={onClose}
        size="min(1180px, 92vw)"
        destroyOnHidden
        styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }, header: { display: 'none' } }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><Spin size="large" /></div>
      </Drawer>
    );
  }

  return (
    <Drawer
      title={null}
      open={open}
      onClose={onClose}
      size="min(1180px, 92vw)"
      destroyOnHidden
      styles={{
        body: { padding: 0, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' },
        header: { display: 'none' },
      }}
    >
      <div style={{ display: 'flex', height: '100%' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 24px 12px', borderBottom: '1px solid var(--bc-border-default)', background: 'var(--bc-surface-card)', flexShrink: 0, position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: task.Source === 'RULESET' ? 'var(--bc-blue-600)' : (STATUS_COLORS[task.Status] || '#2563eb') }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Button type="text" size="small" onClick={onClose} aria-label="Close" style={{ fontSize: 16, color: 'var(--bc-text-secondary)', marginLeft: -8 }}>✕</Button>
              <Text code style={{ fontSize: 11 }}>{task.InstanceCode}</Text>
              <Tag style={{ fontSize: 10, borderRadius: 4, fontWeight: 700, margin: 0, background: (STATUS_COLORS[task.Status] || '#64748b') + '15', color: STATUS_COLORS[task.Status] || '#64748b', border: `1px solid ${(STATUS_COLORS[task.Status] || '#64748b')}30` }}>{WORKFLOW_STATUSES[task.Status]?.label || task.Status}</Tag>
              <div style={{ flex: 1 }} />
              <Tooltip title="Reload"><Button type="text" size="small" icon={<ReloadOutlined />} onClick={() => loadTask({ silent: true })} /></Tooltip>
              <Space size={6}>
                {['REJECTED'].includes(task.Status) && <Button size="small" danger onClick={() => setTransModal({ toStatus: 'REJECTED', remarks: '' })}>Reject</Button>}
                {['APPROVED'].includes(task.Status) && <Button size="small" type="primary" onClick={() => setTransModal({ toStatus: 'APPROVED', remarks: '' })}>Approve</Button>}
                {forwardStatuses.filter(st => st !== primaryStatus).map(st => (
                  <Button key={st} size="small" onClick={() => { if (checkGate(st, task)) setTransModal({ toStatus: st, remarks: '' }); }}>{WORKFLOW_STATUSES[st]?.label}</Button>
                ))}
                {primaryStatus && (
                  <Button size="small" type="primary" icon={<ArrowRightOutlined />} onClick={() => { if (checkGate(primaryStatus, task)) setTransModal({ toStatus: primaryStatus, remarks: '' }); }} style={{ fontWeight: 600 }}>
                    {primaryStatus === 'SUBMITTED' ? 'Submit for review' : primaryStatus === 'IN_PROGRESS' ? 'Start work' : WORKFLOW_STATUSES[primaryStatus]?.label}
                  </Button>
                )}
              </Space>
            </div>
            <Text strong style={{ fontSize: 19, letterSpacing: '-0.01em', color: 'var(--bc-text-heading)', display: 'block', marginTop: 8, lineHeight: 1.3 }}>{task.Title || task.TemplateName}</Text>
            {task.Description && <Text style={{ fontSize: 12, color: 'var(--bc-text-secondary)', display: 'block', marginTop: 2, maxWidth: 820 }}>{task.Description}</Text>}
            <WorkflowStepper status={task.Status} />
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: '8px 24px 24px' }}>
            <ViewComponent
              task={task}
              viewDefinition={task.viewDefinition?.definition}
              onAction={async (action) => {
                if (action.type === 'TRANSITION') {
                  await tasksApi.transitionStatus(taskId, action.toStatus, action.remarks);
                  await loadTask();
                }
              }}
            />
          </div>
        </div>
      </Drawer>
    );
  );
}

export default SharedTaskShell;