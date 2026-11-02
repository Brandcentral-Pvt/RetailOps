import React, { useState, useEffect, useCallback } from 'react';
import { Card, Select, Radio, Typography, Space, Alert, Button, Spin } from 'antd';
import { CheckCircleOutlined, ExclamationCircleOutlined, DownloadOutlined, CloudUploadOutlined } from '@ant-design/icons';
import { useAuth } from '../../../../../contexts/AuthContext';
import tasksApi from '../../../services/tasksApi';

const { Text } = Typography;

/**
 * SELECT_SOURCE renderer - authorized source or method selection
 * Employee chooses from pre-approved sources/methods
 */
export default function SelectSourceRenderer({ activity, task, onOutputChange, readOnly }) {
  const { hasPermission } = useAuth();
  const canEdit = !readOnly && hasPermission('tasks_execute');
  
  const sources = activity.sources || activity.options || [];
  const [selected, setSelected] = useState(activity.outputValue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const handleChange = async (value) => {
    if (!canEdit) return;
    setSelected(value);
    setError(null);
    await onOutputChange(value);
  };
  
  useEffect(() => {
    if (activity.outputValue !== undefined && activity.outputValue !== selected) {
      setSelected(activity.outputValue);
    }
  }, [activity.outputValue]);
  
  const renderSourceCard = (source) => (
    <div
      key={source.id || source.value}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        borderRadius: 8,
        border: `2px solid ${selected === (source.id || source.value) ? 'var(--bc-blue-600)' : 'var(--bc-border-default)'}`,
        background: selected === (source.id || source.value) ? 'var(--bc-blue-50)' : 'var(--bc-surface-subtle)',
        cursor: canEdit ? 'pointer' : 'default',
        transition: 'all 0.2s',
      }}
      onClick={() => canEdit && handleChange(source.id || source.value)}
    >
      <Radio checked={selected === (source.id || source.value)} disabled={!canEdit} />
      <div style={{ flex: 1 }}>
        <Text strong>{source.label || source.name}</Text>
        {source.description && <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 2 }}>{source.description}</Text>}
        {source.meta && <Text type="secondary" style={{ fontSize: 11, fontFamily: 'var(--bc-font-mono)' }}>{source.meta}</Text>}
      </div>
      {selected === (source.id || source.value) && <CheckCircleOutlined style={{ color: 'var(--bc-blue-600)' }} />}
    </div>
  );
  
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
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <Text strong style={{ fontSize: 13 }}>{activity.title}</Text>
        {activity.sources && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activity.sources.map(renderSourceCard)}
          </div>
        )}
        {activity.options && activity.options.length > 0 && !activity.sources && (
          <Radio.Group value={selected} onChange={({ target }) => handleChange(target.value)} disabled={!canEdit}>
            {activity.options.map(opt => (
              <Radio key={opt.value || opt.id} value={opt.value || opt.id} style={{ display: 'block', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Text strong>{opt.label}</Text>
                  {opt.description && <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>{opt.description}</Text>}
                </div>
              </Radio>
            ))}
          </Radio.Group>
        )}
      </Space>
      {error && (
        <Alert type="error" message={error} style={{ marginTop: 8 }} />
      )}
      {!canEdit && <Text type="secondary" style={{ fontSize: 11, marginTop: 8 }}>Read-only mode</Text>}
    </Card>
  );
}