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
      minHeight: '50vh',
      ...style 
    }}>
      <Spin indicator={antIcon} size={size} tip={tip}>
        {tip && <div style={{ padding: 50 }} />}
      </Spin>
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
