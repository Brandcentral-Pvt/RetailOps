import React from 'react';
import { Empty, Typography, Tag, Space, Alert } from 'antd';
import { FileTextOutlined, InfoCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

export default function GenericTaskView({ task, viewDefinition }) {
  if (!task) return <Empty description="No task data" />;

  const tabs = viewDefinition?.tabs || [
    { key: 'overview', label: 'Overview' },
    { key: 'sop', label: 'SOP' },
    { key: 'asins', label: 'Affected ASINs' },
    { key: 'evidence', label: 'Evidence' },
    { key: 'comments', label: 'Discussion' },
    { key: 'activity', label: 'Activity' },
    { key: 'review', label: 'Review' },
  ];

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Alert
        message="Standard Task View"
        description="This template uses the generic task view. No specialized workflow is configured."
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
        <div style={{ padding: 12, background: 'var(--bc-surface-subtle)', borderRadius: 8, border: '1px solid var(--bc-border-default)' }}>
          <Text style={{ fontSize: 10, color: 'var(--bc-text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: 4 }}>Task Code</Text>
          <Text strong style={{ fontSize: 14, fontFamily: 'var(--bc-font-mono)' }}>{task.InstanceCode}</Text>
        </div>
        <div style={{ padding: 12, background: 'var(--bc-surface-subtle)', borderRadius: 8, border: '1px solid var(--bc-border-default)' }}>
          <Text style={{ fontSize: 10, color: 'var(--bc-text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: 4 }}>Template</Text>
          <Text strong style={{ fontSize: 14 }}>{task.TemplateName || task.TemplateCode}</Text>
        </div>
        <div style={{ padding: 12, background: 'var(--bc-surface-subtle)', borderRadius: 8, border: '1px solid var(--bc-border-default)' }}>
          <Text style={{ fontSize: 10, color: 'var(--bc-text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: 4 }}>Status</Text>
          <span>{task.Status}</span>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--bc-border-default)', paddingTop: 16, marginTop: 8 }}>
        <Typography.Title level={4}>Available Tabs</Typography.Title>
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          {tabs.map(tab => (
            <div key={tab.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bc-surface-subtle)', borderRadius: 8, border: '1px solid var(--bc-border-default)' }}>
              <Text code style={{ fontSize: 12, fontFamily: 'var(--bc-font-mono)', color: 'var(--bc-text-secondary)' }}>{tab.key}</Text>
              <Text strong>{tab.label}</Text>
              {tab.widgetKey && <Typography.Text type="secondary" style={{ fontSize: 12, fontFamily: 'var(--bc-font-mono)' }}>Widget: {tab.widgetKey}</Typography.Text>}
            </div>
          ))}
        </Space>
      </div>
    </div>
  );
}