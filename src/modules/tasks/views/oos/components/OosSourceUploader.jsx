import React, { useState, useEffect, useCallback } from 'react';
import { Card, Upload, Button, Space, Tag, Alert, Divider, Typography, List, Badge, Tooltip, Row, Col, message } from 'antd';
import { UploadOutlined, FileOutlined, DownloadOutlined, DeleteOutlined, ReloadOutlined, WarningOutlined, CheckCircleOutlined, ExclamationCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useAuth } from '../../../../../../contexts/AuthContext';
import tasksApi from '../../../../../../services/tasksApi';
import dayjs from 'dayjs';

const { Text } = Typography;

const SOURCE_TYPES = [
  { value: 'BRAND_CENTRAL', label: 'BrandCentral', required: true, icon: '🏪' },
  { value: 'VENDOR_CENTRAL', label: 'Vendor Central', required: false, icon: '🏭' },
  { value: 'RETAILOPS', label: 'RetailOps (auto)', required: false, icon: '🤖' },
];

function OosSourceUploader({ task, activeRun, canManage, onRunsChange }) {
  const { hasPermission, isAdmin, isGlobalUser } = useAuth();
  const canUpload = isAdmin || true; // TODO: check proper permission
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fileError, setFileError] = useState(null);

  const runId = activeRun;
  const taskInstanceId = task?.Id;

  const loadUploads = useCallback(async () => {
    if (!activeRun) return;
    try {
      const res = await tasksApi.getOosUploads(task.Id, activeRun);
      if (res.success) setUploads(res.data || res.uploads || []);
    } catch (err) { console.error(err); }
  }, [activeRun]);

  useEffect(() => { if (activeRun) loadUploads(); }, [activeRun, loadUploads]);

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
    if (!activeRun) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sourceType', sourceType);
    try {
      const res = await tasksApi.uploadOosFile(task.Id, activeRun, formData);
      if (res.success) {
        loadUploads();
        message.success(`${sourceType} uploaded successfully`);
      }
    } catch (err) {
      message.error(err.message || 'Upload failed');
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
                    <Tooltip key="reupload" title="Re-upload"><Button size="small" icon={<ReloadOutlined />} onClick={() => setError('Re-upload not implemented')}>Re-upload</Button></Tooltip>,
                    <Tooltip key="delete" title="Delete upload"><Button size="small" danger icon={<DeleteOutlined />} onClick={() => setError('Delete not implemented')}>Delete</Button></Tooltip>,
                  ] : [
                    <Tooltip key="download" title="Download original"><Button size="small" icon={<DownloadOutlined />} onClick={() => setError('Download not implemented')}>Download</Button></Tooltip>,
                    <Tooltip key="reupload" title="Re-upload new version"><Button size="small" icon={<ReloadOutlined />} onClick={() => setError('Re-upload not implemented')}>New Version</Button></Tooltip>,
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
          </List>
          </>
        )}
        {!existing && !isAuto && <Text type="secondary">No upload yet</Text>}
      </Card>
    );
  };

  return (
    <Card size="small" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
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