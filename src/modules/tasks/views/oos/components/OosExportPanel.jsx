import React, { useState, useEffect, useCallback } from 'react';
import { App, Card, Button, Space, Tag, Alert, Divider, List, Tooltip, Typography } from 'antd';
import { DownloadOutlined, FileExcelOutlined } from '@ant-design/icons';
import tasksApi from '../../../services/tasksApi';
import dayjs from 'dayjs';

const { Text } = Typography;

function OosExportPanel({ taskId, runId, canManage }) {
  const { message } = App.useApp();
  const [exports, setExports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const loadExports = useCallback(async () => {
    if (!taskId || !runId) return;
    setLoading(true);
    try {
      const res = await tasksApi.listExports(taskId);
      if (res.success) setExports(res.data || res.exports || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [taskId, runId]);

  useEffect(() => {
    if (!runId) return undefined;
    const timer = setTimeout(() => { loadExports(); }, 0);
    return () => clearTimeout(timer);
  }, [runId, loadExports]);

  const handleGenerate = async () => {
    if (!taskId || !runId || !canManage) return;
    setGenerating(true);
    try {
      const res = await tasksApi.buildExport(taskId, { scope: 'ALL_AUTHORIZED', runId });
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

  return (
    <Card size="small" title={<Space><FileExcelOutlined /><Text strong>Export Panel</Text></Space>} style={{ width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <Space>
          <Button type="primary" icon={<FileExcelOutlined />} onClick={handleGenerate} loading={generating} disabled={!canManage || !runId}>
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
          loading={loading}
          dataSource={exports}
          renderItem={item => (
            <List.Item
              actions={[
                <Tooltip key="download" title="Download">
                  <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(item.Id, item.FileName || `oos-${item.RunId}-v${item.Version}.xlsx`)}>Download</Button>
                </Tooltip>,
                <Tooltip key="details" title="View details">
                  <Button size="small" onClick={() => message.info('Export details are not implemented yet.')}>Details</Button>
                </Tooltip>,
              ]}
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
                </Space>}
              />
            </List.Item>
          )}
        />
      )}
    </Card>
  );
}

export default OosExportPanel;