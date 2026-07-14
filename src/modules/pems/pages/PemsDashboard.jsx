import { Spinner } from "@/components/Spinner";
import React, { useState, useEffect, useMemo } from 'react';
import { Card, Row, Col, Table, Tag, Progress, Typography, Space, Select, Button, DatePicker, Spin, Badge, Tooltip, Divider, Empty } from 'antd';
import {
  ThunderboltOutlined, SyncOutlined, EyeOutlined, CheckCircleOutlined,
  ClockCircleOutlined, WarningOutlined, TrophyOutlined, ArrowUpOutlined, ArrowDownOutlined,
  MinusOutlined, ReloadOutlined, PlusOutlined, ShopOutlined, TeamOutlined,
  FireOutlined, UserOutlined, CalendarOutlined,
  RightOutlined, EditOutlined, RocketOutlined, DownloadOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import pemsApi from '../services/pemsApi';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const STATUS_COLORS = {
  DRAFT: '#64748b', ASSIGNED: '#2563eb', ACCEPTED: '#9333ea', IN_PROGRESS: '#2563eb',
  SUBMITTED: '#ED6C02', UNDER_REVIEW: '#9333ea', APPROVED: '#2E7D32',
  REJECTED: '#D32F2F', REWORK: '#ED6C02', CANCELLED: '#94a3b8',
};

const PRIORITY_COLORS = { CRITICAL: '#D32F2F', HIGH: '#ED6C02', MEDIUM: '#2563eb', LOW: '#64748b' };
const SLA_COLORS = { WITHIN_SLA: '#2E7D32', AT_RISK: '#ED6C02', BREACHED: '#D32F2F' };

function formatTime(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  const now = new Date();
  const diffMin = Math.floor((now - d) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

function KpiCard({ title, value, subtitle, color, icon, trend }) {
  return (
    <Card size="small" styles={{ body: { padding: '12px 16px' } }}
      style={{ borderRadius: 10, border: `1px solid ${color}18`, borderLeft: `3px solid ${color}`, height: 80 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Text style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, display: 'block' }}>{title}</Text>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', lineHeight: 1.2, marginTop: 4 }}>{value}</div>
          {subtitle && <Text style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{subtitle}</Text>}
        </div>
        <div style={{ width: 36, height: 36, borderRadius: "var(--radius-md)", background: `${color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, fontSize: 'var(--font-size-lg)' }}>{icon}</div>
      </div>
      {trend !== undefined && (
        <div style={{ marginTop: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: trend >= 0 ? '#2E7D32' : '#D32F2F' }}>
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}%
          </span>
          <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 4 }}>vs last period</span>
        </div>
      )}
    </Card>
  );
}

function PipelineFunnel({ pipeline, total }) {
  const stages = [
    { key: 'draft', label: 'Draft', color: '#64748b' },
    { key: 'assigned', label: 'Assigned', color: '#2563eb' },
    { key: 'accepted', label: 'Accepted', color: '#9333ea' },
    { key: 'inProgress', label: 'In Progress', color: '#2563eb' },
    { key: 'submitted', label: 'Submitted', color: '#ED6C02' },
    { key: 'underReview', label: 'Under Review', color: '#9333ea' },
    { key: 'approved', label: 'Approved', color: '#2E7D32' },
  ];
  const maxVal = Math.max(...stages.map(s => pipeline[s.key] || 0), 1);
  return (
    <Card size="small" title={<Space><RocketOutlined style={{ color: '#2563eb' }} /><Text strong style={{ fontSize: 13 }}>Execution Pipeline</Text></Space>} styles={{ body: { padding: '12px 16px' } }} style={{ borderRadius: 10 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {stages.map((stage, i) => {
          const val = pipeline[stage.key] || 0;
          const pct = total > 0 ? Math.round((val / total) * 100) : 0;
          const barWidth = maxVal > 0 ? (val / maxVal) * 100 : 0;
          return (
            <div key={stage.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Text style={{ fontSize: 'var(--font-size-xs)', width: 90, textAlign: 'right', color: '#475569', fontWeight: 500 }}>{stage.label}</Text>
              <div style={{ flex: 1, height: 22, background: '#f1f5f9', borderRadius: "var(--radius-sm)", overflow: 'hidden', position: 'relative' }}>
                <div style={{ height: '100%', width: `${barWidth}%`, background: `${stage.color}20`, borderRadius: "var(--radius-sm)", transition: 'width 0.5s ease' }} />
                <div style={{ height: '100%', width: `${barWidth}%`, background: stage.color, borderRadius: "var(--radius-sm)", position: 'absolute', top: 0, left: 0, opacity: 0.85, transition: 'width 0.5s ease' }} />
              </div>
              <Text style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, width: 40, textAlign: 'right', color: '#0f172a' }}>{val}</Text>
              <Text style={{ fontSize: 10, color: '#94a3b8', width: 35, textAlign: 'right' }}>{pct}%</Text>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function StatusDistribution({ dist, total }) {
  const items = [
    { key: 'draft', label: 'Draft', color: '#64748b' },
    { key: 'assigned', label: 'Assigned', color: '#2563eb' },
    { key: 'accepted', label: 'Accepted', color: '#9333ea' },
    { key: 'inProgress', label: 'In Progress', color: '#2563eb' },
    { key: 'submitted', label: 'Submitted', color: '#ED6C02' },
    { key: 'underReview', label: 'Under Review', color: '#9333ea' },
    { key: 'approved', label: 'Approved', color: '#2E7D32' },
    { key: 'rejected', label: 'Rejected', color: '#D32F2F' },
    { key: 'rework', label: 'Rework', color: '#ED6C02' },
  ];
  return (
    <Card size="small" title="Status Distribution" styles={{ body: { padding: '12px 16px' } }} style={{ borderRadius: 10 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {items.map(item => {
          const count = dist[item.key] || 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <Tooltip key={item.key} title={`${item.label}: ${count} (${pct}%)`}>
              <div style={{ padding: '6px 12px', borderRadius: "var(--radius-md)", background: `${item.color}08`, border: `1px solid ${item.color}20`, minWidth: 80, textAlign: 'center', cursor: 'default' }}>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: item.color }}>{count}</div>
                <div style={{ fontSize: 9, color: '#64748b', fontWeight: 600 }}>{item.label}</div>
              </div>
            </Tooltip>
          );
        })}
      </div>
    </Card>
  );
}

function RiskCenter({ risk }) {
  const items = [
    { label: 'SLA Breached', value: risk.slaBreached || 0, color: '#D32F2F', bg: '#fef2f2', severity: 'critical' },
    { label: 'Overdue Tasks', value: risk.overdue || 0, color: '#D32F2F', bg: '#fef2f2', severity: 'high' },
    { label: 'Stale Reviews (>48h)', value: risk.staleReviews || 0, color: '#ED6C02', bg: '#fffbeb', severity: 'high' },
    { label: 'Rejected Tasks', value: risk.rejected || 0, color: '#ED6C02', bg: '#fffbeb', severity: 'medium' },
    { label: 'Rework Tasks', value: risk.rework || 0, color: '#ED6C02', bg: '#fffbeb', severity: 'medium' },
    { label: 'High Priority Delays', value: risk.highPriorityDelays || 0, color: '#D32F2F', bg: '#fef2f2', severity: 'critical' },
    { label: 'SLA At Risk', value: risk.slaAtRisk || 0, color: '#ED6C02', bg: '#fffbeb', severity: 'low' },
  ];
  return (
    <Card size="small" title={<Space><WarningOutlined style={{ color: '#D32F2F' }} /><Text strong style={{ fontSize: 13 }}>Risk Center</Text></Space>} styles={{ body: { padding: '12px 16px' } }} style={{ borderRadius: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
        {items.map(item => (
          <div key={item.label} style={{ padding: '10px 12px', borderRadius: "var(--radius-md)", background: item.bg, border: `1px solid ${item.color}15` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: item.color }}>{item.value}</div>
              <Tag style={{ fontSize: 8, borderRadius: "var(--radius-sm)", margin: 0, background: item.color, color: '#fff', border: 'none' }}>{item.severity}</Tag>
            </div>
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 500, marginTop: 2 }}>{item.label}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ActivityFeed({ activities }) {
  const actionIcons = {
    CREATED: <PlusOutlined style={{ fontSize: 10 }} />,
    STATUS_CHANGED: <SyncOutlined style={{ fontSize: 10 }} />,
    SUBTASK_COMPLETED: <CheckCircleOutlined style={{ fontSize: 10 }} />,
    EVIDENCE_UPLOADED: <EditOutlined style={{ fontSize: 10 }} />,
  };
  const actionColors = { CREATED: '#2563eb', STATUS_CHANGED: '#2E7D32', SUBTASK_COMPLETED: '#2E7D32', EVIDENCE_UPLOADED: '#9333ea' };
  return (
    <Card size="small" title={<Space><ClockCircleOutlined style={{ color: '#64748b' }} /><Text strong style={{ fontSize: 13 }}>Activity Feed</Text></Space>} styles={{ body: { padding: '8px 16px', maxHeight: 320, overflow: 'auto' } }} style={{ borderRadius: 10 }}>
      {activities.length === 0 ? <Text type="secondary" style={{ fontSize: 'var(--font-size-xs)' }}>No recent activity</Text> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {activities.map(a => (
            <div key={a.Id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '6px 0', borderBottom: '1px solid #f8fafc' }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, background: `${actionColors[a.Action] || '#64748b'}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: actionColors[a.Action] || '#64748b', flexShrink: 0 }}>
                {actionIcons[a.Action] || <SyncOutlined style={{ fontSize: 10 }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 'var(--font-size-xs)', color: '#334155' }}>
                  <Text strong>{a.ActorName || 'System'}</Text>{' '}
                  {a.Action.replace(/_/g, ' ').toLowerCase()}
                  {a.InstanceCode && <> <Text strong style={{ color: '#2563eb' }}>{a.InstanceCode}</Text></>}
                  {a.Title && <> — {a.Title}</>}
                </Text>
                {a.Details && <Text style={{ fontSize: 10, color: '#94a3b8', display: 'block', marginTop: 2 }}>{a.Details}</Text>}
              </div>
              <Text style={{ fontSize: 10, color: '#94a3b8', whiteSpace: 'nowrap', flexShrink: 0 }}>{formatTime(a.CreatedAt)}</Text>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function PemsDashboard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [liveTasks, setLiveTasks] = useState([]);
  const [activityFeed, setActivityFeed] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [department, setDepartment] = useState(null);
  const [sellerFilter, setSellerFilter] = useState(null);
  const [managerFilter, setManagerFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [priorityFilter, setPriorityFilter] = useState(null);
  const [dateRange, setDateRange] = useState(null);

  // Dynamic data
  const [sellers, setSellers] = useState([]);
  const [managers, setManagers] = useState([]);

  const buildParams = () => {
    const p = {};
    if (department) p.department = department;
    if (sellerFilter) p.sellerId = sellerFilter;
    if (managerFilter) p.assignedTo = managerFilter;
    if (statusFilter) p.status = statusFilter;
    if (priorityFilter) p.priority = priorityFilter;
    if (dateRange?.[0]) p.dateFrom = dateRange[0].toISOString();
    if (dateRange?.[1]) p.dateTo = dateRange[1].toISOString();
    return p;
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const params = buildParams();
      const [sumRes, liveRes, feedRes] = await Promise.all([
        pemsApi.getDashboardSummary(params),
        pemsApi.getLiveTasks(params),
        pemsApi.getActivityFeed(),
      ]);
      if (sumRes.success) setSummary(sumRes.data);
      if (liveRes.success) setLiveTasks(liveRes.data);
      if (feedRes.success) setActivityFeed(feedRes.data);
    } catch (err) { console.error('Dashboard error:', err); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    loadAll();
    pemsApi.getSellers().then(r => { if (r.success) setSellers(r.data); }).catch(() => { });
    pemsApi.getBrandManagers().then(r => { if (r.success) setManagers(r.data); }).catch(() => { });
  }, []);

  useEffect(() => { loadAll(); }, [department, sellerFilter, managerFilter, statusFilter, priorityFilter, dateRange]);

  const kpi = summary?.kpi || {};
  const pipeline = summary?.pipeline || {};
  const departments = summary?.departments || [];
  const topPerformers = summary?.topPerformers || { topSellers: [], topManagers: [] };
  const workload = summary?.workload || [];
  const risk = summary?.risk || {};
  const statusDist = summary?.statusDistribution || {};
  const total = kpi.total || 0;

  const liveTaskColumns = [
    {
      title: 'Task', key: 'task', width: 200, render: (_, r) => (
        <div>
          <Text strong style={{ fontSize: 'var(--font-size-sm)', color: '#2563eb', cursor: 'pointer' }} onClick={() => navigate('/pems/tasks')}>{r.InstanceCode}</Text>
          <Text style={{ fontSize: 'var(--font-size-xs)', display: 'block', color: '#334155', lineHeight: 1.3 }}>{r.Title || 'Untitled'}</Text>
        </div>
      )
    },
    { title: 'Dept', dataIndex: 'Department', width: 100, render: (d) => <Tag style={{ fontSize: 9, borderRadius: 6, background: '#eff6ff', color: '#1d4ed8' }}>{d || '-'}</Tag> },
    { title: 'Seller', dataIndex: 'SellerName', width: 100, render: (v) => <Text style={{ fontSize: 'var(--font-size-xs)' }}>{v || '-'}</Text> },
    { title: 'Assignee', dataIndex: 'AssigneeName', width: 100, render: (v) => <Text style={{ fontSize: 'var(--font-size-xs)' }}>{v || '-'}</Text> },
    { title: 'Status', dataIndex: 'Status', width: 100, render: (s) => <Tag style={{ fontSize: 9, borderRadius: 10, background: `${STATUS_COLORS[s]}15`, color: STATUS_COLORS[s], border: `1px solid ${STATUS_COLORS[s]}30`, fontWeight: 600 }}>{s}</Tag> },
    { title: 'Priority', dataIndex: 'Priority', width: 80, render: (p) => <Tag style={{ fontSize: 9, borderRadius: 6, background: `${PRIORITY_COLORS[p]}15`, color: PRIORITY_COLORS[p], border: `1px solid ${PRIORITY_COLORS[p]}25`, fontWeight: 600 }}>{p}</Tag> },
    { title: 'Ach%', dataIndex: 'AchievementPct', width: 65, align: 'center', render: (v) => <Text style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: v >= 80 ? '#2E7D32' : v >= 50 ? '#ED6C02' : '#D32F2F' }}>{v || 0}%</Text> },
    { title: 'Due', dataIndex: 'DueDate', width: 80, render: (d) => d ? <Text style={{ fontSize: 10, color: new Date(d) < new Date() ? '#D32F2F' : '#64748b' }}>{new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</Text> : '-' },
    { title: 'SLA', dataIndex: 'SLAStatus', width: 80, render: (s) => <Tag style={{ fontSize: 8, borderRadius: 6, background: `${SLA_COLORS[s] || '#64748b'}15`, color: SLA_COLORS[s] || '#64748b', border: `1px solid ${SLA_COLORS[s] || '#64748b'}25` }}>{s?.replace('_', ' ')}</Tag> },
    {
      title: 'Actions', key: 'actions', width: 80, align: 'right', render: (_, r) => (
        <Space size={2}>
          <Tooltip title="View"><Button type="text" icon={<EyeOutlined />} size="small" onClick={() => navigate('/pems/tasks')} /></Tooltip>
        </Space>
      )
    },
  ];

  const perfLeaderColumns = [
    { title: 'Rank', key: 'rank', width: 45, render: (_, r) => <Text style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: r.rank <= 3 ? '#f59e0b' : '#64748b' }}>#{r.rank}</Text> },
    {
      title: 'Name', key: 'name', render: (_, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: r.rank <= 3 ? '#fffbeb' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: r.rank <= 3 ? '#f59e0b' : '#64748b', fontWeight: 600, fontSize: 10 }}>{r.SellerName?.[0] || r.UserName?.[0] || '?'}</div>
          <Text strong style={{ fontSize: 'var(--font-size-xs)' }}>{r.SellerName || r.UserName || '-'}</Text>
        </div>
      )
    },
    { title: 'Tasks', dataIndex: 'tasks', width: 50, align: 'center', render: (v) => <Text style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>{v}</Text> },
    { title: 'Done', dataIndex: 'completed', width: 50, align: 'center', render: (v) => <Text style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#2E7D32' }}>{v}</Text> },
    { title: 'Ach%', dataIndex: 'avgAchievement', width: 55, align: 'center', render: (v) => <Text style={{ fontSize: 10, fontWeight: 600, color: v >= 80 ? '#2E7D32' : '#ED6C02' }}>{v}%</Text> },
    { title: 'SLA%', key: 'sla', width: 55, align: 'center', render: (_, r) => <Text style={{ fontSize: 10, fontWeight: 600, color: r.slaCompliance >= 90 ? '#2E7D32' : '#D32F2F' }}>{r.slaCompliance}%</Text> },
  ];

  if (loading && !summary) return <div style={{ textAlign: 'center', padding: 60 }}><Spinner /></div>;

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh' }}>
      {/* ═══ GLOBAL FILTER BAR ═══ */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '12px 24px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Select allowClear placeholder="Department" value={department} onChange={setDepartment} style={{ width: 140 }} size="small"
            options={[{ value: 'Operations', label: 'Operations' }, { value: 'Brand Managers', label: 'Brand Managers' }, { value: 'Catalog Team', label: 'Catalog Team' }]} />
          <Select allowClear placeholder="Seller" value={sellerFilter} onChange={setSellerFilter} style={{ width: 160 }} size="small" showSearch optionFilterProp="label"
            options={sellers.map(s => ({ value: s.Id, label: s.Name }))} />
          <Select allowClear placeholder="Brand Manager" value={managerFilter} onChange={setManagerFilter} style={{ width: 160 }} size="small" showSearch optionFilterProp="label"
            options={managers.map(m => ({ value: m.Id, label: m.FullName }))} />
          <Select allowClear placeholder="Status" value={statusFilter} onChange={setStatusFilter} style={{ width: 130 }} size="small"
            options={['DRAFT', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'REWORK'].map(s => ({ value: s, label: s }))} />
          <Select allowClear placeholder="Priority" value={priorityFilter} onChange={setPriorityFilter} style={{ width: 110 }} size="small"
            options={['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(p => ({ value: p, label: p }))} />
          <RangePicker size="small" style={{ width: 220 }} onChange={setDateRange} />
          <div style={{ flex: 1 }} />
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadAll} loading={loading} size="small">Refresh</Button>
            <Button icon={<DownloadOutlined />} size="small">Export</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/pems/tasks')} size="small" style={{ borderRadius: 6 }}>Create Task</Button>
          </Space>
        </div>
      </div>

      <div style={{ padding: '16px 24px' }}>
        {/* ═══ EXECUTIVE KPI STRIP ═══ */}
        <Row gutter={[10, 10]} style={{ marginBottom: 14 }}>
          <Col xs={12} sm={8} md={3} style={{ flex: '1 1 0' }}>
            <KpiCard title="Total Tasks" value={kpi.total} icon={<ThunderboltOutlined />} color="#2563eb" />
          </Col>
          <Col xs={12} sm={8} md={3} style={{ flex: '1 1 0' }}>
            <KpiCard title="Active Tasks" value={kpi.active} icon={<SyncOutlined spin={kpi.active > 0} />} color="#2563eb" subtitle="Assigned + In Progress" />
          </Col>
          <Col xs={12} sm={8} md={3} style={{ flex: '1 1 0' }}>
            <KpiCard title="Pending Reviews" value={kpi.pendingReview} icon={<EyeOutlined />} color="#9333ea" />
          </Col>
          <Col xs={12} sm={8} md={3} style={{ flex: '1 1 0' }}>
            <KpiCard title="Approved" value={kpi.approved} icon={<CheckCircleOutlined />} color="#2E7D32" />
          </Col>
          <Col xs={12} sm={8} md={3} style={{ flex: '1 1 0' }}>
            <KpiCard title="Achievement %" value={`${kpi.avgAchievementPct || 0}%`} icon={<TrophyOutlined />} color="#ED6C02" />
          </Col>
          <Col xs={12} sm={8} md={3} style={{ flex: '1 1 0' }}>
            <KpiCard title="Completion Rate" value={`${kpi.completionRate || 0}%`} icon={<CheckCircleOutlined />} color="#2E7D32" />
          </Col>
          <Col xs={12} sm={8} md={3} style={{ flex: '1 1 0' }}>
            <KpiCard title="SLA Compliance" value={`${kpi.slaCompliance || 0}%`} icon={<ClockCircleOutlined />} color={kpi.slaCompliance >= 90 ? '#2E7D32' : '#D32F2F'} />
          </Col>
          <Col xs={12} sm={8} md={3} style={{ flex: '1 1 0' }}>
            <KpiCard title="Overdue" value={kpi.overdue} icon={<WarningOutlined />} color="#D32F2F" subtitle="Critical metric" />
          </Col>
        </Row>

        {/* ═══ PIPELINE + STATUS ═══ */}
        <Row gutter={[12, 12]} style={{ marginBottom: 14 }}>
          <Col xs={24} lg={14}><PipelineFunnel pipeline={pipeline} total={total} /></Col>
          <Col xs={24} lg={10}><StatusDistribution dist={statusDist} total={total} /></Col>
        </Row>

        {/* ═══ DEPARTMENT PERFORMANCE ═══ */}
        <Card size="small" title="Department Performance" styles={{ body: { padding: 0 } }} style={{ borderRadius: 10, marginBottom: 14 }}>
          <Table dataSource={departments} size="small" rowKey="Department" pagination={false}
            columns={[
              { title: 'Department', dataIndex: 'Department', width: 140, render: (d) => <Text strong style={{ fontSize: 'var(--font-size-sm)' }}>{d}</Text> },
              { title: 'Tasks', dataIndex: 'totalTasks', width: 60, align: 'center' },
              { title: 'Open', dataIndex: 'openTasks', width: 55, align: 'center', render: (v) => <Text style={{ color: '#2563eb', fontWeight: 600 }}>{v}</Text> },
              { title: 'Completed', dataIndex: 'completedTasks', width: 80, align: 'center', render: (v) => <Text style={{ color: '#2E7D32', fontWeight: 600 }}>{v}</Text> },
              { title: 'Achiev%', dataIndex: 'avgAchievementPct', width: 80, render: (v) => <Tag color={v >= 80 ? 'success' : 'warning'} style={{ borderRadius: 6, fontSize: 10 }}>{v}%</Tag> },
              { title: 'Completion', key: 'cr', width: 100, render: (_, r) => <Progress percent={r.completionRate} size="small" strokeColor={r.completionRate >= 80 ? '#2E7D32' : '#ED6C02'} format={p => `${p}%`} /> },
              { title: 'SLA%', dataIndex: 'slaCompliance', width: 80, render: (v) => <Text style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: v >= 90 ? '#2E7D32' : '#D32F2F' }}>{v}%</Text> },
              { title: 'Review', dataIndex: 'pendingReview', width: 60, align: 'center', render: (v) => v > 0 ? <Badge count={v} style={{ background: '#9333ea' }} /> : <Text type="secondary">0</Text> },
              { title: 'Rework', dataIndex: 'rework', width: 55, align: 'center', render: (v) => v > 0 ? <Badge count={v} style={{ background: '#ED6C02' }} /> : <Text type="secondary">0</Text> },
              { title: 'Overdue', dataIndex: 'overdueTasks', width: 60, align: 'center', render: (v) => v > 0 ? <Badge count={v} style={{ background: '#D32F2F' }} /> : <Text type="secondary">0</Text> },
            ]}
          />
        </Card>

        {/* ═══ TOP PERFORMERS + RISK ═══ */}
        <Row gutter={[12, 12]} style={{ marginBottom: 14 }}>
          <Col xs={24} lg={10}>
            <Card size="small" title={<Space><TrophyOutlined style={{ color: '#f59e0b' }} /><Text strong style={{ fontSize: 13 }}>Top Sellers</Text></Space>} styles={{ body: { padding: 0 } }} style={{ borderRadius: 10 }}>
              <Table dataSource={topPerformers.topSellers} columns={perfLeaderColumns} rowKey="SellerId" size="small" pagination={false} />
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card size="small" title={<Space><TeamOutlined style={{ color: '#9333ea' }} /><Text strong style={{ fontSize: 13 }}>Top Brand Managers</Text></Space>} styles={{ body: { padding: 0 } }} style={{ borderRadius: 10 }}>
              <Table dataSource={topPerformers.topManagers} columns={perfLeaderColumns.map(c => c.dataIndex === 'SellerName' ? {
                ...c, key: 'userName', render: (_, r) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 6, background: r.rank <= 3 ? '#fffbeb' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: r.rank <= 3 ? '#f59e0b' : '#64748b', fontWeight: 600, fontSize: 10 }}>{r.UserName?.[0] || '?'}</div>
                    <Text strong style={{ fontSize: 'var(--font-size-xs)' }}>{r.UserName || '-'}</Text>
                  </div>
                )
              } : c)} rowKey="UserId" size="small" pagination={false} />
            </Card>
          </Col>
          <Col xs={24} lg={4}><RiskCenter risk={risk} /></Col>
        </Row>

        {/* ═══ LIVE TASK QUEUE ═══ */}
        <Card size="small" title={<Space><FireOutlined style={{ color: '#D32F2F' }} /><Text strong style={{ fontSize: 13 }}>Live Task Queue</Text><Tag style={{ fontSize: 9, borderRadius: 10 }}>{liveTasks.length} tasks</Tag></Space>}
          styles={{ body: { padding: 0 } }} style={{ borderRadius: 10, marginBottom: 14 }}
          extra={<Button size="small" type="link" onClick={() => navigate('/pems/tasks')}>View All <RightOutlined style={{ fontSize: 10 }} /></Button>}>
          <Table dataSource={liveTasks} columns={liveTaskColumns} rowKey="Id" size="small" pagination={false} scroll={{ x: 1100 }}
            rowClassName={(_, i) => i % 2 === 0 ? '' : 'bg-gray-50'}
            onRow={(r) => ({ style: { cursor: 'default' } })}
          />
        </Card>

        {/* ═══ WORKLOAD + ACTIVITY ═══ */}
        <Row gutter={[12, 12]} style={{ marginBottom: 14 }}>
          <Col xs={24} lg={14}>
            <Card size="small" title="Workload Distribution" styles={{ body: { padding: '12px 16px', maxHeight: 300, overflow: 'auto' } }} style={{ borderRadius: 10 }}>
              {workload.length === 0 ? <Empty description="No workload data" /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {workload.slice(0, 10).map(w => {
                    const total = w.assigned + w.inProgress + w.review + w.rework || 1;
                    return (
                      <div key={w.AssignedTo}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text style={{ fontSize: 'var(--font-size-xs)', fontWeight: 500 }}>{w.AssigneeName || 'Unassigned'} <Text type="secondary" style={{ fontSize: 10 }}>({w.Department})</Text></Text>
                          <Text style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>{w.total} tasks</Text>
                        </div>
                        <div style={{ display: 'flex', height: 16, borderRadius: "var(--radius-sm)", overflow: 'hidden' }}>
                          <div style={{ width: `${(w.assigned / total) * 100}%`, background: '#2563eb', transition: 'width 0.3s' }} title={`Assigned: ${w.assigned}`} />
                          <div style={{ width: `${(w.inProgress / total) * 100}%`, background: '#9333ea', transition: 'width 0.3s' }} title={`In Progress: ${w.inProgress}`} />
                          <div style={{ width: `${(w.review / total) * 100}%`, background: '#ED6C02', transition: 'width 0.3s' }} title={`Review: ${w.review}`} />
                          <div style={{ width: `${(w.rework / total) * 100}%`, background: '#D32F2F', transition: 'width 0.3s' }} title={`Rework: ${w.rework}`} />
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                    {[{ label: 'Assigned', color: '#2563eb' }, { label: 'In Progress', color: '#9333ea' }, { label: 'Review', color: '#ED6C02' }, { label: 'Rework', color: '#D32F2F' }].map(l => (
                      <Space key={l.label} size={4}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />
                        <Text style={{ fontSize: 10, color: '#64748b' }}>{l.label}</Text>
                      </Space>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </Col>
          <Col xs={24} lg={10}><ActivityFeed activities={activityFeed} /></Col>
        </Row>
      </div>
    </div>
  );
}
