import React, { useState, useMemo } from 'react';
import { Table, Tag, Space, Button, Typography, Flex, Divider, Radio } from 'antd';
import { PlayCircleOutlined, ReloadOutlined, ExportOutlined, DownloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

const { Text } = Typography;

const PRIORITY_COLORS = {
  '80%': 'red',
  '20%': 'blue',
  'GMS_UNVERIFIED': 'orange',
  'PRIORITY_PENDING': 'gold',
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

function SourceQuantityCell({ quantity, rawStatus, sourceTimestamp }) {
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

function PriorityTag({ group, isNew, firstSeen }) {
  const priorityGroup = ['80%', '20%', 'GMS_UNVERIFIED'].includes(group)
    ? group
    : 'PRIORITY_PENDING';
  const priority = (
    <Tag color={PRIORITY_COLORS[priorityGroup]}>
      {priorityGroup}
    </Tag>
  );

  if (!isNew) return priority;

  return (
    <Space size={4}>
      <Tag color="purple">New ASIN</Tag>
      {priority}
      {firstSeen && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Tag color="purple">NEW_ASIN_TO_20</Tag>
          </TooltipTrigger>
          <TooltipContent>
            <p>First seen: {dayjs(firstSeen).format('DD MMM YYYY')}</p>
          </TooltipContent>
        </Tooltip>
      )}
    </Space>
  );
}

function ClassificationTag({ classification, ruleId, confidence }) {
  const color = CLASSIFICATION_COLORS[classification] || 'default';
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Tag color={color}>{classification}</Tag>
      </TooltipTrigger>
      <TooltipContent>
        <p>Rule: {ruleId || '—'} · Confidence: {confidence != null ? confidence + '%' : '—'}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function ResyncStatusTag({ status, jobId, requestedAt, observationTime }) {
  const color = RESYNC_STATUS_COLORS[status] || 'default';
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Tag color={color}>{status}</Tag>
      </TooltipTrigger>
      <TooltipContent>
        <div>Job ID: {jobId || '—'}</div>
        <div>Requested: {requestedAt ? dayjs(requestedAt).format('DD MMM HH:mm') : '—'}</div>
        <div>Observed: {observationTime ? dayjs(observationTime).format('DD MMM HH:mm') : '—'}</div>
      </TooltipContent>
    </Tooltip>
  );
}

function IncidentTag({ status, owner, communicationStatus, followUpDate }) {
  const color = INCIDENT_STATUS_COLORS[status] || 'default';
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Tag color={color}>{status}</Tag>
      </TooltipTrigger>
      <TooltipContent>
        <div>Owner: {owner || '—'}</div>
        <div>Communication: {communicationStatus || '—'}</div>
        <div>Follow-up: {followUpDate ? dayjs(followUpDate).format('DD MMM YYYY') : '—'}</div>
      </TooltipContent>
    </Tooltip>
  );
}

function buildColumns(canResync) {
  return [
    {
      title: 'ASIN',
      dataIndex: 'asinCode',
      key: 'asinCode',
      width: 140,
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
      width: 250,
      ellipsis: true,
    },
    {
      title: 'Classification',
      dataIndex: 'classification',
      key: 'classification',
      width: 160,
      render: (v, r) => (
        <Space size={4} direction="vertical" style={{ width: '100%' }}>
          <ClassificationTag classification={v} ruleId={r.ruleId} confidence={r.confidence} />
          <Text type="secondary" style={{ fontSize: 10 }}>Rev: {r.revision || 1}</Text>
        </Space>
      ),
    },
    {
      title: 'Priority',
      dataIndex: 'priorityGroup',
      key: 'priorityGroup',
      width: 140,
      render: (v, r) => (
        <PriorityTag group={v} isNew={r.isNewAsin} firstSeen={r.firstSeenAt} />
      ),
    },
    {
      title: 'GMS / Pareto',
      dataIndex: 'gms',
      key: 'gms',
      width: 160,
      render: (v, r) => (
        <Space size={4} direction="vertical" style={{ width: '100%' }}>
          <Space>
            <Text strong>{v != null ? v.toLocaleString() : 'Unverified'}</Text>
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
        </Space>
      ),
    },
    {
      title: 'RetailOps',
      dataIndex: 'retailOpsState',
      key: 'retailOps',
      width: 160,
      render: (_, r) => (
        <Space size={4} direction="vertical" style={{ width: '100%' }}>
          <Tag color={r.retailOpsState === 'OOS' || r.retailOpsState === 'OOS_ZERO' ? 'red' : r.retailOpsState === 'IN_STOCK' ? 'green' : r.retailOpsState === 'LOW_STOCK' ? 'gold' : 'default'}>
            {r.retailOpsState}
          </Tag>
          <Space size={4} direction="vertical" style={{ width: '100%' }}>
            <Text strong>{r.retailOpsQuantity !== null ? r.retailOpsQuantity : '—'}</Text>
            <Text type="secondary" style={{ fontSize: 10 }}>
              {r.retailOpsObservedAt ? dayjs(r.retailOpsObservedAt).format('DD MMM HH:mm') : '—'}
            </Text>
          </Space>
        </Space>
      ),
    },
    {
      title: 'BrandCentral',
      dataIndex: 'brandCentralState',
      key: 'brandCentral',
      width: 140,
      render: (_, r) => (
        <Space size={4} direction="vertical" style={{ width: '100%' }}>
          <Tag color={r.brandCentralState === 'OOS_ZERO' ? 'red' : r.brandCentralState === 'IN_STOCK' ? 'green' : r.brandCentralState === 'LOW_STOCK' ? 'gold' : 'default'}>
            {r.brandCentralState}
          </Tag>
          <Space size={4} direction="vertical" style={{ width: '100%' }}>
            <Text strong>{r.brandCentralQuantity !== null ? r.brandCentralQuantity : '—'}</Text>
            <Text type="secondary" style={{ fontSize: 10 }}>
              {r.brandCentralObservedAt ? dayjs(r.brandCentralObservedAt).format('DD MMM HH:mm') : '—'}
            </Text>
          </Space>
        </Space>
      ),
    },
    {
      title: 'Vendor Central',
      dataIndex: 'vendorCentralState',
      key: 'vendorCentral',
      width: 140,
      render: (_, r) => {
        if (r.vendorApplicable === false) {
          return <Tag color="default">N/A</Tag>;
        }
        return (
          <Space size={4} direction="vertical" style={{ width: '100%' }}>
            <Tag color={r.vendorCentralState === 'OOS_ZERO' ? 'red' : r.vendorCentralState === 'IN_STOCK' ? 'green' : r.vendorCentralState === 'LOW_STOCK' ? 'gold' : 'default'}>
              {r.vendorCentralState}
            </Tag>
            <Space size={4} direction="vertical" style={{ width: '100%' }}>
              <Text strong>{r.vendorCentralQuantity !== null ? r.vendorCentralQuantity : '—'}</Text>
              <Text type="secondary" style={{ fontSize: 10 }}>
                {r.vendorCentralObservedAt ? dayjs(r.vendorCentralObservedAt).format('DD MMM HH:mm') : '—'}
              </Text>
            </Space>
          </Space>
        );
      },
    },
    {
      title: 'Resync',
      dataIndex: 'resyncStatus',
      key: 'resync',
      width: 160,
      render: (v, r) => (
        <Space size={4} direction="vertical" style={{ width: '100%' }}>
          <ResyncStatusTag
            status={v}
            jobId={r.resyncJobId}
            requestedAt={r.resyncRequestedAt}
            observationTime={r.resyncObservedAt}
          />
        </Space>
      ),
    },
    {
      title: 'Incident',
      dataIndex: 'incidentStatus',
      key: 'incident',
      width: 180,
      render: (_, r) => (
        <Space size={4} direction="vertical" style={{ width: '100%' }}>
          <IncidentTag
            status={r.incidentStatus}
            owner={r.incidentOwner}
            communicationStatus={r.communicationStatus}
            followUpDate={r.followUpDate}
          />
        </Space>
      ),
    },
  ];
}

export default function OosAffectedAsinsGrid({
  data = [],
  loading = false,
  pagination = { current: 1, pageSize: 50, total: 0 },
  onTableChange,
  selectedRowKeys = [],
  onSelectionChange,
  canResync,
  columnConfig = null,
  onAction,
  selectionType = 'checkbox',
}) {
  const columns = useMemo(() => buildColumns(canResync), [canResync]);
  const [actionLoading, setActionLoading] = useState(false);
  const [localSelectionType, setLocalSelectionType] = useState(selectionType);
  const hasSelection = selectedRowKeys.length > 0;

  const handleAction = async (actionType) => {
    if (!hasSelection) return;
    if (!onAction) return;

    setActionLoading(true);
    try {
      await onAction({ type: actionType, ids: selectedRowKeys });
    } finally {
      setActionLoading(false);
    }
  };

  const rowSelection = {
    type: localSelectionType,
    selectedRowKeys,
    onChange: onSelectionChange,
    columnWidth: 44,
  };

  return (
    <Flex vertical gap="small" style={{ width: '100%' }}>
      <Flex align="center" justify="space-between" gap="small" wrap>
        <Flex gap="small" align="center">
          {hasSelection && (
            <Text strong>
              {selectedRowKeys.length} item{selectedRowKeys.length !== 1 ? 's' : ''} selected
            </Text>
          )}
        </Flex>
        <Flex gap="small" align="center">
          <Radio.Group value={localSelectionType} onChange={(e) => setLocalSelectionType(e.target.value)} style={{ marginRight: 8 }}>
            <Radio value="checkbox">Checkbox</Radio>
            <Radio value="radio">Radio</Radio>
          </Radio.Group>
          <Divider type="vertical" />
          {hasSelection && (
            <Flex gap="small">
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={() => handleAction('resync')}
                disabled={!hasSelection || actionLoading}
                loading={actionLoading}
                size="small"
              >
                Queue Resync
              </Button>
              <Button
                icon={<ExportOutlined />}
                onClick={() => handleAction('export')}
                disabled={!hasSelection || actionLoading}
                loading={actionLoading}
                size="small"
              >
                Export
              </Button>
              <Button
                icon={<DownloadOutlined />}
                onClick={() => handleAction('download')}
                disabled={!hasSelection || actionLoading}
                loading={actionLoading}
                size="small"
              >
                Download
              </Button>
            </Flex>
          )}
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={() => onAction?.({ type: 'refresh' })}
            loading={loading}
            size="small"
          >
            Reload
          </Button>
        </Flex>
      </Flex>

      <Divider />

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        rowSelection={rowSelection}
        loading={loading}
        pagination={pagination}
        onChange={onTableChange}
        size="small"
        bordered
        scroll={{ x: 'max-content', y: 500 }}
        locale={{
          emptyText: 'No affected ASINs for this run',
          filterTitle: 'Filter',
          filterConfirm: 'OK',
          filterReset: 'Reset',
          filterEmptyText: 'No matches',
          filterCheckall: 'Select all items',
          filterInvert: 'Invert selection',
          filterNone: 'Clear all',
          selectAll: 'Select all',
          sortTitle: 'Sort',
          expand: 'Expand row',
          collapse: 'Collapse row',
          triggerDesc: 'Click to sort descending',
          triggerAsc: 'Click to sort ascending',
          cancelSort: 'Cancel sorting',
        }}
      />
    </Flex>
  );
}