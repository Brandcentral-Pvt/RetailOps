import React, { useState, useEffect } from 'react';
import { Card, Input, Typography, Space, Alert, Button, Select, DatePicker, Form, Tooltip } from 'antd';
import { ExclamationCircleOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useAuth } from '../../../../../contexts/AuthContext';
import tasksApi from '../../../services/tasksApi';

const { Text } = Typography;

/**
 * FORM_INPUT renderer - text, numbers, dates and structured data
 * Supports different field types: text, number, date, select, textarea
 */
export default function FormInputRenderer({ activity, task, onOutputChange, readOnly }) {
  const { hasPermission } = useAuth();
  const canEdit = !readOnly && hasPermission('tasks_execute');
  
  const fieldConfig = activity.fieldConfig || { type: 'text' };
  const [value, setValue] = useState(activity.outputValue || '');
  const [error, setError] = useState(null);
  
  const validation = activity.validation || {};
  
  const handleChange = async (newValue) => {
    if (!canEdit) return;
    setValue(newValue);
    
    // Validate
    if (validation.required && (!newValue || newValue.toString().trim() === '')) {
      setError('This field is required');
    } else if (fieldConfig.type === 'number' && newValue && isNaN(Number(newValue))) {
      setError('Must be a valid number');
    } else if (validation.minLength && newValue && newValue.length < validation.minLength) {
      setError(`Minimum ${validation.minLength} characters`);
    } else if (validation.maxLength && newValue && newValue.length > validation.maxLength) {
      setError(`Maximum ${validation.maxLength} characters`);
    } else if (validation.pattern && newValue && !new RegExp(validation.pattern).test(newValue)) {
      setError(validation.patternMessage || 'Invalid format');
    } else {
      setError(null);
      await onOutputChange(newValue);
    }
  };
  
  useEffect(() => {
    if (activity.outputValue !== undefined && activity.outputValue !== value) {
      setValue(activity.outputValue);
    }
  }, [activity.outputValue]);
  
  const renderInput = () => {
    const placeholder = fieldConfig.placeholder || activity.instructions || 'Enter value...';
    
    switch (fieldConfig.type) {
      case 'number':
        return (
          <Input.Number
            value={value ? Number(value) : undefined}
            onChange={handleChange}
            placeholder={placeholder}
            disabled={!canEdit}
            style={{ width: '100%' }}
            min={validation.min}
            max={validation.max}
            precision={validation.precision}
          />
        );
      case 'date':
        return (
          <DatePicker
            value={value ? new Date(value) : null}
            onChange={(date) => handleChange(date ? date.format('YYYY-MM-DD') : '')}
            placeholder={placeholder}
            disabled={!canEdit}
            style={{ width: '100%' }}
            format="YYYY-MM-DD"
          />
        );
      case 'select':
        return (
          <Select
            value={value}
            onChange={handleChange}
            placeholder={placeholder}
            disabled={!canEdit}
            style={{ width: '100%' }}
            options={fieldConfig.options || []}
            allowClear
          />
        );
      case 'textarea':
        return (
          <Input.TextArea
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={placeholder}
            disabled={!canEdit}
            style={{ width: '100%' }}
            rows={validation.rows || 3}
            maxLength={validation.maxLength}
            showCount
          />
        );
      default:
        return (
          <Input
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={placeholder}
            disabled={!canEdit}
            style={{ width: '100%' }}
            type={fieldConfig.type === 'email' ? 'email' : 'text'}
            maxLength={validation.maxLength}
            showCount={validation.maxLength ? true : false}
          />
        );
    }
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Text strong style={{ fontSize: 13 }}>{activity.title}</Text>
          {fieldConfig.label && <Text type="secondary" style={{ fontSize: 12 }}>{fieldConfig.label}</Text>}
          {renderInput()}
          {error && (
            <Space size={4} style={{ color: 'var(--bc-red-600)', fontSize: 11 }}>
              <ExclamationCircleOutlined />
              <Text>{error}</Text>
            </Space>
          )}
          {fieldConfig.helpText && !error && (
            <Tooltip title={fieldConfig.helpText}>
              <Text type="secondary" style={{ fontSize: 11 }}>ℹ️ Help available</Text>
            </Tooltip>
          )}
        </div>
      </Space>
      {!canEdit && <Text type="secondary" style={{ fontSize: 11, marginTop: 8 }}>Read-only mode</Text>}
    </Card>
  );
}