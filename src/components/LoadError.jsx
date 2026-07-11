import React from 'react';
import { Button, Typography } from 'antd';
import { WarningOutlined, ReloadOutlined } from '@ant-design/icons';

const { Text } = Typography;

export function LoadError({ message = 'Failed to load data', onRetry, style }) {
  return (
    <div style={{ 
      padding: '20px', 
      textAlign: 'center',
      background: '#fef2f2',
      borderRadius: 10,
      border: '1px solid #fecaca',
      marginBottom: 16,
      ...style 
    }}>
      <WarningOutlined style={{ fontSize: 24, color: '#C62828', marginBottom: 8 }} />
      <Text style={{ fontSize: 13, fontWeight: 600, color: '#C62828', display: 'block', marginBottom: 4 }}>
        {message}
      </Text>
      <Text style={{ fontSize: 12, color: '#71717a', display: 'block', marginBottom: 12 }}>
        Something went wrong while loading the data
      </Text>
      {onRetry && (
        <Button 
          type="primary" 
          size="small"
          icon={<ReloadOutlined />} 
          onClick={onRetry}
          style={{ borderRadius: 6, fontWeight: 600 }}
        >
          Try Again
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ title = 'No Data', description, action, icon: Icon, style }) {
  return (
    <div style={{ 
      padding: '40px 20px', 
      textAlign: 'center',
      ...style 
    }}>
      {Icon && (
        <div style={{ width: 56, height: 56, borderRadius: 12, background: '#f4f4f5', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
          <Icon size={24} color="#a1a1aa" />
        </div>
      )}
      <Text style={{ fontSize: 14, fontWeight: 600, color: '#18181b', display: 'block', marginBottom: 4 }}>
        {title}
      </Text>
      {description && (
        <Text style={{ fontSize: 12, color: '#71717a', display: 'block', marginBottom: 12 }}>
          {description}
        </Text>
      )}
      {action}
    </div>
  );
}

export default LoadError;
