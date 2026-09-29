import { Spinner } from '@/components/Spinner';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Input, Select, Space, Tag, Tooltip, Popconfirm, Card,
  Switch, Badge, Pagination, Empty, Spin, Typography, Table, Drawer, Dropdown, Menu
} from 'antd';
import { useAuth } from '../contexts/AuthContext';
import { rulesetApi } from '../services/api';
import {
  Plus, Search, PlayCircle, Trash2, Copy, SlidersHorizontal, Zap,
  Settings, Activity, RefreshCw, Clock, CheckCircle2, PauseCircle,
  Package, History, Columns, Filter, MoreHorizontal, ChevronDown
} from 'lucide-react';
import '../styles/rulesets.css';

const { Text } = Typography;

const RULE_TYPE_OPTIONS = [
  { value: 'ASIN', label: 'ASIN Operations', icon: <Activity size={13} /> },
];

const typeColors = {
  ASIN: { bg: 'var(--bc-success-subtle)', color: 'var(--bc-success)', border: 'var(--bc-success-border)' },
};

const TypeBadge = ({ type }) => {
  const c = typeColors[type] || typeColors.ASIN;
  return (
    <Tag className="rulesets-badge" style={{ background: c.bg, color: c.color, borderColor: c.border }}>
      {type || 'ASIN'}
    </Tag>
  );
};

const FrequencyBadge = ({ isAutomated, runFrequency }) => {
  if (isAutomated) {
    return (
      <Tag className="rulesets-badge rulesets-badge--auto">
        <Clock size={11} />
        <span>{runFrequency || 'Daily'}</span>
      </Tag>
    );
  }
  return (
    <Tag className="rulesets-badge rulesets-badge--manual">
      <span>Manual</span>
    </Tag>
  );
};

const StatusBadge = ({ matched }) => {
  return (
    <Badge className="rulesets-badge rulesets-badge--status" count={matched} showZero style={{ minWidth: 36, justifyContent: 'center' }} />
  );
};

const RuleSetsPage = () => {
  const navigate = useNavigate();
  const { user: _user } = useAuth();
  const [rulesets, setRulesets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [executing, setExecuting] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  // History Drawer State
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [executionHistory, setExecutionHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Density & Column Visibility (mirror ASIN Manager pattern)
  const [rowDensity, setRowDensity] = useState(() => {
    const saved = localStorage.getItem('rulesets-table-density');
    return saved || 'comfortable';
  });
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const saved = localStorage.getItem('rulesets-visible-columns');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  const DENSITY_ORDER = ['compact', 'comfortable', 'roomy'];
  const DENSITY_LABELS = { compact: 'Compact', comfortable: 'Comfortable', roomy: 'Roomy' };
  const DENSITY_ICONS = { compact: <Package size={12} />, comfortable: <Settings size={12} />, roomy: <Activity size={12} /> };

  const cycleRowDensity = useCallback(() => {
    const DENSITY_ORDER = ['compact', 'comfortable', 'roomy'];
    setRowDensity(prev => {
      const next = DENSITY_ORDER[(DENSITY_ORDER.indexOf(prev) + 1) % DENSITY_ORDER.length];
      localStorage.setItem('rulesets-table-density', next);
      return next;
    });
  }, []);

  const toggleColumn = useCallback((key) => {
    setVisibleColumns(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem('rulesets-visible-columns', JSON.stringify(next));
      return next;
    });
  }, []);

  const columnDefs = useMemo(() => [
    { key: 'name', label: 'Ruleset Name', defaultVisible: true },
    { key: 'type', label: 'Entity Type', defaultVisible: true },
    { key: 'rulesCount', label: 'Rules Count', defaultVisible: true },
    { key: 'frequency', label: 'Frequency', defaultVisible: true },
    { key: 'runs', label: 'Runs', defaultVisible: true },
    { key: 'matched', label: 'Matched', defaultVisible: true },
    { key: 'lastRun', label: 'Last Run', defaultVisible: true },
    { key: 'status', label: 'Status', defaultVisible: true },
    { key: 'actions', label: 'Actions', defaultVisible: true },
  ], []);

  const isColumnVisible = useCallback((key) => {
    if (!visibleColumns || Object.keys(visibleColumns).length === 0) return true;
    return visibleColumns[key] !== false;
  }, [visibleColumns]);

  const loadRulesets = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const params = { page, limit: pageSize };
      const res = await rulesetApi.getAll(params);
      setRulesets(res.data || []);
      setTotal(res.pagination?.total || (res.data || []).length);
    } catch (e) {
      console.error(e);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [page]);

  useEffect(() => { loadRulesets(); }, [page, filterStatus]);

  const loadHistory = useCallback(async (rulesetId) => {
    setShowHistoryDrawer(true);
    setHistoryLoading(true);
    try {
      const res = await rulesetApi.getHistory(rulesetId);
      setExecutionHistory(res.data || []);
    } catch (_e) { console.error(_e); }
    finally { setHistoryLoading(false); }
  }, []);

  const filtered = useMemo(() => {
    let list = rulesets;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(r => (r.name || '').toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q));
    }
    if (filterStatus === 'active') list = list.filter(r => r.isActive);
    if (filterStatus === 'paused') list = list.filter(r => !r.isActive);
    return list;
  }, [rulesets, searchQuery, filterStatus]);

  const activeCount = useMemo(() => rulesets.filter(r => r.isActive).length, [rulesets]);
  const autoCount = useMemo(() => rulesets.filter(r => r.isAutomated).length, [rulesets]);

  const handleToggle = useCallback(async (id) => {
    try {
      await rulesetApi.toggle(id);
      setRulesets(prev => prev.map(r => (r._id === id || r.id === id) ? { ...r, isActive: !r.isActive } : r));
    } catch (_e) { console.error(_e); }
  }, []);

  const handleDelete = useCallback(async (id) => {
    try {
      await rulesetApi.delete(id);
      setRulesets(prev => prev.filter(r => (r._id !== id && r.id !== id)));
      setTotal(prev => Math.max(0, prev - 1));
    } catch (_e) { console.error(_e); }
  }, []);

  const handleExecute = useCallback(async (id) => {
    try {
      setExecuting(id);
      await rulesetApi.execute(id);
      await loadRulesets(true);
    } catch (_e) { console.error(_e); }
    finally { setExecuting(null); }
  }, [loadRulesets]);

  const handleDuplicate = useCallback(async (id) => {
    try {
      const res = await rulesetApi.duplicate(id);
      const newId = res.data?._id || res.data?.id;
      if (newId) navigate(`/rule-sets/${newId}`);
    } catch (_e) { console.error(_e); }
  }, [navigate]);

  const formatTime = (date) => {
    if (!date) return 'Never';
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  const columns = useMemo(() => [
    {
      title: 'Ruleset Name',
      dataIndex: 'name',
      key: 'name',
      width: '28%',
      fixed: 'left',
      render: (text, record) => (
        <div>
          <span className="rulesets-name" style={{ cursor: 'pointer' }} onClick={() => navigate(`/rule-sets/${record._id || record.id}`)}>
            {text}
          </span>
          {record.description && (
            <div className="rulesets-desc" title={record.description}>
              {record.description}
            </div>
          )}
        </div>
      )
    },
    {
      title: 'Entity Type',
      dataIndex: 'type',
      key: 'type',
      width: '12%',
      render: (type) => <TypeBadge type={type} />
    },
    {
      title: 'Rules Count',
      key: 'rulesCount',
      width: '10%',
      render: (_, record) => {
        const rules = (() => { try { return JSON.parse(record.rules || '[]'); } catch { return []; } })();
        return <span className="rulesets-count">{rules.length} rules</span>;
      }
    },
    {
      title: 'Frequency',
      key: 'frequency',
      width: '12%',
      render: (_, record) => <FrequencyBadge isAutomated={record.isAutomated} runFrequency={record.runFrequency} />
    },
    {
      title: 'Runs',
      dataIndex: 'totalRunCount',
      key: 'runs',
      width: '8%',
      align: 'center',
      render: (count) => <span className="rulesets-count">{count || 0}</span>
    },
    {
      title: 'Matched',
      key: 'matched',
      width: '10%',
      align: 'center',
      render: (_, record) => {
        let summary = {};
        try { summary = JSON.parse(record.lastRunSummary || '{}'); } catch (_e) { void _e; }
        return <StatusBadge matched={summary.totalMatched || 0} />;
      }
    },
    {
      title: 'Last Run',
      dataIndex: 'lastRunAt',
      key: 'lastRun',
      width: '12%',
      render: (date) => (
        <span style={{ fontSize: 'var(--bc-font-size-xs)', color: 'var(--bc-text-secondary)' }}>
          {date ? formatTime(date) : 'Never'}
        </span>
      )
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'status',
      width: '8%',
      align: 'center',
      render: (checked, record) => (
        <Switch size="small" checked={checked} onChange={() => handleToggle(record._id || record.id)} />
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      width: '10%',
      fixed: 'right',
      align: 'right',
      render: (_, record) => {
        const id = record._id || record.id;
        const isExecuting = executing === id;
        const menuItems = [
          { key: 'execute', label: 'Run Now', icon: <PlayCircle size={14} />, disabled: isExecuting, onClick: () => handleExecute(id) },
          { key: 'history', label: 'Execution History', icon: <History size={14} />, onClick: () => loadHistory(id) },
          { key: 'duplicate', label: 'Duplicate', icon: <Copy size={14} />, onClick: () => handleDuplicate(id) },
          { key: 'edit', label: 'Edit', icon: <SlidersHorizontal size={14} />, onClick: () => navigate(`/rule-sets/${id}`) },
          { type: 'divider' },
          { key: 'delete', label: 'Delete', icon: <Trash2 size={14} />, danger: true, onClick: () => handleDelete(id) },
        ];
        return (
          <Space size={4}>
            <Dropdown
              menu={{ items: menuItems }}
              placement="bottomRight"
              trigger={['click']}
            >
              <Button type="text" size="small" icon={<MoreHorizontal size={14} />} style={{ padding: 0, color: 'var(--bc-text-muted)' }} />
            </Dropdown>
          </Space>
        );
      }
    }
  ].filter(c => isColumnVisible(c.key)), [isColumnVisible, handleToggle, handleDelete, handleExecute, handleDuplicate, loadHistory, navigate, executing]);

  return (
    <div className="rulesets-page">
      {/* Toolbar */}
      <div className="rulesets-toolbar">
        <div className="rulesets-toolbar__left">
          <div>
            <h2 className="rulesets-toolbar__title">Automation Rules</h2>
            <p className="rulesets-toolbar__subtitle">Automated rules for listing quality, pricing, inventory alerts & task creation</p>
          </div>
        </div>
        <div className="rulesets-toolbar__right">
          {/* Column Visibility */}
          <Dropdown
            menu={{
              items: columnDefs.map(c => ({
                key: c.key,
                label: c.label,
                icon: isColumnVisible(c.key) ? <CheckCircle2 size={14} style={{ color: 'var(--bc-success)' }} /> : null,
                onClick: () => toggleColumn(c.key)
              }))
            }}
            placement="bottomRight"
            trigger={['click']}
          >
            <Tooltip title="Column Visibility">
              <Button type="text" size="small" icon={<Columns size={14} />} style={{ padding: 0, color: 'var(--bc-text-muted)', borderRadius: 'var(--radius-md)' }} />
            </Tooltip>
          </Dropdown>
          {/* Density */}
          <Tooltip title={`Row Density: ${DENSITY_LABELS[rowDensity]}. Click to cycle.`}>
            <Button
              type="text"
              size="small"
              icon={DENSITY_ICONS[rowDensity]}
              onClick={cycleRowDensity}
              style={{ padding: 0, color: 'var(--bc-text-muted)', borderRadius: 'var(--radius-md)' }}
            />
          </Tooltip>
          <Button
            type="primary"
            icon={<Plus size={13} />}
            onClick={() => navigate('/rule-sets/new')}
            style={{ borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: 'var(--bc-font-size-xs)', height: 32 }}
          >
            Create Ruleset
          </Button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="rulesets-kpi">
        <div className="rulesets-kpi__item">
          <div className="rulesets-kpi__icon rulesets-kpi__icon--total"><Zap size={14} /></div>
          <div>
            <div className="rulesets-kpi__label">Total</div>
            <div className="rulesets-kpi__value">{total}</div>
          </div>
        </div>
        <div className="rulesets-kpi__item">
          <div className="rulesets-kpi__icon rulesets-kpi__icon--active"><CheckCircle2 size={14} /></div>
          <div>
            <div className="rulesets-kpi__label">Active</div>
            <div className="rulesets-kpi__value">{activeCount}</div>
          </div>
        </div>
        <div className="rulesets-kpi__item">
          <div className="rulesets-kpi__icon rulesets-kpi__icon--auto"><Activity size={14} /></div>
          <div>
            <div className="rulesets-kpi__label">Auto-run</div>
            <div className="rulesets-kpi__value">{autoCount}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rulesets-filters">
        <Input
          prefix={<Search size={12} style={{ color: 'var(--bc-text-muted)' }} />}
          placeholder="Search rulesets..."
          allowClear
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          size="small"
          style={{ width: 240 }}
        />
        <Select
          size="small"
          value={filterStatus}
          style={{ width: 120 }}
          onChange={v => { setFilterStatus(v); setPage(1); }}
          options={[
            { value: 'all', label: 'All' },
            { value: 'active', label: 'Active' },
            { value: 'paused', label: 'Paused' },
          ]}
        />
      </div>

      {/* Content */}
      <div style={{ padding: '0 var(--bc-space-5) var(--bc-space-5)' }}>
        {loading ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <div className="rulesets-empty">
            <Empty
              description={
                <span style={{ color: 'var(--bc-text-muted)', fontSize: 'var(--bc-font-size-sm)' }}>
                  {searchQuery ? 'No rulesets match your search' : 'No rulesets yet — create your first automation rule'}
                </span>
              }
            />
            {!searchQuery && (
              <Button
                type="primary"
                icon={<Plus size={13} />}
                onClick={() => navigate('/rule-sets/new')}
                style={{ borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: 'var(--bc-font-size-xs)', height: 32 }}
              >
                Create First Ruleset
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="rulesets-scroll">
              <Table
                className="rulesets-table"
                columns={columns}
                dataSource={filtered}
                rowKey={(record) => record._id || record.id}
                pagination={false}
                size="middle"
                rowClassName={(record) => {
                  const cls = [];
                  if (!record.isActive) cls.push('is-disabled');
                  return cls.join(' ');
                }}
              />
            </div>

            {total > pageSize && (
              <div className="rulesets-pagination">
                <Pagination size="small" current={page} pageSize={pageSize} total={total}
                  onChange={p => setPage(p)} showSizeChanger={false} />
              </div>
            )}
          </>
        )}
      </div>

      {/* History Drawer */}
      <Drawer
        className="rulesets-drawer"
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
            try { summary = JSON.parse(log.Summary || '{}'); } catch (_e) { void _e; }
            return (
              <div key={log.Id || i} className="rulesets-drawer__item">
                <div className="rulesets-drawer__header">
                  <div className="rulesets-drawer__status">
                    <CheckCircle2 className="rulesets-drawer__status-icon" style={{ color: log.Status === 'SUCCESS' ? 'var(--bc-success)' : 'var(--bc-danger)' }} />
                    <span className="rulesets-drawer__status-text">
                      {log.MatchedCount || 0} matched · {log.ActionedCount || 0} actioned
                    </span>
                  </div>
                  <span className="rulesets-drawer__time">
                    {new Date(log.ExecutedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="rulesets-drawer__meta">
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

export default RuleSetsPage;

