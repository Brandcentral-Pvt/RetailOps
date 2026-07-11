import React from 'react';
import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';

const antIcon = <LoadingOutlined style={{ fontSize: 24, color: '#4F46E5' }} spin />;

export function LoadingSpinner({ size = 'default', tip, style }) {
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      padding: '40px 20px',
      ...style 
    }}>
      <Spin indicator={antIcon} size={size} tip={tip}>
        {tip && <div style={{ padding: 50 }} />}
      </Spin>
    </div>
  );
}

export function PageLoading({ message = 'Loading...' }) {
  return (
    <div style={{ 
      minHeight: '60vh', 
      display: 'flex', 
      flexDirection: 'column',
      justifyContent: 'center', 
      alignItems: 'center',
      background: '#fff'
    }}>
      <Spin indicator={antIcon} size="large" />
      <div style={{ 
        marginTop: 16, 
        fontSize: 13, 
        color: '#71717a',
        fontWeight: 500
      }}>
        {message}
      </div>
    </div>
  );
}

export function CardLoading({ height = 200 }) {
  return (
    <div style={{ 
      height, 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center',
      background: '#fafafa',
      borderRadius: 8
    }}>
      <Spin indicator={antIcon} />
    </div>
  );
}

export function InlineLoading({ tip = 'Loading...' }) {
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: 8,
      padding: '8px 0'
    }}>
      <Spin indicator={antIcon} size="small" />
      <span style={{ fontSize: 12, color: '#71717a' }}>{tip}</span>
    </div>
  );
}

export function TableLoading({ rows = 5 }) {
  return (
    <div style={{ padding: 20 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ 
          height: 48, 
          marginBottom: 8, 
          background: '#f4f4f5',
          borderRadius: 4,
          animation: 'pulse 1.5s ease-in-out infinite',
          animationDelay: `${i * 0.1}s`
        }} />
      ))}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
