/* ═══════════════════════════════════════════════════════════════════════════
   Task Execution Center — v2 (UI/UX redesign)
   Expected location: src/modules/tasks/pages/TaskInstancesPage.jsx

   What changed vs v1 (see CHANGES.md for full notes):
   • Sticky, blurred command header with brand tile, subtitle, kbd hint (Alt+N)
   • Redesigned KPI strip (CommandCenterKpis v2) with responsive grid
   • Quick-view pills with icons, filter chips + filter Drawer (adds Frequency filter)
   • Redesigned task list container (hover/selection rows, skeleton loading,
     page-size selector, nicer empty states)
   • Floating bulk-action bar with working Approve / Reject / Export
   • Create-task wizard rebuilt with antd Steps + inline validation
   • Right Insights panel becomes sticky; collapses to a drawer < 1360px
   • Full design-token adoption (--bc-*), responsive at 1700/1360/1200/768px

   v2.1:
   • Removed Board & Calendar views (List / Seller / Objectives remain)
   • Fixed quick-view pill styling (uniform height, gradient active state,
     keyboard access)

   All data flow / API logic is preserved from v1.
   ═══════════════════════════════════════════════════════════════════════════ */
import { Spinner } from "@/components/Spinner";
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card, Table, Button, Input, Select, Tag, Space, Typography, Tooltip, Progress,
  Modal, Segmented, Checkbox, Empty, App, Drawer, Row, Col, Collapse, Avatar,
  Badge, Steps, Skeleton, DatePicker, InputNumber, Alert
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined, EyeOutlined, CheckCircleOutlined,
  ClockCircleOutlined, CloseCircleOutlined, CalendarOutlined,
  ExclamationCircleOutlined, LockOutlined, LeftOutlined, RightOutlined,
  PlayCircleOutlined, ArrowRightOutlined, MinusOutlined, ArrowUpOutlined,
  ArrowDownOutlined, UnorderedListOutlined, AppstoreOutlined, ShopOutlined,
  FlagOutlined, FilterOutlined, ClearOutlined, CloseOutlined, ThunderboltOutlined,
  InfoCircleOutlined, TeamOutlined, LineChartOutlined, FileTextOutlined,
  DownloadOutlined, UserOutlined, RocketOutlined
} from '@ant-design/icons';
import tasksApi from '../services/tasksApi';
import { useSearchParams } from 'react-router-dom';
import { WORKFLOW_STATUSES, FREQUENCIES, PRIORITIES, DEPARTMENTS, TASK_LIST_GRID } from '../constants';
import { calculateHealth, isOverdue, isDueTomorrow } from '../utils/taskHealth';
import '../tasks.css';
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '../../../services/db';
import ObjectiveManager from '../../../components/actions/ObjectiveManager';
import { CommandCenterKpis } from '../components/CommandCenterKpis';
import RightInsightsPanel from '../components/RightInsightsPanel';
import MobileTaskCard from '../components/MobileTaskCard';
import LiveActivityFeed from '../components/LiveActivityFeed';
import PremiumTaskRow from '../components/PremiumTaskRow';
import TaskWorkspace from '../components/TaskWorkspace';
import { exportTasksToExcel } from '../utils/exportUtils';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Text } = Typography;

/* ─── OKR CONSTANTS ──────────────────────────────────────────── */
const STATUS_META = {
  PENDING: { label: 'Pending', color: 'var(--bc-slate-500, #64748b)', bg: 'var(--bc-slate-100, #f1f5f9)', icon: <ClockCircleOutlined /> },
  IN_PROGRESS: { label: 'In Progress', color: 'var(--bc-ro-500, #1976D2)', bg: 'var(--bc-ro-50, #E3F2FD)', icon: <PlayCircleOutlined /> },
  REVIEW: { label: 'Review', color: '#ED6C02', bg: '#fff3e0', icon: <EyeOutlined /> },
  COMPLETED: { label: 'Completed', color: 'var(--bc-green-600, #16a34a)', bg: 'var(--bc-green-50, #f0fdf4)', icon: <CheckCircleOutlined /> },
  REJECTED: { label: 'Rejected', color: 'var(--bc-red-600, #dc2626)', bg: 'var(--bc-red-50, #fef2f2)', icon: <CloseCircleOutlined /> },
};

const PRIORITY_META = {
  LOW: { label: 'Low', color: 'var(--bc-slate-500, #64748b)', bg: 'var(--bc-slate-100, #f1f5f9)', icon: <ArrowRightOutlined /> },
  MEDIUM: { label: 'Medium', color: 'var(--bc-ro-500, #1976D2)', bg: 'var(--bc-ro-50, #E3F2FD)', icon: <MinusOutlined /> },
  HIGH: { label: 'High', color: '#ED6C02', bg: '#fff3e0', icon: <ArrowUpOutlined /> },
  CRITICAL: { label: 'Critical', color: 'var(--bc-red-600, #dc2626)', bg: 'var(--bc-red-50, #fef2f2)', icon: <ArrowDownOutlined /> },
};

/* ─── UTILITIES ──────────────────────────────────────────────── */
const getSellerColor = (name) => {
  if (!name) return 'var(--bc-ro-500, #1976D2)';
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
  if (pct === 0) return 'var(--bc-slate-200, #e2e8f0)';
  if (pct <= 25) return '#fb7185';
  if (pct <= 50) return '#fbbf24';
  if (pct <= 75) return '#818cf8';
  if (pct < 100) return 'var(--bc-ro-500, #1976D2)';
  return 'var(--bc-green-600, #16a34a)';
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
  if (createdAt) items.push({ label: 'Created', value: fmtTime(createdAt), exact: fmtExact(createdAt), color: 'var(--bc-text-muted, #94a3b8)', icon: <CalendarOutlined style={{ color: 'var(--bc-text-muted, #94a3b8)', fontSize: 10 }} /> });
  if (startedAt) items.push({ label: 'Started', value: fmtTime(startedAt), exact: fmtExact(startedAt), color: 'var(--bc-ro-500, #1976D2)', icon: <PlayCircleOutlined style={{ color: 'var(--bc-ro-500, #1976D2)', fontSize: 10 }} /> });
  if (completedAt) items.push({ label: 'Done', value: fmtTime(completedAt), exact: fmtExact(completedAt), color: 'var(--bc-green-600, #16a34a)', icon: <CheckCircleOutlined style={{ color: 'var(--bc-green-600, #16a34a)', fontSize: 10 }} /> });
  const duration = startedAt ? fmtDuration(startedAt, completedAt) : null;
  if (items.length === 0) return <Text style={{ color: 'var(--bc-text-disabled, #cbd5e1)', fontSize: 'var(--bc-text-sm, 13px)' }}>—</Text>;
  const content = <Space direction="vertical" size={2}>{items.map((it, i) => <Text key={i} style={{ fontSize: 'var(--bc-text-xs, 11px)', color: 'var(--bc-text-secondary, #64748b)' }}>{it.label}: {it.exact}</Text>)}</Space>;
  return (
    <Tooltip title={content}>
      <Space direction="vertical" size={2}>
        {items.slice(-2).map((it, i) => <Space key={i} size={4}>{it.icon}<Text style={{ fontSize: 10, color: 'var(--bc-text-muted, #94a3b8)' }}>{it.label}</Text><Text style={{ fontSize: 'var(--bc-text-xs, 11px)', fontWeight: 600, color: it.color }}>{it.value}</Text></Space>)}
        {duration && <Tag style={{ marginTop: 2, fontSize: 10, fontFamily: 'var(--bc-font-mono, monospace)', background: status === 'COMPLETED' ? 'var(--bc-green-50, #f0fdf4)' : 'var(--bc-ro-50, #E3F2FD)', color: status === 'COMPLETED' ? 'var(--bc-green-600, #16a34a)' : 'var(--bc-ro-500, #1976D2)', border: 'none', borderRadius: 'var(--bc-radius-sm, 4px)', padding: '0 6px' }}>{duration}</Tag>}
      </Space>
    </Tooltip>
  );
};

const OkrProgressCell = ({ pct }) => {
  const color = getProgressColor(pct);
  return (
    <Space direction="vertical" size={2} style={{ width: 80 }}>
      <Progress percent={pct} size="small" showInfo={false} strokeColor={color} railColor="var(--bc-slate-100, #f1f5f9)" />
      <Text style={{ fontSize: 'var(--bc-text-xs, 11px)', color: 'var(--bc-text-secondary, #64748b)', fontVariantNumeric: 'tabular-nums', textAlign: 'center', display: 'block' }}>{pct}%</Text>
    </Space>
  );
};

const QUICK_VIEWS = [
  { key: 'ALL', label: 'All', icon: <AppstoreOutlined /> },
  { key: 'TODO', label: 'To Do', icon: <UnorderedListOutlined /> },
  { key: 'IN_PROGRESS', label: 'In Progress', icon: <PlayCircleOutlined /> },
  { key: 'PENDING_REVIEW', label: 'Pending Review', icon: <EyeOutlined /> },
  { key: 'OVERDUE', label: 'Overdue', icon: <ClockCircleOutlined /> },
  { key: 'AUTOMATION', label: '🤖 Automation', icon: <ThunderboltOutlined /> },
  { key: 'TOMORROW', label: 'Tomorrow', icon: <CalendarOutlined /> },
  { key: 'UPCOMING', label: 'Upcoming', icon: <CalendarOutlined /> },
  { key: 'COMPLETED', label: 'Completed', icon: <CheckCircleOutlined /> },
];

const VIEW_OPTIONS = [
  { label: (<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><UnorderedListOutlined />List</span>), value: 'list' },
  { label: (<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><ShopOutlined />Seller</span>), value: 'seller' },
  { label: (<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><FlagOutlined />Objectives</span>), value: 'objectives' },
];

/* Small presentational helpers for the new UI */
const fieldLabel = { fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 5, color: 'var(--bc-text-heading, #0f172a)' };
const fieldError = { fontSize: 11, color: 'var(--bc-red-600, #dc2626)', marginTop: 4, display: 'block' };

const ReviewRow = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '10px 0', borderBottom: '1px solid var(--bc-border-subtle, #f1f5f9)' }}>
    <Text style={{ fontSize: 12, color: 'var(--bc-text-secondary, #64748b)' }}>{label}</Text>
    <Text strong style={{ fontSize: 12, color: 'var(--bc-text-heading, #0f172a)', textAlign: 'right' }}>{value || '—'}</Text>
  </div>
);

const ListSkeleton = () => (
  <div>
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="tasks-skeleton-row">
        <Skeleton.Input active size="small" style={{ width: 16 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Skeleton active title={false} paragraph={{ rows: 1, width: '55%' }} />
        </div>
        <Skeleton.Input active size="small" style={{ width: 120 }} />
        <Skeleton.Input active size="small" style={{ width: 64 }} />
        <Skeleton.Input active size="small" style={{ width: 84 }} />
      </div>
    ))}
  </div>
);

export default function TaskInstancesPage() {
  const { message, modal } = App.useApp();
  const { user: currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0 });
  const [summary, setSummary] = useState(null);
  const [aggregates, setAggregates] = useState(null);
  const [quickView, setQuickView] = useState('ALL');
  const [viewMode, setViewMode] = useState('list');
  const [search, setSearch] = useState('');
  const [disputesOnly, setDisputesOnly] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filters, setFilters] = useState({ department: null, seller: null, manager: null, reviewer: null, priority: null, status: null, health: null, frequency: null, source: null });
  const [automationStats, setAutomationStats] = useState({ total: 0, open: 0, overdue: 0, byRuleset: [] });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [lastSync, setLastSync] = useState(null);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);

  // Workspace
  const [workspaceTaskId, setWorkspaceTaskId] = useState(null);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);

  // Wizard
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardData, setWizardData] = useState({});
  const [wizardErrors, setWizardErrors] = useState({});
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
    tasksApi.getSellers().then(r => { if (r.success) setSellers(r.data); }).catch(() => { });
    tasksApi.getBrandManagers().then(r => { if (r.success) setManagers(r.data); }).catch(() => { });
    tasksApi.getReviewers().then(r => { if (r.success) setReviewers(r.data); }).catch(() => { });
    tasksApi.getTemplates({ limit: 100, isActive: true }).then(r => { if (r.success) setTemplates(r.templates || []); }).catch(() => { });
    tasksApi.getAutomationStats().then(setAutomationStats).catch(() => { });
  }, []);

  /* Sticky-header elevation on scroll */
  useEffect(() => {
    const onScroll = () => setHeaderScrolled(window.scrollY > 4);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* Keyboard shortcut: Alt+N opens the create-task wizard */
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (e.altKey && !typing && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        openWizard();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
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
    else if (quickView === 'IN_PROGRESS') p.status = 'IN_PROGRESS';
    else if (quickView === 'COMPLETED') p.status = 'APPROVED';
    else if (quickView === 'CRITICAL') p.priority = 'CRITICAL';
    else if (quickView === 'APPROVED') p.status = 'APPROVED';
    else if (quickView === 'Operations') p.department = 'Operations';
    else if (quickView === 'Brand Managers') p.department = 'Brand Managers';
    else if (quickView === 'Catalog Team') p.department = 'Catalog Team';
    else if (quickView === 'AUTOMATION') p.isAutomated = true;
    else if (quickView === 'OVERDUE') p.overdue = true;
    else if (quickView === 'TOMORROW') { p.dueTomorrow = true; p.open = true; }
    else if (quickView === 'UPCOMING') { p.upcoming = true; p.open = true; }
    else if (quickView === 'TODO') p.open = true;
    if (filters.department) p.department = filters.department;
    if (filters.seller) p.sellerId = filters.seller;
    if (filters.manager) p.assignedTo = filters.manager;
    if (filters.reviewer) p.reviewerId = filters.reviewer;
    if (filters.priority) p.priority = filters.priority;
    if (filters.status) p.status = filters.status;
    if (filters.frequency) p.frequency = filters.frequency;
    if (filters.source === 'automation') p.isAutomated = true;
    else if (filters.source) p.source = filters.source;
    if (viewMode === 'seller') p.includeSubtasks = 'true';
    p.includeRuleTasks = 'true';
    return p;
  }, [quickView, filters, search, pagination.page, pagination.limit, currentUser, viewMode]);

  const loadInstances = useCallback(async () => {
    setLoading(true);
    try {
      const [instRes, sumRes] = await Promise.all([
        tasksApi.getInstances(buildParams()),
        tasksApi.getDashboardSummary(),
      ]);
      if (instRes.success) {
        let data = instRes.instances || [];
        // Quick views (OVERDUE / TOMORROW / UPCOMING / TODO / AUTOMATION) are resolved by the
        // API in buildParams. They used to be re-applied here to the 25 rows of the current
        // page, so the list silently dropped rows and every count described the page rather
        // than the workload. Only the health bucket stays client-side: calculateHealth() is
        // the single source of truth for that score, and duplicating it in SQL would let the
        // two definitions drift. The UI labels it as page-scoped.
        if (disputesOnly) data = data.filter(t => t.Category === 'PRICING' || t.Category === 'LISTING' || t.IsRuleTask);
        if (filters.health === 'critical') data = data.filter(t => calculateHealth(t).score < 50);
        else if (filters.health === 'attention') data = data.filter(t => { const h = calculateHealth(t).score; return h >= 50 && h < 80; });
        else if (filters.health === 'healthy') data = data.filter(t => calculateHealth(t).score >= 80);
        setInstances(data);
        setPagination(instRes.pagination);
        setAggregates(instRes.aggregates || null);
      }
      if (sumRes.success) setSummary(sumRes.data);
      setLastSync(dayjs().format('h:mm A'));
    } catch { message.error('Failed to load tasks'); }
    finally { setLoading(false); }
  }, [buildParams, quickView, filters, viewMode, disputesOnly, message]);

  useEffect(() => { loadInstances(); }, [loadInstances, quickView, filters, search, pagination.page, viewMode, disputesOnly]);

  const openWorkspace = (task) => { setWorkspaceTaskId(task.Id); setWorkspaceOpen(true); };

  /* ── Create-task wizard ── */
  const openWizard = (arg) => {
    const prefill = (arg && typeof arg === 'object' && arg.templateId) ? { templateId: arg.templateId } : {};
    const t = prefill.templateId ? templates.find(x => x.Id === prefill.templateId) : null;
    setWizardStep(0);
    setWizardErrors({});
    setWizardData({
      templateId: prefill.templateId || null,
      title: t?.Name ? `${t.Name} — new run` : '',
      department: t?.Department || '',
      priority: t?.Priority || 'MEDIUM',
      frequency: t?.Frequency || 'ONE_TIME',
      target: t?.DefaultTarget || 0,
      tags: [], description: '', priority2: 'MEDIUM', slaHours: t?.SLAHours || 48,
      ...prefill,
    });
    setWizardOpen(true);
  };
  // Auto-open wizard when navigated from template detail (?template=xxx&new=1)
  useEffect(() => {
    if (!templates.length) return;
    const tplId = searchParams.get('template');
    const isNew = searchParams.get('new');
    if (tplId && isNew) {
      openWizard({ templateId: tplId });
      setSearchParams({}, { replace: true });
    }
  }, [templates, searchParams]); // eslint-disable-line

  const handleWizardNext = () => {
    const errors = {};
    if (wizardStep === 0) {
      if (!wizardData.templateId) errors.templateId = 'Select a template to continue';
      if (!wizardData.title || !String(wizardData.title).trim()) errors.title = 'Task name is required';
    }
    if (wizardStep === 1) {
      if (!wizardData.assignedTo) errors.assignedTo = 'Assign someone responsible for this task';
    }
    if (Object.keys(errors).length > 0) { setWizardErrors(errors); return; }
    setWizardErrors({});
    setWizardStep(Math.min(wizardStep + 1, 4));
  };
  const handleCreateTask = async () => {
    setCreating(true);
    try {
      await tasksApi.createInstance({
        templateId: wizardData.templateId, title: wizardData.title,
        description: wizardData.description || '',
        sellerId: wizardData.sellerId, sellerName: wizardData.sellerName,
        assignedTo: wizardData.assignedTo, assigneeName: wizardData.assigneeName,
        reviewerId: wizardData.reviewerId, reviewerName: wizardData.reviewerName,
        department: wizardData.department, priority: wizardData.priority,
        target: wizardData.target, dueDate: wizardData.dueDate?.toISOString(),
        frequency: wizardData.frequency || 'ONE_TIME',
        status: wizardData.assignedTo ? 'ASSIGNED' : 'DRAFT',
        slaHours: wizardData.slaHours || 48,
        tags: Array.isArray(wizardData.tags) ? wizardData.tags : [],
        category: (templates.find(x => x.Id === wizardData.templateId)?.Category) || wizardData.department,
      });
      message.success('Task created and assigned');
      setWizardOpen(false);
      setWizardData({});
      loadInstances();
    } catch (err) { message.error(err.message || 'Failed to create task'); }
    finally { setCreating(false); }
  };

  /* ── Selection + bulk actions ── */
  const toggleSelectAll = () => selectedIds.size === instances.length ? setSelectedIds(new Set()) : setSelectedIds(new Set(instances.map(i => i.Id)));
  const toggleSelect = (id) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const bulkTransition = (toStatus, verb, color) => {
    const ids = [...selectedIds];
    modal.confirm({
      title: `${verb} ${ids.length} task${ids.length !== 1 ? 's' : ''}?`,
      icon: <CheckCircleOutlined style={{ color }} />,
      content: `This will move every selected task to “${WORKFLOW_STATUSES[toStatus]?.label || toStatus}”. Tasks in a non-transitionable state will be skipped.`,
      okText: `${verb} all`,
      okButtonProps: { style: { background: color, borderColor: color } },
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          const res = await tasksApi.bulkTransition(ids, toStatus, `Bulk ${verb.toLowerCase()} via list`);
          const { updatedCount = 0, skippedCount = 0 } = res?.data || {};
          if (skippedCount > 0) {
            message.warning(`${updatedCount} updated · ${skippedCount} skipped (not in a transitionable state)`);
          } else {
            message.success(`${updatedCount} of ${ids.length} tasks updated`);
          }
        } catch (err) {
          message.error(err.message || 'Bulk transition failed');
        }
        setSelectedIds(new Set());
        loadInstances();
      },
    });
  };

  const handleExport = () => {
    const data = selectedIds.size > 0 ? instances.filter(t => selectedIds.has(t.Id)) : instances;
    exportTasksToExcel(data);
    message.success(`Exported ${data.length} task${data.length !== 1 ? 's' : ''} to Excel`);
  };

  /* ── Derived data ── */
  const activeFilterCount = useMemo(() => Object.values(filters).filter(v => v).length, [filters]);
  const totalPages = Math.max(1, Math.ceil(pagination.total / pagination.limit));

  const computedKpi = useMemo(() => {
    // Workload-wide numbers come from the API, which aggregates the whole filtered set
    // (same seller scope, same filters) rather than the rows on screen. Anything that needs
    // per-row detail — pricing/listing quality, buy-box wins — is still derived from this
    // page and is labelled as such in the UI.
    const a = aggregates;
    const pageRows = instances;
    const ruleTasks = pageRows.filter(t => t.IsRuleTask || t.source === 'ACTION_RULE' || t.InstanceCode?.startsWith('R'));
    const pricing = pageRows.filter(t => (t.Category || t.Department) === 'PRICING');
    const pricingMismatches = pricing.filter(t => {
      const asp = t.SellingPrice || t.ASP;
      const sp = t.StandardPrice || t.SP;
      return asp && sp && Math.abs(((asp - sp) / sp) * 100) > 2;
    }).length;
    const listing = pageRows.filter(t => (t.Category || t.Department) === 'LISTING');
    const scores = listing.map(t => t.AIHealthScore ?? t.CatalogScore).filter(s => s != null);
    const avgHealth = scores.length > 0 ? scores.reduce((x, y) => x + y, 0) / scores.length : null;
    const pageApproved = pageRows.filter(t => t.Status === 'APPROVED').length;
    const pageInProg = pageRows.filter(t => t.Status === 'IN_PROGRESS').length;
    const pageOverdue = pageRows.filter(t => isOverdue(t)).length;
    const pagePendingReview = pageRows.filter(t => t.Status === 'UNDER_REVIEW').length;
    const pageSlaOk = pageRows.filter(t => t.SLAStatus === 'WITHIN_SLA' || !t.SLAStatus).length;
    const buyBoxTasks = pageRows.filter(t => t.InstanceCode?.includes('DLY-002'));
    const buyBoxWin = buyBoxTasks.filter(t => t.IsBuyBoxWon || t.BuyBoxStatus === 'WON').length;
    const pageBuyBoxPct = buyBoxTasks.length > 0 ? Math.round((buyBoxWin / buyBoxTasks.length) * 100) : null;

    const total = a ? a.total : pagination.total;
    const approved = a ? a.approved : pageApproved;
    const slaCompliance = a
      ? (a.total > 0 ? Math.round(((a.total - a.slaBreached) / a.total) * 100) : 100)
      : (pageRows.length > 0 ? Math.round((pageSlaOk / pageRows.length) * 100) : 100);

    return {
      total,
      active: a ? a.inProgress : pageInProg,
      approved,
      overdue: a ? a.overdue : pageOverdue,
      pendingReview: a ? a.underReview : pagePendingReview,
      slaCompliance, pricingMismatches, avgHealth: avgHealth ?? summary?.kpi?.avgHealth,
      autoTasks: a ? a.automated : (ruleTasks.length + (automationStats?.total || 0)),
      autoOpen: a ? Math.max(0, a.automated - a.approved) : (automationStats?.open || 0),
      autoOverdue: a ? a.overdue : (automationStats?.overdue || pageOverdue),
      activeDisputes: a ? a.underReview : ruleTasks.filter(t => ['IN_PROGRESS', 'SUBMITTED'].includes(t.Status)).length,
      buyBoxPct: pageBuyBoxPct ?? summary?.kpi?.buyBoxPct,
      disputeTrend: summary?.kpi?.disputeTrend,
      pricingTrend: summary?.kpi?.pricingTrend,
      qualityTrend: summary?.kpi?.qualityTrend,
      buyBoxTrend: summary?.kpi?.buyBoxTrend,
      successTrend: summary?.kpi?.successTrend,
      overdueTrend: summary?.kpi?.overdueTrend,
      completionRate: a ? a.completionRate : (total > 0 ? Math.round((approved / total) * 100) : 0),
      pricingHealth: pricingMismatches,
    };
  }, [instances, aggregates, summary, pagination.total, automationStats]);

  const kpi = { ...summary?.kpi, ...computedKpi };

  /* ── Filter definitions (labels for chips + drawer) ── */
  const FILTER_DEFS = [
    { key: 'department', label: 'Department', options: DEPARTMENTS.map(d => ({ value: d.value, label: d.label })) },
    { key: 'seller', label: 'Seller', options: sellers.map(s => ({ value: s.Id, label: s.Name })) },
    { key: 'manager', label: 'Manager', options: managers.map(m => ({ value: m.Id, label: m.FullName })) },
    { key: 'reviewer', label: 'Reviewer', options: reviewers.map(r => ({ value: r.Id, label: r.FullName })) },
    { key: 'priority', label: 'Priority', options: Object.entries(PRIORITIES).map(([k, v]) => ({ value: k, label: v.label })) },
    { key: 'status', label: 'Status', options: Object.entries(WORKFLOW_STATUSES).map(([k, v]) => ({ value: k, label: v.label })) },
    { key: 'health', label: 'Health (this page)', options: [{ value: 'critical', label: 'Critical' }, { value: 'attention', label: 'Attention' }, { value: 'healthy', label: 'Healthy' }] },
    { key: 'frequency', label: 'Frequency', options: FREQUENCIES.map(f => ({ value: f.value, label: f.label })) },
    { key: 'source', label: 'Source', options: [
      { value: 'automation', label: '🤖 Automation rules' },
      { value: 'MANUAL', label: '👤 Manually created' },
      { value: 'TEMPLATE', label: '📋 From template' },
    ]},
  ];
  const getFilterLabel = (key, value) => {
    const def = FILTER_DEFS.find(f => f.key === key);
    return def?.options.find(o => o.value === value)?.label || value;
  };
  const clearAllFilters = () => {
    setFilters({ department: null, seller: null, manager: null, reviewer: null, priority: null, status: null, health: null, frequency: null, source: null });
    setPagination(p => ({ ...p, page: 1 }));
  };

  /* ── SELLER TASKS VIEW ── */
  const renderSellerTasksView = () => {
    if (instances.length === 0) return <Empty description="No tasks found" className="tasks-empty-wrap" />;

    const grouped = {};
    instances.forEach(task => {
      const key = task.SellerName || 'Unassigned';
      if (!grouped[key]) grouped[key] = { sellerName: key, sellerId: task.SellerId, tasks: [] };
      grouped[key].tasks.push(task);
    });

    const groups = Object.values(grouped).sort((a, b) => a.sellerName.localeCompare(b.sellerName));

    return (
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        {groups.map(group => {
          const total = group.tasks.length;
          const done = group.tasks.filter(t => t.Status === 'APPROVED').length;
          const inProg = group.tasks.filter(t => t.Status === 'IN_PROGRESS' || t.Status === 'ESCALATED').length;
          const color = getSellerColor(group.sellerName);
          return (
            <Card key={group.sellerId || group.sellerName} style={{ borderRadius: 'var(--bc-radius-xl, 12px)', border: '1px solid var(--bc-border-subtle, #e2e8f0)', overflow: 'hidden', boxShadow: 'var(--bc-shadow-card, 0 1px 3px rgba(0,0,0,0.04))' }} styles={{ body: { padding: 0 } }}>
              <div style={{ padding: '12px 20px', background: `linear-gradient(135deg, ${color}10, var(--bc-surface-card, #fff))`, borderBottom: '1px solid var(--bc-border-subtle, #f1f5f9)', borderLeft: `4px solid ${color}` }}>
                <Row align="middle" gutter={16}>
                  <Col><Avatar size={36} style={{ background: color, fontSize: 15, fontWeight: 600 }}>{getSellerInitial(group.sellerName)}</Avatar></Col>
                  <Col flex={1}>
                    <Space size={8} wrap>
                      <Text strong style={{ fontSize: 'var(--bc-text-base, 14px)', color: 'var(--bc-text-heading, #0f172a)' }}>{group.sellerName}</Text>
                      <Tag style={{ borderRadius: 'var(--bc-radius-full, 9999px)', background: 'var(--bc-surface-subtle, #f1f5f9)', color: 'var(--bc-text-secondary, #64748b)', border: '1px solid var(--bc-border-default, #e2e8f0)' }}>{total} tasks</Tag>
                      {inProg > 0 && <Tag style={{ borderRadius: 'var(--bc-radius-full, 9999px)', background: 'var(--bc-ro-50, #E3F2FD)', color: 'var(--bc-ro-600, #1565C0)', border: '1px solid var(--bc-ro-200, #90CAF9)' }}>{inProg} in progress</Tag>}
                    </Space>
                  </Col>
                  <Col>
                    <Space size={16} align="center">
                      <Space size={8}>
                        <Badge color="var(--bc-green-600, #16a34a)" text={<Text style={{ fontSize: 'var(--bc-text-sm, 13px)' }}>{done}</Text>} />
                        <Badge color="var(--bc-ro-500, #1976D2)" text={<Text style={{ fontSize: 'var(--bc-text-sm, 13px)' }}>{inProg}</Text>} />
                      </Space>
                      <Progress percent={total === 0 ? 0 : Math.round((done / total) * 100)} size="small" style={{ width: 100, margin: 0 }} strokeColor={color} railColor="var(--bc-slate-100, #f1f5f9)" format={p => <Text style={{ fontSize: 'var(--bc-text-xs, 11px)', color: 'var(--bc-text-secondary, #64748b)' }}>{p}%</Text>} />
                    </Space>
                  </Col>
                </Row>
              </div>
              <div style={{ padding: '4px 12px' }}>
                <Collapse ghost items={group.tasks.map(task => ({
                  key: task.Id,
                  label: (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', cursor: 'pointer' }}>
                      <div style={{ flex: 1 }}>
                        <Space size={6}>
                          <Tag style={{ fontSize: 10, borderRadius: 'var(--bc-radius-sm, 4px)', margin: 0, background: WORKFLOW_STATUSES[task.Status]?.bg || 'var(--bc-surface-subtle, #f1f5f9)', color: WORKFLOW_STATUSES[task.Status]?.color || 'var(--bc-text-secondary, #64748b)', border: 'none' }}>{WORKFLOW_STATUSES[task.Status]?.label || task.Status}</Tag>
                          <Text style={{ fontSize: 'var(--bc-text-sm, 13px)', fontWeight: 500, color: 'var(--bc-text-heading, #0f172a)' }}>{task.Title}</Text>
                          <Text style={{ fontSize: 10, color: 'var(--bc-text-muted, #94a3b8)' }}>{task.InstanceCode}</Text>
                        </Space>
                      </div>
                      <Tag style={{ fontSize: 10, borderRadius: 'var(--bc-radius-full, 9999px)' }} color={PRIORITIES[task.Priority]?.antColor || 'default'}>{task.Priority}</Tag>
                      <Text style={{ fontSize: 10, color: 'var(--bc-text-muted, #94a3b8)', whiteSpace: 'nowrap' }}>{task.DueDate ? dayjs(task.DueDate).format('DD MMM') : '-'}</Text>
                      <Button type="text" size="small" icon={<EyeOutlined />} onClick={e => { e.stopPropagation(); openWorkspace(task); }} style={{ color: 'var(--bc-text-muted, #94a3b8)' }} />
                    </div>
                  ),
                  children: (() => {
                    const items = task.subTasks || [];
                    if (items.length === 0) return <div style={{ padding: '8px 12px 8px 16px' }}><Text style={{ fontSize: 11, color: 'var(--bc-text-muted, #94a3b8)' }}>No sub-tasks</Text></div>;
                    return (
                      <div style={{ padding: '4px 12px 8px 16px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {items.map(st => (
                          <div key={st.Id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 'var(--bc-radius-sm, 4px)', background: 'var(--bc-surface-subtle, #f1f5f9)', border: '1px solid var(--bc-border-subtle, #f1f5f9)' }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: st.IsCompleted ? 'var(--bc-green-600, #16a34a)' : 'var(--bc-text-muted, #94a3b8)' }} />
                            <Text style={{ fontSize: 'var(--bc-text-xs, 11px)', color: 'var(--bc-text-body, #334155)', flex: 1 }}>{st.Title}</Text>
                            <Tag style={{ fontSize: 9, borderRadius: 'var(--bc-radius-full, 9999px)', background: st.IsCompleted ? 'var(--bc-green-50, #f0fdf4)' : 'var(--bc-surface-subtle, #f1f5f9)', color: st.IsCompleted ? 'var(--bc-green-600, #16a34a)' : 'var(--bc-text-secondary, #64748b)', border: 'none' }}>{st.IsCompleted ? 'Done' : 'Pending'}</Tag>
                          </div>
                        ))}
                      </div>
                    );
                  })()
                }))} />
              </div>
            </Card>
          );
        })}
      </Space>
    );
  };

  /* ── OKR SELLER VIEW ── */
  const sellerGroups = useMemo(() => buildSellerHierarchy(objectives, allActions, okrSellers), [objectives, allActions, okrSellers]);

  const okrTaskColumns = [
    {
      key: 'title', width: 320, render: (_, task) => (
        <Space size={8}>
          <Tag style={{ fontSize: 10, fontWeight: 600, fontFamily: 'var(--bc-font-mono, monospace)', background: 'var(--bc-surface-subtle, #f1f5f9)', color: 'var(--bc-text-secondary, #64748b)', border: '1px solid var(--bc-border-default, #e2e8f0)', borderRadius: 'var(--bc-radius-sm, 4px)' }}>TASK</Tag>
          <div>
            <Text style={{ fontSize: 'var(--bc-text-sm, 13px)', color: 'var(--bc-text-heading, #0f172a)', fontWeight: 500 }}>{task.action || task.title || task.name || 'Untitled'}</Text>
            {task.description && <Text style={{ fontSize: 'var(--bc-text-xs, 11px)', color: 'var(--bc-text-muted, #94a3b8)', display: 'block', marginTop: 0 }}>{task.description.substring(0, 80)}{(task.description || '').length > 80 ? '...' : ''}</Text>}
            {task.krTitle && <Text style={{ fontSize: 10, color: 'var(--bc-text-secondary, #64748b)', display: 'block', marginTop: 0 }}>KR: {task.krTitle}</Text>}
          </div>
        </Space>
      ),
    },
    { key: 'priority', width: 100, render: (_, task) => <OkrPriorityTag priority={(task.priority || 'MEDIUM').toUpperCase()} /> },
    { key: 'status', width: 100, render: (_, task) => <OkrStatusTag status={(task.status || 'PENDING').toUpperCase()} /> },
    {
      key: 'progress', width: 120, render: (_, task) => {
        const status = (task.status || '').toUpperCase();
        const pct = status === 'COMPLETED' ? 100 : status === 'IN_PROGRESS' ? 50 : 0;
        return <OkrProgressCell pct={pct} />;
      }
    },
    {
      key: 'timeline', width: 160, render: (_, task) => (
        <OkrTimelineCell createdAt={task.createdAt} startedAt={task.timeTracking?.startedAt} completedAt={task.timeTracking?.completedAt} status={(task.status || '').toUpperCase()} />
      )
    },
    {
      key: 'actions', width: 60, align: 'right', render: (_, task) => (
        <Button type="text" icon={<EyeOutlined />} size="small" style={{ color: 'var(--bc-text-muted, #94a3b8)' }} />
      )
    },
  ];

  const renderSellerView = () => {
    if (sellerGroups.length === 0) return <Empty description="No objectives or tasks found. Create an objective to get started." className="tasks-empty-wrap" />;

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
                <Tag style={{ fontSize: 10, fontWeight: 600, fontFamily: 'var(--bc-font-mono, monospace)', background: 'var(--bc-ro-50, #E3F2FD)', color: 'var(--bc-ro-600, #1565C0)', border: '1px solid var(--bc-ro-200, #90CAF9)', borderRadius: 'var(--bc-radius-sm, 4px)', minWidth: 36, textAlign: 'center' }}>OBJ</Tag>
              </Col>
              <Col flex={1}>
                <Space size={8}>
                  {hasReview && <Tooltip title="Has tasks awaiting review"><Badge dot color="#ED6C02" /></Tooltip>}
                  {childIncomplete && <Tooltip title="Not all tasks complete"><LockOutlined style={{ color: '#fbbf24', fontSize: 'var(--bc-text-sm, 13px)' }} /></Tooltip>}
                  <Text strong style={{ fontSize: 'var(--bc-text-sm, 13px)', color: 'var(--bc-text-heading, #0f172a)' }}>{obj.title || 'Untitled Objective'}</Text>
                </Space>
              </Col>
              <Col>
                <Space size={12} align="center">
                  <Text style={{ fontSize: 'var(--bc-text-xs, 11px)', color: 'var(--bc-text-muted, #94a3b8)' }}>{objDone}/{objTasks.length} done</Text>
                  <Progress percent={objPct} size="small" style={{ width: 80, margin: 0 }} strokeColor={objPct === 100 ? 'var(--bc-green-600, #16a34a)' : 'var(--bc-ro-500, #1976D2)'} railColor="var(--bc-slate-100, #f1f5f9)" showInfo={false} />
                  <Text style={{ fontSize: 'var(--bc-text-xs, 11px)', color: 'var(--bc-text-secondary, #64748b)', fontVariantNumeric: 'tabular-nums', minWidth: 32 }}>{objPct}%</Text>
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
              style={{ background: 'var(--bc-surface-card, #fff)' }}
              rowClassName={(_, idx) => idx % 2 === 0 ? 'task-row-even' : 'task-row-odd'}
              expandable={{
                expandedRowRender: (task) => {
                  if (task.subtasks && task.subtasks.length > 0) return (
                    <div style={{ padding: '8px 16px 8px 48px', background: 'var(--bc-surface-subtle, #f1f5f9)' }}>
                      {task.subtasks.map((sub, si) => (
                        <Row key={sub._id || sub.id || si} align="middle" gutter={16} style={{ padding: '6px 12px', background: 'var(--bc-surface-card, #fff)', borderRadius: 6, marginBottom: 4, border: '1px solid var(--bc-border-subtle, #f1f5f9)' }}>
                          <Col flex={1}>
                            <Space size={8}>
                              <Tag style={{ fontSize: 10, fontWeight: 600, fontFamily: 'var(--bc-font-mono, monospace)', background: 'var(--bc-cyan-50, #ecfeff)', color: 'var(--bc-cyan-600, #0891b2)', border: '1px solid var(--bc-cyan-100, #cffafe)', borderRadius: 'var(--bc-radius-sm, 4px)' }}>SUB</Tag>
                              <Text style={{ fontSize: 'var(--bc-text-sm, 13px)', color: 'var(--bc-text-body, #334155)' }}>{sub.action || sub.title || sub.name || 'Untitled'}</Text>
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
          style: { background: 'var(--bc-surface-muted, #f8fafc)', borderBottom: '1px solid var(--bc-border-subtle, #f1f5f9)' },
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
                <Tag style={{ fontSize: 10, fontWeight: 600, fontFamily: 'var(--bc-font-mono, monospace)', background: 'var(--bc-blue-50, #eff6ff)', color: 'var(--bc-blue-600, #2563eb)', border: '1px solid var(--bc-blue-200, #bfdbfe)', borderRadius: 'var(--bc-radius-sm, 4px)' }}>DIRECT</Tag>
                <Text strong style={{ fontSize: 'var(--bc-text-sm, 13px)', color: 'var(--bc-text-heading, #0f172a)' }}>Direct Tasks</Text>
                <Tag style={{ fontSize: 'var(--bc-text-xs, 11px)', background: 'var(--bc-surface-subtle, #f1f5f9)', color: 'var(--bc-text-secondary, #64748b)', border: '1px solid var(--bc-border-default, #e2e8f0)', borderRadius: 'var(--bc-radius-full, 9999px)' }}>{filteredDirect.length} tasks</Tag>
              </Space>
            ),
            children: (
              <Table dataSource={filteredDirect.map((t, i) => ({ ...t, _tableKey: `d-${t._id || t.id}-${i}` }))} rowKey="_tableKey" columns={okrTaskColumns} size="small" pagination={false} showHeader={false} style={{ background: 'var(--bc-surface-card, #fff)' }} />
            ),
            style: { background: 'var(--bc-surface-muted, #f8fafc)', borderBottom: '1px solid var(--bc-border-subtle, #f1f5f9)' },
          });
        }
      }
      return items;
    };

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

    if (visibleGroups.length === 0) return <Empty description="No tasks match current filters" className="tasks-empty-wrap" />;

    return (
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
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
            <Card key={group.sellerId} style={{ borderRadius: 'var(--bc-radius-xl, 12px)', border: '1px solid var(--bc-border-subtle, #e2e8f0)', overflow: 'hidden', boxShadow: 'var(--bc-shadow-card, 0 1px 3px rgba(0,0,0,0.04))' }} styles={{ body: { padding: 0 } }}>
              <div style={{ padding: '12px 20px', background: `linear-gradient(135deg, ${sellerColor}10, var(--bc-surface-card, #fff))`, borderBottom: '1px solid var(--bc-border-subtle, #f1f5f9)', borderLeft: `4px solid ${sellerColor}` }}>
                <Row align="middle" gutter={16} style={{ width: '100%' }}>
                  <Col><Avatar size={36} style={{ background: sellerColor, fontSize: 15, fontWeight: 600 }}>{getSellerInitial(group.sellerName)}</Avatar></Col>
                  <Col flex={1}>
                    <Space size={8} wrap>
                      <Text strong style={{ fontSize: 'var(--bc-text-base, 14px)', color: 'var(--bc-text-heading, #0f172a)' }}>{group.sellerName}</Text>
                      <Tag style={{ borderRadius: 'var(--bc-radius-full, 9999px)', fontSize: 'var(--bc-text-xs, 11px)', background: 'var(--bc-surface-subtle, #f1f5f9)', color: 'var(--bc-text-secondary, #64748b)', border: '1px solid var(--bc-border-default, #e2e8f0)' }}>{group.objectives.length} objective{group.objectives.length !== 1 ? 's' : ''}</Tag>
                      <Tag style={{ borderRadius: 'var(--bc-radius-full, 9999px)', fontSize: 'var(--bc-text-xs, 11px)', background: 'var(--bc-surface-subtle, #f1f5f9)', color: 'var(--bc-text-secondary, #64748b)', border: '1px solid var(--bc-border-default, #e2e8f0)' }}>{totalTasks} task{totalTasks !== 1 ? 's' : ''}</Tag>
                      {overdueTasks > 0 && <Tag style={{ borderRadius: 'var(--bc-radius-full, 9999px)', fontSize: 'var(--bc-text-xs, 11px)', background: 'var(--bc-red-50, #fef2f2)', color: 'var(--bc-red-600, #dc2626)', border: '1px solid var(--bc-red-200, #fecaca)' }}><ExclamationCircleOutlined style={{ marginRight: 4 }} />{overdueTasks} overdue</Tag>}
                      {reviewTasks > 0 && <Tag style={{ borderRadius: 'var(--bc-radius-full, 9999px)', fontSize: 'var(--bc-text-xs, 11px)', background: '#f5f3ff', color: '#9C27B0', border: '1px solid #ddd6fe' }}><EyeOutlined style={{ marginRight: 4 }} />{reviewTasks} needs review</Tag>}
                    </Space>
                  </Col>
                  <Col>
                    <Space size={16} align="center">
                      <Space size={8}>
                        <Badge color="var(--bc-green-600, #16a34a)" text={<Text style={{ fontSize: 'var(--bc-text-sm, 13px)' }}>{doneTasks}</Text>} />
                        <Badge color="var(--bc-ro-500, #1976D2)" text={<Text style={{ fontSize: 'var(--bc-text-sm, 13px)' }}>{inProgTasks}</Text>} />
                      </Space>
                      <Progress percent={pct} size="small" style={{ width: 100, margin: 0 }} strokeColor={sellerColor} railColor="var(--bc-slate-100, #f1f5f9)" format={p => <Text style={{ fontSize: 'var(--bc-text-xs, 11px)', color: 'var(--bc-text-secondary, #64748b)' }}>{p}%</Text>} />
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

  /* ── Empty state for the list view ── */
  const renderListEmpty = () => (
    <Empty className="tasks-empty-wrap" image={Empty.PRESENTED_IMAGE_SIMPLE} description={null}>
      <div style={{ textAlign: 'center' }}>
        <Text strong style={{ fontSize: 'var(--bc-text-base, 14px)', color: 'var(--bc-text-heading, #0f172a)', display: 'block' }}>No tasks found</Text>
        <Text style={{ fontSize: 'var(--bc-text-sm, 13px)', color: 'var(--bc-text-muted, #94a3b8)', display: 'block', marginTop: 2 }}>
          {activeFilterCount > 0 || quickView !== 'ALL'
            ? 'Try clearing filters or switching to a different view'
            : 'Create your first task to get started'}
        </Text>
        <Space style={{ marginTop: 14 }}>
          {(activeFilterCount > 0 || quickView !== 'ALL') ? (
            <Button size="small" icon={<ClearOutlined />} onClick={() => { clearAllFilters(); setQuickView('ALL'); }}>
              Clear filters
            </Button>
          ) : (
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={openWizard}>
              Create task
            </Button>
          )}
        </Space>
      </div>
    </Empty>
  );

  /* ── LIST VIEW ── */
  const renderListView = () => (
    <Card className="tasks-list-card" styles={{ body: { padding: 0 } }}>
      {/* Column header — grid must mirror PremiumTaskRow's TASK_LIST_GRID */}
      <div className="tasks-list-header" style={{ gridTemplateColumns: TASK_LIST_GRID }}>
        <div><Checkbox checked={selectedIds.size === instances.length && instances.length > 0} onChange={toggleSelectAll} /></div>
        <Text className="tasks-section-label">Task</Text>
        <Text className="tasks-section-label">Metrics</Text>
        <Text className="tasks-section-label">Assignee</Text>
        <Text className="tasks-section-label">Priority</Text>
        <Text className="tasks-section-label">Status</Text>
        <Text className="tasks-section-label">SLA</Text>
        <Text className="tasks-section-label">Due</Text>
        <Text className="tasks-section-label" style={{ textAlign: 'right' }}>Actions</Text>
      </div>

      {/* Desktop rows */}
      <div className="tasks-list-desktop">
        {loading ? <ListSkeleton /> : instances.length === 0 ? renderListEmpty() : (
          <div>
            {instances.map((task, i) => (
              <div key={task.Id} className={`tasks-row${selectedIds.has(task.Id) ? ' selected' : ''}`}>
                <PremiumTaskRow
                  task={task}
                  index={i}
                  selected={selectedIds.has(task.Id)}
                  onSelect={toggleSelect}
                  onView={openWorkspace}
                  onRefresh={loadInstances}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mobile cards */}
      <div className="tasks-mobile-only">
        {loading ? <div style={{ textAlign: 'center', padding: 40 }}><Spinner /></div> :
          instances.length === 0 ? <Empty description="No tasks found" style={{ padding: 40 }} /> :
            instances.map(t => <MobileTaskCard key={t.Id} task={t} onView={openWorkspace} />)}
      </div>

      {/* Pagination */}
      {instances.length > 0 && (
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--bc-border-subtle, #f1f5f9)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Space size={12}>
            <Text style={{ fontSize: 12, color: 'var(--bc-text-secondary, #64748b)' }}>
              {pagination.total.toLocaleString()} tasks
              {pagination.ruleTasks?.total > 0 && ` + ${pagination.ruleTasks.total.toLocaleString()} ruleset backlog`}
            </Text>
            <Space size={6}>
              <Text style={{ fontSize: 11, color: 'var(--bc-text-muted, #94a3b8)' }}>Per page</Text>
              <Select
                size="small"
                value={pagination.limit}
                onChange={v => setPagination(p => ({ ...p, limit: v, page: 1 }))}
                style={{ width: 76 }}
                options={[25, 50, 100].map(n => ({ value: n, label: n }))}
              />
            </Space>
          </Space>
          <Space size={8}>
            <Button size="small" icon={<LeftOutlined />} disabled={pagination.page <= 1} onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))} />
            <Text style={{ fontSize: 12, fontWeight: 600, color: 'var(--bc-text-heading, #0f172a)' }}>Page {pagination.page} of {totalPages}</Text>
            <Button size="small" icon={<RightOutlined />} disabled={pagination.page >= totalPages} onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))} />
          </Space>
        </div>
      )}
    </Card>
  );

  /* ════════════════════════════════════════════════ RENDER ════════════════════════════════════════════════ */
  return (
    <div className="tasks-page">
      {/* ═══ 1. STICKY COMMAND HEADER ═══ */}
      <div className={`tasks-sticky-header${headerScrolled ? ' scrolled' : ''}`}>
        <div className="tasks-page-inner" style={{ paddingTop: 12, paddingBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <span className="tasks-brand-tile"><ThunderboltOutlined /></span>
            <div style={{ minWidth: 0 }}>
              <Text strong style={{ fontSize: 17, lineHeight: 1.2, display: 'block', color: 'var(--bc-text-heading, #0f172a)' }}>Task Execution Center</Text>
              <Text style={{ fontSize: 11, color: 'var(--bc-text-muted, #94a3b8)' }}>Execution · Reviews · SLA · Automation</Text>
            </div>
            <LiveActivityFeed compact />
          </div>
          <Space size={8} wrap>
            <Button icon={<ThunderboltOutlined />} onClick={() => window.open('/rule-sets', '_blank')} size="small" style={{ borderRadius: 'var(--bc-radius-md, 6px)', background: 'linear-gradient(135deg,#ecfeff,#ede9fe)', borderColor: '#bae6fd', color: '#0369a1', fontWeight: 600 }}>🤖 Automation Rules</Button>
            <Button icon={<ReloadOutlined />} onClick={loadInstances} loading={loading} size="small" style={{ borderRadius: 'var(--bc-radius-md, 6px)' }}>Refresh</Button>
            <Button icon={<DownloadOutlined />} size="small" onClick={handleExport} style={{ borderRadius: 'var(--bc-radius-md, 6px)' }}>Export</Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openWizard}
              size="small"
              style={{ borderRadius: 'var(--bc-radius-md, 6px)', fontWeight: 600, background: 'var(--bc-ro-500, #1976D2)', borderColor: 'var(--bc-ro-500, #1976D2)', boxShadow: '0 2px 8px rgba(25, 118, 210, 0.3)' }}
            >
              New Task <span className="kbd-hint">N</span>
            </Button>
          </Space>
        </div>
      </div>

      <div className="tasks-page-inner">
        {/* ═══ 2. KPI STRIP ═══ */}
        <CommandCenterKpis
          kpi={kpi}
          risk={summary?.risk}
          disputesOnly={disputesOnly}
          onDisputesToggle={() => setDisputesOnly(d => !d)}
          lastUpdated={lastSync}
        />

        {/* Workload signal line. Every figure is an aggregate over the whole filtered set,
            so it stays correct while paging and while a quick view narrows the list. */}
        {aggregates && aggregates.total > 0 && (
          <div className="tasks-signal" role="status">
            <span className="tasks-signal-label">Workload</span>
            <span className="tasks-signal-item">
              <b>{aggregates.open.toLocaleString()}</b> open
            </span>
            <span className="tasks-signal-item">
              <b>{aggregates.overdueRate}%</b> overdue
            </span>
            <span className="tasks-signal-item">
              <b>{aggregates.dueToday.toLocaleString()}</b> due today
            </span>
            <span className="tasks-signal-item">
              <b>{aggregates.slaBreached.toLocaleString()}</b> SLA breached
            </span>
            {aggregates.unassigned > 0 && (
              <span className="tasks-signal-item tasks-signal-warn">
                <b>{aggregates.unassigned.toLocaleString()}</b> unassigned
              </span>
            )}
            <span className="tasks-signal-item">
              <b>{aggregates.completionRate}%</b> completion
            </span>
            <span className="tasks-signal-item tasks-signal-muted">
              avg open age <b>{aggregates.avgOpenAgeDays}d</b>
            </span>
          </div>
        )}

        {/* Legacy ruleset rows are paginated server-side like PEMS instances. If the
            ruleset backlog is larger than the page we say so, instead of showing a
            truncated list that looks complete. */}
        {pagination.ruleTasks?.truncated && (
          <Alert
            type="warning"
            showIcon
            icon={<ExclamationCircleOutlined />}
            style={{ marginTop: 16 }}
            message={`${(pagination.ruleTasks.total || 0).toLocaleString()} open ruleset tasks in the backlog`}
            description={
              <span>
                Showing {pagination.ruleTasks.returned} of {(pagination.ruleTasks.total || 0).toLocaleString()} on this page.
                These were created by a ruleset run before task creation was fixed, and they are no longer being produced.
                {' '}Review and close them in bulk, or clear the backlog from the Tasks page maintenance action.
              </span>
            }
          />
        )}

        {/* ═══ 3. TOOLBAR: QUICK VIEWS + CONTROLS ═══ */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 16, marginBottom: activeFilterCount > 0 ? 8 : 12 }}>
          <div className="tasks-quick-pills" role="tablist" aria-label="Quick views">
            {QUICK_VIEWS.map(qv => (
              <div
                key={qv.key}
                data-key={qv.key}
                role="tab"
                aria-selected={quickView === qv.key}
                tabIndex={0}
                className={`tasks-quick-pill${quickView === qv.key ? ' active' : ''}`}
                onClick={() => { setQuickView(qv.key); setPagination(p => ({ ...p, page: 1 })); }}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setQuickView(qv.key);
                    setPagination(p => ({ ...p, page: 1 }));
                  }
                }}
              >
                <span className="tasks-quick-pill-icon">{qv.icon}</span>
                <span className="tasks-quick-pill-label">{qv.label}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
            <Segmented
              size="small"
              value={viewMode}
              onChange={(v) => { setViewMode(v); if (v === 'objectives') loadOkrData(); }}
              options={VIEW_OPTIONS}
            />
            <Input
              prefix={<SearchOutlined style={{ fontSize: 'var(--bc-text-sm, 13px)' }} />}
              placeholder="Search tasks, sellers, ASINs..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onPressEnter={() => loadInstances()}
              allowClear
              style={{ width: 240, borderRadius: 'var(--bc-radius-md, 6px)' }}
              size="small"
            />
            <Button
              icon={<FilterOutlined />}
              onClick={() => setShowFilterPanel(true)}
              size="small"
              type={activeFilterCount > 0 ? 'primary' : 'default'}
              style={{ borderRadius: 'var(--bc-radius-md, 6px)' }}
            >
              Filters {activeFilterCount > 0 && <Badge count={activeFilterCount} size="small" style={{ marginLeft: 4 }} />}
            </Button>
            <Button
              className="tasks-insights-trigger"
              icon={<EyeOutlined />}
              size="small"
              onClick={() => setInsightsOpen(true)}
              style={{ borderRadius: 'var(--bc-radius-md, 6px)' }}
            >
              Insights
            </Button>
          </div>
        </div>

        {/* ═══ 4. ACTIVE FILTER CHIPS ═══ */}
        {activeFilterCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <span className="tasks-section-label">Active filters</span>
            {Object.entries(filters).filter(([, v]) => v).map(([k, v]) => (
              <span key={k} className="tasks-chip">
                {FILTER_DEFS.find(f => f.key === k)?.label}: {getFilterLabel(k, v)}
                <CloseOutlined onClick={() => setFilters(p => ({ ...p, [k]: null }))} />
              </span>
            ))}
            <Button type="text" size="small" icon={<ClearOutlined />} onClick={clearAllFilters} style={{ fontSize: 11, color: 'var(--bc-red-600, #dc2626)' }}>
              Clear all
            </Button>
            <div style={{ flex: 1 }} />
            <Text style={{ fontSize: 11, color: 'var(--bc-text-muted, #94a3b8)' }}>
              {instances.length} shown of {pagination.total} tasks
            </Text>
          </div>
        )}

        {/* ═══ 5. MAIN AREA ═══ */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {viewMode === 'objectives' ? (
              <div>
                <Card size="small" style={{ borderRadius: 'var(--bc-radius-xl, 12px)', marginBottom: 12, border: '1px solid var(--bc-border-subtle, #e2e8f0)' }} styles={{ body: { padding: '10px 16px' } }}>
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
                        <Input prefix={<SearchOutlined />} placeholder="Search OKR tasks..." value={okrSearchQuery} onChange={e => setOkrSearchQuery(e.target.value)} style={{ width: 220, borderRadius: 'var(--bc-radius-md, 6px)' }} size="small" allowClear />
                        <Button size="small" icon={<ReloadOutlined />} onClick={loadOkrData}>Refresh</Button>
                        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => { setEditingObjective(null); setIsObjectiveModalOpen(true); }} style={{ background: 'var(--bc-ro-500, #1976D2)', borderRadius: 'var(--bc-radius-md, 6px)' }}>New Objective</Button>
                      </Space>
                    </Col>
                  </Row>
                </Card>
                {okrLoading ? <div style={{ textAlign: 'center', padding: 40 }}><Spinner /></div> : renderSellerView()}
              </div>
            ) : viewMode === 'seller' ? (
              renderSellerTasksView()
            ) : (
              renderListView()
            )}
          </div>

          {/* ═══ 6. RIGHT INSIGHTS PANEL (sticky; drawer below 1360px) ═══ */}
          <div className="tasks-insights-panel">
            <div className="tasks-insights-sticky">
              <RightInsightsPanel onTaskClick={openWorkspace} refreshKey={`${quickView}-${disputesOnly}-${filters.status}-${pagination.page}`} />
            </div>
          </div>
        </div>
      </div>

      {/* ═══ 7. FLOATING BULK ACTION BAR ═══ */}
      {selectedIds.size > 0 && (
        <div className="tasks-bulk-bar">
          <Checkbox checked={selectedIds.size === instances.length} onChange={toggleSelectAll} />
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
            {selectedIds.size} selected
          </Text>
          <span className="tasks-bulk-divider" />
          <Button size="small" icon={<UserOutlined />} onClick={() => message.info('Bulk assignment is coming soon')} style={bulkBtnStyle}>
            Assign
          </Button>
          <Button size="small" icon={<CheckCircleOutlined />} onClick={() => bulkTransition('APPROVED', 'Approve', 'var(--bc-green-600, #16a34a)')} style={{ ...bulkBtnStyle, background: 'var(--bc-green-600, #16a34a)', borderColor: 'var(--bc-green-600, #16a34a)', color: '#fff' }}>
            Approve
          </Button>
          <Button size="small" icon={<CloseCircleOutlined />} onClick={() => bulkTransition('REJECTED', 'Reject', 'var(--bc-red-600, #dc2626)')} style={{ ...bulkBtnStyle, background: 'var(--bc-red-600, #dc2626)', borderColor: 'var(--bc-red-600, #dc2626)', color: '#fff' }}>
            Reject
          </Button>
          <Button size="small" icon={<DownloadOutlined />} onClick={handleExport} style={bulkBtnStyle}>
            Export
          </Button>
          <span className="tasks-bulk-divider" />
          <Button size="small" type="text" icon={<CloseOutlined />} onClick={() => setSelectedIds(new Set())} style={{ color: 'rgba(255,255,255,0.75)' }}>
            Clear
          </Button>
        </div>
      )}

      {/* ═══ 8. FILTER DRAWER ═══ */}
      <Drawer
        title={<Space size={8}><FilterOutlined style={{ color: 'var(--bc-ro-500, #1976D2)' }} /><span>Filters</span></Space>}
        open={showFilterPanel}
        onClose={() => setShowFilterPanel(false)}
        width={400}
        destroyOnHidden
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button size="small" icon={<ClearOutlined />} onClick={clearAllFilters} disabled={activeFilterCount === 0}>
              Reset all
            </Button>
            <Button type="primary" size="small" onClick={() => setShowFilterPanel(false)} style={{ background: 'var(--bc-ro-500, #1976D2)', borderColor: 'var(--bc-ro-500, #1976D2)' }}>
              Show {pagination.total} results
            </Button>
          </div>
        }
      >
        <Space direction="vertical" size={18} style={{ width: '100%' }}>
          {FILTER_DEFS.map(f => (
            <div key={f.key}>
              <Text style={fieldLabel}>{f.label}</Text>
              <Select
                allowClear
                placeholder={`All ${f.label.toLowerCase()}s`}
                value={filters[f.key]}
                onChange={v => { setFilters(p => ({ ...p, [f.key]: v })); setPagination(p => ({ ...p, page: 1 })); }}
                size="middle"
                style={{ width: '100%' }}
                showSearch
                optionFilterProp="label"
                options={f.options}
              />
            </div>
          ))}
          <Text style={{ fontSize: 11, color: 'var(--bc-text-muted, #94a3b8)' }}>
            Filters apply instantly — the task list refreshes as you change them.
          </Text>
        </Space>
      </Drawer>

      {/* ═══ 9. INSIGHTS DRAWER (small screens) ═══ */}
      <Drawer title="Insights" open={insightsOpen} onClose={() => setInsightsOpen(false)} width={340} destroyOnHidden>
        <RightInsightsPanel onTaskClick={openWorkspace} refreshKey={`${quickView}-${disputesOnly}-${filters.status}-${pagination.page}`} />
      </Drawer>

      {/* ═══ 10. OBJECTIVE MANAGER MODAL ═══ */}
      <Modal
        title={<Space size={8}><FlagOutlined style={{ color: 'var(--bc-ro-500, #1976D2)' }} />{editingObjective ? 'Edit Objective' : 'New Objective'}</Space>}
        open={isObjectiveModalOpen}
        onCancel={() => setIsObjectiveModalOpen(false)}
        footer={null}
        width={680}
        destroyOnClose
      >
        <ObjectiveManager
          objective={editingObjective}
          onClose={() => setIsObjectiveModalOpen(false)}
          onSaved={() => { setIsObjectiveModalOpen(false); loadOkrData(); }}
        />
      </Modal>

      {/* ═══ 11. ENTERPRISE TASK WORKSPACE ═══ */}
      <TaskWorkspace open={workspaceOpen} onClose={() => setWorkspaceOpen(false)} taskId={workspaceTaskId} onRefresh={loadInstances} />

      {/* ═══ 12. CREATE TASK WIZARD (premium) ═══ */}
      <Drawer
        title={null}
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        width={Math.min(780, typeof window !== 'undefined' ? window.innerWidth - 40 : 780)}
        destroyOnHidden
        closable={false}
        styles={{ body: { padding: 0, background: 'var(--bc-surface-page, #f8fafc)' }, header: { display: 'none' }, footer: { borderTop: '1px solid #e2e8f0', padding: '14px 22px' } }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <div className="wizard-steps" style={{ margin: 0 }}>
                {[0, 1, 2, 3, 4].map(i => (
                  <div key={i} className={`wizard-step-dot${i === wizardStep ? ' active' : ''}${i < wizardStep ? ' done' : ''}`} />
                ))}
              </div>
              <Text style={{ fontSize: 11, color: 'var(--bc-text-muted, #94a3b8)', marginLeft: 8 }}>
                Step {wizardStep + 1} of 5 · {['Pick template', 'Assign', 'Details', 'Timeline', 'Review'][wizardStep]}
              </Text>
            </Space>
            <Space>
              <Button onClick={() => setWizardOpen(false)}>Cancel</Button>
              <Button onClick={() => setWizardStep(Math.max(0, wizardStep - 1))} disabled={wizardStep === 0}>Back</Button>
              {wizardStep < 4 ? (
                <Button type="primary" icon={<ArrowRightOutlined />} onClick={handleWizardNext} style={{ borderRadius: 10, fontWeight: 700, background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', border: 'none', boxShadow: '0 6px 16px rgba(99,102,241,0.3)' }}>Continue</Button>
              ) : (
                <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleCreateTask} loading={creating} style={{ borderRadius: 10, fontWeight: 700, background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', boxShadow: '0 6px 16px rgba(16,185,129,0.3)' }}>Create task</Button>
              )}
            </Space>
          </div>
        }
      >
        <div className="wizard-shell">
          <div className="wizard-hero" style={{ margin: 24 }}>
            <div className="wizard-hero__icon"><RocketOutlined /></div>
            <div>
              <h4 className="wizard-hero__title">Create a new task</h4>
              <p className="wizard-hero__sub">Pick a template, assign an owner, set priority and a due date. SOP steps and acceptance criteria from the template are attached automatically.</p>
            </div>
          </div>

          <div style={{ padding: '0 24px 20px' }}>
            {wizardStep === 0 && (
              <div className="wizard-step-card">
                <div className="wizard-field">
                  <Text className="wizard-field__label wizard-required">Template</Text>
                  <Select
                    size="large"
                    status={wizardErrors.templateId ? 'error' : ''}
                    placeholder="Search templates (e.g. BuyBox, Listing, Pricing)"
                    value={wizardData.templateId}
                    onChange={v => {
                      const t = templates.find(x => x.Id === v);
                      setWizardData(d => ({ ...d, templateId: v, department: t?.Department, priority: t?.Priority, frequency: t?.Frequency, target: t?.DefaultTarget, title: d.title || (t?.Name ? `${t.Name} — new run` : ''), slaHours: t?.SLAHours || 48 }));
                      setWizardErrors(e => ({ ...e, templateId: null }));
                    }}
                    showSearch optionFilterProp="label" style={{ width: '100%' }}
                    options={templates.map(t => ({ value: t.Id, label: `${t.TaskCode} — ${t.Name}` }))}
                  />
                  {wizardErrors.templateId && <Text style={fieldError}>{wizardErrors.templateId}</Text>}
                  <div className="wizard-field__hint">Templates carry SOPs, SLAs and acceptance criteria.</div>
                </div>

                {wizardData.templateId && (() => {
                  const t = templates.find(x => x.Id === wizardData.templateId);
                  const phases = t?.SubTaskDefinitions || [];
                  const acts = phases.reduce((s, p) => s + (p.activities?.length || 0), 0);
                  return (
                    <div style={{ padding: 14, borderRadius: 12, background: '#f8fafc', border: '1px dashed #cbd5e1', marginBottom: 16 }}>
                      <Space size={8} wrap style={{ marginBottom: 6 }}>
                        <Text code style={{ fontSize: 11 }}>{t?.TaskCode}</Text>
                        <Tag style={{ borderRadius: 8, fontSize: 10, margin: 0 }}>{t?.Category}</Tag>
                        <Tag style={{ borderRadius: 8, fontSize: 10, margin: 0 }}>{t?.SLAHours}h SLA</Tag>
                        {phases.length > 0 && <Tag style={{ borderRadius: 8, fontSize: 10, margin: 0 }}>{phases.length} phases · {acts} steps</Tag>}
                      </Space>
                      {t?.Description && <Text style={{ fontSize: 12, color: '#64748b', display: 'block' }}>{t.Description}</Text>}
                    </div>
                  );
                })()}

                <div className="wizard-field">
                  <Text className="wizard-field__label wizard-required">Task title</Text>
                  <Input size="large" status={wizardErrors.title ? 'error' : ''} value={wizardData.title}
                    onChange={e => { setWizardData(d => ({ ...d, title: e.target.value })); setWizardErrors(err => ({ ...err, title: null })); }}
                    placeholder="e.g. Fix BuyBox loss for B08XYZ123" />
                  {wizardErrors.title && <Text style={fieldError}>{wizardErrors.title}</Text>}
                </div>

                <div className="wizard-field">
                  <Text className="wizard-field__label">Context (optional)</Text>
                  <Input.TextArea rows={2} value={wizardData.description} onChange={e => setWizardData(d => ({ ...d, description: e.target.value }))}
                    placeholder="Why is this needed? Link to the issue, expected impact..." />
                </div>

                <Row gutter={12}>
                  <Col span={12}>
                    <div className="wizard-field">
                      <Text className="wizard-field__label">Department</Text>
                      <Select value={wizardData.department} onChange={v => setWizardData(d => ({ ...d, department: v }))} style={{ width: '100%' }} options={DEPARTMENTS.map(d => ({ value: d.value, label: d.label }))} />
                    </div>
                  </Col>
                  <Col span={12}>
                    <div className="wizard-field">
                      <Text className="wizard-field__label">Priority</Text>
                      <Select value={wizardData.priority} onChange={v => setWizardData(d => ({ ...d, priority: v }))} style={{ width: '100%' }} options={Object.entries(PRIORITIES).map(([k, v]) => ({ value: k, label: v.label }))} />
                    </div>
                  </Col>
                </Row>
              </div>
            )}

            {wizardStep === 1 && (
              <div className="wizard-step-card">
                <div className="wizard-field">
                  <Text className="wizard-field__label">Seller (optional)</Text>
                  <Select placeholder="Select seller account" value={wizardData.sellerId}
                    onChange={v => { const s = sellers.find(x => x.Id === v); setWizardData(d => ({ ...d, sellerId: v, sellerName: s?.Name })); }}
                    showSearch optionFilterProp="label" allowClear style={{ width: '100%' }} size="large"
                    options={sellers.map(s => ({ value: s.Id, label: s.Name }))} />
                  <div className="wizard-field__hint">If this task relates to a specific seller account, select it now.</div>
                </div>
                <div className="wizard-field">
                  <Text className="wizard-field__label wizard-required">Assign to</Text>
                  <Select size="large" status={wizardErrors.assignedTo ? 'error' : ''}
                    placeholder="Select a brand manager / owner" value={wizardData.assignedTo}
                    onChange={v => { const m = managers.find(x => x.Id === v); setWizardData(d => ({ ...d, assignedTo: v, assigneeName: m?.FullName })); setWizardErrors(e => ({ ...e, assignedTo: null })); }}
                    showSearch optionFilterProp="label" allowClear style={{ width: '100%' }}
                    options={managers.map(m => ({ value: m.Id, label: m.FullName }))} />
                  {wizardErrors.assignedTo && <Text style={fieldError}>{wizardErrors.assignedTo}</Text>}
                  {wizardData.assigneeName && (
                    <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: '#ecfdf5', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar size={28} style={{ background: '#16a34a', fontSize: 12 }}>{wizardData.assigneeName.charAt(0)}</Avatar>
                      <Text strong style={{ fontSize: 12, color: '#065f46' }}>{wizardData.assigneeName}</Text>
                      <Text style={{ fontSize: 11, color: '#047857', marginLeft: 'auto' }}>will be notified</Text>
                    </div>
                  )}
                </div>
                <div className="wizard-field">
                  <Text className="wizard-field__label">Reviewer (optional)</Text>
                  <Select placeholder="Select a reviewer" value={wizardData.reviewerId}
                    onChange={v => { const r = reviewers.find(x => x.Id === v); setWizardData(d => ({ ...d, reviewerId: v, reviewerName: r?.FullName })); }}
                    showSearch optionFilterProp="label" allowClear style={{ width: '100%' }}
                    options={reviewers.map(r => ({ value: r.Id, label: r.FullName }))} />
                </div>
              </div>
            )}

            {wizardStep === 2 && (
              <div className="wizard-step-card">
                <Row gutter={12}>
                  <Col span={12}>
                    <div className="wizard-field">
                      <Text className="wizard-field__label">Frequency</Text>
                      <Select value={wizardData.frequency} onChange={v => setWizardData(d => ({ ...d, frequency: v }))} style={{ width: '100%' }} options={FREQUENCIES.map(f => ({ value: f.value, label: f.label }))} />
                    </div>
                  </Col>
                  <Col span={12}>
                    <div className="wizard-field">
                      <Text className="wizard-field__label">SLA (hours)</Text>
                      <InputNumber min={1} value={wizardData.slaHours} onChange={v => setWizardData(d => ({ ...d, slaHours: v }))} style={{ width: '100%' }} />
                    </div>
                  </Col>
                </Row>
                <div className="wizard-field">
                  <Text className="wizard-field__label">Target (optional)</Text>
                  <InputNumber value={wizardData.target} onChange={v => setWizardData(d => ({ ...d, target: v ?? 0 }))} placeholder="e.g. 95" style={{ width: '100%' }} />
                  <div className="wizard-field__hint">A measurable target lets reviewers verify completion objectively.</div>
                </div>
              </div>
            )}

            {wizardStep === 3 && (
              <div className="wizard-step-card">
                <div className="wizard-field">
                  <Text className="wizard-field__label">Due date</Text>
                  <DatePicker value={wizardData.dueDate} onChange={v => setWizardData(d => ({ ...d, dueDate: v }))} style={{ width: '100%' }} size="large" placeholder="Select a due date" disabledDate={c => c && c < dayjs().startOf('day')} />
                  <div className="wizard-field__hint">
                    {wizardData.dueDate ? <>Due <Text strong>{dayjs(wizardData.dueDate).format('ddd, DD MMM YYYY')}</Text></> : 'Leave blank to auto-calculate from the SLA.'}
                  </div>
                </div>
                <div className="wizard-quick-actions">
                  {[1, 2, 3, 5, 7].map(d => (
                    <button key={d} type="button" className="wizard-quick-chip" onClick={() => setWizardData(wd => ({ ...wd, dueDate: dayjs().add(d, 'day') }))}>
                      <ClockCircleOutlined /> {d === 1 ? 'Tomorrow' : `+${d} days`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {wizardStep === 4 && (() => {
              const pri = PRIORITIES[wizardData.priority] || PRIORITIES.MEDIUM;
              const Row_ = ({ l, children }) => <div className="wizard-preview__row"><span className="wizard-preview__row-lbl">{l}</span><span className="wizard-preview__row-val">{children}</span></div>;
              return (
                <div className="wizard-preview">
                  <div className="wizard-preview__header">
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}><CheckCircleOutlined /></div>
                    <div>
                      <h5 className="wizard-preview__title" style={{ color: '#fff' }}>{wizardData.title || 'Untitled task'}</h5>
                      <p className="wizard-preview__sub">Creating will notify the assignee and start the SLA clock.</p>
                    </div>
                  </div>
                  <div className="wizard-preview__body">
                    <Row_ l="Template">{templates.find(t => t.Id === wizardData.templateId)?.Name || '—'}</Row_>
                    <Row_ l="Department">{wizardData.department || '—'}</Row_>
                    {wizardData.sellerName && <Row_ l="Seller">{wizardData.sellerName}</Row_>}
                    <Row_ l="Assignee">{wizardData.assigneeName || 'Unassigned'}</Row_>
                    {wizardData.reviewerName && <Row_ l="Reviewer">{wizardData.reviewerName}</Row_>}
                    <Row_ l="Priority"><Tag style={{ borderRadius: 8, background: pri.bg, color: pri.color, border: 'none', margin: 0 }}>{pri.label}</Tag></Row_>
                    <Row_ l="Frequency">{FREQUENCIES.find(f => f.value === wizardData.frequency)?.label || 'One time'}</Row_>
                    <Row_ l="SLA">{wizardData.slaHours}h</Row_>
                    <Row_ l="Target">{wizardData.target ?? '—'}</Row_>
                    <Row_ l="Due date">{wizardData.dueDate ? dayjs(wizardData.dueDate).format('ddd, DD MMM YYYY') : 'Auto (from SLA)'}</Row_>
                    {wizardData.description && <Row_ l="Context">{wizardData.description}</Row_>}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </Drawer>
    </div>
  );
}

/* Dark bar buttons for the floating bulk-action bar */
const bulkBtnStyle = {
  background: 'rgba(255, 255, 255, 0.09)',
  border: '1px solid rgba(255, 255, 255, 0.16)',
  color: '#fff',
  borderRadius: 'var(--bc-radius-md, 6px)',
  fontWeight: 600,
  fontSize: 11,
  height: 26,
};
