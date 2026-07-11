import React from 'react';
import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';

const antIcon = <LoadingOutlined style={{ fontSize: 28, color: '#4F46E5' }} spin />;

export function Spinner({ size = 'large', tip, style }) {
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      width: '100%',
      minHeight: 'calc(100vh - 120px)',
      ...style 
    }}>
      <div style={{ textAlign: 'center' }}>
        <Spin indicator={antIcon} size={size} />
        {tip && <div style={{ marginTop: 12, fontSize: 13, color: '#71717a', fontWeight: 500 }}>{tip}</div>}
      </div>
    </div>
  );
}

export function ContentSpinner({ tip, height = 300 }) {
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: height,
      width: '100%'
    }}>
      <div style={{ textAlign: 'center' }}>
        <Spin indicator={antIcon} />
        {tip && <div style={{ marginTop: 12, fontSize: 13, color: '#71717a', fontWeight: 500 }}>{tip}</div>}
      </div>
    </div>
  );
}

export function InlineSpinner({ size = 'small', tip }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', padding: '20px 0' }}>
      <Spin indicator={antIcon} size={size} />
      {tip && <span style={{ fontSize: 12, color: '#71717a' }}>{tip}</span>}
    </div>
  );
}

export default Spinner;
