import { Spinner } from "@/components/Spinner";
import React, { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Table, Tag, Progress, Typography, Space, Select, Button, DatePicker, Badge, Tooltip, Empty } from 'antd';
import {
  ThunderboltOutlined, SyncOutlined, EyeOutlined, CheckCircleOutlined,
  ClockCircleOutlined, WarningOutlined, TrophyOutlined,
  ReloadOutlined, PlusOutlined, TeamOutlined,
  FireOutlined, RightOutlined, EditOutlined, RocketOutlined, DownloadOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import tasksApi from '../services/tasksApi';
import s from './TaskPerformanceDashboard.module.css';

const { Text } = Typography;
const { RangePicker } = DatePicker;

/* ── Status → semantic tone (tone classes carry measured >= 4.5:1 text) ── */
const STATUS_TONE = {
  DRAFT: 'neutral', ASSIGNED: 'info', ACCEPTED: 'accent', IN_PROGRESS: 'info',
  SUBMITTED: 'warning', UNDER_REVIEW: 'accent', APPROVED: 'success',
  REJECTED: 'danger', REWORK: 'warning', CANCELLED: 'neutral',
};
const PRIORITY_TONE = { CRITICAL: 'danger', HIGH: 'warning', MEDIUM: 'info', LOW: 'neutral' };
const SLA_TONE = { WITHIN_SLA: 'success', AT_RISK: 'warning', BREACHED: 'danger' };

/* ── Status → solid fill for bars (>= 3:1, non-text) ── */
const STATUS_FILL = {
  DRAFT: 'var(--bc-slate-400)', ASSIGNED: 'var(--bc-primary-500)', ACCEPTED: 'var(--bc-violet-500)',
  IN_PROGRESS: 'var(--bc-primary-500)', SUBMITTED: 'var(--bc-amber-500)', UNDER_REVIEW: 'var(--bc-violet-500)',
  APPROVED: 'var(--bc-green-500)', REJECTED: 'var(--bc-red-500)', REWORK: 'var(--bc-amber-500)',
  CANCELLED: 'var(--bc-slate-400)',
};

const tagClass = (map, value) => `${s.tag} ${s.tagSm} ${s[`tag${map[value] || 'Neutral'}`] || s.tagNeutral}`;
const fill = (value) => STATUS_FILL[value] || 'var(--bc-slate-400)';

function formatTime(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  const diffMin = Math.floor((Date.now() - d) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

function KpiCard({ title, value, subtitle, tone = 'Brand', icon }) {
  return (
    <div className={`${s.kpiCard} ${s[`tone${tone}`]}`}>
      <div className={s.kpiHead}>
        <div>
          <span className={s.kpiTitle}>{title}</span>
          <div className={s.kpiValue}>{value}</div>
          {subtitle && <span className={s.kpiSubtitle}>{subtitle}</span>}
        </div>
        {icon && <div className={s.kpiIcon} aria-hidden="true">{icon}</div>}
      </div>
    </div>
  );
}

function PipelineFunnel({ pipeline, total }) {
  const stages = [
    { key: 'draft', label: 'Draft' },
    { key: 'assigned', label: 'Assigned' },
    { key: 'accepted', label: 'Accepted' },
    { key: 'inProgress', label: 'In Progress' },
    { key: 'submitted', label: 'Submitted' },
    { key: 'underReview', label: 'Under Review' },
    { key: 'approved', label: 'Approved' },
  ];
  const maxVal = Math.max(...stages.map(st => pipeline[st.key] || 0), 1);
  return (
    <Card size="small" title={<Space><RocketOutlined style={{ color: 'var(--bc-primary-700)' }} /><Text strong style={{ fontSize: 13 }}>Execution Pipeline</Text></Space>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {stages.map((stage) => {
          const val = pipeline[stage.key] || 0;
          const pct = total > 0 ? Math.round((val / total) * 100) : 0;
          const barWidth = (val / maxVal) * 100;
          return (
            <div key={stage.key} className={s.funnelRow}>
              <Text className={s.funnelLabel}>{stage.label}</Text>
              <div className={s.funnelTrack}>
                <div className={s.funnelFill} style={{ width: `${barWidth}%`, background: fill(stage.key) }} />
              </div>
              <Text className={s.funnelValue}>{val}</Text>
              <Text className={s.funnelPct}>{pct}%</Text>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function StatusDistribution({ dist, total }) {
  const items = [
    { key: 'draft', label: 'Draft' }, { key: 'assigned', label: 'Assigned' },
    { key: 'accepted', label: 'Accepted' }, { key: 'inProgress', label: 'In Progress' },
    { key: 'submitted', label: 'Submitted' }, { key: 'underReview', label: 'Under Review' },
    { key: 'approved', label: 'Approved' }, { key: 'rejected', label: 'Rejected' },
    { key: 'rework', label: 'Rework' },
  ];
  return (
    <Card size="small" title="Status Distribution">
      <div className={s.distGrid}>
        {items.map((item) => {
          const count = dist[item.key] || 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const tone = s[`tag${STATUS_TONE[item.key.toUpperCase()] || 'Neutral'}`];
          return (
            <Tooltip key={item.key} title={`${item.label}: ${count} (${pct}%)`}>
              <div className={`${s.distChip} ${tone}`}>
                <div className={s.distValue}>{count}</div>
                <div className={s.distLabel}>{item.label}</div>
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
    { label: 'SLA Breached', value: risk.slaBreached || 0, tone: 'Danger' },
    { label: 'Overdue Tasks', value: risk.overdue || 0, tone: 'Danger' },
    { label: 'Stale Reviews (>48h)', value: risk.staleReviews || 0, tone: 'Warning' },
    { label: 'Rejected Tasks', value: risk.rejected || 0, tone: 'Warning' },
    { label: 'Rework Tasks', value: risk.rework || 0, tone: 'Warning' },
    { label: 'High Priority Delays', value: risk.highPriorityDelays || 0, tone: 'Danger' },
    { label: 'SLA At Risk', value: risk.slaAtRisk || 0, tone: 'Warning' },
  ];
  return (
    <Card size="small" title={<Space><WarningOutlined style={{ color: 'var(--bc-status-danger-text)' }} /><Text strong style={{ fontSize: 13 }}>Risk Center</Text></Space>}>
      <div className={s.riskGrid}>
        {items.map((item) => {
          const tone = s[`tone${item.tone}`];
          return (
            <div key={item.label} className={`${s.riskCard} ${tone}`} style={{ background: 'var(--toneBg)', borderColor: 'var(--tone)' }}>
              <div className={s.riskHead}>
                <div className={s.riskValue} style={{ color: 'var(--toneText)' }}>{item.value}</div>
                <Tag className={tagClass({ x: item.tone }, item.tone)}>{item.tone === 'Danger' ? 'high' : 'watch'}</Tag>
              </div>
              <div className={s.riskLabel}>{item.label}</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function ActivityFeed({ activities }) {
  const actionIcons = {
    CREATED: <PlusOutlined />,
    STATUS_CHANGED: <SyncOutlined />,
    SUBTASK_COMPLETED: <CheckCircleOutlined />,
    EVIDENCE_UPLOADED: <EditOutlined />,
  };
  const actionTone = { CREATED: 'info', STATUS_CHANGED: 'success', SUBTASK_COMPLETED: 'success', EVIDENCE_UPLOADED: 'accent' };
  return (
    <Card size="small" title={<Space><ClockCircleOutlined style={{ color: 'var(--bc-text-secondary)' }} /><Text strong style={{ fontSize: 13 }}>Activity Feed</Text></Space>}
      styles={{ body: { padding: '8px 16px', maxHeight: 320, overflow: 'auto' } }}>
      {activities.length === 0 ? <Text className={s.valueSecondary} style={{ fontSize: 'var(--bc-text-xs)' }}>No recent activity</Text> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {activities.map((a) => {
            const tone = s[`tag${actionTone[a.Action] || 'Neutral'}`];
            return (
              <div key={a.Id} className={s.feedItem}>
                <div className={`${s.feedIcon} ${tone}`} aria-hidden="true">
                  {actionIcons[a.Action] || <SyncOutlined />}
                </div>
                <div className={s.feedBody}>
                  <Text className={s.valueBody} style={{ fontSize: 'var(--bc-text-xs)' }}>
                    <Text strong className={s.strongText}>{a.ActorName || 'System'}</Text>{' '}
                    {String(a.Action || '').replace(/_/g, ' ').toLowerCase()}
                    {a.InstanceCode && <> <Text strong className={s.valueInfo}>{a.InstanceCode}</Text></>}
                    {a.Title && <> — {a.Title}</>}
                  </Text>
                  {a.Details && <Text className={s.feedDetails}>{a.Details}</Text>}
                </div>
                <Text className={s.feedTime}>{formatTime(a.CreatedAt)}</Text>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export default function TaskPerformanceDashboard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [liveTasks, setLiveTasks] = useState([]);
  const [activityFeed, setActivityFeed] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [error, setError] = useState(null);

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

  const loadAll = useCallback(async () => {
    const p = {};
    if (department) p.department = department;
    if (sellerFilter) p.sellerId = sellerFilter;
    if (managerFilter) p.assignedTo = managerFilter;
    if (statusFilter) p.status = statusFilter;
    if (priorityFilter) p.priority = priorityFilter;
    if (dateRange?.[0]) p.dateFrom = dateRange[0].toISOString();
    if (dateRange?.[1]) p.dateTo = dateRange[1].toISOString();
    try {
      const [sumRes, liveRes, feedRes] = await Promise.all([
        tasksApi.getDashboardSummary(p),
        tasksApi.getLiveTasks(p),
        tasksApi.getActivityFeed(),
      ]);
      if (sumRes.success) setSummary(sumRes.data);
      if (liveRes.success) setLiveTasks(liveRes.data);
      if (feedRes.success) setActivityFeed(feedRes.data);
      setError(null);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Dashboard error:', err);
      setError('Could not load dashboard data. Please retry.');
    }
  }, [department, sellerFilter, managerFilter, statusFilter, priorityFilter, dateRange]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- loadAll is async; the fetch is the standard data-loading effect for this page
  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [sRes, mRes] = await Promise.allSettled([
        tasksApi.getSellers().catch(() => null),
        tasksApi.getBrandManagers().catch(() => null),
      ]);
      if (cancelled) return;
      if (sRes.value?.success) setSellers(sRes.value.data);
      if (mRes.value?.success) setManagers(mRes.value.data);
    })();
    return () => { cancelled = true; };
  }, []);

  const handleRefresh = () => {
    setError(null);
    setRefreshing(true);
    loadAll().finally(() => setRefreshing(false));
  };

  const kpi = summary?.kpi || {};
  const pipeline = summary?.pipeline || {};
  const departments = summary?.departments || [];
  const topPerformers = summary?.topPerformers || { topSellers: [], topManagers: [] };
  const workload = summary?.workload || [];
  const risk = summary?.risk || {};
  const statusDist = summary?.statusDistribution || {};
  const total = kpi.total || 0;
  const loading = summary === null && !error;

  const liveTaskColumns = [
    {
      title: 'Task', key: 'task', width: 200, render: (_, r) => (
        <div>
          <Text strong className={`${s.valueInfo} ${s.linkText}`} onClick={() => navigate('/tasks/tasks')}>{r.InstanceCode}</Text>
          <Text className={s.valueBody} style={{ fontSize: 'var(--bc-text-xs)', display: 'block', lineHeight: 1.3 }}>{r.Title || 'Untitled'}</Text>
        </div>
      )
    },
    { title: 'Dept', dataIndex: 'Department', width: 100, render: (d) => <Tag className={`${s.tag} ${s.tagSm} ${s.tagInfo}`}>{d || '-'}</Tag> },
    { title: 'Seller', dataIndex: 'SellerName', width: 100, render: (v) => <Text className={s.valueBody} style={{ fontSize: 'var(--bc-text-xs)' }}>{v || '-'}</Text> },
    { title: 'Assignee', dataIndex: 'AssigneeName', width: 100, render: (v) => <Text className={s.valueBody} style={{ fontSize: 'var(--bc-text-xs)' }}>{v || '-'}</Text> },
    { title: 'Status', dataIndex: 'Status', width: 100, render: (v) => <Tag className={tagClass(STATUS_TONE, v)}>{v}</Tag> },
    { title: 'Priority', dataIndex: 'Priority', width: 80, render: (v) => <Tag className={tagClass(PRIORITY_TONE, v)}>{v}</Tag> },
    {
      title: 'Ach%', dataIndex: 'AchievementPct', width: 65, align: 'center',
      render: (v) => <Text className={v >= 80 ? s.valueSuccess : v >= 50 ? s.valueWarning : s.valueDanger} style={{ fontWeight: 600 }}>{v || 0}%</Text>
    },
    {
      title: 'Due', dataIndex: 'DueDate', width: 80, render: (d) => d
        ? <Text className={new Date(d) < new Date() ? s.valueDanger : s.valueSecondary}>{new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</Text>
        : '-'
    },
    { title: 'SLA', dataIndex: 'SLAStatus', width: 80, render: (v) => <Tag className={tagClass(SLA_TONE, v)}>{v?.replace('_', ' ')}</Tag> },
    {
      title: 'Actions', key: 'actions', width: 80, align: 'right', render: (_, r) => (
        <Tooltip title="View">
          <Button type="text" icon={<EyeOutlined />} size="small" aria-label={`View task ${r.InstanceCode || ''}`} onClick={() => navigate('/tasks/tasks')} />
        </Tooltip>
      )
    },
  ];

  const leaderColumns = (nameKey) => [
    {
      title: 'Rank', key: 'rank', width: 45,
      render: (_, r) => <Text className={r.rank <= 3 ? s.valueWarning : s.valueSecondary} style={{ fontWeight: 600 }}>#{r.rank}</Text>
    },
    {
      title: 'Name', key: 'name', render: (_, r) => {
        const name = r[nameKey];
        return (
          <div className={s.leader}>
            <div className={`${s.leaderAvatar} ${r.rank <= 3 ? s.leaderAvatarTop : s.leaderAvatarRest}`} aria-hidden="true">
              {name?.[0] || '?'}
            </div>
            <Text strong className={s.valueBody} style={{ fontSize: 'var(--bc-text-xs)' }}>{name || '-'}</Text>
          </div>
        );
      }
    },
    { title: 'Tasks', dataIndex: 'tasks', width: 50, align: 'center', render: (v) => <Text style={{ fontWeight: 600, fontSize: 'var(--bc-text-xs)' }}>{v}</Text> },
    { title: 'Done', dataIndex: 'completed', width: 50, align: 'center', render: (v) => <Text className={s.valueSuccess} style={{ fontWeight: 600, fontSize: 'var(--bc-text-xs)' }}>{v}</Text> },
    { title: 'Ach%', dataIndex: 'avgAchievement', width: 55, align: 'center', render: (v) => <Text className={v >= 80 ? s.valueSuccess : s.valueWarning} style={{ fontWeight: 600 }}>{v}%</Text> },
    { title: 'SLA%', key: 'sla', width: 55, align: 'center', render: (_, r) => <Text className={r.slaCompliance >= 90 ? s.valueSuccess : s.valueDanger} style={{ fontWeight: 600 }}>{r.slaCompliance}%</Text> },
  ];

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spinner /></div>;

  return (
    <div className={s.page}>
      {/* ═══ PAGE HEADER ═══ */}
      <div className={s.header}>
        <div className={s.headerRow}>
          <div>
            <div className={s.titleRow}>
              <h1 className={s.title}>Task Performance</h1>
            </div>
            <p className={s.subtitle}>
              Delivery health across {total || 0} task{total === 1 ? '' : 's'} — completion, achievement and SLA compliance.
            </p>
          </div>
          <div className={s.headerActions}>
            {lastRefreshed && <span className={s.lastUpdated}>Updated {formatTime(lastRefreshed.toISOString())}</span>}
            <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={refreshing} size="small">Refresh</Button>
            <Button icon={<DownloadOutlined />} size="small">Export</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/tasks/tasks')} size="small">Create Task</Button>
          </div>
        </div>
      </div>

      {/* ═══ GLOBAL FILTER BAR ═══ */}
      <div className={s.filterBar}>
        <div className={s.filterRow}>
          <Select allowClear placeholder="Department" value={department} onChange={setDepartment} style={{ width: 140 }} size="small"
            options={[{ value: 'Operations', label: 'Operations' }, { value: 'Brand Managers', label: 'Brand Managers' }, { value: 'Catalog Team', label: 'Catalog Team' }]} />
          <Select allowClear placeholder="Seller" value={sellerFilter} onChange={setSellerFilter} style={{ width: 160 }} size="small" showSearch optionFilterProp="label"
            options={sellers.map(x => ({ value: x.Id, label: x.Name }))} />
          <Select allowClear placeholder="Brand Manager" value={managerFilter} onChange={setManagerFilter} style={{ width: 160 }} size="small" showSearch optionFilterProp="label"
            options={managers.map(m => ({ value: m.Id, label: m.FullName }))} />
          <Select allowClear placeholder="Status" value={statusFilter} onChange={setStatusFilter} style={{ width: 130 }} size="small"
            options={['DRAFT', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'REWORK'].map(x => ({ value: x, label: x }))} />
          <Select allowClear placeholder="Priority" value={priorityFilter} onChange={setPriorityFilter} style={{ width: 110 }} size="small"
            options={['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(x => ({ value: x, label: x }))} />
          <RangePicker size="small" style={{ width: 220 }} onChange={setDateRange} />
          <div className={s.filterSpacer} />
        </div>
      </div>

      <div className={s.body}>
        {error && (
          <div role="alert" style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 'var(--bc-radius-md)', background: 'var(--bc-status-danger-bg)', color: 'var(--bc-status-danger-text)', border: '1px solid var(--bc-red-200)' }}>
            {error}
          </div>
        )}

        {/* ═══ PERFORMANCE KPIs ═══ */}
        <section className={s.group} aria-labelledby="kpi-performance-heading">
          <h2 id="kpi-performance-heading" className={`${s.groupLabel} ${s.groupLabelAccent}`}><TrophyOutlined /> Performance</h2>
          <Row gutter={[10, 10]}>
            <Col xs={12} sm={8} lg={6}>
              <KpiCard title="Achievement %" value={`${kpi.avgAchievementPct || 0}%`} tone="Warning" icon={<TrophyOutlined />} subtitle="Average evidence score" />
            </Col>
            <Col xs={12} sm={8} lg={6}>
              <KpiCard title="Completion Rate" value={`${kpi.completionRate || 0}%`} tone="Success" icon={<CheckCircleOutlined />} subtitle="Approved vs total" />
            </Col>
            <Col xs={12} sm={8} lg={6}>
              <KpiCard title="SLA Compliance" value={`${kpi.slaCompliance || 0}%`} tone={kpi.slaCompliance >= 90 ? 'Success' : 'Danger'} icon={<ClockCircleOutlined />} subtitle="Target 90%+" />
            </Col>
            <Col xs={12} sm={8} lg={6}>
              <KpiCard title="Overdue" value={kpi.overdue ?? 0} tone="Danger" icon={<WarningOutlined />} subtitle="Past due date" />
            </Col>
          </Row>
        </section>

        {/* ═══ WORKLOAD KPIs ═══ */}
        <section className={s.group} aria-labelledby="kpi-workload-heading">
          <h2 id="kpi-workload-heading" className={s.groupLabel}><ThunderboltOutlined /> Workload</h2>
          <Row gutter={[10, 10]}>
            <Col xs={12} sm={8} lg={6}>
              <KpiCard title="Total Tasks" value={kpi.total ?? 0} tone="Brand" icon={<ThunderboltOutlined />} />
            </Col>
            <Col xs={12} sm={8} lg={6}>
              <KpiCard title="Active Tasks" value={kpi.active ?? 0} tone="Brand" icon={<SyncOutlined />} subtitle="Assigned + In Progress" />
            </Col>
            <Col xs={12} sm={8} lg={6}>
              <KpiCard title="Pending Reviews" value={kpi.pendingReview ?? 0} tone="Info" icon={<EyeOutlined />} subtitle="Awaiting decision" />
            </Col>
            <Col xs={12} sm={8} lg={6}>
              <KpiCard title="Approved" value={kpi.approved ?? 0} tone="Success" icon={<CheckCircleOutlined />} />
            </Col>
          </Row>
        </section>

        {/* ═══ PIPELINE + STATUS ═══ */}
        <Row gutter={[12, 12]} style={{ marginBottom: 14 }}>
          <Col xs={24} lg={14}><PipelineFunnel pipeline={pipeline} total={total} /></Col>
          <Col xs={24} lg={10}><StatusDistribution dist={statusDist} total={total} /></Col>
        </Row>

        {/* ═══ DEPARTMENT PERFORMANCE ═══ */}
        <Card size="small" title="Department Performance" styles={{ body: { padding: 0 } }} style={{ marginBottom: 14 }}>
          <Table dataSource={departments} size="small" rowKey="Department" pagination={false} scroll={{ x: 800 }}
            rowClassName={(_, i) => (i % 2 === 1 ? s.zebraRow : '')}
            columns={[
              { title: 'Department', dataIndex: 'Department', width: 140, render: (d) => <Text strong className={s.strongText}>{d}</Text> },
              { title: 'Tasks', dataIndex: 'totalTasks', width: 60, align: 'center' },
              { title: 'Open', dataIndex: 'openTasks', width: 55, align: 'center', render: (v) => <Text className={s.valueInfo} style={{ fontWeight: 600 }}>{v}</Text> },
              { title: 'Completed', dataIndex: 'completedTasks', width: 80, align: 'center', render: (v) => <Text className={s.valueSuccess} style={{ fontWeight: 600 }}>{v}</Text> },
              {
                title: 'Achiev%', dataIndex: 'avgAchievementPct', width: 80,
                render: (v) => <Tag className={`${s.tag} ${s.tagSm} ${v >= 80 ? s.tagSuccess : s.tagWarning}`}>{v}%</Tag>
              },
              {
                title: 'Completion', key: 'cr', width: 100,
                render: (_, r) => (
                  <div className={r.completionRate >= 80 ? s.progressSuccess : s.progressWarning}>
                    <Progress percent={r.completionRate} size="small" strokeColor="currentColor" format={p => <span className={s.progressLabel}>{p}%</span>} />
                  </div>
                )
              },
              { title: 'SLA%', dataIndex: 'slaCompliance', width: 80, render: (v) => <Text className={v >= 90 ? s.valueSuccess : s.valueDanger} style={{ fontWeight: 600 }}>{v}%</Text> },
              { title: 'Review', dataIndex: 'pendingReview', width: 60, align: 'center', render: (v) => v > 0 ? <Badge count={v} color="var(--bc-violet-500)" /> : <Text className={s.valueSecondary}>0</Text> },
              { title: 'Rework', dataIndex: 'rework', width: 55, align: 'center', render: (v) => v > 0 ? <Badge count={v} color="var(--bc-amber-500)" /> : <Text className={s.valueSecondary}>0</Text> },
              { title: 'Overdue', dataIndex: 'overdueTasks', width: 60, align: 'center', render: (v) => v > 0 ? <Badge count={v} color="var(--bc-red-500)" /> : <Text className={s.valueSecondary}>0</Text> },
            ]}
          />
        </Card>

        {/* ═══ TOP PERFORMERS + RISK ═══ */}
        <Row gutter={[12, 12]} style={{ marginBottom: 14 }}>
          <Col xs={24} lg={10}>
            <Card size="small" title={<Space><TrophyOutlined style={{ color: 'var(--bc-status-warning-text)' }} /><Text strong style={{ fontSize: 13 }}>Top Sellers</Text></Space>} styles={{ body: { padding: 0 } }}>
              <Table dataSource={topPerformers.topSellers} columns={leaderColumns('SellerName')} rowKey="SellerId" size="small" pagination={false} />
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card size="small" title={<Space><TeamOutlined style={{ color: 'var(--bc-violet-700)' }} /><Text strong style={{ fontSize: 13 }}>Top Brand Managers</Text></Space>} styles={{ body: { padding: 0 } }}>
              <Table dataSource={topPerformers.topManagers} columns={leaderColumns('UserName')} rowKey="UserId" size="small" pagination={false} />
            </Card>
          </Col>
          <Col xs={24} lg={4}><RiskCenter risk={risk} /></Col>
        </Row>

        {/* ═══ LIVE TASK QUEUE ═══ */}
        <Card size="small" title={<Space><FireOutlined style={{ color: 'var(--bc-status-danger-text)' }} /><Text strong style={{ fontSize: 13 }}>Live Task Queue</Text><Tag className={`${s.tag} ${s.tagSm} ${s.tagNeutral}`}>{liveTasks.length} tasks</Tag></Space>}
          styles={{ body: { padding: 0 } }} style={{ marginBottom: 14 }}
          extra={<Button size="small" type="link" onClick={() => navigate('/tasks/tasks')}>View All <RightOutlined /></Button>}>
          <Table dataSource={liveTasks} columns={liveTaskColumns} rowKey="Id" size="small" pagination={false} scroll={{ x: 1100 }}
            rowClassName={(_, i) => (i % 2 === 1 ? s.zebraRow : '')}
            locale={{ emptyText: <Empty description="No active tasks" /> }}
          />
        </Card>

        {/* ═══ WORKLOAD + ACTIVITY ═══ */}
        <Row gutter={[12, 12]} style={{ marginBottom: 14 }}>
          <Col xs={24} lg={14}>
            <Card size="small" title="Workload Distribution" styles={{ body: { padding: '12px 16px', maxHeight: 300, overflow: 'auto' } }}>
              {workload.length === 0 ? <Empty description="No workload data" /> : (
                <div>
                  {workload.slice(0, 10).map((w) => {
                    const denom = w.assigned + w.inProgress + w.review + w.rework || 1;
                    return (
                      <div key={w.AssignedTo} className={s.workloadRow}>
                        <div className={s.workloadHead}>
                          <Text className={s.valueBody} style={{ fontWeight: 500 }}>
                            {w.AssigneeName || 'Unassigned'} <Text className={s.valueSecondary}>({w.Department})</Text>
                          </Text>
                          <Text style={{ fontWeight: 600 }}>{w.total} tasks</Text>
                        </div>
                        <div className={s.workloadBar}>
                          <div className={s.workloadSeg} style={{ width: `${(w.assigned / denom) * 100}%`, background: 'var(--bc-primary-500)' }} title={`Assigned: ${w.assigned}`} />
                          <div className={s.workloadSeg} style={{ width: `${(w.inProgress / denom) * 100}%`, background: 'var(--bc-violet-500)' }} title={`In Progress: ${w.inProgress}`} />
                          <div className={s.workloadSeg} style={{ width: `${(w.review / denom) * 100}%`, background: 'var(--bc-amber-500)' }} title={`Review: ${w.review}`} />
                          <div className={s.workloadSeg} style={{ width: `${(w.rework / denom) * 100}%`, background: 'var(--bc-red-500)' }} title={`Rework: ${w.rework}`} />
                        </div>
                      </div>
                    );
                  })}
                  <div className={s.legend}>
                    {[
                      { label: 'Assigned', color: 'var(--bc-primary-500)' },
                      { label: 'In Progress', color: 'var(--bc-violet-500)' },
                      { label: 'Review', color: 'var(--bc-amber-500)' },
                      { label: 'Rework', color: 'var(--bc-red-500)' },
                    ].map((l) => (
                      <span key={l.label} className={s.legendItem}>
                        <span className={s.legendSwatch} style={{ background: l.color }} aria-hidden="true" />
                        {l.label}
                      </span>
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
