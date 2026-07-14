import React from 'react';
import { Progress, Tag, Typography, Badge } from 'antd';
import { 
  RefreshCw, Image, FileText, CheckCircle, 
  Clock, Zap, ArrowRight, Sparkles 
} from 'lucide-react';

const { Text } = Typography;

const OperationItem = ({ icon: Icon, title, progress, status, count, color, onClick }) => {
  const statusConfig = {
    running: { color: 'var(--text-brand, #1976D2)', label: 'Running' },
    queued: { color: '#ED6C02', label: 'Queued' },
    completed: { color: '#2E7D32', label: 'Complete' },
    failed: { color: '#D32F2F', label: 'Failed' },
  };

  const config = statusConfig[status] || statusConfig.queued;

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
  listingPipeline = 0,
  publishingQueue = 0,
  aiImageGen = 0,
  contentGen = 0,
  validationQueue = 0,
  exports = 0,
  marketplaceSync = 0,
  onNavigate
}) => {
  const operations = [
    { icon: RefreshCw, title: 'Marketplace Sync', count: marketplaceSync, status: marketplaceSync > 0 ? 'running' : 'completed', color: 'var(--text-brand, #1976D2)', onClick: () => onNavigate('/live-sync-tracker') },
    { icon: FileText, title: 'Listing Pipeline', count: listingPipeline, status: listingPipeline > 0 ? 'running' : 'completed', color: '#1976D2', onClick: () => onNavigate('/scrape-tasks') },
    { icon: CheckCircle, title: 'Publishing Queue', count: publishingQueue, status: publishingQueue > 0 ? 'queued' : 'completed', color: '#2E7D32', onClick: () => onNavigate('/scheduled-runs') },
    { icon: Sparkles, title: 'AI Image Generation', count: aiImageGen, status: aiImageGen > 0 ? 'running' : 'completed', color: '#9C27B0', onClick: () => onNavigate('/pems/tasks') },
    { icon: FileText, title: 'Content Generation', count: contentGen, status: contentGen > 0 ? 'queued' : 'completed', color: '#ED6C02', onClick: () => onNavigate('/pems/templates') },
    { icon: CheckCircle, title: 'Validation Queue', count: validationQueue, status: validationQueue > 0 ? 'queued' : 'completed', color: '#2E7D32', onClick: () => onNavigate('/pems/reviews') },
  ];

  return (
    <div style={{ 
      padding: '16px 20px', 
      background: 'var(--bg-primary, #fff)', 
      borderRadius: "var(--radius-xl, 16px)", 
      border: '1px solid var(--border-light, #d9e6e9)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: "var(--radius-md)", background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={14} color="#2E7D32" />
          </div>
          <Text strong style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-primary, #0f172a)' }}>Live Operations</Text>
        </div>
        <Badge count={operations.filter(o => o.status === 'running').length} style={{ backgroundColor: 'var(--text-brand, #4F46E5)' }} />
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
