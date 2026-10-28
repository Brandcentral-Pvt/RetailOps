import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Tag, Space, Button, Alert, Tabs, Typography } from 'antd';
import { ReloadOutlined, SyncOutlined, ExportOutlined, DownloadOutlined } from '@ant-design/icons';
import { useAuth } from '../../../../../contexts/AuthContext';
import tasksApi from '../../../services/tasksApi';
import dayjs from 'dayjs';
import OosAffectedAsinsGrid from './OosAffectedAsinsGrid';
import OosExportPanel from './OosExportPanel';

const { Text } = Typography;

function OosAffectedAsinsTab({ task, activeRun, canResync }) {
  const [exportLoading, setExportLoading] = useState(false);
  const [resyncLoading, setResyncLoading] = useState(false);

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
  const { hasPermission, isAdmin, isGlobalUser } = useAuth();
  const canManage = isAdmin || isGlobalUser || hasPermission('tasks_manage');
  const [gridData, setGridData] = useState({ rows: [], total: 0, summary: null });
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ page: 1, pageSize: 50, sortBy: 'priorityGroup', sortOrder: 'desc' });
  const [error, setError] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);
  const [activeTab, setActiveTab] = useState('asins');

  const taskInstanceId = task?.Id;
  const runId = activeRun;

  const loadData = useCallback(async () => {
    if (!taskInstanceId || !activeRun) return;
    setLoading(true);
    setError(null);
    try {
      const params = {
        ...filters,
        runId,
      };
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

  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeRun) loadData();
      else setGridData({ rows: [], total: 0, summary: null });
    }, 0);
    return () => clearTimeout(timer);
  }, [activeRun, loadData]);

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
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                  <Space>
                    <Text strong>Run: {activeRun ? dayjs(activeRun).format('DD MMM YYYY') : 'Select a run'}</Text>
                    <Tag color={summary?.statusColor || 'blue'}>{summary?.status || '—'}</Tag>
                  </Space>
                  <Space size={8}>
                    <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading} disabled={!activeRun}>Refresh</Button>
                    {canResync && (
                    <>
                      <Button icon={<SyncOutlined />} onClick={() => handleRequestResync()} disabled={reuploadLoading[item.Id || item.id]}>Queue Resync</Button>
                    <Button icon={<ExportOutlined />} onClick={() => handleExport()} disabled={!activeRun}>Export CSV</Button>
                    <Button type="primary" icon={<DownloadOutlined />} onClick={() => handleDownloadExport()} disabled={!activeRun}>Download XLSX</Button>
                  </Space>
                </div>

                {error && <Alert type="error" message={error} onClose={() => setError(null)} style={{ marginBottom: 12 }} />}

                <OosAffectedAsinsGrid
                  data={gridData.rows}
                  loading={loading}
                  pagination={{ current: filters.page, pageSize: filters.pageSize, total: gridData.total }}
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
                />

                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--bc-border-default)' }}>
                  <OosExportPanel taskId={taskInstanceId} runId={activeRun} canManage={canManage} />
                </div>
              </>
            ),
          },
          {
            key: 'export',
            label: 'Export & Submit',
            children: <OosExportPanel taskId={taskInstanceId} runId={activeRun} canManage={canManage} />,
          },
        ]}
      />
    </Card>
  );
}

export default OosAffectedAsinsTab;