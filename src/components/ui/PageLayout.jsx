import React from 'react';
import { Spin, Empty, Result, Skeleton, Button } from 'antd';
import { LoadingOutlined, ReloadOutlined, InboxOutlined } from '@ant-design/icons';

const antIcon = <LoadingOutlined style={{ fontSize: 24, color: '#4F46E5' }} spin />;

export function PageHeader({ title, subtitle, icon, actions, breadcrumbs }) {
  return (
    <div style={{ padding: '20px 28px 16px', borderBottom: '1px solid #f4f4f7' }}>
      {breadcrumbs && (
        <div style={{ fontSize: 11, color: '#a1a1aa', marginBottom: 8 }}>
          {breadcrumbs.map((b, i) => (
            <span key={i}>{b}{i < breadcrumbs.length - 1 && ' / '}</span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {icon && (
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f4f4f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {icon}
            </div>
          )}
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#18181b', margin: 0 }}>{title}</h2>
            {subtitle && <p style={{ fontSize: 12, color: '#71717a', margin: 0, marginTop: 2 }}>{subtitle}</p>}
          </div>
        </div>
        {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
      </div>
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
      background: '#fff',
      borderRadius: 12
    }}>
      <Spin indicator={antIcon} size="large" />
      <div style={{ marginTop: 16, fontSize: 13, color: '#71717a', fontWeight: 500 }}>{message}</div>
    </div>
  );
}

export function PageError({ message = 'Failed to load', onRetry }) {
  return (
    <div style={{ 
      minHeight: '40vh', 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center',
      background: '#fff',
      borderRadius: 12,
      padding: 40
    }}>
      <Result
        status="warning"
        title="Unable to Load"
        subTitle={message}
        extra={onRetry && (
          <Button type="primary" icon={<ReloadOutlined />} onClick={onRetry} style={{ borderRadius: 8 }}>
            Retry
          </Button>
        )}
      />
    </div>
  );
}

export function PageEmpty({ title = 'No Data', description, action, icon }) {
  return (
    <div style={{ 
      minHeight: '40vh', 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center',
      background: '#fff',
      borderRadius: 12,
      padding: 40
    }}>
      <Empty
        image={icon || Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#18181b', marginBottom: 4 }}>{title}</div>
            {description && <div style={{ fontSize: 12, color: '#71717a' }}>{description}</div>}
          </div>
        }
        extra={action}
      />
    </div>
  );
}

export function CardSkeleton({ rows = 3, style }) {
  return (
    <div style={{ padding: 20, background: '#fff', borderRadius: 12, border: '1px solid #e4e4e7', ...style }}>
      <Skeleton active paragraph={{ rows }} />
    </div>
  );
}

export function TableSkeleton({ rows = 5, style }) {
  return (
    <div style={{ padding: 20, background: '#fff', borderRadius: 12, border: '1px solid #e4e4e7', ...style }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ 
          display: 'flex', 
          gap: 16, 
          padding: '12px 0', 
          borderBottom: i < rows - 1 ? '1px solid #f4f4f5' : 'none'
        }}>
          <Skeleton.Input active size="small" style={{ width: 40, borderRadius: 4 }} />
          <Skeleton.Input active size="small" style={{ flex: 1, borderRadius: 4 }} />
          <Skeleton.Input active size="small" style={{ width: 100, borderRadius: 4 }} />
          <Skeleton.Input active size="small" style={{ width: 80, borderRadius: 4 }} />
        </div>
      ))}
    </div>
  );
}

export function InlineLoading({ tip = 'Loading...' }) {
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      gap: 8,
      padding: '40px 0'
    }}>
      <Spin indicator={antIcon} size="small" />
      <span style={{ fontSize: 13, color: '#71717a' }}>{tip}</span>
    </div>
  );
}

export function ContentLoader({ loading, error, empty, onRetry, emptyTitle, emptyDesc, children }) {
  if (loading) return <InlineLoading />;
  if (error) return <PageError message={error} onRetry={onRetry} />;
  if (empty) return <PageEmpty title={emptyTitle} description={emptyDesc} />;
  return children;
}

export function PageWrapper({ loading, error, empty, onRetry, emptyTitle, emptyDesc, children }) {
  if (loading) return <PageLoading />;
  if (error) return <PageError message={error} onRetry={onRetry} />;
  if (empty) return <PageEmpty title={emptyTitle} description={emptyDesc} />;
  return <>{children}</>;
}
