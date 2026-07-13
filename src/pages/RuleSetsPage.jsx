import { Spinner } from "@/components/Spinner";
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Input, Select, Space, Tag, Tooltip, Popconfirm, Card,
  Switch, Badge, Pagination, Empty, Typography
} from 'antd';
const { Text } = Typography;
import {
  Plus, Search, Trash2, Copy, SlidersHorizontal, Zap,
  Activity, Clock, CheckCircle2, PlayCircle, AlertTriangle,
  RefreshCw, BarChart3, TrendingUp
} from 'lucide-react';
import { rulesetApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { usePageTitle } from '../contexts/PageTitleContext';
import toast from '../utils/toast';

const RULE_TYPE_OPTIONS = [
  { value: 'ASIN', label: 'ASIN Operations', icon: <Activity size={13} /> },
  { value: 'PRICE', label: 'Price Disputes', icon: <AlertTriangle size={13} /> },
  { value: 'INVENTORY', label: 'Inventory', icon: <ShoppingBag size={13} /> },
];

const typeColors = {
  ASIN: { bg: '#ecfdf5', color: '#2E7D32', border: '#a7f3d0' },
  PRICE: { bg: '#fef2f2', color: '#C62828', border: '#fecaca' },
  INVENTORY: { bg: '#fffbeb', color: '#ED6C02', border: '#fed7aa' },
};

const TypeBadge = ({ type }) => {
  const c = typeColors[type] || typeColors.ASIN;
  return (
    <span style={{
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
      fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
      textTransform: 'uppercase', letterSpacing: '0.03em'
    }}>
      {type || 'ASIN'}
    </span>
  );
};

const ShoppingBag = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
    <line x1="3" y1="6" x2="21" y2="6"></line>
    <path d="M16 10a4 4 0 0 1-8 0"></path>
  </svg>
);

const RuleSetsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setPageTitle } = usePageTitle();
  const [rulesets, setRulesets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [executing, setExecuting] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRulesetName, setNewRulesetName] = useState('');
  const [newRulesetType, setNewRulesetType] = useState('ASIN');
  const pageSize = 12;

  useEffect(() => { setPageTitle('Automation Rules'); }, [setPageTitle]);
  useEffect(() => { loadRulesets(); }, [page, filterStatus, filterType]);

  const loadRulesets = async () => {
    try {
      setLoading(true);
      const params = { page, limit: pageSize };
      if (filterStatus !== 'all') params.isActive = filterStatus === 'active';
      if (filterType !== 'all') params.type = filterType;
      if (searchQuery) params.search = searchQuery;
      const res = await rulesetApi.getAll(params);
      setRulesets(res.data || []);
      setTotal(res.pagination?.total || (res.data || []).length);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load rulesets');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let list = rulesets;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(r => (r.name || '').toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q));
    }
    return list;
  }, [rulesets, searchQuery]);

  const activeCount = useMemo(() => rulesets.filter(r => r.isActive).length, [rulesets]);
  const autoCount = useMemo(() => rulesets.filter(r => r.isAutomated).length, [rulesets]);

  const handleToggle = async (id) => {
    try {
      await rulesetApi.toggle(id);
      setRulesets(prev => prev.map(r => (r._id === id || r.id === id) ? { ...r, isActive: !r.isActive } : r));
      toast.success('Ruleset toggled');
    } catch (e) { toast.error('Failed to toggle ruleset'); }
  };

  const handleDelete = async (id) => {
    try {
      await rulesetApi.delete(id);
      setRulesets(prev => prev.filter(r => (r._id !== id && r.id !== id)));
      setTotal(prev => Math.max(0, prev - 1));
      toast.success('Ruleset deleted');
    } catch (e) { toast.error('Failed to delete ruleset'); }
  };

  const handleExecute = async (id) => {
    try {
      setExecuting(id);
      toast.loading('Executing ruleset...');
      await rulesetApi.execute(id);
      toast.success('Ruleset executed successfully');
      loadRulesets();
    } catch (e) { 
      toast.error('Failed to execute ruleset');
    } finally { 
      setExecuting(null); 
    }
  };

  const handleDuplicate = async (id) => {
    try {
      const res = await rulesetApi.duplicate(id);
      const newId = res.data?._id || res.data?.id;
      if (newId) {
        toast.success('Ruleset duplicated');
        navigate(`/rule-sets/${newId}`);
      }
    } catch (e) { toast.error('Failed to duplicate ruleset'); }
  };

  const handleCreate = async () => {
    if (!newRulesetName.trim()) {
      toast.warning('Please enter a name');
      return;
    }
    try {
      const res = await rulesetApi.create({
        name: newRulesetName,
        type: newRulesetType,
        rules: [],
        isActive: false
      });
      const newId = res.data?._id || res.data?.id;
      if (newId) {
        toast.success('Ruleset created');
        setShowCreateModal(false);
        setNewRulesetName('');
        navigate(`/rule-sets/${newId}`);
      }
    } catch (e) { toast.error('Failed to create ruleset'); }
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

  const btnStyle = { borderRadius: 8, fontWeight: 600, fontSize: 11, height: 32 };

  return (
    <div style={{ background: '#f4f5f7', minHeight: '100%', padding: '16px 24px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#18181b', margin: 0 }}>Automation Rules</h2>
          <p style={{ fontSize: 12, color: '#71717a', margin: 0, marginTop: 4 }}>Automated rules for listing quality, pricing, inventory alerts & task creation</p>
        </div>
        <Button type="primary" icon={<Plus size={13} />} onClick={() => setShowCreateModal(true)} style={btnStyle}>
          Create Ruleset
        </Button>
      </div>

      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#fff', borderRadius: 10, border: '1px solid #e4e4e7' }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#18181b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={16} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase' }}>Total Rulesets</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#18181b' }}>{total}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#fff', borderRadius: 10, border: '1px solid #e4e4e7' }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#2E7D32', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={16} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase' }}>Active</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#2E7D32' }}>{activeCount}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#fff', borderRadius: 10, border: '1px solid #e4e4e7' }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={16} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase' }}>Auto-run</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#4F46E5' }}>{autoCount}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card size="small" style={{ marginBottom: 16, borderRadius: 10 }} styles={{ body: { padding: '12px 16px' } }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Input prefix={<Search size={12} style={{ color: '#a1a1aa' }} />}
            placeholder="Search rulesets..." allowClear value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            size="small" style={{ width: 220, borderRadius: 8 }} />
          <Select size="small" value={filterStatus} style={{ width: 120, borderRadius: 8 }}
            onChange={v => { setFilterStatus(v); setPage(1); }}
            options={[
              { value: 'all', label: 'All Status' },
              { value: 'active', label: 'Active' },
              { value: 'paused', label: 'Paused' },
            ]} />
          <Select size="small" value={filterType} style={{ width: 150, borderRadius: 8 }}
            onChange={v => { setFilterType(v); setPage(1); }}
            options={[
              { value: 'all', label: 'All Types' },
              ...RULE_TYPE_OPTIONS
            ]} />
          <Button size="small" icon={<RefreshCw size={13} />} onClick={loadRulesets} style={btnStyle}>Refresh</Button>
        </div>
      </Card>

      {/* Content */}
      {loading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <Card style={{ borderRadius: 10, padding: '60px 24px', textAlign: 'center' }}>
          <Empty description={
            <span style={{ color: '#a1a1aa', fontSize: 12 }}>
              {searchQuery ? 'No rulesets match your search' : 'No rulesets yet — create your first automation rule'}
            </span>
          } />
          {!searchQuery && (
            <Button type="primary" icon={<Plus size={13} />} onClick={() => setShowCreateModal(true)} style={{ ...btnStyle, marginTop: 12 }}>
              Create First Ruleset
            </Button>
          )}
        </Card>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
            {filtered.map(rs => {
              const rules = (() => { try { return JSON.parse(rs.rules || '[]'); } catch { return []; } })();
              let summary = {};
              try { summary = JSON.parse(rs.lastRunSummary || '{}'); } catch {}

              return (
                <Card key={rs._id || rs.id} size="small" style={{ borderRadius: 10, border: '1px solid #e4e4e7' }}
                  styles={{ body: { padding: 0 } }}
                  title={
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <Text style={{ fontSize: 13, fontWeight: 700, color: '#18181b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {rs.name}
                          </Text>
                          <TypeBadge type={rs.type} />
                        </div>
                        {rs.description && (
                          <Text style={{ fontSize: 11, color: '#71717a', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {rs.description}
                          </Text>
                        )}
                      </div>
                      <Switch size="small" checked={rs.isActive} onChange={() => handleToggle(rs._id || rs.id)} />
                    </div>
                  }
                  extra={
                    <Space size={4}>
                      <Tooltip title="Run Now">
                        <Button type="text" size="small" icon={<PlayCircle size={13} />}
                          loading={executing === (rs._id || rs.id)}
                          onClick={() => handleExecute(rs._id || rs.id)}
                          style={{ color: '#2E7D32' }} />
                      </Tooltip>
                      <Tooltip title="Duplicate">
                        <Button type="text" size="small" icon={<Copy size={13} />}
                          onClick={() => handleDuplicate(rs._id || rs.id)} />
                      </Tooltip>
                      <Tooltip title="Edit">
                        <Button type="text" size="small" icon={<SlidersHorizontal size={13} />}
                          onClick={() => navigate(`/rule-sets/${rs._id || rs.id}`)} />
                      </Tooltip>
                      <Popconfirm title="Delete this ruleset?" onConfirm={() => handleDelete(rs._id || rs.id)} okText="Delete" okButtonProps={{ danger: true }}>
                        <Button type="text" danger size="small" icon={<Trash2 size={13} />} />
                      </Popconfirm>
                    </Space>
                  }
                >
                  <div style={{ padding: '0 16px 12px' }}>
                    <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Text style={{ fontSize: 10, color: '#a1a1aa' }}>Rules</Text>
                        <Text style={{ fontSize: 11, fontWeight: 700, color: '#18181b' }}>{rules.length}</Text>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Text style={{ fontSize: 10, color: '#a1a1aa' }}>Runs</Text>
                        <Text style={{ fontSize: 11, fontWeight: 700, color: '#18181b' }}>{rs.totalRunCount || 0}</Text>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Text style={{ fontSize: 10, color: '#a1a1aa' }}>Matched</Text>
                        <Text style={{ fontSize: 11, fontWeight: 700, color: '#2E7D32' }}>{summary.totalMatched || 0}</Text>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      {rs.isAutomated ? (
                        <Tag style={{ fontSize: 9, borderRadius: 4, padding: '1px 6px', margin: 0, background: '#eff6ff', color: '#4F46E5', border: 'none' }}>
                          <Clock size={9} style={{ marginRight: 2 }} />{rs.runFrequency || 'Daily'}
                        </Tag>
                      ) : (
                        <Tag style={{ fontSize: 9, borderRadius: 4, padding: '1px 6px', margin: 0, background: '#f4f4f5', color: '#71717a', border: 'none' }}>Manual</Tag>
                      )}
                      <Text style={{ fontSize: 10, color: '#a1a1aa' }}>
                        {rs.lastRunAt ? formatTime(rs.lastRunAt) : 'Never run'}
                      </Text>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {total > pageSize && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
              <Pagination size="small" current={page} pageSize={pageSize} total={total}
                onChange={p => setPage(p)} showSizeChanger={false} />
            </div>
          )}
        </>
      )}

      {/* Create Modal */}
      <Modal open={showCreateModal} onCancel={() => setShowCreateModal(false)} title="Create Ruleset"
        footer={[
          <Button key="cancel" onClick={() => setShowCreateModal(false)} style={btnStyle}>Cancel</Button>,
          <Button key="create" type="primary" onClick={handleCreate} style={btnStyle}>Create</Button>
        ]}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <Text style={{ fontSize: 11, fontWeight: 600, color: '#71717a', marginBottom: 4 }}>Name *</Text>
            <Input placeholder="Enter ruleset name" value={newRulesetName} onChange={e => setNewRulesetName(e.target.value)} style={{ borderRadius: 8 }} />
          </div>
          <div>
            <Text style={{ fontSize: 11, fontWeight: 600, color: '#71717a', marginBottom: 4 }}>Type *</Text>
            <Select value={newRulesetType} onChange={setNewRulesetType} style={{ width: '100%', borderRadius: 8 }}
              options={RULE_TYPE_OPTIONS} />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default RuleSetsPage;
