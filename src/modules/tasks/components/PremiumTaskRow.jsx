import React, { useState } from 'react';
import { Typography, Tag, Progress, Button, Space, Tooltip, Modal, Input, App, Dropdown } from 'antd';
import {
  EyeOutlined, ArrowRightOutlined, CheckCircleOutlined, CloseCircleOutlined,
  PlayCircleOutlined, UserOutlined, CalendarOutlined, ThunderboltOutlined,
  SafetyCertificateOutlined, DollarOutlined, ShoppingCartOutlined,
  WarningOutlined, BarChartOutlined, CheckSquareOutlined, PaperClipOutlined,
  MessageOutlined, TagsOutlined, AuditOutlined, MoreOutlined
} from '@ant-design/icons';
import { WORKFLOW_STATUSES, VALID_TRANSITIONS, PRIORITIES, CATEGORY_METRIC_CONFIG, TASK_LIST_GRID, TASK_LIST_MIN_WIDTH } from '../constants';
import { calculateHealth, getDueDateLabel } from '../utils/taskHealth';
import tasksApi from '../services/tasksApi';

const { Text } = Typography;

const CATEGORY_BAR_COLORS = {
  PRICING: '#0891B2', LISTING: '#2563EB', INVENTORY: '#7C3AED',
  ADS: '#EA580C', ANALYTICS: '#16A34A', COMPLIANCE: '#DC2626', GENERAL: '#64748B',
};

function CategoryMetrics({ task, categoryKey }) {
  if (categoryKey === 'PRICING') {
    const asp = task.SellingPrice || task.ASP;
    const sp = task.StandardPrice || task.SP;
    const mismatch = asp && sp ? Math.round(((asp - sp) / sp) * 100) : null;
    return (
      <Space size={4}>
        <Tooltip title={`ASP: $${asp ?? '—'}`}>
          <Tag style={{ fontSize: 9, borderRadius: 4, background: '#f0fdfa', color: '#0d9488', border: '1px solid #99f6e4', margin: 0, lineHeight: '16px', padding: '0 5px', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
            <DollarOutlined style={{ fontSize: 7 }} />${asp ?? '—'}
          </Tag>
        </Tooltip>
        <Tooltip title={`Std: $${sp ?? '—'}`}>
          <Tag style={{ fontSize: 9, borderRadius: 4, background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', margin: 0, lineHeight: '16px', padding: '0 5px', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
            SP ${sp ?? '—'}
          </Tag>
        </Tooltip>
        {mismatch != null && (
          <Tag style={{ fontSize: 9, borderRadius: 4, background: mismatch > 5 ? '#fef2f2' : '#f0fdf4', color: mismatch > 5 ? '#dc2626' : '#16a34a', border: `1px solid ${mismatch > 5 ? '#fecaca' : '#bbf7d0'}`, margin: 0, fontWeight: 600, lineHeight: '16px', padding: '0 5px' }}>
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
          <Tag style={{ fontSize: 9, borderRadius: 4, margin: 0, lineHeight: '16px', padding: '0 5px',
            background: passing ? '#f0fdf4' : score >= 5 ? '#fffbeb' : '#fef2f2',
            color: passing ? '#16a34a' : score >= 5 ? '#d97706' : '#dc2626',
            border: `1px solid ${passing ? '#bbf7d0' : score >= 5 ? '#fde68a' : '#fecaca'}`,
            fontWeight: 600, fontFamily: 'monospace',
          }}>
            <SafetyCertificateOutlined style={{ fontSize: 7 }} />{score ?? '—'}→{target}
          </Tag>
        </Tooltip>
        {task.ImagesMissing > 0 && (
          <Tag style={{ fontSize: 9, borderRadius: 4, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', margin: 0, lineHeight: '16px', padding: '0 5px' }}>
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
          <Tag style={{ fontSize: 9, borderRadius: 4, margin: 0, lineHeight: '16px', padding: '0 5px',
            background: isOut ? '#fef2f2' : isLow ? '#fffbeb' : '#f0fdf4',
            color: isOut ? '#dc2626' : isLow ? '#d97706' : '#16a34a',
            border: `1px solid ${isOut ? '#fecaca' : isLow ? '#fde68a' : '#bbf7d0'}`,
            fontWeight: 600,
          }}>
            {stock ?? '—'} units
          </Tag>
        </Tooltip>
        {isOut && <Tag style={{ fontSize: 9, borderRadius: 4, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', margin: 0, lineHeight: '16px', padding: '0 5px' }}>OOS</Tag>}
        {isLow && !isOut && <Tag style={{ fontSize: 9, borderRadius: 4, background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a', margin: 0, lineHeight: '16px', padding: '0 5px' }}>Low</Tag>}
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
          <Tag style={{ fontSize: 9, borderRadius: 4, background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', margin: 0, lineHeight: '16px', padding: '0 5px' }}>
            <BarChartOutlined style={{ fontSize: 7 }} />${spend ?? '—'}
          </Tag>
        </Tooltip>
        {pct != null && (
          <Tag style={{ fontSize: 9, borderRadius: 4, background: pct > 80 ? '#fef2f2' : '#f0fdf4', color: pct > 80 ? '#dc2626' : '#16a34a', border: `1px solid ${pct > 80 ? '#fecaca' : '#bbf7d0'}`, margin: 0, lineHeight: '16px', padding: '0 5px', fontWeight: 600 }}>
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
  if (sla === 'BREACHED') return { color: '#DC2626', bg: '#fef2f2', label: 'Breached', level: 'critical' };
  if (sla === 'AT_RISK') return { color: '#EA580C', bg: '#fff7ed', label: 'At Risk', level: 'warning' };
  if (!task.DueDate) return null;
  const h = (new Date(task.DueDate) - new Date()) / (1000 * 60 * 60);
  if (h < 12) return { color: '#EAB308', bg: '#fefce8', label: '<12h', level: 'attention' };
  return { color: '#16A34A', bg: '#f0fdf4', label: 'On Track', level: 'healthy' };
}

const initials = (name) => String(name || '').trim().split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';

/** Deterministic avatar tint so the same person keeps the same colour. */
function avatarTint(seed) {
  const s = String(seed || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const hues = [212, 262, 340, 16, 152, 190, 222, 288];
  const hue = hues[h % hues.length];
  return { bg: `hsl(${hue} 85% 95%)`, fg: `hsl(${hue} 62% 38%)`, border: `hsl(${hue} 60% 84%)` };
}

const countOf = (v) => (Array.isArray(v) ? v.length : 0);

/** Tiny inline counter used for the required-docs strip. */
function DocChip({ icon, value, label, tone = '#64748b', bg = '#f8fafc', border = '#e2e8f0' }) {
  if (!value) return null;
  return (
    <Tooltip title={label}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 9, fontWeight: 600,
        lineHeight: '15px', padding: '0 5px', borderRadius: 4, color: tone,
        background: bg, border: `1px solid ${border}`, whiteSpace: 'nowrap',
      }}>
        {icon}
        {value}
      </span>
    </Tooltip>
  );
}

/** Seller column. Daily routines are brand-less, so that case is labelled. */
function SellerCell({ task }) {
  if (!task.SellerId && !task.SellerName) {
    return (
      <Tooltip title="Daily routines span all of a person's brands, so no single seller is attached.">
        <Tag style={{ fontSize: 9, borderRadius: 4, margin: 0, lineHeight: '16px', padding: '0 6px', background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }}>
          All brands
        </Tag>
      </Tooltip>
    );
  }
  const tint = avatarTint(task.SellerId || task.SellerName);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
      <span style={{
        width: 20, height: 20, borderRadius: 5, flexShrink: 0,
        background: tint.bg, border: `1px solid ${tint.border}`, color: tint.fg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9, fontWeight: 700,
      }}>
        {initials(task.SellerName)}
      </span>
      <Text
        style={{
          fontSize: 11.5, color: 'var(--bc-text-body, #334155)', fontWeight: 500,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
        }}
      >
        {task.SellerName || task.SellerId}
      </Text>
    </div>
  );
}

/**
 * Details column: a short overview of the work plus the required-document
 * counters (sub-tasks, attachments, review feedback, ASINs). Falls back to the
 * category/frequency meta when a task has no description.
 */
function DetailsCell({ task, categoryKey }) {
  const desc = (task.Description || '').trim();
  const subTotal = task.SubTaskCount ?? 0;
  const subDone = task.CompletedSubTasks ?? 0;
  const attachments = countOf(task.Attachments);
  const asins = countOf(Array.isArray(task.Asins) ? task.Asins : []);
  const tags = countOf(task.Tags);

  // Chips are the only wrapping element in this cell, and an unbounded set of
  // them wrapped to 3-4 lines and made single rows ~400px tall. Cap what is
  // inline and roll the rest into a single summary chip; the full breakdown is
  // in the workspace when the row is opened.
  const chips = [];
  if (subTotal > 0) {
    chips.push({
      key: 'subtasks', icon: <CheckSquareOutlined style={{ fontSize: 8 }} />, value: `${subDone}/${subTotal}`,
      label: `Sub-tasks completed (${subDone} of ${subTotal})`,
      tone: subDone >= subTotal ? '#16a34a' : '#d97706',
      bg: subDone >= subTotal ? '#f0fdf4' : '#fffbeb',
      border: subDone >= subTotal ? '#bbf7d0' : '#fde68a',
    });
  }
  if (attachments) chips.push({ key: 'files', icon: <PaperClipOutlined style={{ fontSize: 8 }} />, value: attachments, label: `${attachments} attached file${attachments === 1 ? '' : 's'}`, tone: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' });
  if (task.LastFeedback) chips.push({ key: 'fb', icon: <MessageOutlined style={{ fontSize: 8 }} />, value: 'FB', label: `Reviewer feedback: ${task.LastFeedback}`, tone: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' });
  if (asins) chips.push({ key: 'asins', icon: <TagsOutlined style={{ fontSize: 8 }} />, value: asins, label: `${asins} ASIN${asins === 1 ? '' : 's'} in scope`, tone: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' });
  if (task.RequiredApprovals > 1) chips.push({ key: 'appr', icon: <AuditOutlined style={{ fontSize: 8 }} />, value: task.RequiredApprovals, label: `Needs ${task.RequiredApprovals} approvals`, tone: '#b45309', bg: '#fffbeb', border: '#fde68a' });
  if (tags) chips.push({ key: 'tags', icon: <TagsOutlined style={{ fontSize: 8 }} />, value: tags, label: `${tags} label(s)` });

  const MAX_CHIPS = 3;
  const shown = chips.slice(0, MAX_CHIPS);
  const hidden = chips.length - shown.length;

  return (
    <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {desc ? (
        // A plain element with a hard max-height, not -webkit-line-clamp via
        // antd <Text>: the clamp never applied there and the full description
        // rendered, which is what made a single row ~400px tall.
        <div
          title={desc}
          style={{
            fontSize: 11, lineHeight: '14px', color: 'var(--bc-text-secondary, #64748b)',
            maxHeight: 28, overflow: 'hidden', wordBreak: 'break-word',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}
        >
          {desc}
        </div>
      ) : (
        <Text style={{ fontSize: 11, color: 'var(--bc-slate-400, #94a3b8)', fontStyle: 'italic' }}>
          {task.Frequency && task.Frequency !== 'ONCE'
            ? `${String(task.Frequency).toLowerCase().replace(/_/g, ' ')} · ${String(categoryKey || 'general').toLowerCase()}`
            : `No description · ${String(categoryKey || 'general').toLowerCase()}`}
        </Text>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'nowrap', overflow: 'hidden' }}>
        {shown.map((c) => (
          <DocChip
            key={c.key}
            icon={c.icon}
            value={c.value}
            label={c.label}
            tone={c.tone}
            bg={c.bg}
            border={c.border}
          />
        ))}
        {hidden > 0 && (
          <DocChip
            value={`+${hidden}`}
            label={`Plus ${hidden} more detail${hidden === 1 ? '' : 's'}`}
            tone="#64748b" bg="#f8fafc" border="#e2e8f0"
          />
        )}
      </div>
    </div>
  );
}

/** Assignee + reviewer. Both are shown because a task has two owners. */
function AssigneeCell({ task }) {
  if (!task.AssigneeName && !task.AssignedTo) {
    return (
      <div className="tasks-person tasks-person--empty">
        <span className="tasks-person__avatar" style={{ borderStyle: 'dashed', borderColor: 'var(--tec-border-strong, #cdd5e0)', color: 'var(--tec-text-4, #94a3b8)' }}>
          <UserOutlined />
        </span>
        <span className="tasks-person__name">Unassigned</span>
      </div>
    );
  }
  const tint = avatarTint(task.AssigneeName || task.AssignedTo);
  const name = task.AssigneeName || 'Unassigned';
  return (
    <div className="tasks-person">
      <span className="tasks-person__avatar" style={{ background: tint.bg, borderColor: tint.border, color: tint.fg }}>
        {initials(name)}
      </span>
      <div style={{ minWidth: 0 }}>
        <div className="tasks-person__name">{name}</div>
        {task.ReviewerName && <div className="tasks-person__sub">Rev: {task.ReviewerName}</div>}
      </div>
    </div>
  );
}

/** Progress: weighted sub-task completion with the category KPI chips below. */
function ProgressCell({ task, categoryKey, pct }) {
  return (
    <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div className="tasks-progress">
        <div className="tasks-progress__track">
          <div
            className="tasks-progress__fill"
            style={{
              width: `${Math.min(100, Math.max(0, Math.round(pct || 0)))}%`,
              background: (pct || 0) >= 100 ? 'var(--bc-green-600, #16a34a)' : 'var(--tec-primary, #1976d2)',
            }}
          />
        </div>
        <span className="tasks-progress__value">{Math.round(pct || 0)}%</span>
      </div>
      <div style={{ overflow: 'hidden' }}>
        <CategoryMetrics task={task} categoryKey={categoryKey} />
      </div>
    </div>
  );
}

export default function PremiumTaskRow({ task, selected, onSelect, onView, onRefresh }) {
  const { message } = App.useApp();
  const [transitioning, setTransitioning] = useState(null);
  const [submitModal, setSubmitModal] = useState(null);
  const [submitRemarks, setSubmitRemarks] = useState('');

  const isRuleTask = task.IsRuleTask || task.source === 'ACTION_RULE' || task.InstanceCode?.startsWith('R') || task.Source === 'RULESET';
  const rulesetName = task.SourceRef || task.RulesetName || '';
  const rulesetId = task.SourceId || task.RulesetId || '';
  const handleRulesetClick = (e) => {
    e.stopPropagation();
    if (rulesetId) window.open(`/rule-sets/${rulesetId}`, '_blank', 'noopener');
    else window.open('/rule-sets', '_blank', 'noopener');
  };
  const health = calculateHealth(task);
  const due = getDueDateLabel(task);
  const slaLevel = getSlaLevel(task);
  const pct = task.WeightedProgressPct || task.ProgressPct || 0;
  const statusCfg = WORKFLOW_STATUSES[task.Status] || {};
  // Map the existing antd status hints onto the flat badge tones so the colour
  // system stays consistent without inventing new workflow values.
  const statusTone = {
    success: 'success', error: 'danger', warning: 'warning',
    purple: 'automation', processing: 'info', default: 'neutral',
  }[statusCfg.antColor] || 'neutral';
  const nextStatuses = VALID_TRANSITIONS[task.Status] || [];
  const categoryKey = task.Category || task.Department;

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
      await tasksApi.transitionStatus(task.Id, toStatus, remarks);
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

  return (
    <>
      <div
        className={`tasks-task-row${selected ? ' selected' : ''}`}
        style={{
          display: 'grid',
          gridTemplateColumns: TASK_LIST_GRID,
          minWidth: TASK_LIST_MIN_WIDTH,
          alignItems: 'center',
          gap: 8,
          padding: '0 16px',
          minHeight: 'var(--tec-row-h, 68px)',
          borderBottom: '1px solid var(--tec-border, #e3e8ef)',
          cursor: 'pointer',
          transition: 'background 0.12s ease',
          position: 'relative'
        }}
        onClick={() => onView(task)}
      >
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
            <Text strong style={{ fontSize: 13, fontWeight: 600, color: 'var(--tec-text, #0f172a)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {task.Title || 'Untitled'}
            </Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1, flexWrap: 'wrap' }}>
            {isRuleTask && (
              <Tooltip title={rulesetId ? `Open ruleset "${rulesetName || 'Automation'}" in new tab` : 'Auto-generated by a ruleset'}>
                <span
                  onClick={handleRulesetClick}
                  className="tasks-automation"
                  role="link"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); handleRulesetClick(e); } }}
                >
                  <ThunderboltOutlined />
                  {rulesetName ? `Rule: ${rulesetName.slice(0,18)}${rulesetName.length>18?'…':''}` : 'Automation'}
                </span>
              </Tooltip>
            )}
            <Text style={{ fontSize: 10, color: 'var(--bc-text-muted, #94a3b8)', fontFamily: 'var(--bc-font-mono, monospace)' }}>{task.InstanceCode}</Text>
            {categoryKey && categoryKey !== 'GENERAL' && (
              <>
                <Text style={{ fontSize: 10, color: 'var(--bc-border-strong, #cbd5e1)' }}>·</Text>
                <Text style={{ fontSize: 10, color: 'var(--bc-text-secondary, #64748b)', fontWeight: 600 }}>{String(categoryKey).toLowerCase()}</Text>
              </>
            )}
            {task.Frequency && task.Frequency !== 'ONCE' && (
              <>
                <Text style={{ fontSize: 10, color: 'var(--bc-border-strong, #cbd5e1)' }}>·</Text>
                <Text style={{ fontSize: 10, color: 'var(--bc-text-muted, #94a3b8)' }}>{String(task.Frequency).toLowerCase().replace(/_/g, ' ')}</Text>
              </>
            )}
            {task.Priority && task.Priority !== 'MEDIUM' && (
              <span className={`tasks-priority tasks-priority--${String(task.Priority).toLowerCase()}`}>
                {task.Priority}
              </span>
            )}
          </div>
        </div>

        <div style={{ minWidth: 0 }}>
          <SellerCell task={task} />
        </div>

        <div style={{ minWidth: 0 }}>
          <DetailsCell task={task} categoryKey={categoryKey} />
        </div>

        <div style={{ minWidth: 0 }}>
          <AssigneeCell task={task} />
        </div>

        <div style={{ minWidth: 0 }}>
          <ProgressCell task={task} categoryKey={categoryKey} pct={pct} />
        </div>

        <div>
          <span className={`tasks-badge tasks-badge--${statusTone}`}>
            {statusCfg.label}
          </span>
        </div>

        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {due ? (
            <div className="tasks-due__value" style={{ color: due.color, display: 'flex', alignItems: 'center', gap: 4 }}>
              <CalendarOutlined style={{ fontSize: 10, flexShrink: 0 }} />
              {due.text}
            </div>
          ) : <span className="tasks-due__value" style={{ color: 'var(--bc-slate-300, #d1d5db)' }}>—</span>}
          {slaLevel && (
            <Tooltip title={`SLA: ${slaLevel.label}`}>
              <div className="tasks-due__sla" style={{ color: slaLevel.color }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: slaLevel.color, flexShrink: 0 }} />
                {slaLevel.label}
              </div>
            </Tooltip>
          )}
        </div>

        <div
          onClick={e => e.stopPropagation()}
          className="tasks-row-actions"
        >
          <div className="tasks-row-actions__reveal">
            {!isRuleTask && nextStatuses.filter(s => s === 'IN_PROGRESS' || s === 'SUBMITTED').map(s => (
              <Tooltip key={s} title={s === 'IN_PROGRESS' ? 'Start this task' : 'Submit for review'}>
                <Button
                  type="text"
                  size="small"
                  aria-label={s === 'IN_PROGRESS' ? 'Start task' : 'Submit for review'}
                  icon={s === 'IN_PROGRESS' ? <PlayCircleOutlined /> : <ArrowRightOutlined />}
                  loading={transitioning === s}
                  onClick={() => handleClick(s)}
                  style={{ width: 26, height: 26, padding: 0, color: s === 'IN_PROGRESS' ? 'var(--tec-primary, #1976d2)' : '#1d4ed8' }}
                />
              </Tooltip>
            ))}
            {!isRuleTask && task.Status === 'IN_PROGRESS' && (
              <Tooltip title="Stop this task">
                <Button
                  type="text"
                  size="small"
                  aria-label="Stop task"
                  icon={<CloseCircleOutlined />}
                  loading={transitioning === 'CANCELLED'}
                  onClick={() => handleTransition('CANCELLED')}
                  style={{ width: 26, height: 26, padding: 0, color: 'var(--bc-red-600, #dc2626)' }}
                />
              </Tooltip>
            )}
          </div>

          <Dropdown
            trigger={['click']}
            placement="bottomRight"
            menu={{
              items: [
                { key: 'view', icon: <EyeOutlined />, label: 'View details', onClick: () => onView(task) },
                ...(!isRuleTask
                  ? nextStatuses.filter(s => s === 'IN_PROGRESS' || s === 'SUBMITTED').map(s => ({
                      key: s,
                      icon: s === 'IN_PROGRESS' ? <PlayCircleOutlined /> : <ArrowRightOutlined />,
                      label: s === 'IN_PROGRESS' ? 'Start task' : 'Submit for review',
                      onClick: () => handleClick(s),
                    }))
                  : []),
                ...(!isRuleTask && task.Status === 'IN_PROGRESS'
                  ? [{ key: 'CANCELLED', icon: <CloseCircleOutlined />, label: 'Stop task', danger: true, onClick: () => handleTransition('CANCELLED') }]
                  : []),
                { type: 'divider' },
                { key: 'assign', icon: <UserOutlined />, label: 'Reassign', onClick: () => onView(task) },
              ],
            }}
          >
            <Button
              type="text"
              size="small"
              aria-label="More task actions"
              icon={<MoreOutlined />}
              style={{ width: 26, height: 26, padding: 0, color: 'var(--tec-text-3, #64748b)' }}
            />
          </Dropdown>
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
