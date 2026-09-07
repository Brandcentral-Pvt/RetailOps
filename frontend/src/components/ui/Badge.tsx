'use client';

import { Tag } from 'antd';
import { cn } from '@/lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'processing';
  children: React.ReactNode;
}

const variantColors: Record<string, string> = {
  default: 'blue',
  success: 'green',
  warning: 'orange',
  error: 'red',
  processing: 'blue',
  info: 'cyan',
};

const Badge = ({ 
  className, 
  variant = 'default', 
  children,
  ...props 
}: BadgeProps) => {
  const color = variantColors[variant] || 'blue';
  
  return (
    <span 
      className="ant-tag"
      style={{ 
        backgroundColor: `var(--ant-${color}-6)`, 
        color: '#fff',
        borderColor: 'transparent',
        fontSize: '12px',
        fontWeight: 500,
        padding: '0 8px',
        borderRadius: '4px',
        display: 'inline-flex',
        alignItems: 'center',
        height: '20px',
        lineHeight: '16px',
      }}
      {...props}
    >
      {children}
    </span>
  );
};

export { Badge };