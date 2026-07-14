import React, { useState } from 'react';
import { Modal, Button, Input, Space, Typography, Card, Statistic, Row, Col, Divider, message, Alert } from 'antd';
import { Database, RefreshCw, Upload, Search, Activity, Trash2 } from 'lucide-react';
import { marketSyncApi } from '../../services/api';
import { ModalHeader, ModalFooter } from './ModalShell';
import styles from './SellerModals.module.css';

const { TextArea } = Input;
const { Text, Title } = Typography;

const PoolManagementModal = ({ stats, onClose, onRefresh }) => {
  const [taskIdsText, setTaskIdsText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleUpload = async () => {
    const ids = taskIdsText.split(/[\n,]+/).map(id => id.trim()).filter(id => id.length > 0);
    if (ids.length === 0) return;

    setIsSubmitting(true);
    try {
      const response = await marketSyncApi.uploadPoolTasks(ids);
      if (response.success) {
        message.success(`Successfully added ${response.added} tasks to pool.`);
        setTaskIdsText('');
        onRefresh();
      }
    } catch (error) {
      message.error(error.message || 'Failed to upload tasks');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFullSync = async () => {
    setIsSyncing(true);
    try {
      const response = await marketSyncApi.syncTaskPool();
      if (response.success) {
        message.success(response.message || 'Successfully synchronized task pool with Octoparse.');
        onRefresh();
      }
    } catch (error) {
      message.error(error.message || 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Modal
      open={true}
      onCancel={onClose}
      width={600}
      closable={false}
      centered
      destroyOnHidden
      className={styles.modalContent}
      footer={null}
      styles={{ body: { padding: '16px 24px' } }}
    >
      <ModalHeader
        icon={Database}
        title="Octoparse Task Pool Management"
        subtitle="Manage task allocation and sync from Octoparse"
      />
      <div style={{ padding: '8px 0' }}>
        <Row gutter={16} style={{ marginBottom: '24px' }}>
          <Col span={8}>
            <Card variant="borderless" style={{ background: 'var(--bg-secondary, #f8fafc)', textAlign: 'center', borderRadius: 'var(--radius-lg)' }} styles={{ body: { padding: '16px' } }}>
              <Statistic 
                title={<Text strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary, #64748b)', textTransform: 'uppercase' }}>Total Tasks</Text>} 
                value={stats.total} 
                styles={{ content: { fontWeight: 700, color: 'var(--text-primary, #0f172a)' } }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card variant="borderless" style={{ background: 'var(--bg-success-subtle, #f0fdf4)', textAlign: 'center', borderRadius: 'var(--radius-lg)' }} styles={{ body: { padding: '16px' } }}>
              <Statistic 
                title={<Text strong style={{ fontSize: 'var(--font-size-xs)', color: '#166534', textTransform: 'uppercase' }}>Available</Text>} 
                value={stats.available} 
                styles={{ content: { fontWeight: 700, color: 'var(--text-success, #2E7D32)' } }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card variant="borderless" style={{ background: 'var(--bg-info-subtle, #eff6ff)', textAlign: 'center', borderRadius: 'var(--radius-lg)' }} styles={{ body: { padding: '16px' } }}>
              <Statistic 
                title={<Text strong style={{ fontSize: 'var(--font-size-xs)', color: '#1e40af', textTransform: 'uppercase' }}>Assigned</Text>} 
                value={stats.assigned} 
                styles={{ content: { fontWeight: 700, color: '#0288D1' } }}
              />
            </Card>
          </Col>
        </Row>

        <Alert
          message="Dynamic Task Discovery"
          description="Click 'Sync from Octoparse' to automatically fetch and update all task names, groups, and IDs from your Octoparse account. This will populate the local database for automated allocation."
          type="info"
          showIcon
          icon={<Activity size={18} />}
          style={{ marginBottom: '20px', borderRadius: 'var(--radius-lg)' }}
        />

        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <Text strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary, #64748b)', textTransform: 'uppercase' }}>Manual Import Task IDs</Text>
            <Text style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted, #94a3b8)' }}>Supports multi-line paste</Text>
          </div>
          <TextArea
            rows={6}
            placeholder="e.g.&#10;c6ebbaff-448f-3c6d-92d2-5caa10ea5db5&#10;74be0547-1adc-4c46-a31d-011d759d672d"
            value={taskIdsText}
            onChange={(e) => setTaskIdsText(e.target.value)}
            style={{ 
              borderRadius: 'var(--radius-lg)', 
              fontSize: 'var(--font-size-xs)', 
              fontFamily: 'monospace',
              border: '1px solid var(--border-light, #d9e6e9)'
            }}
          />
          <Text type="secondary" style={{ fontSize: 'var(--font-size-xs)', display: 'block', marginTop: '8px' }}>
            Allocated tasks are automatically linked to new sellers during setup.
          </Text>
        </div>
      </div>

      <ModalFooter
        onCancel={onClose}
        onConfirm={handleUpload}
        confirmText="Register to Pool"
        loading={isSubmitting}
        disabled={!taskIdsText.trim()}
        confirmIcon={<Upload size={14} />}
        extra={
          <Button
            icon={<RefreshCw size={14} className={isSyncing ? 'spin' : ''} />}
            onClick={handleFullSync}
            loading={isSyncing}
            className={styles.modalFooterCancel}
          >
            Sync from Octoparse
          </Button>
        }
      />
    </Modal>
  );
};

export default React.memo(PoolManagementModal);
