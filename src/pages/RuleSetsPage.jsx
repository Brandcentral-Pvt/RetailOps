import { Spinner } from "@/components/Spinner";
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Input, Select, Space, Tag, Tooltip, Popconfirm, Card,
  Switch, Badge, Pagination, Empty, Spin, Typography, Table, Drawer
} from 'antd';
const { Text } = Typography;
import {
  Plus, Search, Play, Trash2, Copy, SlidersHorizontal, Zap,
  Settings, Activity, RefreshCw, Clock, CheckCircle2, PauseCircle,
  Package, PlayCircle, History
} from 'lucide-react';
import { rulesetApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const RULE_TYPE_OPTIONS = [
  { value: 'ASIN', label: 'ASIN Operations', icon: <Activity size={13} /> },
];

const typeColors = {
  ASIN: { bg: '#ecfdf5', color: '#2E7D32', border: '#a7f3d0' },
};

const TypeBadge = ({ type }) => {
  const c = typeColors[type] || typeColors.ASIN;
  return (
    <span className="badge" style={{
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
      fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
      textTransform: 'uppercase', letterSpacing: '0.03em'
    }}>
      {type || 'ASIN'}
    </span>
  );
};

const RuleSetsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
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
  const [selectedRulesetId, setSelectedRulesetId] = useState(null);
  const [executionHistory, setExecutionHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => { loadRulesets(); }, [page, filterStatus]);

  const loadRulesets = async (silent = false) => {
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
  };

  const loadHistory = async (rulesetId) => {
    setSelectedRulesetId(rulesetId);
    setShowHistoryDrawer(true);
    setHistoryLoading(true);
    try {
      const res = await rulesetApi.getHistory(rulesetId);
      setExecutionHistory(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setHistoryLoading(false);
    }
  };

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

  const handleToggle = async (id) => {
    try {
      await rulesetApi.toggle(id);
      setRulesets(prev => prev.map(r => (r._id === id || r.id === id) ? { ...r, isActive: !r.isActive } : r));
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id) => {
    try {
      await rulesetApi.delete(id);
      setRulesets(prev => prev.filter(r => (r._id !== id && r.id !== id)));
      setTotal(prev => Math.max(0, prev - 1));
    } catch (e) { console.error(e); }
  };

  const handleExecute = async (id) => {
    try {
      setExecuting(id);
      await rulesetApi.execute(id);
      await loadRulesets(true);
    } catch (e) { console.error(e); }
    finally { setExecuting(null); }
  };

  const handleDuplicate = async (id) => {
    try {
      const res = await rulesetApi.duplicate(id);
      const newId = res.data?._id || res.data?.id;
      if (newId) navigate(`/rule-sets/${newId}`);
    } catch (e) { console.error(e); }
  };

  const formatTime = (date) => {
    if (!date) return 'Never';
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  const columns = [
    {
      title: 'Ruleset Name',
      dataIndex: 'name',
      key: 'name',
      width: '28%',
      render: (text, record) => (
        <div>
          <span 
            style={{ fontWeight: 600, color: '#18181b', fontSize: 13, cursor: 'pointer', hoverColor: '#1976D2' }}
            onClick={() => navigate(`/rule-sets/${record._id || record.id}`)}
          >
            {text}
          </span>
          {record.description && (
            <div style={{ fontSize: 11, color: '#71717a', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 320 }} title={record.description}>
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
        return <span style={{ fontSize: 12, fontWeight: 500, color: '#3f3f46' }}>{rules.length} rules</span>;
      }
    },
    {
      title: 'Frequency',
      key: 'schedule',
      width: '12%',
      render: (_, record) => {
        return record.isAutomated ? (
          <Tag style={{ 
            fontSize: 10, 
            fontWeight: 600, 
            borderRadius: 20, 
            padding: '2px 8px', 
            background: '#eff6ff', 
            color: '#1976D2', 
            border: '1px solid #bfdbfe',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4
          }}>
            <Clock size={11} />
            <span>{record.runFrequency || 'Daily'}</span>
          </Tag>
        ) : (
          <Tag style={{ 
            fontSize: 10, 
            fontWeight: 600, 
            borderRadius: 20, 
            padding: '2px 8px', 
            background: '#f4f4f5', 
            color: '#71717a', 
            border: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4
          }}>
            <span>Manual</span>
          </Tag>
        );
      }
    },
    {
      title: 'Runs',
      dataIndex: 'totalRunCount',
      key: 'totalRunCount',
      width: '8%',
      align: 'center',
      render: (count) => <span style={{ fontSize: 12, fontWeight: 600, color: '#18181b' }}>{count || 0}</span>
    },
    {
      title: 'Matched',
      key: 'matched',
      width: '10%',
      align: 'center',
      render: (_, record) => {
        let summary = {};
        try { summary = JSON.parse(record.lastRunSummary || '{}'); } catch {}
        return (
          <span style={{ fontSize: 12, fontWeight: 700, color: (summary.totalMatched > 0) ? '#10b981' : '#71717a' }}>
            {summary.totalMatched || 0}
          </span>
        );
      }
    },
    {
      title: 'Last Run',
      dataIndex: 'lastRunAt',
      key: 'lastRunAt',
      width: '12%',
      render: (date) => (
        <span style={{ fontSize: 11, color: '#71717a' }}>
          {date ? formatTime(date) : 'Never'}
        </span>
      )
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
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
      align: 'right',
      render: (_, record) => (
        <Space size={8}>
          <Tooltip title="Run Now">
            <Button type="text" size="small" icon={<PlayCircle size={14} />}
              loading={executing === (record._id || record.id)}
              onClick={() => handleExecute(record._id || record.id)}
              style={{ color: '#10b981', padding: 0 }} />
          </Tooltip>
          <Tooltip title="Execution History">
            <Button type="text" size="small" icon={<History size={14} />}
              onClick={() => loadHistory(record._id || record.id)}
              style={{ color: '#0288D1', padding: 0 }} />
          </Tooltip>
          <Tooltip title="Duplicate">
            <Button type="text" size="small" icon={<Copy size={14} />}
              onClick={() => handleDuplicate(record._id || record.id)} style={{ color: '#64748b', padding: 0 }} />
          </Tooltip>
          <Tooltip title="Edit">
            <Button type="text" size="small" icon={<SlidersHorizontal size={14} />}
              onClick={() => navigate(`/rule-sets/${record._id || record.id}`)} style={{ color: '#64748b', padding: 0 }} />
          </Tooltip>
          <Popconfirm title="Delete this ruleset?" onConfirm={() => handleDelete(record._id || record.id)} okText="Delete" okButtonProps={{ danger: true }}>
            <Button type="text" danger size="small" icon={<Trash2 size={14} />} style={{ padding: 0 }} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ background: '#fff', minHeight: 'calc(100vh - 60px)' }}>
      {/* Page Header */}
      <div style={{ padding: '20px 28px 16px', borderBottom: '1px solid #f4f4f7' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#18181b', margin: 0 }}>Automation Rules</h2>
            <p style={{ fontSize: 12, color: '#71717a', margin: 0, marginTop: 4 }}>Automated rules for listing quality, pricing, inventory alerts & task creation</p>
          </div>
          <Button type="primary" icon={<Plus size={13} />} onClick={() => navigate('/rule-sets/new')}
            style={{ borderRadius: 8, fontWeight: 600, fontSize: 11, height: 32 }}>
            Create Ruleset
          </Button>
        </div>
      </div>

      <div style={{ padding: '16px 28px' }}>
        {/* KPI Strip */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: '#f4f4f5', borderRadius: 8, border: '1px solid #e4e4e7' }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: '#18181b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={13} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#18181b' }}>{total}</div>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: '#ecfdf5', borderRadius: 8, border: '1px solid #d1fae5' }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: '#2E7D32', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={13} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#2E7D32', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#065f46' }}>{activeCount}</div>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe' }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: '#0288D1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={13} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#0288D1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Auto-run</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#1e40af' }}>{autoCount}</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Input prefix={<Search size={12} style={{ color: '#a1a1aa' }} />}
            placeholder="Search rulesets..." allowClear value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            size="small" style={{ width: 240, borderRadius: 8 }} />
          <Select size="small" value={filterStatus} style={{ width: 120, borderRadius: 8 }}
            onChange={v => { setFilterStatus(v); setPage(1); }}
            options={[
              { value: 'all', label: 'All' },
              { value: 'active', label: 'Active' },
              { value: 'paused', label: 'Paused' },
            ]} />
        </div>

        {/* Content */}
        {loading ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <div style={{ border: '1px solid #e4e4e7', borderRadius: 12, padding: '60px 24px', textAlign: 'center' }}>
            <Empty description={
              <span style={{ color: '#a1a1aa', fontSize: 12 }}>
                {searchQuery ? 'No rulesets match your search' : 'No rulesets yet — create your first automation rule'}
              </span>
            } />
            {!searchQuery && (
              <Button type="primary" icon={<Plus size={13} />} onClick={() => navigate('/rule-sets/new')}
                style={{ borderRadius: 8, fontWeight: 600, fontSize: 11, height: 32, marginTop: 8 }}>
                Create First Ruleset
              </Button>
            )}
          </div>
        ) : (
          <>
            <Table 
              columns={columns} 
              dataSource={filtered} 
              rowKey={(record) => record._id || record.id} 
              pagination={false} 
              size="middle"
              style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 12, overflow: 'hidden' }}
            />

            {total > pageSize && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
                <Pagination size="small" current={page} pageSize={pageSize} total={total}
                  onChange={p => setPage(p)} showSizeChanger={false} />
              </div>
            )}
          </>
        )}
      </div>

      {/* History Drawer */}
      <Drawer title="Execution History" open={showHistoryDrawer} onClose={() => setShowHistoryDrawer(false)}
        width={500} styles={{ body: { padding: '12px 20px' } }}>
        {historyLoading ? <Spin style={{ display: 'block', margin: '40px auto' }} /> : (
          executionHistory.length === 0 ? <Empty description="No execution history yet" /> :
            executionHistory.map((log, i) => {
              let summary = {};
              try { summary = JSON.parse(log.Summary || '{}'); } catch (e) {}
              return (
                <div key={log.Id || i} style={{ padding: '12px 0', borderBottom: '1px solid #f4f4f5' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CheckCircle2 size={14} style={{ color: log.Status === 'SUCCESS' ? '#10b981' : '#ef4444' }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>
                        {log.MatchedCount || 0} matched · {log.ActionedCount || 0} actioned
                      </span>
                    </div>
                    <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>
                      {new Date(log.ExecutedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 4, display: 'flex', gap: 8 }}>
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
