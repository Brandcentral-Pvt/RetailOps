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

  // Ensure gridData.rows is always an array
  const gridRows = Array.isArray(gridData?.rows) ? gridData.rows : [];
  const gridTotal = Number(gridData?.total) || 0;
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
  const [sourceData, setSourceData] = useState({});
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

  const handleGridAction = async (action) => {
    const { type, ids } = action;
    if (!ids || ids.length === 0) return;

    switch (type) {
      case 'resync':
        setResyncLoading(true);
        try {
          const selectedData = gridData.rows.filter(r => ids.includes(r.id));
          for (const row of selectedData) {
            const caseId = row.id || row.DecisionId;
            if (caseId) {
              await tasksApi.requestResync(taskInstanceId, activeRun, caseId, { asin: row.asinCode });
            }
          }
          message.success(`${selectedData.length} ASIN(s) queued for resync`);
          loadData();
        } catch (err) {
          message.error(err.message || 'Failed to queue resync');
        } finally {
          setResyncLoading(false);
        }
        break;
      case 'export':
        setExportLoading(true);
        try {
          const res = await tasksApi.buildExport(taskInstanceId, activeRun);
          if (res.success) {
            message.success('Export generated');
            loadExports();
          }
        } catch (err) {
          message.error(err.message || 'Export generation failed');
        } finally {
          setExportLoading(false);
        }
        break;
      case 'download':
        setExportLoading(true);
        try {
          const res = await tasksApi.listExports(taskInstanceId, activeRun);
          if (res.success && (res.data || res.exports || []).length > 0) {
            const latestExport = (res.data || res.exports || [])[0];
            const blob = await tasksApi.downloadExport(taskInstanceId, latestExport.Id);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = latestExport.FileName || `oos-export-${latestExport.Version}.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            message.success('Download started');
          } else {
            message.warning('No exports available');
          }
        } catch (err) {
          message.error(err.message || 'Download failed');
        } finally {
          setExportLoading(false);
        }
        break;
      case 'refresh':
        loadData();
        break;
    }
  };

  const handleRequestResync = () => handleGridAction({ type: 'resync', ids: selectedRows });
  const handleExport = () => handleGridAction({ type: 'export', ids: selectedRows });
  const handleDownloadExport = () => handleGridAction({ type: 'download', ids: selectedRows });

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
                  data={gridRows}
                  loading={loading}
                  pagination={{
                    current: filters.page,
                    pageSize: filters.pageSize,
                    total: gridTotal,
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
                  onAction={handleGridAction}
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