import React from 'react';
import { Progress, Tag, Typography, Badge } from 'antd';
import { 
  RefreshCw, FileText, CheckCircle, XCircle, Zap, Clock
} from 'lucide-react';

const { Text } = Typography;

const OperationItem = ({ icon: Icon, title, progress, status, count, color, onClick }) => {
  const statusConfig = {
    running: { color: 'var(--text-brand, #1976D2)', label: 'Running' },
    queued: { color: '#ED6C02', label: 'Queued' },
    completed: { color: '#2E7D32', label: 'Complete' },
    failed: { color: '#D32F2F', label: 'Failed' },
    idle: { color: 'var(--text-tertiary, #94a3b8)', label: 'Idle' },
  };

  const config = statusConfig[status] || statusConfig.idle;

  return (
    <div 
      onClick={onClick}
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 12, 
        padding: '12px 14px',
        background: 'var(--bg-secondary, #f8fafc)',
        borderRadius: 10,
        cursor: 'pointer',
        transition: 'all 0.2s'
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary, #f4f4f5)'}
      onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-secondary, #f8fafc)'}
    >
      <div style={{ width: 36, height: 36, borderRadius: "var(--radius-md)", background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={18} color={color} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>{title}</Text>
          <Tag style={{ fontSize: 'var(--font-size-xs)', borderRadius: "var(--radius-sm)", margin: 0, color: config.color, borderColor: config.color + '40', background: config.color + '10' }}>
            {config.label}
          </Tag>
        </div>
        {progress !== undefined && (
          <Progress 
            percent={progress} 
            size="small" 
            strokeColor={color}
            showInfo={false}
            style={{ marginBottom: 0 }}
          />
        )}
        {count !== undefined && (
          <Text style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary, #64748b)' }}>{count} items in queue</Text>
        )}
      </div>
    </div>
  );
};

const LiveOperations = ({
  pipelineTotal = 0,
  running = 0,
  completed = 0,
  failed = 0,
  idle = 0,
  tasksInProgress = 0,
  onNavigate
}) => {
  // ✅ Honesty fix: rows previously showed made-up queues (AI Image Gen,
  // Publishing Queue, Content Generation) fed with unrelated counts. Every
  // row now reflects a real pipeline/task status count.
  const operations = [
    { icon: FileText, title: 'Sync Pipeline', count: pipelineTotal, status: running > 0 ? 'running' : (pipelineTotal > 0 ? 'queued' : 'idle'), color: 'var(--text-brand, #1976D2)', onClick: () => onNavigate('/scrape-tasks') },
    { icon: RefreshCw, title: 'Running Now', count: running, status: running > 0 ? 'running' : 'idle', color: 'var(--text-brand, #1976D2)', onClick: () => onNavigate('/scrape-tasks') },
    { icon: CheckCircle, title: 'Completed', count: completed, status: completed > 0 ? 'completed' : 'idle', color: '#2E7D32', onClick: () => onNavigate('/scrape-tasks') },
    { icon: XCircle, title: 'Failed', count: failed, status: failed > 0 ? 'failed' : 'idle', color: '#D32F2F', onClick: () => onNavigate('/scrape-tasks') },
    { icon: Clock, title: 'Idle / Queued', count: idle, status: idle > 0 ? 'queued' : 'idle', color: 'var(--text-tertiary, #94a3b8)', onClick: () => onNavigate('/scrape-tasks') },
    { icon: Zap, title: 'Tasks In Progress', count: tasksInProgress, status: tasksInProgress > 0 ? 'running' : 'idle', color: 'var(--text-brand, #1976D2)', onClick: () => onNavigate('/tasks') },
  ];

  const runningCount = running;

  return (
    <div style={{ 
      padding: '16px 20px', 
      background: 'var(--bg-primary, #fff)', 
      borderRadius: "var(--radius-xl, 16px)", 
      border: '1px solid var(--dash-border, #e2e8f0)',
      boxShadow: 'var(--dash-shadow, 0 1px 3px rgba(15,23,42,0.05))',
      overflow: 'hidden'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: "var(--radius-md)", background: 'var(--bg-info-subtle, #eff6ff)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={14} color="var(--text-brand, #1976D2)" />
          </div>
          <Text strong style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-primary, #0f172a)' }}>Live Operations</Text>
        </div>
        <Badge count={runningCount} style={{ backgroundColor: 'var(--text-brand, #1976D2)' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {operations.map((op, i) => (
          <OperationItem key={i} {...op} />
        ))}
      </div>
    </div>
  );
};

export default LiveOperations;
