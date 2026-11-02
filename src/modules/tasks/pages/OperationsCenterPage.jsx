import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, Table, Button, Input, Select, Tag, Space, Typography, Progress, Empty, App, Modal, Tooltip, Avatar } from 'antd';
import {
  ReloadOutlined, SearchOutlined, CheckCircleOutlined, RollbackOutlined, ThunderboltOutlined,
  WarningOutlined, AuditOutlined, DownloadOutlined, PaperClipOutlined, InboxOutlined,
  AlertOutlined, CalendarOutlined, UserOutlined, SyncOutlined, PlayCircleOutlined,
  TeamOutlined
} from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import tasksApi from '../services/tasksApi';
import { WORKFLOW_STATUSES, PRIORITIES, DEPARTMENTS } from '../constants';
import { getDueDateLabel } from '../utils/taskHealth';
import { hasPermission, getUserId } from '../utils/rbac';
import { useAuth } from '../../../contexts/AuthContext';
import { ReviewExecutiveKpis, formatMinutes } from '../components/ReviewExecutiveKpis';
import ReviewWorkspace from '../components/ReviewWorkspace';
import { exportTasksToExcel } from '../utils/exportUtils';
import '../tasks.css';

const { Text } = Typography;

const REVIEW_STATUSES = 'SUBMITTED,RESUBMITTED,UNDER_REVIEW,ESCALATED';

const VIEWS = [
  { key: 'ALL', label: 'All', icon: <InboxOutlined /> },
  { key: 'TEAM', label: 'My Team', icon: <TeamOutlined /> },
  { key: 'CRITICAL', label: 'Critical', icon: <AlertOutlined /> },
  { key: 'OVERDUE', label: 'Overdue', icon: <WarningOutlined /> },
  { key: 'DUE_TODAY', label: 'Due today', icon: <CalendarOutlined /> },
  { key: 'RESUBMITTED', label: 'Resubmitted', icon: <SyncOutlined /> },
  { key: 'AUTOMATION', label: 'Automation', icon: <ThunderboltOutlined /> },
  { key: 'SLA_RISK', label: 'SLA At Risk', icon: <AlertOutlined /> },
];

const MANAGER_VIEWS = [
  { key: 'ALL', label: 'All', icon: <InboxOutlined /> },
  { key: 'TEAM', label: 'My Team', icon: <TeamOutlined /> },
  { key: 'CRITICAL', label: 'Critical', icon: <AlertOutlined /> },
  { key: 'OVERDUE', label: 'Overdue', icon: <WarningOutlined /> },
  { key: 'DUE_TODAY', label: 'Due today', icon: <CalendarOutlined /> },
  { key: 'RESUBMITTED', label: 'Resubmitted', icon: <SyncOutlined /> },
  { key: 'AUTOMATION', label: 'Automation', icon: <ThunderboltOutlined /> },
  { key: 'SLA_RISK', label: 'SLA At Risk', icon: <AlertOutlined /> },
];

const SORTS = [
  { value: 'CreatedAt:desc', label: 'Newest first' },
  { value: 'DueDate:asc', label: 'Due soonest' },
  { value: 'Priority:desc', label: 'Highest priority' },
  { value: 'SubmittedAt:asc', label: 'Waiting longest' },
];

function viewParams(view, meId) {
  switch (view) {
    case 'TEAM': return { assignedToTeam: true };
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

export default function OperationsCenterPage() {
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
  const [sort, setSort] = useState('CreatedAt:desc');
  const [selectedIds, setSelectedIds] = useState([]);

  const [counts, setCounts] = useState({});
  const [teamStats, setTeamStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [workspaceTaskId, setWorkspaceTaskId] = useState(searchParams.get('task') || null);

  const [bulk, setBulk] = useState(null);
  const [bulkNote, setBulkNote] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);

  const reqSeq = useRef(0);

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
      if (seq !== reqSeq.current) return;
      setInstances(res.instances || res.data || []);
      setPagination(p => ({ ...p, total: res.pagination?.total ?? (res.instances || []).length }));
    } catch (err) {
      if (seq === reqSeq.current) message.error(err.message || 'Failed to load operations center');
    } finally {
      if (seq === reqSeq.current) setLoading(false);
    }
  }, [baseFilters, view, meId, sort, pagination.page, pagination.limit, search, message]);

  const loadCounts = useCallback(async () => {
    try {
      const entries = await Promise.all(MANAGER_VIEWS.map(async (v) => {
        if (v.key === 'TEAM' && !meId) return [v.key, 0];
        const res = await tasksApi.getInstances({ ...baseFilters, ...viewParams(v.key, meId), page: 1, limit: 1 });
        return [v.key, res.pagination?.total ?? 0];
      }));
      setCounts(Object.fromEntries(entries));
    } catch { /* counts are best-effort */ }
  }, [baseFilters, meId]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await tasksApi.getDashboardSummary();
      if (res.success) setTeamStats(res.data);
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
  }

  const startBulk = (decision) => { setBulkNote(''); setBulk({ decision }); };

  const runBulk = async () => {
    if (!bulk) return;
    if (bulk.decision === 'REJECT' && !bulkNote.trim()) { message.warning('Add feedback so assignees know what to fix'); return; }
    setBulkBusy(true);
    try {
      const res = await tasksApi.bulkTransition({ ids: selectedIds, toStatus: bulk.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED', remarks: bulkNote.trim() });
      const { updatedCount = 0, skippedCount = 0 } = res?.data || {};
      const verb = bulk.decision === 'APPROVE' ? 'approved' : 'sent back';
      if (updatedCount > 0) message.success(`${updatedCount} of ${selectedIds.length} tasks updated`);
      if (skippedCount > 0) message.warning(`${skippedCount} tasks skipped (not in transitionable state)`);
      setSelectedIds([]);
      setBulk(null);
      refreshAll();
    } catch (err) {
      message.error(err.message || 'Bulk review failed');
    } finally { setBulkBusy(false); }
  }

  const handleExport = () => {
    const rows = selectedIds.length ? instances.filter(t => selectedIds.includes(t.Id)) : instances;
    if (!rows.length) { message.info('Nothing to export'); return; }
    exportTasksToExcel(rows);
  }

  // For now returning null as placeholder - this component needs proper render implementation
  return null;
}