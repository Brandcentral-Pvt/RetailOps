import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Button, Card, Checkbox, Col, DatePicker, Descriptions, Divider, Drawer, Empty,
  Form, Input, InputNumber, Modal, Row, Select, Space, Statistic, Table, Tabs, Tag,
  Typography, Upload, message,
} from 'antd';
import {
  CloudUploadOutlined, DownloadOutlined, ExportOutlined, PlayCircleOutlined, ReloadOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import { useAuth } from '../../../contexts/AuthContext';
import tasksApi from '../../tasks/services/tasksApi';
import oosApi from '../services/oosApi';

const { Title, Text, Paragraph } = Typography;

const CATEGORY_META = {
  CONFIRMED_CHANNEL_OOS: { color: 'red', label: 'Confirmed OOS' },
  DISCREPANCY: { color: 'orange', label: 'Discrepancy' },
  INSUFFICIENT_EVIDENCE: { color: 'gold', label: 'Insufficient evidence' },
  NO_CURRENT_OOS_SIGNAL: { color: 'green', label: 'No current OOS signal' },
};

const STATE_COLORS = {
  IN_STOCK: 'green', LOW_STOCK: 'gold', OOS: 'red', OOS_ZERO: 'red', UNKNOWN: 'default',
};

const CATEGORY_TABS = [
  { key: 'ALL', label: 'All cases' },
  { key: 'CONFIRMED_CHANNEL_OOS', label: 'Confirmed OOS' },
  { key: 'DISCREPANCY', label: 'Discrepancies' },
  { key: 'INSUFFICIENT_EVIDENCE', label: 'Insufficient' },
  { key: 'NO_CURRENT_OOS_SIGNAL', label: 'No signal' },
];

function parseEvidence(json) {
  if (!json) return null;
  if (typeof json === 'object') return json;
  try { return JSON.parse(json); } catch { return null; }
}

function sellerIdOf(s) { return s?._id || s?.Id || s?.id || null; }
function sellerNameOf(s) { return s?.Name || s?.name || 'Unnamed seller'; }

async function parseSpreadsheet(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });
}

function SourceUploadCard({ title, sourceType, disabled, onUploaded, runId }) {
  const [rows, setRows] = useState(null);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const beforeUpload = async (file) => {
    setError(null);
    setResult(null);
    try {
      const parsed = await parseSpreadsheet(file);
      setRows(parsed);
      setFileName(file.name);
      if (!parsed.length) setError('The first sheet has no rows.');
    } catch (err) {
      setError(`Could not read ${file.name}: ${err.message}`);
    }
    return false;
  };

  const upload = async () => {
    if (!rows?.length) return;
    setBusy(true);
    setError(null);
    try {
      const res = await oosApi.ingestUpload(runId, { sourceType, fileName, rows });
      setResult(res);
      message.success(`${title}: ${res.accepted} accepted, ${res.rejected} rejected`);
      onUploaded?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      size="small"
      title={(
        <Space>
          <CloudUploadOutlined />
          <span>{title}</span>
        </Space>
      )}
      data-testid={`oos-upload-${sourceType}`}
    >
      <Upload.Dragger
        accept=".csv,.xlsx,.xls"
        maxCount={1}
        beforeUpload={beforeUpload}
        disabled={disabled || busy}
        showUploadList={false}
      >
        <p className="ant-upload-drag-icon"><CloudUploadOutlined /></p>
        <p className="ant-upload-text">Choose a CSV/XLSX export</p>
        <p className="ant-upload-hint">Raw values are preserved; blanks stay unknown.</p>
      </Upload.Dragger>
      {fileName && (
        <Space direction="vertical" style={{ width: '100%', marginTop: 12 }}>
          <Text type="secondary">{fileName} — {rows?.length || 0} row(s)</Text>
          <Button type="primary" onClick={upload} loading={busy} disabled={disabled || !rows?.length}>
            Upload &amp; validate
          </Button>
        </Space>
      )}
      {error && <Alert style={{ marginTop: 12 }} type="error" showIcon message={error} />}
      {result && (
        <Alert
          style={{ marginTop: 12 }}
          type={result.rejected ? 'warning' : 'success'}
          showIcon
          message={`${result.accepted} accepted · ${result.rejected} rejected`}
          description={result.invalid?.length ? (
            <Text type="secondary">
              {result.invalid.slice(0, 5).map((r) => `Line ${r.line}: ${r.reason}`).join(' · ')}
              {result.invalid.length > 5 ? ` · +${result.invalid.length - 5} more` : ''}
            </Text>
          ) : null}
        />
      )}
    </Card>
  );
}

export default function OosWorkspacePage() {
  const navigate = useNavigate();
  const { hasPermission, isAdmin, isGlobalUser } = useAuth();
  const canManage = isAdmin || isGlobalUser || hasPermission('tasks_manage');
  const canResync = isAdmin || isGlobalUser || hasPermission('scraping_manage');

  const [sellers, setSellers] = useState([]);
  const [sellerId, setSellerId] = useState(null);
  const [runDate, setRunDate] = useState(dayjs());
  const [run, setRun] = useState(null);
  const [imports, setImports] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [resyncJobs, setResyncJobs] = useState([]);
  const [exportInfo, setExportInfo] = useState(null);
  const [pareto, setPareto] = useState(null);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [incidentDrawer, setIncidentDrawer] = useState(null);
  const [incidentForm] = Form.useForm();
  const [resyncModal, setResyncModal] = useState(null);
  const [resyncForm] = Form.useForm();
  const [verifyModal, setVerifyModal] = useState(null);
  const [verifyForm] = Form.useForm();
  const [submitForm] = Form.useForm();
  const [submitResult, setSubmitResult] = useState(null);

  useEffect(() => {
    tasksApi.getSellers()
      .then((res) => {
        const list = res?.data || res?.sellers || [];
        setSellers(list);
        if (list.length && !sellerId) setSellerId(sellerIdOf(list[0]));
      })
      .catch(() => setSellers([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = useCallback(async (runId) => {
    if (!runId) return;
    const [runRes, importsRes, decisionsRes, incidentsRes, resyncRes, exportRes] = await Promise.all([
      oosApi.getRun(runId).catch(() => null),
      oosApi.listImports(runId).catch(() => null),
      oosApi.listDecisions(runId).catch(() => null),
      oosApi.listRunIncidents(runId).catch(() => null),
      oosApi.listResync(runId).catch(() => null),
      oosApi.getLatestExport(runId).catch(() => null),
    ]);
    if (runRes?.run) setRun(runRes.run);
    setImports(importsRes?.imports || []);
    setDecisions(decisionsRes?.decisions || []);
    setIncidents(incidentsRes?.incidents || []);
    setResyncJobs(resyncRes?.jobs || []);
    setExportInfo(exportRes?.export || null);
  }, []);

  const startRun = async () => {
    if (!sellerId) return message.warning('Select a seller first');
    setBusy(true);
    setError(null);
    try {
      const res = await oosApi.createRun({
        sellerId,
        runDate: runDate.format('YYYY-MM-DD'),
      });
      setRun(res.run);
      setSubmitResult(null);
      await refresh(res.run.Id);
      message.success(res.created ? 'Daily OOS run started' : 'Existing run loaded');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const reconcile = async () => {
    if (!run) return;
    setBusy(true);
    setError(null);
    try {
      const res = await oosApi.reconcile(run.Id);
      message.success(`Analysed ${res.analysed} ASIN(s)`);
      await refresh(run.Id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const loadPareto = async () => {
    if (!sellerId) return;
    try {
      const res = await oosApi.getPareto(sellerId);
      setPareto(res.pareto);
    } catch (err) {
      setError(err.message);
    }
  };

  const incidentByAsin = useMemo(() => {
    const map = new Map();
    for (const inc of incidents) if (inc.Status === 'OPEN') map.set(inc.AsinCode, inc);
    return map;
  }, [incidents]);

  const filteredDecisions = useMemo(
    () => (activeCategory === 'ALL' ? decisions : decisions.filter((d) => d.Category === activeCategory)),
    [decisions, activeCategory],
  );

  const openIncident = (decision) => {
    const incident = incidentByAsin.get(decision.AsinCode);
    if (!incident) return message.info('No open incident for this case');
    setIncidentDrawer(incident);
    incidentForm.setFieldsValue({
      ownerId: incident.OwnerId,
      ownerName: incident.OwnerName,
      communicationStatus: incident.CommunicationStatus,
      nextAction: incident.NextAction,
      etaDate: incident.EtaDate ? dayjs(incident.EtaDate) : null,
      followUpDate: incident.FollowUpDate ? dayjs(incident.FollowUpDate) : null,
    });
  };

  const saveIncident = async () => {
    const values = await incidentForm.validateFields();
    try {
      await oosApi.updateIncident(incidentDrawer.Id, {
        ...values,
        etaDate: values.etaDate ? values.etaDate.format('YYYY-MM-DD') : null,
        followUpDate: values.followUpDate ? values.followUpDate.format('YYYY-MM-DD') : null,
      });
      message.success('Incident updated');
      setIncidentDrawer(null);
      await refresh(run.Id);
    } catch (err) {
      message.error(err.message);
    }
  };

  const requestResync = (decision) => {
    setResyncModal(decision);
    resyncForm.setFieldsValue({ asin: decision.AsinCode, revision: decision.Revision });
  };

  const submitResync = async () => {
    const values = await resyncForm.validateFields();
    try {
      const res = await oosApi.requestResync(run.Id, values);
      message.success(res.created ? 'Resync queued' : 'Duplicate resync collapsed onto existing job');
      setResyncModal(null);
      await refresh(run.Id);
    } catch (err) {
      message.error(err.message);
    }
  };

  const verifyResync = (job) => {
    setVerifyModal(job);
    verifyForm.setFieldsValue({ state: 'IN_STOCK', observationTime: dayjs() });
  };

  const submitVerification = async () => {
    const values = await verifyForm.validateFields();
    try {
      const res = await oosApi.verifyResync(verifyModal.Id, {
        sellerId: verifyModal.SellerId,
        channel: verifyModal.Channel,
        asin: verifyModal.AsinCode,
        state: values.state,
        observationTime: values.observationTime?.toISOString(),
      });
      message[res.resolved ? 'success' : 'warning'](
        res.resolved ? 'Verified recovery — incident resolved' : `Still open: ${res.reason}`,
      );
      setVerifyModal(null);
      await refresh(run.Id);
    } catch (err) {
      message.error(err.message);
    }
  };

  const buildExport = async () => {
    try {
      const res = await oosApi.buildExport(run.Id);
      setExportInfo(res.export);
      message.success(`Export v${res.version} built`);
    } catch (err) {
      message.error(err.message);
    }
  };

  const submitRun = async () => {
    const values = await submitForm.validateFields();
    try {
      const res = await oosApi.submit(run.Id, values);
      setSubmitResult(res);
      if (res.ok) message.success('Daily run closed');
      else message.warning('Submission blocked — see checklist');
      await refresh(run.Id);
    } catch (err) {
      setSubmitResult(err.payload || { ok: false, errors: [err.message] });
    }
  };

  const manifest = useMemo(() => {
    if (!run?.ManifestJson) return null;
    try { return JSON.parse(run.ManifestJson); } catch { return null; }
  }, [run]);

  const incidentColumns = [
    { title: 'ASIN', dataIndex: 'AsinCode', key: 'asin', width: 130 },
    {
      title: 'Owner', key: 'owner',
      render: (_, r) => r.OwnerName || r.OwnerId || <Text type="danger">Missing</Text>,
    },
    {
      title: 'Communication', dataIndex: 'CommunicationStatus', key: 'comm',
      render: (v) => v ? <Tag>{v}</Tag> : <Text type="danger">Missing</Text>,
    },
    { title: 'Next action', dataIndex: 'NextAction', key: 'next', ellipsis: true },
    {
      title: 'Follow-up', dataIndex: 'FollowUpDate', key: 'follow',
      render: (v) => (v ? dayjs(v).format('DD MMM YYYY') : <Text type="danger">Missing</Text>),
    },
    {
      title: '', key: 'actions', width: 90,
      render: (_, r) => <Button size="small" onClick={() => openIncident({ AsinCode: r.AsinCode })}>Open</Button>,
    },
  ];

  const decisionColumns = [
    { title: 'ASIN', dataIndex: 'AsinCode', key: 'asin', width: 130 },
    {
      title: 'Verdict', dataIndex: 'Category', key: 'category',
      render: (v) => <Tag color={CATEGORY_META[v]?.color}>{CATEGORY_META[v]?.label || v}</Tag>,
    },
    {
      title: 'RetailOps', key: 'ro',
      render: (_, r) => {
        const ev = parseEvidence(r.EvidenceJson);
        const s = ev?.retailOps?.state;
        return s ? <Tag color={STATE_COLORS[s]}>{s}</Tag> : <Text type="secondary">—</Text>;
      },
    },
    {
      title: 'BrandCentral', key: 'bc',
      render: (_, r) => {
        const ev = parseEvidence(r.EvidenceJson);
        const bc = ev?.brandCentral;
        if (!bc) return <Text type="secondary">—</Text>;
        return (
          <Space size={4}>
            <Tag color={STATE_COLORS[bc.state]}>{bc.state}</Tag>
            <Text>{bc.quantity ?? '—'}</Text>
          </Space>
        );
      },
    },
    {
      title: 'Vendor Central', key: 'vc',
      render: (_, r) => {
        const ev = parseEvidence(r.EvidenceJson);
        if (ev?.vendor?.applicable === false) return <Tag>N/A</Tag>;
        const vc = ev?.vendor;
        if (!vc) return <Text type="secondary">—</Text>;
        return (
          <Space size={4}>
            <Tag color={STATE_COLORS[vc.state]}>{vc.state}</Tag>
            <Text>{vc.quantity ?? '—'}</Text>
          </Space>
        );
      },
    },
    { title: 'Rule', dataIndex: 'RuleId', key: 'rule', width: 70 },
    { title: 'Rev', dataIndex: 'Revision', key: 'rev', width: 60 },
    {
      title: 'Actions', key: 'actions', width: 220,
      render: (_, r) => {
        const hasIncident = incidentByAsin.has(r.AsinCode);
        return (
          <Space size={4} wrap>
            <Button size="small" disabled={!hasIncident} onClick={() => openIncident(r)}>
              Incident
            </Button>
            {canResync && (
              <Button
                size="small"
                icon={<SyncOutlined />}
                disabled={!['DISCREPANCY', 'CONFIRMED_CHANNEL_OOS'].includes(r.Category)}
                onClick={() => requestResync(r)}
              >
                Resync
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  const resyncColumns = [
    { title: 'ASIN', dataIndex: 'AsinCode', key: 'asin', width: 130 },
    { title: 'Status', dataIndex: 'Status', key: 'status', render: (v) => <Tag color={v === 'VERIFIED_RECOVERED' ? 'green' : v === 'BLOCKED' ? 'red' : 'blue'}>{v}</Tag> },
    { title: 'Pre', dataIndex: 'PreStatus', key: 'pre' },
    { title: 'Post', dataIndex: 'PostStatus', key: 'post' },
    { title: 'Revision', dataIndex: 'DiscrepancyRevision', key: 'rev', width: 90 },
    {
      title: '', key: 'actions', width: 100,
      render: (_, r) => (canResync && ['QUEUED', 'RUNNING'].includes(r.Status)
        ? <Button size="small" onClick={() => verifyResync(r)}>Verify</Button>
        : null),
    },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1500, margin: '0 auto' }} data-testid="oos-workspace">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Title level={3} style={{ marginBottom: 4 }}>OOS reconciliation</Title>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            Daily monitoring &amp; reconciliation for OOS-RECON-001. Unknown values are never treated as zero,
            and a queued resync never counts as recovery.
          </Paragraph>
        </div>

        {error && <Alert type="error" showIcon closable message={error} onClose={() => setError(null)} />}

        <Card size="small">
          <Space wrap align="end">
            <div>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>Seller</Text>
              <Select
                style={{ width: 300 }}
                placeholder="Select seller"
                value={sellerId}
                onChange={(v) => { setSellerId(v); setRun(null); setPareto(null); }}
                showSearch
                optionFilterProp="label"
                options={sellers.map((s) => ({ value: sellerIdOf(s), label: sellerNameOf(s) }))}
                data-testid="oos-seller-select"
              />
            </div>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>Run date</Text>
              <DatePicker value={runDate} onChange={(v) => setRunDate(v || dayjs())} allowClear={false} />
            </div>
            <Button type="primary" icon={<PlayCircleOutlined />} onClick={startRun} loading={busy} data-testid="oos-start-run">
              Start / load run
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => refresh(run?.Id)} disabled={!run}>Refresh</Button>
            {canManage && (
              <Button onClick={reconcile} disabled={!run} loading={busy} data-testid="oos-reconcile">
                Run daily check
              </Button>
            )}
          </Space>
        </Card>

        {!run && <Empty description="Select a seller and start today's run to begin." />}

        {run && (
          <>
            <Row gutter={[16, 16]}>
              <Col xs={24} md={6}><Card size="small"><Statistic title="Eligible active ASINs" value={manifest?.eligibleActiveAsins ?? 0} /></Card></Col>
              <Col xs={24} md={6}><Card size="small"><Statistic title="RetailOps unavailable" value={manifest?.retailOpsUnavailableCount ?? 0} valueStyle={{ color: '#cf1322' }} /></Card></Col>
              <Col xs={24} md={6}><Card size="small"><Statistic title="Missing availability" value={manifest?.missingAvailabilityCount ?? 0} valueStyle={{ color: '#d48806' }} /></Card></Col>
              <Col xs={24} md={6}>
                <Card size="small">
                  <Statistic
                    title="GMS verification"
                    value={manifest?.gms?.verified ? 'Verified' : 'Unverified'}
                    valueStyle={{ color: manifest?.gms?.verified ? '#3f8600' : '#d48806' }}
                  />
                </Card>
              </Col>
            </Row>

            <Card
              size="small"
              title={(
                <Space>
                  <span>Run {dayjs(run.RunDate).format('DD MMM YYYY')}</span>
                  <Tag color={run.Status === 'CLOSED' ? 'green' : 'blue'}>{run.Status}</Tag>
                  <Tag>{run.Channel}</Tag>
                  <Tag>Policy {run.PolicyVersion || 'v1'}</Tag>
                </Space>
              )}
              extra={<Button size="small" onClick={() => navigate('/tasks/templates')}>Open playbook</Button>}
            >
              <Descriptions size="small" column={3}>
                <Descriptions.Item label="Run id">{run.Id}</Descriptions.Item>
                <Descriptions.Item label="Seller">{run.SellerName}</Descriptions.Item>
                <Descriptions.Item label="Last RetailOps observation">{manifest?.lastRetailOpsObservation ? dayjs(manifest.lastRetailOpsObservation).format('DD MMM YYYY HH:mm') : '—'}</Descriptions.Item>
              </Descriptions>
              {manifest?.gms && !manifest.gms.verified && (
                <Alert
                  style={{ marginTop: 12 }}
                  type="warning"
                  showIcon
                  message="GMS is unverified for this seller/window"
                  description="Pareto tiering will read GMS_UNVERIFIED — no ASIN is silently downgraded to standard."
                />
              )}
            </Card>

            <Row gutter={[16, 16]}>
              <Col xs={24} lg={12}>
                <SourceUploadCard
                  title="BrandCentral report"
                  sourceType="BRAND_CENTRAL"
                  runId={run.Id}
                  disabled={!canManage || run.Status === 'CLOSED'}
                  onUploaded={() => refresh(run.Id)}
                />
              </Col>
              <Col xs={24} lg={12}>
                <SourceUploadCard
                  title="Vendor Central report"
                  sourceType="VENDOR_CENTRAL"
                  runId={run.Id}
                  disabled={!canManage || run.Status === 'CLOSED'}
                  onUploaded={() => refresh(run.Id)}
                />
              </Col>
            </Row>

            <Card
              size="small"
              title={`Source manifest (${imports.length})`}
              data-testid="oos-imports"
            >
              <Table
                size="small"
                rowKey="Id"
                pagination={false}
                dataSource={imports}
                columns={[
                  { title: 'Source', dataIndex: 'SourceType', key: 'source' },
                  { title: 'File', dataIndex: 'FileName', key: 'file', ellipsis: true },
                  { title: 'Rows', dataIndex: 'TotalRows', key: 'rows' },
                  { title: 'Accepted', dataIndex: 'AcceptedCount', key: 'accepted' },
                  { title: 'Rejected', dataIndex: 'RejectedCount', key: 'rejected' },
                  { title: 'Status', dataIndex: 'Status', key: 'status', render: (v) => <Tag>{v}</Tag> },
                  { title: 'Stored', dataIndex: 'CreatedAt', key: 'created', render: (v) => (v ? dayjs(v).format('DD MMM HH:mm') : '—') },
                ]}
                locale={{ emptyText: 'No source reports uploaded yet' }}
              />
            </Card>

            <Card
              size="small"
              title={`Reconciliation cases (${decisions.length})`}
              extra={canManage && (
                <Button size="small" onClick={loadPareto}>Load GMS Pareto</Button>
              )}
            >
              <Tabs
                activeKey={activeCategory}
                onChange={setActiveCategory}
                items={CATEGORY_TABS.map((t) => ({
                  key: t.key,
                  label: `${t.label} (${t.key === 'ALL' ? decisions.length : decisions.filter((d) => d.Category === t.key).length})`,
                }))}
              />
              <Table
                size="small"
                rowKey="Id"
                dataSource={filteredDecisions}
                columns={decisionColumns}
                pagination={{ pageSize: 20, showSizeChanger: false }}
                scroll={{ x: 1100 }}
                locale={{ emptyText: 'Run the daily check to analyse uploaded reports.' }}
                data-testid="oos-decisions"
              />
            </Card>

            {pareto && (
              <Card size="small" title="GMS Pareto (whole eligible catalog)">
                {pareto.verified ? (
                  <Space size="large" wrap>
                    <Statistic title="Tier 1 ASINs" value={pareto.tier1Asins.length} />
                    <Statistic title="Eligible ASINs" value={pareto.eligibleCount} />
                    <Statistic title="Cumulative GMS" value={pareto.cumulativePct} suffix="%" />
                    <Text type="secondary">Window: {pareto.windowDays} days · Target {pareto.targetPct}%</Text>
                  </Space>
                ) : (
                  <Alert
                    type="warning"
                    showIcon
                    message="GMS_UNVERIFIED"
                    description="No eligible GMS rows for this seller/window. Tiering is unavailable rather than assumed."
                  />
                )}
              </Card>
            )}

            <Card size="small" title={`Open incidents (${incidents.length})`} data-testid="oos-incidents">
              <Alert
                style={{ marginBottom: 12 }}
                type="info"
                showIcon
                message="Open incidents may persist across daily submissions — but each needs an owner, communication status, next action and follow-up date."
              />
              <Table
                size="small"
                rowKey="Id"
                dataSource={incidents}
                columns={incidentColumns}
                pagination={false}
                locale={{ emptyText: 'No open incidents' }}
              />
            </Card>

            {canResync && (
              <Card size="small" title={`Resync jobs (${resyncJobs.length})`} data-testid="oos-resync">
                <Table
                  size="small"
                  rowKey="Id"
                  dataSource={resyncJobs}
                  columns={resyncColumns}
                  pagination={false}
                  locale={{ emptyText: 'No resync jobs yet' }}
                />
              </Card>
            )}

            <Card size="small" title="Review, export & close" data-testid="oos-review">
              <Space wrap align="center">
                <Button icon={<ExportOutlined />} onClick={buildExport} disabled={!canManage}>
                  Build immutable export
                </Button>
                {exportInfo && (
                  <Button icon={<DownloadOutlined />} onClick={() => oosApi.downloadExport(run.Id).catch((err) => message.error(err.message))}>
                    Download workbook
                  </Button>
                )}
                {exportInfo && (
                  <Text type="secondary">
                    v{exportInfo.Version} · {exportInfo.SheetCount} sheets · hash {String(exportInfo.FileHash).slice(0, 12)}
                  </Text>
                )}
              </Space>
              <Divider />
              <Form
                form={submitForm}
                layout="vertical"
                initialValues={{ sourcesValidated: true, exceptionsRecorded: false }}
                onFinish={submitRun}
              >
                <Row gutter={16}>
                  <Col xs={24} md={8}>
                    <Form.Item
                      name="reviewerId"
                      label="Independent reviewer id"
                      rules={[{ required: true, message: 'An independent reviewer is required' }]}
                    >
                      <Input placeholder="Reviewer user id" disabled={!canManage} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item name="sourcesValidated" valuePropName="checked" label="Sources validated">
                      <Checkbox disabled={!canManage}>Every source report validated</Checkbox>
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item name="exceptionsRecorded" valuePropName="checked" label="Exceptions recorded">
                      <Checkbox disabled={!canManage}>Every exception recorded instead</Checkbox>
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item name="note" label="Reviewer note">
                  <Input.TextArea rows={2} maxLength={500} disabled={!canManage} />
                </Form.Item>
                <Button type="primary" htmlType="submit" disabled={!canManage} data-testid="oos-submit">
                  Submit &amp; close daily run
                </Button>
              </Form>

              {submitResult && (
                <Alert
                  style={{ marginTop: 16 }}
                  type={submitResult.ok ? 'success' : 'error'}
                  showIcon
                  message={submitResult.ok ? 'Daily run closed' : 'Submission blocked'}
                  description={(
                    <Space direction="vertical" size={2}>
                      {(submitResult.errors || []).map((e) => <Text key={e}>• {e}</Text>)}
                      {submitResult.checklist?.map((c) => (
                        <Text key={c.key} type={c.ok ? 'success' : 'danger'}>
                          {c.ok ? '✓' : '✕'} {c.label}
                        </Text>
                      ))}
                    </Space>
                  )}
                />
              )}
            </Card>
          </>
        )}
      </Space>

      <Drawer
        title={incidentDrawer ? `Incident · ${incidentDrawer.AsinCode}` : 'Incident'}
        open={Boolean(incidentDrawer)}
        onClose={() => setIncidentDrawer(null)}
        width={460}
        extra={(
          <Space>
            <Button onClick={() => setIncidentDrawer(null)}>Cancel</Button>
            <Button type="primary" onClick={saveIncident}>Save</Button>
          </Space>
        )}
      >
        {incidentDrawer && (
          <Form form={incidentForm} layout="vertical">
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message="Owner + communication + next action + follow-up date are mandatory to submit."
            />
            <Form.Item name="ownerId" label="Owner id" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="ownerName" label="Owner name">
              <Input />
            </Form.Item>
            <Form.Item name="communicationStatus" label="Communication status" rules={[{ required: true }]}>
              <Select options={[
                { value: 'NOT_REQUIRED', label: 'Not required' },
                { value: 'PENDING', label: 'Pending approval' },
                { value: 'APPROVED', label: 'Approved' },
                { value: 'SENT', label: 'Sent' },
              ]} />
            </Form.Item>
            <Form.Item name="nextAction" label="Next action" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="etaDate" label="ETA">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="followUpDate" label="Follow-up date" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Button
              danger
              onClick={async () => {
                try {
                  await oosApi.resolveIncident(incidentDrawer.Id, { note: 'Resolved from OOS workspace' });
                  message.success('Incident resolved');
                  setIncidentDrawer(null);
                  await refresh(run.Id);
                } catch (err) { message.error(err.message); }
              }}
            >
              Mark resolved
            </Button>
          </Form>
        )}
      </Drawer>

      <Modal
        title="Request marketplace resync"
        open={Boolean(resyncModal)}
        onCancel={() => setResyncModal(null)}
        onOk={submitResync}
        okText="Queue resync"
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="A queued resync is not a recovery. Only a newer verified in-stock observation resolves the case."
        />
        <Form form={resyncForm} layout="vertical">
          <Form.Item name="asin" label="ASIN"><Input disabled /></Form.Item>
          <Form.Item name="revision" label="Discrepancy revision"><InputNumber style={{ width: '100%' }} disabled /></Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Verify post-sync observation"
        open={Boolean(verifyModal)}
        onCancel={() => setVerifyModal(null)}
        onOk={submitVerification}
        okText="Record verification"
      >
        <Form form={verifyForm} layout="vertical">
          <Form.Item name="state" label="Observed state" rules={[{ required: true }]}>
            <Select options={[
              { value: 'IN_STOCK', label: 'In stock' },
              { value: 'OOS', label: 'Out of stock' },
              { value: 'UNKNOWN', label: 'Unknown' },
            ]} />
          </Form.Item>
          <Form.Item name="observationTime" label="Observation time" rules={[{ required: true }]}>
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
