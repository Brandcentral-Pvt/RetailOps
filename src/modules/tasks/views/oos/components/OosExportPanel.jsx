import React, { useState, useCallback } from 'react';
import { Card, Button, Space, Tag, Alert, Divider, List, Badge, Tooltip, Modal, Form, Input, Select, Checkbox } from 'antd';
import { ExportOutlined, DownloadOutlined, FileExcelOutlined, ReloadOutlined, WarningOutlined, InfoCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useAuth } from '../../../../../../contexts/AuthContext';
import tasksApi from '../../../../../../services/tasksApi';
import dayjs from 'dayjs';

function OosExportPanel({ taskId, runId, canManage }) {
  const { hasPermission, isAdmin, isGlobalUser } = useAuth();
  const [exports, setExports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [scope, setScope] = useState('ALL_AUTHORIZED');

  const loadExports = useCallback(async () => {
    if (!runId) return;
    try {
      const res = await tasksApi.listExports(taskId);
      if (res.success) setExports(res.data || res.exports || []);
    } catch (err) { console.error(err); }
  }, [taskId, runId]);

  useEffect(() => { if (runId) loadExports(); }, [runId, loadExports]);

  const handleGenerate = async () => {
    if (!runId || !canManage) return;
    setGenerating(true);
    try {
      const res = await tasksApi.buildExport(taskId, { scope });
      if (res.success) {
        message.success('Export generated');
        loadExports();
      }
    } catch (err) {
      message.error(err.message || 'Export generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (exportId, fileName) => {
    try {
      const blob = await tasksApi.downloadExport(taskId, exportId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      message.error(err.message || 'Download failed');
    }
  };

  const openModal = () => {
    form.resetFields();
    setScope('ALL_AUTHORIZED');
    setModalOpen(true);
  };

  return (
    <Card size="small" title={<Space><FileExcelOutlined /><Text strong>Export Panel</Text></Space>} style={{ width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <Space>
          <Button type="primary" icon={<FileExcelOutlined />} onClick={openModal} loading={generating} disabled={!canManage || !activeRun}>
            Generate 4-Sheet XLSX
          </Button>
          {exports.length > 0 && (
            <Button icon={<DownloadOutlined />} onClick={() => handleDownload(exports[0].Id, exports[0].FileName || `oos-export-${exports[0].Version}.xlsx`)}>Download Latest</Button>
          )}
        </Space>
      </div>

      <Divider style={{ margin: '8px 0' }} />

      {exports.length === 0 ? (
        <Alert message="No exports yet" description="Generate your first 4-sheet XLSX workbook" type="info" showIcon />
      ) : (
        <List
          itemLayout="horizontal"
          dataSource={exports}
          renderItem={item => (
            <List.Item
              actions={[
                <Tooltip key="download" title="Download">
                  <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(item.Id, item.FileName || `oos-${item.RunId}-v${item.Version}.xlsx`)}>Download</Button>
                </Tooltip>,
                <Tooltip key="details" title="View details">
                  <Button size="small" onClick={() => setError('Details not implemented')}>Details</Button>
                </Tooltip>,
              ]
            >
              <List.Item.Meta
                title={<Space>
                  <Text strong>v{item.Version}</Text>
                  <Tag color={item.Status === 'COMPLETED' ? 'green' : 'blue'}>{item.Status}</Tag>
                  <Tag color="blue">{item.SheetCount || 4} sheets</Tag>
                </Space>}
                description={<Space direction="vertical" size={2} style={{ width: '100%' }}>
                  <Space size={8}>
                    <Text type="secondary" style={{ fontSize: 11 }}>Generated: {dayjs(item.CreatedAt).format('DD MMM YYYY HH:mm')}</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>By: {item.CreatedBy || '—'}</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>Hash: {item.FileHash?.slice(0, 16)}…</Text>
                    <Text type="secondary" style={{ fontSize: 10 }}>
                      Scope: {item.Scope || 'ALL_AUTHORIZED'}
                    </Text>
                  </Space>
                />}
              />
            </List.Item>
          )}
        />
      )}
    </Card>
  );
}

export default OosExportPanel;