import { Spinner } from "@/components/Spinner";
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Table, Button, Input, Select, Tag, Space, Typography, Tooltip, Progress, Modal, Segmented, Checkbox, Empty, App, Spin, Drawer, Row, Col, Collapse, Avatar, Badge, Divider } from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined, EyeOutlined, CheckCircleOutlined,
  ClockCircleOutlined, FileTextOutlined, UploadOutlined, CommentOutlined,
  CheckSquareOutlined, WarningOutlined, EditOutlined, DeleteOutlined,
  ExportOutlined, UserOutlined, SettingOutlined, ThunderboltOutlined,
  SafetyCertificateOutlined, TeamOutlined, RightOutlined, LeftOutlined, TrophyOutlined,
  ArrowRightOutlined, FilterOutlined, DownloadOutlined, BarChartOutlined,
  PlayCircleOutlined, CloseCircleOutlined, CalendarOutlined,
  ExclamationCircleOutlined, MoreOutlined, LockOutlined,
  MinusOutlined, ArrowUpOutlined, ArrowDownOutlined
} from '@ant-design/icons';
import pemsApi from '../services/pemsApi';
import { WORKFLOW_STATUSES, VALID_TRANSITIONS, SLA_STATUSES, FREQUENCIES, PRIORITIES, DEPARTMENTS, CATEGORIES, COMPLEXITY_LEVELS, TARGET_TYPES } from '../constants';
import { calculateHealth, isOverdue, isDueToday, getDueDateLabel, formatNumber } from '../utils/taskHealth';
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '../../../services/db';
import ObjectiveManager from '../../../components/actions/ObjectiveManager';
import { CommandCenterKpis } from '../components/CommandCenterKpis';
import BoardView from '../components/BoardView';
import RightInsightsPanel from '../components/RightInsightsPanel';
import MobileTaskCard from '../components/MobileTaskCard';
import LiveActivityFeed from '../components/LiveActivityFeed';
import PremiumTaskRow from '../components/PremiumTaskRow';
import CalendarView from '../components/CalendarView';
import TaskWorkspace from '../components/TaskWorkspace';
import { exportTasksToExcel } from '../utils/exportUtils';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);
const { Text } = Typography;

/* ─── OKR CONSTANTS ──────────────────────────────────────────── */
const STATUS_META = {
  PENDING: { label: 'Pending', color: '#94a3b8', bg: '#f1f5f9', icon: <ClockCircleOutlined /> },
  IN_PROGRESS: { label: 'In Progress', color: '#1976D2', bg: '#e3f2fd', icon: <PlayCircleOutlined /> },
  REVIEW: { label: 'Review', color: '#ED6C02', bg: '#fff3e0', icon: <EyeOutlined /> },
  COMPLETED: { label: 'Completed', color: '#2E7D32', bg: '#e8f5e9', icon: <CheckCircleOutlined /> },
  REJECTED: { label: 'Rejected', color: '#D32F2F', bg: '#ffebee', icon: <CloseCircleOutlined /> },
};
const PRIORITY_META = {
  LOW: { label: 'Low', color: '#64748b', bg: '#f1f5f9', icon: <ArrowRightOutlined /> },
  MEDIUM: { label: 'Medium', color: '#1976D2', bg: '#e3f2fd', icon: <MinusOutlined /> },
  HIGH: { label: 'High', color: '#ED6C02', bg: '#fff3e0', icon: <ArrowUpOutlined /> },
  CRITICAL: { label: 'Critical', color: '#D32F2F', bg: '#ffebee', icon: <ArrowDownOutlined /> },
};

/* ─── UTILITIES ──────────────────────────────────────────────── */
const getSellerColor = (name) => {
  if (!name) return '#1976D2';
  const palette = ['#1976D2', '#2E7D32', '#9C27B0', '#ED6C02', '#0288D1', '#D32F2F', '#00796B', '#512DA8', '#E64A19', '#1976D2'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash) + name.charCodeAt(i);
  return palette[Math.abs(hash) % palette.length];
};

const getSellerInitial = (name) => {
  if (!name) return '?';
  const parts = name.split('-');
  return (parts[parts.length - 1] || name).charAt(0).toUpperCase();
};

const getUserInitial = (u) =>
  (u?.firstName?.charAt(0) || u?.name?.charAt(0) || 'U').toUpperCase();

const fmtTime = (iso) => {
  if (!iso) return null;
  const d = dayjs(iso);
  const h = dayjs().diff(d, 'hour');
  if (h < 1) return `${dayjs().diff(d, 'minute')}m ago`;
  if (h < 24) return `${h}h ago`;
  if (h < 168) return `${dayjs().diff(d, 'day')}d ago`;
  return d.format('MMM D');
};

const fmtDuration = (start, end) => {
  if (!start) return null;
  const s = dayjs(start), e = end ? dayjs(end) : dayjs();
  const h = e.diff(s, 'hour'), m = e.diff(s, 'minute') % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const fmtExact = (iso) => iso ? dayjs(iso).format('ddd, D MMM YYYY [at] h:mm A') : '';

const getProgressColor = (pct) => {
  if (pct === 0) return '#e2e8f0';
  if (pct <= 25) return '#fb7185';
  if (pct <= 50) return '#fbbf24';
  if (pct <= 75) return '#818cf8';
  if (pct < 100) return '#1976D2';
  return '#2E7D32';
};

const matchesFilter = (a, f) => {
  if (f === 'ALL') return true;
  const s = (a.status || 'PENDING').toUpperCase();
  const now = new Date();
  switch (f) {
    case 'TODO': return s !== 'COMPLETED' && s !== 'REJECTED';
    case 'OVERDUE': { const dl = a.timeTracking?.deadline || a.DueDate; return dl && new Date(dl) < now && s !== 'COMPLETED'; }
    case 'TOMORROW': { const dl = a.timeTracking?.deadline || a.DueDate; if (!dl) return false; const t = new Date(); t.setDate(t.getDate() + 1); t.setHours(0, 0, 0, 0); const da = new Date(t); da.setDate(t.getDate() + 1); const d = new Date(dl); return d >= t && d < da; }
    case 'UPCOMING': { const dl = a.timeTracking?.deadline || a.DueDate; if (!dl) return false; const da = new Date(); da.setDate(da.getDate() + 2); da.setHours(0, 0, 0, 0); return new Date(dl) >= da; }
    case 'PENDING': return s === 'PENDING';
    case 'IN_PROGRESS': return s === 'IN_PROGRESS';
    case 'REVIEW': return s === 'REVIEW';
    case 'REJECTED': return s === 'REJECTED';
    case 'COMPLETED': return s === 'COMPLETED';
    default: return true;
  }
};

const matchesSearch = (a, q) => {
  if (!q) return true;
  const lower = q.toLowerCase();
  return (a.action || a.title || a.name || '').toLowerCase().includes(lower) ||
    (a.description || '').toLowerCase().includes(lower);
};

const buildSellerHierarchy = (objectives, allActions, sellers) => {
  const map = {};
  objectives.forEach(obj => {
    let sid = obj.sellerId || obj.SellerId || obj.brandId;
    let sname = '';
    if (typeof sid === 'object' && sid?._id) { sname = sid.name || ''; sid = sid._id; }
    if (sid && !sname) { const s = sellers.find(x => x._id === sid); if (s) sname = s.name || s.sellerName || ''; }
    if (!sid) { sid = 'unassigned'; sname = 'Unassigned'; }
    if (!map[sid]) map[sid] = { sellerId: sid, sellerName: sname || 'Unknown Brand', objectives: [], directTasks: [] };
    const tasks = [];
    if (obj.keyResults) {
      obj.keyResults.forEach(kr => {
        if (kr.actions) kr.actions.forEach(a => {
          const subs = allActions.filter(x => x.parentTaskId === (a._id || a.id) || x.parentId === (a._id || a.id));
          tasks.push({ ...a, subtasks: subs, krTitle: kr.title, objectiveTitle: obj.title });
        });
      });
    }
    const done = tasks.filter(t => t.status === 'COMPLETED').length;
    map[sid].objectives.push({ ...obj, tasks, progress: tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100) });
  });
  const standalone = allActions.filter(a => !a.GoalId && !a.ObjectiveId && !a.KeyResultId && !a.keyResultId && !a.parentTaskId && !a.parentId);
  standalone.forEach(a => {
    let sid = a.sellerId || a.SellerId;
    let sname = '';
    if (typeof sid === 'object' && sid?._id) { sname = sid.name || ''; sid = sid._id; }
    if (sid && !sname) { const s = sellers.find(x => x._id === sid); if (s) sname = s.name || s.sellerName || ''; }
    if (!sid) { sid = 'unassigned'; sname = 'Unassigned'; }
    if (!map[sid]) map[sid] = { sellerId: sid, sellerName: sname || 'Unknown Brand', objectives: [], directTasks: [] };
    const subs = allActions.filter(x => x.parentTaskId === (a._id || a.id) || x.parentId === (a._id || a.id));
    map[sid].directTasks.push({ ...a, subtasks: subs });
  });
  return Object.values(map).sort((a, b) => a.sellerName.localeCompare(b.sellerName));
};

/* ─── OKR SMALL COMPONENTS ───────────────────────────────────── */
const OkrStatusTag = ({ status, size = 'default' }) => {
  const cfg = STATUS_META[status] || STATUS_META.PENDING;
  return (
    <Tag icon={cfg.icon} style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30`, borderRadius: 20, fontWeight: 600, fontSize: size === 'small' ? 10 : 11, padding: size === 'small' ? '0 6px' : '1px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {cfg.label}
    </Tag>
  );
};

const OkrPriorityTag = ({ priority }) => {
  const cfg = PRIORITY_META[priority] || PRIORITY_META.MEDIUM;
  return (
    <Tag icon={cfg.icon} style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30`, borderRadius: 20, fontWeight: 600, fontSize: 11, padding: '1px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {cfg.label}
    </Tag>
  );
};

const OkrTimelineCell = ({ createdAt, startedAt, completedAt, status }) => {
  const items = [];
  if (createdAt) items.push({ label: 'Created', value: fmtTime(createdAt), exact: fmtExact(createdAt), color: '#94a3b8', icon: <CalendarOutlined style={{ color: '#94a3b8', fontSize: 10 }} /> });
  if (startedAt) items.push({ label: 'Started', value: fmtTime(startedAt), exact: fmtExact(startedAt), color: '#1976D2', icon: <PlayCircleOutlined style={{ color: '#1976D2', fontSize: 10 }} /> });
  if (completedAt) items.push({ label: 'Done', value: fmtTime(completedAt), exact: fmtExact(completedAt), color: '#2E7D32', icon: <CheckCircleOutlined style={{ color: '#2E7D32', fontSize: 10 }} /> });
  const duration = startedAt ? fmtDuration(startedAt, completedAt) : null;
  if (items.length === 0) return <Text style={{ color: '#cbd5e1', fontSize: 'var(--font-size-sm)' }}>—</Text>;
  const content = <Space direction="vertical" size={2}>{items.map((it, i) => <Text key={i} style={{ fontSize: 'var(--font-size-xs)', color: '#64748b' }}>{it.label}: {it.exact}</Text>)}</Space>;
  return (
    <Tooltip title={content}>
      <Space orientation="vertical" size={2}>
        {items.slice(-2).map((it, i) => <Space key={i} size={4}>{it.icon}<Text style={{ fontSize: 10, color: '#94a3b8' }}>{it.label}</Text><Text style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: it.color }}>{it.value}</Text></Space>)}
        {duration && <Tag style={{ marginTop: 2, fontSize: 10, fontFamily: 'monospace', background: status === 'COMPLETED' ? '#ecfdf5' : '#eef2ff', color: status === 'COMPLETED' ? '#2E7D32' : '#1976D2', border: 'none', borderRadius: "var(--radius-sm)", padding: '0 6px' }}>{duration}</Tag>}
      </Space>
    </Tooltip>
  );
};

const OkrProgressCell = ({ pct }) => {
  const color = getProgressColor(pct);
  return (
    <Space orientation="vertical" size={2} style={{ width: 80 }}>
      <Progress percent={pct} size="small" showInfo={false} strokeColor={color} railColor="#f1f5f9" />
      <Text style={{ fontSize: 'var(--font-size-xs)', color: '#64748b', fontVariantNumeric: 'tabular-nums', textAlign: 'center', display: 'block' }}>{pct}%</Text>
    </Space>
  );
};

const QUICK_VIEWS = [
  { key: 'ALL', label: 'All Tasks' },
  { key: 'MY_TASKS', label: 'My Tasks' },
  { key: 'PENDING_REVIEW', label: 'Pending Review' },
  { key: 'OVERDUE', label: 'Overdue' },
  { key: 'CRITICAL', label: 'Critical' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'Operations', label: 'Operations' },
  { key: 'Brand Managers', label: 'Brand Managers' },
  { key: 'Catalog Team', label: 'Catalog Team' },
];

export default function TaskInstancesPage() {
  const { message } = App.useApp();
  const { user: currentUser } = useAuth();
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0 });
  const [summary, setSummary] = useState(null);
  const [quickView, setQuickView] = useState('ALL');
  const [viewMode, setViewMode] = useState('list');
  const [search, setSearch] = useState('');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filters, setFilters] = useState({ department: null, seller: null, manager: null, reviewer: null, priority: null, status: null, health: null, frequency: null });
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Workspace
  const [workspaceTaskId, setWorkspaceTaskId] = useState(null);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);

  // Wizard
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardData, setWizardData] = useState({});
  const [creating, setCreating] = useState(false);

  // Dynamic data
  const [sellers, setSellers] = useState([]);
  const [managers, setManagers] = useState([]);
  const [reviewers, setReviewers] = useState([]);
  const [templates, setTemplates] = useState([]);

  // OKR state
  const [objectives, setObjectives] = useState([]);
  const [allActions, setAllActions] = useState([]);
  const [okrSellers, setOkrSellers] = useState([]);
  const [okrUsers, setOkrUsers] = useState([]);
  const [okrLoading, setOkrLoading] = useState(false);
  const [editingObjective, setEditingObjective] = useState(null);
  const [isObjectiveModalOpen, setIsObjectiveModalOpen] = useState(false);
  const [okrActiveFilter, setOkrActiveFilter] = useState('ALL');
  const [okrSearchQuery, setOkrSearchQuery] = useState('');
  const [okrStatusFilter, setOkrStatusFilter] = useState(null);
  const [okrPriorityFilter, setOkrPriorityFilter] = useState(null);

  useEffect(() => {
    pemsApi.getSellers().then(r => { if (r.success) setSellers(r.data); }).catch(() => {});
    pemsApi.getBrandManagers().then(r => { if (r.success) setManagers(r.data); }).catch(() => {});
    pemsApi.getReviewers().then(r => { if (r.success) setReviewers(r.data); }).catch(() => {});
    pemsApi.getTemplates({ limit: 100, isActive: true }).then(r => { if (r.success) setTemplates(r.templates || []); }).catch(() => {});
  }, []);

  const loadOkrData = useCallback(async () => {
    setOkrLoading(true);
    try {
      const [objRes, actRes, sellRes, userRes] = await Promise.allSettled([
        db.getObjectives(),
        db.getActions(),
        db.getSellers(),
        db.getUsers(),
      ]);
      const objs = objRes.status === 'fulfilled' ? (objRes.value?.data || objRes.value || []) : [];
      const acts = actRes.status === 'fulfilled' ? (actRes.value?.data || actRes.value || []) : [];
      setObjectives(objs);
      setAllActions(acts);
      if (sellRes.status === 'fulfilled') setOkrSellers(Array.isArray(sellRes.value) ? sellRes.value : (sellRes.value?.data || []));
      if (userRes.status === 'fulfilled') setOkrUsers(Array.isArray(userRes.value) ? userRes.value : (userRes.value?.data || []));
    } catch (e) { console.error('OKR load error:', e); }
    finally { setOkrLoading(false); }
  }, []);

  const buildParams = useCallback(() => {
    const p = { page: pagination.page, limit: pagination.limit };
    if (search) p.search = search;
    if (quickView === 'MY_TASKS') p.assignedTo = currentUser?.id;
    else if (quickView === 'PENDING_REVIEW') p.status = 'UNDER_REVIEW';
    else if (quickView === 'CRITICAL') p.priority = 'CRITICAL';
    else if (quickView === 'APPROVED') p.status = 'APPROVED';
    else if (quickView === 'Operations') p.department = 'Operations';
    else if (quickView === 'Brand Managers') p.department = 'Brand Managers';
    else if (quickView === 'Catalog Team') p.department = 'Catalog Team';
    if (filters.department) p.department = filters.department;
    if (filters.seller) p.sellerId = filters.seller;
    if (filters.manager) p.assignedTo = filters.manager;
    if (filters.reviewer) p.reviewerId = filters.reviewer;
    if (filters.priority) p.priority = filters.priority;
    if (filters.status) p.status = filters.status;
    if (filters.frequency) p.frequency = filters.frequency;
    return p;
  }, [quickView, filters, search, pagination.page, pagination.limit, currentUser]);

  const loadInstances = useCallback(async () => {
    setLoading(true);
    try {
      const [instRes, sumRes] = await Promise.all([
        pemsApi.getInstances(buildParams()),
        pemsApi.getDashboardSummary(),
      ]);
      if (instRes.success) {
        let data = instRes.instances || [];
        if (quickView === 'OVERDUE') data = data.filter(t => isOverdue(t));
        if (filters.health === 'critical') data = data.filter(t => calculateHealth(t).score < 50);
        else if (filters.health === 'attention') data = data.filter(t => { const h = calculateHealth(t).score; return h >= 50 && h < 80; });
        else if (filters.health === 'healthy') data = data.filter(t => calculateHealth(t).score >= 80);
        setInstances(data);
        setPagination(instRes.pagination);
      }
      if (sumRes.success) setSummary(sumRes.data);
    } catch { message.error('Failed to load tasks'); }
    finally { setLoading(false); }
  }, [buildParams, quickView, filters]);

  useEffect(() => { loadInstances(); }, [quickView, filters, search, pagination.page]);

  const openWorkspace = (task) => { setWorkspaceTaskId(task.Id); setWorkspaceOpen(true); };

  const openWizard = () => { setWizardStep(0); setWizardData({}); setWizardOpen(true); };
  const handleWizardNext = () => {
    if (wizardStep === 0 && !wizardData.templateId) { message.warning('Select a template'); return; }
    if (wizardStep === 0 && !wizardData.title) { message.warning('Enter a task name'); return; }
    setWizardStep(Math.min(wizardStep + 1, 4));
  };
  const handleCreateTask = async () => {
    setCreating(true);
    try {
      await pemsApi.createInstance({
        templateId: wizardData.templateId, title: wizardData.title,
        sellerId: wizardData.sellerId, sellerName: wizardData.sellerName,
        assignedTo: wizardData.assignedTo, assigneeName: wizardData.assigneeName,
        reviewerId: wizardData.reviewerId, reviewerName: wizardData.reviewerName,
        department: wizardData.department, priority: wizardData.priority,
        target: wizardData.target, dueDate: wizardData.dueDate?.toISOString(),
        frequency: wizardData.frequency,
      });
      message.success('Task created'); setWizardOpen(false); loadInstances();
    } catch { message.error('Failed to create task'); }
    finally { setCreating(false); }
  };

  const toggleSelectAll = () => selectedIds.size === instances.length ? setSelectedIds(new Set()) : setSelectedIds(new Set(instances.map(i => i.Id)));
  const toggleSelect = (id) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const kpi = summary?.kpi || {};

  /* ── OKR SELLER VIEW ── */
  const sellerGroups = useMemo(() => buildSellerHierarchy(objectives, allActions, okrSellers), [objectives, allActions, okrSellers]);

  const renderSellerView = () => {
    if (sellerGroups.length === 0) return <Empty description="No objectives or tasks found. Create an objective to get started." style={{ padding: 60 }} />;

    const visibleGroups = sellerGroups.map(group => {
      const allTasks = [...group.objectives.flatMap(o => o.tasks), ...group.directTasks].filter(t => {
        if (okrStatusFilter && (t.status || '').toUpperCase() !== okrStatusFilter) return false;
        if (okrPriorityFilter && (t.priority || '').toUpperCase() !== okrPriorityFilter) return false;
        if (!matchesFilter(t, okrActiveFilter)) return false;
        if (!matchesSearch(t, okrSearchQuery)) return false;
        return true;
      });
      return { ...group, filteredTasks: allTasks };
    }).filter(g => g.filteredTasks.length > 0);

    const buildCollapseItems = (group) => {
      const items = [];
      group.objectives.forEach((obj, oi) => {
        const objTasks = obj.tasks.filter(t => {
          if (okrStatusFilter && (t.status || '').toUpperCase() !== okrStatusFilter) return false;
          if (okrPriorityFilter && (t.priority || '').toUpperCase() !== okrPriorityFilter) return false;
          if (!matchesFilter(t, okrActiveFilter)) return false;
          if (!matchesSearch(t, okrSearchQuery)) return false;
          return true;
        });
        if (objTasks.length === 0) return;
        const objDone = objTasks.filter(t => t.status === 'COMPLETED').length;
        const objPct = objTasks.length === 0 ? 0 : Math.round((objDone / objTasks.length) * 100);
        const hasReview = objTasks.some(t => t.status === 'REVIEW');
        const childIncomplete = objTasks.some(t => t.status !== 'COMPLETED');
        items.push({
          key: obj._id || `obj-${oi}`,
          label: (
            <Row align="middle" gutter={16} style={{ width: '100%' }}>
              <Col>
                <Tag style={{ fontSize: 10, fontWeight: 600, fontFamily: 'monospace', background: '#eef2ff', color: '#1976D2', border: '1px solid #c7d2fe', borderRadius: "var(--radius-sm)", minWidth: 36, textAlign: 'center' }}>OBJ</Tag>
              </Col>
              <Col flex={1}>
                <Space size={8}>
                  {hasReview && <Tooltip title="Has tasks awaiting review"><Badge dot color="#ED6C02" /></Tooltip>}
                  {childIncomplete && <Tooltip title="Not all tasks complete"><LockOutlined style={{ color: '#fbbf24', fontSize: 'var(--font-size-sm)' }} /></Tooltip>}
                  <Text strong style={{ fontSize: 'var(--font-size-sm)', color: '#1e293b' }}>{obj.title || 'Untitled Objective'}</Text>
                </Space>
              </Col>
              <Col>
                <Space size={12} align="center">
                  <Text style={{ fontSize: 'var(--font-size-xs)', color: '#94a3b8' }}>{objDone}/{objTasks.length} done</Text>
                  <Progress percent={objPct} size="small" style={{ width: 80, margin: 0 }} strokeColor={objPct === 100 ? '#2E7D32' : '#1976D2'} railColor="#f1f5f9" showInfo={false} />
                  <Text style={{ fontSize: 'var(--font-size-xs)', color: '#64748b', fontVariantNumeric: 'tabular-nums', minWidth: 32 }}>{objPct}%</Text>
                </Space>
              </Col>
            </Row>
          ),
          children: (
            <Table
              dataSource={objTasks.map((t, i) => ({ ...t, _tableKey: `${t._id || t.id}-${i}` }))}
              rowKey="_tableKey"
              columns={okrTaskColumns}
              size="small"
              pagination={false}
              showHeader={false}
              style={{ background: 'white' }}
              rowClassName={(_, idx) => idx % 2 === 0 ? 'task-row-even' : 'task-row-odd'}
              expandable={{
                expandedRowRender: (task) => {
                  if (task.subtasks && task.subtasks.length > 0) return (
                    <div style={{ padding: '8px 16px 8px 48px', background: '#f8fafc' }}>
                      {task.subtasks.map((sub, si) => (
                        <Row key={sub._id || sub.id || si} align="middle" gutter={16} style={{ padding: '6px 12px', background: 'white', borderRadius: 6, marginBottom: 4, border: '1px solid #f1f5f9' }}>
                          <Col flex={1}>
                            <Space size={8}>
                              <Tag style={{ fontSize: 10, fontWeight: 600, fontFamily: 'monospace', background: '#f0fdfa', color: '#0d9488', border: '1px solid #99f6e4', borderRadius: "var(--radius-sm)" }}>SUB</Tag>
                              <Text style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>{sub.action || sub.title || sub.name || 'Untitled'}</Text>
                            </Space>
                          </Col>
                          <Col><OkrStatusTag status={(sub.status || 'PENDING').toUpperCase()} size="small" /></Col>
                          <Col><OkrTimelineCell createdAt={sub.createdAt} startedAt={sub.timeTracking?.startedAt} completedAt={sub.timeTracking?.completedAt} status={(sub.status || '').toUpperCase()} /></Col>
                        </Row>
                      ))}
                    </div>
                  );
                  return null;
                },
                rowExpandable: (task) => task.subtasks && task.subtasks.length > 0,
              }}
            />
          ),
          style: { background: '#fafbfc', borderBottom: '1px solid #f1f5f9' },
        });
      });

      if (group.directTasks.length > 0) {
        const filteredDirect = group.directTasks.filter(t => {
          if (okrStatusFilter && (t.status || '').toUpperCase() !== okrStatusFilter) return false;
          if (!matchesFilter(t, okrActiveFilter)) return false;
          if (!matchesSearch(t, okrSearchQuery)) return false;
          return true;
        });
        if (filteredDirect.length > 0) {
          items.push({
            key: 'direct-tasks',
            label: (
              <Space>
                <Tag style={{ fontSize: 10, fontWeight: 600, fontFamily: 'monospace', background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: "var(--radius-sm)" }}>DIRECT</Tag>
                <Text strong style={{ fontSize: 'var(--font-size-sm)', color: '#1e293b' }}>Direct Tasks</Text>
                <Tag style={{ fontSize: 'var(--font-size-xs)', background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: "var(--radius-lg)" }}>{filteredDirect.length} tasks</Tag>
              </Space>
            ),
            children: (
              <Table dataSource={filteredDirect.map((t, i) => ({ ...t, _tableKey: `d-${t._id || t.id}-${i}` }))} rowKey="_tableKey" columns={okrTaskColumns} size="small" pagination={false} showHeader={false} style={{ background: 'white' }} />
            ),
            style: { background: '#fafbfc', borderBottom: '1px solid #f1f5f9' },
          });
        }
      }
      return items;
    };

    if (visibleGroups.length === 0) return <Empty description="No tasks match current filters" style={{ padding: 60 }} />;

    return (
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        {visibleGroups.map(group => {
          const totalTasks = group.filteredTasks.length;
          const doneTasks = group.filteredTasks.filter(t => (t.status || '').toUpperCase() === 'COMPLETED').length;
          const overdueTasks = group.filteredTasks.filter(t => { const dl = t.timeTracking?.deadline || t.DueDate; return dl && new Date(dl) < new Date() && (t.status || '').toUpperCase() !== 'COMPLETED'; }).length;
          const inProgTasks = group.filteredTasks.filter(t => (t.status || '').toUpperCase() === 'IN_PROGRESS').length;
          const reviewTasks = group.filteredTasks.filter(t => (t.status || '').toUpperCase() === 'REVIEW').length;
          const pct = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);
          const sellerColor = getSellerColor(group.sellerName);
          const collapseItems = buildCollapseItems(group);
          if (collapseItems.length === 0) return null;
          return (
            <Card key={group.sellerId} style={{ borderRadius: "var(--radius-lg)", border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }} styles={{ body: { padding: 0 } }}>
              <div style={{ padding: '12px 20px', background: `linear-gradient(135deg, ${sellerColor}10, #ffffff)`, borderBottom: '1px solid #f1f5f9', borderLeft: `4px solid ${sellerColor}` }}>
                <Row align="middle" gutter={16} style={{ width: '100%' }}>
                  <Col><Avatar size={36} style={{ background: sellerColor, fontSize: 15, fontWeight: 600 }}>{getSellerInitial(group.sellerName)}</Avatar></Col>
                  <Col flex={1}>
                    <Space size={8} wrap>
                      <Text strong style={{ fontSize: 'var(--font-size-base)', color: '#1e293b' }}>{group.sellerName}</Text>
                      <Tag style={{ borderRadius: "var(--radius-lg)", fontSize: 'var(--font-size-xs)', background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }}>{group.objectives.length} objective{group.objectives.length !== 1 ? 's' : ''}</Tag>
                      <Tag style={{ borderRadius: "var(--radius-lg)", fontSize: 'var(--font-size-xs)', background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }}>{totalTasks} task{totalTasks !== 1 ? 's' : ''}</Tag>
                      {overdueTasks > 0 && <Tag style={{ borderRadius: "var(--radius-lg)", fontSize: 'var(--font-size-xs)', background: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3' }}><ExclamationCircleOutlined style={{ marginRight: 4 }} />{overdueTasks} overdue</Tag>}
                      {reviewTasks > 0 && <Tag style={{ borderRadius: "var(--radius-lg)", fontSize: 'var(--font-size-xs)', background: '#f5f3ff', color: '#9C27B0', border: '1px solid #ddd6fe' }}><EyeOutlined style={{ marginRight: 4 }} />{reviewTasks} needs review</Tag>}
                    </Space>
                  </Col>
                  <Col>
                    <Space size={16} align="center">
                      <Space size={8}>
                        <Badge color="#2E7D32" text={<Text style={{ fontSize: 'var(--font-size-sm)' }}>{doneTasks}</Text>} />
                        <Badge color="#1976D2" text={<Text style={{ fontSize: 'var(--font-size-sm)' }}>{inProgTasks}</Text>} />
                      </Space>
                      <Progress percent={pct} size="small" style={{ width: 100, margin: 0 }} strokeColor={sellerColor} railColor="#f1f5f9" format={p => <Text style={{ fontSize: 'var(--font-size-xs)', color: '#64748b' }}>{p}%</Text>} />
                    </Space>
                  </Col>
                </Row>
              </div>
              <Collapse ghost items={collapseItems} style={{ background: 'transparent' }} />
            </Card>
          );
        })}
      </Space>
    );
  };

  const okrTaskColumns = [
    {
      key: 'title', width: 320, render: (_, task) => (
        <Space size={8}>
          <Tag style={{ fontSize: 10, fontWeight: 600, fontFamily: 'monospace', background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: "var(--radius-sm)" }}>TASK</Tag>
          <div>
            <Text style={{ fontSize: 'var(--font-size-sm)', color: '#1e293b', fontWeight: 500 }}>{task.action || task.title || task.name || 'Untitled'}</Text>
            {task.description && <Text style={{ fontSize: 'var(--font-size-xs)', color: '#94a3b8', display: 'block', marginTop: 0 }}>{task.description.substring(0, 80)}{(task.description || '').length > 80 ? '...' : ''}</Text>}
            {task.krTitle && <Text style={{ fontSize: 10, color: '#64748b', display: 'block', marginTop: 0 }}>KR: {task.krTitle}</Text>}
          </div>
        </Space>
      ),
    },
    { key: 'priority', width: 100, render: (_, task) => <OkrPriorityTag priority={(task.priority || 'MEDIUM').toUpperCase()} /> },
    { key: 'status', width: 100, render: (_, task) => <OkrStatusTag status={(task.status || 'PENDING').toUpperCase()} /> },
    { key: 'progress', width: 120, render: (_, task) => {
      const timeTracking = task.timeTracking || {};
      const started = timeTracking.startedAt || task.startedAt;
      const completed = timeTracking.completedAt || task.completedAt;
      const status = (task.status || '').toUpperCase();
      const pct = status === 'COMPLETED' ? 100 : status === 'IN_PROGRESS' ? 50 : 0;
      return <OkrProgressCell pct={pct} />;
    }},
    { key: 'timeline', width: 160, render: (_, task) => (
      <OkrTimelineCell createdAt={task.createdAt} startedAt={task.timeTracking?.startedAt} completedAt={task.timeTracking?.completedAt} status={(task.status || '').toUpperCase()} />
    )},
    { key: 'actions', width: 60, align: 'right', render: (_, task) => (
      <Button type="text" icon={<EyeOutlined />} size="small" style={{ color: '#94a3b8' }} />
    )},
  ];

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh' }}>
      {/* ═══ HEADER ═══ */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Text strong style={{ fontSize: 18, color: '#0f172a' }}>Task Execution Center</Text>
          <LiveActivityFeed compact />
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadInstances} loading={loading} size="small" style={{ borderRadius: "var(--radius-md)" }}>Refresh</Button>
          <Button icon={<DownloadOutlined />} size="small" style={{ borderRadius: "var(--radius-md)" }} onClick={() => { exportTasksToExcel(instances); message.success('Exported tasks to Excel'); }}>Export</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openWizard} style={{ borderRadius: "var(--radius-md)", fontWeight: 600, background: '#2563eb', borderColor: '#2563eb' }}>New Task</Button>
        </Space>
      </div>

      <div style={{ padding: '16px 24px' }}>
        {/* ═══ KPI STRIP ═══ */}
        <CommandCenterKpis kpi={kpi} risk={summary?.risk} />

        {/* ═══ QUICK VIEWS + CONTROLS ═══ */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 2, flex: 1 }}>
            {QUICK_VIEWS.map(qv => (
              <div key={qv.key} onClick={() => { setQuickView(qv.key); setPagination(p => ({ ...p, page: 1 })); }}
                style={{ padding: '5px 14px', borderRadius: 20, fontSize: 'var(--font-size-xs)', fontWeight: quickView === qv.key ? 700 : 500,
                  background: quickView === qv.key ? '#2563eb' : '#fff', color: quickView === qv.key ? '#fff' : '#475569',
                  border: `1px solid ${quickView === qv.key ? '#2563eb' : '#e5e7eb'}`,
                  cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s', userSelect: 'none' }}>
                {qv.label}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <Segmented size="small" value={viewMode} onChange={(v) => { setViewMode(v); if (v === 'objectives') loadOkrData(); }} options={[
              { label: 'List', value: 'list' }, { label: 'Board', value: 'board' }, { label: 'Calendar', value: 'calendar' }, { label: 'Objectives', value: 'objectives' },
            ]} />
            <Input prefix={<SearchOutlined style={{ fontSize: 'var(--font-size-sm)' }} />} placeholder="Search tasks, sellers, ASINs..." value={search} onChange={e => setSearch(e.target.value)} onPressEnter={() => loadInstances()} style={{ width: 240, borderRadius: "var(--radius-md)" }} size="small" />
            <Button icon={<FilterOutlined />} onClick={() => setShowFilterPanel(!showFilterPanel)} size="small" type={Object.values(filters).some(v => v) ? 'primary' : 'default'} style={{ borderRadius: "var(--radius-md)" }}>
              Filters {Object.values(filters).filter(v => v).length > 0 && <Badge count={Object.values(filters).filter(v => v).length} size="small" style={{ marginLeft: 4 }} />}
            </Button>
          </div>
        </div>

        {/* ═══ ADVANCED FILTER PANEL ═══ */}
        {showFilterPanel && (
          <Card size="small" style={{ borderRadius: 10, marginBottom: 12 }} styles={{ body: { padding: '12px 16px' } }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              {[
                { key: 'department', label: 'Department', options: DEPARTMENTS.map(d => ({ value: d.value, label: d.label })) },
                { key: 'seller', label: 'Seller', options: sellers.map(s => ({ value: s.Id, label: s.Name })) },
                { key: 'manager', label: 'Manager', options: managers.map(m => ({ value: m.Id, label: m.FullName })) },
                { key: 'reviewer', label: 'Reviewer', options: reviewers.map(r => ({ value: r.Id, label: r.FullName })) },
                { key: 'priority', label: 'Priority', options: Object.entries(PRIORITIES).map(([k, v]) => ({ value: k, label: v.label })) },
                { key: 'status', label: 'Status', options: Object.entries(WORKFLOW_STATUSES).map(([k, v]) => ({ value: k, label: v.label })) },
                { key: 'health', label: 'Health', options: [{ value: 'critical', label: 'Critical' }, { value: 'attention', label: 'Attention' }, { value: 'healthy', label: 'Healthy' }] },
              ].map(f => (
                <div key={f.key}>
                  <Text style={{ fontSize: 9, color: '#94a3b8', display: 'block', marginBottom: 3, fontWeight: 600 }}>{f.label}</Text>
                  <Select allowClear placeholder={f.label} value={filters[f.key]} onChange={v => setFilters(p => ({ ...p, [f.key]: v }))} size="small" style={{ width: 120 }} showSearch optionFilterProp="label" options={f.options} />
                </div>
              ))}
              <Button size="small" onClick={() => { setFilters({ department: null, seller: null, manager: null, reviewer: null, priority: null, status: null, health: null, frequency: null }); }}>Clear</Button>
            </div>
          </Card>
        )}

        {/* ═══ BULK ACTIONS ═══ */}
        {selectedIds.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', background: '#eff6ff', borderRadius: 10, marginBottom: 12, border: '1px solid #bfdbfe' }}>
            <Checkbox checked={selectedIds.size === instances.length} onChange={toggleSelectAll}>
              <Text strong style={{ fontSize: 'var(--font-size-xs)', color: '#1e40af' }}>{selectedIds.size} selected</Text>
            </Checkbox>
            <div style={{ flex: 1 }} />
            <Space size={4}>
              <Button size="small" style={{ borderRadius: 6 }}>Assign</Button>
              <Button size="small" style={{ borderRadius: 6 }} icon={<CheckCircleOutlined />}>Approve</Button>
              <Button size="small" danger style={{ borderRadius: 6 }}>Reject</Button>
              <Button size="small" style={{ borderRadius: 6 }} icon={<DownloadOutlined />}>Export</Button>
            </Space>
            <Button size="small" type="text" onClick={() => setSelectedIds(new Set())} style={{ color: '#D32F2F' }}>Clear</Button>
          </div>
        )}

        {/* ═══ MAIN CONTENT ═══ */}
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {viewMode === 'objectives' ? (
              <div>
                <Card size="small" style={{ borderRadius: 10, marginBottom: 12 }} styles={{ body: { padding: '10px 16px' } }}>
                  <Row align="middle" gutter={16}>
                    <Col flex={1}>
                      <Select allowClear placeholder="Filter status" value={okrStatusFilter} onChange={v => setOkrStatusFilter(v)} size="small" style={{ width: 130 }} options={Object.entries(STATUS_META).map(([k, v]) => ({ value: k, label: v.label }))} />
                      <Select allowClear placeholder="Filter priority" value={okrPriorityFilter} onChange={v => setOkrPriorityFilter(v)} size="small" style={{ width: 130, marginLeft: 8 }} options={Object.entries(PRIORITY_META).map(([k, v]) => ({ value: k, label: v.label }))} />
                      <Select allowClear placeholder="Filter period" value={okrActiveFilter} onChange={v => setOkrActiveFilter(v)} size="small" style={{ width: 130, marginLeft: 8 }} options={[
                        { value: 'ALL', label: 'All' }, { value: 'TODO', label: 'To Do' }, { value: 'OVERDUE', label: 'Overdue' },
                        { value: 'IN_PROGRESS', label: 'In Progress' }, { value: 'REVIEW', label: 'Review' }, { value: 'COMPLETED', label: 'Completed' },
                      ]} />
                    </Col>
                    <Col>
                      <Space>
                        <Input prefix={<SearchOutlined />} placeholder="Search OKR tasks..." value={okrSearchQuery} onChange={e => setOkrSearchQuery(e.target.value)} style={{ width: 220, borderRadius: "var(--radius-md)" }} size="small" />
                        <Button size="small" icon={<ReloadOutlined />} onClick={loadOkrData}>Refresh</Button>
                        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => { setEditingObjective(null); setIsObjectiveModalOpen(true); }} style={{ background: '#2563eb', borderRadius: "var(--radius-md)" }}>New Objective</Button>
                      </Space>
                    </Col>
                  </Row>
                </Card>
                {okrLoading ? <div style={{ textAlign: 'center', padding: 40 }}><Spinner /></div> : renderSellerView()}
              </div>
            ) : viewMode === 'board' ? (
              <BoardView instances={instances} loading={loading} onView={openWorkspace} />
            ) : viewMode === 'calendar' ? (
              <CalendarView instances={instances} loading={loading} onView={openWorkspace} />
            ) : (
              /* LIST VIEW */
              <Card size="small" style={{ borderRadius: 10 }} styles={{ body: { padding: 0 } }}>
                {/* Table Header */}
                <div style={{ display: 'grid', gridTemplateColumns: '36px minmax(0,2fr) 120px 90px 100px 130px 100px', alignItems: 'center', padding: '8px 14px', borderBottom: '2px solid #e5e7eb', background: '#f8fafc' }}>
                  <div><Checkbox checked={selectedIds.size === instances.length && instances.length > 0} onChange={toggleSelectAll} /></div>
                  <Text style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Task</Text>
                  <Text style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Assignee</Text>
                  <Text style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Priority</Text>
                  <Text style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Status</Text>
                  <Text style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Progress</Text>
                  <Text style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>Due</Text>
                </div>

                {/* Mobile cards for small screens */}
                <div style={{ display: 'none' }} className="pems-mobile-only">
                  {loading ? <div style={{ textAlign: 'center', padding: 40 }}><Spinner /></div> :
                    instances.length === 0 ? <Empty description="No tasks found" style={{ padding: 40 }} /> :
                    instances.map(t => <MobileTaskCard key={t.Id} task={t} onView={openWorkspace} />)}
                </div>

                {/* Desktop list */}
                {loading ? (
                  <div style={{ textAlign: 'center', padding: 40 }}><Spinner /></div>
                ) : instances.length === 0 ? (
                  <Empty description={
                    <Space direction="vertical" size={4}>
                      <Text style={{ fontSize: 'var(--font-size-base)', fontWeight: 600 }}>No tasks found</Text>
                      <Text style={{ fontSize: 'var(--font-size-sm)', color: '#94a3b8' }}>{quickView !== 'ALL' ? 'Try a different view' : 'Create your first task to get started'}</Text>
                    </Space>
                  } style={{ padding: 60 }} />
                ) : (
                  <div>
                    {instances.map((task, i) => (
                      <PremiumTaskRow
                        key={task.Id}
                        task={task}
                        index={i}
                        selected={selectedIds.has(task.Id)}
                        onSelect={toggleSelect}
                        onView={openWorkspace}
                        onTransition={(t, s) => setWorkspaceTaskId(t.Id) || setWorkspaceOpen(true)}
                        onReview={(t, d) => setWorkspaceTaskId(t.Id) || setWorkspaceOpen(true)}
                      />
                    ))}
                  </div>
                )}

                {/* Pagination */}
                {instances.length > 0 && (
                  <div style={{ padding: '8px 14px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 'var(--font-size-xs)' }}>{pagination.total} tasks</Text>
                    <Space>
                      <Button size="small" disabled={pagination.page <= 1} onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))} icon={<LeftOutlined />} />
                      <Text style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>Page {pagination.page} of {Math.ceil(pagination.total / pagination.limit) || 1}</Text>
                      <Button size="small" disabled={pagination.page >= Math.ceil(pagination.total / pagination.limit)} onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))} icon={<RightOutlined />} />
                    </Space>
                  </div>
                )}
              </Card>
            )}
          </div>

          {/* ═══ RIGHT INSIGHTS PANEL ═══ */}
          <RightInsightsPanel onTaskClick={openWorkspace} />
        </div>
      </div>

      {/* ═══ OBJECTIVE MANAGER MODAL ═══ */}
      <Modal title={editingObjective ? 'Edit Objective' : 'New Objective'} open={isObjectiveModalOpen} onCancel={() => setIsObjectiveModalOpen(false)} footer={null} width={640} destroyOnClose>
        <ObjectiveManager
          objective={editingObjective}
          onClose={() => setIsObjectiveModalOpen(false)}
          onSaved={() => { setIsObjectiveModalOpen(false); loadOkrData(); }}
        />
      </Modal>

      {/* ═══ ENTERPRISE TASK WORKSPACE ═══ */}
      <TaskWorkspace open={workspaceOpen} onClose={() => setWorkspaceOpen(false)} taskId={workspaceTaskId} onRefresh={loadInstances} />

      {/* ═══ CREATE TASK WIZARD ═══ */}
      <Drawer title="Create Task" open={wizardOpen} onClose={() => setWizardOpen(false)} width={600} destroyOnHidden
        footer={<div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button onClick={() => setWizardStep(Math.max(0, wizardStep - 1))} disabled={wizardStep === 0}>Back</Button>
          <Space>
            {wizardStep < 4 ? <Button type="primary" onClick={handleWizardNext} style={{ background: '#2563eb' }}>Next</Button> :
              <Button type="primary" onClick={handleCreateTask} loading={creating} style={{ background: '#2E7D32' }}>Create</Button>}
          </Space>
        </div>}
      >
        <div style={{ marginBottom: 20 }}>
          {['Basic Info', 'Assignments', 'Performance', 'Timeline', 'Preview'].map((s, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 16, fontSize: 'var(--font-size-xs)', fontWeight: wizardStep === i ? 700 : 400, color: wizardStep === i ? '#2563eb' : '#94a3b8' }}>
              <span style={{ width: 20, height: 20, borderRadius: '50%', background: wizardStep >= i ? '#2563eb' : '#e5e7eb', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600 }}>{i + 1}</span>
              {s}
            </span>
          ))}
        </div>
        {wizardStep === 0 && (
          <Space direction="vertical" size={14} style={{ width: '100%' }}>
            <div><Text style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Template *</Text><Select placeholder="Select template" value={wizardData.templateId} onChange={v => { const t = templates.find(x => x.Id === v); setWizardData(d => ({ ...d, templateId: v, department: t?.Department, priority: t?.Priority, frequency: t?.Frequency, target: t?.DefaultTarget })); }} showSearch optionFilterProp="label" style={{ width: '100%' }} options={templates.map(t => ({ value: t.Id, label: `${t.TaskCode} — ${t.Name}` }))} /></div>
            <div><Text style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Task Name *</Text><Input value={wizardData.title} onChange={e => setWizardData(d => ({ ...d, title: e.target.value }))} placeholder="Enter task name" style={{ borderRadius: "var(--radius-md)" }} /></div>
            <Row gutter={12}><Col span={12}><Text style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Department</Text><Select value={wizardData.department} onChange={v => setWizardData(d => ({ ...d, department: v }))} style={{ width: '100%' }} options={DEPARTMENTS.map(d => ({ value: d.value, label: d.label }))} /></Col><Col span={12}><Text style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Priority</Text><Select value={wizardData.priority} onChange={v => setWizardData(d => ({ ...d, priority: v }))} style={{ width: '100%' }} options={Object.entries(PRIORITIES).map(([k, v]) => ({ value: k, label: v.label }))} /></Col></Row>
          </Space>
        )}
        {wizardStep === 1 && (
          <Space direction="vertical" size={14} style={{ width: '100%' }}>
            <div><Text style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Seller</Text><Select placeholder="Select seller" value={wizardData.sellerId} onChange={v => { const s = sellers.find(x => x.Id === v); setWizardData(d => ({ ...d, sellerId: v, sellerName: s?.Name })); }} showSearch optionFilterProp="label" allowClear style={{ width: '100%' }} options={sellers.map(s => ({ value: s.Id, label: s.Name }))} /></div>
            <div><Text style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Brand Manager</Text><Select placeholder="Select assignee" value={wizardData.assignedTo} onChange={v => { const m = managers.find(x => x.Id === v); setWizardData(d => ({ ...d, assignedTo: v, assigneeName: m?.FullName })); }} showSearch optionFilterProp="label" allowClear style={{ width: '100%' }} options={managers.map(m => ({ value: m.Id, label: m.FullName }))} /></div>
            <div><Text style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Reviewer</Text><Select placeholder="Select reviewer" value={wizardData.reviewerId} onChange={v => { const r = reviewers.find(x => x.Id === v); setWizardData(d => ({ ...d, reviewerId: v, reviewerName: r?.FullName })); }} showSearch optionFilterProp="label" allowClear style={{ width: '100%' }} options={reviewers.map(r => ({ value: r.Id, label: r.FullName }))} /></div>
          </Space>
        )}
        {wizardStep === 2 && (
          <Space direction="vertical" size={14} style={{ width: '100%' }}>
            <div><Text style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Target</Text><Input value={wizardData.target} onChange={e => setWizardData(d => ({ ...d, target: Number(e.target.value) }))} placeholder="Enter numeric target" style={{ borderRadius: "var(--radius-md)" }} /></div>
            <div><Text style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Frequency</Text><Select value={wizardData.frequency} onChange={v => setWizardData(d => ({ ...d, frequency: v }))} style={{ width: '100%' }} options={FREQUENCIES.map(f => ({ value: f.value, label: f.label }))} /></div>
          </Space>
        )}
        {wizardStep === 3 && (
          <Space direction="vertical" size={14} style={{ width: '100%' }}>
            <div><Text style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Due Date</Text><DatePicker value={wizardData.dueDate} onChange={v => setWizardData(d => ({ ...d, dueDate: v }))} style={{ width: '100%' }} /></div>
          </Space>
        )}
        {wizardStep === 4 && (
          <Card size="small" style={{ borderRadius: "var(--radius-md)" }}><Descriptions size="small" column={2} bordered>
            <Descriptions.Item label="Template" span={2}>{templates.find(t => t.Id === wizardData.templateId)?.Name || '-'}</Descriptions.Item>
            <Descriptions.Item label="Name" span={2}>{wizardData.title || '-'}</Descriptions.Item>
            <Descriptions.Item label="Department">{wizardData.department || '-'}</Descriptions.Item>
            <Descriptions.Item label="Seller">{wizardData.sellerName || '-'}</Descriptions.Item>
            <Descriptions.Item label="Brand Manager">{wizardData.assigneeName || '-'}</Descriptions.Item>
            <Descriptions.Item label="Reviewer">{wizardData.reviewerName || '-'}</Descriptions.Item>
            <Descriptions.Item label="Priority">{wizardData.priority || '-'}</Descriptions.Item>
            <Descriptions.Item label="Target">{wizardData.target || 0}</Descriptions.Item>
            <Descriptions.Item label="Due Date">{wizardData.dueDate ? dayjs(wizardData.dueDate).format('DD MMM YYYY') : '-'}</Descriptions.Item>
          </Descriptions></Card>
        )}
      </Drawer>
    </div>
  );
}
