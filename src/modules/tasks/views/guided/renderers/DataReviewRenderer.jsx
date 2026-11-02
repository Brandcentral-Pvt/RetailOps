import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Tag, Typography, Space, Alert, Button, Spin, Descriptions } from 'antd';
import { ReloadOutlined, ExclamationCircleOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useAuth } from '../../../../../contexts/AuthContext';
import tasksApi from '../../../services/tasksApi';

const { Text } = Typography;

/**
 * DATA_REVIEW renderer - source metrics and validation results
 * Displays data from a source for review/confirmation
 */
export default function DataReviewRenderer({ activity, task, onOutputChange, readOnly }) {
  const { hasPermission, isAdmin, isGlobalUser } = useAuth();
  const canEdit = !readOnly && (isAdmin || isGlobalUser || hasPermission('tasks_execute'));
  
  const sourceConfig = activity.sourceConfig || {};
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [confirmed, setConfirmed] = useState(activity.outputValue?.confirmed || false);
  
  const loadData = useCallback(async () => {
    if (!sourceConfig.endpoint) return;
    setLoading(true);
    setError(null);
    try {
      const params = { ...sourceConfig.params, taskInstanceId: task.Id };
      const res = await tasksApi.getInstances(params);
      if (res.success) {
        setData(res.data || res.instances || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [task.Id, sourceConfig.endpoint, sourceConfig.params]);
  
  useEffect(() => {
    loadData();
  }, [loadData]);
  
  const handleConfirm = async () => {
    if (!canEdit) return;
    await onOutputChange({ ...activity.outputValue, confirmed: true, confirmedAt: new Date().toISOString() });
    setConfirmed(true);
  };
  
  const columns = sourceConfig.columns || [
    { title: 'Field', dataIndex: 'key', key: 'key', width: '30%' },
    { title: 'Value', dataIndex: 'value', key: 'value' },
    { title: 'Status', dataIndex: 'status', key: 'status', width: '15%', render: v => <Tag color={v === 'OK' ? 'green' : 'red'}>{v}</Tag> },
  ];
  
  const tableData = Array.isArray(data) 
    ? data 
    : data 
      ? Object.entries(data).map(([key, value]) => ({ key, value, status: 'OK' }))
      : [];
  
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
      
      {loading ? (
        <Spin size="large" style={{ padding: 24 }} />
      ) : error ? (
        <Alert type="error" message={error} style={{ marginBottom: 12 }} />
      ) : (
        <>
          {tableData.length > 0 && (
            <Table
              columns={columns}
              dataSource={tableData}
              rowKey="key"
              size="small"
              bordered
              pagination={false}
              style={{ marginBottom: 16 }}
            />
          )}
          
          {sourceConfig.metrics && (
            <Descriptions size="small" column={3} style={{ marginBottom: 16 }}>
              {Object.entries(sourceConfig.metrics).map(([key, value]) => (
                <Descriptions.Item key={key} label={key}>{value}</Descriptions.Item>
              ))}
            </Descriptions>
          )}
          
          <Space size={8} style={{ marginTop: 12 }}>
            <Button
              type={confirmed ? 'default' : 'primary'}
              icon={confirmed ? <CheckCircleOutlined /> : <CheckCircleOutlined />}
              onClick={handleConfirm}
              disabled={!canEdit || confirmed}
              loading={loading}
            >
              {confirmed ? 'Confirmed' : 'Confirm Data'}
            </Button>
            <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
              Refresh
            </Button>
          </Space>
          
          {!canEdit && <Text type="secondary" style={{ fontSize: 11, marginTop: 8 }}>Read-only mode</Text>}
        </>
      )}
    </Card>
  );
}