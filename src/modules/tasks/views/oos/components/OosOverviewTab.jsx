import React, { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Statistic, Button, Space, Tag, Alert, Empty, Spin, Divider, Descriptions, Table, Typography } from 'antd';
import { ReloadOutlined, PlayCircleOutlined } from '@ant-design/icons';
import tasksApi from '../../../services/tasksApi';
import dayjs from 'dayjs';

const { Text } = Typography;

function OosOverviewTab({ task, activeRun, runs, loading, onCreateRun, canManage }) {
  const [summary, setSummary] = useState(null);
  const [runLoading, setRunLoading] = useState(false);

  const taskInstanceId = task?.Id;

  const loadSummary = useCallback(async () => {
    if (!taskInstanceId || !activeRun) return;
    setRunLoading(true);
    try {
      const res = await tasksApi.getOosContext(taskInstanceId, activeRun);
      if (res.success) setSummary(res.data || res.context || null);
    } catch (err) {
      console.error(err);
    } finally {
      setRunLoading(false);
    }
  }, [activeRun, taskInstanceId]);

  useEffect(() => {
    if (!activeRun) return undefined;
    const timer = setTimeout(() => { loadSummary(); }, 0);
    return () => clearTimeout(timer);
  }, [activeRun, loadSummary]);

  const manifest = summary?.manifest;
  const counts = summary?.counts || {};

  return (
    <Card size="small" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <Space>
          <Text strong>Run: {activeRun && runs?.length ? dayjs(runs.find(r => r.Id === activeRun)?.RunDate).format('DD MMM YYYY') : 'Select a run'}</Text>
          <Tag color={summary?.statusColor || 'blue'}>{summary?.status || '—'}</Tag>
        </Space>
        <Space size={8}>
          <Button icon={<ReloadOutlined />} onClick={loadSummary} loading={runLoading} disabled={!activeRun}>Refresh</Button>
          {canManage && runs.length === 0 && (
            <Button type="primary" icon={<PlayCircleOutlined />} onClick={onCreateRun} loading={loading} disabled={!activeRun}>
              Create Run
            </Button>
          )}
        </Space>
      </div>

      {runLoading && <Spin size="small" style={{ marginBottom: 12 }} />}

      {summary?.error && <Alert type="error" message={summary.error} style={{ marginBottom: 12 }} />}

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={6}><Card size="small"><Statistic title="Eligible Active ASINs" value={manifest?.eligibleActiveAsins ?? 0} /></Card></Col>
        <Col xs={24} md={6}><Card size="small"><Statistic title="RetailOps Unavailable" value={manifest?.retailOpsUnavailableCount ?? 0} valueStyle={{ color: '#cf1322' }} /></Card></Col>
        <Col xs={24} md={6}><Card size="small"><Statistic title="Missing Availability" value={manifest?.missingAvailabilityCount ?? 0} valueStyle={{ color: '#d48806' }} /></Card></Col>
        <Col xs={24} md={6}>
          <Card size="small">
            <Statistic
              title="GMS Verification"
              value={manifest?.gms?.verified ? 'Verified' : 'Unverified'}
              valueStyle={{ color: manifest?.gms?.verified ? '#3f8600' : '#d48806' }}
            />
          </Card>
        </Col>
      </Row>

      <Card size="small" title={<Space><Text strong>Run Details</Text></Space>} style={{ marginBottom: 16 }}>
        <Descriptions size="small" column={3}>
          <Descriptions.Item label="Run ID">{activeRun || '—'}</Descriptions.Item>
          <Descriptions.Item label="Status">{summary?.status || '—'}</Descriptions.Item>
          <Descriptions.Item label="Channel">{summary?.channel || '—'}</Descriptions.Item>
          <Descriptions.Item label="Last RetailOps Obs">{manifest?.lastRetailOpsObservation ? dayjs(manifest.lastRetailOpsObservation).format('DD MMM YYYY HH:mm') : '—'}</Descriptions.Item>
          <Descriptions.Item label="GMS Window">{manifest?.gms?.windowDays ?? '—'} days</Descriptions.Item>
          <Descriptions.Item label="GMS Verified">{manifest?.gms?.verified ? 'Yes' : 'No (GMS_UNVERIFIED)'}</Descriptions.Item>
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

      <Divider style={{ margin: '16px 0' }} />

      <Card size="small" title={<Space><Text strong>Case Summary</Text></Space>}>
        <Row gutter={[16, 16]}>
          <Col xs={12} md={6}><Card size="small"><Statistic title="Confirmed OOS" value={counts.CONFIRMED_CHANNEL_OOS ?? 0} valueStyle={{ color: '#cf1322' }} /></Card></Col>
          <Col xs={12} md={6}><Card size="small"><Statistic title="Discrepancies" value={counts.DISCREPANCY ?? 0} valueStyle={{ color: '#faad14' }} /></Card></Col>
          <Col xs={12} md={6}><Card size="small"><Statistic title="Insufficient Evidence" value={counts.INSUFFICIENT_EVIDENCE ?? 0} valueStyle={{ color: '#faad14' }} /></Card></Col>
          <Col xs={12} md={6}><Card size="small"><Statistic title="No Signal" value={counts.NO_CURRENT_OOS_SIGNAL ?? 0} valueStyle={{ color: '#52c41a' }} /></Card></Col>
          <Col xs={12} md={6}><Card size="small"><Statistic title="80% Group" value={counts.PRIORITY_80 ?? 0} valueStyle={{ color: '#f5222d' }} /></Card></Col>
          <Col xs={12} md={6}><Card size="small"><Statistic title="20% Group" value={counts.PRIORITY_20 ?? 0} valueStyle={{ color: '#1890ff' }} /></Card></Col>
          <Col xs={12} md={6}><Card size="small"><Statistic title="New ASINs (20%)" value={counts.NEW_ASIN_20 ?? 0} valueStyle={{ color: '#722ed1' }} /></Card></Col>
          <Col xs={12} md={6}><Card size="small"><Statistic title="GMS Unverified" value={counts.GMS_UNVERIFIED ?? 0} valueStyle={{ color: '#faad14' }} /></Card></Col>
        </Row>
      </Card>

      <Divider style={{ margin: '16px 0' }} />

      <Card size="small" title={<Space><Text strong>Available Runs</Text></Space>}>
        {runs.length === 0 ? (
          <Empty description="No runs yet. Create a run to start." />
        ) : (
          <Table
            size="small"
            rowKey="Id"
            pagination={false}
            dataSource={runs}
            columns={[
              { title: 'Run Date', dataIndex: 'RunDate', key: 'date', render: v => dayjs(v).format('DD MMM YYYY') },
              { title: 'Status', dataIndex: 'Status', key: 'status', render: v => <Tag color={v === 'CLOSED' ? 'green' : v === 'RECONCILED' ? 'blue' : 'orange'}>{v}</Tag> },
              { title: 'Policy', dataIndex: 'PolicyVersion', key: 'policy' },
              { title: 'Created', dataIndex: 'CreatedAt', key: 'created', render: v => v ? dayjs(v).format('DD MMM HH:mm') : '—' },
            ]}
            locale={{ emptyText: 'No runs' }}
          />
        )}
      </Card>
    </Card>
  );
}

export default OosOverviewTab;