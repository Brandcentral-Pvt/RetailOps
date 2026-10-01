import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
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
import { RULE_TEMPLATES, RULE_CATEGORIES } from '../constants/ruleTemplates';
import {
  ArrowLeft, Plus, Trash2, GripVertical, PlayCircle, PauseCircle,
  Copy, Clock, CheckCircle2, AlertTriangle, Tag as TagIcon, Mail,
  Bell, Eye, ChevronUp, ChevronDown, Settings, ChevronRight,
  Zap, Shield, Activity, Calendar, MoreHorizontal, SlidersHorizontal,
  XCircle, Sparkles, Wand2, LayoutTemplate, Bot, ArrowRight, Loader2,
  Lightbulb, FileText, Package, TrendingUp, TrendingDown, Star, Image as ImageIcon,
  DollarSign, MessageSquare
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

// Icon lookup for templates
const TEMPLATE_ICONS = {
  Shield, Zap, AlertTriangle, Package, TrendingDown, Star, Image: ImageIcon,
  FileText, Percent: MessageSquare, Eye, MessageSquare, DollarSign, TrendingUp, Settings
};

const RulesetBuilderPage = () => {
  const { id: rulesetId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user: _user } = useAuth();
  const [messageApi, msgCtx] = antdMessage.useMessage();

  const [loading, setLoading] = useState(!!rulesetId);
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState(false);

  // AI assistant state
  const [showAIModal, setShowAIModal] = useState(() => !rulesetId && searchParams.get('ai') === '1');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState(null);

  // Template gallery state
  const [showTemplates, setShowTemplates] = useState(() => !rulesetId);
  const [templateCategory, setTemplateCategory] = useState('All');

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
      // Backend returns { success, data: [...] } directly (no .logs wrapping).
      const logs = Array.isArray(res?.data) ? res.data : Array.isArray(res?.data?.logs) ? res.data.logs : [];
      setExecutionHistory(logs);
    } catch (_e) { console.error(_e); }
    finally { setHistoryLoading(false); }
  }, [rulesetId]);

  useEffect(() => {
    if (rulesetId) {
      setLoading(true);
      rulesetApi.getById(rulesetId).then(res => {
        if (res?.success && res.data) {
          const d = res.data;
          // Rules come back pre-parsed as an array from the backend
          // (normalizeRuleset does the JSON.parse). Defensive double-decode
          // just in case a legacy record is still double-stringified.
          let parsedRules = d.rules;
          if (typeof parsedRules === 'string') {
            try { parsedRules = JSON.parse(parsedRules); } catch { parsedRules = []; }
            if (typeof parsedRules === 'string') {
              try { parsedRules = JSON.parse(parsedRules); } catch { parsedRules = []; }
            }
          }
          if (!Array.isArray(parsedRules) || parsedRules.length === 0) {
            parsedRules = [initialRule(0)];
          }

          // Scope is also pre-parsed by the backend
          let parsedScope = d.scope;
          if (typeof parsedScope === 'string') {
            try { parsedScope = JSON.parse(parsedScope); } catch { parsedScope = { applyTo: 'all' }; }
          }

          setRuleset({
            name: d.name || '',
            description: d.description || '',
            type: d.type || 'ASIN',
            sellerId: d.sellerId || '',
            rules: parsedRules,
            usingDataFrom: d.usingDataFrom || 'Last 14 days',
            excludeDays: d.excludeDays || 'Latest day',
            isActive: d.isActive !== undefined ? d.isActive : true,
            isAutomated: d.isAutomated || false,
            runFrequency: d.runFrequency || 'Daily',
            runTime: d.runTime || '08 AM',
            scope: parsedScope || { applyTo: 'all' },
            emailOnRun: d.emailOnRun || false,
            emailAddress: d.emailAddress || '',
          });
        } else {
          messageApi.error('Ruleset not found');
        }
      }).catch((e) => {
        console.error('Failed to load ruleset:', e);
        messageApi.error(e?.message || 'Failed to load ruleset');
      })
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

  // ── Template Gallery helpers ──
  const applyTemplate = useCallback((tpl) => {
    setRuleset(prev => ({
      ...prev,
      name: tpl.name,
      description: tpl.description,
      rules: tpl.rules.map((r, i) => ({ ...r, order: i })),
      isAutomated: tpl.isAutomated !== undefined ? tpl.isAutomated : prev.isAutomated,
      runFrequency: tpl.runFrequency || prev.runFrequency,
      runTime: tpl.runTime || prev.runTime,
    }));
    setShowTemplates(false);
    messageApi.success(`Template "${tpl.name}" loaded — review and save`);
  }, [messageApi]);

  // ── AI generation ──
  const handleAIGenerate = useCallback(async () => {
    if (!aiPrompt.trim()) { messageApi.warning('Describe what you want the rule to do'); return; }
    setAiGenerating(true);
    try {
      const res = await rulesetApi.aiGenerate(
        aiPrompt,
        ruleset.rules.length > 0 ? ruleset.rules : [],
        { seller: ruleset.sellerId || undefined }
      );
      if (res?.success && res.data) {
        setAiResult(res.data);
      } else {
        messageApi.error(res?.message || 'AI generation failed');
      }
    } catch (e) {
      messageApi.error(e?.message || 'AI generation failed');
    } finally {
      setAiGenerating(false);
    }
  }, [aiPrompt, ruleset.rules, ruleset.sellerId, messageApi]);

  const applyAIRules = useCallback(() => {
    if (!aiResult) return;
    setRuleset(prev => ({
      ...prev,
      name: aiResult.name || prev.name,
      description: aiResult.description || prev.description,
      rules: aiResult.rules.map((r, i) => ({ ...r, order: i })),
      isAutomated: aiResult.isAutomated !== undefined ? aiResult.isAutomated : prev.isAutomated,
      runFrequency: aiResult.runFrequency || prev.runFrequency,
      runTime: aiResult.runTime || prev.runTime,
    }));
    setShowAIModal(false);
    setAiResult(null);
    setAiPrompt('');
    messageApi.success('AI-generated rules loaded — review and save');
  }, [aiResult, messageApi]);

  const startBlank = useCallback(() => {
    setShowTemplates(false);
  }, []);

  const filteredTemplates = useMemo(() => {
    if (templateCategory === 'All') return RULE_TEMPLATES;
    return RULE_TEMPLATES.filter(t => t.category === templateCategory);
  }, [templateCategory]);

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
            <Tooltip title="Browse templates">
              <Button icon={<LayoutTemplate size={13} />} onClick={() => setShowTemplates(true)}
                style={{ borderRadius: 'var(--radius-md)', fontSize: 'var(--bc-font-size-xs)', height: 32 }}>
                Templates
              </Button>
            </Tooltip>
            <Tooltip title="Create rules with AI">
              <Button icon={<Sparkles size={13} style={{ color: '#8B5CF6' }} />} onClick={() => setShowAIModal(true)}
                style={{ borderRadius: 'var(--radius-md)', fontSize: 'var(--bc-font-size-xs)', height: 32 }}>
                AI Assist
              </Button>
            </Tooltip>
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
                  <span className={`ruleset-summary__value ruleset-summary__value--${ruleset.isAutomated ? 'active' : 'inactive'}`}>
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
            const status = log.Status || log.status;
            const matched = log.MatchedCount ?? log.matchedCount ?? 0;
            const actioned = log.ActionedCount ?? log.actionedCount ?? 0;
            const triggeredBy = log.TriggeredBy || log.triggeredBy || 'manual';
            const executedAt = log.ExecutedAt || log.executedAt;
            const errMsg = log.ErrorMessage || log.errorMessage;
            let summary = {};
            try { summary = JSON.parse(log.Summary || errMsg || '{}'); } catch (_e) { void _e; }
            const failed = status !== 'SUCCESS' && status !== 'success';
            return (
              <div key={log.Id || log.id || i} className="ruleset-builder__drawer-item">
                <div className="ruleset-builder__drawer-header">
                  <div className="ruleset-builder__drawer-status">
                    {failed
                      ? <XCircle size={14} style={{ color: 'var(--bc-danger)' }} />
                      : <CheckCircle2 size={14} style={{ color: 'var(--bc-success)' }} />}
                    <span className="ruleset-builder__drawer-text">
                      {failed ? (errMsg ? `Failed: ${String(errMsg).slice(0, 80)}` : 'Failed') : `${matched} matched · ${actioned} actioned`}
                    </span>
                  </div>
                  <span className="ruleset-builder__drawer-time">{formatDate(executedAt)}</span>
                </div>
                <div className="ruleset-builder__drawer-meta">
                  <span>Trigger: <strong style={{ textTransform: 'capitalize' }}>{triggeredBy}</strong></span>
                  {summary.executionTimeMs && <span>· Time: <strong>{(summary.executionTimeMs / 1000).toFixed(1)}s</strong></span>}
                  {summary.totalEvaluated !== undefined && <span>· Evaluated: <strong>{summary.totalEvaluated}</strong></span>}
                </div>
              </div>
            );
          })
        )}
      </Drawer>

      {/* Template Gallery (shown on create unless hidden) */}
      {showTemplates && !rulesetId && (
        <div className="ruleset-template-gallery">
          <div className="ruleset-template-gallery__backdrop" onClick={startBlank} />
          <div className="ruleset-template-gallery__panel">
            <div className="ruleset-template-gallery__header">
              <div>
                <h3 className="ruleset-template-gallery__title">
                  <LayoutTemplate size={18} /> Start with a Template
                </h3>
                <p className="ruleset-template-gallery__subtitle">
                  Pick a pre-built rule or start from scratch. You can edit anything later.
                </p>
              </div>
              <Space>
                <Button icon={<Sparkles size={13} style={{ color: '#8B5CF6' }} />} onClick={() => { setShowTemplates(false); setShowAIModal(true); }}>
                  Use AI Instead
                </Button>
                <Button onClick={startBlank}>Start Blank</Button>
              </Space>
            </div>

            <div className="ruleset-template-gallery__categories">
              <Segmented
                size="small"
                value={templateCategory}
                onChange={setTemplateCategory}
                options={[
                  { label: 'All', value: 'All' },
                  ...RULE_CATEGORIES.map(c => ({ label: c.id, value: c.id })),
                ]}
              />
            </div>

            <div className="ruleset-template-gallery__grid">
              {filteredTemplates.map(tpl => {
                const IconComp = TEMPLATE_ICONS[tpl.icon] || Zap;
                return (
                  <button
                    type="button"
                    key={tpl.id}
                    className="ruleset-template-card"
                    onClick={() => applyTemplate(tpl)}
                  >
                    <div className="ruleset-template-card__icon" style={{ background: `${tpl.color}15`, color: tpl.color }}>
                      <IconComp size={20} />
                    </div>
                    <div className="ruleset-template-card__body">
                      <div className="ruleset-template-card__title">{tpl.name}</div>
                      <div className="ruleset-template-card__desc">{tpl.description}</div>
                      <div className="ruleset-template-card__meta">
                        <Tag color="blue" style={{ margin: 0 }}>{tpl.category}</Tag>
                        <span className="ruleset-template-card__rules">{tpl.rules.length} rule{tpl.rules.length > 1 ? 's' : ''}</span>
                        {tpl.isAutomated && <Tag color="green" style={{ margin: 0 }}>AUTO</Tag>}
                      </div>
                    </div>
                    <ArrowRight size={14} className="ruleset-template-card__arrow" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* AI Generate Modal */}
      <Modal
        title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Sparkles size={16} style={{ color: '#8B5CF6' }} /> Create Rules with AI</span>}
        open={showAIModal}
        onCancel={() => { setShowAIModal(false); setAiResult(null); }}
        width={640}
        footer={aiResult ? [
          <Button key="cancel" onClick={() => { setShowAIModal(false); setAiResult(null); }}>Cancel</Button>,
          <Button key="regenerate" icon={<Wand2 size={13} />} onClick={handleAIGenerate} loading={aiGenerating}>Regenerate</Button>,
          <Button key="apply" type="primary" icon={<CheckCircle2 size={13} />} onClick={applyAIRules}>
            Apply Rules
          </Button>,
        ] : [
          <Button key="cancel" onClick={() => setShowAIModal(false)}>Cancel</Button>,
          <Button key="gen" type="primary" icon={<Sparkles size={13} />} onClick={handleAIGenerate} loading={aiGenerating}>
            Generate
          </Button>,
        ]}
        destroyOnHidden
      >
        {!aiResult ? (
          <div>
            <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 12 }}>
              Describe what you'd like to monitor or automate in plain English. Our AI will build the rule(s), pick thresholds, and choose an action for you.
            </Text>
            <Input.TextArea
              placeholder="e.g. Alert me whenever a top-1000 BSR product's rating drops below 4 stars with more than 10 reviews, and create a high-priority task grouped by seller."
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              rows={5}
              autoFocus
              style={{ borderRadius: 8 }}
            />
            <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {[
                'Flag ASINs with LQS under 60 for listing team review',
                'Create urgent task when we lose Buy Box on any product',
                'Add a "Low Stock" tag when stock drops below 20 units',
                'Notify me if any ASIN has zero reviews after 30 days',
                'Group daily pricing issues by seller with critical priority',
              ].map(s => (
                <Tag
                  key={s}
                  style={{ cursor: 'pointer', borderRadius: 999, padding: '4px 10px' }}
                  onClick={() => setAiPrompt(s)}
                >
                  <Lightbulb size={10} style={{ marginRight: 4 }} />{s.slice(0, 38)}…
                </Tag>
              ))}
            </div>
            {aiGenerating && (
              <div style={{ marginTop: 16, textAlign: 'center', padding: 16 }}>
                <Spin indicator={<Loader2 size={24} className="rulesets-spin" />} />
                <div style={{ marginTop: 8, fontSize: 13, color: 'var(--bc-text-muted)' }}>
                  <Bot size={13} style={{ marginRight: 4, verticalAlign: -2 }} />
                  Thinking… analyzing your ASIN attributes and best practices
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div style={{ padding: '12px', borderRadius: 8, background: '#F5F3FF', border: '1px solid #DDD6FE', marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <Sparkles size={14} style={{ color: '#8B5CF6', marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#5B21B6' }}>{aiResult.name}</div>
                  <div style={{ fontSize: 12, color: '#6D28D9', marginTop: 2 }}>{aiResult.description}</div>
                  {aiResult.reasoning && (
                    <div style={{ fontSize: 11, color: '#7C3AED', marginTop: 6, fontStyle: 'italic' }}>
                      {aiResult.reasoning}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div style={{ fontWeight: 600, fontSize: 12, textTransform: 'uppercase', color: 'var(--bc-text-muted)', letterSpacing: '0.04em', marginBottom: 8 }}>
              {aiResult.rules.length} Rule{aiResult.rules.length > 1 ? 's' : ''} Generated
            </div>
            {aiResult.warnings?.length > 0 && (
              <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: aiResult.warnings.length > 1 ? 6 : 0 }}>
                  <AlertTriangle size={14} style={{ color: '#B45309', marginTop: 2, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: '#92400E' }}>
                      {aiResult.warnings.length} part{aiResult.warnings.length > 1 ? 's' : ''} of the request could not be used
                    </div>
                    {aiResult.warnings.map((w, wi) => (
                      <div key={wi} style={{ fontSize: 11, color: '#92400E', marginTop: 4 }}>• {w}</div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
              {aiResult.rules.map((r, i) => (
                <div key={i} className="ruleset-ai-rule-preview">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Badge count={i + 1} style={{ background: '#8B5CF6' }} />
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{r.name}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--bc-text-secondary)', marginBottom: 4 }}>
                    <span style={{ color: 'var(--bc-text-muted)' }}>IF </span>
                    {r.conditions.map((c, ci) => (
                      <span key={ci}>
                        {ci > 0 && <span style={{ color: 'var(--bc-text-muted)' }}> {c.logicalOp} </span>}
                        <code style={{ background: 'var(--bc-surface-muted)', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>
                          {c.attribute} {c.operator} {c.value}{c.value2 ? ` – ${c.value2}` : ''}
                        </code>
                      </span>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--bc-text-secondary)' }}>
                    <span style={{ color: 'var(--bc-text-muted)' }}>THEN </span>
                    <Tag color="purple" style={{ margin: 0 }}>{r.action?.actionType?.replace(/_/g, ' ')}</Tag>
                    {r.action?.priority && r.action?.priority !== 'Medium' && (
                      <Tag color={r.action.priority === 'Critical' ? 'red' : r.action.priority === 'High' ? 'orange' : 'blue'} style={{ marginLeft: 4 }}>
                        {r.action.priority}
                      </Tag>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
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

                <Select
                  size="small"
                  showSearch
                  optionFilterProp="label"
                  value={cond.attribute || undefined}
                  placeholder="Attribute"
                  className="ruleset-condition__attr"
                  onChange={v => onConditionChange(condIdx, { attribute: v })}
                  options={attributeOptions}
                />

                {cond.attribute && (
                  <>
                    <Select
                      size="small"
                      value={cond.operator || undefined}
                      className="ruleset-condition__op"
                      onChange={v => onConditionChange(condIdx, { operator: v })}
                      options={ops.map(o => ({ value: o.value, label: o.label }))}
                    />
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



