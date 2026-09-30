import { Spinner } from "@/components/Spinner";
import React, { useState, useEffect, useMemo } from 'react';
import {
  Card, Row, Col, Descriptions, Tag, Typography, Space, Spin, Button,
  Statistic, Tabs, Empty, Badge, Divider, Progress, Tooltip, Popconfirm, App
} from 'antd';
import {
  ArrowLeftOutlined, EditOutlined, CopyOutlined, PlayCircleOutlined,
  CheckCircleOutlined, ClockCircleOutlined, AimOutlined, BarChartOutlined,
  OrderedListOutlined, UserOutlined, SettingOutlined,
  RocketOutlined, ThunderboltOutlined, SafetyCertificateOutlined,
  FileTextOutlined, DeleteOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import tasksApi from '../services/tasksApi';
import { FREQUENCIES, CATEGORIES, PRIORITIES, DEPARTMENTS } from '../constants';

const { Text, Title } = Typography;

const CATEGORY_META = {
  LISTING:    { icon: <FileTextOutlined />,       color: '#0ea5e9', bg: 'linear-gradient(135deg,#e0f2fe,#dbeafe)', label: 'Listing' },
  PRICING:    { icon: <BarChartOutlined />,      color: '#10b981', bg: 'linear-gradient(135deg,#d1fae5,#ecfccb)', label: 'Pricing' },
  INVENTORY:  { icon: <SettingOutlined />,       color: '#f59e0b', bg: 'linear-gradient(135deg,#fef3c7,#ffedd5)', label: 'Inventory' },
  ADS:        { icon: <ThunderboltOutlined />,   color: '#ef4444', bg: 'linear-gradient(135deg,#fee2e2,#ffedd5)', label: 'Ads' },
  ANALYTICS:  { icon: <AimOutlined />,           color: '#8b5cf6', bg: 'linear-gradient(135deg,#ede9fe,#ddd6fe)', label: 'Analytics' },
  COMPLIANCE: { icon: <SafetyCertificateOutlined />, color: '#06b6d4', bg: 'linear-gradient(135deg,#cffafe,#e0f2fe)', label: 'Compliance' },
  GENERAL:    { icon: <CheckCircleOutlined />,   color: '#64748b', bg: 'linear-gradient(135deg,#f1f5f9,#e2e8f0)', label: 'General' },
};

export default function TemplateDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const [template, setTemplate] = useState(null);
  const [analytics, setAnalytics] = useState({});
  const [assignmentRules, setAssignmentRules] = useState(null);
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [detail, recentRes] = await Promise.all([
        tasksApi.getTemplateDetail(id),
        tasksApi.getInstances({ templateId: id, limit: 10 }).catch(() => ({ success: false })),
      ]);
      if (detail.success) {
        setTemplate(detail.data);
        setAnalytics(detail.data.analytics || {});
        setAssignmentRules(detail.data.assignmentRules);
      }
      if (recentRes.success) setInstances(recentRes.instances || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const subTasks = useMemo(() => template?.SubTaskDefinitions || [], [template]);
  const totalActivities = useMemo(() => subTasks.reduce((s, st) => s + (st.activities?.length || 0), 0), [subTasks]);
  const totalEstMinutes = useMemo(() => subTasks.reduce((s, st) => s + (st.activities?.reduce((a, act) => a + (act.estimatedMinutes || 0), 0) || 0), 0), [subTasks]);
  const meta = template ? (CATEGORY_META[template.Category] || CATEGORY_META.GENERAL) : null;
  const pri = template ? (PRIORITIES[template.Priority] || PRIORITIES.MEDIUM) : null;

  const handleDelete = async () => {
    setDeleting(true);
    try { await tasksApi.deleteTemplate(id); message.success('Template deleted'); navigate('/tasks/templates'); }
    catch { message.error('Delete failed'); }
    finally { setDeleting(false); }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spinner /></div>;
  if (!template) return <Empty description="Template not found" style={{ padding: 60 }} />;

  const tabItems = [
    {
      key: 'playbook',
      label: <Space><OrderedListOutlined /> Playbook</Space>,
      children: subTasks.length === 0 ? (
        <Empty description="No SOP / phases defined for this template yet." image={Empty.PRESENTED_IMAGE_SIMPLE}>
          <Button type="primary" icon={<EditOutlined />} onClick={() => navigate(`/tasks/templates?edit=${id}`)}>Define playbook</Button>
        </Empty>
      ) : (
        <div>
          <div style={{ marginBottom: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
            <Tag style={{ borderRadius: 10, background: 'linear-gradient(135deg,#ecfeff,#ede9fe)', color: '#0369a1', border: '1px solid #bae6fd', padding: '4px 10px', fontWeight: 700, fontSize: 11 }}>{subTasks.length} phase{subTasks.length !== 1 ? 's' : ''}</Tag>
            <Tag style={{ borderRadius: 10, background: '#f1f5f9', color: '#475569', border: 'none', padding: '4px 10px', fontWeight: 600, fontSize: 11 }}>{totalActivities} step{totalActivities !== 1 ? 's' : ''}</Tag>
            <Tag style={{ borderRadius: 10, background: '#fef3c7', color: '#b45309', border: 'none', padding: '4px 10px', fontWeight: 600, fontSize: 11 }}><ClockCircleOutlined /> {totalEstMinutes} min est.</Tag>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {subTasks.map((st, pi) => (
              <div key={pi} className="sop-phase">
                <div style={{ paddingLeft: 10, marginBottom: 8 }}>
                  <Space size={8}>
                    <Tag style={{ margin: 0, borderRadius: 8, background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', color: '#fff', border: 'none', padding: '3px 9px', fontSize: 10, fontWeight: 700, fontFamily: 'var(--bc-font-mono, Menlo, monospace)' }}>PHASE {pi + 1}</Tag>
                    <Text strong style={{ fontSize: 14, color: 'var(--bc-text-heading, #0f172a)' }}>{st.title || `Phase ${pi + 1}`}</Text>
                  </Space>
                </div>
                {(st.activities || []).map((act, ai) => (
                  <div key={ai} className="sop-step">
                    <div className="sop-step__num">{ai + 1}</div>
                    <div style={{ flex: 1 }}>
                      <Text strong style={{ fontSize: 13, color: 'var(--bc-text-heading)' }}>{act.title}</Text>
                      {act.instructions && <Text style={{ fontSize: 12, color: 'var(--bc-text-secondary, #64748b)', display: 'block', marginTop: 4, whiteSpace: 'pre-wrap' }}>{act.instructions}</Text>}
                      <Space style={{ marginTop: 6 }} wrap size={6}>
                        {act.expectedOutput && <Tag style={{ borderRadius: 8, background: '#ecfdf5', color: '#15803d', border: 'none', fontSize: 10, fontWeight: 600 }}>✓ {act.expectedOutput}</Tag>}
                        {act.estimatedMinutes && <Tag style={{ borderRadius: 8, background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', fontSize: 10, fontWeight: 600 }}><ClockCircleOutlined /> {act.estimatedMinutes}m</Tag>}
                      </Space>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      key: 'overview',
      label: <Space><AimOutlined /> Overview</Space>,
      children: (
        <Descriptions bordered size="middle" column={2} contentStyle={{ fontSize: 13 }} labelStyle={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', width: 160 }}>
          <Descriptions.Item label="Template Code" span={1}><Text code style={{ fontSize: 12 }}>{template.TaskCode}</Text></Descriptions.Item>
          <Descriptions.Item label="Status" span={1}><Tag color={template.IsActive ? 'success' : 'default'} style={{ borderRadius: 10 }}>{template.IsActive ? 'Active' : 'Draft'}</Tag></Descriptions.Item>
          <Descriptions.Item label="Name" span={2}><Text strong style={{ fontSize: 14 }}>{template.Name}</Text></Descriptions.Item>
          <Descriptions.Item label="Description" span={2}>{template.Description || <Text type="secondary">—</Text>}</Descriptions.Item>
          <Descriptions.Item label="Department"><Tag color="blue" style={{ borderRadius: 10 }}>{template.Department || 'Operations'}</Tag></Descriptions.Item>
          <Descriptions.Item label="Category"><Tag style={{ borderRadius: 10, background: meta.bg, color: meta.color, border: 'none', fontWeight: 700 }}>{meta?.icon} {meta.label}</Tag></Descriptions.Item>
          <Descriptions.Item label="Frequency">{FREQUENCIES.find(f => f.value === template.Frequency)?.label || template.Frequency}</Descriptions.Item>
          <Descriptions.Item label="Default priority"><Tag style={{ borderRadius: 10, background: pri.bg, color: pri.color, border: 'none', fontWeight: 700 }}>{pri.label}</Tag></Descriptions.Item>
          <Descriptions.Item label="SLA">{template.SLAHours}h</Descriptions.Item>
          <Descriptions.Item label="TAT">{template.TATHours}h</Descriptions.Item>
          <Descriptions.Item label="Target type">{template.TargetType}</Descriptions.Item>
          <Descriptions.Item label="Default target">{template.DefaultTarget ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Expected output">{template.ExpectedOutput || '—'}</Descriptions.Item>
          <Descriptions.Item label="Review required">{template.ReviewRequired ? <Tag color="purple" style={{ borderRadius: 8 }}>Yes</Tag> : <Tag>No</Tag>}</Descriptions.Item>
          <Descriptions.Item label="Criticality"><Progress percent={((template.CriticalityScore || 5) / 10) * 100} showInfo={false} strokeColor={(template.CriticalityScore || 5) >= 8 ? '#dc2626' : (template.CriticalityScore || 5) >= 5 ? '#f59e0b' : '#10b981'} style={{ width: 120 }} /> <Text style={{ fontSize: 12, marginLeft: 8 }}>{template.CriticalityScore || 5}/10</Text></Descriptions.Item>
          <Descriptions.Item label="Version"><Tag style={{ borderRadius: 8 }}>v{template.TemplateVersion || 1}</Tag></Descriptions.Item>
        </Descriptions>
      ),
    },
    {
      key: 'analytics',
      label: <Space><BarChartOutlined /> Performance</Space>,
      children: (
        <div>
          <Row gutter={[12, 12]}>
            <Col xs={12} sm={8} md={6}>
              <Card size="small" style={{ borderRadius: 14, borderLeft: '4px solid #2563eb' }} styles={{ body: { padding: '14px 16px' } }}>
                <Statistic title="Total runs" value={analytics.totalInstances || instances.length} valueStyle={{ fontSize: 24, fontWeight: 800 }} />
              </Card>
            </Col>
            <Col xs={12} sm={8} md={6}>
              <Card size="small" style={{ borderRadius: 14, borderLeft: '4px solid #16a34a' }} styles={{ body: { padding: '14px 16px' } }}>
                <Statistic title="Completed" value={analytics.completedInstances || 0} valueStyle={{ fontSize: 24, fontWeight: 800, color: '#16a34a' }} />
              </Card>
            </Col>
            <Col xs={12} sm={8} md={6}>
              <Card size="small" style={{ borderRadius: 14, borderLeft: '4px solid #0ea5e9' }} styles={{ body: { padding: '14px 16px' } }}>
                <Statistic title="Completion rate" value={`${analytics.completionRate || 0}%`} valueStyle={{ fontSize: 24, fontWeight: 800, color: '#0ea5e9' }} />
              </Card>
            </Col>
            <Col xs={12} sm={8} md={6}>
              <Card size="small" style={{ borderRadius: 14, borderLeft: '4px solid #f59e0b' }} styles={{ body: { padding: '14px 16px' } }}>
                <Statistic title="SLA compliance" value={`${analytics.slaCompliance || 0}%`} valueStyle={{ fontSize: 24, fontWeight: 800, color: '#f59e0b' }} />
              </Card>
            </Col>
          </Row>
          <Divider style={{ margin: '20px 0 12px' }} />
          <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 10 }}>Recent runs</Text>
          {instances.length === 0 ? (
            <Empty description="No task instances have been created from this template yet." image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {instances.map(i => {
                const wf = { DRAFT:{c:'#64748b',l:'Draft'}, ASSIGNED:{c:'#0288D1',l:'Assigned'}, IN_PROGRESS:{c:'#1976D2',l:'In Progress'}, UNDER_REVIEW:{c:'#9C27B0',l:'Review'}, APPROVED:{c:'#2E7D32',l:'Approved'}, REJECTED:{c:'#D32F2F',l:'Rejected'}, CANCELLED:{c:'#94a3b8',l:'Cancelled'} };
                const s = wf[i.Status] || { c: '#64748b', l: i.Status };
                return (
                  <div key={i.Id} onClick={() => navigate(`/tasks/tasks`)} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #f1f5f9', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space size={10}>
                      <Text code style={{ fontSize: 11 }}>{i.InstanceCode}</Text>
                      <Text style={{ fontSize: 12 }}>{i.Title}</Text>
                      {i.SellerName && <Tag style={{ fontSize: 10, borderRadius: 6 }}>{i.SellerName}</Tag>}
                    </Space>
                    <Tag style={{ borderRadius: 8, background: `${s.c}15`, color: s.c, border: 'none', fontSize: 10, fontWeight: 700 }}>{s.l}</Tag>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'assignment',
      label: <Space><UserOutlined /> Assignment</Space>,
      children: assignmentRules ? (
        <Descriptions bordered size="middle" column={2} contentStyle={{ fontSize: 13 }} labelStyle={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>
          <Descriptions.Item label="Mode"><Tag color={assignmentRules.AssignmentMode === 'auto' ? 'purple' : 'blue'} style={{ borderRadius: 10 }}>{assignmentRules.AssignmentMode === 'auto' ? <>Auto-assign <ThunderboltOutlined /></> : 'Manual'}</Tag></Descriptions.Item>
          <Descriptions.Item label="Strategy">{assignmentRules.AutoAssignStrategy || '—'}</Descriptions.Item>
          <Descriptions.Item label="Reviewer">{assignmentRules.ReviewerId || 'Not assigned'}</Descriptions.Item>
          <Descriptions.Item label="Backup reviewer">{assignmentRules.BackupReviewerId || 'None'}</Descriptions.Item>
          <Descriptions.Item label="Escalation">{assignmentRules.EscalationHours || 24}h</Descriptions.Item>
          <Descriptions.Item label="Approval"><Tag style={{ borderRadius: 8 }}>{assignmentRules.ApprovalLevel || 'single'}</Tag></Descriptions.Item>
          <Descriptions.Item label="Quality gate">{assignmentRules.QualityScoreRequired ? <Tag color="warning" style={{ borderRadius: 8 }}>AI score required</Tag> : <Tag>Not required</Tag>}</Descriptions.Item>
        </Descriptions>
      ) : (
        <Empty description="No assignment rules configured." image={Empty.PRESENTED_IMAGE_SIMPLE}>
          <Button icon={<EditOutlined />} onClick={() => navigate(`/tasks/templates?edit=${id}`)}>Configure</Button>
        </Empty>
      ),
    },
  ];

  return (
    <div style={{ background: 'var(--bc-surface-page, #f8fafc)', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '20px 24px 80px' }}>

        {/* Breadcrumb / back */}
        <Space style={{ marginBottom: 14 }}>
          <Button className="tpl-detail-back" icon={<ArrowLeftOutlined />} size="small" onClick={() => navigate('/tasks/templates')}>Templates</Button>
          <Text style={{ fontSize: 12, color: '#94a3b8' }}>/ {template.TaskCode}</Text>
        </Space>

        {/* Hero */}
        <div className="tpl-detail-hero">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0, flex: 1 }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: meta.bg, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>{meta.icon}</div>
              <div style={{ minWidth: 0 }}>
                <Space size={8} style={{ marginBottom: 6 }}>
                  <Text code style={{ fontSize: 11 }}>{template.TaskCode}</Text>
                  <Tag color={template.IsActive ? 'success' : 'default'} style={{ borderRadius: 10, margin: 0 }}>{template.IsActive ? 'Active' : 'Draft'}</Tag>
                  <Tag style={{ borderRadius: 10, background: pri.bg, color: pri.color, border: 'none', fontWeight: 700 }}>{pri.label} priority</Tag>
                  <Tag style={{ borderRadius: 10, background: meta.bg, color: meta.color, border: 'none', fontWeight: 700 }}>{meta.label}</Tag>
                  <Tag style={{ borderRadius: 10 }}>v{template.TemplateVersion || 1}</Tag>
                </Space>
                <Title level={3} style={{ margin: 0, fontSize: 22, letterSpacing: '-0.02em' }}>{template.Name}</Title>
                {template.Description && <Text style={{ fontSize: 13, color: '#64748b', display: 'block', marginTop: 4, maxWidth: 700 }}>{template.Description}</Text>}
              </div>
            </div>
            <Space wrap>
              <Button type="primary" icon={<PlayCircleOutlined />} size="large" onClick={() => navigate(`/tasks/tasks?template=${id}&new=1`)} style={{ borderRadius: 12, fontWeight: 700, background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none', boxShadow: '0 8px 20px -8px rgba(16,185,129,0.5)' }}>Run task from template</Button>
              <Button icon={<EditOutlined />} size="large" onClick={() => navigate(`/tasks/templates?edit=${id}`)} style={{ borderRadius: 12, fontWeight: 600 }}>Edit</Button>
              <Button icon={<CopyOutlined />} size="large" onClick={() => navigate(`/tasks/templates?clone=${id}`)} style={{ borderRadius: 12, fontWeight: 600 }}>Clone</Button>
              <Popconfirm title="Delete this template?" description="Existing tasks created from it are kept." onConfirm={handleDelete} okText="Delete" okButtonProps={{ danger: true }}>
                <Button danger icon={<DeleteOutlined />} size="large" style={{ borderRadius: 12 }} loading={deleting}>Delete</Button>
              </Popconfirm>
            </Space>
          </div>

          {/* KPI row */}
          <div className="tpl-detail-kpis">
            <div className="tpl-detail-kpi"><div className="tpl-detail-kpi-val">{subTasks.length}</div><div className="tpl-detail-kpi-lbl">Phases</div></div>
            <div className="tpl-detail-kpi"><div className="tpl-detail-kpi-val">{totalActivities}</div><div className="tpl-detail-kpi-lbl">Steps</div></div>
            <div className="tpl-detail-kpi"><div className="tpl-detail-kpi-val">{totalEstMinutes}m</div><div className="tpl-detail-kpi-lbl">Est. time</div></div>
            <div className="tpl-detail-kpi"><div className="tpl-detail-kpi-val">{template.SLAHours}h</div><div className="tpl-detail-kpi-lbl">SLA</div></div>
            <div className="tpl-detail-kpi"><div className="tpl-detail-kpi-val">{analytics.totalInstances || instances.length}</div><div className="tpl-detail-kpi-lbl">Total runs</div></div>
            <div className="tpl-detail-kpi"><div className="tpl-detail-kpi-val" style={{ color: '#16a34a' }}>{analytics.completionRate || 0}%</div><div className="tpl-detail-kpi-lbl">Completion</div></div>
          </div>
        </div>

        <Card style={{ borderRadius: 16 }} styles={{ body: { padding: 0 } }}>
          <Tabs items={tabItems} size="large" tabBarStyle={{ padding: '0 20px', margin: 0 }} />
        </Card>
      </div>
    </div>
  );
}
