import React, { useState } from 'react';
import { Typography, Tag, Progress, Button, Space, Tooltip, Modal, Input, App } from 'antd';
import { EyeOutlined, ArrowRightOutlined, CheckCircleOutlined, CloseCircleOutlined, PlayCircleOutlined, UserOutlined, CalendarOutlined } from '@ant-design/icons';
import { WORKFLOW_STATUSES, VALID_TRANSITIONS, PRIORITIES } from '../constants';
import { calculateHealth, getDueDateLabel } from '../utils/taskHealth';
import pemsApi from '../services/pemsApi';

const { Text } = Typography;

const STATUS_BAR_COLORS = {
  DRAFT: '#94a3b8', ASSIGNED: '#0288D1', ACCEPTED: '#9C27B0', IN_PROGRESS: '#1976D2',
  SUBMITTED: '#ED6C02', UNDER_REVIEW: '#9C27B0', APPROVED: '#2E7D32',
  REJECTED: '#D32F2F', REWORK: '#E65100', CANCELLED: '#94a3b8',
};

export default function PremiumTaskRow({ task, index, selected, onSelect, onView, onRefresh }) {
  const { message } = App.useApp();
  const [transitioning, setTransitioning] = useState(null);
  const [submitModal, setSubmitModal] = useState(null);
  const [submitRemarks, setSubmitRemarks] = useState('');

  const health = calculateHealth(task);
  const due = getDueDateLabel(task);
  const pct = task.WeightedProgressPct || task.ProgressPct || 0;
  const statusCfg = WORKFLOW_STATUSES[task.Status] || {};
  const prCfg = PRIORITIES[task.Priority] || {};
  const nextStatuses = VALID_TRANSITIONS[task.Status] || [];

  const handleTransition = async (toStatus, remarks = '') => {
    setTransitioning(toStatus);
    try {
      await pemsApi.transitionStatus(task.Id, toStatus, remarks);
      message.success(`${WORKFLOW_STATUSES[toStatus]?.label} — done`);
      setSubmitModal(null);
      setSubmitRemarks('');
      if (onRefresh) onRefresh();
    } catch (err) {
      message.error(`Failed: ${err.message}`);
    } finally {
      setTransitioning(null);
    }
  };

  const handleClick = (toStatus) => {
    if (toStatus === 'SUBMITTED') {
      setSubmitModal(toStatus);
      return;
    }
    handleTransition(toStatus);
  };

  const btnStyle = (s) => {
    if (s === 'IN_PROGRESS') return { background: '#1976D2', borderColor: '#1976D2', color: '#fff' };
    if (s === 'SUBMITTED') return { background: '#2563eb', borderColor: '#2563eb', color: '#fff' };
    if (s === 'CANCELLED') return { background: '#D32F2F', borderColor: '#D32F2F', color: '#fff' };
    return { background: '#fff', borderColor: '#d1d5db', color: '#374151' };
  };

  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '36px minmax(0,2fr) 120px 90px 110px 100px 90px minmax(150px, auto)',
          alignItems: 'center',
          gap: 12,
          padding: '10px 16px',
          borderBottom: '1px solid #f1f5f9',
          background: selected ? '#eff6ff' : '#fff',
          cursor: 'pointer',
          transition: 'all 0.1s ease',
          position: 'relative'
        }}
        onClick={() => onView(task)}
      >
        {/* Status color bar */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: STATUS_BAR_COLORS[task.Status] || '#94a3b8' }} />

        {/* Checkbox */}
        <div onClick={e => e.stopPropagation()}>
          <input type="checkbox" checked={selected} onChange={() => onSelect(task.Id)}
            style={{ width: 14, height: 14, cursor: 'pointer', accentColor: '#2563eb' }} />
        </div>

        {/* Title + meta */}
        <div style={{ minWidth: 0 }}>
          <Text strong style={{ fontSize: 13, color: '#0f172a', display: 'block', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.Title || 'Untitled'}
          </Text>
          <Text style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>{task.InstanceCode} · {task.SellerName || '-'}</Text>
        </div>

        {/* Assignee */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          {task.AssigneeName ? (
            <div style={{ width: 22, height: 22, borderRadius: 6, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb', fontSize: 10, fontWeight: 600, flexShrink: 0 }}>
              {task.AssigneeName.charAt(0)}
            </div>
          ) : <UserOutlined style={{ color: '#d1d5db', fontSize: 12 }} />}
          <Text style={{ fontSize: 11, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.AssigneeName?.split(' ')[0] || '—'}</Text>
        </div>

        {/* Priority */}
        <div>
          {task.Priority && (
            <Tag style={{ fontSize: 9, borderRadius: 6, background: prCfg.bg, color: prCfg.color, border: `1px solid ${prCfg.color}20`, fontWeight: 600, padding: '2px 6px', margin: 0 }}>{task.Priority}</Tag>
          )}
        </div>

        {/* Status */}
        <div>
          <Tag style={{ fontSize: 10, borderRadius: 10, background: statusCfg.bg, color: statusCfg.color, border: `1px solid ${statusCfg.color}25`, fontWeight: 600, padding: '2px 10px', margin: 0 }}>
            {statusCfg.label}
          </Tag>
        </div>

        {/* Progress */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Progress percent={pct} size="small" strokeColor={pct >= 80 ? '#2E7D32' : pct >= 50 ? '#2563eb' : '#ED6C02'} style={{ width: 50, margin: 0 }} showInfo={false} />
            <Text style={{ fontSize: 10, fontWeight: 600, color: '#64748b' }}>{pct}%</Text>
          </div>
        </div>

        {/* Due */}
        <div>
          {due ? (
            <Space size={4}>
              <CalendarOutlined style={{ fontSize: 10, color: due.color }} />
              <Text style={{ fontSize: 11, fontWeight: 600, color: due.color }}>{due.text}</Text>
            </Space>
          ) : <Text style={{ fontSize: 11, color: '#d1d5db' }}>—</Text>}
        </div>

        {/* Actions */}
        <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Tooltip title="View details">
            <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => onView(task)}
              style={{ fontSize: 13, color: '#94a3b8', padding: '0 4px' }} />
          </Tooltip>
          {nextStatuses.filter(s => s === 'IN_PROGRESS' || s === 'SUBMITTED').map(s => {
            const btnLabel = s === 'IN_PROGRESS' ? 'Start' : 'Submit';
            return (
              <Button
                key={s}
                size="small"
                icon={s === 'IN_PROGRESS' ? <PlayCircleOutlined /> : <ArrowRightOutlined />}
                loading={transitioning === s}
                onClick={() => handleClick(s)}
                style={{ borderRadius: 6, fontWeight: 600, fontSize: 11, height: 26, padding: '0 8px', ...btnStyle(s) }}
              >
                {btnLabel}
              </Button>
            );
          })}
          {task.Status === 'IN_PROGRESS' && (
            <Button
              key="CANCELLED"
              size="small"
              icon={<CloseCircleOutlined />}
              loading={transitioning === 'CANCELLED'}
              onClick={() => handleTransition('CANCELLED')}
              style={{ borderRadius: 6, fontWeight: 600, fontSize: 11, height: 26, padding: '0 8px', ...btnStyle('CANCELLED') }}
            >
              Stop
            </Button>
          )}
        </div>
      </div>

      <Modal
        title="Submit for Review"
        open={!!submitModal}
        onCancel={() => { setSubmitModal(null); setSubmitRemarks(''); }}
        onOk={() => handleTransition('SUBMITTED', submitRemarks)}
        confirmLoading={transitioning === 'SUBMITTED'}
        okText="Submit"
        destroyOnHidden
        width={480}
      >
        <div style={{ padding: '4px 0' }}>
          <div style={{ padding: '8px 12px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: "var(--radius-md)", marginBottom: 12 }}>
            <Text style={{ fontSize: 'var(--font-size-xs)', color: '#92400e', fontWeight: 600 }}>Describe what work was done before submitting.</Text>
          </div>
          <Text style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Work Summary <Text type="danger">*</Text></Text>
          <Input.TextArea
            rows={4}
            value={submitRemarks}
            onChange={e => setSubmitRemarks(e.target.value)}
            placeholder={"• Completed all checklist items\n• Updated listings\n• Ready for review"}
            style={{ borderRadius: "var(--radius-md)" }}
          />
        </div>
      </Modal>
    </>
  );
}
