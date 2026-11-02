import React from 'react';
import { Card, Checkbox, Typography, Space, Alert, Button, Input, Divider } from 'antd';
import { CheckCircleOutlined, ExclamationCircleOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '../../../../../contexts/AuthContext';
import tasksApi from '../../../services/tasksApi';

const { Text } = Typography;

/**
 * CHECKLIST renderer - explicit verification items
 * Each checklist item can be toggled independently
 */
export default function ChecklistRenderer({ activity, task, onOutputChange, readOnly }) {
  const { hasPermission } = useAuth();
  const canEdit = !readOnly && hasPermission('tasks_execute');
  
  const checklistItems = activity.checklistItems || activity.instructions?.split('\n').filter(Boolean) || [];
  const completedItems = activity.outputValue || [];
  
  const handleToggle = async (index) => {
    if (!canEdit) return;
    const newCompleted = [...completedItems];
    const idx = newCompleted.indexOf(index);
    if (idx >= 0) newCompleted.splice(idx, 1);
    else newCompleted.push(index);
    await onOutputChange(newCompleted);
  };

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
        {checklistItems.map((item, index) => (
          <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bc-surface-subtle)', borderRadius: 6, border: '1px solid var(--bc-border-default)' }}>
            <Checkbox
              checked={completedItems.includes(index)}
              onChange={() => handleToggle(index)}
              disabled={!canEdit}
            >
              <Text strong>{item}</Text>
            </Checkbox>
            {completedItems.includes(index) && (
              <CheckCircleOutlined style={{ color: 'var(--bc-green-600)', fontSize: 14 }} />
            )}
          </div>
        ))}
      </Space>
      {!canEdit && <Text type="secondary" style={{ fontSize: 11, marginTop: 8 }}>Read-only mode</Text>}
    </Card>
  );
}