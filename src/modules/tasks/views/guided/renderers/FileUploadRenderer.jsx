import React, { useState, useCallback, useEffect } from 'react';
import { Card, Upload, Button, List, Tag, Typography, Space, Alert, Progress, message } from 'antd';
import { UploadOutlined, FileOutlined, DownloadOutlined, DeleteOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useAuth } from '../../../../../contexts/AuthContext';
import tasksApi from '../../../services/tasksApi';

const { Text } = Typography;

/**
 * FILE_UPLOAD renderer - source report or required file intake
 * Handles file upload with validation, progress, and revision tracking
 */
export default function FileUploadRenderer({ activity, task, onOutputChange, readOnly }) {
  const { hasPermission } = useAuth();
  const canEdit = !readOnly && hasPermission('tasks_execute');
  
  const uploadConfig = activity.uploadConfig || {};
  const acceptedTypes = uploadConfig.acceptedTypes || ['.csv', '.xls', '.xlsx', '.pdf'];
  const maxSize = uploadConfig.maxSize || 50 * 1024 * 1024; // 50MB default
  const [uploads, setUploads] = useState(activity.outputValue?.uploads || []);
  const [uploading, setUploading] = useState(false);
  const [fileError, setFileError] = useState(null);
  
  const allowedMimeTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/csv',
    'application/pdf',
    'text/plain',
  ];
  
  const beforeUpload = (file) => {
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!acceptedTypes.includes(ext)) {
      setFileError(`Invalid file type: ${ext}. Allowed: ${acceptedTypes.join(', ')}`);
      return Upload.LIST_IGNORE;
    }
    if (file.size > maxSize) {
      setFileError(`File size exceeds ${maxSize / (1024*1024)}MB limit`);
      return Upload.LIST_IGNORE;
    }
    setFileError(null);
    return true;
  };
  
  const handleChange = useCallback(async ({ fileList }) => {
    const newFiles = fileList.filter(f => f.status === 'done').map(f => ({
      id: f.uid,
      fileName: f.name,
      fileSize: f.size,
      fileType: f.type,
      uploadedAt: new Date().toISOString(),
      status: 'uploaded',
      response: f.response,
    }));
    setUploads(newFiles);
    await onOutputChange({ ...activity.outputValue, uploads: newFiles, lastUploadedAt: new Date().toISOString() });
  }, [onOutputChange, activity.outputValue]);
  
  const handleDownload = async (upload) => {
    if (!upload.response?.downloadUrl) return;
    try {
      const res = await fetch(upload.response.downloadUrl);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = upload.fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      message.error(err.message || 'Download failed');
    }
  };
  
  const handleRemove = async (fileId) => {
    if (!canEdit) return;
    const newUploads = uploads.filter(u => u.id !== fileId);
    setUploads(newUploads);
    await onOutputChange({ ...activity.outputValue, uploads: newUploads });
  };
  
  const uploadProgress = uploading ? uploads.find(u => u.status === 'uploading')?.percent || 0 : 0;
  
  return (
    <Card size="small" style={{ width: '100%' }}>
      {activity.instructions && (
        <Alert
          message={activity.title}
          description={activity.instructions}
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
        />
      )}
      
      {fileError && <Alert type="error" message={fileError} onClose={() => setFileError(null)} style={{ marginBottom: 12 }} />}
      
      <Upload.Dragger
        onChange={handleChange}
        beforeUpload={beforeUpload}
        accept={acceptedTypes.join(',')}
        multiple={uploadConfig.multiple !== false}
        showUploadList={false}
        disabled={!canEdit}
        style={{ minHeight: 120 }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 24 }}>
          <UploadOutlined style={{ fontSize: 32, color: 'var(--bc-text-muted)' }} />
          <Text strong>Click or drag file here</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {acceptedTypes.join(', ')} · Max {maxSize / (1024*1024)}MB
          </Text>
        </div>
      </Upload.Dragger>
      
      {uploads.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>Uploaded Files</Text>
          <List
            itemLayout="horizontal"
            dataSource={uploads}
            renderItem={item => (
              <List.Item
                actions={
                  canEdit ? [
                    <Tooltip key="download" title="Download">
                      <Button size="small" type="text" icon={<DownloadOutlined />} onClick={() => handleDownload(item)} />
                    </Tooltip>,
                    <Tooltip key="delete" title="Remove">
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => handleRemove(item.id)} />
                    </Tooltip>,
                  ] : [
                    <Tooltip key="download" title="Download">
                      <Button size="small" type="text" icon={<DownloadOutlined />} onClick={() => handleDownload(item)} />
                    </Tooltip>,
                  ]
                }
              >
                <List.Item.Meta
                  avatar={<FileOutlined style={{ fontSize: 20, color: 'var(--bc-blue-600)' }} />}
                  title={<Text strong>{item.fileName}</Text>}
                  description={<Space size={8}>
                    <Tag color={item.status === 'uploaded' ? 'green' : 'orange'}>
                      {item.status === 'uploaded' ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />} {item.status}
                    </Tag>
                    <Text type="secondary" style={{ fontSize: 11 }}>{(item.fileSize / 1024).toFixed(1)} KB</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>{item.uploadedAt ? new Date(item.uploadedAt).toLocaleString() : ''}</Text>
                  </Space>}
                />
              </List.Item>
            )}
          />
        </div>
      )}
      
      {uploadProgress > 0 && uploadProgress < 100 && (
        <div style={{ marginTop: 12 }}>
          <Progress percent={uploadProgress} strokeColor="var(--bc-blue-600)" />
        </div>
      )}
      
      {!canEdit && <Text type="secondary" style={{ fontSize: 11, marginTop: 8, display: 'block' }}>Read-only mode</Text>}
    </Card>
  );
}