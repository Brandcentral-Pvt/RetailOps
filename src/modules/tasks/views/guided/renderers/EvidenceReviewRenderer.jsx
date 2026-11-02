import React, { useState, useCallback, useEffect } from 'react';
import { Card, List, Button, Typography, Space, Tag, Alert, Modal, Image, Progress, Popconfirm } from 'antd';
import { CheckCircleOutlined, ExclamationCircleOutlined, EyeOutlined, DownloadOutlined, FileOutlined, PictureOutlined, UploadOutlined, DeleteOutlined, CheckOutlined } from '@ant-design/icons';
import { useAuth } from '../../../../../contexts/AuthContext';
import tasksApi from '../../../services/tasksApi';

const { Text } = Typography;

/**
 * EVIDENCE_REVIEW renderer - evidence inspection and confirmation
 * Displays uploaded evidence with verification status, allows approval/rejection
 */
export default function EvidenceReviewRenderer({ activity, task, onOutputChange, readOnly }) {
  const { hasPermission, isAdmin, isGlobalUser } = useAuth();
  const canEdit = !readOnly && (isAdmin || isGlobalUser || hasPermission('tasks_execute'));
  const canManage = isAdmin || isGlobalUser || hasPermission('tasks_manage');
  
  const evidenceConfig = activity.evidenceConfig || {};
  const [evidence, setEvidence] = useState(activity.outputValue?.evidence || []);
  const [selectedEvidence, setSelectedEvidence] = useState(null);
  const [verifying, setVerifying] = useState({});
  const [error, setError] = useState(null);
  
  const handleVerify = async (evidenceId, verified) => {
    if (!canManage) return;
    setVerifying(prev => ({ ...prev, [evidenceId]: true }));
    try {
      const updated = evidence.map(e => 
        e.id === evidenceId ? { ...e, verified, verifiedAt: new Date().toISOString(), verifiedBy: 'current_user' } : e
      );
      setEvidence(updated);
      await onOutputChange({ ...activity.outputValue, evidence: updated });
    } catch (err) {
      setError(err.message || 'Verification failed');
    } finally {
      setVerifying(prev => ({ ...prev, [evidenceId]: false }));
    }
  };
  
  const handleDownload = async (item) => {
    if (!item.url) return;
    try {
      const res = await fetch(item.url);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.fileName || 'evidence';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err.message || 'Download failed');
    }
  };
  
  const handlePreview = (item) => {
    setSelectedEvidence(item);
  };
  
  const handleRemove = async (evidenceId) => {
    if (!canManage) return;
    const updated = evidence.filter(e => e.id !== evidenceId);
    setEvidence(updated);
    await onOutputChange({ ...activity.outputValue, evidence: updated });
  };
  
  const getStatusTag = (item) => {
    if (item.verified === true) return <Tag color="green"><CheckCircleOutlined /> Verified</Tag>;
    if (item.verified === false) return <Tag color="red"><ExclamationCircleOutlined /> Rejected</Tag>;
    return <Tag color="orange">Pending</Tag>;
  };
  
  const isImage = (item) => item.fileType?.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.gif', '.webp'].some(ext => item.fileName?.toLowerCase().endsWith(ext));
  const isPdf = (item) => item.fileType === 'application/pdf' || item.fileName?.toLowerCase().endsWith('.pdf');
  
  const renderEvidenceItem = (item) => (
    <List.Item
      actions={
        canManage ? [
          <Tooltip key="preview" title="Preview">
            <Button size="small" type="text" icon={<EyeOutlined />} onClick={() => handlePreview(item)} />
          </Tooltip>,
          <Tooltip key="download" title="Download">
            <Button size="small" type="text" icon={<DownloadOutlined />} onClick={() => handleDownload(item)} />
          </Tooltip>,
          <Tooltip key="verify" title={item.verified ? 'Verified' : 'Mark as Verified'}>
            <Button 
              size="small" 
              type={item.verified ? 'default' : 'primary'} 
              icon={<CheckOutlined />} 
              onClick={() => handleVerify(item.id, !item.verified)}
              loading={verifying[item.id]}
              disabled={item.verified}
            >
              {item.verified ? 'Verified' : 'Verify'}
            </Button>
          </Tooltip>,
          <Popconfirm key="remove" title="Remove this evidence?" onConfirm={() => handleRemove(item.id)} okText="Yes" cancelText="No">
            <Button size="small" danger type="text" icon={<DeleteOutlined />}>Remove</Button>
          </Popconfirm>,
        ] : [
          <Tooltip key="preview" title="Preview">
            <Button size="small" type="text" icon={<EyeOutlined />} onClick={() => handlePreview(item)} />
          </Tooltip>,
          <Tooltip key="download" title="Download">
            <Button size="small" type="text" icon={<DownloadOutlined />} onClick={() => handleDownload(item)} />
          </Tooltip>,
        ]
      }
    >
      <List.Item.Meta
        avatar={
          isImage(item) ? (
            <img src={item.url || item.thumbnail} alt={item.fileName} style={{ width: 40, height: 40, borderRadius: 4, objectFit: 'cover' }} />
          ) : isPdf(item) ? (
            <PictureOutlined style={{ fontSize: 24, color: 'var(--bc-red-600)' }} />
          ) : (
            <FileOutlined style={{ fontSize: 24, color: 'var(--bc-blue-600)' }} />
          )
        }
        title={<Space direction="vertical" size={2} style={{ width: '100%' }}>
          <Text strong style={{ fontSize: 13 }}>{item.fileName}</Text>
          <Space size={8}>
            <Tag size="small" color={item.verified === true ? 'green' : item.verified === false ? 'red' : 'orange'}>
              {item.verified === true ? (
                <> <CheckCircleOutlined /> Verified </>
              ) : item.verified === false ? (
                <> <ExclamationCircleOutlined /> Rejected </>
              ) : (
                'Pending'
              )}
            </Tag>
            <Text type="secondary" style={{ fontSize: 11 }}>{item.fileType}</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>{item.fileSize ? (item.fileSize / 1024).toFixed(1) + ' KB' : ''}</Text>
          </Space>
        </Space>}
        description={
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <Text type="secondary" style={{ fontSize: 11 }}>Uploaded: {item.uploadedAt ? new Date(item.uploadedAt).toLocaleString() : 'Unknown'}</Text>
            {item.uploadedByName && <Text type="secondary" style={{ fontSize: 11 }}>By: {item.uploadedByName}</Text>}
            {item.description && <Text type="secondary" style={{ fontSize: 11 }}>{item.description}</Text>}
          </Space>
        }
      />
    </List.Item>
  );
  
  const verifiedCount = evidence.filter(e => e.verified === true).length;
  const totalCount = evidence.length;
  const verificationPct = totalCount > 0 ? Math.round((verifiedCount / totalCount) * 100) : 0;
  
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
      
      <div style={{ marginBottom: 16 }}>
        <Space size={16} style={{ flexWrap: 'wrap' }}>
          <Space>
            <Text strong>Verification Progress</Text>
            <Progress 
              percent={verificationPct} 
              strokeColor={verificationPct === 100 ? 'var(--bc-green-600)' : 'var(--bc-blue-600)'}
              style={{ width: 150 }}
              format={() => `${verifiedCount}/${totalCount} verified`}
            />
          </Space>
          {canManage && evidence.length > 0 && (
            <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => evidence.forEach(e => handleVerify(e.id, true))} disabled={verificationPct === 100}>
              Verify All
            </Button>
          )}
        </Space>
      </div>
      
      {error && <Alert type="error" message={error} onClose={() => setError(null)} style={{ marginBottom: 12 }} />}
      
      {evidence.length === 0 ? (
        <Alert message="No evidence uploaded yet" description="Upload evidence using the File Upload activity" type="info" showIcon />
      ) : (
        <List
          itemLayout="horizontal"
          dataSource={evidence}
          renderItem={renderEvidenceItem}
          pagination={false}
        />
      )}
      
      {selectedEvidence && (
        <Modal
          open={true}
          title={selectedEvidence.fileName}
          onCancel={() => setSelectedEvidence(null)}
          width={900}
          footer={[
            <Button key="download" icon={<DownloadOutlined />} onClick={() => handleDownload(selectedEvidence)}>Download</Button>,
            <Button key="close" onClick={() => setSelectedEvidence(null)}>Close</Button>,
          ]}
        >
          {isImage(selectedEvidence) ? (
            <Image src={selectedEvidence.url} alt={selectedEvidence.fileName} style={{ maxWidth: '100%', maxHeight: '70vh' }} />
          ) : isPdf(selectedEvidence) ? (
            <iframe src={selectedEvidence.url} style={{ width: '100%', height: '70vh', border: 'none' }} />
          ) : (
            <Alert message="Preview not available" description="Download the file to view" type="info" showIcon />
          )}
        </Modal>
      )}
      
      {!canEdit && <Text type="secondary" style={{ fontSize: 11, marginTop: 8, display: 'block' }}>Read-only mode</Text>}
    </Card>
  );
}