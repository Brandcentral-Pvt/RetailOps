import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Tag, Space, Button, Alert, Tabs, Typography, message, Select } from 'antd';
import { ReloadOutlined, SyncOutlined, ExportOutlined, DownloadOutlined, FilterOutlined } from '@ant-design/icons';
import { useAuth } from '../../../../../contexts/AuthContext';
import tasksApi from '../../../services/tasksApi';
import dayjs from 'dayjs';
import OosAffectedAsinsGrid from './OosAffectedAsinsGrid';
import OosExportPanel from './OosExportPanel';

const { Text } = Typography;

function OosAffectedAsinsTab({ task, activeRun, runs, canResync }) {
  const { hasPermission, isAdmin, isGlobalUser } = useAuth();
  const canManage = isAdmin || isGlobalUser || hasPermission('tasks_manage');

  const taskInstanceId = task?.Id;
  const runId = activeRun;

  const [exportLoading, setExportLoading] = useState(false);
  const [resyncLoading, setResyncLoading] = useState(false);
  const [gridData, setGridData] = useState({ rows: [], total: 0, summary: null });
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    page: 1,
    pageSize: 50,
    sortBy: 'priorityGroup',
    sortOrder: 'desc',
    classification: '',
    priorityGroup: '',
    isNew: '',
    gmsVerification: '',
    resyncStatus: '',
    incidentStatus: '',
    search: '',
  });
  const [error, setError] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);
  const [activeTab, setActiveTab] = useState('asins');
  const [columnConfig, setColumnConfig] = useState(null);
  const [sourceIntakeOpen, setSourceIntakeOpen] = useState(true);

  // Source intake data
  const [sourceData, setSourceData] = useState(null);
  const [sourceLoading, setSourceLoading] = useState(false);

  const runDate = useMemo(() => {
    if (!activeRun || !runs?.length) return null;
    const run = runs.find(r => r.Id === activeRun);
    return run?.RunDate || null;
  }, [activeRun, runs]);

  const loadData = useCallback(async () => {
    if (!taskInstanceId || !activeRun) return;
    setLoading(true);
    setError(null);
    try {
      const params = { ...filters, runId };
      const res = await tasksApi.getAffectedAsins(taskInstanceId, activeRun, params);
      if (res.success) {
        setGridData(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load affected ASINs');
    } finally {
      setLoading(false);
    }
  }, [activeRun, filters, taskInstanceId, runId]);

  const loadSourceData = useCallback(async () => {
    if (!taskInstanceId || !activeRun) return;
    setSourceLoading(true);
    try {
      const res = await tasksApi.getAffectedAsinSummary(taskInstanceId, activeRun);
      if (res.success) {
        setSourceData(res.counts);
      }
    } catch (err) {
      console.error('Failed to load source data:', err);
    } finally {
      setSourceLoading(false);
    }
  }, [activeRun, taskInstanceId]);

  const handleDownloadExport = async () => {
    if (!taskInstanceId || !activeRun) return;
    setExportLoading(true);
    try {
      const res = await tasksApi.buildExport(taskInstanceId, activeRun);
      if (res.success) {
        const exportId = res.export?.Id || res.export?.id;
        if (exportId) {
          const blob = await tasksApi.downloadExport(taskInstanceId, exportId);
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'oos-export-' + activeRun + '.xlsx';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }
      }
    } catch (err) {
      setError(err.message || 'Export download failed');
    } finally {
      setExportLoading(false);
    }
  };

  const handleExport = async () => {
    if (!taskInstanceId || !activeRun) return;
    setExportLoading(true);
    try {
      const res = await tasksApi.buildExport(taskInstanceId, activeRun);
      if (res.success) {
        message.success('Export created successfully');
        loadData();
      }
    } catch (err) {
      setError(err.message || 'Export failed');
    } finally {
      setExportLoading(false);
    }
  };

  const handleRequestResync = async () => {
    if (!taskInstanceId || !activeRun || !selectedRows.length) return;
    setResyncLoading(true);
    try {
      // Get full row data for selected rows to extract DecisionId (caseId)
      const selectedData = gridData.rows.filter(r => selectedRows.includes(r.id));
      for (const row of selectedData) {
        const caseId = row.id || row.DecisionId;
        if (caseId) {
          await tasksApi.requestResync(taskInstanceId, activeRun, caseId, { asin: row.asinCode });
        }
      }
      message.success(`Resync requested for ${selectedData.length} ASIN(s)`);
      loadData();
    } catch (err) {
      setError(err.message || 'Resync request failed');
    } finally {
      setResyncLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeRun) {
        loadData();
        loadSourceData();
      } else {
        setGridData({ rows: [], total: 0, summary: null });
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [activeRun, loadData, loadSourceData, taskInstanceId]);

  const summary = useMemo(() => gridData.summary, [gridData.summary]);

  // Source intake section
  const renderSourceIntake = () => {
    if (!sourceIntakeOpen) return null;
    if (!sourceData || sourceLoading) {
      return (
        <div style={{ padding: 16, background: 'var(--bc-surface-subtle)', borderRadius: 8, marginBottom: 12 }}>
          <Space>
            <Text strong>Source Intake</Text>
            <Tag color="blue">Loading...</Tag>
          </Space>
        </div>
      );
    }
    return (
      <div style={{ padding: 16, background: 'var(--bc-surface-subtle)', borderRadius: 8, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <Space>
            <Text strong>Source Intake</Text>
            <Button type="text" icon={sourceIntakeOpen ? <ReloadOutlined /> : <FilterOutlined />}
              onClick={() => setSourceIntakeOpen(!sourceIntakeOpen)} size="small">
              {sourceIntakeOpen ? 'Collapse' : 'Expand'}
            </Button>
          </Space>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div style={{ padding: '12px 16px', borderRadius: 8, background: 'var(--bc-surface-card)', border: '1px solid var(--bc-border-default)' }}>
            <Text style={{ fontSize: 10, color: 'var(--bc-text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: 4 }}>RetailOps (Auto)</Text>
            <Text strong style={{ fontSize: 24, color: 'var(--bc-blue-600)' }}>System Snapshot</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>Automatically captured at run creation</Text>
          </div>
          <div style={{ padding: '12px 16px', borderRadius: 8, background: 'var(--bc-surface-card)', border: '1px solid var(--bc-border-default)' }}>
            <Text style={{ fontSize: 10, color: 'var(--bc-text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: 4 }}>BrandCentral</Text>
            <Text strong style={{ fontSize: 24, color: sourceData.BRAND_CENTRAL ? 'var(--bc-green-600)' : 'var(--bc-red-600)' }}>
              {sourceData.BRAND_CENTRAL ? 'Uploaded' : 'Required'}
            </Text>
          </div>
          <div style={{ padding: '12px 16px', borderRadius: 8, background: 'var(--bc-surface-card)', border: '1px solid var(--bc-border-default)' }}>
            <Text style={{ fontSize: 10, color: 'var(--bc-text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: 4 }}>Vendor Central</Text>
            <Text strong style={{ fontSize: 24, color: sourceData.VENDOR_CENTRAL ? 'var(--bc-green-600)' : 'var(--bc-amber-600)' }}>
              {sourceData.VENDOR_CENTRAL ? 'Uploaded' : 'Conditional'}
            </Text>
          </div>
        </div>
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--bc-border-default)' }}>
          <Text style={{ fontSize: 10, color: 'var(--bc-text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: 8 }}>Reconciliation Readiness</Text>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {sourceData.sourcesValidated && <Tag color="green">Sources Validated</Tag>}
            {sourceData.exceptionsRecorded && <Tag color="blue">Exceptions Recorded</Tag>}
            {!sourceData.sourcesValidated && !sourceData.exceptionsRecorded && <Tag color="red">Missing Sources</Tag>}
            {sourceData.blockingReasons?.length > 0 && (
              <Tag color="red">Blocking: {sourceData.blockingReasons.join(', ')}</Tag>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card size="small" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        style={{ marginBottom: 12 }}
        items={[
          {
            key: 'asins',
            label: 'Affected ASINs',
            children: (
              <>
                {renderSourceIntake()}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                    marginBottom: 12,
                  }}
                >
                  <Space>
                    <Text strong>
                      Run: {runDate ? dayjs(runDate).format('DD MMM YYYY') : 'Select a run'}
                    </Text>
                    <Tag color={summary?.statusColor || 'blue'}>{summary?.status || '—'}</Tag>
                  </Space>
                  <Space size={8}>
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={loadData}
                      loading={loading}
                      disabled={!activeRun}
                    >
                      Refresh
                    </Button>

                    {canResync && (
                      <>
                        <Button
                          icon={<SyncOutlined />}
                          onClick={handleRequestResync}
                          loading={resyncLoading}
                          disabled={!activeRun}
                        >
                          Queue Resync
                        </Button>
                        <Button
                          icon={<ExportOutlined />}
                          onClick={handleExport}
                          loading={exportLoading}
                          disabled={!activeRun}
                        >
                          Export CSV
                        </Button>
                        <Button
                          type="primary"
                          icon={<DownloadOutlined />}
                          onClick={handleDownloadExport}
                          loading={exportLoading}
                          disabled={!activeRun}
                        >
                          Download XLSX
                        </Button>
                      </>
                    )}
                  </Space>
                </div>

                {error && (
                  <Alert
                    type="error"
                    message={error}
                    closable
                    onClose={() => setError(null)}
                    style={{ marginBottom: 12 }}
                  />
                )}

                <OosAffectedAsinsGrid
                  data={gridData.rows}
                  loading={loading}
                  pagination={{
                    current: filters.page,
                    pageSize: filters.pageSize,
                    total: gridData.total,
                  }}
                  onTableChange={(pagination, tableFilters, sorter) => {
                    setFilters(prev => ({
                      ...prev,
                      page: pagination.current,
                      pageSize: pagination.pageSize,
                      sortBy: sorter.field,
                      sortOrder: sorter.order,
                    }));
                  }}
                  selectedRowKeys={selectedRows}
                  onSelectionChange={setSelectedRows}
                  canResync={canResync}
                  columnConfig={columnConfig}
                />

                <div
                  style={{
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: '1px solid var(--bc-border-default)',
                  }}
                >
                  <OosExportPanel
                    taskId={taskInstanceId}
                    runId={activeRun}
                    canManage={canManage}
                  />
                </div>
              </>
            ),
          },
          {
            key: 'export',
            label: 'Export & Submit',
            children: (
              <OosExportPanel
                taskId={taskInstanceId}
                runId={activeRun}
                canManage={canManage}
              />
            ),
          },
        ]}
      />
    </Card>
  );
}

export default OosAffectedAsinsTab;