import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, Table, Button, Input, Tag, Space, Typography, Progress, Empty, App, Select, Modal, Tooltip, Avatar } from 'antd';
import {
  ReloadOutlined, SearchOutlined, CheckCircleOutlined, RollbackOutlined, ThunderboltOutlined,
  WarningOutlined, AuditOutlined, DownloadOutlined, PaperClipOutlined, InboxOutlined,
  AlertOutlined, CalendarOutlined, UserOutlined, SyncOutlined, PlayCircleOutlined,
} from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import tasksApi from '../services/tasksApi';
import { WORKFLOW_STATUSES, PRIORITIES, DEPARTMENTS } from '../constants';
import { getDueDateLabel } from '../utils/taskHealth';
import { hasPermission, getUserId } from '../utils/rbac';
import { useAuth } from '../../../contexts/AuthContext';
import { ReviewExecutiveKpis, formatMinutes } from '../components/ReviewExecutiveKpis';
import ReviewWorkspace from '../components/ReviewWorkspace';
import { exportReviewQueueToExcel } from '../utils/exportUtils';
import '../tasks.css';

const { Text } = Typography;

// Everything a reviewer can pick up: fresh submissions, rework resubmissions,
// tasks already claimed, and tasks escalated for a decision.
const REVIEW_STATUSES = 'SUBMITTED,RESUBMITTED,UNDER_REVIEW,ESCALATED';

const VIEWS = [
  { key: 'ALL', label: 'All', icon: <InboxOutlined /> },
  { key: 'MINE', label: 'Assigned to me', icon: <UserOutlined /> },
  { key: 'CRITICAL', label: 'Critical', icon: <AlertOutlined /> },
  { key: 'OVERDUE', label: 'Overdue', icon: <WarningOutlined /> },
  { key: 'DUE_TODAY', label: 'Due today', icon: <CalendarOutlined /> },
  { key: 'RESUBMITTED', label: 'Resubmitted', icon: <SyncOutlined /> },
  { key: 'AUTOMATION', label: 'Automation', icon: <ThunderboltOutlined /> },
];

const SORTS = [
  { value: 'SubmittedAt:asc', label: 'Waiting longest' },
  { value: 'DueDate:asc', label: 'Due soonest' },
  { value: 'Priority:desc', label: 'Highest priority' },
  { value: 'SubmittedAt:desc', label: 'Newest first' },
];

/** Server-side filter for each quick view — so totals and pages are always right. */
function viewParams(view, meId) {
  switch (view) {
    case 'MINE': return { reviewerId: meId || '__none__' };
    case 'CRITICAL': return { priority: 'CRITICAL' };
    case 'OVERDUE': return { overdue: 'true' };
    case 'DUE_TODAY': return { dueToday: 'true' };
    case 'RESUBMITTED': return { status: 'RESUBMITTED' };
    case 'AUTOMATION': return { source: 'RULESET' };
    default: return {};
  }
}

function waitingMinutes(task) {
  const ref = task.SubmittedAt || task.UpdatedAt || task.CreatedAt;
  if (!ref) return null;
  return Math.max(0, Math.round((Date.now() - new Date(ref).getTime()) / 60000));
}

function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?';
}

export default function ReviewQueuePage() {
  const { message, modal } = App.useApp();
  const { user: currentUser } = useAuth();
  const meId = getUserId(currentUser);
  const canApprove = hasPermission(currentUser, 'review.approve');
  const canReject = hasPermission(currentUser, 'review.reject');
  const [searchParams, setSearchParams] = useSearchParams();

  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0 });
  const [view, setView] = useState('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState(undefined);
  const [sort, setSort] = useState('SubmittedAt:asc');
  const [selectedIds, setSelectedIds] = useState([]);

  const [counts, setCounts] = useState({});
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [workspaceTaskId, setWorkspaceTaskId] = useState(searchParams.get('task') || null);

  // bulk dialog: { decision: 'APPROVE' | 'REJECT' } | null
  const [bulk, setBulk] = useState(null);
  const [bulkNote, setBulkNote] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);

  const reqSeq = useRef(0);

  // debounce search box
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPagination(p => ({ ...p, page: 1 })); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const baseFilters = useMemo(() => {
    const f = { status: REVIEW_STATUSES, includeReviewMeta: 'true' };
    if (department) f.department = department;
    return f;
  }, [department]);

  const loadList = useCallback(async () => {
    const seq = ++reqSeq.current;
    setLoading(true);
    try {
      const [sortBy, sortOrder] = sort.split(':');
      const params = {
        ...baseFilters, ...viewParams(view, meId),
        sortBy, sortOrder, page: pagination.page, limit: pagination.limit,
      };
      if (search) params.search = search;
      const res = await tasksApi.getInstances(params);
      if (seq !== reqSeq.current) return; // a newer request superseded this one
      setInstances(res.instances || res.data || []);
      setPagination(p => ({ ...p, total: res.pagination?.total ?? (res.instances || []).length }));
    } catch (err) {
      if (seq === reqSeq.current) message.error(err.message || 'Failed to load review queue');
    } finally {
      if (seq === reqSeq.current) setLoading(false);
    }
  }, [baseFilters, view, meId, sort, pagination.page, pagination.limit, search, message]);

  // Counts come from the same endpoint/scope as the list (limit=1, read pagination.total)
  const loadCounts = useCallback(async () => {
    try {
      const entries = await Promise.all(VIEWS.map(async (v) => {
        if (v.key === 'MINE' && !meId) return [v.key, 0];
        const res = await tasksApi.getInstances({ ...baseFilters, ...viewParams(v.key, meId), page: 1, limit: 1 });
        return [v.key, res.pagination?.total ?? 0];
      }));
      setCounts(Object.fromEntries(entries));
    } catch { /* counts are best-effort; the list still works */ }
  }, [baseFilters, meId]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await tasksApi.getReviewStats();
      if (res.success) setStats(res.data);
    } catch { /* stats are best-effort */ }
    finally { setStatsLoading(false); }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => { loadCounts(); }, [loadCounts]);
  useEffect(() => { loadStats(); }, [loadStats]);

  const refreshAll = useCallback(() => { loadList(); loadCounts(); loadStats(); }, [loadList, loadCounts, loadStats]);

  const selectView = (key) => { setView(key); setPagination(p => ({ ...p, page: 1 })); };

  const openTask = (id) => {
    setWorkspaceTaskId(id);
    const next = new URLSearchParams(searchParams); next.set('task', id); setSearchParams(next, { replace: true });
  };
  const closeWorkspace = () => {
    setWorkspaceTaskId(null);
    const next = new URLSearchParams(searchParams); next.delete('task'); setSearchParams(next, { replace: true });
  };

  // ── Bulk review ──────────────────────────────────────────────
  const startBulk = (decision) => { setBulkNote(''); setBulk({ decision }); };

  const runBulk = async () => {
    if (!bulk) return;
    if (bulk.decision === 'REJECT' && !bulkNote.trim()) { message.warning('Add feedback so assignees know what to fix'); return; }
    setBulkBusy(true);
    try {
      const res = await tasksApi.bulkReview({ ids: selectedIds, decision: bulk.decision, feedback: bulkNote.trim() });
      const { reviewed = [], skipped = [] } = res.data || {};
      const verb = bulk.decision === 'APPROVE' ? 'approved' : 'sent back';
      if (reviewed.length) message.success(`${reviewed.length} task${reviewed.length > 1 ? 's' : ''} ${verb}`);
      if (skipped.length) {
        const byId = Object.fromEntries(instances.map(t => [t.Id, t]));
        modal.warning({
          title: `${skipped.length} task${skipped.length > 1 ? 's' : ''} skipped`,
          width: 560,
          content: (
            <div style={{ maxHeight: 260, overflow: 'auto', marginTop: 8 }}>
              {skipped.map(s => (
                <div key={s.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--bc-border-subtle, #f1f5f9)' }}>
                  <Text strong style={{ fontSize: 12 }}>{byId[s.id]?.InstanceCode || s.id}</Text>
                  <Text style={{ fontSize: 12, display: 'block', color: 'var(--bc-text-muted, #64748b)' }}>{s.reason}</Text>
                </div>
              ))}
            </div>
          ),
        });
      }
      // keep only the ones that could not be processed selected
      setSelectedIds(skipped.map(s => s.id));
      setBulk(null);
      refreshAll();
    } catch (err) {
      message.error(err.message || 'Bulk review failed');
    } finally { setBulkBusy(false); }
  };

  const handleExport = () => {
    const rows = selectedIds.length ? instances.filter(t => selectedIds.includes(t.Id)) : instances;
    if (!rows.length) { message.info('Nothing to export'); return; }
    exportReviewQueueToExcel(rows);
  };

  // ── Table ────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Task', key: 'task', render: (_, t) => {
        const auto = t.Source === 'RULESET';
        return (
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span className="rv-code">{t.InstanceCode}</span>
              {auto && <span className="rv-pill auto"><ThunderboltOutlined /> Automation</span>}
              {(t.ReworkCount || 0) > 0 && <span className="rv-pill rework"><SyncOutlined /> Rework ×{t.ReworkCount}</span>}
            </div>
            <Text strong style={{ fontSize: 13, display: 'block', color: 'var(--bc-text-heading, #0f172a)' }} ellipsis>{t.Title || t.TemplateName}</Text>
            <Text style={{ fontSize: 11, color: 'var(--bc-text-muted, #94a3b8)' }}>
              {[t.SellerName, t.Department, auto ? t.SourceRef : null].filter(Boolean).join(' · ')}
            </Text>
          </div>
        );
      },
    },
    {
      title: 'Submitted by', key: 'by', width: 170, render: (_, t) => (
        <Space size={8}>
          <Avatar size={24} style={{ background: 'var(--bc-ro-500, #1976D2)', fontSize: 10, fontWeight: 700 }}>{initials(t.AssigneeName)}</Avatar>
          <Text style={{ fontSize: 12 }}>{t.AssigneeName || '—'}</Text>
        </Space>
      ),
    },
    {
      title: 'Waiting', key: 'wait', width: 100, render: (_, t) => {
        const m = waitingMinutes(t);
        const color = m === null ? '#94a3b8' : m >= 2880 ? '#D32F2F' : m >= 1440 ? '#ED6C02' : '#475569';
        return (
          <Tooltip title={t.SubmittedAt ? `Submitted ${new Date(t.SubmittedAt).toLocaleString()}` : 'No submit time'}>
            <Text strong style={{ fontSize: 12, color }}>{formatMinutes(m)}</Text>
          </Tooltip>
        );
      },
    },
    {
      title: 'Priority', dataIndex: 'Priority', key: 'pri', width: 92,
      render: (p) => <Tag style={{ borderRadius: 6, border: 'none', fontWeight: 600, background: PRIORITIES[p]?.bg, color: PRIORITIES[p]?.color }}>{PRIORITIES[p]?.label || p}</Tag>,
    },
    {
      title: 'Due', key: 'due', width: 100, render: (_, t) => {
        const d = getDueDateLabel(t);
        return d ? <Text strong style={{ fontSize: 12, color: d.color }}>{d.text}</Text> : <Text type="secondary">—</Text>;
      },
    },
    {
      title: 'Work', key: 'work', width: 150, render: (_, t) => {
        const total = t.SubTaskTotal || 0; const done = t.SubTaskDone || 0;
        const pct = total ? Math.round((done / total) * 100) : 100;
        return (
          <div>
            <Progress percent={pct} size="small" showInfo={false} status={pct === 100 ? 'success' : 'active'} style={{ margin: 0 }} />
            <div style={{ fontSize: 11, color: 'var(--bc-text-muted, #64748b)', display: 'flex', gap: 10, marginTop: 2 }}>
              <span>{total ? `${done}/${total} steps` : 'No steps'}</span>
              <span style={{ color: (t.EvidenceCount || 0) > 0 ? undefined : '#D32F2F' }}><PaperClipOutlined /> {t.EvidenceCount || 0}</span>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Status', dataIndex: 'Status', key: 'st', width: 120,
      render: (s) => <Tag style={{ borderRadius: 10, border: `1px solid ${WORKFLOW_STATUSES[s]?.color}30`, fontWeight: 600, background: WORKFLOW_STATUSES[s]?.bg, color: WORKFLOW_STATUSES[s]?.color }}>{WORKFLOW_STATUSES[s]?.label || s}</Tag>,
    },
    {
      title: '', key: 'act', width: 110, align: 'right', render: (_, t) => (
        <Button
          type={t.Status === 'UNDER_REVIEW' ? 'default' : 'primary'} size="small"
          icon={t.Status === 'UNDER_REVIEW' ? <AuditOutlined /> : <PlayCircleOutlined />}
          onClick={(e) => { e.stopPropagation(); openTask(t.Id); }}
          style={{ borderRadius: 6, fontWeight: 600 }}
        >
          {t.Status === 'UNDER_REVIEW' ? 'Continue' : 'Review'}
        </Button>
      ),
    },
  ];

  const activeFilterCount = (department ? 1 : 0) + (search ? 1 : 0);

  return (
    <div className="tasks-page">
      {/* ═══ HEADER ═══ */}
      <div className="tasks-sticky-header">
        <div className="tasks-page-inner" style={{ paddingTop: 12, paddingBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <span className="tasks-brand-tile"><AuditOutlined /></span>
            <div style={{ minWidth: 0 }}>
              <Text strong style={{ fontSize: 17, lineHeight: 1.2, display: 'block', color: 'var(--bc-text-heading, #0f172a)' }}>Review Queue</Text>
              <Text style={{ fontSize: 11, color: 'var(--bc-text-muted, #94a3b8)' }}>
                {counts.ALL !== undefined ? `${counts.ALL} awaiting a decision` : 'Quality gate · SLA · Automation'}
              </Text>
            </div>
          </div>
          <Space size={8} wrap>
            <Button icon={<ReloadOutlined />} onClick={refreshAll} loading={loading} size="small" style={{ borderRadius: 'var(--bc-radius-md, 6px)' }}>Refresh</Button>
            <Button icon={<DownloadOutlined />} onClick={handleExport} size="small" style={{ borderRadius: 'var(--bc-radius-md, 6px)' }}>
              {selectedIds.length ? `Export ${selectedIds.length} selected` : 'Export'}
            </Button>
            <Button
              type="primary" size="small" icon={<PlayCircleOutlined />}
              disabled={!instances.length}
              onClick={() => instances[0] && openTask(instances[0].Id)}
              style={{ borderRadius: 'var(--bc-radius-md, 6px)', fontWeight: 600, background: 'var(--bc-ro-500, #1976D2)', borderColor: 'var(--bc-ro-500, #1976D2)', boxShadow: '0 2px 8px rgba(25,118,210,.3)' }}
            >
              Start reviewing
            </Button>
          </Space>
        </div>
      </div>

      <div className="tasks-page-inner">
        {/* ═══ KPI STRIP ═══ */}
        <ReviewExecutiveKpis counts={counts} stats={stats} loading={statsLoading} activeView={view} onSelectView={selectView} />

        {/* ═══ TOOLBAR ═══ */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', margin: '16px 0 12px' }}>
          <div className="tasks-quick-pills" role="tablist" aria-label="Review views">
            {VIEWS.map(v => (
              <div
                key={v.key} data-key={v.key === 'AUTOMATION' ? 'AUTOMATION' : undefined} role="tab" tabIndex={0}
                aria-selected={view === v.key}
                className={`tasks-quick-pill${view === v.key ? ' active' : ''}`}
                onClick={() => selectView(v.key)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectView(v.key); } }}
              >
                <span className="tasks-quick-pill-icon">{v.icon}</span>
                <span className="tasks-quick-pill-label">{v.label}</span>
                <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.75 }}>{counts[v.key] ?? ''}</span>
              </div>
            ))}
          </div>
          <Space size={8} wrap>
            <Input
              allowClear size="small" prefix={<SearchOutlined />} placeholder="Search code, title, seller…"
              value={searchInput} onChange={(e) => setSearchInput(e.target.value)} style={{ width: 240, borderRadius: 6 }}
            />
            <Select
              allowClear size="small" placeholder="Department" value={department} style={{ width: 150 }}
              options={DEPARTMENTS} onChange={(v) => { setDepartment(v); setPagination(p => ({ ...p, page: 1 })); }}
            />
            <Select
              size="small" value={sort} style={{ width: 160 }} options={SORTS}
              onChange={(v) => { setSort(v); setPagination(p => ({ ...p, page: 1 })); }}
            />
          </Space>
        </div>
        {activeFilterCount > 0 && (
          <div style={{ marginBottom: 8 }}>
            <Button type="link" size="small" onClick={() => { setDepartment(undefined); setSearchInput(''); }}>Clear filters</Button>
          </div>
        )}

        {/* ═══ TABLE ═══ */}
        <Card className="tasks-list-card" styles={{ body: { padding: 0 } }}>
          <Table
            className="rv-table"
            rowKey="Id" size="middle" loading={loading} columns={columns} dataSource={instances}
            rowSelection={{
              selectedRowKeys: selectedIds,
              preserveSelectedRowKeys: true,
              onChange: (keys) => setSelectedIds(keys),
            }}
            onRow={(t) => ({ onClick: () => openTask(t.Id) })}
            pagination={{
              current: pagination.page, pageSize: pagination.limit, total: pagination.total,
              showSizeChanger: true, pageSizeOptions: [10, 25, 50, 100], size: 'small',
              showTotal: (total, range) => `${range[0]}–${range[1]} of ${total}`,
              onChange: (page, limit) => setPagination(p => ({ ...p, page, limit })),
            }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={view === 'ALL' && !search && !department ? 'Inbox zero — nothing is waiting for review 🎉' : 'No tasks match this view'}
                />
              ),
            }}
          />
        </Card>

        {/* ═══ BULK BAR ═══ */}
        {selectedIds.length > 0 && (
          <div className="rv-bulkbar">
            <Text style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>{selectedIds.length} selected</Text>
            <Button size="small" type="primary" icon={<CheckCircleOutlined />} disabled={!canApprove} onClick={() => startBulk('APPROVE')}
              style={{ borderRadius: 999, background: '#2E7D32', borderColor: '#2E7D32', fontWeight: 600 }}>Approve</Button>
            <Button size="small" danger icon={<RollbackOutlined />} disabled={!canReject} onClick={() => startBulk('REJECT')}
              style={{ borderRadius: 999, fontWeight: 600 }}>Send back</Button>
            <Button size="small" type="text" onClick={() => setSelectedIds([])} style={{ color: '#cbd5e1' }}>Clear</Button>
          </div>
        )}
      </div>

      {/* ═══ BULK DIALOG ═══ */}
      <Modal
        open={!!bulk} onCancel={() => !bulkBusy && setBulk(null)} onOk={runBulk} confirmLoading={bulkBusy}
        okText={bulk?.decision === 'APPROVE' ? `Approve ${selectedIds.length}` : `Send back ${selectedIds.length}`}
        okButtonProps={bulk?.decision === 'REJECT' ? { danger: true } : { style: { background: '#2E7D32', borderColor: '#2E7D32' } }}
        title={bulk?.decision === 'APPROVE' ? 'Approve selected tasks' : 'Send selected tasks back for rework'}
        destroyOnHidden
      >
        <Text style={{ fontSize: 13, color: 'var(--bc-text-body, #475569)' }}>
          {bulk?.decision === 'APPROVE'
            ? 'Each task is approved individually. Tasks you cannot review (your own, already decided, or not awaiting review) are skipped and reported.'
            : 'Each assignee receives this feedback and the task moves to Rejected so they can start rework.'}
        </Text>
        <Input.TextArea
          rows={4} maxLength={4000} showCount style={{ marginTop: 12 }}
          status={bulk?.decision === 'REJECT' && !bulkNote.trim() ? 'error' : undefined}
          placeholder={bulk?.decision === 'APPROVE' ? 'Optional note recorded on every review…' : 'What needs to be fixed? (required)'}
          value={bulkNote} onChange={(e) => setBulkNote(e.target.value)}
        />
      </Modal>

      {/* ═══ WORKSPACE ═══ */}
      <ReviewWorkspace
        open={!!workspaceTaskId}
        taskId={workspaceTaskId}
        queueIds={instances.map(t => t.Id)}
        onNavigate={openTask}
        onClose={closeWorkspace}
        onRefresh={refreshAll}
      />
    </div>
  );
}
