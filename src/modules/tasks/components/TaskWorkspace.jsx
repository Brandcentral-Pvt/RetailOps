import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Drawer, Typography, Space, Tag, Button, Row, Col, Progress, Card, Input, Badge, Spin, Rate, Empty, Tabs, Tooltip, Avatar, Divider, Modal, App, Select, Table } from 'antd';
import {
  CheckCircleOutlined, ClockCircleOutlined, EyeOutlined, ArrowRightOutlined,
  FileTextOutlined, UploadOutlined, CommentOutlined, EditOutlined,
  SendOutlined, ReloadOutlined, AimOutlined, TrophyOutlined, RiseOutlined,
  PlayCircleOutlined, InfoCircleOutlined, UserOutlined,
  CalendarOutlined, SafetyCertificateOutlined, ThunderboltOutlined,
  CheckSquareOutlined, CloseCircleOutlined, MinusOutlined, DollarOutlined,
  WarningOutlined, FlagOutlined, BulbOutlined, ExperimentOutlined,
  LinkOutlined, PlusOutlined, ShopOutlined, ExportOutlined,
  TableOutlined, DatabaseOutlined, ExclamationCircleOutlined
} from '@ant-design/icons';
import tasksApi from '../services/tasksApi';
import BrandChecklist from './BrandChecklist';
import {
  WORKFLOW_STATUSES, VALID_TRANSITIONS, SLA_STATUSES, FREQUENCIES,
  PRIORITIES, TASK_ISSUE_SOURCES, CATEGORY_METRIC_CONFIG, isListingHealthGated
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
  PRICING: { headerBg: 'var(--bc-surface-subtle)', borderColor: 'var(--bc-border-default)', bg: 'var(--bc-surface-subtle)', accent: '#0d9488', label: 'Pricing Dispute' },
  LISTING: { headerBg: 'var(--bc-surface-subtle)', borderColor: 'var(--bc-border-default)', bg: 'var(--bc-surface-subtle)', accent: '#2563eb', label: 'Catalog Audit' },
  INVENTORY: { headerBg: 'var(--bc-surface-subtle)', borderColor: 'var(--bc-border-default)', bg: 'var(--bc-surface-subtle)', accent: '#7c3aed', label: 'Inventory Check' },
  ADS: { headerBg: 'var(--bc-surface-subtle)', borderColor: 'var(--bc-border-default)', bg: 'var(--bc-surface-subtle)', accent: '#ea580c', label: 'Ad Review' },
  COMPLIANCE: { headerBg: 'var(--bc-surface-subtle)', borderColor: 'var(--bc-border-default)', bg: 'var(--bc-surface-subtle)', accent: '#dc2626', label: 'Compliance Check' },
  GENERAL: { headerBg: 'var(--bc-surface-subtle)', borderColor: 'var(--bc-border-default)', bg: 'var(--bc-surface-subtle)', accent: '#64748b', label: 'Task Review' },
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

function AffectedASINsPanel({ taskId, message }) {
  const [asinData, setAsinData] = useState(null);
  const [loadingAsins, setLoadingAsins] = useState(true);
  const [editingRemarks, setEditingRemarks] = useState({}); // key: asinId, value: {remarks, resolution}

  useEffect(() => {
    if (!taskId) return;
    // Defer loading state to avoid sync setState warning
    const timer = setTimeout(() => setLoadingAsins(true), 0);
    tasksApi.getInstanceAsins(taskId)
      .then(res => { if (res.success) setAsinData(res.data); })
      .catch(err => message.error(err.message || 'Failed to load affected ASINs'))
      .finally(() => setLoadingAsins(false));
    return () => clearTimeout(timer);
  }, [taskId, message]);

  const handleSaveRemarks = async (asinId, sellerId, signalCode, remarks, resolution, waiveReason) => {
    try {
      await tasksApi.updateAsinRemarks(taskId, asinId, sellerId, signalCode, remarks, resolution, waiveReason);
      setEditingRemarks(prev => ({ ...prev, [asinId]: { remarks, resolution } }));
      message.success('Remarks updated');
    } catch (err) {
      message.error(err.message);
    }
  };

  const handleResolveAsin = async (asinId, action, waiveReason) => {
    if (action === 'waive' && !waiveReason) {
      message.warning('Waive reason required');
      return;
    }
    try {
      await tasksApi.resolveAsin(taskId, asinId, action, waiveReason);
      // Refresh the data
      const res = await tasksApi.getInstanceAsins(taskId);
      if (res.success) setAsinData(res.data);
      message.success(action === 'resolve' ? 'ASIN marked resolved' : 'ASIN waived');
    } catch (err) {
      message.error(err.message);
    }
  };

const getStatusTag = (status) => {
    switch (status) {
      case 'RESOLVED': return <Tag color="success" size="small">Resolved</Tag>;
      case 'WAIVED': return <Tag color="warning" size="small">Waived</Tag>;
      default: return <Tag color="default" size="small">Open</Tag>;
    }
  };

  if (!asinData) {
    if (loadingAsins) {
      return <Spin size="large" style={{ margin: '24px auto', display: 'block' }} />;
    }
    // Show empty state when no ASINs exist for this task
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 24 }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No affected ASINs for this task"
          imageStyle={{ height: 60 }}
        />
      </div>
    );
  }

  const totalOpen = asinData.sellers?.reduce((sum, s) => sum + (s.counts?.total || 0), 0) || 0;
  const totalCritical = asinData.sellers?.reduce((sum, s) => sum + (s.counts?.critical || 0), 0) || 0;
  const totalMajor = asinData.sellers?.reduce((sum, s) => sum + (s.counts?.major || 0), 0) || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%', overflow: 'auto' }}>
      {/* Summary Cards */}
      <SectionHeader title="Affected ASINs" icon={TableOutlined} count={totalOpen} />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--bc-red-50)', border: '1px solid var(--bc-red-100)', flex: '1 1 120', minWidth: 120 }}>
          <Text style={{ fontSize: 9, color: 'var(--bc-red-700)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block' }}>Critical</Text>
          <Text strong style={{ fontSize: 20, color: 'var(--bc-red-600)', lineHeight: 1.2 }}>{totalCritical}</Text>
        </div>
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--bc-amber-50)', border: '1px solid var(--bc-amber-100)', flex: '1 1 120', minWidth: 120 }}>
          <Text style={{ fontSize: 9, color: 'var(--bc-amber-700)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block' }}>Major</Text>
          <Text strong style={{ fontSize: 20, color: 'var(--bc-amber-600)', lineHeight: 1.2 }}>{totalMajor}</Text>
        </div>
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--bc-blue-50)', border: '1px solid var(--bc-blue-100)', flex: '1 1 120', minWidth: 120 }}>
          <Text style={{ fontSize: 9, color: 'var(--bc-blue-700)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block' }}>Total Open</Text>
          <Text strong style={{ fontSize: 20, color: 'var(--bc-blue-600)', lineHeight: 1.2 }}>{totalOpen}</Text>
        </div>
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--bc-green-50)', border: '1px solid var(--bc-green-100)', flex: '1 1 120', minWidth: 120 }}>
          <Text style={{ fontSize: 9, color: 'var(--bc-green-700)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block' }}>Sellers</Text>
          <Text strong style={{ fontSize: 20, color: 'var(--bc-green-600)', lineHeight: 1.2 }}>{asinData.sellers?.length || 0}</Text>
        </div>
      </div>

      {/* Seller-grouped tables */}
      {asinData.sellers?.length === 0 ? (
        <Empty description="No affected ASINs for this task" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {asinData.sellers.map(seller => (
            <div key={seller.sellerId} style={{ borderRadius: 10, border: '1px solid var(--bc-border-default)', background: 'var(--bc-surface-card)', overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', background: 'var(--bc-surface-subtle)', borderBottom: '1px solid var(--bc-border-default)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <Space size={8}>
                  <Text strong style={{ fontSize: 13, color: 'var(--bc-text-heading)' }}>{seller.sellerName}</Text>
                  <Text code style={{ fontSize: 10, color: 'var(--bc-text-secondary)' }}>{seller.sellerId}</Text>
                  <Badge count={seller.asins?.length || 0} size="small" color="#2563eb" />
                </Space>
                <Space size={6}>
                  {seller.counts?.critical > 0 && <Badge color="error" count={seller.counts.critical} size="small" style={{ fontSize: 10 }} />}
                  {seller.counts?.major > 0 && <Badge color="warning" count={seller.counts.major} size="small" style={{ fontSize: 10 }} />}
                </Space>
              </div>
              <Table
                columns={[
                  {
                    title: 'ASIN',
                    dataIndex: 'asinCode',
                    width: 140,
                    render: (val) => <Text code style={{ fontSize: 'var(--font-size-xs)', color: 'var(--bc-text-heading)' }}>{val}</Text>,
                  },
                  {
                    title: 'Signal',
                    dataIndex: 'signalCode',
                    width: 120,
                    render: (val, record) => (
                      <>
                        <Text code style={{ fontSize: 'var(--font-size-xs)', color: 'var(--bc-text-secondary)' }}>{val}</Text>
                        {record.signalLabel && <Text style={{ fontSize: 'var(--font-size-xs)', color: 'var(--bc-text-muted)', display: 'block', marginTop: 2 }}>{record.signalLabel}</Text>}
                      </>
                    ),
                  },
                  {
                    title: 'Severity',
                    dataIndex: 'severity',
                    width: 80,
                    align: 'center',
                    render: (val) => <Tag size="small" color={val === 'critical' ? 'red' : val === 'major' ? 'orange' : 'blue'}>{val?.charAt(0).toUpperCase() + val?.slice(1)}</Tag>,
                  },
                  {
                    title: 'Value',
                    dataIndex: 'numericValue',
                    width: 100,
                    align: 'right',
                    render: (val, record) => (
                      <>
                        {record.numericValue != null && <Text code style={{ fontSize: 'var(--font-size-xs)', color: 'var(--bc-text-heading)' }}>{typeof record.numericValue === 'number' ? record.numericValue.toLocaleString() : record.numericValue}</Text>}
                        {record.stringValue && <Text style={{ fontSize: 'var(--font-size-xs)', color: 'var(--bc-text-muted)', display: 'block', marginTop: 2 }}>{record.stringValue}</Text>}
                      </>
                    ),
                  },
                  {
                    title: 'Remarks',
                    dataIndex: 'id',
                    width: 200,
                    render: (val, record) => {
                      const editing = editingRemarks[record.id];
                      if (editing) {
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <Input.TextArea
                              rows={2}
                              value={editing.remarks || ''}
                              onChange={e => setEditingRemarks(prev => ({ ...prev, [record.id]: { ...prev[record.id], remarks: e.target.value } }))}
                              placeholder="Remarks..."
                              size="small"
                              style={{ fontSize: 'var(--font-size-xs)' }}
                            />
                            <div style={{ display: 'flex', gap: 4 }}>
                              <Input size="small" placeholder="Resolution" value={editing.resolution || ''} onChange={e => setEditingRemarks(prev => ({ ...prev, [record.id]: { ...prev[record.id], resolution: e.target.value } }))} style={{ flex: 1 }} />
                              <Button size="small" type="primary" onClick={() => handleSaveRemarks(record.asinCode, record.sellerId || seller.sellerId, record.signalCode, editing.remarks, editing.resolution, null)} style={{ fontSize: 'var(--font-size-xs)' }}>Save</Button>
                              <Button size="small" onClick={() => setEditingRemarks(prev => { const n = { ...prev }; delete n[record.id]; return n; })} style={{ fontSize: 'var(--font-size-xs)' }}>Cancel</Button>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {record.remarks && <Text style={{ fontSize: 'var(--font-size-xs)', color: 'var(--bc-text-body)' }}>{record.remarks}</Text>}
                          {record.resolution && <Text style={{ fontSize: 'var(--font-size-xs)', color: 'var(--bc-green-600)' }}>Resolution: {record.resolution}</Text>}
                          {record.waiveReason && <Text style={{ fontSize: 'var(--font-size-xs)', color: 'var(--bc-amber-700)' }}>Waived: {record.waiveReason}</Text>}
                          {!record.remarks && !record.resolution && !record.waiveReason && <Text type="secondary" style={{ fontSize: 'var(--font-size-xs)' }}>No remarks</Text>}
                          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                            <Button size="small" type="text" icon={<EditOutlined />} onClick={() => setEditingRemarks(prev => ({ ...prev, [record.id]: { remarks: record.remarks || '', resolution: record.resolution || '' } }))} style={{ fontSize: 'var(--font-size-xs)' }}>Edit</Button>
                          </div>
                        </div>
                      );
                    },
                  },
                  {
                    title: 'Status',
                    dataIndex: 'status',
                    width: 80,
                    align: 'center',
                    render: (val) => getStatusTag(val),
                  },
                  {
                    title: 'Actions',
                    dataIndex: 'id',
                    width: 140,
                    align: 'center',
                    render: (val, record) => (
                      record.status === 'OPEN' ? (
                        <Space size={2}>
                          <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => handleResolveAsin(record.id, 'resolve')} style={{ fontSize: 'var(--font-size-xs)', padding: '0 6px', height: 24 }}>Resolve</Button>
                          <Button size="small" danger icon={<ExclamationCircleOutlined />} onClick={() => { const reason = window.prompt('Waive reason:'); if (reason) handleResolveAsin(record.id, 'waive', reason); }} style={{ fontSize: 'var(--font-size-xs)', padding: '0 6px', height: 24 }}>Waive</Button>
                        </Space>
                      ) : (
                        <Text style={{ fontSize: 'var(--font-size-xs)', color: 'var(--bc-text-muted)' }}>
                          {record.resolvedAt ? dayjs(record.resolvedAt).format('DD MMM') : ''}
                        </Text>
                      )
                    ),
                  },
                ]}
                dataSource={seller.asins || []}
                rowKey="id"
                bordered
                size="small"
                scroll={{ x: 1000 }}
              />
                </div>
          ))}
        </div>
      )}
    </div>
  );
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

function UotValidatePanel({ verifying, verifyResult, handleVerify, onManualConfirm, handleSubmit, canSubmit, taskStatus, allSubTasksDone, subTaskCount, completedCount, asinResults }) {
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
              {verifyResult.status === 'success' ? <CheckCircleOutlined style={{ color: 'var(--bc-green-600)' }} /> : <WarningOutlined style={{ color: verifyResult.status === 'unavailable' ? 'var(--bc-amber-800)' : 'var(--bc-red-600)' }} />}
              <Text style={{ fontSize: 11, color: verifyResult.status === 'success' ? 'var(--bc-green-600)' : 'var(--bc-red-600)' }}>
                {verifyResult.message || (verifyResult.status === 'success' ? 'Fix verified — changes are live' : 'Fix not confirmed — retry or escalate')}
              </Text>
            </Space>
          </div>
        )}

        {verifyResult?.status === 'unavailable' && (
          <Button size="small" block onClick={onManualConfirm} icon={<CheckCircleOutlined />} style={{ borderRadius: 6 }}>
            I have checked it manually — confirm
          </Button>
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
    <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bc-surface-subtle)', border: '1px solid var(--bc-border-default)' }}>
      <Space size={6} style={{ marginBottom: 6 }}>
        <EyeOutlined style={{ color: 'var(--bc-text-secondary)', fontSize: 13 }} />
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
  const navigate = useNavigate();
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
  const [commentSending, setCommentSending] = useState(false);
  const [evidenceDraft, setEvidenceDraft] = useState({ fileName: '', fileUrl: '', remarks: '', activityId: '' });
  const [evidenceSaving, setEvidenceSaving] = useState(false);

  const handleSendComment = async () => {
    const text = newComment.trim();
    if (!text || commentSending) return;
    setCommentSending(true);
    try {
      await tasksApi.addComment(taskId, text);
      setNewComment('');
      await loadTask({ silent: true });
      message.success('Comment added');
    } catch (err) { message.error(err.message || 'Could not add comment'); }
    finally { setCommentSending(false); }
  };

  const handleAddEvidence = async () => {
    const fileName = evidenceDraft.fileName.trim();
    const fileUrl = evidenceDraft.fileUrl.trim();
    if (!fileName) return message.warning('Give the evidence a name');
    if (!/^https?:\/\//i.test(fileUrl)) return message.warning('Enter a valid link starting with http:// or https://');
    setEvidenceSaving(true);
    try {
      const linkedStep = (task?.subTasks || []).flatMap(st =>
        (st.activities || []).map(act => ({ activityId: act.Id, phaseId: st.Id }))
      ).find(step => step.activityId === evidenceDraft.activityId);
      if (evidenceDraft.activityId && !linkedStep) return message.error('Selected activity no longer belongs to this task. Reload and select it again.');
      await tasksApi.uploadEvidence({
        taskInstanceId: taskId, fileName, fileUrl, fileType: 'LINK',
        remarks: evidenceDraft.remarks.trim(),
        ...(linkedStep ? { activityId: linkedStep.activityId, subTaskId: linkedStep.phaseId } : {}),
      });
      setEvidenceDraft({ fileName: '', fileUrl: '', remarks: '', activityId: '' });
      await loadTask({ silent: true });
      message.success('Evidence added');
    } catch (err) { message.error(err.message || 'Could not add evidence'); }
    finally { setEvidenceSaving(false); }
  };

  const loadTask = useCallback(async (opts = {}) => {
    if (!taskId) return;
    if (!opts.silent) {
      // Defer to avoid sync setState in effect
      setTimeout(() => setLoading(true), 0);
    }
    try {
      const res = await tasksApi.getInstanceById(taskId);
      if (res.success) setTask(res.data);
    } catch (err) { console.error(err); }
    finally { if (!opts.silent) setLoading(false); }
  }, [taskId]);

  // Load task when taskId changes
  useEffect(() => { loadTask(); }, [taskId, loadTask]);

  // Reset per-task working state so nothing leaks from the previously opened task
  useEffect(() => {
    const timer = setTimeout(() => {
      setIssueSource(null); setTicketId(''); setRequestId(''); setActionNotes('');
      setVerifyResult(null); setAsinResults([]); setNewComment('');
      setEvidenceDraft({ fileName: '', fileUrl: '', remarks: '', activityId: '' });
      setTask(null);
      setActiveTab('overview');
    }, 0);
    return () => clearTimeout(timer);
  }, [taskId]);

  // Update active tab when task loads (avoid exhaustive-deps warning)
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
    } catch (err) { message.error(err.message || 'Could not update task status'); return false; }
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
    const openBrands = (task.brands || []).filter(b => !b.IsCompleted).length;
    if (toStatus === 'SUBMITTED' && openBrands > 0) {
      message.warning(`${openBrands} brand${openBrands > 1 ? 's' : ''} not covered yet — tick them on the SOP tab.`);
      return false;
    }
    const isNewListing = task.Category === 'LISTING' && isListingHealthGated(task.InstanceCode);
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
      const res = await tasksApi.verifyFix(taskId);
      setVerifyResult(res);
      setAsinResults((res.asins || []).map(a => ({ asin: a.asin, verified: !!a.verified })));
      loadTask({ silent: true });
    } catch (err) {
      setVerifyResult({ status: 'mismatch', message: err.message || 'Verification failed' });
    } finally { setVerifying(false); }
  };

  const handleManualConfirm = () => {
    setAsinResults([]);
    setVerifyResult({ status: 'success', manual: true, message: 'Manually confirmed — no automatic check was possible' });
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
    try {
      await tasksApi.completeActivity(actId);
      await loadTask();
      onRefresh?.();
    } catch (err) {
      message.error(err.message || 'Could not complete activity');
      if (err.code === 'ACTIVITY_EVIDENCE_REQUIRED') {
        setEvidenceDraft(d => ({ ...d, activityId: actId }));
        setActiveTab('evidence');
      }
    }
  };

  const handleCompleteSubTask = async (stId) => {
    try { await tasksApi.completeSubTask(stId); await loadTask(); onRefresh?.(); }
    catch (err) { message.error(err.message || 'Could not complete phase'); }
  };

  const handleReview = async () => {
    if (!reviewFeedback.trim()) return;
    setReviewSubmitting(true);
    try {
      // The server records the review AND applies the transition atomically.
      await tasksApi.submitReview({ taskInstanceId: taskId, decision: reviewDecision, feedback: reviewFeedback, qualityScore: reviewScore });
      notifyTransition(reviewDecision === 'APPROVE' ? 'APPROVED' : 'REJECTED');
      setReviewDecision(null); setReviewFeedback(''); setReviewScore(null);
      await loadTask();
      if (onRefresh) onRefresh();
    } catch (err) { console.error(err); message.error(err.message || 'Review failed'); }
    finally { setReviewSubmitting(false); }
  };

  if (!task && !loading) return null;

  const health = task ? calculateHealth(task) : { score: 0, label: 'Unknown', color: 'var(--bc-text-muted)', bgColor: 'var(--bc-surface-subtle)' };
  const dueLabel = task ? getDueDateLabel(task) : null;
  const nextStatuses = task ? (VALID_TRANSITIONS[task.Status] || []) : [];
  const subTasks = task?.subTasks || [];
  const totalActivities = subTasks.reduce((s, st) => s + (st.activities?.length || 0), 0);
  const completedActivities = subTasks.reduce((s, st) => s + (st.activities?.filter(a => a.IsCompleted).length || 0), 0);

  const isRuleTask = !!task && (task.Source === 'RULESET' || task.IsRuleTask);
  const rulesetName = task?.SourceRef || task?.RulesetName || '';
  const rulesetId = task?.SourceId || task?.RulesetId || '';
  const taskAsins = task ? parseJsonArray(task.Asins) : [];
  const openRuleset = () => window.open(rulesetId ? `/rule-sets/${rulesetId}` : '/rule-sets', '_blank', 'noopener');
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
          {isRuleTask && (
            <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bc-surface-subtle)', border: '1px solid var(--bc-border-default)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ width: 30, height: 30, borderRadius: 'var(--radius-sm)', background: 'var(--bc-blue-50)', border: '1px solid var(--bc-blue-100)', color: 'var(--bc-blue-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}><ThunderboltOutlined /></div>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <Text strong style={{ fontSize: 13, color: 'var(--bc-text-primary)', display: 'block' }}>Created automatically by an automation rule</Text>
                  <Text style={{ fontSize: 12, color: 'var(--bc-text-secondary)' }}>{rulesetName ? <>Rule: <b>{rulesetName}</b></> : 'Ruleset-generated task'}{task.CreatedAt ? <> · {dayjs(task.CreatedAt).format('DD MMM YYYY, h:mm A')}</> : null}</Text>
                </div>
                <Button size="small" icon={<ExportOutlined />} onClick={openRuleset} style={{ fontWeight: 600 }}>Open rule</Button>
                <Button size="small" type="primary" onClick={() => setActiveTab('resolve')} style={{ fontWeight: 600 }}>Resolve</Button>
              </div>
              {taskAsins.length > 0 && (
                <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Text style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ASINs ({taskAsins.length})</Text>
                  {taskAsins.slice(0, 12).map(a => <Text code key={a} style={{ fontSize: 10, margin: 0 }}>{a}</Text>)}
                  {taskAsins.length > 12 && <Text style={{ fontSize: 11, color: '#64748b' }}>+{taskAsins.length - 12} more</Text>}
                </div>
              )}
            </div>
          )}

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
          <BrandChecklist brands={task.brands || []} canEdit={['IN_PROGRESS', 'REWORK', 'ACCEPTED'].includes(task.Status)}
            hint="Start the task to tick brands."
            onToggle={async (b, completed) => { try { await tasksApi.setBrandCheck(task.Id, b.Id, completed); await loadTask(); onRefresh?.(); } catch (err) { message.error(err.message); } }}
            onToggleAll={async (completed) => { try { await tasksApi.setBrandCheck(task.Id, null, completed); await loadTask(); onRefresh?.(); } catch (err) { message.error(err.message); } }} />
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
                            {Boolean(act.EvidenceRequired) && !act.IsCompleted && (
                              <Button size="small" type="link" style={{ padding: '0 4px' }}
                                onClick={e => { e.stopPropagation(); setEvidenceDraft(d => ({ ...d, activityId: act.Id })); setActiveTab('evidence'); }}>
                                {(task?.evidence || []).some(ev => ev.ActivityId === act.Id) ? 'Evidence attached' : 'Attach required evidence'}
                              </Button>
                            )}
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
      key: 'resolve',
      label: <Space size={4}><SafetyCertificateOutlined style={{ fontSize: 'var(--font-size-sm)' }} /><span>Resolution</span></Space>,
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
                handleVerify={handleVerify} onManualConfirm={handleManualConfirm} handleSubmit={handleSubmitComplete}
                canSubmit={canSubmit} taskStatus={task.Status}
                allSubTasksDone={allSubTasksDone} subTaskCount={subTasks.length} completedCount={completedSubTasks}
                asinResults={asinResults}
              />
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'asins',
      label: <Space size={4}><TableOutlined style={{ fontSize: 'var(--font-size-sm)' }} /><span>Affected ASINs</span></Space>,
      children: task && <AffectedASINsPanel task={task} taskId={taskId} loadTask={loadTask} message={message} />,
    },
    {
      key: 'evidence',
      label: <Space size={4}><FileTextOutlined style={{ fontSize: 'var(--font-size-sm)' }} /><span>Evidence</span>{task?.evidence?.length > 0 && <Badge count={task.evidence.length} size="small" color="#2563eb" />}</Space>,
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ padding: 14, borderRadius: 12, border: '1px dashed var(--bc-border-strong, #cbd5e1)', background: 'var(--bc-surface-subtle)' }}>
            <Text style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--bc-text-secondary)', display: 'block', marginBottom: 8 }}>Attach evidence link</Text>
            <Row gutter={8}>
              <Col xs={24} md={8}><Input size="small" prefix={<FileTextOutlined />} placeholder="Name (e.g. Updated listing screenshot)" value={evidenceDraft.fileName} onChange={e => setEvidenceDraft(d => ({ ...d, fileName: e.target.value }))} /></Col>
              <Col xs={24} md={10}><Input size="small" prefix={<LinkOutlined />} placeholder="https://drive.google.com/…" value={evidenceDraft.fileUrl} onChange={e => setEvidenceDraft(d => ({ ...d, fileUrl: e.target.value }))} /></Col>
              <Col xs={24} md={6}><Button size="small" type="primary" block icon={<PlusOutlined />} loading={evidenceSaving} onClick={handleAddEvidence} style={{ borderRadius: 6 }}>Add</Button></Col>
            </Row>
            <Select
              size="small" showSearch optionFilterProp="label" allowClear
              style={{ width: '100%', marginTop: 8 }}
              placeholder="Apply to a specific activity (required for evidence-gated steps)"
              value={evidenceDraft.activityId || undefined}
              options={(task?.subTasks || []).flatMap((st, phaseIndex) =>
                (st.activities || []).map(act => ({
                  label: `Phase ${phaseIndex + 1}: ${st.Title} / Step ${act.StepNo}: ${act.Title}`,
                  value: act.Id,
                }))
              )}
              onChange={value => setEvidenceDraft(d => ({ ...d, activityId: value || '' }))}
            />
            <Input size="small" style={{ marginTop: 8 }} placeholder="Remarks (optional)" value={evidenceDraft.remarks} onChange={e => setEvidenceDraft(d => ({ ...d, remarks: e.target.value }))} onPressEnter={handleAddEvidence} />
          </div>
          {!task?.evidence?.length ? <Empty description="No evidence attached yet" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : task.evidence.map(ev => (
            <div key={ev.Id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--bc-border-default)', background: 'var(--bc-surface-card)' }}>
              <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--bc-blue-50)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {ev.FileType === 'LINK' ? <LinkOutlined style={{ color: 'var(--bc-blue-600)' }} /> : <FileTextOutlined style={{ color: 'var(--bc-blue-600)' }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {ev.FileUrl ? <a href={ev.FileUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{ev.FileName} <ExportOutlined style={{ fontSize: 10 }} /></a> : <Text strong style={{ fontSize: 'var(--font-size-sm)' }}>{ev.FileName}</Text>}
                <Text style={{ fontSize: 10, color: 'var(--bc-text-muted)', display: 'block' }}>{ev.UploadedByName || 'Unknown'} · {dayjs(ev.UploadedAt).format('DD MMM YYYY [at] h:mm A')}{ev.ActivityId ? ' · Linked to activity' : ' · Task-level evidence'}</Text>
              </div>
              {ev.Remarks && <Text style={{ fontSize: 'var(--font-size-xs)', color: 'var(--bc-text-secondary)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ev.Remarks}>{ev.Remarks}</Text>}
            </div>
          ))}
        </div>
      ),
    },
    {
      key: 'comments',
      label: <Space size={4}><CommentOutlined style={{ fontSize: 'var(--font-size-sm)' }} /><span>Discussion</span>{task?.comments?.length > 0 && <Badge count={task.comments.length} size="small" color="#2563eb" />}</Space>,
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--bc-border-default)', background: 'var(--bc-surface-subtle)' }}>
            <Input.TextArea rows={2} maxLength={2000} value={newComment} onChange={e => setNewComment(e.target.value)}
              onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSendComment(); }}
              placeholder="Write an update for the team…  (Ctrl/⌘ + Enter to send)" style={{ borderRadius: 'var(--radius-md)', background: 'var(--bc-surface-card)' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <Button type="primary" size="small" icon={<SendOutlined />} loading={commentSending} disabled={!newComment.trim()} onClick={handleSendComment} style={{ borderRadius: 6 }}>Post comment</Button>
            </div>
          </div>
          {!task?.comments?.length ? (
            <Empty description="No comments yet — start the discussion" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {task.comments.map(c => (
                <div key={c.Id} style={{ display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--bc-border-default)', background: 'var(--bc-surface-card)' }}>
                  <Avatar size={30} style={{ background: '#6366f1', fontSize: 11, flexShrink: 0 }}>{initials(c.ActorName)}</Avatar>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <Text style={{ fontSize: 12, fontWeight: 700, color: 'var(--bc-text-heading)' }}>{c.ActorName || 'Unknown'}</Text>
                      <Text style={{ fontSize: 10, color: 'var(--bc-text-muted)' }}>{dayjs(c.CreatedAt).fromNow?.() || dayjs(c.CreatedAt).format('DD MMM, h:mm A')}</Text>
                    </div>
                    <Text style={{ fontSize: 12, color: 'var(--bc-text-body)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{c.Details}</Text>
                  </div>
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
            const colors = { CREATED: 'var(--bc-blue-600)', STATUS_CHANGED: 'var(--bc-green-600)', SUBTASK_COMPLETED: 'var(--bc-green-600)', EVIDENCE_UPLOADED: 'var(--bc-violet-600)', COMMENT: '#6366f1', FIX_VERIFIED: 'var(--bc-green-600)', FIX_NOT_VERIFIED: 'var(--bc-red-600)' };
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

  const forwardStatuses = nextStatuses.filter(st => st !== 'APPROVED' && st !== 'REJECTED' && st !== 'CANCELLED');
  const reviewStatuses = nextStatuses.filter(st => st === 'APPROVED' || st === 'REJECTED');
  const primaryStatus = forwardStatuses[0];
  const startTransition = (st) => {
    if (!checkGate(st)) return;
    setTransModal({ toStatus: st, remarks: '' });
  };
  const railLabel = { fontSize: 9, color: 'var(--bc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, display: 'block', marginBottom: 6 };
  const priority = PRIORITIES[task?.Priority] || { bg: 'var(--bc-surface-subtle)', color: 'var(--bc-text-body)', label: task?.Priority };
  const sla = SLA_STATUSES[task?.SLAStatus] || { label: (task?.SLAStatus || 'WITHIN SLA').replace(/_/g, ' '), color: 'var(--bc-text-secondary)', bg: 'var(--bc-surface-subtle)' };

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
      {loading || !task ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><Spin size="large" /></div>
      ) : (
        <div style={{ display: 'flex', height: '100%' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

            {/* ═══ HEADER ═══ */}
            <div style={{ padding: '14px 24px 12px', borderBottom: '1px solid var(--bc-border-default)', background: 'var(--bc-surface-card)', flexShrink: 0, position: 'relative' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: isRuleTask ? 'var(--bc-blue-600)' : (STATUS_COLORS[task.Status] || '#2563eb') }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Button type="text" size="small" onClick={onClose} aria-label="Close" style={{ fontSize: 16, color: 'var(--bc-text-secondary)', marginLeft: -8 }}>✕</Button>
                <Text code style={{ fontSize: 11 }}>{task.InstanceCode}</Text>
                <Tag style={{ fontSize: 10, borderRadius: 4, fontWeight: 700, margin: 0, background: (STATUS_COLORS[task.Status] || '#64748b') + '15', color: STATUS_COLORS[task.Status] || '#64748b', border: `1px solid ${(STATUS_COLORS[task.Status] || '#64748b')}30` }}>{WORKFLOW_STATUSES[task.Status]?.label || task.Status}</Tag>
                <Tag style={{ fontSize: 10, borderRadius: 4, fontWeight: 700, margin: 0, border: 'none', background: priority.bg, color: priority.color }}>{priority.label || task.Priority}</Tag>
                {isRuleTask && (
                  <Tooltip title="Open the originating rule">
                    <Tag onClick={openRuleset} style={{ cursor: 'pointer', fontSize: 10, borderRadius: 4, fontWeight: 700, margin: 0, color: 'var(--bc-blue-700)', background: 'var(--bc-blue-50)', border: '1px solid var(--bc-blue-100)' }}>
                      <ThunderboltOutlined /> {rulesetName ? `Rule: ${rulesetName}` : 'Automation'}
                    </Tag>
                  </Tooltip>
                )}
                {EXCEPTION_STATUSES.has(task.Status) && <Tag color="warning" style={{ margin: 0, borderRadius: 4, fontSize: 10, fontWeight: 700 }}>Needs attention</Tag>}
                <div style={{ flex: 1 }} />
                {task.TemplateCode === 'OOS-RECON-001' && (
                  <Button
                    size="small"
                    icon={<ExportOutlined />}
                    style={{ borderRadius: 8 }}
                    onClick={() => { onClose?.(); navigate('/tasks/oos'); }}
                  >
                    OOS workspace
                  </Button>
                )}
                <Tooltip title="Reload"><Button type="text" size="small" icon={<ReloadOutlined />} onClick={() => loadTask({ silent: true })} /></Tooltip>
                <Space size={6}>
                  {reviewStatuses.includes('REJECTED') && <Button size="small" danger icon={<CloseCircleOutlined />} style={{ borderRadius: 8 }} onClick={() => setReviewDecision('REJECT')}>Reject</Button>}
                  {reviewStatuses.includes('APPROVED') && <Button size="small" type="primary" icon={<CheckCircleOutlined />} style={{ borderRadius: 8, fontWeight: 700, background: 'var(--bc-green-600)', borderColor: 'var(--bc-green-600)' }} onClick={() => setReviewDecision('APPROVE')}>Approve</Button>}
                  {forwardStatuses.filter(st => st !== primaryStatus).map(st => (
                    <Button key={st} size="small" style={{ borderRadius: 8 }} onClick={() => startTransition(st)}>{WORKFLOW_STATUSES[st]?.label}</Button>
                  ))}
                  {primaryStatus && (
                    <Button size="small" type="primary" icon={<ArrowRightOutlined />} onClick={() => startTransition(primaryStatus)}
                      style={{ fontWeight: 600 }}>
                      {primaryStatus === 'SUBMITTED' ? 'Submit for review' : primaryStatus === 'IN_PROGRESS' ? 'Start work' : WORKFLOW_STATUSES[primaryStatus]?.label}
                    </Button>
                  )}
                </Space>
              </div>

              <Text strong style={{ fontSize: 19, letterSpacing: '-0.01em', color: 'var(--bc-text-heading)', display: 'block', marginTop: 8, lineHeight: 1.3 }}>{task.Title || task.TemplateName}</Text>
              {task.Description && <Text style={{ fontSize: 12, color: 'var(--bc-text-secondary)', display: 'block', marginTop: 2, maxWidth: 820 }}>{task.Description}</Text>}

              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
                <Space size={6}><Avatar size={20} style={{ background: task.AssigneeName ? '#2563eb' : '#cbd5e1', fontSize: 9 }}>{initials(task.AssigneeName)}</Avatar><Text style={{ fontSize: 12 }}>{task.AssigneeName || <Text type="secondary">Unassigned</Text>}</Text></Space>
                {task.SellerName && <Space size={4}><ShopOutlined style={{ color: 'var(--bc-text-muted)' }} /><Text style={{ fontSize: 12 }}>{task.SellerName}</Text></Space>}
                {dueLabel && <Space size={4}><CalendarOutlined style={{ color: dueLabel.color }} /><Text style={{ fontSize: 12, fontWeight: 600, color: dueLabel.color }}>{dueLabel.text}</Text></Space>}
                <Tag style={{ margin: 0, borderRadius: 8, fontSize: 10, fontWeight: 700, border: 'none', background: sla.bg, color: sla.color }}>{sla.label}</Tag>
                <Tooltip title={`Health ${health.score}/100`}><Tag style={{ margin: 0, borderRadius: 8, fontSize: 10, fontWeight: 700, border: 'none', background: health.bgColor, color: health.color }}>● {health.label}</Tag></Tooltip>
              </div>

              <WorkflowStepper status={task.Status} />
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '8px 24px 24px' }}>
              <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
            </div>
          </div>

          {/* ═══ RIGHT RAIL ═══ */}
          <div style={{ width: 252, borderLeft: '1px solid var(--bc-border-default)', background: 'var(--bc-surface-subtle)', padding: 16, display: 'flex', flexDirection: 'column', gap: 16, flexShrink: 0, overflow: 'auto' }}>
            <div>
              <Text style={railLabel}>Progress</Text>
              <Progress percent={Math.round(task.WeightedProgressPct || task.ProgressPct || 0)} strokeColor={(task.WeightedProgressPct || task.ProgressPct || 0) >= 80 ? 'var(--bc-green-600)' : 'var(--bc-blue-600)'} />
              <Text style={{ fontSize: 10, color: 'var(--bc-text-secondary)' }}>{completedSubTasks}/{subTasks.length} phases · {completedActivities}/{totalActivities} steps</Text>
            </div>

            <div>
              <Text style={railLabel}>Due</Text>
              {dueLabel ? (
                <div style={{ padding: '6px 10px', borderRadius: 'var(--radius-md)', background: dueLabel.color + '10', border: `1px solid ${dueLabel.color}20` }}>
                  <Text strong style={{ fontSize: 'var(--font-size-sm)', color: dueLabel.color }}>{dueLabel.text}</Text>
                  {task.DueDate && <Text style={{ fontSize: 10, color: 'var(--bc-text-muted)', display: 'block' }}>{dayjs(task.DueDate).format('ddd, DD MMM YYYY')}</Text>}
                </div>
              ) : <Text style={{ fontSize: 'var(--font-size-sm)', color: 'var(--bc-text-muted)' }}>No due date</Text>}
            </div>

            <Divider style={{ margin: 0 }} />

            <div>
              <Text style={railLabel}>People</Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[['Assignee', task.AssigneeName], ['Reviewer', task.ReviewerName]].map(([role, name]) => (
                  <div key={role} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar size={24} style={{ background: name ? '#6366f1' : '#e2e8f0', color: name ? '#fff' : '#94a3b8', fontSize: 10 }}>{initials(name)}</Avatar>
                    <div style={{ minWidth: 0 }}>
                      <Text style={{ fontSize: 12, fontWeight: 600, display: 'block', lineHeight: 1.2 }}>{name || 'Not set'}</Text>
                      <Text style={{ fontSize: 10, color: 'var(--bc-text-muted)' }}>{role}</Text>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Text style={railLabel}>Origin</Text>
              {isRuleTask ? (
                <div onClick={openRuleset} style={{ cursor: 'pointer', padding: '8px 10px', borderRadius: 'var(--radius-md)', background: 'var(--bc-surface-subtle)', border: '1px solid var(--bc-border-default)' }}>
                  <Text style={{ fontSize: 11, fontWeight: 700, color: 'var(--bc-text-primary)', display: 'block' }}><ThunderboltOutlined /> Automation rule</Text>
                  <Text style={{ fontSize: 11, color: 'var(--bc-text-secondary)' }}>{rulesetName || 'Open rulesets'} <ExportOutlined style={{ fontSize: 9 }} /></Text>
                </div>
              ) : (
                <Text style={{ fontSize: 12 }}>{task.TemplateName ? <>Template · <b>{task.TemplateName}</b></> : 'Created manually'}</Text>
              )}
            </div>

            <Divider style={{ margin: 0 }} />

            <div>
              <Text style={railLabel}>Recent activity</Text>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(task.auditLogs || []).slice(0, 6).map(log => (
                  <div key={log.Id}>
                    <Text style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--bc-text-body)' }}>{String(log.Action || '').replace(/_/g, ' ').toLowerCase()}</Text>
                    <Text style={{ fontSize: 10, color: 'var(--bc-text-muted)', display: 'block' }}>{log.ActorName || 'System'} · {dayjs(log.CreatedAt).format('DD MMM, h:mm A')}</Text>
                  </div>
                ))}
                {!(task.auditLogs || []).length && <Text style={{ fontSize: 11, color: 'var(--bc-text-muted)' }}>Nothing yet</Text>}
              </div>
            </div>
          </div>
        </div>
      )}

      <Modal title={transModal.toStatus === 'SUBMITTED' ? 'Submit for Review' : `Move to ${WORKFLOW_STATUSES[transModal.toStatus]?.label || 'next stage'}`} open={!!transModal.toStatus} onCancel={() => setTransModal({ toStatus: null, remarks: '' })}
        onOk={async () => { const ok = await handleTransition(transModal.toStatus, transModal.remarks); if (ok) { setTransModal({ toStatus: null, remarks: '' }); if (onRefresh) onRefresh(); } }}
        okText={transModal.toStatus === 'SUBMITTED' ? 'Submit' : 'Confirm'} okButtonProps={{ disabled: transModal.toStatus === 'SUBMITTED' && !transModal.remarks.trim() }} destroyOnHidden width={480}>
        <div style={{ padding: '4px 0' }}>
          {transModal.toStatus === 'SUBMITTED' && (
          <div style={{ padding: '8px 12px', background: 'var(--bc-amber-50)', border: '1px solid var(--bc-amber-200)', borderRadius: "var(--radius-md)", marginBottom: 12 }}>
            <Text style={{ fontSize: 'var(--font-size-xs)', color: 'var(--bc-amber-800)', fontWeight: 600 }}>Describe what work was done before submitting.</Text>
          </div>
          )}
          <Text style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, display: 'block', marginBottom: 4 }}>{transModal.toStatus === 'SUBMITTED' ? <>Work Summary <Text type="danger">*</Text></> : 'Note (optional)'}</Text>
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
