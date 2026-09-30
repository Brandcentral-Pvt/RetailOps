import { Spinner } from '@/components/Spinner';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import {
  Button, Input, Select, Tag, Tooltip,
  Switch, Pagination, Empty, Spin, Table, Drawer, Dropdown, Alert, Modal
} from 'antd';
import { rulesetApi } from '../services/api';
import {
  Plus, Search, PlayCircle, Trash2, Copy, SlidersHorizontal, Zap,
  Activity, RefreshCw, Clock, CheckCircle2, Package, Settings,
  History, Columns, MoreHorizontal, AlertTriangle, XCircle
} from 'lucide-react';
import '../styles/rulesets.css';

const RULE_TYPE_OPTIONS = [
  { value: 'ASIN', label: 'ASIN Operations', icon: <Activity size={13} /> },
];

const typeColors = {
  ASIN: {
    bg: 'var(--bc-status-success-bg)',
    color: 'var(--bc-status-success-text)',
    border: 'var(--bc-border-success)',
  },
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

// A 0 match count is meaningful information ("this rule fired but matched
// nothing"), not an absence, so it stays legible rather than greyed out.
const MatchedCount = ({ matched }) => (
  <span className={matched > 0 ? 'rulesets-count rulesets-count--matched' : 'rulesets-count rulesets-count--zero'}>
    {matched}
  </span>
);

const DENSITY_ORDER = ['compact', 'comfortable', 'roomy'];
const DENSITY_LABELS = { compact: 'Compact', comfortable: 'Comfortable', roomy: 'Roomy' };
const DENSITY_ICONS = { compact: <Package size={12} />, comfortable: <Settings size={12} />, roomy: <Activity size={12} /> };

const pageSize = 20;

const formatTime = (date) => {
  if (!date) return 'Never';
  const d = new Date(date);
  const now = new Date();
  const diff = now - d;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

const parseRules = (raw) => {
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const RuleSetsPage = () => {
  const navigate = useNavigate();
  const [rulesets, setRulesets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [executing, setExecuting] = useState(null);
  const [toggling, setToggling] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [page, setPage] = useState(1);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // History Drawer State
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [historyRulesetName, setHistoryRulesetName] = useState('');
  const [executionHistory, setExecutionHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Density & Column Visibility (mirror ASIN Manager pattern)
  const [rowDensity, setRowDensity] = useState(() => {
    const saved = localStorage.getItem('rulesets-table-density');
    return DENSITY_ORDER.includes(saved) ? saved : 'comfortable';
  });
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const saved = localStorage.getItem('rulesets-visible-columns');
      const parsed = saved ? JSON.parse(saved) : {};
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  });

  const cycleRowDensity = useCallback(() => {
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
    { key: 'name', label: 'Ruleset Name', required: true },
    { key: 'type', label: 'Entity Type' },
    { key: 'rulesCount', label: 'Rules Count' },
    { key: 'frequency', label: 'Frequency' },
    { key: 'runs', label: 'Runs' },
    { key: 'matched', label: 'Matched' },
    { key: 'lastRun', label: 'Last Run' },
    { key: 'status', label: 'Status' },
    { key: 'actions', label: 'Actions', required: true },
  ], []);

  // An explicit `false` is a deliberate hide. Anything absent stays visible,
  // so a stored preference from an older column set can never blank the table.
  const isColumnVisible = useCallback((key) => visibleColumns[key] !== false, [visibleColumns]);

  const loadRulesets = useCallback(async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setLoadError(null);
      // getAllRulesets ignores page/limit and returns the full set, so paging
      // is applied client-side below. No params are sent.
      const res = await rulesetApi.getAll();
      setRulesets(res.data || []);
      setLastRefreshed(new Date());
    } catch (e) {
      setLoadError(e?.message || 'Could not load rulesets');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadRulesets(); }, [loadRulesets]);

  const loadHistory = useCallback(async (rulesetId, rulesetName) => {
    setShowHistoryDrawer(true);
    setHistoryRulesetName(rulesetName || '');
    setHistoryLoading(true);
    setExecutionHistory([]);
    try {
      const res = await rulesetApi.getHistory(rulesetId);
      setExecutionHistory(res.data || []);
    } catch (e) {
      message.error(e?.message || 'Could not load execution history');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const filtered = useMemo(() => {
    let list = rulesets;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(r =>
        (r.name || '').toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q)
      );
    }
    if (filterStatus === 'active') list = list.filter(r => r.isActive);
    if (filterStatus === 'paused') list = list.filter(r => !r.isActive);
    return list;
  }, [rulesets, searchQuery, filterStatus]);

  // The endpoint returns everything at once, so the pager slices client-side
  // and its total is the *filtered* count rather than the unfiltered one.
  const paged = useMemo(() => {
    const total = filtered.length;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, pageCount);
    return {
      total,
      pageCount,
      page: safePage,
      rows: filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
    };
  }, [filtered, page]);

  const activeCount = useMemo(() => rulesets.filter(r => r.isActive).length, [rulesets]);
  const autoCount = useMemo(() => rulesets.filter(r => r.isAutomated).length, [rulesets]);
  const pausedCount = useMemo(() => rulesets.filter(r => !r.isActive).length, [rulesets]);

  const hasActiveFilters = Boolean(searchQuery.trim()) || filterStatus !== 'all';

  // Any filter change invalidates the current page number.
  const applySearch = useCallback((value) => {
    setSearchQuery(value);
    setPage(1);
  }, []);

  const applyStatusFilter = useCallback((value) => {
    setFilterStatus(value);
    setPage(1);
  }, []);

  const handleToggle = useCallback(async (id, nextActive) => {
    setToggling(id);
    const snapshot = rulesets;
    // Optimistic: revert if the request fails.
    setRulesets(prev => prev.map(r => ((r._id || r.id) === id ? { ...r, isActive: nextActive } : r)));
    try {
      await rulesetApi.toggle(id);
    } catch (e) {
      setRulesets(snapshot);
      message.error(e?.message || 'Could not update status');
    } finally {
      setToggling(null);
    }
  }, [rulesets]);

  const handleDelete = useCallback(async (id, name) => {
    setDeleting(id);
    try {
      await rulesetApi.delete(id);
      setRulesets(prev => prev.filter(r => (r._id || r.id) !== id));
      message.success(`Deleted “${name}”`);
    } catch (e) {
      message.error(e?.message || 'Could not delete ruleset');
    } finally {
      setDeleting(null);
    }
  }, []);

  const handleExecute = useCallback(async (id) => {
    setExecuting(id);
    try {
      await rulesetApi.execute(id);
      message.success('Ruleset executed');
      await loadRulesets(true);
    } catch (e) {
      message.error(e?.message || 'Could not execute ruleset');
    } finally {
      setExecuting(null);
    }
  }, [loadRulesets]);

  const handleDuplicate = useCallback(async (id) => {
    try {
      const res = await rulesetApi.duplicate(id);
      const newId = res.data?._id || res.data?.id;
      if (newId) {
        message.success('Ruleset duplicated');
        navigate(`/rule-sets/${newId}`);
      } else {
        message.error('Duplicate did not return a ruleset id');
      }
    } catch (e) {
      message.error(e?.message || 'Could not duplicate ruleset');
    }
  }, [navigate]);

  const columns = useMemo(() => [
    {
      title: 'Ruleset Name',
      dataIndex: 'name',
      key: 'name',
      width: '28%',
      fixed: 'left',
      render: (text, record) => (
        <div className="rulesets-namecell">
          <button
            type="button"
            className="rulesets-name"
            onClick={() => navigate(`/rule-sets/${record._id || record.id}`)}
          >
            {text}
          </button>
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
      responsive: ['xl'],
      render: (type) => <TypeBadge type={type} />
    },
    {
      title: 'Rules',
      key: 'rulesCount',
      width: '9%',
      align: 'center',
      responsive: ['lg'],
      render: (_, record) => {
        const rules = parseRules(record.rules);
        return (
          <span className="rulesets-count" aria-label={`${rules.length} rules`}>
            {rules.length}
          </span>
        );
      }
    },
    {
      title: 'Frequency',
      key: 'frequency',
      width: '12%',
      responsive: ['lg'],
      render: (_, record) => <FrequencyBadge isAutomated={record.isAutomated} runFrequency={record.runFrequency} />
    },
    {
      title: 'Runs',
      dataIndex: 'totalRunCount',
      key: 'runs',
      width: '7%',
      align: 'center',
      responsive: ['xl'],
      render: (count) => <span className="rulesets-count">{count || 0}</span>
    },
    {
      title: 'Matched',
      key: 'matched',
      width: '9%',
      align: 'center',
      responsive: ['xxl'],
      render: (_, record) => {
        let summary;
        try { summary = JSON.parse(record.lastRunSummary || '{}'); } catch { summary = {}; }
        return <MatchedCount matched={summary.totalMatched || 0} />;
      }
    },
    {
      title: 'Last Run',
      dataIndex: 'lastRunAt',
      key: 'lastRun',
      width: '12%',
      render: (date) => (
        <span className="rulesets-lastrun">
          {date ? formatTime(date) : 'Never'}
        </span>
      )
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'status',
      width: '9%',
      align: 'center',
      render: (checked, record) => {
        const id = record._id || record.id;
        const busy = toggling === id;
        return (
          <Tooltip title={checked ? 'Pause this ruleset' : 'Activate this ruleset'}>
            <Switch
              size="small"
              checked={checked}
              loading={busy}
              aria-label={`${checked ? 'Pause' : 'Activate'} ${record.name}`}
              onChange={(next) => handleToggle(id, next)}
            />
          </Tooltip>
        );
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      width: '8%',
      fixed: 'right',
      align: 'right',
      render: (_, record) => {
        const id = record._id || record.id;
        const isExecuting = executing === id;
        const menuItems = [
          { key: 'execute', label: 'Run Now', icon: <PlayCircle size={14} />, disabled: isExecuting, onClick: () => handleExecute(id) },
          { key: 'history', label: 'Execution History', icon: <History size={14} />, onClick: () => loadHistory(id, record.name) },
          { key: 'duplicate', label: 'Duplicate', icon: <Copy size={14} />, onClick: () => handleDuplicate(id) },
          { key: 'edit', label: 'Edit', icon: <SlidersHorizontal size={14} />, onClick: () => navigate(`/rule-sets/${id}`) },
          { type: 'divider' },
          {
            key: 'delete',
            label: 'Delete',
            icon: <Trash2 size={14} />,
            danger: true,
            // Deleting a ruleset discards its rules and execution history with
            // no undo, so it is confirmed rather than fired on one click.
            onClick: () => setPendingDelete({ id, name: record.name }),
          },
        ];
        return (
          <Dropdown menu={{ items: menuItems }} placement="bottomRight" trigger={['click']}>
            <Button
              type="text"
              size="small"
              className="rulesets-kebab"
              icon={<MoreHorizontal size={14} />}
              loading={deleting === id}
              aria-label={`Actions for ${record.name}`}
            />
          </Dropdown>
        );
      }
    }
  // handleDelete is reached via the pendingDelete confirm modal rather than
  // directly from a column, so it is not a dependency here.
  ].filter(c => isColumnVisible(c.key)), [isColumnVisible, handleToggle, handleExecute, handleDuplicate, loadHistory, navigate, executing, toggling, deleting]);

  // Deleting a ruleset also discards its rules and execution history, and the
  // API offers no undo, so the destructive action is confirmed first.
  const confirmDelete = useCallback(() => {
    if (!pendingDelete) return;
    const { id, name } = pendingDelete;
    setPendingDelete(null);
    handleDelete(id, name);
  }, [pendingDelete, handleDelete]);

  return (
    <div className="rulesets-page">
      {/* Toolbar */}
      <div className="rulesets-toolbar">
        <div className="rulesets-toolbar__left">
          <div className="rulesets-toolbar__heading">
            <h2 className="rulesets-toolbar__title">Automation Rules</h2>
            <p className="rulesets-toolbar__subtitle">Automated rules for listing quality, pricing, inventory alerts &amp; task creation</p>
          </div>
        </div>
        <div className="rulesets-toolbar__right">
          {lastRefreshed && (
            <span className="rulesets-toolbar__stamp">
              Updated{' '}
              {lastRefreshed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <Tooltip title="Column Visibility">
            <Dropdown
              menu={{
                items: columnDefs.map(c => ({
                  key: c.key,
                  label: c.label,
                  // The name and action columns are structural — hiding them
                  // would strand rows with no way to open or act on a ruleset.
                  disabled: c.required,
                  icon: isColumnVisible(c.key) ? <CheckCircle2 size={14} className="rulesets-check" /> : null,
                  onClick: () => toggleColumn(c.key),
                }))
              }}
              placement="bottomRight"
              trigger={['click']}
            >
              <Button
                type="text"
                size="small"
                className="rulesets-iconbtn"
                icon={<Columns size={14} />}
                aria-label="Column visibility"
              />
            </Dropdown>
          </Tooltip>
          <Tooltip title={`Row Density: ${DENSITY_LABELS[rowDensity]}. Click to cycle.`}>
            <Button
              type="text"
              size="small"
              className="rulesets-iconbtn"
              icon={DENSITY_ICONS[rowDensity]}
              onClick={cycleRowDensity}
              aria-label={`Row density: ${DENSITY_LABELS[rowDensity]}`}
            />
          </Tooltip>
          <Tooltip title="Refresh">
            <Button
              type="text"
              size="small"
              className="rulesets-iconbtn"
              icon={<RefreshCw size={14} className={refreshing ? 'rulesets-spin' : undefined} />}
              onClick={() => loadRulesets(true)}
              loading={refreshing}
              aria-label="Refresh rulesets"
            />
          </Tooltip>
          <Button
            type="primary"
            className="rulesets-cta"
            icon={<Plus size={13} />}
            onClick={() => navigate('/rule-sets/new')}
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
            <div className="rulesets-kpi__value">{rulesets.length}</div>
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
        <div className="rulesets-kpi__item">
          <div className="rulesets-kpi__icon rulesets-kpi__icon--paused"><AlertTriangle size={14} /></div>
          <div>
            <div className="rulesets-kpi__label">Paused</div>
            <div className="rulesets-kpi__value">{pausedCount}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rulesets-filters">
        <Input
          prefix={<Search size={12} className="rulesets-searchicon" />}
          placeholder="Search rulesets..."
          allowClear
          value={searchQuery}
          onChange={e => applySearch(e.target.value)}
          size="small"
          aria-label="Search rulesets"
          className="rulesets-search"
        />
        <Select
          size="small"
          value={filterStatus}
          onChange={applyStatusFilter}
          aria-label="Filter by status"
          className="rulesets-statusfilter"
          options={[
            { value: 'all', label: 'All' },
            { value: 'active', label: 'Active' },
            { value: 'paused', label: 'Paused' },
          ]}
        />
        {hasActiveFilters && (
          <Button
            type="text"
            size="small"
            className="rulesets-clearfilters"
            onClick={() => { applySearch(''); applyStatusFilter('all'); }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="rulesets-content">
        {loadError ? (
          <Alert
            className="rulesets-error"
            type="error"
            showIcon
            icon={<XCircle size={16} />}
            message="Could not load rulesets"
            description={loadError}
            action={<Button size="small" onClick={() => loadRulesets()}>Retry</Button>}
          />
        ) : loading ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <div className="rulesets-empty">
            {hasActiveFilters ? (
              <>
                <Empty
                  description={
                    <span className="rulesets-empty__desc">
                      {searchQuery.trim()
                        ? 'No rulesets match your search'
                        : `No ${filterStatus} rulesets`}
                    </span>
                  }
                />
                <Button
                  type="text"
                  className="rulesets-empty__action"
                  onClick={() => { applySearch(''); applyStatusFilter('all'); }}
                >
                  Clear filters
                </Button>
              </>
            ) : (
              <>
                <Empty
                  description={
                    <span className="rulesets-empty__desc">
                      No rulesets yet — create your first automation rule
                    </span>
                  }
                />
                <Button
                  type="primary"
                  className="rulesets-cta rulesets-empty__action"
                  icon={<Plus size={13} />}
                  onClick={() => navigate('/rule-sets/new')}
                >
                  Create First Ruleset
                </Button>
              </>
            )}
          </div>
        ) : (
          <>
            <div
              className="rulesets-tablewrap"
              data-density={rowDensity}
            >
              <Table
                className="rulesets-table"
                columns={columns}
                dataSource={paged.rows}
                rowKey={(record) => record._id || record.id}
                pagination={false}
                size="middle"
                scroll={{ x: 'max-content' }}
                rowClassName={(record) => (record.isActive ? '' : 'is-disabled')}
              />
            </div>

            {paged.total > pageSize && (
              <div className="rulesets-pagination">
                <Pagination
                  size="small"
                  current={paged.page}
                  pageSize={pageSize}
                  total={paged.total}
                  onChange={p => setPage(p)}
                  showSizeChanger={false}
                />
              </div>
            )}
          </>
        )}
      </div>

      <Modal
        title="Delete this ruleset?"
        open={Boolean(pendingDelete)}
        onOk={confirmDelete}
        onCancel={() => setPendingDelete(null)}
        okText="Delete"
        cancelText="Cancel"
        okButtonProps={{ danger: true }}
        destroyOnHidden
      >
        <p className="rulesets-confirmbody">
          <strong>{pendingDelete?.name}</strong> and its execution history will be permanently removed.
          This cannot be undone.
        </p>
      </Modal>

      {/* History Drawer */}
      <Drawer
        className="rulesets-drawer"
        title={historyRulesetName ? `Execution History — ${historyRulesetName}` : 'Execution History'}
        open={showHistoryDrawer}
        onClose={() => setShowHistoryDrawer(false)}
        width={520}
      >
        {historyLoading ? (
          <Spin className="rulesets-drawerspin" />
        ) : executionHistory.length === 0 ? (
          <Empty description="No execution history yet" />
        ) : (
          executionHistory.map((log, i) => {
            let summary;
            try { summary = JSON.parse(log.Summary || '{}'); } catch { summary = {}; }
            const failed = log.Status !== 'SUCCESS';
            return (
              <div key={log.Id || i} className="rulesets-drawer__item">
                <div className="rulesets-drawer__header">
                  <div className="rulesets-drawer__status">
                    {failed
                      ? <XCircle size={14} className="rulesets-drawer__status-icon rulesets-drawer__status-icon--fail" />
                      : <CheckCircle2 size={14} className="rulesets-drawer__status-icon rulesets-drawer__status-icon--ok" />}
                    <span className="rulesets-drawer__status-text">
                      {failed ? 'Failed' : `${log.MatchedCount || 0} matched · ${log.ActionedCount || 0} actioned`}
                    </span>
                  </div>
                  <span className="rulesets-drawer__time">
                    {new Date(log.ExecutedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="rulesets-drawer__meta">
                  <span>Trigger: <strong className="rulesets-drawer__trigger">{log.TriggeredBy}</strong></span>
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
