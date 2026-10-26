import React, { useMemo } from 'react';
import { Table, Tag, Space, Button, Tooltip, Popconfirm, Popover, Divider, Typography } from 'antd';
import { SyncOutlined, EyeOutlined, ExclamationCircleOutlined, PlayCircleOutlined, WarningOutlined, CheckCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text } = Typography;

const PRIORITY_COLORS = {
  '80%': 'red',
  '20%': 'blue',
  'GMS_UNVERIFIED': 'orange',
  'PRIORITY_PENDING': 'orange',
};

const CLASSIFICATION_COLORS = {
  CONFIRMED_CHANNEL_OOS: 'red',
  DISCREPANCY: 'orange',
  INSUFFICIENT_EVIDENCE: 'gold',
  NO_CURRENT_OOS_SIGNAL: 'green',
  RESYNC_VERIFIED: 'green',
  RESYNC_CANDIDATE: 'blue',
};

const RESYNC_STATUS_COLORS = {
  QUEUED: 'blue',
  RUNNING: 'blue',
  VERIFIED_RECOVERED: 'green',
  OPEN_DISCREPANCY: 'orange',
  FAILED: 'red',
  BLOCKED: 'red',
};

const INCIDENT_STATUS_COLORS = {
  OPEN: 'red',
  RESOLVED: 'green',
  WAIVED: 'gold',
};

function PriorityTag({ group, isNew, firstSeen, gmsVerified }) {
  if (isNew) {
    return (
      <Space size={4}>
        <Tag color="purple">New ASIN</Tag>
        <Tag color={PRIORITY_COLORS['20%'] || 'blue'}>20%</Tag>
        {firstSeen && <Tooltip title={`First seen: ${dayjs(firstSeen).format('DD MMM YYYY')}`}><Tag color="purple">NEW_ASIN_TO_20</Tag></Tooltip>}
      </Space>
    );
  }
  if (!gmsVerified) {
    return <Tag color={PRIORITY_COLORS['GMS_UNVERIFIED'] || 'orange'}>Priority Pending / GMS Unverified</Tag>;
  }
  const color = PRIORITY_COLORS['80%'] || 'red';
  return <Tag color={color}>{80%}</Tag>;
}

function ClassificationTag({ classification, ruleId, confidence }) {
  const color = CLASSIFICATION_COLORS[classification] || 'default';
  return (
    <Tooltip title={`Rule: ${ruleId || '—'} · Confidence: ${confidence != null ? confidence + '%' : '—'}`}>
      <Tag color={color}>{classification}</Tag>
    </Tooltip>
  );
}

function ResyncStatusTag({ status, jobId, requestedAt, observationTime }) {
  const color = RESYNC_STATUS_COLORS[status] || 'default';
  return (
    <Tooltip title={[
      <div key="1">Job ID: {jobId || '—'}</div>,
      <div key="2">Requested: {requestedAt ? dayjs(requestedAt).format('DD MMM HH:mm') : '—'}</div>,
      <div key="3">Observed: {observationTime ? dayjs(observationTime).format('DD MMM HH:mm') : '—'}</div>,
    ]}>
      <Tag color={color}>{status}</Tag>
    </Tooltip>
  );
}

function IncidentTag({ status, owner, communicationStatus, followUpDate }) {
  const color = INCIDENT_STATUS_COLORS[status] || 'default';
  return (
    <Tooltip title={[
      <div key="1">Owner: {owner || '—'}</div>,
      <div key="2">Communication: {communicationStatus || '—'}</div>,
      <div key="3">Follow-up: {followUpDate ? dayjs(followUpDate).format('DD MMM YYYY') : '—'}</div>,
    ]}>
      <Tag color={color}>{status}</Tag>
    </Tooltip>
  );
}

function SourceQuantityCell({ quantity, rawStatus, sourceTimestamp, label }) {
  if (quantity === null && !rawStatus) {
    return <Text type="secondary">Unknown</Text>;
  }
  return (
    <Space size={4} direction="vertical" style={{ width: '100%' }}>
      <Text strong>{quantity !== null ? quantity : '—'}</Text>
      <Text type="secondary" style={{ fontSize: 10 }}>{rawStatus || (sourceTimestamp ? `at ${dayjs(sourceTimestamp).format('DD MMM HH:mm')}` : '—')}</Text>
    </Space>
  );
}

const columns = [
  {
    title: 'Seller',
    dataIndex: 'sellerName',
    key: 'sellerName',
    width: 150,
    fixed: 'left',
    render: (v, r) => (
      <Space size={4} direction="vertical">
        <Text strong>{r.sellerName}</Text>
        <Text code style={{ fontSize: 10, color: 'var(--bc-text-muted)' }}>{r.sellerId}</Text>
      </Space>
    ),
  },
  {
    title: 'Channel',
    dataIndex: 'channel',
    key: 'channel',
    width: 110,
    fixed: 'left',
    render: (v) => <Tag size="small">{v}</Tag>,
  },
  {
    title: 'ASIN',
    dataIndex: 'asinCode',
    key: 'asinCode',
    width: 140,
    fixed: 'left',
    render: (v, r) => (
      <Space size={4} direction="vertical">
        <Text code style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--bc-font-mono)' }}>{v}</Text>
        <Text style={{ fontSize: 10, color: 'var(--bc-text-muted)' }}>{r.sku || '—'}</Text>
      </Space>
    ),
  },
  {
    title: 'Title',
    dataIndex: 'productTitle',
    key: 'productTitle',
    width: 200,
    ellipsis: true,
  },
  {
    title: 'RetailOps',
    key: 'retailOps',
    width: 180,
    render: (_, r) => (
      <Space size={4} direction="vertical" style={{ width: '100%' }}>
        <Tag color={r.retailOpsState === 'OOS' || r.retailOpsState === 'OOS_ZERO' ? 'red' : r.retailOpsState === 'IN_STOCK' ? 'green' : r.retailOpsState === 'LOW_STOCK' ? 'gold' : 'default'}>
          {r.retailOpsState}
        </Tag>
        <SourceQuantityCell
          quantity={r.retailOpsQuantity}
          rawStatus={r.retailOpsRawStatus}
          sourceTimestamp={r.retailOpsObservedAt}
        />
        <Text type="secondary" style={{ fontSize: 10 }}>
          {r.retailOpsObservedAt ? dayjs(r.retailOpsObservedAt).format('DD MMM HH:mm') : '—'}
          {r.retailOpsFreshness != null && <Text> · {r.retailOpsFreshness}h old</Text>}
        </Text>
      </Space>
    ),
  },
  {
    title: 'BrandCentral',
    key: 'brandCentral',
    width: 150,
    render: (_, r) => (
      <Space size={4} direction="vertical" style={{ width: '100%' }}>
        <Tag color={r.brandCentralState === 'OOS_ZERO' ? 'red' : r.brandCentralState === 'IN_STOCK' ? 'green' : r.brandCentralState === 'LOW_STOCK' ? 'gold' : r.brandCentralState === 'N/A' ? 'default' : 'default'}>
          {r.brandCentralState}
        </Tag>
        <SourceQuantityCell
          quantity={r.brandCentralQuantity}
          rawStatus={r.brandCentralRawStatus}
          sourceTimestamp={r.brandCentralObservedAt}
        />
      </Space>
    ),
  },
  {
    title: 'Vendor Central',
    key: 'vendorCentral',
    width: 150,
    render: (_, r) => {
      if (r.vendorApplicable === false) {
        return <Tag color="default">N/A</Tag>;
      }
      return (
        <Space size={4} direction="vertical" style={{ width: '100%' }}>
          <Tag color={r.vendorCentralState === 'OOS_ZERO' ? 'red' : r.vendorCentralState === 'IN_STOCK' ? 'green' : r.vendorCentralState === 'LOW_STOCK' ? 'gold' : 'default'}>
            {r.vendorCentralState}
          </Tag>
          <SourceQuantityCell
            quantity={r.vendorCentralQuantity}
            rawStatus={r.vendorCentralRawStatus}
            sourceTimestamp={r.vendorCentralObservedAt}
          />
        </Space>
      );
    },
  },
  {
    title: 'GMS / Pareto',
    key: 'gms',
    width: 200,
    render: (_, r) => (
      <Space size={4} direction="vertical" style={{ width: '100%' }}>
        <Space>
          <Text strong>{r.gms !== null ? r.gms.toLocaleString() : 'Unverified'}</Text>
          <Tag color={r.gmsVerified ? 'green' : 'orange'}>
            {r.gmsVerified ? 'Verified' : 'Unverified'}
          </Tag>
        </Space>
        <Space>
          <Text type="secondary" style={{ fontSize: 10 }}>
            Share: {r.gmsSharePct != null ? r.gmsSharePct.toFixed(2) + '%' : '—'}
          </Text>
          <Text type="secondary" style={{ fontSize: 10 }}>
            Cumul: {r.cumulativePct != null ? r.cumulativePct.toFixed(2) + '%' : '—'}
          </Text>
        </Space>
        <PriorityTag
          group={r.priorityGroup}
          isNew={r.isNewAsin}
          firstSeen={r.firstSeenAt}
          gmsVerified={r.gmsVerified}
        />
      </Space>
    ),
  },
  {
    title: 'Classification',
    key: 'classification',
    width: 180,
    render: (_, r) => (
      <Space size={4} direction="vertical" style={{ width: '100%' }}>
        <ClassificationTag
          classification={r.classification}
          ruleId={r.ruleId}
          confidence={r.confidence}
        />
        <Text type="secondary" style={{ fontSize: 10 }}>
          Rev: {r.revision || 1}
        </Text>
        {r.exceptionReason && (
          <Tooltip title={r.exceptionReason}>
            <Tag color="orange">Exception</Tag>
          </Tooltip>
        )}
      </Space>
    ),
  },
  {
    title: 'Resync',
    key: 'resync',
    width: 180,
    render: (_, r) => (
      <Space size={4} direction="vertical" style={{ width: '100%' }}>
        <ResyncStatusTag
          status={r.resyncStatus}
          jobId={r.resyncJobId}
          requestedAt={r.resyncRequestedAt}
          observationTime={r.resyncObservedAt}
        />
        {r.resyncEligible && r.resyncStatus === 'NONE' && (
          <Button size="small" type="primary" icon={<PlayCircleOutlined />} style={{ width: '100%' }}>
            Queue Resync
          </Button>
        )}
        {r.resyncStatus === 'QUEUED' && <Tag color="blue">Queued</Tag>}
        {r.resyncStatus === 'RUNNING' && <Tag color="blue">Running</Tag>}
      </Space>
    ),
  },
  {
    title: 'Incident',
    key: 'incident',
    width: 200,
    render: (_, r) => (
      <Space size={4} direction="vertical" style={{ width: '100%' }}>
        <IncidentTag
          status={r.incidentStatus}
          owner={r.incidentOwner}
          communicationStatus={r.communicationStatus}
          followUpDate={r.followUpDate}
        />
        <Space size={4}>
          <Text type="secondary" style={{ fontSize: 10 }}>
            Owner: {r.incidentOwner || '—'}
          </Text>
          <Text type="secondary" style={{ fontSize: 10 }}>
            {r.followUpDate ? dayjs(r.followUpDate).format('DD MMM') : '—'}
          </Text>
        </Space>
      </Space>
    ),
  },
];

export default function OosAffectedAsinsGrid({
  data = [],
  loading = false,
  pagination = { current: 1, pageSize: 50, total: 0 },
  onTableChange,
  selectedRowKeys = [],
  onSelectionChange,
  canResync = false,
}) {
  return (
    <Table
      columns={columns}
      dataSource={data}
      rowKey="id"
      loading={loading}
      pagination={pagination}
      onChange={onTableChange}
      selectedRowKeys={selectedRowKeys}
      onSelectionChange={onSelectionChange}
      rowSelection={{
        columnWidth: 40,
        selectedRowKeys,
        onChange: onSelectionChange,
      }}
      size="small"
      bordered
      scroll={{ x: 1600, y: 500 }}
      locale={{
        emptyText: 'No affected ASINs for this run',
        filterTitle: 'Filter',
        filterConfirm: 'OK',
        filterReset: 'Reset',
        filterEmptyText: 'No matches',
        filterCheckall: 'Select all items',
        filterSearchPlaceholder: 'Search in column',
        selectionAll: 'Select all',
        selectionInvert: 'Invert selection',
        selectionNone: 'Clear all',
        selectAll: 'Select all',
        sortTitle: 'Sort',
        expand: 'Expand row',
        collapse: 'Collapse row',
        triggerDesc: 'Click to sort descending',
        triggerAsc: 'Click to sort ascending',
        cancelSort: 'Cancel sorting',
      }}
    />
  );
}

export default OosAffectedAsinsGrid;