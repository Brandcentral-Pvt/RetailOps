import { Spinner } from "@/components/Spinner";
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card, Button, Input, Select, Tag, Space, Modal, Form, Typography, Popconfirm,
  Row, Col, InputNumber, Switch, Tooltip, Empty, App, Drawer, Tabs, Divider, Progress, Badge, Segmented
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, CopyOutlined, SearchOutlined,
  ReloadOutlined, EyeOutlined, SaveOutlined, ThunderboltOutlined,
  CheckSquareOutlined, PlayCircleOutlined, ClockCircleOutlined,
  RocketOutlined, FileTextOutlined, FilterOutlined, AppstoreOutlined,
  BarsOutlined, ArrowLeftOutlined, StarFilled, FireOutlined,
  SafetyCertificateOutlined, TeamOutlined, ToolOutlined, DashboardOutlined,
  BulbOutlined, UploadOutlined,
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import tasksApi from '../services/tasksApi';
import DailyOpsImportModal from '../components/DailyOpsImportModal';
import { FREQUENCIES, CATEGORIES, PRIORITIES, TARGET_TYPES, DEPARTMENTS, COMPLEXITY_LEVELS, APPROVAL_LEVELS, AUTO_ASSIGN_STRATEGIES } from '../constants';
// The .tpl-* / .sop-* classes this page renders live in tasks.css. This page is
// code-split, so it must pull the stylesheet in itself — otherwise the page only
// renders styled when the user happened to open the task list or review queue
// first (the only other importers), and a direct load or refresh on
// /tasks/templates comes up unstyled.
import '../tasks.css';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

/* ──────────────────────────────────────────────────
   Category visual meta (icon + color gradient)
   ────────────────────────────────────────────────── */
const CATEGORY_META = {
  LISTING:    { icon: <FileTextOutlined />,       color: '#0ea5e9', bg: 'linear-gradient(135deg,#e0f2fe,#dbeafe)', label: 'Listing' },
  PRICING:    { icon: <DashboardOutlined />,     color: '#10b981', bg: 'linear-gradient(135deg,#d1fae5,#ecfccb)', label: 'Pricing' },
  INVENTORY:  { icon: <ToolOutlined />,          color: '#f59e0b', bg: 'linear-gradient(135deg,#fef3c7,#ffedd5)', label: 'Inventory' },
  ADS:        { icon: <FireOutlined />,          color: '#ef4444', bg: 'linear-gradient(135deg,#fee2e2,#ffedd5)', label: 'Ads' },
  ANALYTICS:  { icon: <DashboardOutlined />,     color: '#8b5cf6', bg: 'linear-gradient(135deg,#ede9fe,#ddd6fe)', label: 'Analytics' },
  COMPLIANCE: { icon: <SafetyCertificateOutlined />, color: '#06b6d4', bg: 'linear-gradient(135deg,#cffafe,#e0f2fe)', label: 'Compliance' },
  GENERAL:    { icon: <CheckSquareOutlined />,   color: '#64748b', bg: 'linear-gradient(135deg,#f1f5f9,#e2e8f0)', label: 'General' },
};

/* ──────────────────────────────────────────────────
   SOP Phase Builder (inline activities)
   ────────────────────────────────────────────────── */
function SopPhaseBuilder({ phases, setPhases }) {
  const addPhase = () => setPhases([...phases, { title: '', activities: [{ title: '', instructions: '', expectedOutput: '', estimatedMinutes: 15 }] }]);
  const removePhase = (i) => setPhases(phases.filter((_, idx) => idx !== i));
  const updatePhase = (i, field, val) => { const u = [...phases]; u[i] = { ...u[i], [field]: val }; setPhases(u); };
  const addActivity = (pi) => { const u = [...phases]; u[pi].activities = [...(u[pi].activities || []), { title: '', instructions: '', expectedOutput: '', estimatedMinutes: 15 }]; setPhases(u); };
  const removeActivity = (pi, ai) => { const u = [...phases]; u[pi].activities = u[pi].activities.filter((_, idx) => idx !== ai); setPhases(u); };
  const updateActivity = (pi, ai, field, val) => { const u = [...phases]; u[pi].activities[ai] = { ...u[pi].activities[ai], [field]: val }; setPhases(u); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {phases.map((phase, pi) => {
        const totalMins = (phase.activities || []).reduce((s, a) => s + (a.estimatedMinutes || 0), 0);
        return (
          <div key={pi} className="sop-phase">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, paddingLeft: 10 }}>
              <Tag style={{ margin: 0, fontWeight: 700, fontFamily: 'var(--bc-font-mono, Menlo, monospace)', fontSize: 10, borderRadius: 8, background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', color: '#fff', border: 'none', padding: '3px 9px' }}>PHASE {pi + 1}</Tag>
              <Input value={phase.title} onChange={e => updatePhase(pi, 'title', e.target.value)} placeholder="Phase name (e.g. Pre-launch audit)" size="small" style={{ flex: 1, fontWeight: 600, fontSize: 13 }} bordered={false} />
              <Tag style={{ margin: 0, fontSize: 10, background: '#f1f5f9', color: '#64748b', borderRadius: 6 }}>{totalMins} min</Tag>
              <Tooltip title="Daily routines only include this phase on these days. Leave empty for every day.">
                <Select mode="multiple" size="small" allowClear maxTagCount={2} placeholder="Every day" style={{ minWidth: 130 }}
                  value={phase.schedule?.weekdays || []}
                  options={['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => ({ value: i, label: d }))}
                  onChange={(v) => {
                    const rest = { ...(phase.schedule || {}) }; delete rest.weekdays;
                    const next = v.length ? { ...rest, weekdays: v } : rest;
                    updatePhase(pi, 'schedule', Object.keys(next).length ? next : undefined);
                  }} />
              </Tooltip>
              {phases.length > 1 && (
                <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removePhase(pi)} />
              )}
            </div>
            {(phase.activities || []).map((act, ai) => (
              <div key={ai} className="sop-step">
                <div className="sop-step__num">{ai + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Input value={act.title} onChange={e => updateActivity(pi, ai, 'title', e.target.value)} placeholder="Activity title..." size="small" bordered={false} style={{ fontWeight: 600, fontSize: 12, padding: 0, marginBottom: 4 }} />
                  <TextArea value={act.instructions} onChange={e => updateActivity(pi, ai, 'instructions', e.target.value)} placeholder="Step-by-step instructions..." rows={2} size="small" style={{ fontSize: 12, background: '#fff', borderRadius: 8 }} />
                  <Row gutter={8} style={{ marginTop: 6 }}>
                    <Col span={12}>
                      <Input value={act.expectedOutput} onChange={e => updateActivity(pi, ai, 'expectedOutput', e.target.value)} placeholder="Expected output / acceptance criteria" size="small" style={{ fontSize: 11 }} />
                    </Col>
                    <Col span={6}>
                      <InputNumber value={act.estimatedMinutes} onChange={v => updateActivity(pi, ai, 'estimatedMinutes', v)} min={1} placeholder="Min" style={{ width: '100%' }} size="small" addonAfter="min" />
                    </Col>
                    <Col span={6} style={{ textAlign: 'right' }}>
                      {phase.activities.length > 1 && (
                        <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeActivity(pi, ai)} />
                      )}
                    </Col>
                  </Row>
                </div>
              </div>
            ))}
            <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => addActivity(pi)} block style={{ marginTop: 6, borderRadius: 8, borderStyle: 'dashed' }}>
              Add step
            </Button>
          </div>
        );
      })}
      <Button type="dashed" icon={<PlusOutlined />} onClick={addPhase} block style={{ borderRadius: 10, height: 40, fontWeight: 600 }}>+ Add Phase</Button>
    </div>
  );
}

/* ──────────────────────────────────────────────────
   Template Card (grid view)
   ────────────────────────────────────────────────── */
function TemplateCard({ tpl, onView, onEdit, onClone, onDelete, onCreate }) {
  const meta = CATEGORY_META[tpl.Category] || CATEGORY_META.GENERAL;
  const phases = tpl.SubTaskDefinitions || tpl.subTaskDefinitions || [];
  const actCount = phases.reduce((s, p) => s + (p.activities?.length || 0), 0);
  const totalMins = phases.reduce((s, p) => s + (p.activities?.reduce((a, x) => a + (x.estimatedMinutes || 0), 0) || 0), 0);
  const pri = PRIORITIES[tpl.Priority] || PRIORITIES.MEDIUM;

  return (
    <div className="tpl-card" onClick={() => onView(tpl)}>
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
          {tpl.IsActive ? (
            <Badge status="success" text={<Text style={{ fontSize: 10, color: '#16a34a', fontWeight: 600 }}>Active</Text>} />
          ) : (
            <Badge status="default" text={<Text style={{ fontSize: 10, color: '#94a3b8' }}>Draft</Text>} />
          )}
        </Space>
      </div>
      <div>
        <h4 className="tpl-card__title">{tpl.Name}</h4>
        <p className="tpl-card__desc">{tpl.Description || 'No description provided.'}</p>
      </div>
      <div className="tpl-card__meta">
        <Tag style={{ margin: 0, borderRadius: 8, fontSize: 10, background: meta.bg, color: meta.color, border: 'none', fontWeight: 600 }}>{meta.label}</Tag>
        <Tag style={{ margin: 0, borderRadius: 8, fontSize: 10, background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' }}>
          {FREQUENCIES.find(f => f.value === tpl.Frequency)?.label || tpl.Frequency}
        </Tag>
        {tpl.SLAHours && (
          <Tag style={{ margin: 0, borderRadius: 8, fontSize: 10, background: '#fef3c7', color: '#b45309', border: 'none' }}>
            <ClockCircleOutlined /> {tpl.SLAHours}h SLA
          </Tag>
        )}
      </div>
      <div className="tpl-card__footer">
        <div className="tpl-card__stats">
          <span className="tpl-card__stat"><b>{phases.length}</b> phases</span>
          <span className="tpl-card__stat"><b>{actCount}</b> steps</span>
          {totalMins > 0 && <span className="tpl-card__stat"><b>{totalMins}m</b> est.</span>}
        </div>
        <Space size={4} onClick={e => e.stopPropagation()}>
          <Tooltip title="Create task from template"><Button size="small" type="text" icon={<PlayCircleOutlined />} className="tpl-card__run" onClick={() => onCreate(tpl)} style={{ background: 'linear-gradient(135deg,#ecfeff,#ede9fe)', color: '#0369a1', borderColor: '#bae6fd', borderRadius: 8, fontWeight: 700 }}>Run</Button></Tooltip>
          <Tooltip title="View"><Button size="small" type="text" icon={<EyeOutlined />} onClick={() => onView(tpl)} /></Tooltip>
          <Tooltip title="Edit"><Button size="small" type="text" icon={<EditOutlined />} onClick={() => onEdit(tpl)} /></Tooltip>
          <Tooltip title="Clone"><Button size="small" type="text" icon={<CopyOutlined />} onClick={() => onClone(tpl)} /></Tooltip>
          <Popconfirm title="Delete this template?" onConfirm={() => onDelete(tpl.Id)} okText="Delete" okButtonProps={{ danger: true }}>
            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0 });
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [catFilter, setCatFilter] = useState('ALL');
  const [freqFilter, setFreqFilter] = useState(null);
  const [activeOnly, setActiveOnly] = useState(false);
  const [viewMode, setViewMode] = useState('grid');

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [form] = Form.useForm();
  const watchedFrequency = Form.useWatch('frequency', form);
  const watchedBrandMode = Form.useWatch('brandMode', form);
  const [importOpen, setImportOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [namedAssignees, setNamedAssignees] = useState(0);
  const generateToday = async () => {
    setGenerating(true);
    try {
      const r = await tasksApi.generateRoutineToday();
      message.success(r.created ? `Created ${r.created} task${r.created === 1 ? '' : 's'} for today` : 'Today\'s routine is already up to date');
      if (r.noAssignees?.length) message.warning(`No one to assign: ${r.noAssignees.join(', ')}`);
    } catch (e) { message.error(e.message); } finally { setGenerating(false); }
  };

  // SOP & assignment
  const [phases, setPhases] = useState([{ title: '', activities: [{ title: '', instructions: '', expectedOutput: '', estimatedMinutes: 15 }] }]);
  const [assignmentMode, setAssignmentMode] = useState('manual');
  const [autoStrategy, setAutoStrategy] = useState('lowest_workload');
  const [approvalLevel, setApprovalLevel] = useState('single');
  const [escalationHours, setEscalationHours] = useState(24);
  const [qualityScoreRequired, setQualityScoreRequired] = useState(false);

  /* Debounce search */
  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 250); return () => clearTimeout(t); }, [search]);

  const loadTemplates = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: 100 };
      if (debouncedSearch) params.search = debouncedSearch;
      if (catFilter !== 'ALL') params.category = catFilter;
      if (freqFilter) params.frequency = freqFilter;
      const res = await tasksApi.getTemplates(params);
      if (res.success) {
        let list = res.templates || [];
        if (activeOnly) list = list.filter(t => t.IsActive);
        setTemplates(list);
        setPagination(p => res.pagination || { ...p, total: list.length });
      }
    } catch { message.error('Failed to load templates'); }
    finally { setLoading(false); }
  }, [debouncedSearch, catFilter, freqFilter, activeOnly, pagination]);

  useEffect(() => { loadTemplates(1); }, [loadTemplates]);

  /* Stats for hero */
  const stats = useMemo(() => {
    const total = templates.length;
    const active = templates.filter(t => t.IsActive).length;
    const withSop = templates.filter(t => (t.SubTaskDefinitions || []).length > 0).length;
    const automated = templates.filter(t => (t.AssignmentMode || '').toLowerCase() === 'auto').length;
    const byCat = {};
    templates.forEach(t => { const c = t.Category || 'GENERAL'; byCat[c] = (byCat[c] || 0) + 1; });
    return { total, active, withSop, automated, byCat };
  }, [templates]);

  /* Drawer helpers */
  const resetDrawer = () => {
    form.resetFields();
    setPhases([{ title: '', activities: [{ title: '', instructions: '', expectedOutput: '', estimatedMinutes: 15 }] }]);
    setAssignmentMode('manual'); setAutoStrategy('lowest_workload');
    setApprovalLevel('single'); setEscalationHours(24); setQualityScoreRequired(false);
    setActiveTab('overview');
  };

  const openCreate = () => { resetDrawer(); setEditingTemplate(null);
    form.setFieldsValue({ frequency: 'ONE_TIME', priority: 'MEDIUM', category: 'GENERAL', targetType: 'NUMERIC', department: 'Operations', slaHours: 48, tatHours: 24, defaultTarget: 0, isActive: true, reviewRequired: true, criticalityScore: 5, estimatedExecutionMinutes: 30, autoAssign: false, dueTime: '18:00', runDays: [1, 2, 3, 4, 5, 6], assigneeRole: 'brand_manager', brandMode: 'NONE' });
    setNamedAssignees(0);
    setDrawerOpen(true);
  };

  const openEdit = async (record) => {
    setEditingTemplate(record); resetDrawer();
    form.setFieldsValue({
      name: record.Name, description: record.Description, category: record.Category,
      department: record.Department, frequency: record.Frequency, slaHours: record.SLAHours,
      tatHours: record.TATHours, priority: record.Priority, targetType: record.TargetType,
      defaultTarget: record.DefaultTarget, expectedOutput: record.ExpectedOutput, isActive: record.IsActive,
      reviewRequired: record.ReviewRequired, criticalityScore: record.CriticalityScore || 5,
      estimatedExecutionMinutes: record.EstimatedExecutionMinutes || 30,
      autoAssign: !!record.AutoAssign, dueTime: record.DueTime || '18:00',
      runDays: record.RunDays ? String(record.RunDays).split(',').map(Number) : [1, 2, 3, 4, 5, 6],
      assigneeRole: record.AssigneeRole || 'brand_manager', brandMode: record.BrandMode || 'NONE',
    });
    setNamedAssignees((record.AssigneeUserIds || []).length);
    const sop = record.SubTaskDefinitions || record.subTaskDefinitions || [];
    if (sop.length > 0) setPhases(sop.map(p => ({ ...p, title: p.title || '', activities: (p.activities || []).map(a => ({ ...a, title: a.title || '', instructions: a.instructions || '', expectedOutput: a.expectedOutput || '', estimatedMinutes: a.estimatedMinutes || 15 })) })));
    try {
      const dr = await tasksApi.getTemplateDetail(record.Id);
      if (dr.success && dr.data.assignmentRules) {
        const r = dr.data.assignmentRules;
        setAssignmentMode(r.AssignmentMode || 'manual');
        setAutoStrategy(r.AutoAssignStrategy || 'lowest_workload');
        setApprovalLevel(r.ApprovalLevel || 'single');
        setEscalationHours(r.EscalationHours || 24);
        setQualityScoreRequired(!!r.QualityScoreRequired);
      }
    } catch { }
    setDrawerOpen(true);
  };

  const openClone = (r) => {
    setEditingTemplate(null); resetDrawer();
    form.setFieldsValue({ name: `${r.Name} (Copy)`, description: r.Description, category: r.Category, department: r.Department, frequency: r.Frequency, slaHours: r.SLAHours, tatHours: r.TATHours, priority: r.Priority, targetType: r.TargetType, defaultTarget: r.DefaultTarget, expectedOutput: r.ExpectedOutput, isActive: true, reviewRequired: r.ReviewRequired, criticalityScore: r.CriticalityScore || 5, estimatedExecutionMinutes: r.EstimatedExecutionMinutes || 30 });
    const sop = r.SubTaskDefinitions || r.subTaskDefinitions || [];
    if (sop.length > 0) setPhases(sop.map(p => ({ title: p.title || '', activities: (p.activities || []).map(a => ({ ...a })) })));
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      let tid;
      const payload = { ...values, subTaskDefinitions: phases };
      if (editingTemplate) {
        await tasksApi.updateTemplate(editingTemplate.Id, payload); tid = editingTemplate.Id;
        message.success('Template updated');
      } else {
        const res = await tasksApi.createTemplate(payload); tid = res.data?.id;
        message.success('Template created');
      }
      if (tid) {
        await tasksApi.upsertAssignmentRules(tid, { assignmentMode, autoAssignStrategy: autoStrategy, approvalLevel, escalationHours, qualityScoreRequired }).catch(() => { });
      }
      setDrawerOpen(false);
      loadTemplates(pagination.page);
    } catch (err) {
      if (err.errorFields) { setActiveTab('overview'); return; }
      message.error('Save failed — check fields');
    } finally { setSaving(false); }
  };


  /* Deep links: ?new=1 | ?edit=<id> | ?clone=<id> (used by template detail page) */
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

  const handleDelete = async (id) => {
    try { await tasksApi.deleteTemplate(id); message.success('Template deleted'); loadTemplates(pagination.page); }
    catch { message.error('Delete failed'); }
  };

  const handleRunTemplate = (tpl) => {
    // Forward to tasks page with template pre-selected
    navigate(`/tasks/tasks?template=${tpl.Id}&new=1`);
  };

  /* Category chip list */
  const catChips = [
    { key: 'ALL', label: 'All', icon: <AppstoreOutlined /> },
    ...CATEGORIES.map(c => ({ key: c.value, label: c.label, icon: CATEGORY_META[c.value]?.icon, color: CATEGORY_META[c.value]?.color })),
  ];

  const drawerTabItems = [
    { key: 'overview', label: 'Overview', children: (
      <Form form={form} layout="vertical" size="middle">
        <Row gutter={14}>
          <Col span={18}><Form.Item name="name" label="Template name" rules={[{ required: true, message: 'Name is required' }]}><Input placeholder="e.g. BuyBox Loss Recovery" size="large" /></Form.Item></Col>
          <Col span={6}>
            <Form.Item name="isActive" label="Status" valuePropName="checked">
              <Switch checkedChildren="Active" unCheckedChildren="Draft" style={{ marginTop: 4 }} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="description" label="What does this template do?"><TextArea rows={2} placeholder="Describe when this task should be created, who should do it, and what success looks like." /></Form.Item>
        <Row gutter={12}>
          <Col span={8}><Form.Item name="department" label="Department" rules={[{ required: true }]}><Select options={DEPARTMENTS.map(d => ({ value: d.value, label: d.label }))} /></Form.Item></Col>
          <Col span={8}><Form.Item name="category" label="Category"><Select options={CATEGORIES.map(c => ({ value: c.value, label: c.label }))} /></Form.Item></Col>
          <Col span={8}><Form.Item name="frequency" label="Frequency"><Select options={FREQUENCIES.map(f => ({ value: f.value, label: f.label }))} /></Form.Item></Col>
        </Row>
        <Row gutter={12}>
          <Col span={6}><Form.Item name="priority" label="Default priority"><Select options={Object.entries(PRIORITIES).map(([k, v]) => ({ value: k, label: v.label }))} /></Form.Item></Col>
          <Col span={6}><Form.Item name="slaHours" label="SLA (hours)"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={6}><Form.Item name="tatHours" label="TAT (hours)"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={6}><Form.Item name="estimatedExecutionMinutes" label={watchedBrandMode === 'CHECKLIST' ? 'Est. min per brand' : 'Est. time (min)'}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
        </Row>
        {watchedFrequency && watchedFrequency !== 'ONE_TIME' && (
          <div style={{ border: '1px solid var(--bc-border-subtle, #e2e8f0)', borderRadius: 12, padding: '12px 14px', margin: '4px 0 14px', background: 'var(--bc-surface-page, #f8fafc)' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
              <Form.Item name="autoAssign" valuePropName="checked" noStyle><Switch checkedChildren="On" unCheckedChildren="Off" /></Form.Item>
              <div>
                <Text strong>Create this for each person automatically</Text>
                <div><Text type="secondary" style={{ fontSize: 12 }}>A task lands in everyone's My Day on each run day{namedAssignees ? ` — assigned to ${namedAssignees} named ${namedAssignees === 1 ? 'person' : 'people'} from the import` : ''}.</Text></div>
              </div>
            </div>
            <Row gutter={12}>
              <Col span={8}><Form.Item name="assigneeRole" label="Who does it" style={{ marginBottom: 0 }}><Select disabled={namedAssignees > 0} options={[{ value: 'brand_manager', label: 'Brand managers' }, { value: 'operational_manager', label: 'Operational managers' }]} /></Form.Item></Col>
              <Col span={6}><Form.Item name="dueTime" label="Due by (HH:mm)" rules={[{ pattern: /^([01]?\d|2[0-3]):[0-5]\d$/, message: 'Use HH:mm' }]} style={{ marginBottom: 0 }}><Input placeholder="18:00" maxLength={5} /></Form.Item></Col>
              <Col span={10}><Form.Item name="runDays" label="Runs on" style={{ marginBottom: 0 }}><Select mode="multiple" options={['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => ({ value: i, label: d }))} /></Form.Item></Col>
            </Row>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginTop: 12 }}>
              <Form.Item name="brandMode" noStyle getValueProps={v => ({ checked: v === 'CHECKLIST' })} getValueFromEvent={c => (c ? 'CHECKLIST' : 'NONE')}>
                <Switch checkedChildren="Per brand" unCheckedChildren="Once" />
              </Form.Item>
              <div>
                <Text strong>Repeat for each of the person's brands</Text>
                <div><Text type="secondary" style={{ fontSize: 12 }}>Still one task per person — it carries a checklist of their brands, and the time estimate scales with how many they have.</Text></div>
              </div>
            </div>
          </div>
        )}
        <Row gutter={12}>
          <Col span={8}><Form.Item name="targetType" label="Target type"><Select options={TARGET_TYPES.map(t => ({ value: t.value, label: t.label }))} /></Form.Item></Col>
          <Col span={8}><Form.Item name="defaultTarget" label="Default target"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
          <Col span={8}><Form.Item name="reviewRequired" label="Review required" valuePropName="checked"><Switch /></Form.Item></Col>
        </Row>
        <Form.Item name="expectedOutput" label="Expected output"><Input placeholder="e.g. BuyBox recovered within 2 hours, price updated & screenshot saved" /></Form.Item>
      </Form>
    ) },
    { key: 'sop', label: `Playbook (${phases.length} phases)`, children: <SopPhaseBuilder phases={phases} setPhases={setPhases} /> },
    { key: 'assignment', label: 'Assignment & SLA', children: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div>
          <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>Assignment mode</Text>
          <Segmented value={assignmentMode} onChange={setAssignmentMode} block options={[
            { label: <span style={{ padding: '4px 8px' }}><TeamOutlined /> Manual</span>, value: 'manual' },
            { label: <span style={{ padding: '4px 8px' }}><ThunderboltOutlined /> Auto-assign</span>, value: 'auto' },
          ]} />
        </div>
        {assignmentMode === 'auto' && (
          <div>
            <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>Auto-assign strategy</Text>
            <Select value={autoStrategy} onChange={setAutoStrategy} style={{ width: 280 }} options={AUTO_ASSIGN_STRATEGIES} />
          </div>
        )}
        <Divider style={{ margin: 0 }} />
        <div>
          <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>Escalation</Text>
          <Space size={10} align="center">
            <Text>Escalate to manager after</Text>
            <InputNumber value={escalationHours} onChange={setEscalationHours} min={1} max={168} style={{ width: 90 }} />
            <Text>hours of inactivity</Text>
          </Space>
        </div>
        <Divider style={{ margin: 0 }} />
        <div>
          <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>Approval workflow</Text>
          <Segmented value={approvalLevel} onChange={setApprovalLevel} options={APPROVAL_LEVELS.map(a => ({ label: a.label, value: a.value }))} />
          <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <Text style={{ fontSize: 12, color: '#64748b' }}>
              {approvalLevel === 'single' && 'Single approver signs off to close the task — fastest flow for daily operational work.'}
              {approvalLevel === 'dual' && 'Two independent reviewers must approve — best for pricing or compliance changes.'}
              {approvalLevel === 'multi' && 'Chain of approvals across roles — used for launch-gate and launch-critical tasks.'}
            </Text>
          </div>
        </div>
        <Divider style={{ margin: 0 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Switch checked={qualityScoreRequired} onChange={setQualityScoreRequired} />
          <div>
            <Text strong style={{ fontSize: 13, display: 'block' }}>Require AI quality score on submission</Text>
            <Text style={{ fontSize: 11, color: '#94a3b8' }}>Submission is blocked until the AI quality score meets the target.</Text>
          </div>
        </div>
      </div>
    ) },
  ];

  return (
    <div className="tpl-page">
      <div className="tpl-page-inner">

        {/* ═══ HERO ═══ */}
        <div className="tpl-hero">
          <span className="tpl-hero__eyebrow"><StarFilled /> Task Operating System</span>
          <h1 className="tpl-hero__title">Task Templates</h1>
          <p className="tpl-hero__subtitle">
            Standardize how work gets done. Build reusable playbooks with phases, step-by-step SOPs,
            SLAs, auto-assignment and approval gates — then run them as one-off or scheduled tasks.
          </p>
          <div className="tpl-hero__stats">
            <div className="tpl-hero__stat"><div className="tpl-hero__stat-val">{stats.total}</div><div className="tpl-hero__stat-lbl">Templates</div></div>
            <div className="tpl-hero__stat"><div className="tpl-hero__stat-val">{stats.active}</div><div className="tpl-hero__stat-lbl">Active</div></div>
            <div className="tpl-hero__stat"><div className="tpl-hero__stat-val">{stats.withSop}</div><div className="tpl-hero__stat-lbl">With SOP</div></div>
            <div className="tpl-hero__stat"><div className="tpl-hero__stat-val" style={{ color: '#a5f3fc' }}><ThunderboltOutlined /> {stats.automated}</div><div className="tpl-hero__stat-lbl">Auto-assign</div></div>
          </div>
          <div className="tpl-hero__actions">
            <button className="tpl-btn-primary" onClick={openCreate}><PlusOutlined /> New template</button>
            <button className="tpl-btn-ghost" onClick={() => navigate('/tasks/tasks')}><PlayCircleOutlined /> Run tasks</button>
            <button className="tpl-btn-ghost" onClick={() => navigate('/rule-sets')}><BulbOutlined /> Rules that auto-create tasks</button>
          </div>
        </div>

        {/* ═══ CATEGORY CHIPS ═══ */}
        <div className="tpl-cat-chips">
          {catChips.map(c => {
            const count = c.key === 'ALL' ? stats.total : (stats.byCat[c.key] || 0);
            return (
              <div key={c.key} className={`tpl-cat-chip${catFilter === c.key ? ' active' : ''}`} onClick={() => setCatFilter(c.key)}>
                {c.icon}<span>{c.label}</span><span className="tpl-cat-chip__count">{count}</span>
              </div>
            );
          })}
        </div>

        {/* ═══ TOOLBAR ═══ */}
        <div className="tpl-toolbar">
          <Input className="tpl-search" prefix={<SearchOutlined style={{ color: '#94a3b8' }} />} placeholder="Search templates by name, code or description" value={search} onChange={e => setSearch(e.target.value)} allowClear size="middle" style={{ borderRadius: 10 }} />
          <div className="tpl-toolbar-right">
            <Select allowClear placeholder="Frequency" value={freqFilter} onChange={setFreqFilter} style={{ width: 130 }} options={FREQUENCIES} size="middle" />
            <Segmented value={activeOnly ? 'active' : 'all'} onChange={v => setActiveOnly(v === 'active')} options={[
              { label: 'All', value: 'all' },
              { label: 'Active only', value: 'active' },
            ]} size="middle" />
            <Segmented value={viewMode} onChange={setViewMode} options={[
              { label: <span><AppstoreOutlined /> Grid</span>, value: 'grid' },
              { label: <span><BarsOutlined /> Table</span>, value: 'table' },
            ]} size="middle" />
            <Tooltip title="Upload the Daily Operations Master to create the team's routine tasks">
              <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)} size="middle" style={{ borderRadius: 10 }}>Import daily ops</Button>
            </Tooltip>
            <Tooltip title="Create today's tasks now for every daily routine that hasn't run yet (safe to repeat)">
              <Button icon={<ThunderboltOutlined />} loading={generating} onClick={generateToday} size="middle" style={{ borderRadius: 10 }}>Generate today</Button>
            </Tooltip>
            <Button icon={<ReloadOutlined />} onClick={() => loadTemplates(1)} size="middle" style={{ borderRadius: 10 }}>Refresh</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} size="middle" style={{ borderRadius: 10, fontWeight: 700, background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', border: 'none', boxShadow: '0 6px 18px rgba(99,102,241,0.3)' }}>New template</Button>
          </div>
        </div>

        {/* ═══ CONTENT ═══ */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><Spinner /></div>
        ) : templates.length === 0 ? (
          <Card style={{ borderRadius: 20, textAlign: 'center', padding: '40px 0' }}>
            <Empty description={<Text style={{ fontSize: 14, color: '#64748b' }}>No templates match your filters</Text>}>
              <Space>
                <Button onClick={() => { setCatFilter('ALL'); setFreqFilter(null); setSearch(''); setActiveOnly(false); }}>Clear filters</Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Create your first template</Button>
              </Space>
            </Empty>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="tpl-grid">
            {templates.map(tpl => (
              <TemplateCard key={tpl.Id} tpl={tpl} onView={(t) => navigate(`/tasks/templates/${t.Id}`)} onEdit={openEdit} onClone={openClone} onDelete={handleDelete} onCreate={handleRunTemplate} />
            ))}
          </div>
        ) : (
          <Card style={{ borderRadius: 16 }} styles={{ body: { padding: 0 } }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Code', 'Template', 'Category', 'Freq', 'Priority', 'SLA', 'SOP', 'Status', ''].map(h => (
                      <th key={h} style={{ padding: '12px 14px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', textAlign: h === '' ? 'right' : 'left', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {templates.map(tpl => {
                    const m = CATEGORY_META[tpl.Category] || CATEGORY_META.GENERAL;
                    const p = PRIORITIES[tpl.Priority] || PRIORITIES.MEDIUM;
                    const ph = tpl.SubTaskDefinitions || [];
                    return (
                      <tr key={tpl.Id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/tasks/templates/${tpl.Id}`)} className="tpl-table-row">
                        <td style={{ padding: '12px 14px', fontSize: 11, fontFamily: 'monospace', color: '#94a3b8', fontWeight: 700, borderBottom: '1px solid #f1f5f9' }}>{tpl.TaskCode}</td>
                        <td style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9' }}>
                          <Text strong style={{ fontSize: 13, display: 'block' }}>{tpl.Name}</Text>
                          {tpl.Description && <Text style={{ fontSize: 11, color: '#94a3b8', display: 'block', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tpl.Description}</Text>}
                        </td>
                        <td style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9' }}><Tag style={{ background: m.bg, color: m.color, border: 'none', borderRadius: 8, fontSize: 10, fontWeight: 700 }}>{m.label}</Tag></td>
                        <td style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9', fontSize: 11, color: '#64748b' }}>{FREQUENCIES.find(f => f.value === tpl.Frequency)?.label || tpl.Frequency}</td>
                        <td style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9' }}><Tag style={{ background: p.bg, color: p.color, border: 'none', borderRadius: 8, fontSize: 10, fontWeight: 700 }}>{p.label}</Tag></td>
                        <td style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9', fontSize: 11 }}>{tpl.SLAHours}h</td>
                        <td style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9', fontSize: 11 }}>{ph.length > 0 ? `${ph.length} phases` : <Tag style={{ fontSize: 10 }}>No SOP</Tag>}</td>
                        <td style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9' }}>{tpl.IsActive ? <Tag color="success" style={{ borderRadius: 8, fontSize: 10 }}>Active</Tag> : <Tag style={{ borderRadius: 8, fontSize: 10 }}>Draft</Tag>}</td>
                        <td style={{ padding: '8px 14px', borderBottom: '1px solid #f1f5f9', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                          <Space size={0}>
                            <Button type="text" size="small" icon={<PlayCircleOutlined />} onClick={() => handleRunTemplate(tpl)} />
                            <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/tasks/templates/${tpl.Id}`)} />
                            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(tpl)} />
                            <Button type="text" size="small" icon={<CopyOutlined />} onClick={() => openClone(tpl)} />
                            <Popconfirm title="Delete?" onConfirm={() => handleDelete(tpl.Id)}><Button type="text" size="small" danger icon={<DeleteOutlined />} /></Popconfirm>
                          </Space>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ═══ TEMPLATE BUILDER DRAWER ═══ */}
        <Drawer
          title={
            <Space size={10}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>
                {editingTemplate ? <EditOutlined /> : <RocketOutlined />}
              </div>
              <div>
                <Text strong style={{ fontSize: 15, display: 'block' }}>{editingTemplate ? `Edit template · ${editingTemplate.TaskCode}` : 'Create task template'}</Text>
                <Text style={{ fontSize: 11, color: '#94a3b8' }}>{editingTemplate ? 'Update playbook, SOPs and assignment rules' : 'Build a repeatable playbook your team can run on demand'}</Text>
              </div>
            </Space>
          }
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          width={Math.min(1100, window.innerWidth - 40)}
          destroyOnHidden
          styles={{ body: { paddingTop: 4 } }}
          extra={
            <Space>
              <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
              <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving} style={{ borderRadius: 10, fontWeight: 700, background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', border: 'none', boxShadow: '0 6px 16px rgba(99,102,241,0.3)' }}>
                {editingTemplate ? 'Save changes' : 'Create template'}
              </Button>
            </Space>
          }
        >
          <Tabs activeKey={activeTab} onChange={setActiveTab} items={drawerTabItems} size="large" />
        </Drawer>
        <DailyOpsImportModal open={importOpen} onClose={() => setImportOpen(false)} onDone={() => loadTemplates(1)} />

        <style>{`
          .tpl-table-row:hover td { background: #f8fafc; }
        `}</style>
      </div>
    </div>
  );
}
