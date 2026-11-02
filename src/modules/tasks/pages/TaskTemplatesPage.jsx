import { Spinner } from "@/components/Spinner";
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card, Button, Input, Select, Tag, Space, Form, Typography, Popconfirm,
  Tooltip, Empty, App, Table, Segmented, Alert,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, CopyOutlined, SearchOutlined,
  ReloadOutlined, EyeOutlined, ThunderboltOutlined, CheckSquareOutlined,
  PlayCircleOutlined, ClockCircleOutlined, FileTextOutlined, AppstoreOutlined,
  BarsOutlined, StarFilled, FireOutlined, SafetyCertificateOutlined,
  TeamOutlined, ToolOutlined, DashboardOutlined, BulbOutlined, UploadOutlined,
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import tasksApi from '../services/tasksApi';
import DailyOpsImportModal from '../components/DailyOpsImportModal';
import TemplateBuilder from '../components/TemplateBuilder';
import { useAuth } from '../../../contexts/AuthContext';
import { FREQUENCIES, CATEGORIES, PRIORITIES } from '../constants';
// The .tpl-* / .sop-* classes this page renders live in tasks.css. This page is
// code-split, so it must pull the stylesheet in itself — otherwise the page only
// renders styled when the user happened to open the task list or review queue
// first (the only other importers), and a direct load or refresh on
// /tasks/templates comes up unstyled.
import '../tasks.css';

const { Text } = Typography;

/* ──────────────────────────────────────────────────
   Category visual meta (icon + color)
   ────────────────────────────────────────────────── */
const CATEGORY_META = {
  LISTING:    { icon: <FileTextOutlined />,       color: '#0ea5e9', bg: '#e0f2fe', label: 'Listing' },
  PRICING:    { icon: <DashboardOutlined />,     color: '#10b981', bg: '#d1fae5', label: 'Pricing' },
  INVENTORY:  { icon: <ToolOutlined />,          color: '#f59e0b', bg: '#fef3c7', label: 'Inventory' },
  ADS:        { icon: <FireOutlined />,          color: '#ef4444', bg: '#fee2e2', label: 'Ads' },
  ANALYTICS:  { icon: <DashboardOutlined />,     color: '#8b5cf6', bg: '#ede9fe', label: 'Analytics' },
  COMPLIANCE: { icon: <SafetyCertificateOutlined />, color: '#06b6d4', bg: '#cffafe', label: 'Compliance' },
  GENERAL:    { icon: <CheckSquareOutlined />,   color: '#64748b', bg: '#f1f5f9', label: 'General' },
};

const sopStats = (tpl) => {
  const phases = tpl.SubTaskDefinitions || tpl.subTaskDefinitions || [];
  const steps = phases.reduce((s, p) => s + (p.activities?.length || 0), 0);
  const mins = phases.reduce((s, p) => s + (p.activities?.reduce((a, x) => a + (x.estimatedMinutes || 0), 0) || 0), 0);
  return { phases: phases.length, steps, mins };
};

/* ──────────────────────────────────────────────────
   Template Card (grid view)
   ────────────────────────────────────────────────── */
function TemplateCard({ tpl, canManage, onView, onEdit, onClone, onDelete, onCreate }) {
  const meta = CATEGORY_META[tpl.Category] || CATEGORY_META.GENERAL;
  const { phases, steps, mins } = sopStats(tpl);
  const pri = PRIORITIES[tpl.Priority] || PRIORITIES.MEDIUM;

  return (
    <div className="tpl-card" onClick={() => onView(tpl)} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onView(tpl); } }}>
      <div className="tpl-card__accent" style={{ background: meta.color }} />
      <div className="tpl-card__top">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div className="tpl-card__icon" style={{ background: meta.bg, color: meta.color }}>{meta.icon}</div>
          <div style={{ minWidth: 0 }}>
            <div className="tpl-card__code">{tpl.TaskCode}</div>
          </div>
        </div>
        <Space size={4}>
          <Tag style={{ margin: 0, borderRadius: 8, background: pri.bg, color: pri.color, border: 'none', fontSize: 9, fontWeight: 700 }}>{pri.label}</Tag>
          {tpl.IsActive ? <Tag color="success" style={{ margin: 0, fontSize: 9, borderRadius: 8 }}>Active</Tag> : <Tag style={{ margin: 0, fontSize: 9, borderRadius: 8 }}>Draft</Tag>}
        </Space>
      </div>
      <div>
        <h4 className="tpl-card__title">{tpl.Name}</h4>
        <p className="tpl-card__desc">{tpl.Description || 'No description provided.'}</p>
      </div>
      <div className="tpl-card__meta">
        <Tag style={{ margin: 0, borderRadius: 8, fontSize: 10, background: meta.bg, color: meta.color, border: 'none', fontWeight: 600 }}>{meta.label}</Tag>
        <Tag style={{ margin: 0, borderRadius: 8, fontSize: 10 }}>
          {FREQUENCIES.find(f => f.value === tpl.Frequency)?.label || tpl.Frequency}
        </Tag>
        {tpl.SLAHours ? <Tag style={{ margin: 0, borderRadius: 8, fontSize: 10, background: '#fef3c7', color: '#b45309', border: 'none' }}><ClockCircleOutlined /> {tpl.SLAHours}h SLA</Tag> : null}
      </div>
      <div className="tpl-card__footer">
        <div className="tpl-card__stats">
          <span className="tpl-card__stat"><b>{phases}</b> phases</span>
          <span className="tpl-card__stat"><b>{steps}</b> steps</span>
          {mins > 0 && <span className="tpl-card__stat"><b>{mins}m</b> est.</span>}
        </div>
        <Space size={4} onClick={e => e.stopPropagation()}>
          {canManage && <Tooltip title="Create a task from this template"><Button size="small" type="text" icon={<PlayCircleOutlined />} onClick={() => onCreate(tpl)} aria-label="Run template" /></Tooltip>}
          <Tooltip title="View"><Button size="small" type="text" icon={<EyeOutlined />} onClick={() => onView(tpl)} aria-label="View" /></Tooltip>
          {canManage && <Tooltip title="Edit"><Button size="small" type="text" icon={<EditOutlined />} onClick={() => onEdit(tpl)} aria-label="Edit" /></Tooltip>}
          {canManage && <Tooltip title="Clone"><Button size="small" type="text" icon={<CopyOutlined />} onClick={() => onClone(tpl)} aria-label="Clone" /></Tooltip>}
          {canManage && (
            <Popconfirm title="Delete this template?" description="Historical task instances are kept." onConfirm={() => onDelete(tpl.Id)} okText="Delete" okButtonProps={{ danger: true }}>
              <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label="Delete" />
            </Popconfirm>
          )}
        </Space>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────
   Main Page
   ────────────────────────────────────────────────── */
export default function TaskTemplatesPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { hasPermission, isAdmin, isGlobalUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Permission-aware: the route already requires tasks_manage, but actions are
  // gated individually so the UI never offers an operation the user cannot do.
  const canManage = isAdmin || isGlobalUser || hasPermission('tasks_manage');

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [summary, setSummary] = useState({ total: 0, active: 0, withSop: 0, scheduled: 0, automatic: 0 });
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [catFilter, setCatFilter] = useState('ALL');
  const [freqFilter, setFreqFilter] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all'); // all | active | draft
  const [viewMode, setViewMode] = useState('grid');
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [total, setTotal] = useState(0);

  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [generating, setGenerating] = useState(false);

  const generateToday = async () => {
    setGenerating(true);
    try {
      const r = await tasksApi.generateRoutineToday();
      message.success(r.created ? `Created ${r.created} task${r.created === 1 ? '' : 's'} for today` : "Today's routine is already up to date");
      if (r.noAssignees?.length) message.warning(`No one to assign: ${r.noAssignees.join(', ')}`);
      loadTemplates(page);
    } catch (e) { message.error(e.message); } finally { setGenerating(false); }
  };

  useEffect(() => { const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 250); return () => clearTimeout(t); }, [search]);

  const loadTemplates = useCallback(async (p = 1) => {
    setLoading(true); setLoadError(null);
    try {
      const params = { page: p, limit: pageSize };
      if (debouncedSearch) params.search = debouncedSearch;
      if (catFilter !== 'ALL') params.category = catFilter;
      if (freqFilter) params.frequency = freqFilter;
      if (activeFilter === 'active') params.isActive = true;
      if (activeFilter === 'draft') params.isActive = false;
      const res = await tasksApi.getTemplates(params);
      if (res.success) {
        setTemplates(res.templates || []);
        setTotal(res.pagination?.total ?? (res.templates || []).length);
      } else {
        setLoadError(res.error || 'Failed to load templates');
      }
    } catch (e) {
      setLoadError(e.message || 'Failed to load templates');
      message.error('Failed to load templates');
    } finally { setLoading(false); }
  }, [debouncedSearch, catFilter, freqFilter, activeFilter]); // eslint-disable-line

  const loadSummary = useCallback(async () => {
    try {
      const res = await tasksApi.getTemplateSummary();
      if (res.success) setSummary(res.data || {});
    } catch { /* summary is non-critical; the library still renders */ }
  }, []);

  useEffect(() => { loadTemplates(page); }, [loadTemplates, page]);
  // loadSummary is async — its setState runs after await, not synchronously.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadSummary(); }, [loadSummary]);

  const openCreate = () => { setEditingTemplate(null); setBuilderOpen(true); };
  const openEdit = (record) => { setEditingTemplate(record); setBuilderOpen(true); };
  const openClone = (r) => {
    // Clone carries the full definition; the server assigns a fresh id/code.
    setEditingTemplate({ ...r, Id: null, TaskCode: null, Name: `${r.Name} (Copy)`, IsActive: false });
    setBuilderOpen(true);
  };

  /* Deep links: ?new=1 | ?edit=<id> | ?clone=<id> (used by template detail page).
     Opening the builder in response to a URL change is an external-event sync. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const editId = searchParams.get('edit');
    const cloneId = searchParams.get('clone');
    const isNew = searchParams.get('new');
    if (!editId && !cloneId && !isNew) return;
    const clear = () => setSearchParams({}, { replace: true });
    if (isNew) { openCreate(); clear(); return; }
    const id = editId || cloneId;
    tasksApi.getTemplateDetail(id).then(r => {
      if (r.success) { (editId ? openEdit : openClone)(r.data); }
      else message.error('Template not found');
    }).catch(() => message.error('Template not found')).finally(clear);
  }, []); // eslint-disable-line
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleDelete = async (id) => {
    try { await tasksApi.deleteTemplate(id); message.success('Template deleted'); loadTemplates(page); loadSummary(); }
    catch { message.error('Delete failed'); }
  };

  const handleRunTemplate = (tpl) => navigate(`/tasks/operations?template=${tpl.Id}&new=1`);

  const catChips = useMemo(() => ([
    { key: 'ALL', label: 'All', icon: <AppstoreOutlined /> },
    ...CATEGORIES.map(c => ({ key: c.value, label: c.label, icon: CATEGORY_META[c.value]?.icon, color: CATEGORY_META[c.value]?.color })),
  ]), []);

  const byCat = useMemo(() => {
    const m = {}; templates.forEach(t => { const c = t.Category || 'GENERAL'; m[c] = (m[c] || 0) + 1; }); return m;
  }, [templates]);

  /* Table columns — only fields that are actually modelled. */
  const columns = [
    { title: 'Code', dataIndex: 'TaskCode', key: 'code', width: 96, render: (v) => <Text style={{ fontFamily: 'var(--bc-font-mono, monospace)', fontSize: 11, color: '#94a3b8', fontWeight: 700 }}>{v}</Text> },
    {
      title: 'Template', dataIndex: 'Name', key: 'name', sorter: (a, b) => (a.Name || '').localeCompare(b.Name || ''),
      render: (v, r) => (<div><Text strong style={{ fontSize: 13, display: 'block' }}>{v}</Text>{r.Description && <Text style={{ fontSize: 11, color: '#94a3b8', display: 'block', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.Description}</Text>}</div>),
    },
    { title: 'Category', dataIndex: 'Category', key: 'cat', width: 110, filters: CATEGORIES.map(c => ({ text: c.label, value: c.value })), onFilter: (val, r) => r.Category === val, render: (v) => { const m = CATEGORY_META[v] || CATEGORY_META.GENERAL; return <Tag style={{ background: m.bg, color: m.color, border: 'none', borderRadius: 8, fontSize: 10, fontWeight: 700 }}>{m.label}</Tag>; } },
    { title: 'Priority', dataIndex: 'Priority', key: 'pri', width: 90, render: (v) => { const p = PRIORITIES[v] || PRIORITIES.MEDIUM; return <Tag style={{ background: p.bg, color: p.color, border: 'none', borderRadius: 8, fontSize: 10, fontWeight: 700 }}>{p.label}</Tag>; } },
    { title: 'Frequency', dataIndex: 'Frequency', key: 'freq', width: 100, render: (v) => <Text style={{ fontSize: 11, color: '#64748b' }}>{FREQUENCIES.find(f => f.value === v)?.label || v}</Text> },
    { title: 'SOP', key: 'sop', width: 90, render: (_, r) => { const { phases } = sopStats(r); return phases > 0 ? <Tag color="blue" style={{ fontSize: 10, borderRadius: 8 }}>{phases} phases</Tag> : <Tag style={{ fontSize: 10, borderRadius: 8 }}>No SOP</Tag>; } },
    { title: 'Assignment', key: 'assign', width: 110, render: (_, r) => r.AutoAssign ? <Tag icon={<ThunderboltOutlined />} color="purple" style={{ fontSize: 10, borderRadius: 8 }}>Auto</Tag> : <Text style={{ fontSize: 11, color: '#64748b' }}>Manual</Text> },
    { title: 'Status', dataIndex: 'IsActive', key: 'status', width: 90, filters: [{ text: 'Active', value: true }, { text: 'Draft', value: false }], onFilter: (val, r) => !!r.IsActive === val, render: (v) => v ? <Tag color="success" style={{ borderRadius: 8, fontSize: 10 }}>Active</Tag> : <Tag style={{ borderRadius: 8, fontSize: 10 }}>Draft</Tag> },
    {
      title: '', key: 'actions', width: 180, fixed: 'right', align: 'right',
      render: (_, r) => (
        <Space size={0}>
          {canManage && <Tooltip title="Run"><Button type="text" size="small" icon={<PlayCircleOutlined />} onClick={() => handleRunTemplate(r)} aria-label="Run" /></Tooltip>}
          <Tooltip title="View"><Button type="text" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/tasks/templates/${r.Id}`)} aria-label="View" /></Tooltip>
          {canManage && <Tooltip title="Edit"><Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} aria-label="Edit" /></Tooltip>}
          {canManage && <Tooltip title="Clone"><Button type="text" size="small" icon={<CopyOutlined />} onClick={() => openClone(r)} aria-label="Clone" /></Tooltip>}
          {canManage && (
            <Popconfirm title="Delete?" onConfirm={() => handleDelete(r.Id)}><Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label="Delete" /></Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const filteredEmpty = !loading && templates.length === 0 && (debouncedSearch || catFilter !== 'ALL' || freqFilter || activeFilter !== 'all');

  return (
    <div className="tpl-page">
      <div className="tpl-page-inner">

        {/* ═══ HERO ═══ */}
        <div className="tpl-hero">
          <span className="tpl-hero__eyebrow"><StarFilled /> Task Operating System</span>
          <h1 className="tpl-hero__title">Task Templates</h1>
          <p className="tpl-hero__subtitle">Define, automate and govern repeatable operational workflows.</p>
          <div className="tpl-hero__stats">
            <div className="tpl-hero__stat"><div className="tpl-hero__stat-val">{summary.total}</div><div className="tpl-hero__stat-lbl">Templates</div></div>
            <div className="tpl-hero__stat"><div className="tpl-hero__stat-val">{summary.active}</div><div className="tpl-hero__stat-lbl">Active</div></div>
            <div className="tpl-hero__stat"><div className="tpl-hero__stat-val">{summary.withSop}</div><div className="tpl-hero__stat-lbl">With SOP</div></div>
            <div className="tpl-hero__stat"><div className="tpl-hero__stat-val"><ThunderboltOutlined /> {summary.scheduled}</div><div className="tpl-hero__stat-lbl">Scheduled</div></div>
          </div>
          <div className="tpl-hero__actions">
            {canManage && <button className="tpl-btn-primary" onClick={openCreate}><PlusOutlined /> New template</button>}
            <button className="tpl-btn-ghost" onClick={() => navigate('/tasks/operations')}><PlayCircleOutlined /> Run tasks</button>
            <button className="tpl-btn-ghost" onClick={() => navigate('/rule-sets')}><BulbOutlined /> Rules that auto-create tasks</button>
          </div>
        </div>

        {/* ═══ CATEGORY CHIPS ═══ */}
        <div className="tpl-cat-chips" role="tablist" aria-label="Filter by category">
          {catChips.map(c => {
            const count = c.key === 'ALL' ? total : (byCat[c.key] || 0);
            return (
              <button key={c.key} role="tab" aria-selected={catFilter === c.key} className={`tpl-cat-chip${catFilter === c.key ? ' active' : ''}`}
                onClick={() => { setCatFilter(c.key); setPage(1); }}>
                {c.icon}<span>{c.label}</span><span className="tpl-cat-chip__count">{count}</span>
              </button>
            );
          })}
        </div>

        {/* ═══ TOOLBAR ═══ */}
        <div className="tpl-toolbar">
          <Input className="tpl-search" prefix={<SearchOutlined style={{ color: '#94a3b8' }} />} placeholder="Search by task name, code or description" value={search} onChange={e => setSearch(e.target.value)} allowClear size="middle" />
          <div className="tpl-toolbar-right">
            <Select allowClear placeholder="Frequency" value={freqFilter} onChange={(v) => { setFreqFilter(v); setPage(1); }} style={{ width: 130 }} options={FREQUENCIES} size="middle" />
            <Segmented value={activeFilter} onChange={(v) => { setActiveFilter(v); setPage(1); }} options={[{ label: 'All', value: 'all' }, { label: 'Active', value: 'active' }, { label: 'Draft', value: 'draft' }]} size="middle" aria-label="Status filter" />
            <Segmented value={viewMode} onChange={setViewMode} options={[{ label: <span><AppstoreOutlined /> Grid</span>, value: 'grid' }, { label: <span><BarsOutlined /> Table</span>, value: 'table' }]} size="middle" aria-label="View mode" />
            {canManage && <Tooltip title="Upload the Daily Operations Master to create the team's routine tasks"><Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)} size="middle">Import daily ops</Button></Tooltip>}
            {canManage && <Tooltip title="Create today's tasks now for every daily routine that hasn't run yet (safe to repeat)"><Button icon={<ThunderboltOutlined />} loading={generating} onClick={generateToday} size="middle">Generate today</Button></Tooltip>}
            <Button icon={<ReloadOutlined />} onClick={() => { loadTemplates(page); loadSummary(); }} size="middle">Refresh</Button>
            {canManage && <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} size="middle">New template</Button>}
          </div>
        </div>

        {/* ═══ CONTENT ═══ */}
        {loadError ? (
          <Card style={{ borderRadius: 16 }}>
            <Alert type="error" showIcon message="Couldn't load templates" description={loadError}
              action={<Button size="small" onClick={() => loadTemplates(page)}>Retry</Button>} />
          </Card>
        ) : loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><Spinner /></div>
        ) : templates.length === 0 ? (
          <Card style={{ borderRadius: 20, textAlign: 'center', padding: '40px 0' }}>
            <Empty description={<Text style={{ fontSize: 14, color: '#64748b' }}>{filteredEmpty ? 'No templates match your filters' : 'No templates yet'}</Text>}>
              <Space>
                {filteredEmpty && <Button onClick={() => { setCatFilter('ALL'); setFreqFilter(null); setSearch(''); setActiveFilter('all'); }}>Clear filters</Button>}
                {canManage && <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Create your first template</Button>}
              </Space>
            </Empty>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="tpl-grid">
            {templates.map(tpl => (
              <TemplateCard key={tpl.Id} tpl={tpl} canManage={canManage} onView={(t) => navigate(`/tasks/templates/${t.Id}`)} onEdit={openEdit} onClone={openClone} onDelete={handleDelete} onCreate={handleRunTemplate} />
            ))}
          </div>
        ) : (
          <Card style={{ borderRadius: 16 }} styles={{ body: { padding: 0 } }}>
            <Table
              rowKey="Id"
              columns={columns}
              dataSource={templates}
              size="middle"
              scroll={{ x: 1080 }}
              onRow={(r) => ({ onClick: () => navigate(`/tasks/templates/${r.Id}`), style: { cursor: 'pointer' } })}
              pagination={{ current: page, pageSize, total, onChange: (p) => setPage(p), showSizeChanger: false, showTotal: (t) => `${t} templates` }}
            />
          </Card>
        )}

        {viewMode === 'grid' && templates.length > 0 && total > templates.length && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Button onClick={() => setPage(p => p + 1)}>Load more ({templates.length} of {total})</Button>
          </div>
        )}

        {/* ═══ TEMPLATE BUILDER ═══ */}
        <TemplateBuilder
          open={builderOpen}
          editingTemplate={editingTemplate}
          onClose={() => setBuilderOpen(false)}
          onSaved={() => { setBuilderOpen(false); loadTemplates(page); loadSummary(); }}
        />

        <DailyOpsImportModal open={importOpen} onClose={() => setImportOpen(false)} onDone={() => { loadTemplates(1); loadSummary(); }} />
      </div>
    </div>
  );
}
