import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Drawer, Button, Input, Select, Switch, Form, InputNumber, Row, Col, Space,
  Typography, Tag, Tooltip, Divider, Alert, App, Segmented, Steps, Badge, Empty,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, SaveOutlined, ArrowUpOutlined, ArrowDownOutlined,
  CheckCircleFilled, ExclamationCircleFilled, WarningOutlined,
  FileTextOutlined, BookOutlined, ApiOutlined, SafetyCertificateOutlined,
  TeamOutlined, ExperimentOutlined, RocketOutlined, LockOutlined, InfoCircleOutlined,
} from '@ant-design/icons';
import {
  CATEGORIES, DEPARTMENTS, FREQUENCIES, PRIORITIES, TARGET_TYPES,
  APPROVAL_LEVELS, AUTO_ASSIGN_STRATEGIES,
} from '../constants';
import { validateTemplate, templateToPayload } from '../utils/templateValidation';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

/* The six structured sections of the corporate builder. `key` doubles as the
   section-rail id and the validation bucket name. */
export const BUILDER_SECTIONS = [
  { key: 'definition', label: 'Task Definition', icon: <FileTextOutlined />, hint: 'What the task is, who owns it and how often it runs.' },
  { key: 'playbook', label: 'SOP Playbook', icon: <BookOutlined />, hint: 'Phases and step-by-step activities the executor follows.' },
  { key: 'automation', label: 'Data & Automation', icon: <ApiOutlined />, hint: 'Scheduling, data sources and which actions may run automatically.' },
  { key: 'evidence', label: 'Evidence & Acceptance', icon: <SafetyCertificateOutlined />, hint: 'What proof must be attached and what counts as done.' },
  { key: 'assignment', label: 'Assignment & Review', icon: <TeamOutlined />, hint: 'Who does it, who reviews it and when it escalates.' },
  { key: 'review', label: 'Validate & Publish', icon: <ExperimentOutlined />, hint: 'Run the publish checks and choose draft or active.' },
];

const EMPTY_ACTIVITY = () => ({ title: '', instructions: '', expectedOutput: '', estimatedMinutes: 15, evidenceRequired: false, isMandatory: true });
const NEW_PHASE = () => ({ title: '', activities: [EMPTY_ACTIVITY()] });

/* ── SOP editor (phases → activities) ───────────────────────────── */
function SopEditor({ phases, setPhases }) {
  const addPhase = () => setPhases([...phases, NEW_PHASE()]);
  const removePhase = (i) => setPhases(phases.filter((_, idx) => idx !== i));
  const updatePhase = (i, field, val) => { const u = [...phases]; u[i] = { ...u[i], [field]: val }; setPhases(u); };
  const addActivity = (pi) => { const u = [...phases]; u[pi] = { ...u[pi], activities: [...(u[pi].activities || []), EMPTY_ACTIVITY()] }; setPhases(u); };
  const removeActivity = (pi, ai) => { const u = [...phases]; u[pi] = { ...u[pi], activities: u[pi].activities.filter((_, idx) => idx !== ai) }; setPhases(u); };
  const updateActivity = (pi, ai, field, val) => { const u = [...phases]; u[pi] = { ...u[pi], activities: u[pi].activities.map((a, idx) => idx === ai ? { ...a, [field]: val } : a) }; setPhases(u); };
  const movePhase = (i, dir) => {
    const j = i + dir; if (j < 0 || j >= phases.length) return;
    const u = [...phases]; [u[i], u[j]] = [u[j], u[i]]; setPhases(u);
  };
  const moveActivity = (pi, ai, dir) => {
    const acts = [...(phases[pi].activities || [])]; const j = ai + dir;
    if (j < 0 || j >= acts.length) return;
    [acts[ai], acts[j]] = [acts[j], acts[ai]];
    updatePhase(pi, 'activities', acts);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {phases.length === 0 && (
        <Alert type="info" showIcon icon={<InfoCircleOutlined />} message="No phases yet" description="Add at least one phase with a step-by-step activity before this template can be published. Alternative methods (e.g. Brand Central vs RetailOps vs Vendor Central checks) belong as steps or fallback notes inside one activity — not as separate mandatory tasks." />
      )}
      {phases.map((phase, pi) => {
        const acts = phase.activities || [];
        const mins = acts.reduce((s, a) => s + (a.estimatedMinutes || 0), 0);
        return (
          <div key={pi} className="sop-phase" data-testid={`phase-${pi}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, paddingLeft: 10 }}>
              <Tag style={{ margin: 0, fontWeight: 700, fontFamily: 'var(--bc-font-mono, Menlo, monospace)', fontSize: 10, borderRadius: 8, background: 'var(--bc-ro-500, #1976D2)', color: '#fff', border: 'none', padding: '3px 9px' }}>PHASE {pi + 1}</Tag>
              <Input value={phase.title} onChange={e => updatePhase(pi, 'title', e.target.value)} placeholder="Phase name (e.g. Detect out-of-stock)" size="small" style={{ flex: 1, fontWeight: 600, fontSize: 13 }} />
              <Tag style={{ margin: 0, fontSize: 10, background: 'var(--bc-surface-subtle, #f1f5f9)', color: '#64748b', borderRadius: 6 }}>{mins} min</Tag>
              <Tooltip title="Move up"><Button type="text" size="small" icon={<ArrowUpOutlined />} disabled={pi === 0} onClick={() => movePhase(pi, -1)} /></Tooltip>
              <Tooltip title="Move down"><Button type="text" size="small" icon={<ArrowDownOutlined />} disabled={pi === phases.length - 1} onClick={() => movePhase(pi, 1)} /></Tooltip>
              {phases.length > 1 && <Button type="text" danger size="small" icon={<DeleteOutlined />} aria-label="Remove phase" onClick={() => removePhase(pi)} />}
            </div>
            {acts.map((act, ai) => (
              <div key={ai} className="sop-step">
                <div className="sop-step__num">{ai + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Input value={act.title} onChange={e => updateActivity(pi, ai, 'title', e.target.value)} placeholder="Activity title..." size="small" style={{ fontWeight: 600, fontSize: 12, marginBottom: 4 }} />
                  <TextArea value={act.instructions} onChange={e => updateActivity(pi, ai, 'instructions', e.target.value)} placeholder="Step-by-step instructions the employee follows..." rows={2} size="small" style={{ fontSize: 12 }} />
                  <Row gutter={8} style={{ marginTop: 6 }} align="middle">
                    <Col span={11}><Input value={act.expectedOutput} onChange={e => updateActivity(pi, ai, 'expectedOutput', e.target.value)} placeholder="Expected output / completion criterion" size="small" style={{ fontSize: 11 }} /></Col>
                    <Col span={6}><InputNumber value={act.estimatedMinutes} onChange={v => updateActivity(pi, ai, 'estimatedMinutes', v)} min={1} placeholder="Min" style={{ width: '100%' }} size="small" /></Col>
                    <Col span={4}>
                      <Tooltip title="Evidence must be attached to complete this step">
                        <Space size={4}><Switch size="small" checked={!!act.evidenceRequired} onChange={v => updateActivity(pi, ai, 'evidenceRequired', v)} /><Text style={{ fontSize: 10, color: '#64748b' }}>Evidence</Text></Space>
                      </Tooltip>
                    </Col>
                    <Col span={3} style={{ textAlign: 'right' }}>
                      <Space size={0}>
                        <Button type="text" size="small" icon={<ArrowUpOutlined />} disabled={ai === 0} aria-label="Move step up" onClick={() => moveActivity(pi, ai, -1)} />
                        <Button type="text" size="small" icon={<ArrowDownOutlined />} disabled={ai === acts.length - 1} aria-label="Move step down" onClick={() => moveActivity(pi, ai, 1)} />
                        {acts.length > 1 && <Button type="text" danger size="small" icon={<DeleteOutlined />} aria-label="Remove step" onClick={() => removeActivity(pi, ai)} />}
                      </Space>
                    </Col>
                  </Row>
                </div>
              </div>
            ))}
            <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => addActivity(pi)} block style={{ marginTop: 6, borderRadius: 8 }}>
              Add step
            </Button>
          </div>
        );
      })}
      <Button type="dashed" icon={<PlusOutlined />} onClick={addPhase} block style={{ borderRadius: 10, height: 40, fontWeight: 600 }}>+ Add Phase</Button>
    </div>
  );
}

/* ── Section rail with live validation status ───────────────────── */
function SectionRail({ active, onSelect, statusBySection }) {
  return (
    <nav aria-label="Builder sections" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {BUILDER_SECTIONS.map((s, i) => {
        const st = statusBySection[s.key] || { state: 'ok', count: 0 };
        const icon = st.state === 'error'
          ? <ExclamationCircleFilled style={{ color: 'var(--bc-red-500, #dc2626)' }} />
          : st.state === 'warn'
            ? <WarningOutlined style={{ color: 'var(--bc-amber-500, #d97706)' }} />
            : <CheckCircleFilled style={{ color: 'var(--bc-green-500, #16a34a)' }} />;
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onSelect(s.key)}
            aria-current={active === s.key ? 'step' : undefined}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', cursor: 'pointer',
              padding: '9px 12px', borderRadius: 8, border: '1px solid',
              borderColor: active === s.key ? 'var(--bc-border-brand, #93c5fd)' : 'transparent',
              background: active === s.key ? 'var(--bc-primary-50, #eff6ff)' : 'transparent',
              color: 'inherit', font: 'inherit', width: '100%',
            }}
          >
            <span style={{ fontSize: 15, color: 'var(--bc-text-secondary, #64748b)' }}>{s.icon}</span>
            <span style={{ flex: 1, fontSize: 12.5, fontWeight: active === s.key ? 700 : 500 }}>
              <span style={{ color: 'var(--bc-text-muted, #94a3b8)', fontFamily: 'var(--bc-font-mono, monospace)', fontSize: 10, marginRight: 6 }}>{String(i + 1).padStart(2, '0')}</span>
              {s.label}
            </span>
            <Tooltip title={st.state === 'error' ? `${st.count} issue${st.count === 1 ? '' : 's'}` : st.state === 'warn' ? 'Warnings only' : 'Complete'}>{icon}</Tooltip>
          </button>
        );
      })}
    </nav>
  );
}

/* ── Live preview panel ─────────────────────────────────────────── */
function PreviewPanel({ values, phases }) {
  const cat = CATEGORIES.find(c => c.value === values.category);
  const freq = FREQUENCIES.find(f => f.value === values.frequency);
  const phasesCount = phases.length;
  const steps = phases.reduce((s, p) => s + (p.activities?.length || 0), 0);
  const mins = phases.reduce((s, p) => s + (p.activities?.reduce((a, x) => a + (x.estimatedMinutes || 0), 0) || 0), 0);
  return (
    <aside aria-label="Template preview" style={{ border: '1px solid var(--bc-border-default, #e2e8f0)', borderRadius: 12, padding: 16, background: 'var(--bc-surface-card, #fff)' }}>
      <Text style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--bc-text-muted, #94a3b8)' }}>Preview</Text>
      <h4 style={{ margin: '8px 0 4px', fontSize: 15 }}>{values.name || 'Untitled task template'}</h4>
      <Text style={{ fontFamily: 'var(--bc-font-mono, monospace)', fontSize: 12, color: 'var(--bc-ro-600, #1565c0)' }}>{values.taskCode || '—'}</Text>
      <Paragraph style={{ fontSize: 12, color: 'var(--bc-text-secondary, #64748b)', marginTop: 8, marginBottom: 12 }}>{values.description || 'No description yet.'}</Paragraph>
      <Space wrap size={4}>
        {cat && <Tag color="blue" style={{ fontSize: 10 }}>{cat.label}</Tag>}
        {freq && <Tag style={{ fontSize: 10 }}>{freq.label}</Tag>}
        {values.priority && <Tag style={{ fontSize: 10 }}>{PRIORITIES[values.priority]?.label || values.priority}</Tag>}
        {values.isActive ? <Tag color="success" style={{ fontSize: 10 }}>Active</Tag> : <Tag style={{ fontSize: 10 }}>Draft</Tag>}
      </Space>
      <Divider style={{ margin: '12px 0' }} />
      <Row gutter={8}>
        <Col span={8}><Stat val={phasesCount} lbl="Phases" /></Col>
        <Col span={8}><Stat val={steps} lbl="Steps" /></Col>
        <Col span={8}><Stat val={`${mins}m`} lbl="Est. time" /></Col>
      </Row>
    </aside>
  );
}
const Stat = ({ val, lbl }) => (
  <div><div style={{ fontSize: 18, fontWeight: 700, color: 'var(--bc-text-heading, #0f172a)' }}>{val}</div><div style={{ fontSize: 10, color: 'var(--bc-text-muted, #94a3b8)' }}>{lbl}</div></div>
);

/* ── Main builder ───────────────────────────────────────────────── */
export default function TemplateBuilder({ open, editingTemplate, onClose, onSaved }) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [active, setActive] = useState('definition');
  const [phases, setPhases] = useState([NEW_PHASE()]);
  const [assignmentMode, setAssignmentMode] = useState('manual');
  const [autoStrategy, setAutoStrategy] = useState('lowest_workload');
  const [approvalLevel, setApprovalLevel] = useState('single');
  const [escalationHours, setEscalationHours] = useState(24);
  const [qualityScoreRequired, setQualityScoreRequired] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [touched, setTouched] = useState(false);
  const initialRef = useRef(null);

  const watched = Form.useWatch([], form); // whole form
  // A clone arrives with Id:null — it must create, not update.
  const isEdit = !!editingTemplate?.Id;

  /* Seed the form when the drawer opens / target changes. Resetting editor
     state to match the outward event (drawer open / different template) is the
     intended use of an effect here — this repo already suppresses the same rule
     in TaskTemplatesPage. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return;
    const base = editingTemplate ? {
      taskCode: editingTemplate.TaskCode, name: editingTemplate.Name, description: editingTemplate.Description,
      category: editingTemplate.Category, department: editingTemplate.Department, priority: editingTemplate.Priority,
      frequency: editingTemplate.Frequency, slaHours: editingTemplate.SLAHours, tatHours: editingTemplate.TATHours,
      targetType: editingTemplate.TargetType, defaultTarget: editingTemplate.DefaultTarget,
      expectedOutput: editingTemplate.ExpectedOutput, reviewRequired: !!editingTemplate.ReviewRequired,
      criticalityScore: editingTemplate.CriticalityScore || 5,
      estimatedExecutionMinutes: editingTemplate.EstimatedExecutionMinutes || 30,
      autoAssign: !!editingTemplate.AutoAssign, dueTime: editingTemplate.DueTime || '18:00',
      runDays: editingTemplate.RunDays ? String(editingTemplate.RunDays).split(',').map(Number) : [1, 2, 3, 4, 5, 6],
      assigneeRole: editingTemplate.AssigneeRole || 'brand_manager', brandMode: editingTemplate.BrandMode || 'NONE',
      isActive: !!editingTemplate.IsActive,
    } : {
      frequency: 'ONE_TIME', priority: 'MEDIUM', category: 'GENERAL', targetType: 'NUMERIC',
      department: 'Operations', slaHours: 48, tatHours: 24, defaultTarget: 0, isActive: false,
      reviewRequired: true, criticalityScore: 5, estimatedExecutionMinutes: 30, autoAssign: false,
      dueTime: '18:00', runDays: [1, 2, 3, 4, 5, 6], assigneeRole: 'brand_manager', brandMode: 'NONE',
    };
    form.setFieldsValue(base);
    setActive('definition');
    setAssignmentMode('manual'); setAutoStrategy('lowest_workload');
    setApprovalLevel('single'); setEscalationHours(24); setQualityScoreRequired(false);
    const sop = editingTemplate?.SubTaskDefinitions || [];
    setPhases(sop.length ? sop.map(p => ({ ...p, activities: (p.activities || []).map(a => ({ ...EMPTY_ACTIVITY(), ...a })) })) : [NEW_PHASE()]);
    setDirty(false); setTouched(false);
    initialRef.current = JSON.stringify(base);
    // Load existing assignment rules without clobbering a just-opened editor.
    if (isEdit) {
      let cancelled = false;
      import('../services/tasksApi').then(({ default: api }) => api.getTemplateDetail(editingTemplate.Id))
        .then(dr => {
          if (cancelled) return;
          const r = dr?.data?.assignmentRules;
          if (r) {
            setAssignmentMode(r.AssignmentMode || 'manual');
            setAutoStrategy(r.AutoAssignStrategy || 'lowest_workload');
            setApprovalLevel(r.ApprovalLevel || 'single');
            setEscalationHours(r.EscalationHours ?? 24);
            setQualityScoreRequired(!!r.QualityScoreRequired);
          }
        }).catch(() => {});
      return () => { cancelled = true; };
    }
  }, [open, editingTemplate]); // eslint-disable-line
  /* eslint-enable react-hooks/set-state-in-effect */

  /* Track unsaved changes. */
  useEffect(() => {
    if (!open || !initialRef.current) return;
    const current = JSON.stringify(form.getFieldsValue());
    setDirty(current !== initialRef.current || touched);
  }, [watched, phases, assignmentMode, autoStrategy, approvalLevel, escalationHours, qualityScoreRequired, open, touched]); // eslint-disable-line

  const markTouched = () => setTouched(true);

  const validation = useMemo(() => {
    const values = form.getFieldsValue();
    const payload = templateToPayload({ ...values, isActive: false }, phases);
    return validateTemplate(payload, { approvalLevel, escalationHours });
  }, [watched, phases, approvalLevel, escalationHours]); // eslint-disable-line

  const statusBySection = useMemo(() => {
    const map = {};
    for (const s of BUILDER_SECTIONS) map[s.key] = { state: 'ok', count: 0 };
    const bucket = (field) =>
      (field === 'sop' || String(field).startsWith('sop.')) ? 'playbook'
        : ['name', 'taskCode', 'category', 'priority', 'frequency', 'schedule', 'department'].includes(field) ? 'definition'
          : ['approvalLevel', 'escalationHours'].includes(field) ? 'assignment' : 'automation';
    for (const e of validation.errors) { const b = bucket(e.field); map[b].state = 'error'; map[b].count++; }
    if (map.review.state !== 'error' && validation.errors.length === 0) map.review.state = 'ok';
    if (map.playbook.state === 'ok' && phases.length === 0) { map.playbook.state = 'error'; map.playbook.count = 1; }
    return map;
  }, [validation, phases]);

  const handleSave = async ({ publish }) => {
    try {
      const values = await form.validateFields();
      markTouched();
      const template = templateToPayload({ ...values, isActive: publish ? true : values.isActive }, phases);
      const assignmentRules = { assignmentMode, autoAssignStrategy: autoStrategy, approvalLevel, escalationHours, qualityScoreRequired };

      // Local pre-flight so we never round-trip an obviously invalid publish.
      if (publish) {
        const v = validateTemplate({ ...template, isActive: true }, assignmentRules);
        if (!v.ok) {
          message.error(`Cannot publish: ${v.errors[0].message}${v.errors.length > 1 ? ` (+${v.errors.length - 1} more)` : ''}`);
          setActive((v.errors[0].field.startsWith('sop') ? 'playbook' : 'definition'));
          return;
        }
      }

      setSaving(true);
      const { default: api } = await import('../services/tasksApi');
      // "Save & activate" forces Active; "Save draft" honours the status switch
      // on the Validate & Publish section (a draft must never silently publish).
      const res = await api.saveTemplateConfig({
        id: isEdit ? editingTemplate.Id : undefined,
        template: { ...template, isActive: publish ? true : !!values.isActive },
        assignmentRules,
      });
      message.success(isEdit ? 'Template saved' : 'Template created');
      setDirty(false);
      onSaved?.(res.data);
    } catch (err) {
      if (err?.errorFields) {
        message.error('Some required fields are missing — check the highlighted sections.');
        const firstField = err.errorFields[0]?.name?.[0];
        if (firstField) setActive(['name', 'taskCode', 'category', 'priority', 'frequency', 'department'].includes(firstField) ? 'definition' : 'automation');
        return;
      }
      if (err?.validation?.errors?.length) {
        message.error(err.validation.errors[0].message);
        return;
      }
      message.error(err?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const closeGuard = () => {
    if (dirty && !saving) {
      // AntD Drawer has no built-in confirm; use the imperative modal via App.
      const confirmed = window.confirm('You have unsaved changes. Close without saving?');
      if (!confirmed) return;
    }
    onClose?.();
  };

  const values = form.getFieldsValue();

  return (
    <Drawer
      title={
        <Space size={10}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--bc-ro-500, #1976D2)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>
            {isEdit ? <ExperimentOutlined /> : <RocketOutlined />}
          </div>
          <div>
            <Text strong style={{ fontSize: 15, display: 'block' }}>{isEdit ? `Edit template · ${editingTemplate.TaskCode}` : 'New task template'}</Text>
            <Text style={{ fontSize: 11, color: 'var(--bc-text-muted, #94a3b8)' }}>{dirty ? 'Unsaved changes' : 'All changes saved'}</Text>
          </div>
        </Space>
      }
      open={open}
      onClose={closeGuard}
      width={Math.min(1180, typeof window !== 'undefined' ? window.innerWidth - 40 : 1100)}
      maskClosable={!dirty}
      destroyOnHidden
      styles={{ body: { paddingTop: 8 } }}
      extra={
        <Space>
          <Button onClick={closeGuard}>Cancel</Button>
          <Button icon={<SaveOutlined />} onClick={() => handleSave({ publish: false })} loading={saving} data-testid="save-draft">Save draft</Button>
          <Button type="primary" icon={<RocketOutlined />} onClick={() => handleSave({ publish: true })} loading={saving} disabled={!validation.ok} data-testid="publish">Save &amp; activate</Button>
        </Space>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(190px, 220px) 1fr minmax(240px, 300px)', gap: 20, alignItems: 'start' }} className="tpl-builder-grid">
        <SectionRail active={active} onSelect={setActive} statusBySection={statusBySection} />

        <div style={{ minWidth: 0 }}>
          <Form form={form} layout="vertical" size="middle" onFieldsChange={markTouched}>
            {active === 'definition' && (
              <div data-testid="section-definition">
                <SectionHeader title="Task Definition" hint="Identity, ownership and schedule." />
                <Row gutter={14}>
                  <Col span={16}><Form.Item name="name" label="Task name" rules={[{ required: true, message: 'Name is required' }]}><Input placeholder="e.g. OOS Data Monitoring" size="large" /></Form.Item></Col>
                  <Col span={8}><Form.Item name="taskCode" label="Task code" tooltip="Unique short code, e.g. DLY-004"><Input placeholder="DLY-004" /></Form.Item></Col>
                </Row>
                <Form.Item name="description" label="Business objective / description"><TextArea rows={2} placeholder="When is this run, who does it and what outcome does it protect?" /></Form.Item>
                <Row gutter={12}>
                  <Col span={8}><Form.Item name="department" label="Department" rules={[{ required: true }]}><Select options={DEPARTMENTS} /></Form.Item></Col>
                  <Col span={8}><Form.Item name="category" label="Category" rules={[{ required: true }]}><Select options={CATEGORIES} /></Form.Item></Col>
                  <Col span={8}><Form.Item name="frequency" label="Frequency"><Select options={FREQUENCIES} /></Form.Item></Col>
                </Row>
                <Row gutter={12}>
                  <Col span={6}><Form.Item name="priority" label="Priority"><Select options={Object.entries(PRIORITIES).map(([k, v]) => ({ value: k, label: v.label }))} /></Form.Item></Col>
                  <Col span={6}><Form.Item name="slaHours" label="SLA (hours)"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
                  <Col span={6}><Form.Item name="tatHours" label="TAT (hours)"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
                  <Col span={6}><Form.Item name="estimatedExecutionMinutes" label="Est. time (min)"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
                </Row>
                <Form.Item name="expectedOutput" label="Expected business outcome"><Input placeholder="e.g. Every OOS ASIN logged with a replenishment owner within the day" /></Form.Item>
              </div>
            )}

            {active === 'playbook' && (
              <div data-testid="section-playbook">
                <SectionHeader title="SOP Playbook" hint="Exact steps the employee follows, with expected outputs." />
                <Alert type="info" showIcon style={{ marginBottom: 12 }} message="Alternative methods are fallbacks, not separate tasks"
                  description="If the same check can be done in Brand Central, RetailOps or Vendor Central, capture them as steps or notes inside one activity. Do not create three mandatory tasks for one outcome." />
                <SopEditor phases={phases} setPhases={(p) => { setPhases(p); markTouched(); }} />
              </div>
            )}

            {active === 'automation' && (
              <div data-testid="section-automation">
                <SectionHeader title="Data & Automation" hint="Scheduling, data sources and permitted automatic actions." />
                <Alert type="warning" showIcon icon={<LockOutlined />} style={{ marginBottom: 12 }}
                  message="External and business-changing automation is off by default"
                  description="RetailOps will not message sellers, change prices or classify stock automatically until an authorised policy is approved. These switches describe intent; they do not enable live effects." />
                <Row gutter={12}>
                  <Col span={12}><Form.Item name="targetType" label="Data source / target type"><Select options={TARGET_TYPES} /></Form.Item></Col>
                  <Col span={12}><Form.Item name="defaultTarget" label="Default target"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
                </Row>
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item name="autoAssign" label="Create a task instance for each assignee automatically" valuePropName="checked" tooltip="Scheduling: when and for whom an instance is generated.">
                      <Switch checkedChildren="On" unCheckedChildren="Off" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="brandMode" label="Repeat checklist for each brand" valuePropName="checked" getValueProps={v => ({ checked: v === 'CHECKLIST' })} getValueFromEvent={c => (c ? 'CHECKLIST' : 'NONE')}>
                      <Switch checkedChildren="Per brand" unCheckedChildren="Once" />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={12}>
                  <Col span={8}><Form.Item name="dueTime" label="Due by (HH:mm)" rules={[{ pattern: /^([01]?\d|2[0-3]):[0-5]\d$/, message: 'Use HH:mm' }]}><Input placeholder="12:00" maxLength={5} /></Form.Item></Col>
                  <Col span={16}><Form.Item name="runDays" label="Runs on"><Select mode="multiple" options={['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => ({ value: i, label: d }))} /></Form.Item></Col>
                </Row>
                <div style={{ border: '1px solid var(--bc-border-default, #e2e8f0)', borderRadius: 10, padding: '10px 14px', background: 'var(--bc-surface-page, #f8fafc)' }}>
                  <Text style={{ fontSize: 12, color: 'var(--bc-text-secondary, #64748b)' }}>
                    <InfoCircleOutlined /> Action automation (auto-classify OOS, notify sellers, auto-close incidents) and human-authorisation gates are configured by policy, not here. Missing inventory data is never treated as zero stock.
                  </Text>
                </div>
              </div>
            )}

            {active === 'evidence' && (
              <div data-testid="section-evidence">
                <SectionHeader title="Evidence & Acceptance" hint="What proof must exist before an activity counts as done." />
                <Alert type="info" showIcon style={{ marginBottom: 12 }}
                  message="Evidence requirements are set per activity"
                  description="Toggle “Evidence” on any activity in the SOP Playbook to require an attachment (screenshot, exported report or data snapshot) before it can be completed. A manually ticked activity cannot bypass a required evidence gate." />
                <EvidenceSummary phases={phases} />
              </div>
            )}

            {active === 'assignment' && (
              <div data-testid="section-assignment">
                <SectionHeader title="Assignment & Review" hint="Who executes, who reviews and escalation rules." />
                <div>
                  <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>Assignment mode</Text>
                  <Segmented value={assignmentMode} onChange={(v) => { setAssignmentMode(v); markTouched(); }} block options={[
                    { label: <span style={{ padding: '4px 8px' }}><TeamOutlined /> Manual</span>, value: 'manual' },
                    { label: <span style={{ padding: '4px 8px' }}><RocketOutlined /> Auto-assign</span>, value: 'auto' },
                  ]} />
                </div>
                {assignmentMode === 'auto' && (
                  <div style={{ marginTop: 14 }}>
                    <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>Auto-assign strategy</Text>
                    <Select value={autoStrategy} onChange={(v) => { setAutoStrategy(v); markTouched(); }} style={{ width: 280 }} options={AUTO_ASSIGN_STRATEGIES} />
                  </div>
                )}
                <div style={{ marginTop: 14 }}>
                  <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>Review</Text>
                  <Form.Item name="reviewRequired" label="Review required before the task closes" valuePropName="checked" style={{ marginBottom: 8 }}><Switch /></Form.Item>
                  <Text style={{ fontSize: 11, color: 'var(--bc-text-muted, #94a3b8)' }}>The assigned executor cannot approve their own task. Reviewers and approvers must be different people.</Text>
                </div>
                <Divider style={{ margin: '14px 0' }} />
                <div>
                  <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>Escalation</Text>
                  <Space size={10} align="center">
                    <Text>Escalate after</Text>
                    <InputNumber value={escalationHours} onChange={(v) => { setEscalationHours(v); markTouched(); }} min={1} max={168} style={{ width: 90 }} />
                    <Text>hours of inactivity</Text>
                  </Space>
                </div>
                <Divider style={{ margin: '14px 0' }} />
                <div>
                  <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>Approval policy</Text>
                  <Segmented value={approvalLevel} onChange={(v) => { setApprovalLevel(v); markTouched(); }} options={APPROVAL_LEVELS.map(a => ({ label: a.label, value: a.value }))} />
                  {approvalLevel !== 'single' && (
                    <Alert type="warning" showIcon style={{ marginTop: 10 }} message="Dual/multi approval is stored but not yet enforced"
                      description="The workflow engine currently enforces a single approver. Publishing a template as dual/multi would overstate the guarantee, so it is recorded as a warning until enforcement and tests land." />
                  )}
                </div>
              </div>
            )}

            {active === 'review' && (
              <div data-testid="section-review">
                <SectionHeader title="Validate & Publish" hint="Confirm the configuration before it becomes schedulable." />
                <Form.Item name="isActive" label="Status" valuePropName="checked">
                  <Segmented options={[{ label: 'Draft', value: false }, { label: 'Active', value: true }]} />
                </Form.Item>
                <ValidationReport validation={validation} />
              </div>
            )}
          </Form>
        </div>

        <PreviewPanel values={values} phases={phases} />
      </div>
    </Drawer>
  );
}

const SectionHeader = ({ title, hint }) => (
  <div style={{ marginBottom: 14 }}>
    <h3 style={{ margin: 0, fontSize: 17 }}>{title}</h3>
    <Text style={{ fontSize: 12, color: 'var(--bc-text-muted, #94a3b8)' }}>{hint}</Text>
  </div>
);

const EvidenceSummary = ({ phases }) => {
  const rows = [];
  phases.forEach((p, pi) => (p.activities || []).forEach((a, ai) => {
    if (a.evidenceRequired) rows.push({ phase: p.title || `Phase ${pi + 1}`, act: a.title || `Activity ${ai + 1}` });
  }));
  if (rows.length === 0) return <Empty description="No evidence is required yet. Toggle it on individual activities in the SOP Playbook." />;
  return (
    <div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', border: '1px solid var(--bc-border-subtle, #e2e8f0)', borderRadius: 8, marginBottom: 6 }}>
          <SafetyCertificateOutlined style={{ color: 'var(--bc-green-600, #16a34a)' }} />
          <Text style={{ fontSize: 12 }}><b>{r.phase}</b> → {r.act}</Text>
        </div>
      ))}
    </div>
  );
};

const ValidationReport = ({ validation }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    {validation.ok && validation.warnings.length === 0 && (
      <Alert type="success" showIcon icon={<CheckCircleFilled />} message="Ready to publish" description="All critical checks passed. This template can be activated and scheduled." />
    )}
    {validation.errors.length > 0 && (
      <Alert type="error" showIcon icon={<ExclamationCircleFilled />} message={`${validation.errors.length} blocking issue${validation.errors.length === 1 ? '' : 's'}`}
        description={<ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{validation.errors.map((e, i) => <li key={i} style={{ fontSize: 12 }}>{e.message}</li>)}</ul>} />
    )}
    {validation.warnings.length > 0 && (
      <Alert type="warning" showIcon icon={<WarningOutlined />} message={`${validation.warnings.length} warning${validation.warnings.length === 1 ? '' : 's'}`}
        description={<ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{validation.warnings.map((w, i) => <li key={i} style={{ fontSize: 12 }}>{w.message}</li>)}</ul>} />
    )}
    <Steps direction="vertical" size="small" current={validation.ok ? 2 : 1} items={[
      { title: 'Configuration complete', status: validation.ok ? 'finish' : 'process' },
      { title: 'Publish checks', description: 'Identity, SOP, schedule, evidence and approval rules', status: validation.ok ? 'finish' : validation.errors.length ? 'error' : 'process' },
      { title: 'Active & schedulable', status: validation.ok ? 'finish' : 'wait' },
    ]} />
  </div>
);
