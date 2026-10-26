import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Tabs, TabPane, Space, Button, Tag, Alert, Empty, Spin, Row, Col, Divider, Select, Input, Tooltip, Text } from 'antd';
import { UploadOutlined, SyncOutlined, ExportOutlined, DownloadOutlined, ReloadOutlined, SearchOutlined, FilterOutlined, PlusOutlined } from '@ant-design/icons';
import { useAuth } from '../../../../../contexts/AuthContext';
import tasksApi from '../../../../services/tasksApi';
import dayjs from 'dayjs';
import OosAffectedAsinsTab from './components/OosAffectedAsinsTab';
import OosSourceUploader from './components/OosSourceUploader';
import OosExportPanel from './components/OosExportPanel';
import OosFollowupsTab from './components/OosFollowupsTab';
import OosReviewTab from './components/OosReviewTab';
import OosOverviewTab from './components/OosOverviewTab';

const { TabPane: Tab } = Tabs;

function OosTaskView({ task, viewDefinition, onAction }) {
  const { hasPermission, isAdmin, isGlobalUser } = useAuth();
  const canManage = isAdmin || isGlobalUser || hasPermission('tasks_manage');
  const canResync = isAdmin || isGlobalUser || hasPermission('scraping_manage');

  const [sellers, setSellers] = useState([]);
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [runs, setRuns] = useState([]);
  const [activeRun, setActiveRun] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [error, setError] = useState(null);

  const taskInstanceId = task?.Id;

  const loadSellers = useCallback(async () => {
    try {
      const res = await tasksApi.getSellers({ assigned: true });
      if (res.success) {
        const list = res.data || res.sellers || [];
        setSellers(list);
        if (list.length && !selectedSeller) {
          setSelectedSeller(list[0].Id || list[0]._id || list[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  }, [selectedSeller]);

  const loadRuns = useCallback(async () => {
    if (!selectedSeller) return;
    setLoading(true);
    try {
      const res = await tasksApi.getOosRuns(task.Id, selectedSeller);
      if (res.success) {
        const runList = res.data || res.runs || [];
        setRuns(runList);
        if (runList.length && !activeRun) {
          setActiveRun(runList[0].Id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [task.Id, selectedSeller, activeRun]);

  const createRun = async () => {
    if (!selectedSeller) return;
    setLoading(true);
    try {
      const res = await tasksApi.createOosRun(task.Id, selectedSeller, { runDate: dayjs().format('YYYY-MM-DD') });
      if (res.success) {
        await loadRuns();
        message.success('OOS run created');
      }
    } catch (err) {
      message.error(err.message || 'Failed to create run');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSellers();
  }, [loadSellers]);

  useEffect(() => {
    if (selectedSeller) loadRuns();
  }, [selectedSeller, loadRuns]);

  const tabs = [
    { key: 'overview', label: 'Overview', component: <OosOverviewTab task={task} activeRun={activeRun} runs={runs} loading={loading} onCreateRun={createRun} canManage={canManage} /> },
    { key: 'sources', label: 'Data Sources', component: <OosSourceUploader task={task} activeRun={activeRun} canManage={canManage} onRunsChange={loadRuns} /> },
    { key: 'asins', label: 'Affected ASINs', component: <OosAffectedAsinsTab task={task} activeRun={activeRun} canResync={canResync} /> },
    { key: 'followups', label: 'Follow-ups & Export', component: <OosFollowupsTab task={task} activeRun={activeRun} canManage={canManage} /> },
    { key: 'review', label: 'Review', component: <OosReviewTab task={task} activeRun={activeRun} canManage={canManage} /> },
  ];

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
        <Text style={{ fontSize: 10, color: 'var(--bc-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Seller</Text>
        <Select
          value={selectedSeller}
          onChange={setSelectedSeller}
          style={{ width: 280 }}
          placeholder="Select seller"
          options={sellers.map(s => ({ value: s.Id || s._id || s.id, label: s.Name || s.name }))}
          disabled={loading}
          showSearch
          allowClear
        />
        <Text style={{ fontSize: 10, color: 'var(--bc-text-muted)', fontWeight: 600, textTransform: 'uppercase', marginLeft: 'auto' }}>Run</Text>
        <Select
          value={activeRun}
          onChange={setActiveRun}
          style={{ width: 200 }}
          placeholder="Select run"
          options={runs.map(r => ({ value: r.Id, label: `${dayjs(r.RunDate).format('DD MMM YYYY')} · ${r.Status}` }))}
          disabled={loading || runs.length === 0}
          allowClear
        />
        {canManage && runs.length === 0 && selectedSeller && (
          <Button type="primary" icon={<PlusOutlined />} onClick={createRun} loading={loading} disabled={!selectedSeller}>
            Create Run
          </Button>
        )}
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabs.map(t => ({ key: t.key, label: t.label }))}>
        {tabs.map(t => (
          <TabPane tab={t.label} key={t.key} forceRender>
            {t.component}
          </TabPane>
        ))}
      </Tabs>
    </div>
  );
}

export default OosTaskView;