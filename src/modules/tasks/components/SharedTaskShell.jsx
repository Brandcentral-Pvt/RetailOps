import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Drawer, Typography, Space, Tag, Button, Spin, Tooltip, Modal, App, Input, Alert } from 'antd';
import { CheckCircleOutlined, ArrowRightOutlined, ReloadOutlined } from '@ant-design/icons';
import tasksApi from '../services/tasksApi';
import { useAuth } from '../../../contexts/AuthContext';
import { resolveViewForTask, getView } from '../view-registry/taskViewRegistry';
import GenericTaskView from '../views/generic/GenericTaskView';
import { WORKFLOW_STATUSES, VALID_TRANSITIONS } from '../constants';
import { calculateHealth } from '../utils/taskHealth';

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

export default function SharedTaskShell({ open, onClose, taskId, onRefresh }) {
  const { user: currentUser } = useAuth();
  const { message } = App.useApp();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewData, setViewData] = useState(null);
  const [transModal, setTransModal] = useState({ toStatus: null, remarks: '' });
  const [transLoading, setTransLoading] = useState(false);

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

  useEffect(() => {
    const timer = setTimeout(() => {
      setViewData(null);
      loadTask();
    }, 0);
    return () => clearTimeout(timer);
  }, [taskId, loadTask]);

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
    if (!toStatus) return false;
    if (toStatus === 'SUBMITTED' && !remarks.trim()) {
      message.warning('Enter submission remarks before submitting for review.');
      return false;
    }
    setTransLoading(true);
    try {
      await tasksApi.transitionStatus(taskId, toStatus, remarks);
      await loadTask();
      if (onRefresh) onRefresh();
      notifyTransition(toStatus);
      setTransModal({ toStatus: null, remarks: '' });
      return true;
    } catch (err) {
      console.error(err);
      message.error(err?.message || 'Task status update failed');
      return false;
    } finally {
      setTransLoading(false);
    }
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

  const { viewKey, definition, fallback, warning } = useMemo(
    () => resolveViewForTask({ ...(task || {}), viewDefinition: viewData }),
    [task, viewData]
  );

  if (!task && !loading) return null;

  const forwardStatuses = task ? (VALID_TRANSITIONS[task.Status] || []).filter(st => st !== 'APPROVED' && st !== 'REJECTED' && st !== 'CANCELLED') : [];
  const primaryStatus = forwardStatuses[0];

  if (loading || !task) {
    return (
      <Drawer
        title={null}
        open={open}
        onClose={onClose}
        width="min(1180px, 92vw)"
        destroyOnHidden
        styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }, header: { display: 'none' } }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><Spin size="large" /></div>
      </Drawer>
    );
  }

  return (
    <>
      <Drawer
        title={null}
        open={open}
        onClose={onClose}
        width="min(1180px, 92vw)"
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
            {fallback && (
              <Alert
                type="warning"
                showIcon
                style={{ margin: '8px 0 12px' }}
                message={warning || `View "${viewKey}" is unavailable; using the standard task view.`}
              />
            )}
            {React.createElement(getView(viewKey) || GenericTaskView, {
              task,
              viewDefinition: definition,
              onAction: async (action) => {
                if (action.type === 'TRANSITION') {
                  await handleTransition(action.toStatus, action.remarks);
                }
              },
            })}
          </div>
        </div>
      </div>
      </Drawer>

      <Modal
        open={Boolean(transModal.toStatus)}
        title={`Transition to ${WORKFLOW_STATUSES[transModal.toStatus]?.label || transModal.toStatus || ''}`}
        okText="Confirm"
        onOk={() => handleTransition(transModal.toStatus, transModal.remarks)}
        confirmLoading={transLoading}
        onCancel={() => setTransModal({ toStatus: null, remarks: '' })}
      >
        <Text style={{ fontSize: 12, color: 'var(--bc-text-secondary)', display: 'block', marginBottom: 8 }}>
          {transModal.toStatus === 'SUBMITTED'
            ? 'Submission remarks are required.'
            : 'Optionally add remarks for the audit trail.'}
        </Text>
        <Input.TextArea
          rows={3}
          value={transModal.remarks}
          onChange={(event) => setTransModal(current => ({ ...current, remarks: event.target.value }))}
          placeholder={transModal.toStatus === 'SUBMITTED' ? 'What was completed?' : 'Remarks (optional)'}
        />
      </Modal>
    </>
  );
}