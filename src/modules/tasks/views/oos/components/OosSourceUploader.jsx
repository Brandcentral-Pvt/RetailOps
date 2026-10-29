import React, { useState, useEffect, useCallback } from 'react';
import { App, Card, Upload, Button, Space, Tag, Alert, Divider, Typography, List, Badge, Row, Col } from 'antd';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { UploadOutlined, FileOutlined, DownloadOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import tasksApi from '../../../services/tasksApi';
import dayjs from 'dayjs';

const { Text } = Typography;

const SOURCE_TYPES = [
  { value: 'BRAND_CENTRAL', label: 'BrandCentral', required: true, icon: '🏪' },
  { value: 'VENDOR_CENTRAL', label: 'Vendor Central', required: false, icon: '🏭' },
  { value: 'RETAILOPS', label: 'RetailOps (auto)', required: false, icon: '🤖' },
];

function OosSourceUploader({ task, activeRun, canManage }) {
  const { message } = App.useApp();
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fileError, setFileError] = useState(null);
  const [reuploadLoading, setReuploadLoading] = useState({});

  const taskInstanceId = task?.Id;

  const loadUploads = useCallback(async () => {
    if (!taskInstanceId || !activeRun) return;
    setLoading(true);
    try {
      const res = await tasksApi.getOosUploads(taskInstanceId, activeRun);
      if (res.success) setUploads(res.data || res.uploads || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [activeRun, taskInstanceId]);

  useEffect(() => {
    if (!activeRun) return undefined;
    const timer = setTimeout(() => { loadUploads(); }, 0);
    return () => clearTimeout(timer);
  }, [activeRun, loadUploads]);

  const beforeUpload = (file) => {
    const allowedTypes = ['.csv', '.xls', '.xlsx'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowedTypes.includes(ext)) {
      setFileError(`Invalid file type: ${ext}. Allowed: ${allowedTypes.join(', ')}`);
      return Upload.LIST_IGNORE;
    }
    if (file.size > 50 * 1024 * 1024) {
      setFileError('File size exceeds 50MB limit');
      return Upload.LIST_IGNORE;
    }
    setFileError(null);
    return true;
  };

  const handleUpload = async (file, sourceType) => {
    if (!taskInstanceId || !activeRun) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sourceType', sourceType);
    try {
      const res = await tasksApi.uploadOosFile(taskInstanceId, activeRun, formData);
      if (res.success) {
        loadUploads();
        message.success(`${sourceType} uploaded successfully`);
      }
    } catch (err) {
      message.error(err.message || 'Upload failed');
    }
  };

  const handleDownload = async (item) => {
    if (!taskInstanceId) return;
    try {
      const res = await tasksApi.downloadOosImport(taskInstanceId, item.Id || item.id);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.FileName || item.fileName || 'oos-upload';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      message.error(err.message || 'Download failed');
    }
  };

  const handleReupload = async (item, sourceType) => {
    if (!taskInstanceId || !activeRun) return;
    setReuploadLoading(prev => ({ ...prev, [item.Id || item.id]: true }));
    try {
      // Re-upload triggers the upload flow again for the same source type
      setFileError(`Re-upload for ${sourceType} - please select a new file`);
    } catch (err) {
      message.error(err.message || 'Re-upload failed');
    } finally {
      setReuploadLoading(prev => { const { [item.Id || item.id]: _, ...rest } = prev; return rest; });
    }
  };

  const renderUploadCard = (source) => {
    const existing = uploads.find(u => u.SourceType === source.value);
    const isAuto = source.value === 'RETAILOPS';

    const renderDescription = (item) => (
      <Space direction="vertical" size={2} style={{ width: '100%' }}>
        <Space size={8}>
          <Text type="secondary" style={{ fontSize: 11 }}>Uploaded: {dayjs(item.CreatedAt).format('DD MMM YYYY HH:mm')}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>Hash: {item.FileHash?.slice(0, 16)}…</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>Rows: {item.TotalRows} · Accepted: {item.AcceptedCount} · Rejected: {item.RejectedCount}</Text>
          {item.ValidationJson && (
            <Text type="secondary" style={{ fontSize: 10 }}>
              {JSON.parse(item.ValidationJson).rejected?.length || 0} rejected rows
            </Text>
          )}
        </Space>
      </Space>
    );

    return (
      <Card size="small" title={<Space><span>{source.icon}</span><Text strong>{source.label}</Text></Space>} style={{ width: '100%' }}>
        <Divider style={{ margin: '8px 0' }} />
        {isAuto ? (
          <Alert message="Auto-generated from RetailOps" description="RetailOps snapshot is automatically captured when the run is created." type="info" showIcon />
        ) : (
          <>
            <Upload.Dragger
              onChange={({ fileList }) => {
                fileList.forEach(f => f.originFileObj && handleUpload(f.originFileObj, source.value));
              }}
              beforeUpload={beforeUpload}
              accept=".csv,.xls,.xlsx"
              multiple={false}
              disabled={!canManage || !activeRun}
              showUploadList={false}
            >
              <p className="ant-upload-drag-icon"><UploadOutlined /></p>
              <p className="ant-upload-text">Click or drag {source.label} CSV/XLS/XLSX here</p>
              <p className="ant-upload-hint">Max 50MB · CSV, XLS, XLSX</p>
            </Upload.Dragger>
            {fileError && <Alert type="error" message={fileError} onClose={() => setFileError(null)} style={{ marginTop: 8 }} />}
          </>
        )}
        {existing && (
          <>
<Divider style={{ margin: '12px 0' }} />
            <List
            itemLayout="horizontal"
            dataSource={[existing]}
            renderItem={item => (
              <List.Item
                actions={
                  canManage && !item.IsValid ? [
                    <Tooltip key="reupload">
                      <TooltipTrigger asChild>
                        <Button size="small" icon={<ReloadOutlined />} disabled={reuploadLoading[item.Id || item.id]} onClick={() => handleReupload(item, source.value)}>Re-upload</Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Re-upload</p></TooltipContent>
                    </Tooltip>,
                    <Tooltip key="delete">
                      <TooltipTrigger asChild>
                        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => setFileError('Delete not implemented')}>Delete</Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Delete upload</p></TooltipContent>
                    </Tooltip>,
                  ] : [
                    <Tooltip key="download">
                      <TooltipTrigger asChild>
                        <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(item)}>Download</Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Download original</p></TooltipContent>
                    </Tooltip>,
                    <Tooltip key="reupload">
                      <TooltipTrigger asChild>
                        <Button size="small" icon={<ReloadOutlined />} disabled={reuploadLoading[item.Id || item.id]} onClick={() => handleReupload(item, source.value)}>New Version</Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Re-upload new version</p></TooltipContent>
                    </Tooltip>,
                  ]
                }
              >
                <List.Item.Meta
                  title={<Space>
                    <FileOutlined />
                    <Text strong>{item.FileName}</Text>
                    <Tag color={item.Status === 'VALIDATED' ? 'green' : item.Status === 'REJECTED' ? 'red' : 'blue'}>{item.Status}</Tag>
                    <Badge count={item.AcceptedCount || 0} color="blue" text="Accepted" />
                    <Badge count={item.RejectedCount || 0} color="red" text="Rejected" />
                  </Space>}
                  description={renderDescription(item)}
                />
              </List.Item>
            )}
            >
          </List>
          </>
        )}
        {!existing && !isAuto && <Text type="secondary">No upload yet</Text>}
      </Card>
    );
  };

  return (
    <Card size="small" loading={loading} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <Space>
          <Text strong>Run: {activeRun ? dayjs(activeRun).format('DD MMM YYYY') : 'Select a run'}</Text>
          <Space size={8}>
            {SOURCE_TYPES.filter(s => s.required).map(s => <Tag key={s.value} color="blue">{s.label} (Required)</Tag>)}
            {SOURCE_TYPES.filter(s => !s.required).map(s => <Tag key={s.value} color="default">{s.label} (Optional)</Tag>)}
          </Space>
        </Space>
      </div>
      <Divider style={{ margin: '8px 0' }} />
      <Row gutter={[16, 16]}>
        {SOURCE_TYPES.map(source => (
          <Col key={source.value} xs={24} md={8}>
            {renderUploadCard(source)}
          </Col>
        ))}
      </Row>
    </Card>
  );
}

export default OosSourceUploader;