import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Table, Tag, Typography, Space, Spin, Button, Progress, Tooltip, Tabs, Select, Drawer, Descriptions, message } from 'antd';
import { ReloadOutlined, CheckCircleOutlined, ClockCircleOutlined, SyncOutlined, ShopOutlined, FileSearchOutlined, HistoryOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text } = Typography;
const API_BASE = import.meta.env?.VITE_API_URL || '/api';

const authHeaders = () => {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const triggerTypeTag = (t) => {
  const map = {
    MANUAL: { color: 'blue', label: 'Manual' },
    AUTO: { color: 'green', label: 'Auto' },
    RE_SYNC: { color: 'orange', label: 'Re-sync' },
    TOOL: { color: 'purple', label: 'Tool' },
  };
  const m = map[t] || { color: 'default', label: t || '-' };
  return <Tag color={m.color} style={{ fontSize: 9, borderRadius: 'var(--radius-md)' }}>{m.label}</Tag>;
};

const statusTag = (s) => {
  const map = {
    RUNNING: { color: 'processing', label: 'Running' },
    COMPLETED: { color: 'success', label: 'Completed' },
    PARTIAL: { color: 'warning', label: 'Partial' },
    FAILED: { color: 'error', label: 'Failed' },
    CANCELLED: { color: 'default', label: 'Cancelled' },
  };
  const m = map[s] || { color: 'default', label: s || '-' };
  return <Tag color={m.color} style={{ fontSize: 9, borderRadius: 'var(--radius-md)' }}>{m.label}</Tag>;
};

const fmtDuration = (ms) => {
  if (!ms && ms !== 0) return '-';
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.round(s % 60)}s`;
};

function RunLogsTab() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState({ triggerType: undefined, status: undefined, sellerId: undefined });
  const [brands, setBrands] = useState([]);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadRuns = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ limit: pageSize, offset: (page - 1) * pageSize });
      if (filters.triggerType) q.set('triggerType', filters.triggerType);
      if (filters.status) q.set('status', filters.status);
      if (filters.sellerId) q.set('sellerId', filters.sellerId);
      const res = await fetch(`${API_BASE}/live-sync-tracker/runs?${q}`, { headers: authHeaders() }).then(r => r.json());
      if (res.success) { setRows(res.data || []); setTotal(res.total || 0); }
    } catch (err) { console.error(err); message.error('Failed to load run logs'); }
    finally { setLoading(false); }
  };

  const loadBrands = async () => {
    try {
      const res = await fetch(`${API_BASE}/live-sync-tracker/brands`, { headers: authHeaders() }).then(r => r.json());
      if (res.success) setBrands(res.data || []);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { loadRuns(); }, [page, pageSize, filters]);
  useEffect(() => { loadBrands(); }, []);

  const openDetail = async (runId) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(`${API_BASE}/live-sync-tracker/runs/${runId}`, { headers: authHeaders() }).then(r => r.json());
      if (res.success) setDetail(res.data);
      else message.error(res.error || 'Failed to load run detail');
    } catch (err) { message.error('Failed to load run detail'); }
    finally { setDetailLoading(false); }
  };

  const columns = [
    {
      title: 'When', dataIndex: 'StartedAt', key: 'when', width: 150,
      render: (v) => <Tooltip title={dayjs(v).format('DD MMM YYYY HH:mm:ss')}><Text style={{ fontSize: 10 }}>{dayjs(v).format('DD MMM, HH:mm')}</Text></Tooltip>,
    },
    {
      title: 'Brand', dataIndex: 'SellerName', key: 'brand', width: 200,
      render: (v, r) => <Text strong style={{ fontSize: 11 }}>{v || r.SellerId || '—'}</Text>,
    },
    {
      title: 'Type', dataIndex: 'TriggerType', key: 'type', width: 90,
      render: (v) => triggerTypeTag(v),
    },
    {
      title: 'Triggered By', dataIndex: 'TriggeredByName', key: 'by', width: 170,
      render: (v) => v ? <Space size={4}><UserOutlined style={{ fontSize: 10, color: '#64748b' }} /><Text style={{ fontSize: 10, color: '#334155' }}>{v}</Text></Space> : <Text type="secondary" style={{ fontSize: 10 }}>System</Text>,
    },
    {
      title: 'ASINs', key: 'asins', width: 130, align: 'center',
      render: (_, r) => (
        <Space size={6} style={{ fontSize: 10 }}>
          <Text style={{ color: '#475569' }}>{r.TotalAsins}</Text>
          <Text style={{ color: '#2563eb', fontWeight: 600 }}>✓ {r.SuccessCount}</Text>
          <Text style={{ color: '#dc2626', fontWeight: 600 }}>✗ {r.FailedCount}</Text>
        </Space>
      ),
    },
    {
      title: 'Status', dataIndex: 'Status', key: 'status', width: 100,
      render: (v) => statusTag(v),
    },
    {
      title: 'Duration', dataIndex: 'DurationMs', key: 'duration', width: 90, align: 'center',
      render: (v) => <Text style={{ fontSize: 10, color: '#64748b' }}>{fmtDuration(v)}</Text>,
    },
    {
      title: '', key: 'action', width: 70, align: 'center',
      render: (_, r) => <Button type="link" size="small" style={{ fontSize: 10, padding: 0 }} icon={<FileSearchOutlined />} onClick={() => openDetail(r.Id)}>View</Button>,
    },
  ];

  return (
    <div>
      <Card size="small" title={<Space><HistoryOutlined /> Sync Run Log</Space>} extra={
        <Button icon={<ReloadOutlined />} onClick={() => { setPage(1); loadRuns(); }} loading={loading} size="small">Refresh</Button>
      } style={{ borderRadius: 10, marginBottom: 12 }}>
        <Space wrap style={{ marginBottom: 12 }}>
          <Select
            placeholder="Trigger Type"
            allowClear
            size="small"
            style={{ width: 130 }}
            value={filters.triggerType}
            onChange={(v) => { setPage(1); setFilters(f => ({ ...f, triggerType: v })); }}
            options={[
              { value: 'MANUAL', label: 'Manual' },
              { value: 'AUTO', label: 'Auto' },
              { value: 'RE_SYNC', label: 'Re-sync' },
              { value: 'TOOL', label: 'Tool (Inspector)' },
            ]}
          />
          <Select
            placeholder="Status"
            allowClear
            size="small"
            style={{ width: 130 }}
            value={filters.status}
            onChange={(v) => { setPage(1); setFilters(f => ({ ...f, status: v })); }}
            options={[
              { value: 'RUNNING', label: 'Running' },
              { value: 'COMPLETED', label: 'Completed' },
              { value: 'PARTIAL', label: 'Partial' },
              { value: 'FAILED', label: 'Failed' },
              { value: 'CANCELLED', label: 'Cancelled' },
            ]}
          />
          <Select
            placeholder="Brand"
            allowClear
            showSearch
            size="small"
            style={{ width: 220 }}
            optionFilterProp="label"
            value={filters.sellerId}
            onChange={(v) => { setPage(1); setFilters(f => ({ ...f, sellerId: v })); }}
            options={brands.map(b => ({ value: b.SellerId, label: b.SellerName }))}
          />
        </Space>
        <Table
          dataSource={rows}
          rowKey="Id"
          size="small"
          loading={loading}
          pagination={{
            current: page, pageSize, total,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            showTotal: (t) => <Text type="secondary" style={{ fontSize: 'var(--font-size-xs)' }}>{t} runs</Text>,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          }}
          columns={columns}
        />
      </Card>

      <Drawer
        title={<Space><FileSearchOutlined /> Run Detail</Space>}
        width={720}
        open={!!detail}
        onClose={() => setDetail(null)}
      >
        {detailLoading && <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>}
        {detail && !detailLoading && (
          <div>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Status">{statusTag(detail.Status)}</Descriptions.Item>
              <Descriptions.Item label="Trigger Type">{triggerTypeTag(detail.TriggerType)}</Descriptions.Item>
              <Descriptions.Item label="Brand"><Text strong>{detail.SellerName || '—'}</Text></Descriptions.Item>
              <Descriptions.Item label="Marketplace">{detail.Marketplace || '—'}</Descriptions.Item>
              <Descriptions.Item label="Triggered By" span={2}>{detail.TriggeredByName || 'System (Auto)'}</Descriptions.Item>
              <Descriptions.Item label="Started At" span={2}>{dayjs(detail.StartedAt).format('DD MMM YYYY HH:mm:ss')}</Descriptions.Item>
              <Descriptions.Item label="Completed At" span={2}>{detail.CompletedAt ? dayjs(detail.CompletedAt).format('DD MMM YYYY HH:mm:ss') : '—'}</Descriptions.Item>
              <Descriptions.Item label="Duration">{fmtDuration(detail.DurationMs)}</Descriptions.Item>
              <Descriptions.Item label="Batch">{detail.BatchId || '—'}</Descriptions.Item>
              <Descriptions.Item label="Total ASINs"><Text strong>{detail.TotalAsins}</Text></Descriptions.Item>
              <Descriptions.Item label="Success / Failed">
                <Space size={6}><Text style={{ color: '#2563eb', fontWeight: 600 }}>{detail.SuccessCount} ✓</Text><Text style={{ color: '#dc2626', fontWeight: 600 }}>{detail.FailedCount} ✗</Text></Space>
              </Descriptions.Item>
            </Descriptions>

            {detail.FailedAsinCodes?.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <Text strong style={{ fontSize: 11 }}>Failed ASINs ({detail.FailedAsinCodes.length})</Text>
                <div style={{ marginTop: 8 }}>
                  {detail.FailedAsinCodes.slice(0, 60).map(code => (
                    <Tag key={code} color="red" style={{ fontSize: 9, marginBottom: 4, borderRadius: 'var(--radius-md)' }}>{code}</Tag>
                  ))}
                  {detail.FailedAsinCodes.length > 60 && <Tag style={{ fontSize: 9 }}>+{detail.FailedAsinCodes.length - 60} more</Tag>}
                </div>
              </div>
            )}

            <Divider style={{ margin: '16px 0' }} />
            <Text strong style={{ fontSize: 11 }}>Per-ASIN Detail ({detail.asins?.length || 0})</Text>
            <Table
              style={{ marginTop: 8 }}
              dataSource={detail.asins || []}
              rowKey="Id"
              size="small"
              pagination={false}
              scroll={{ y: 320 }}
              columns={[
                { title: 'ASIN', dataIndex: 'AsinCode', key: 'asin', width: 120, render: (v) => <Text style={{ fontSize: 10, fontWeight: 600 }}>{v}</Text> },
                { title: 'Status', dataIndex: 'Status', key: 'status', width: 110, render: (v) => statusTag(v === 'SUCCESS' ? 'COMPLETED' : v === 'NOT_FOUND' ? 'PARTIAL' : v === 'SKIPPED' ? 'CANCELLED' : 'FAILED') },
                { title: 'Error', dataIndex: 'ErrorMessage', key: 'err', render: (v) => <Text style={{ fontSize: 10, color: v ? '#dc2626' : '#475569' }}>{v || '—'}</Text> },
              ]}
            />
          </div>
        )}
      </Drawer>
    </div>
  );
}

export default function LiveSyncTrackerPage() {
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/live-sync-tracker/sellers`, { headers: authHeaders() }).then(r => r.json());
      if (res.success) setSellers(res.data || []);
      setLastRefresh(new Date());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  // Stats
  const synced = sellers.filter(s => s.syncPercentage > 0).length;
  const total = sellers.length;
  const totalAsins = sellers.reduce((s, sell) => s + (sell.totalAsins || 0), 0);
  const syncedAsins = sellers.reduce((s, sell) => s + (sell.liveSyncedAsins || 0), 0);

  return (
    <div style={{ background: '#f8fafc', minHeight: '100%', padding: '0 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', marginBottom: 16 }}>
        <Space>
          <Text strong style={{ fontSize: 18 }}>Live Sync Tracker</Text>
          {lastRefresh && <Text style={{ fontSize: 'var(--font-size-xs)', color: '#94a3b8' }}>Last refresh: {dayjs(lastRefresh).format('HH:mm:ss')}</Text>}
        </Space>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading} size="small">Refresh</Button>
      </div>

      <Tabs
        items={[
          {
            key: 'status',
            label: <Space size={4}><ShopOutlined />Brand Status</Space>,
            children: (
              <>
                {/* Summary Cards */}
                <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                  <Col xs={8}>
                    <Card size="small" style={{ borderRadius: 10, textAlign: 'center', borderLeft: '3px solid #2563eb' }}>
                      <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: '#0f172a' }}>{synced}/{total}</div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: '#64748b', fontWeight: 600 }}>Brands Synced</div>
                      <Progress showInfo={false} percent={total > 0 ? Math.round((synced / total) * 100) : 0} size="small" strokeColor="#2E7D32" style={{ marginTop: 4 }} />
                    </Card>
                  </Col>
                  <Col xs={8}>
                    <Card size="small" style={{ borderRadius: 10, textAlign: 'center', borderLeft: '3px solid #2E7D32' }}>
                      <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: '#2E7D32' }}>{syncedAsins.toLocaleString()}</div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: '#64748b', fontWeight: 600 }}>ASINs Synced</div>
                      <Progress showInfo={false} percent={totalAsins > 0 ? Math.round((syncedAsins / totalAsins) * 100) : 0} size="small" strokeColor="#2563eb" style={{ marginTop: 4 }} />
                    </Card>
                  </Col>
                  <Col xs={8}>
                    <Card size="small" style={{ borderRadius: 10, textAlign: 'center', borderLeft: '3px solid #94a3b8' }}>
                      <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, color: '#94a3b8' }}>{total - synced}</div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: '#64748b', fontWeight: 600 }}>Pending Sync</div>
                    </Card>
                  </Col>
                </Row>

                {/* Brand Sync Status Table */}
                <Card size="small" title={<Space><ShopOutlined /> Brand Sync Status</Space>} style={{ borderRadius: 10 }}>
                  <Table
                    dataSource={sellers}
                    rowKey="Id"
                    size="small"
                    loading={loading}
                    pagination={{ pageSize: 20, showTotal: (t) => <Text type="secondary" style={{ fontSize: 'var(--font-size-xs)' }}>{t} brands</Text> }}
                    columns={[
                      {
                        title: 'Brand', dataIndex: 'Name', key: 'name', width: 220,
                        render: (name) => <Text strong style={{ fontSize: 'var(--font-size-sm)' }}>{name}</Text>,
                      },
                      {
                        title: 'Marketplace', dataIndex: 'Marketplace', key: 'mp', width: 100,
                        render: (mp) => <Tag style={{ fontSize: 9, borderRadius: "var(--radius-md)" }}>{mp}</Tag>,
                      },
                      {
                        title: 'ASINs', dataIndex: 'totalAsins', key: 'total', width: 70, align: 'center',
                      },
                      {
                        title: 'Live Synced', dataIndex: 'liveSyncedAsins', key: 'live', width: 90, align: 'center',
                        render: (v) => <Text style={{ fontWeight: 600, color: '#2563eb' }}>{v}</Text>,
                      },
                      {
                        title: 'Progress', key: 'progress', width: 140,
                        render: (_, r) => (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Progress percent={r.syncPercentage} size="small" showInfo={false}
                              strokeColor={r.syncPercentage >= 80 ? '#2E7D32' : r.syncPercentage >= 30 ? '#ED6C02' : '#D32F2F'}
                              style={{ width: 80, margin: 0 }} />
                            <Text style={{ fontSize: 10, fontWeight: 600 }}>{r.syncPercentage}%</Text>
                          </div>
                        ),
                      },
                      {
                        title: 'Status', key: 'status', width: 120,
                        render: (_, r) => {
                          if (r.syncPercentage >= 80) return <Tag color="success" style={{ fontSize: 9, borderRadius: "var(--radius-md)" }}><CheckCircleOutlined /> Synced</Tag>;
                          if (r.syncPercentage > 0) return <Tag color="warning" style={{ fontSize: 9, borderRadius: "var(--radius-md)" }}><SyncOutlined /> Partial</Tag>;
                          return <Tag style={{ fontSize: 9, borderRadius: "var(--radius-md)", color: '#94a3b8' }}><ClockCircleOutlined /> Pending</Tag>;
                        },
                      },
                      {
                        title: 'Last Sync', key: 'lastSync', width: 130,
                        render: (_, r) => r.lastLiveSyncAt ? (
                          <Tooltip title={dayjs(r.lastLiveSyncAt).format('DD MMM YYYY HH:mm')}>
                            <Text style={{ fontSize: 10, color: '#64748b' }}>{dayjs(r.lastLiveSyncAt).fromNow?.() || dayjs(r.lastLiveSyncAt).format('DD MMM HH:mm')}</Text>
                          </Tooltip>
                        ) : <Text type="secondary" style={{ fontSize: 10 }}>Never synced</Text>,
                      },
                    ]}
                  />
                </Card>
              </>
            ),
          },
          {
            key: 'runs',
            label: <Space size={4}><HistoryOutlined />Run Log</Space>,
            children: <RunLogsTab />,
          },
        ]}
      />
    </div>
  );
}
