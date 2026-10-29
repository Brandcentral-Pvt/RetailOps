import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Tag, Space, Button, Alert, Tabs, Typography, message } from 'antd';
//                                                          ^^^^^^^ FIX #1
import { ReloadOutlined, SyncOutlined, ExportOutlined, DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import { useAuth } from '../../../../../contexts/AuthContext';
import tasksApi from '../../../services/tasksApi';
import dayjs from 'dayjs';
import OosAffectedAsinsGrid from './OosAffectedAsinsGrid';
import OosExportPanel from './OosExportPanel';
import OosInventoryUpload from './OosInventoryUpload';

const { Text } = Typography;

function OosAffectedAsinsTab({ task, activeRun, canResync }) {
  // ── FIX #2: Declare ALL state & derived values BEFORE handlers ──
  const { hasPermission, isAdmin, isGlobalUser } = useAuth();
  const canManage = isAdmin || isGlobalUser || hasPermission('tasks_manage');

  const taskInstanceId = task?.Id;
  const runId = activeRun;

  const [exportLoading, setExportLoading] = useState(false);
  const [resyncLoading, setResyncLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [gridData, setGridData] = useState({ rows: [], total: 0, summary: null });
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    page: 1,
    pageSize: 50,
    sortBy: 'priorityGroup',
    sortOrder: 'desc',
  });
  const [error, setError] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);
  const [activeTab, setActiveTab] = useState('asins');
  const [columnConfig, setColumnConfig] = useState(null);

  const loadData = useCallback(async () => {
    if (!taskInstanceId || !activeRun) return;
    setLoading(true);
    setError(null);
    try {
      const params = { ...filters, runId };
      const res = await tasksApi.getAffectedAsins(taskInstanceId, params);
      if (res.success) {
        setGridData(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load affected ASINs');
    } finally {
      setLoading(false);
    }
  }, [activeRun, filters, taskInstanceId, runId]);

  // ── Handlers now safely reference everything above ──
  const handleDownloadExport = async () => {
    if (!taskInstanceId || !activeRun) return;
    setExportLoading(true);
    try {
      const res = await tasksApi.buildExport(taskInstanceId, activeRun);
      if (res.success) {
        const exportId = res.export?.Id || res.export?.id;
        if (exportId) {
          const res2 = await tasksApi.downloadExport(taskInstanceId, exportId);
          if (!res2.ok) throw new Error(res2.statusText);
          const blob = await res2.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `oos-export-${activeRun}.xlsx`;
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
    if (!taskInstanceId || !activeRun) return;
    setResyncLoading(true);
    try {
      const res = await tasksApi.requestResync(taskInstanceId, activeRun);
      if (res.success) {
        message.success('Resync requested');
        loadData();
      }
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
        // Load column config
        tasksApi.getColumnConfig(taskInstanceId, activeRun).then((res) => {
          if (res.success) setColumnConfig(res.columns);
        }).catch(() => {}); // Silently fail, use defaults
      } else {
        setGridData({ rows: [], total: 0, summary: null });
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [activeRun, loadData, taskInstanceId]);

  const handleSyncRetailOps = async () => {
    if (!taskInstanceId || !activeRun) return;
    setSyncLoading(true);
    try {
      const res = await tasksApi.syncRetailOpsAvailability(taskInstanceId, activeRun);
      if (res.success) {
        message.success(res.message || `RetailOps sync initiated for ${res.synced} ASINs`);
        // Refresh data after a short delay to allow scrape to start
        setTimeout(loadData, 3000);
      } else {
        message.error(res.error || 'Sync failed');
      }
    } catch (err) {
      setError(err.message || 'Sync failed');
      message.error(err.message || 'Sync failed');
    } finally {
      setSyncLoading(false);
    }
  };

  const summary = useMemo(() => gridData.summary, [gridData.summary]);

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
                      Run: {activeRun ? dayjs(activeRun).format('DD MMM YYYY') : 'Select a run'}
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

                    {/* ── FIX #3: Properly closed fragment & conditional ── */}
                    {canResync && (
                      <>
                        <Button
                          icon={<SyncOutlined />}
                          onClick={handleRequestResync}
                          loading={resyncLoading}       /* FIX #4: was reuploadLoading[item...] */
                          disabled={!activeRun}
                        >
                          Queue Resync
                        </Button>
                        <Button
                          icon={<ExportOutlined />}
                          onClick={handleExport}
                          loading={exportLoading}        /* FIX #6 */
                          disabled={!activeRun}
                        >
                          Export CSV
                        </Button>
                        <Button
                          type="primary"
                          icon={<DownloadOutlined />}
                          onClick={handleDownloadExport}
                          loading={exportLoading}        /* FIX #6 */
                          disabled={!activeRun}
                        >
                          Download XLSX
                        </Button>
                        {canResync && (
                          <Button
                            icon={<SyncOutlined />}
                            onClick={handleSyncRetailOps}
                            loading={syncLoading}
                            disabled={!activeRun}
                            tooltip="Sync RetailOps Availability"
                          >
                            Sync RetailOps
                          </Button>
                        )}
                      </>
                    )}
                  </Space>
                </div>

                {error && (
                  <Alert
                    type="error"
                    message={error}
                    closable                         /* FIX #5 */
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
          {
            key: 'inventory-upload',
            label: 'Inventory Upload',
            children: (
              <OosInventoryUpload
                taskId={taskInstanceId}
                runId={activeRun}
                onUploadComplete={loadData}
              />
            ),
          },
        ]}
      />
    </Card>
  );
}

export default OosAffectedAsinsTab;