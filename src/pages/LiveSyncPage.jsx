import { Spinner } from "@/components/Spinner";
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Row, Col, Table, Tag, Typography, Space, Button, Progress, Empty, Tooltip, Tabs, Input, Checkbox, Select, message, Statistic, Badge } from 'antd';
import {
  ReloadOutlined, DownloadOutlined, SearchOutlined, ThunderboltOutlined,
  TableOutlined, ShopOutlined, CheckCircleOutlined, ClockCircleOutlined,
  SyncOutlined, SettingOutlined, BarChartOutlined, PlayCircleOutlined,
  ExclamationCircleOutlined, DatabaseOutlined, CloudSyncOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import * as XLSX from 'xlsx';

dayjs.extend(relativeTime);

const { Text, Title } = Typography;
const API_BASE = import.meta.env?.VITE_API_URL || '/api';

const authHeaders = () => {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export default function LiveSyncPage() {
  // ── Sync Status State ──
  const [sellers, setSellers] = useState([]);
  const [loadingSellers, setLoadingSellers] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [syncRunning, setSyncRunning] = useState(false);
  const [syncProgress, setSyncProgress] = useState(null);
  const [syncResults, setSyncResults] = useState(null);

  // ── Inspector State ──
  const [metrics, setMetrics] = useState([]);
  const [selectedMetrics, setSelectedMetrics] = useState([]);
  const [asinInput, setAsinInput] = useState('');
  const [inspectorResults, setInspectorResults] = useState([]);
  const [inspectorLoading, setInspectorLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState(null);

  // ── Active Tab ──
  const [activeTab, setActiveTab] = useState('overview');

  // ── Data Loading ──
  const loadSellers = useCallback(async () => {
    setLoadingSellers(true);
    try {
      const res = await fetch(`${API_BASE}/live-sync-tracker/sellers`, { headers: authHeaders() }).then(r => r.json());
      if (res.success) setSellers(res.data || []);
      setLastRefresh(new Date());
    } catch (err) { console.error(err); }
    finally { setLoadingSellers(false); }
  }, []);

  const loadMetrics = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/live-data/metrics`).then(r => r.json());
      if (res.success) { setMetrics(res.data); setSelectedMetrics(res.data.map(m => m.key)); }
    } catch (e) { /* metrics endpoint may not exist */ }
  }, []);

  useEffect(() => { loadSellers(); loadMetrics(); }, []);

  // ── Stats ──
  const stats = useMemo(() => {
    const total = sellers.length;
    const synced = sellers.filter(s => s.syncPercentage > 0).length;
    const totalAsins = sellers.reduce((s, sell) => s + (sell.totalAsins || 0), 0);
    const syncedAsins = sellers.reduce((s, sell) => s + (sell.liveSyncedAsins || 0), 0);
    return { total, synced, pending: total - synced, totalAsins, syncedAsins, pct: totalAsins > 0 ? Math.round((syncedAsins / totalAsins) * 100) : 0 };
  }, [sellers]);

  // ── Sync All ──
  const handleSyncAll = async () => {
    if (syncRunning) return;
    setSyncRunning(true);
    setSyncResults(null);
    setSyncProgress({ status: 'STARTING', sellers: 0, asins: 0 });
    try {
      const res = await fetch(`${API_BASE}/market-sync/sync-all-live`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
      }).then(r => r.json());
      if (res.success) {
        message.success('Global sync started! Progress updates will appear below.');
        pollSyncStatus();
      } else {
        message.error(res.error || 'Failed to start sync');
        setSyncRunning(false);
      }
    } catch (err) { message.error('Failed to start sync'); setSyncRunning(false); }
  };

  const pollSyncStatus = useCallback(async () => {
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/market-sync/sync-all-live/status`, { headers: authHeaders() }).then(r => r.json());
        if (res.success) {
          setSyncProgress({
            status: res.isRunning ? 'RUNNING' : 'COMPLETE',
            activeSyncs: res.activeSyncs || 0,
            syncs: res.syncs || [],
          });
          if (!res.isRunning) {
            clearInterval(poll);
            setSyncRunning(false);
            loadSellers(); // Refresh data
          }
        }
      } catch (e) { /* poll error */ }
    }, 5000);
    // Stop polling after 30 min max
    setTimeout(() => clearInterval(poll), 30 * 60 * 1000);
  }, [loadSellers]);

  // ── Single Seller Sync ──
  const handleSyncSeller = async (sellerId) => {
    try {
      const res = await fetch(`${API_BASE}/market-sync/sync-all-live/${sellerId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
      }).then(r => r.json());
      if (res.success) message.success('Sync triggered for seller');
      else message.error(res.error || 'Sync failed');
    } catch (err) { message.error('Sync failed'); }
  };

  // ── Inspector: Fetch ──
  const handleInspectorFetch = async () => {
    const asins = asinInput.split(/[\n,]+/).map(a => a.trim()).filter(a => a.length > 0);
    if (asins.length === 0) { message.warning('Enter at least one ASIN'); return; }
    if (selectedMetrics.length === 0) { message.warning('Select at least one metric'); return; }
    setInspectorLoading(true);
    try {
      const res = await fetch(`${API_BASE}/live-data/fetch`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asins, metrics: selectedMetrics }),
      }).then(r => r.json());
      if (res.success) { setInspectorResults(res.data || []); setLastFetch(new Date()); message.success(`Fetched data for ${res.total} ASINs`); }
      else message.error(res.error || 'Failed');
    } catch (err) { message.error('Failed to fetch live data'); }
    finally { setInspectorLoading(false); }
  };

  const handleExport = () => {
    const data = inspectorResults.length > 0 ? inspectorResults : sellers.map(s => ({
      name: s.Name, marketplace: s.Marketplace, totalAsins: s.totalAsins,
      liveSyncedAsins: s.liveSyncedAsins, syncPercentage: s.syncPercentage, lastSync: s.lastLiveSyncAt,
    }));
    if (data.length === 0) { message.warning('No data to export'); return; }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), activeTab === 'inspector' ? 'Live Data' : 'Sync Status');
    XLSX.writeFile(wb, `live_sync_${activeTab}_${new Date().toISOString().split('T')[0]}.xlsx`);
    message.success('Exported to Excel');
  };

  // ── Columns ──
  const sellerColumns = [
    {
      title: 'Brand', dataIndex: 'Name', key: 'name', width: 220,
      render: (name) => <Text strong style={{ fontSize: 'var(--font-size-sm)' }}>{name}</Text>,
    },
    {
      title: 'Marketplace', dataIndex: 'Marketplace', key: 'mp', width: 100,
      render: (mp) => <Tag style={{ fontSize: 9, borderRadius: 'var(--bc-radius-md)' }}>{mp}</Tag>,
    },
    { title: 'ASINs', dataIndex: 'totalAsins', key: 'total', width: 70, align: 'center' },
    {
      title: 'Live Synced', dataIndex: 'liveSyncedAsins', key: 'live', width: 90, align: 'center',
      render: (v) => <Text style={{ fontWeight: 600, color: 'var(--bc-blue-500)' }}>{v}</Text>,
    },
    {
      title: 'Progress', key: 'progress', width: 140,
      render: (_, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Progress percent={r.syncPercentage} size="small" showInfo={false}
            strokeColor={r.syncPercentage >= 80 ? 'var(--bc-green-500)' : r.syncPercentage >= 30 ? 'var(--bc-amber-500)' : 'var(--bc-red-500)'}
            style={{ width: 80, margin: 0 }} />
          <Text style={{ fontSize: 10, fontWeight: 600 }}>{r.syncPercentage}%</Text>
        </div>
      ),
    },
    {
      title: 'Status', key: 'status', width: 120,
      render: (_, r) => {
        if (r.syncPercentage >= 80) return <Tag color="success" style={{ fontSize: 9 }}><CheckCircleOutlined /> Synced</Tag>;
        if (r.syncPercentage > 0) return <Tag color="warning" style={{ fontSize: 9 }}><SyncOutlined /> Partial</Tag>;
        return <Tag style={{ fontSize: 9, color: 'var(--bc-text-muted)' }}><ClockCircleOutlined /> Pending</Tag>;
      },
    },
    {
      title: 'Last Sync', key: 'lastSync', width: 130,
      render: (_, r) => r.lastLiveSyncAt ? (
        <Tooltip title={dayjs(r.lastLiveSyncAt).format('DD MMM YYYY HH:mm')}>
          <Text style={{ fontSize: 10, color: 'var(--bc-text-secondary)' }}>{dayjs(r.lastLiveSyncAt).fromNow()}</Text>
        </Tooltip>
      ) : <Text type="secondary" style={{ fontSize: 10 }}>Never</Text>,
    },
    {
      title: '', key: 'action', width: 60, align: 'center',
      render: (_, r) => (
        <Button type="text" size="small" icon={<SyncOutlined style={{ fontSize: 12 }} />}
          onClick={() => handleSyncSeller(r.Id)} title="Sync this seller" />
      ),
    },
  ];

  const inspectorColumns = [
    { title: 'ASIN', dataIndex: 'asin', key: 'asin', width: 120, render: (v) => <Text code style={{ fontSize: 10 }}>{v}</Text> },
    { title: 'Seller', dataIndex: 'seller', key: 'seller', width: 160 },
    ...selectedMetrics.map(key => {
      const m = metrics.find(x => x.key === key);
      return {
        title: m?.label || key, dataIndex: key, key,
        width: key === 'title' ? 200 : 100,
        render: (v) => v != null ? <Text style={{ fontSize: 'var(--bc-text-xs)' }}>{String(v)}</Text> : <Text type="secondary">-</Text>,
      };
    }),
  ];

  return (
    <div style={{ background: 'var(--bc-surface-page)', minHeight: '100vh' }}>
      {/* ── HEADER ── */}
      <div style={{ background: 'var(--bc-white)', borderBottom: '1px solid var(--bc-border-default)', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Space>
          <CloudSyncOutlined style={{ fontSize: 22, color: 'var(--bc-primary-600)' }} />
          <div>
            <Text strong style={{ fontSize: 18, color: 'var(--bc-text-heading)' }}>Live Sync Command Center</Text>
            <Text style={{ fontSize: 'var(--bc-text-xs)', color: 'var(--bc-text-muted)', display: 'block' }}>
              Amazon Creators API — {stats.syncedAsins.toLocaleString()} ASINs synced across {stats.synced} brands
            </Text>
          </div>
        </Space>
        <Space>
          {lastRefresh && <Text style={{ fontSize: 'var(--bc-text-xs)', color: 'var(--bc-text-muted)' }}>Updated {dayjs(lastRefresh).fromNow()}</Text>}
          <Button icon={<ReloadOutlined />} onClick={loadSellers} loading={loadingSellers} size="small">Refresh</Button>
          <Button icon={<DownloadOutlined />} size="small" onClick={handleExport}>Export</Button>
        </Space>
      </div>

      <div style={{ padding: '16px 24px' }}>
        {/* ── GLOBAL STATS BAR ── */}
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={6}>
            <Card size="small" style={{ borderRadius: 'var(--bc-radius-xl)', borderLeft: '3px solid var(--bc-primary-600)' }}>
              <Statistic title="Total Brands" value={stats.total} valueStyle={{ fontSize: 20, fontWeight: 800 }} />
            </Card>
          </Col>
          <Col xs={6}>
            <Card size="small" style={{ borderRadius: 'var(--bc-radius-xl)', borderLeft: '3px solid var(--bc-green-500)' }}>
              <Statistic title="Synced" value={stats.synced} valueStyle={{ fontSize: 20, fontWeight: 800, color: 'var(--bc-green-600)' }} />
            </Card>
          </Col>
          <Col xs={6}>
            <Card size="small" style={{ borderRadius: 'var(--bc-radius-xl)', borderLeft: '3px solid var(--bc-blue-500)' }}>
              <Statistic title="ASINs Synced" value={stats.syncedAsins} valueStyle={{ fontSize: 20, fontWeight: 800, color: 'var(--bc-blue-600)' }} formatter={(v) => v?.toLocaleString()} />
              <Progress showInfo={false} percent={stats.pct} size="small" strokeColor="var(--bc-blue-500)" style={{ marginTop: 4 }} />
            </Card>
          </Col>
          <Col xs={6}>
            <Card size="small" style={{ borderRadius: 'var(--bc-radius-xl)', borderLeft: '3px solid var(--bc-amber-500)', cursor: 'pointer' }}
              onClick={handleSyncAll} hoverable>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ThunderboltOutlined style={{ fontSize: 24, color: syncRunning ? 'var(--bc-amber-500)' : 'var(--bc-primary-600)' }} />
                <div>
                  <Text strong style={{ fontSize: 13, color: syncRunning ? 'var(--bc-amber-600)' : 'var(--bc-primary-600)' }}>
                    {syncRunning ? 'Syncing...' : 'Sync All Now'}
                  </Text>
                  <Text style={{ fontSize: 10, color: 'var(--bc-text-muted)', display: 'block' }}>
                    {syncRunning ? `${syncProgress?.activeSyncs || 0} active` : `${stats.pending} pending`}
                  </Text>
                </div>
              </div>
            </Card>
          </Col>
        </Row>

        {/* ── SYNC PROGRESS ── */}
        {syncRunning && syncProgress && (
          <Card size="small" style={{ borderRadius: 'var(--bc-radius-xl)', marginBottom: 16, border: '1px solid var(--bc-amber-200)', background: 'var(--bc-amber-50)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <SyncOutlined spin style={{ fontSize: 18, color: 'var(--bc-amber-600)' }} />
              <div style={{ flex: 1 }}>
                <Text strong style={{ fontSize: 13, color: 'var(--bc-amber-700)' }}>Global Live Sync Running</Text>
                <Text style={{ fontSize: 11, color: 'var(--bc-amber-600)', display: 'block' }}>
                  {syncProgress.activeSyncs || 0} sellers syncing concurrently — updates appear in real-time
                </Text>
              </div>
              <Button size="small" onClick={pollSyncStatus} style={{ borderRadius: 'var(--bc-radius-md)' }}>Check Status</Button>
            </div>
            {syncProgress.syncs && syncProgress.syncs.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {syncProgress.syncs.map((s, i) => (
                  <Tag key={i} color={s.status === 'RUNNING' ? 'processing' : s.status === 'DONE' ? 'success' : 'default'}>
                    {s.sellerId?.slice(0, 8)}... — {s.status}
                  </Tag>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* ── TABS ── */}
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
          {
            key: 'overview',
            label: <span><ShopOutlined /> Brand Sync Status</span>,
            children: (
              <Card size="small" style={{ borderRadius: 'var(--bc-radius-xl)' }}>
                <Table dataSource={sellers} columns={sellerColumns} rowKey="Id" size="small"
                  loading={loadingSellers}
                  pagination={{ pageSize: 20, showTotal: (t) => <Text type="secondary" style={{ fontSize: 'var(--bc-text-xs)' }}>{t} brands</Text> }}
                  scroll={{ x: 1000 }}
                />
              </Card>
            ),
          },
          {
            key: 'inspector',
            label: <span><SearchOutlined /> Inspector</span>,
            children: (
              <Row gutter={[16, 16]}>
                <Col xs={24} md={8}>
                  <Card size="small" title="ASIN Input" style={{ borderRadius: 'var(--bc-radius-xl)' }}>
                    <div style={{ marginBottom: 12 }}>
                      <Text style={{ fontSize: 'var(--bc-text-xs)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Enter ASINs</Text>
                      <Input.TextArea rows={6} value={asinInput} onChange={e => setAsinInput(e.target.value)}
                        placeholder={"B08FGPZNR6\nB09R9BGH3P"} style={{ borderRadius: 'var(--bc-radius-lg)', fontFamily: 'monospace', fontSize: 'var(--bc-text-sm)' }} />
                      <Text style={{ fontSize: 10, color: 'var(--bc-text-muted)', marginTop: 4 }}>
                        {asinInput.split(/[\n,]+/).filter(a => a.trim()).length} ASINs entered
                      </Text>
                    </div>
                    <Button type="primary" block onClick={handleInspectorFetch} loading={inspectorLoading}
                      icon={<ThunderboltOutlined />} style={{ borderRadius: 'var(--bc-radius-md)', fontWeight: 600, marginBottom: 12 }}>
                      Fetch Live Data
                    </Button>
                    <Text style={{ fontSize: 'var(--bc-text-xs)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Metrics</Text>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 250, overflow: 'auto' }}>
                      <div style={{ padding: '4px 8px', borderRadius: 6, background: 'var(--bc-surface-subtle)', cursor: 'pointer', border: '1px solid var(--bc-border-default)' }}
                        onClick={() => setSelectedMetrics(selectedMetrics.length === metrics.length ? [] : metrics.map(m => m.key))}>
                        <Checkbox checked={selectedMetrics.length === metrics.length} indeterminate={selectedMetrics.length > 0 && selectedMetrics.length < metrics.length}>
                          <Text style={{ fontSize: 'var(--bc-text-xs)', fontWeight: 600 }}>All ({selectedMetrics.length}/{metrics.length})</Text>
                        </Checkbox>
                      </div>
                      {metrics.map(m => (
                        <div key={m.key} style={{ padding: '4px 8px', borderRadius: 6, background: 'var(--bc-white)', border: '1px solid var(--bc-border-default)', cursor: 'pointer' }}
                          onClick={() => setSelectedMetrics(prev => prev.includes(m.key) ? prev.filter(k => k !== m.key) : [...prev, m.key])}>
                          <Checkbox checked={selectedMetrics.includes(m.key)}>
                            <Text style={{ fontSize: 'var(--bc-text-xs)' }}>{m.label}</Text>
                          </Checkbox>
                        </div>
                      ))}
                    </div>
                  </Card>
                </Col>
                <Col xs={24} md={16}>
                  <Card size="small" title={<Space><TableOutlined /> Results {inspectorResults.length > 0 && <Badge count={inspectorResults.length} style={{ backgroundColor: 'var(--bc-primary-500)' }} />}</Space>}
                    style={{ borderRadius: 'var(--bc-radius-xl)' }}>
                    {inspectorResults.length === 0 ? (
                      <Empty description="Enter ASINs and click Fetch to see results" style={{ padding: '40px 0' }} />
                    ) : (
                      <Table dataSource={inspectorResults} columns={inspectorColumns} rowKey="asin" size="small"
                        pagination={inspectorResults.length > 20 ? { pageSize: 20 } : false}
                        scroll={{ x: 'max-content' }} />
                    )}
                  </Card>
                </Col>
              </Row>
            ),
          },
        ]} />
      </div>
    </div>
  );
}
