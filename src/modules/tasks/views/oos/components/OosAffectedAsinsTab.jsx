import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Table, Tag, Space, Button, Alert, Empty, Spin, Row, Col, Descriptions, Tooltip, Tabs, TabPane, Typography } from 'antd';
import { ReloadOutlined, PlayCircleOutlined, SyncOutlined, WarningOutlined, ExportOutlined, DownloadOutlined, CloudUploadOutlined } from '@ant-design/icons';
import { useAuth } from '../../../../../../contexts/AuthContext';
import tasksApi from '../../../../../../services/tasksApi';
import dayjs from 'dayjs';
import OosAffectedAsinsGrid from './OosAffectedAsinsGrid';
import OosExportPanel from './OosExportPanel';
import OosSourceUploader from './OosSourceUploader';

const { Text } = Typography;
const { TabPane: Tab } = Tabs;

function OosAffectedAsinsTab({ task, activeRun, canResync }) {
  const { hasPermission, isAdmin, isGlobalUser } = useAuth();
  const canManage = isAdmin || isGlobalUser || true;
  const [gridData, setGridData] = useState({ rows: [], total: 0, summary: null });
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ page: 1, pageSize: 50, sortBy: 'priorityGroup', sortOrder: 'desc' });
  const [error, setError] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);

  const taskInstanceId = task?.Id;
  const runId = activeRun;

  const loadData = useCallback(async () => {
    if (!activeRun) return;
    setLoading(true);
    setError(null);
    try {
      const params = {
        ...filters,
        runId,
        taskInstanceId: task.Id,
      };
      const res = await tasksApi.getAffectedAsins(task.Id, params);
      if (res.success) {
        setGridData(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load affected ASINs');
    } finally {
      setLoading(false);
    }
  }, [activeRun, filters, task.Id]);

  useEffect(() => {
    if (activeRun) loadData();
    else setGridData({ rows: [], total: 0, summary: null });
  }, [activeRun, loadData]);

  const summary = useMemo(() => gridData.summary, [gridData.summary]);

  return (
    <Card size="small" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
        { key: 'sources', label: 'Data Sources' },
        { key: 'asins', label: 'Affected ASINs' },
        { key: 'export', label: 'Export & Submit' },
      ]} style={{ marginBottom: 12 }}>
        <TabPane tab="Data Sources" key="sources" forceRender>
          <OosSourceUploader
            task={task}
            activeRun={activeRun}
            canManage={canManage}
            onRunsChange={loadData}
          />
        </TabPane>
        <TabPane tab="Affected ASINs" key="asins" forceRender>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <Space>
              <Text strong>Run: {activeRun ? dayjs(activeRun).format('DD MMM YYYY') : 'Select a run'}</Text>
              <Tag color={summary?.statusColor || 'blue'}>{summary?.status || '—'}</Tag>
            </Space>
            <Space size={8}>
              <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading} disabled={!activeRun}>Refresh</Button>
              {canResync && <Button icon={<SyncOutlined />} onClick={() => setError('Resync not yet implemented')}>Queue Resync</Button>}
              <Button icon={<ExportOutlined />} onClick={() => setError('Export not yet implemented')}>Export CSV</Button>
              <Button type="primary" icon={<DownloadOutlined />} onClick={() => setError('Export not yet implemented')}>Download XLSX</Button>
            </Space>
          </div>

          {error && <Alert type="error" message={error} onClose={() => setError(null)} style={{ marginBottom: 12 }} />}

          <OosAffectedAsinsGrid
            data={gridData.rows}
            loading={loading}
            pagination={{ current: filters.page, pageSize: filters.pageSize, total: gridData.total }}
            onTableChange={(pagination, filters, sorter) => {
              setFilters(prev => ({ ...prev, page: pagination.current, pageSize: pagination.pageSize, sortBy: sorter.field, sortOrder: sorter.order }));
            }}
            selectedRowKeys={selectedRows}
            onSelectionChange={setSelectedRows}
            canResync={canResync}
          />

          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--bc-border-default)' }}>
            <OosExportPanel taskId={task?.Id} runId={activeRun} canManage={true} />
          </div>
        </TabPane>
        <TabPane tab="Export & Submit" key="export" forceRender>
          <OosExportPanel taskId={task?.Id} runId={activeRun} canManage={true} />
        </TabPane>
      </Tabs>
    </Card>
  );
}

export default OosAffectedAsinsTab;