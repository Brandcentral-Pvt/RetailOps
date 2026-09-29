import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button, Input, Select, Space, Tag, Tooltip, Card, Switch, Typography,
  InputNumber, Drawer, Modal, Badge, Divider, Spin, Empty, Popconfirm,
  Segmented, message as antdMessage
} from 'antd';
import { rulesetApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import {
  ATTRIBUTES_BY_TYPE, OPERATORS, DATE_RANGES, EXCLUDE_OPTIONS,
  FREQUENCY_OPTIONS, TIME_OPTIONS
} from '../constants/rulesetAttributes';
import { ACTIONS_BY_TYPE, TASK_PRIORITIES, GROUP_BY_OPTIONS, SOP_PRESETS } from '../constants/rulesetActions';
import {
  ArrowLeft, Plus, Trash2, GripVertical, PlayCircle, PauseCircle,
  Copy, Clock, CheckCircle2, AlertTriangle, Tag as TagIcon, Mail,
  Bell, Eye, ChevronUp, ChevronDown, Settings, ChevronRight,
  Zap, Shield, Activity, Calendar, MoreHorizontal, SlidersHorizontal
} from 'lucide-react';
import '../styles/ruleset-builder.css';

const { Text, Title } = Typography;

const RULESET_TYPES = [
  { value: 'ASIN', label: 'ASIN Operations', icon: <Activity size={13} />, description: 'Rules for managing individual ASINs' },
];

const initialRule = (order) => ({
  order,
  name: `Rule ${order + 1}`,
  isActive: true,
  conditions: [{ attribute: '', operator: '>', value: '', value2: '', logicalOp: 'AND' }],
  action: { actionType: 'create_task', value: '' }
});

const RulesetBuilderPage = () => {
  const { id: rulesetId } = useParams();
  const navigate = useNavigate();
  const { user: _user } = useAuth();
  const [messageApi, msgCtx] = antdMessage.useMessage();

  const [loading, setLoading] = useState(!!rulesetId);
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState(false);

  const [ruleset, setRuleset] = useState({
    name: '',
    description: '',
    type: 'ASIN',
    sellerId: '',
    rules: [initialRule(0)],
    usingDataFrom: 'Last 14 days',
    excludeDays: 'Latest day',
    isActive: true,
    isAutomated: false,
    runFrequency: 'Daily',
    runTime: '08 AM',
    scope: { applyTo: 'all' },
    emailOnRun: false,
    emailAddress: '',
  });

  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [executionHistory, setExecutionHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!rulesetId) return;
    setHistoryLoading(true);
    try {
      const res = await rulesetApi.getHistory(rulesetId);
      setExecutionHistory(res.data?.logs || res.data || []);
    } catch (_e) { console.error(_e); }
    finally { setHistoryLoading(false); }
  }, [rulesetId]);

  useEffect(() => {
    if (rulesetId) {
      setLoading(true);
      rulesetApi.getById(rulesetId).then(res => {
        if (res.success && res.data) {
          const d = res.data;
          if (Array.isArray(d.rules)) {
            // rules used directly
} else {
            try { JSON.parse(d.rules || '[]'); } catch (_e) { void _e; }
          }
          setRuleset({
            name: d.name || '',
            description: d.description || '',
            type: d.type || 'ASIN',
            sellerId: d.sellerId || '',
            rules: Array.isArray(d.rules) && d.rules.length > 0 ? d.rules : (() => { try { return JSON.parse(d.rules || '[]'); } catch { return []; } })(),
            usingDataFrom: d.usingDataFrom || 'Last 14 days',
            excludeDays: d.excludeDays || 'Latest day',
            isActive: d.isActive !== undefined ? d.isActive : true,
            isAutomated: d.isAutomated || false,
            runFrequency: d.runFrequency || 'Daily',
            runTime: d.runTime || '08 AM',
            scope: d.scope || { applyTo: 'all' },
            emailOnRun: d.emailOnRun || false,
            emailAddress: d.emailEmailAddress || '',
          });
        }
      }).catch(() => messageApi.error('Failed to load ruleset'))
        .finally(() => setLoading(false));
    }
  }, [rulesetId, messageApi]);

  const handleSave = useCallback(async () => {
    if (!ruleset.name.trim()) { messageApi.warning('Please enter a ruleset name'); return; }
    if (ruleset.rules.length === 0) { messageApi.warning('Add at least one rule'); return; }
    for (const rule of ruleset.rules) {
      if (!rule.conditions.some(c => c.attribute)) { messageApi.warning(`Rule "${rule.name}" has no conditions`); return; }
      if (!rule.action?.actionType) { messageApi.warning(`Rule "${rule.name}" has no action`); return; }
    }

    setSaving(true);
    try {
      const data = {
        name: ruleset.name,
        description: ruleset.description,
        type: ruleset.type,
        sellerId: ruleset.sellerId || undefined,
        rules: JSON.stringify(ruleset.rules),
        usingDataFrom: ruleset.usingDataFrom,
        excludeDays: ruleset.excludeDays,
        isActive: ruleset.isActive,
        isAutomated: ruleset.isAutomated,
        runFrequency: ruleset.runFrequency,
        runTime: ruleset.runTime,
        scope: JSON.stringify(ruleset.scope),
        emailOnRun: ruleset.emailOnRun,
        emailAddress: ruleset.emailAddress,
      };
      if (rulesetId) {
        await rulesetApi.update(rulesetId, data);
        messageApi.success('Ruleset updated');
      } else {
        const res = await rulesetApi.create(data);
        messageApi.success('Ruleset created');
        if (res.data?._id || res.data?.id) {
          navigate(`/rule-sets/${res.data._id || res.data.id}`, { replace: true });
        }
      }
    } catch (_e) {
      messageApi.error(_e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [ruleset, rulesetId, messageApi, navigate]);

  const handleExecute = useCallback(async () => {
    if (!rulesetId) { messageApi.warning('Save the ruleset first'); return; }
    setExecuting(true);
    try {
      const res = await rulesetApi.execute(rulesetId);
      const s = res.data?.summary || {};
      messageApi.success(`Executed: ${s.totalMatched || 0} matched, ${s.totalActioned || 0} actioned`);
      loadHistory();
    } catch (_e) {
      messageApi.error(_e.message || 'Execution failed');
    } finally {
      setExecuting(false);
    }
}, [rulesetId, messageApi, loadHistory]);

  const handleToggle = useCallback(async () => {
    if (!rulesetId) return;
    try {
      await rulesetApi.toggle(rulesetId);
      setRuleset(prev => ({ ...prev, isActive: !prev.isActive }));
      messageApi.success(`Ruleset ${ruleset.isActive ? 'paused' : 'activated'}`);
    } catch { messageApi.error('Failed to toggle'); }
  }, [rulesetId, ruleset.isActive, messageApi]);

  const handleDuplicate = useCallback(async () => {
    if (!rulesetId) return;
    try {
      const res = await rulesetApi.duplicate(rulesetId);
      messageApi.success('Ruleset duplicated');
      const newId = res.data?._id || res.data?.id;
      if (newId) navigate(`/rule-sets/${newId}`);
    } catch { messageApi.error('Failed to duplicate'); }
  }, [rulesetId, messageApi, navigate]);

  const updateRule = useCallback((index, updates) => {
    setRuleset(prev => {
      const rules = [...prev.rules];
      rules[index] = { ...rules[index], ...updates };
      return { ...prev, rules };
    });
  }, []);

  const updateCondition = useCallback((ruleIdx, condIdx, updates) => {
    setRuleset(prev => {
      const rules = [...prev.rules];
      const conditions = [...rules[ruleIdx].conditions];
      conditions[condIdx] = { ...conditions[condIdx], ...updates };
      if (updates.attribute) {
        const attr = Object.values(ATTRIBUTES_BY_TYPE).flat().find(a => a.value === updates.attribute);
        if (attr) {
          const ops = OPERATORS[attr.type] || OPERATORS.number;
          conditions[condIdx].operator = ops[0]?.value || '>';
          conditions[condIdx].value = '';
          conditions[condIdx].value2 = '';
        }
      }
      rules[ruleIdx] = { ...rules[ruleIdx], conditions };
      return { ...prev, rules };
    });
  }, []);

  const updateAction = useCallback((ruleIdx, updates) => {
    setRuleset(prev => {
      const rules = [...prev.rules];
      rules[ruleIdx] = { ...rules[ruleIdx], action: { ...rules[ruleIdx].action, ...updates } };
      return { ...prev, rules };
    });
  }, []);

  const addRule = useCallback(() => {
    setRuleset(prev => ({ ...prev, rules: [...prev.rules, initialRule(prev.rules.length)] }));
  }, []);

  const removeRule = useCallback((index) => {
    if (ruleset.rules.length <= 1) { messageApi.warning('Need at least one rule'); return; }
    setRuleset(prev => ({ ...prev, rules: prev.rules.filter((_, i) => i !== index) }));
  }, [ruleset.rules.length, messageApi]);

  const moveRule = useCallback((index, dir) => {
    const newIdx = index + dir;
    if (newIdx < 0 || newIdx >= ruleset.rules.length) return;
    setRuleset(prev => {
      const rules = [...prev.rules];
      [rules[index], rules[newIdx]] = [rules[newIdx], rules[index]];
      return { ...prev, rules };
    });
  }, [ruleset.rules.length]);

  const addCondition = useCallback((ruleIdx) => {
    setRuleset(prev => {
      const rules = [...prev.rules];
      const conditions = [...rules[ruleIdx].conditions, { attribute: '', operator: '>', value: '', value2: '', logicalOp: 'AND' }];
      rules[ruleIdx] = { ...rules[ruleIdx], conditions };
      return { ...prev, rules };
    });
  }, []);

  const removeCondition = useCallback((ruleIdx, condIdx) => {
    setRuleset(prev => {
      const rules = [...prev.rules];
      const conditions = rules[ruleIdx].conditions.filter((_, i) => i !== condIdx);
      rules[ruleIdx] = { ...rules[ruleIdx], conditions };
      return { ...prev, rules };
    });
  }, []);

  const getAllAttributes = useMemo(() => ATTRIBUTES_BY_TYPE[ruleset.type] || ATTRIBUTES_BY_TYPE.ASIN, [ruleset.type]);
  const getAttributeType = useCallback((value) => {
    const attr = getAllAttributes.find(a => a.value === value);
    return attr?.type || 'number';
  }, [getAllAttributes]);
  const getOperatorsForAttribute = useCallback((attribute) => {
    const type = getAttributeType(attribute);
    return OPERATORS[type] || OPERATORS.number;
  }, [getAttributeType]);
  const getActionsForType = useMemo(() => ACTIONS_BY_TYPE[ruleset.type] || ACTIONS_BY_TYPE.ASIN, [ruleset.type]);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Never';
    try { return new Date(dateStr).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
    catch { return dateStr; }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}><Spin size="large" /></div>;

  return (
    <div className="ruleset-builder">
      {msgCtx}

      {/* Header */}
      <header className="ruleset-builder__header">
        <div className="ruleset-builder__header-inner">
          <div className="ruleset-builder__title-group">
            <Button type="text" icon={<ArrowLeft size={16} />} onClick={() => navigate('/rule-sets')} className="ruleset-builder__back" />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 className="ruleset-builder__title">{rulesetId ? 'Edit Ruleset' : 'Create Ruleset'}</h2>
                {ruleset.isActive ? (
                  <Tag color="success" style={{ borderRadius: 10, fontSize: 10, fontWeight: 600 }}>Active</Tag>
                ) : (
                  <Tag color="default" style={{ borderRadius: 10, fontSize: 10, fontWeight: 600 }}>Paused</Tag>
                )}
              </div>
              <p className="ruleset-builder__subtitle">Define conditions and automated actions for your ASINs</p>
            </div>
          </div>
          <Space size={8} className="ruleset-builder__actions">
            {rulesetId && (
              <>
                <Button icon={<Clock size={13} />} onClick={() => { setShowHistoryDrawer(true); loadHistory(); }}
                  style={{ borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: 'var(--bc-font-size-xs)', height: 32 }}>History</Button>
                <Tooltip title={ruleset.isActive ? 'Pause' : 'Activate'}>
                  <Button icon={ruleset.isActive ? <PauseCircle size={13} /> : <PlayCircle size={13} />}
                    onClick={handleToggle} style={{ borderRadius: 'var(--radius-md)', fontSize: 'var(--bc-font-size-xs)', height: 32 }} />
                </Tooltip>
                <Tooltip title="Duplicate">
                  <Button icon={<Copy size={13} />} onClick={handleDuplicate}
                    style={{ borderRadius: 'var(--radius-md)', fontSize: 'var(--bc-font-size-xs)', height: 32 }} />
                </Tooltip>
                <Button icon={<PlayCircle size={13} />} loading={executing} onClick={handleExecute}
                  style={{ borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: 'var(--bc-font-size-xs)', height: 32, color: 'var(--bc-success)', borderColor: 'var(--bc-success)' }}>
                  Run Now
                </Button>
              </>
            )}
            <Button type="primary" loading={saving} onClick={handleSave}
              style={{ borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: 'var(--bc-font-size-xs)', height: 32 }}>
              {rulesetId ? 'Save Changes' : 'Create Ruleset'}
            </Button>
          </Space>
        </div>
      </header>

      <div className="ruleset-builder__content">
        {/* Main Content */}
        <main className="ruleset-builder__main">
          {/* Settings Card */}
          <Card className="ruleset-builder__card" styles={{ body: { padding: 0 } }}>
            <div style={{ padding: 'var(--bc-space-3) var(--bc-space-4)', borderBottom: '1px solid var(--bc-border-default)', background: 'var(--bc-surface-muted)' }}>
              <span style={{ fontSize: 'var(--bc-font-size-xs)', fontWeight: 600, color: 'var(--bc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Settings</span>
            </div>
            <div className="ruleset-builder__card-body" style={{ padding: 'var(--bc-space-4)' }}>
              <div className="ruleset-builder__settings-grid">
                <div className="ruleset-builder__field">
                  <label className="ruleset-builder__field-label ruleset-builder__field-label--required">Name</label>
                  <Input size="small" placeholder="e.g. Low LQS Alert" value={ruleset.name}
                    onChange={e => setRuleset({ ...ruleset, name: e.target.value })} className="ruleset-builder__input" />
                </div>
                <div className="ruleset-builder__field">
                  <label className="ruleset-builder__field-label">Description</label>
                  <Input size="small" placeholder="Brief description..." value={ruleset.description}
                    onChange={e => setRuleset({ ...ruleset, description: e.target.value })} className="ruleset-builder__input" />
                </div>
                <div className="ruleset-builder__field">
                  <label className="ruleset-builder__field-label">Data Range</label>
                  <Select size="small" value={ruleset.usingDataFrom} className="ruleset-builder__select"
                    onChange={v => setRuleset({ ...ruleset, usingDataFrom: v })}
                    options={DATE_RANGES} />
                </div>
                <div className="ruleset-builder__field">
                  <label className="ruleset-builder__field-label">Exclude</label>
                  <Select size="small" value={ruleset.excludeDays} className="ruleset-builder__select"
                    onChange={v => setRuleset({ ...ruleset, excludeDays: v })}
                    options={EXCLUDE_OPTIONS} />
                </div>
              </div>
              <Divider className="ruleset-builder__divider" />
              <div className="ruleset-builder__automation">
                <label className="ruleset-builder__switch-label">
                  <Switch size="small" checked={ruleset.isAutomated}
                    onChange={v => setRuleset({ ...ruleset, isAutomated: v })} />
                  <span>Auto-run</span>
                </label>
                {ruleset.isAutomated && (
                  <div className="ruleset-builder__schedule">
                    <Select size="small" value={ruleset.runFrequency} className="ruleset-builder__select"
                      onChange={v => setRuleset({ ...ruleset, runFrequency: v })}
                      options={FREQUENCY_OPTIONS} />
                    <Select size="small" value={ruleset.runTime} className="ruleset-builder__select"
                      onChange={v => setRuleset({ ...ruleset, runTime: v })}
                      options={TIME_OPTIONS.map(t => ({ value: t, label: t }))} />
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Rules */}
          <div className="ruleset-builder__rules-label">
            Rules ({ruleset.rules.length})
          </div>

          {ruleset.rules.map((rule, ruleIdx) => (
            <RuleCard
              key={ruleIdx}
              rule={rule}
              index={ruleIdx}
              total={ruleset.rules.length}
              getAllAttributes={getAllAttributes}
              getOperatorsForAttribute={getOperatorsForAttribute}
              getActionsForType={getActionsForType}
              onMove={moveRule}
              onRemove={() => removeRule(ruleIdx)}
              onUpdate={(updates) => updateRule(ruleIdx, updates)}
              onConditionChange={(condIdx, updates) => updateCondition(ruleIdx, condIdx, updates)}
              onAddCondition={() => addCondition(ruleIdx)}
              onRemoveCondition={(condIdx) => removeCondition(ruleIdx, condIdx)}
              onActionChange={(updates) => updateAction(ruleIdx, updates)}
            />
          ))}

          <Button className="ruleset-builder__add-rule" type="dashed" block icon={<Plus size={13} />} onClick={addRule}>
            Add Rule
          </Button>
        </main>

        {/* Right Sidebar - Quick Info */}
        <aside className="ruleset-builder__sidebar" aria-hidden="true">
          <Card className="ruleset-builder__sidebar-card" styles={{ body: { padding: 0 } }}>
            <div style={{ padding: 'var(--bc-space-3)', borderBottom: '1px solid var(--bc-border-default)', background: 'var(--bc-surface-muted)' }}>
              <span style={{ fontSize: 'var(--bc-font-size-xs)', fontWeight: 600, color: 'var(--bc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Summary</span>
            </div>
            <div style={{ padding: 'var(--bc-space-3)' }}>
              <div className="ruleset-summary">
                <div className="ruleset-summary__row">
                  <span className="ruleset-summary__label">Rules</span>
                  <span className="ruleset-summary__value">{ruleset.rules.length}</span>
                </div>
                <div className="ruleset-summary__row">
                  <span className="ruleset-summary__label">Data Range</span>
                  <span className="ruleset-summary__value">{ruleset.usingDataFrom}</span>
                </div>
                <div className="ruleset-summary__row">
                  <span className="ruleset-summary__label">Auto-run</span>
                  <span className="ruleset-summary__value ruleset-summary__value--{ruleset.isAutomated ? 'active' : 'inactive'}">
                    {ruleset.isAutomated ? `${ruleset.runFrequency} at ${ruleset.runTime}` : 'Off'}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          <Card className="ruleset-builder__sidebar-card" styles={{ body: { padding: 0 } }}>
            <div style={{ padding: 'var(--bc-space-3)', borderBottom: '1px solid var(--bc-border-default)', background: 'var(--bc-surface-muted)' }}>
              <span style={{ fontSize: 'var(--bc-font-size-xs)', fontWeight: 600, color: 'var(--bc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>How it works</span>
            </div>
            <div style={{ padding: 'var(--bc-space-3)' }}>
              <div className="ruleset-help">
                <p style={{ margin: '0 0 var(--bc-space-2)' }}>1. Define <b>conditions</b> that filter your ASINs</p>
                <p style={{ margin: '0 0 var(--bc-space-2)' }}>2. Set an <b>action</b> for each matching ASIN</p>
                <p style={{ margin: '0 0 var(--bc-space-2)' }}>3. Rules run top to bottom — first match wins</p>
                <p style={{ margin: 0 }}>4. <b>Run Now</b> executes immediately, or set auto-run schedule</p>
              </div>
            </div>
          </Card>
        </aside>
      </div>

      {/* History Drawer */}
      <Drawer
        className="ruleset-builder__drawer"
        title="Execution History"
        open={showHistoryDrawer}
        onClose={() => setShowHistoryDrawer(false)}
        width={520}
        styles={{ body: { padding: 'var(--bc-space-3) var(--bc-space-4)' } }}
      >
        {historyLoading ? (
          <Spin style={{ display: 'block', margin: '40px auto' }} />
        ) : executionHistory.length === 0 ? (
          <Empty description="No execution history yet" />
        ) : (
          executionHistory.map((log, i) => {
let summary = {};
            // eslint-disable-next-line no-empty
            try { summary = JSON.parse(log.Summary || '{}'); } catch (_e) { void _e; }
            return (
              <div key={log.Id || i} className="ruleset-builder__drawer-item">
                <div className="ruleset-builder__drawer-header">
                  <div className="ruleset-builder__drawer-status">
                    <CheckCircle2 className="ruleset-builder__drawer-icon" style={{ color: log.Status === 'SUCCESS' ? 'var(--bc-success)' : 'var(--bc-danger)' }} />
                    <span className="ruleset-builder__drawer-text">
                      {log.MatchedCount || 0} matched · {log.ActionedCount || 0} actioned
                    </span>
                  </div>
                  <span className="ruleset-builder__drawer-time">{formatDate(log.ExecutedAt)}</span>
                </div>
                <div className="ruleset-builder__drawer-meta">
                  <span>Trigger: <strong style={{ textTransform: 'capitalize' }}>{log.TriggeredBy}</strong></span>
                  {summary.executionTimeMs && <span>· Time: <strong>{(summary.executionTimeMs / 1000).toFixed(1)}s</strong></span>}
                </div>
              </div>
            );
          })
        )}
      </Drawer>
    </div>
  );
};

// Rule Card Component
const RuleCard = ({
  rule, index, total,
  getAllAttributes, getOperatorsForAttribute, getActionsForType,
  onMove, onRemove, onUpdate, onConditionChange, onAddCondition,
  onRemoveCondition, onActionChange
}) => {
  const groupedAttrs = useMemo(() => {
    const groups = {};
    getAllAttributes.forEach(attr => {
      if (!groups[attr.group]) groups[attr.group] = [];
      groups[attr.group].push(attr);
    });
    return groups;
  }, [getAllAttributes]);

  const actionTypes = getActionsForType;
  const selectedAction = actionTypes.find(a => a.value === rule.action?.actionType);

  const attributeOptions = useMemo(() =>
    Object.entries(groupedAttrs).map(([group, attrs]) => ({
      label: <span style={{ fontWeight: 600, fontSize: 'var(--bc-font-size-xs)', color: 'var(--bc-text-muted)' }}>{group}</span>,
      options: attrs.map(a => ({ value: a.value, label: `${a.label}${a.unit ? ` (${a.unit})` : ''}` }))
    })), [groupedAttrs]);

  return (
    <div className={`ruleset-rule ${rule.isActive ? '' : 'ruleset-rule--inactive'}`}>
      {/* Rule Header */}
      <div className="ruleset-rule__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="ruleset-rule__index">#{index + 1}</span>
          <Input
            size="small"
            value={rule.name}
            onChange={e => onUpdate({ name: e.target.value })}
            className="ruleset-rule__name-input"
            variant="borderless"
          />
        </div>
        <Space size={4} className="ruleset-rule__actions">
          <Switch size="small" checked={rule.isActive} onChange={v => onUpdate({ isActive: v })} />
          <Tooltip title="Move Up">
            <Button type="text" size="small" icon={<ChevronUp size={14} />} disabled={index === 0}
              className="ruleset-rule__action-btn" onClick={() => onMove(index, -1)} />
          </Tooltip>
          <Tooltip title="Move Down">
            <Button type="text" size="small" icon={<ChevronDown size={14} />} disabled={index === total - 1}
              className="ruleset-rule__action-btn" onClick={() => onMove(index, 1)} />
          </Tooltip>
          <Popconfirm title="Delete this rule?" onConfirm={onRemove} okText="Delete" cancelText="Cancel">
            <Button type="text" danger size="small" icon={<Trash2 size={13} />}
              className="ruleset-rule__action-btn ruleset-rule__action-btn--danger" />
          </Popconfirm>
        </Space>
      </div>

      <div className="ruleset-rule__body">
        {/* Conditions */}
        <div style={{ marginBottom: 'var(--bc-space-3)' }}>
          <div className="ruleset-rule__section-label">
            Conditions <span className="ruleset-rule__condition-count">({rule.conditions.length})</span>
          </div>
          {rule.conditions.map((cond, condIdx) => {
            const ops = getOperatorsForAttribute(cond.attribute);
            const attr = getAllAttributes.find(a => a.value === cond.attribute);
            return (
              <div key={condIdx} className="ruleset-condition">
                {condIdx > 0 && (
                  <Select size="small" value={cond.logicalOp}
                    onChange={v => onConditionChange(condIdx, { logicalOp: v })}
                    className="ruleset-condition__logical"
                    options={[{ value: 'AND', label: 'AND' }, { value: 'OR', label: 'OR' }]} />
                )}
                {condIdx === 0 && <span className="ruleset-condition__if">IF</span>}

                <Select size="small" showSearch optionFilterProp="label" value={cond.attribute || undefined}
                  placeholder="Attribute" className="ruleset-condition__attr"
                  onChange={v => onConditionChange(condIdx, { attribute: v })}
                  options={attributeOptions}
                  className="ruleset-condition__op"
                  options={ops.map(o => ({ value: o.value, label: o.label }))} />

                {cond.attribute && (
                  <>
                    {attr?.type === 'enum' ? (
                      <Select size="small" value={cond.value || undefined}
                        placeholder="Value" className="ruleset-condition__value"
                        onChange={v => onConditionChange(condIdx, { value: v })}
                        options={(attr.options || []).map(o => ({ value: o, label: o }))} />
                    ) : attr?.type === 'boolean' ? (
                      <Select size="small" value={cond.value || undefined}
                        placeholder="Value" className="ruleset-condition__value"
                        onChange={v => onConditionChange(condIdx, { value: v })}
                        options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]} />
                    ) : cond.operator === 'between' ? (
                      <Space size={4} className="ruleset-condition__value">
                        <InputNumber size="small" value={cond.value}
                          onChange={v => onConditionChange(condIdx, { value: v })}
                          placeholder="Min" style={{ width: 80 }} />
                        <InputNumber size="small" value={cond.value2}
                          onChange={v => onConditionChange(condIdx, { value2: v })}
                          placeholder="Max" style={{ width: 80 }} />
                      </Space>
                    ) : cond.operator !== 'is empty' && cond.operator !== 'is not empty' ? (
                      <InputNumber size="small" value={cond.value}
                        onChange={v => onConditionChange(condIdx, { value: v })}
                        className="ruleset-condition__value" placeholder="Value"
                        addonAfter={attr?.unit || null} />
                    ) : null}
                  </>
                )}

                {rule.conditions.length > 1 && (
                  <Button type="text" danger size="small" icon={<Trash2 size={12} />}
                    className="ruleset-condition__remove"
                    onClick={() => onRemoveCondition(condIdx)} />
                )}
              </div>
            );
          })}
          <Button type="text" size="small" icon={<Plus size={12} />} onClick={onAddCondition}
            className="ruleset-condition__add">
            Add Condition
          </Button>
        </div>

        {/* Action */}
        <div style={{ borderTop: '1px solid var(--bc-border-default)', paddingTop: 'var(--bc-space-3)' }}>
          <div className="ruleset-rule__section-label">Action</div>
          <div className="ruleset-action">
            <span className="ruleset-action__then">THEN</span>
            <Select size="small" value={rule.action?.actionType}
              onChange={v => onActionChange({ actionType: v, value: '' })}
              className="ruleset-action__select"
              options={actionTypes.map(a => ({
                value: a.value,
                label: <span style={{ fontSize: 'var(--bc-font-size-xs)' }}>{a.label}</span>
              }))} />

            {selectedAction?.hasValue && (
              <Input size="small" value={rule.action?.value || ''}
                onChange={e => onActionChange({ value: e.target.value })}
                placeholder={selectedAction.unit || 'Value'}
                className="ruleset-action__value"
                addonBefore={selectedAction.unit === 'tag name' ? <TagIcon size={10} /> : undefined} />
            )}

            {rule.action?.actionType === 'create_task' || rule.action?.actionType === 'create_task_high' ? (
              <Select size="small" value={rule.action?.priority || 'Medium'}
                onChange={v => onActionChange({ priority: v })}
                className="ruleset-action__priority"
                options={TASK_PRIORITIES.map(p => ({
                  value: p.value,
                  label: <span style={{ color: p.color, fontWeight: 600, fontSize: 'var(--bc-font-size-xs)' }}>{p.label}</span>
                }))} />
            ) : null}

            {rule.action?.actionType === 'create_group_task' ? (
              <div className="ruleset-action__group">
                <div className="ruleset-action__group-item">
                  <div className="ruleset-action__group-label">Group by</div>
                  <Select size="small" value={rule.action?.groupBy || 'seller'}
                    onChange={v => onActionChange({ groupBy: v })}
                    className="ruleset-action__group-select"
                    options={GROUP_BY_OPTIONS.map(o => ({ value: o.value, label: o.label }))} />
                </div>
                <div className="ruleset-action__group-item">
                  <div className="ruleset-action__group-label">Priority</div>
                  <Select size="small" value={rule.action?.priority || 'Medium'}
                    onChange={v => onActionChange({ priority: v })}
                    className="ruleset-action__group-select"
                    options={TASK_PRIORITIES.map(p => ({
                      value: p.value,
                      label: <span style={{ color: p.color, fontWeight: 600, fontSize: 'var(--bc-font-size-xs)' }}>{p.label}</span>
                    }))} />
                </div>
                <div className="ruleset-action__group-item">
                  <div className="ruleset-action__group-label">SOP</div>
                  <Select size="small" value={rule.action?.sopPreset || 'auto'}
                    onChange={v => {
                      const sop = v === 'auto' ? null : SOP_PRESETS[v] || null;
                      onActionChange({ sopPreset: v, sop });
                    }}
                    className="ruleset-action__group-select"
                    options={[
                      { value: 'auto', label: 'Auto-detect' },
                      { value: 'pricing', label: 'Pricing' },
                      { value: 'listing', label: 'Listing' },
                      { value: 'inventory', label: 'Inventory' },
                      { value: 'custom', label: 'Custom' },
                    ]} />
                </div>
              </div>
            ) : null}
          </div>
          {selectedAction?.description && (
            <div className="ruleset-action__desc">{selectedAction.description}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RulesetBuilderPage;



