import React from 'react';
import { Tag, Button, Typography, Badge } from 'antd';
import { 
  AlertTriangle, ShoppingCart, XCircle, RefreshCw, 
  Image, FileText, ArrowRight, Clock 
} from 'lucide-react';

const { Text, Title } = Typography;

const ActionCard = ({ icon: Icon, title, description, severity, count, assignee, dueDate, onAction }) => {
  const severityConfig = {
    critical: { bg: '#fef2f2', border: '#fecaca', color: '#C62828', iconBg: '#fee2e2' },
    warning: { bg: '#fffbeb', border: '#fed7aa', color: '#ED6C02', iconBg: '#fef3c7' },
    info: { bg: '#eff6ff', border: '#bfdbfe', color: '#1976D2', iconBg: '#dbeafe' },
  };

  const config = severityConfig[severity] || severityConfig.info;

  return (
    <div style={{ 
      padding: '14px 16px', 
      background: config.bg, 
      border: `1px solid ${config.border}`, 
      borderRadius: 10,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      transition: 'all 0.2s',
      cursor: 'pointer'
    }}
    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'; }}
    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
    onClick={onAction}
    >
      <div style={{ width: 36, height: 36, borderRadius: 8, background: config.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={18} color={config.color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text strong style={{ fontSize: 13, color: '#18181b' }}>{title}</Text>
          {count > 0 && <Badge count={count} style={{ backgroundColor: config.color, fontSize: 10 }} />}
        </div>
        <Text style={{ fontSize: 12, color: '#71717a', display: 'block', marginBottom: 4 }}>{description}</Text>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {assignee && <Tag style={{ fontSize: 10, borderRadius: 4, margin: 0 }}>{assignee}</Tag>}
          {dueDate && (
            <span style={{ fontSize: 10, color: '#71717a', display: 'flex', alignItems: 'center', gap: 3 }}>
              <Clock size={10} /> {dueDate}
            </span>
          )}
        </div>
      </div>
      <ArrowRight size={14} color="#a1a1aa" style={{ marginTop: 4, flexShrink: 0 }} />
    </div>
  );
};

const CriticalActionCenter = ({ 
  priceDisputes = 0, 
  outOfStock = 0, 
  failedListings = 0, 
  pendingApprovals = 0,
  syncFailures = 0,
  onNavigate
}) => {
  const actions = [
    { icon: AlertTriangle, title: 'Price Disputes', description: 'Products with price conflicts across marketplaces', severity: 'critical', count: priceDisputes, onAction: () => onNavigate('/asin-tracker') },
    { icon: ShoppingCart, title: 'Out of Stock', description: 'Products currently unavailable for purchase', severity: 'warning', count: outOfStock, onAction: () => onNavigate('/inventory') },
    { icon: XCircle, title: 'Failed Listings', description: 'Listings that failed to publish or update', severity: 'critical', count: failedListings, onAction: () => onNavigate('/scrape-tasks') },
    { icon: RefreshCw, title: 'Sync Failures', description: 'Marketplace synchronization errors', severity: 'warning', count: syncFailures, onAction: () => onNavigate('/live-sync-tracker') },
    { icon: FileText, title: 'Pending Approvals', description: 'Content and listings awaiting review', severity: 'info', count: pendingApprovals, onAction: () => onNavigate('/pems/reviews') },
    { icon: Image, title: 'Image Generation', description: 'AI-generated images awaiting approval', severity: 'info', count: 0, onAction: () => onNavigate('/pems/tasks') },
  ];

  const hasActions = actions.some(a => a.count > 0);

  return (
    <div style={{ 
      padding: '16px 20px', 
      background: '#fff', 
      borderRadius: 12, 
      border: '1px solid #e4e4e7',
      marginBottom: 20
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={14} color="#C62828" />
          </div>
          <Text strong style={{ fontSize: 14, color: '#18181b' }}>Critical Actions</Text>
          {hasActions && <Badge count={actions.reduce((a, b) => a + b.count, 0)} style={{ backgroundColor: '#C62828' }} />}
        </div>
        <Button type="link" size="small" style={{ fontSize: 12, padding: 0 }}>View All</Button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
        {actions.map((action, i) => (
          <ActionCard key={i} {...action} />
        ))}
      </div>
    </div>
  );
};

export default CriticalActionCenter;
