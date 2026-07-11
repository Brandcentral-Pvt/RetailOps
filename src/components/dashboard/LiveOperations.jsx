import React from 'react';
import { Progress, Tag, Typography, Badge } from 'antd';
import { 
  RefreshCw, Image, FileText, CheckCircle, 
  Clock, Zap, ArrowRight 
} from 'lucide-react';

const { Text } = Typography;

const OperationItem = ({ icon: Icon, title, progress, status, count, color, onClick }) => {
  const statusConfig = {
    running: { color: '#4F46E5', label: 'Running' },
    queued: { color: '#ED6C02', label: 'Queued' },
    completed: { color: '#2E7D32', label: 'Complete' },
    failed: { color: '#C62828', label: 'Failed' },
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
        background: '#fafafa',
        borderRadius: 10,
        cursor: 'pointer',
        transition: 'all 0.2s'
      }}
      onMouseEnter={e => e.currentTarget.style.background = '#f4f4f5'}
      onMouseLeave={e => e.currentTarget.style.background = '#fafafa'}
    >
      <div style={{ width: 36, height: 36, borderRadius: 8, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={18} color={color} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={{ fontSize: 13, fontWeight: 600, color: '#18181b' }}>{title}</Text>
          <Tag style={{ fontSize: 9, borderRadius: 4, margin: 0, color: config.color, borderColor: config.color + '40', background: config.color + '10' }}>
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
          <Text style={{ fontSize: 11, color: '#71717a' }}>{count} items in queue</Text>
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
    { icon: RefreshCw, title: 'Marketplace Sync', count: marketplaceSync, status: marketplaceSync > 0 ? 'running' : 'completed', color: '#4F46E5', onClick: () => onNavigate('/live-sync-tracker') },
    { icon: FileText, title: 'Listing Pipeline', count: listingPipeline, status: listingPipeline > 0 ? 'running' : 'completed', color: '#1976D2', onClick: () => onNavigate('/scrape-tasks') },
    { icon: CheckCircle, title: 'Publishing Queue', count: publishingQueue, status: publishingQueue > 0 ? 'queued' : 'completed', color: '#2E7D32', onClick: () => onNavigate('/scheduled-runs') },
    { icon: require('lucide-react').Sparkles, title: 'AI Image Generation', count: aiImageGen, status: aiImageGen > 0 ? 'running' : 'completed', color: '#9C27B0', onClick: () => onNavigate('/pems/tasks') },
    { icon: FileText, title: 'Content Generation', count: contentGen, status: contentGen > 0 ? 'queued' : 'completed', color: '#ED6C02', onClick: () => onNavigate('/pems/templates') },
    { icon: CheckCircle, title: 'Validation Queue', count: validationQueue, status: validationQueue > 0 ? 'queued' : 'completed', color: '#2E7D32', onClick: () => onNavigate('/pems/reviews') },
  ];

  return (
    <div style={{ 
      padding: '16px 20px', 
      background: '#fff', 
      borderRadius: 12, 
      border: '1px solid #e4e4e7'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={14} color="#2E7D32" />
          </div>
          <Text strong style={{ fontSize: 14, color: '#18181b' }}>Live Operations</Text>
        </div>
        <Badge count={operations.filter(o => o.status === 'running').length} style={{ backgroundColor: '#4F46E5' }} />
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
