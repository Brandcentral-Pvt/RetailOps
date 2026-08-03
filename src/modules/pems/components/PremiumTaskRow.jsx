import React, { useState } from 'react';
import { Typography, Tag, Progress, Button, Space, Tooltip, Modal, Input, App } from 'antd';
import {
  EyeOutlined, ArrowRightOutlined, CheckCircleOutlined, CloseCircleOutlined,
  PlayCircleOutlined, UserOutlined, CalendarOutlined, ThunderboltOutlined,
  SafetyCertificateOutlined, DollarOutlined, ShoppingCartOutlined,
  WarningOutlined, BarChartOutlined
} from '@ant-design/icons';
import { WORKFLOW_STATUSES, VALID_TRANSITIONS, PRIORITIES, CATEGORY_METRIC_CONFIG, TASK_LIST_GRID } from '../constants';
import { calculateHealth, getDueDateLabel } from '../utils/taskHealth';
import pemsApi from '../services/pemsApi';

const { Text } = Typography;

const CATEGORY_BAR_COLORS = {
  PRICING: '#0891B2', LISTING: '#2563EB', INVENTORY: '#7C3AED',
  ADS: '#EA580C', ANALYTICS: '#16A34A', COMPLIANCE: '#DC2626', GENERAL: '#64748B',
};

const TAG_S = { fontSize: 'var(--bc-text-2xs)', borderRadius: 'var(--bc-radius-sm)', margin: 0, lineHeight: '16px', padding: '0 5px', display: 'inline-flex', alignItems: 'center', gap: 2 };

function CategoryMetrics({ task, categoryKey }) {
  if (categoryKey === 'PRICING') {
    const asp = task.SellingPrice || task.ASP;
    const sp = task.StandardPrice || task.SP;
    const mismatch = asp && sp ? Math.round(((asp - sp) / sp) * 100) : null;
    return (
      <Space size={4}>
        <Tooltip title={`ASP: $${asp ?? '—'}`}>
          <Tag style={{ ...TAG_S, background: '#ecfeff', color: '#0891b2', border: '1px solid #cffafe' }}>
            <DollarOutlined style={{ fontSize: 7 }} />${asp ?? '—'}
          </Tag>
        </Tooltip>
        <Tooltip title={`Std: $${sp ?? '—'}`}>
          <Tag style={{ ...TAG_S, background: 'var(--bc-amber-50)', color: '#ea580c', border: '1px solid var(--bc-amber-200)' }}>
            SP ${sp ?? '—'}
          </Tag>
        </Tooltip>
        {mismatch != null && (
          <Tag style={{ ...TAG_S, background: mismatch > 5 ? 'var(--bc-red-50)' : 'var(--bc-green-50)', color: mismatch > 5 ? 'var(--bc-red-600)' : 'var(--bc-green-600)', border: `1px solid ${mismatch > 5 ? 'var(--bc-red-200)' : 'var(--bc-green-200)'}`, fontWeight: 600 }}>
            {mismatch > 0 ? '+' : ''}{mismatch}%
          </Tag>
        )}
      </Space>
    );
  }

  if (categoryKey === 'LISTING') {
    const score = task.AIHealthScore ?? task.CatalogScore;
    const target = task.TargetScore ?? task.AITarget ?? 9.0;
    const passing = score >= target;
    return (
      <Space size={4}>
        <Tooltip title={`AI Health: ${score ?? '—'} / Target: ${target}`}>
          <Tag style={{ ...TAG_S,
            background: passing ? 'var(--bc-green-50)' : score >= 5 ? 'var(--bc-amber-50)' : 'var(--bc-red-50)',
            color: passing ? 'var(--bc-green-600)' : score >= 5 ? 'var(--bc-amber-600)' : 'var(--bc-red-600)',
            border: `1px solid ${passing ? 'var(--bc-green-200)' : score >= 5 ? 'var(--bc-amber-200)' : 'var(--bc-red-200)'}`,
            fontWeight: 600, fontFamily: 'var(--bc-font-mono)',
          }}>
            <SafetyCertificateOutlined style={{ fontSize: 7 }} />{score ?? '—'}→{target}
          </Tag>
        </Tooltip>
        {task.ImagesMissing > 0 && (
          <Tag style={{ ...TAG_S, background: 'var(--bc-red-50)', color: 'var(--bc-red-600)', border: '1px solid var(--bc-red-200)' }}>
            {task.ImagesMissing} img
          </Tag>
        )}
      </Space>
    );
  }

  if (categoryKey === 'INVENTORY') {
    const stock = task.AvailableStock ?? task.StockLevel;
    const min = task.MinStockThreshold ?? task.ReorderPoint;
    const isLow = stock != null && min != null && stock <= min;
    const isOut = stock === 0;
    return (
      <Space size={4}>
        <Tooltip title={`Stock: ${stock ?? '—'}`}>
          <Tag style={{ ...TAG_S,
            background: isOut ? 'var(--bc-red-50)' : isLow ? 'var(--bc-amber-50)' : 'var(--bc-green-50)',
            color: isOut ? 'var(--bc-red-600)' : isLow ? 'var(--bc-amber-600)' : 'var(--bc-green-600)',
            border: `1px solid ${isOut ? 'var(--bc-red-200)' : isLow ? 'var(--bc-amber-200)' : 'var(--bc-green-200)'}`,
            fontWeight: 600,
          }}>
            {stock ?? '—'} units
          </Tag>
        </Tooltip>
        {isOut && <Tag style={{ ...TAG_S, background: 'var(--bc-red-50)', color: 'var(--bc-red-600)', border: '1px solid var(--bc-red-200)' }}>OOS</Tag>}
        {isLow && !isOut && <Tag style={{ ...TAG_S, background: 'var(--bc-amber-50)', color: 'var(--bc-amber-600)', border: '1px solid var(--bc-amber-200)' }}>Low</Tag>}
      </Space>
    );
  }

  if (categoryKey === 'ADS') {
    const spend = task.ActualSpend ?? task.AdSpend;
    const budget = task.Budget ?? task.MonthlyBudget;
    const pct = spend && budget ? Math.round((spend / budget) * 100) : null;
    return (
      <Space size={4}>
        <Tooltip title={`Spend: $${spend ?? '—'}`}>
          <Tag style={{ ...TAG_S, background: 'var(--bc-amber-50)', color: '#ea580c', border: '1px solid var(--bc-amber-200)' }}>
            <BarChartOutlined style={{ fontSize: 7 }} />${spend ?? '—'}
          </Tag>
        </Tooltip>
        {pct != null && (
          <Tag style={{ ...TAG_S, background: pct > 80 ? 'var(--bc-red-50)' : 'var(--bc-green-50)', color: pct > 80 ? 'var(--bc-red-600)' : 'var(--bc-green-600)', border: `1px solid ${pct > 80 ? 'var(--bc-red-200)' : 'var(--bc-green-200)'}`, fontWeight: 600 }}>
            {pct}%
          </Tag>
        )}
      </Space>
    );
  }

  return null;
}

function getSlaLevel(task) {
  const sla = task.SLAStatus;
  if (sla === 'BREACHED') return { color: 'var(--bc-red-600)', bg: 'var(--bc-red-50)', label: 'Breached', level: 'critical' };
  if (sla === 'AT_RISK') return { color: 'var(--bc-amber-600)', bg: 'var(--bc-amber-50)', label: 'At Risk', level: 'warning' };
  if (!task.DueDate) return null;
  const h = (new Date(task.DueDate) - new Date()) / (1000 * 60 * 60);
  if (h < 12) return { color: 'var(--bc-amber-500)', bg: '#fefce8', label: '<12h', level: 'attention' };
  return { color: 'var(--bc-green-600)', bg: 'var(--bc-green-50)', label: 'On Track', level: 'healthy' };
}

export default function PremiumTaskRow({ task, index, selected, onSelect, onView, onRefresh }) {
  const { message } = App.useApp();
  const [transitioning, setTransitioning] = useState(null);
  const [submitModal, setSubmitModal] = useState(null);
  const [submitRemarks, setSubmitRemarks] = useState('');

  const isRuleTask = task.IsRuleTask || task.source === 'ACTION_RULE' || task.InstanceCode?.startsWith('R');
  const health = calculateHealth(task);
  const due = getDueDateLabel(task);
  const slaLevel = getSlaLevel(task);
  const pct = task.WeightedProgressPct || task.ProgressPct || 0;
  const statusCfg = WORKFLOW_STATUSES[task.Status] || {};
  const prCfg = PRIORITIES[task.Priority] || {};
  const nextStatuses = VALID_TRANSITIONS[task.Status] || [];
  const categoryKey = task.Category || task.Department;
  const categoryColor = CATEGORY_BAR_COLORS[categoryKey] || CATEGORY_BAR_COLORS.GENERAL;

  const allSubTasksDone = !task.subTasks?.length || task.subTasks.every(st => st.IsCompleted);
  const canStart = health.score >= 50;
  const isNewListing = categoryKey === 'LISTING' && task.InstanceCode?.includes('DLY-004');
  const aiTargetScore = task.TargetScore ?? task.AITarget ?? 9.0;
  const aiHealthTarget = isNewListing && task.AIHealthScore != null
    ? task.AIHealthScore >= aiTargetScore : true;

  const checkGate = (toStatus) => {
    if (toStatus === 'IN_PROGRESS' && !canStart) {
      message.warning(`Task health is ${health.score}/100 — below the minimum threshold (50). Resolve issues first.`);
      return false;
    }
    if (toStatus === 'SUBMITTED' && !allSubTasksDone) {
      message.warning('Complete all sub-tasks before submitting for review.');
      return false;
    }
    if (isNewListing && toStatus === 'SUBMITTED' && !aiHealthTarget) {
      message.warning(`AI Health Score (${task.AIHealthScore}) hasn't reached target (${aiTargetScore}). Improve listing quality before submitting.`);
      return false;
    }
    return true;
  };

  const handleTransition = async (toStatus, remarks = '') => {
    if (!checkGate(toStatus)) return;
    setTransitioning(toStatus);
    try {
      await pemsApi.transitionStatus(task.Id, toStatus, remarks);
      message.success(`${WORKFLOW_STATUSES[toStatus]?.label} — done`);
      setSubmitModal(null);
      setSubmitRemarks('');
      try {
        const { default: notificationApi } = await import('../../../services/notificationCenter');
        notificationApi?.notify?.({ type: 'task_transition', taskId: task.Id, message: `Task ${task.InstanceCode} → ${toStatus}`, data: { to: toStatus } });
      } catch (_) {}
      if (onRefresh) onRefresh();
    } catch (err) {
      message.error(`Failed: ${err.message}`);
    } finally {
      setTransitioning(null);
    }
  };

  const handleClick = (toStatus) => {
    if (toStatus === 'SUBMITTED') {
      if (!checkGate(toStatus)) return;
      setSubmitModal(toStatus);
      return;
    }
    handleTransition(toStatus);
  };

  const btnStyle = (s) => {
    if (s === 'IN_PROGRESS') return { background: '#2563eb', borderColor: '#2563eb', color: '#fff' };
    if (s === 'SUBMITTED') return { background: '#2563eb', borderColor: '#2563eb', color: '#fff' };
<<<<<<< HEAD
    if (s === 'CANCELLED') return { background: 'var(--bc-red-600)', borderColor: 'var(--bc-red-600)', color: '#fff' };
    return { background: 'var(--bc-white)', borderColor: 'var(--bc-border-strong)', color: 'var(--bc-text-body)' };
=======
    if (s === 'CANCELLED') return { background: '#D32F2F', borderColor: '#D32F2F', color: '#fff' };
    return { background: 'var(--bc-surface-card, #fff)', borderColor: 'var(--bc-border-strong, #d1d5db)', color: 'var(--bc-text-body, #374151)' };
>>>>>>> 6957627aacacd9b2675c14e8ed4b5cb398e08c77
  };

  return (
    <>
      <div
        className={`pems-task-row${selected ? ' selected' : ''}`}
        style={{
          display: 'grid',
          gridTemplateColumns: TASK_LIST_GRID,
          alignItems: 'center',
          gap: 8,
          padding: '10px 16px',
<<<<<<< HEAD
          borderBottom: '1px solid var(--bc-border-subtle)',
          background: selected ? 'var(--bc-blue-50)' : 'var(--bc-white)',
=======
          borderBottom: '1px solid var(--bc-border-subtle, #f1f5f9)',
>>>>>>> 6957627aacacd9b2675c14e8ed4b5cb398e08c77
          cursor: 'pointer',
          transition: 'background 0.1s ease',
          position: 'relative'
        }}
        onClick={() => onView(task)}
      >
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: isRuleTask ? '#0288D1' : categoryColor }} />

        <div onClick={e => e.stopPropagation()}>
          <input type="checkbox" checked={selected} onChange={() => onSelect(task.Id)}
            style={{ width: 14, height: 14, cursor: 'pointer', accentColor: 'var(--bc-ro-500, #1976D2)' }} />
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {isRuleTask && (
              <Tooltip title="Auto-generated by rule engine">
                <ThunderboltOutlined style={{ color: '#0288D1', fontSize: 11, flexShrink: 0 }} />
              </Tooltip>
            )}
<<<<<<< HEAD
            <Text strong style={{ fontSize: 'var(--bc-text-sm)', color: 'var(--bc-text-heading)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
=======
            <Text strong style={{ fontSize: 13, color: 'var(--bc-text-heading, #0f172a)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
>>>>>>> 6957627aacacd9b2675c14e8ed4b5cb398e08c77
              {task.Title || 'Untitled'}
            </Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
            {isRuleTask && (
              <Tag style={{ fontSize: 'var(--bc-text-2xs)', borderRadius: 'var(--bc-radius-sm)', background: '#e0f2fe', color: '#0288D1', border: 'none', margin: 0, lineHeight: '14px', padding: '0 4px', fontWeight: 600 }}>Auto</Tag>
            )}
<<<<<<< HEAD
            <Text style={{ fontSize: 'var(--bc-text-2xs)', color: 'var(--bc-text-muted)', fontFamily: 'var(--bc-font-mono)' }}>{task.InstanceCode}</Text>
            <Text style={{ fontSize: 'var(--bc-text-2xs)', color: 'var(--bc-text-muted)' }}>·</Text>
            <Text style={{ fontSize: 'var(--bc-text-2xs)', color: 'var(--bc-text-muted)' }}>{task.SellerName || '-'}</Text>
=======
            <Text style={{ fontSize: 10, color: 'var(--bc-text-muted, #94a3b8)', fontFamily: 'monospace' }}>{task.InstanceCode}</Text>
            <Text style={{ fontSize: 10, color: 'var(--bc-text-muted, #94a3b8)' }}>·</Text>
            <Text style={{ fontSize: 10, color: 'var(--bc-text-muted, #94a3b8)' }}>{task.SellerName || '-'}</Text>
>>>>>>> 6957627aacacd9b2675c14e8ed4b5cb398e08c77
          </div>
        </div>

        <div style={{ minWidth: 0 }}>
          <CategoryMetrics task={task} categoryKey={categoryKey} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          {task.AssigneeName ? (
<<<<<<< HEAD
            <div style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--bc-blue-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb', fontSize: 10, fontWeight: 600, flexShrink: 0 }}>
              {task.AssigneeName.charAt(0)}
            </div>
          ) : <UserOutlined style={{ color: 'var(--bc-border-strong)', fontSize: 12 }} />}
          <Text style={{ fontSize: 'var(--bc-text-xs)', color: 'var(--bc-text-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.AssigneeName?.split(' ')[0] || '—'}</Text>
=======
            <div style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--bc-ro-50, #E3F2FD)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bc-ro-500, #1976D2)', fontSize: 10, fontWeight: 600, flexShrink: 0 }}>
              {task.AssigneeName.charAt(0)}
            </div>
          ) : <UserOutlined style={{ color: 'var(--bc-slate-300, #d1d5db)', fontSize: 12 }} />}
          <Text style={{ fontSize: 11, color: 'var(--bc-text-body, #334155)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.AssigneeName?.split(' ')[0] || '—'}</Text>
>>>>>>> 6957627aacacd9b2675c14e8ed4b5cb398e08c77
        </div>

        <div>
          {task.Priority && (
            <Tag style={{ fontSize: 'var(--bc-text-2xs)', borderRadius: 6, background: prCfg.bg, color: prCfg.color, border: `1px solid ${prCfg.color}20`, fontWeight: 600, padding: '2px 6px', margin: 0 }}>{task.Priority}</Tag>
          )}
        </div>

        <div>
          <Tag style={{ fontSize: 'var(--bc-text-xs)', borderRadius: 10, background: statusCfg.bg, color: statusCfg.color, border: `1px solid ${statusCfg.color}25`, fontWeight: 600, padding: '2px 10px', margin: 0 }}>
            {statusCfg.label}
          </Tag>
        </div>

        <div>
          {slaLevel ? (
            <Tooltip title={`SLA: ${slaLevel.label}`}>
              <div style={{
                fontSize: 'var(--bc-text-2xs)', fontWeight: 600, color: slaLevel.color,
                background: slaLevel.bg, borderRadius: 'var(--bc-radius-sm)', padding: '1px 6px',
                border: `1px solid ${slaLevel.color}20`, textAlign: 'center', whiteSpace: 'nowrap',
              }}>
                {slaLevel.label}
              </div>
            </Tooltip>
<<<<<<< HEAD
          ) : <Text style={{ fontSize: 'var(--bc-text-xs)', color: 'var(--bc-text-disabled)' }}>—</Text>}
=======
          ) : <Text style={{ fontSize: 11, color: 'var(--bc-slate-300, #d1d5db)' }}>—</Text>}
>>>>>>> 6957627aacacd9b2675c14e8ed4b5cb398e08c77
        </div>

        <div>
          {due ? (
            <Space size={3}>
              <CalendarOutlined style={{ fontSize: 10, color: due.color }} />
              <Text style={{ fontSize: 'var(--bc-text-xs)', fontWeight: 600, color: due.color }}>{due.text}</Text>
            </Space>
<<<<<<< HEAD
          ) : <Text style={{ fontSize: 'var(--bc-text-xs)', color: 'var(--bc-text-disabled)' }}>—</Text>}
=======
          ) : <Text style={{ fontSize: 11, color: 'var(--bc-slate-300, #d1d5db)' }}>—</Text>}
>>>>>>> 6957627aacacd9b2675c14e8ed4b5cb398e08c77
        </div>

        <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Tooltip title="View details">
            <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => onView(task)}
<<<<<<< HEAD
              style={{ fontSize: 13, color: 'var(--bc-text-muted)', padding: '0 4px' }} />
=======
              style={{ fontSize: 13, color: 'var(--bc-text-muted, #94a3b8)', padding: '0 4px' }} />
>>>>>>> 6957627aacacd9b2675c14e8ed4b5cb398e08c77
          </Tooltip>
          {!isRuleTask && nextStatuses.filter(s => s === 'IN_PROGRESS' || s === 'SUBMITTED').map(s => {
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
          {!isRuleTask && task.Status === 'IN_PROGRESS' && (
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
          <div style={{ padding: '8px 12px', background: 'var(--bc-amber-50)', border: '1px solid var(--bc-amber-200)', borderRadius: "var(--bc-radius-md)", marginBottom: 12 }}>
            <Text style={{ fontSize: 'var(--bc-text-xs)', color: 'var(--bc-amber-800)', fontWeight: 600 }}>Describe what work was done before submitting.</Text>
          </div>
          <Text style={{ fontSize: 'var(--bc-text-sm)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Work Summary <Text type="danger">*</Text></Text>
          <Input.TextArea
            rows={4}
            value={submitRemarks}
            onChange={e => setSubmitRemarks(e.target.value)}
            placeholder={"• Completed all checklist items\n• Updated listings\n• Ready for review"}
            style={{ borderRadius: "var(--bc-radius-md)" }}
          />
        </div>
      </Modal>
    </>
  );
}
