import React from 'react';
import { Button, Result } from 'antd';
import { RefreshCw } from 'lucide-react';

export function LoadError({ message = 'Failed to load data', onRetry, style }) {
  return (
    <div style={{ 
      padding: '40px 20px', 
      textAlign: 'center',
      ...style 
    }}>
      <Result
        status="warning"
        title="Unable to Load"
        subTitle={message}
        extra={
          onRetry && (
            <Button 
              type="primary" 
              icon={<RefreshCw size={14} />}
              onClick={onRetry}
              style={{ borderRadius: 8 }}
            >
              Retry
            </Button>
          )
        }
      />
    </div>
  );
}

export function EmptyState({ title = 'No Data', description, action, style }) {
  return (
    <div style={{ 
      padding: '60px 20px', 
      textAlign: 'center',
      ...style 
    }}>
      <Result
        status="empty"
        title={title}
        subTitle={description}
        extra={action}
      />
    </div>
  );
}
