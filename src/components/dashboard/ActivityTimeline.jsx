import React from 'react';
import { Typography, Tag, Badge, Button } from 'antd';
import { 
  CheckCircle, AlertTriangle, Info, Bell, 
  ShoppingCart, RefreshCw, Image, FileText, 
  Clock, Send, Upload, Eye
} from 'lucide-react';

const { Text } = Typography;

const TimelineEvent = ({ type, title, description, time, user, department, marketplace, status, icon: EventIcon }) => {
  const typeConfig = {
    success: { icon: CheckCircle, color: '#2E7D32', bg: '#ecfdf5' },
    warning: { icon: AlertTriangle, color: '#ED6C02', bg: '#fffbeb' },
    info: { icon: Info, color: '#1976D2', bg: '#eff6ff' },
    alert: { icon: Bell, color: '#C62828', bg: '#fef2f2' },
    action: { icon: Send, color: '#4F46E5', bg: '#eff6ff' },
    upload: { icon: Upload, color: '#0288D1', bg: '#ecfeff' },
    view: { icon: Eye, color: '#71717a', bg: '#f4f4f5' },
  };

  const config = typeConfig[type] || typeConfig.info;
  const Icon = EventIcon || config.icon;

  return (
    <div style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid #f4f4f5' }}>
      <div style={{ position: 'relative' }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: config.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={14} color={config.color} />
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Text style={{ fontSize: 12, fontWeight: 600, color: '#18181b' }}>{title}</Text>
          {marketplace && <Tag style={{ fontSize: 8, borderRadius: 3, margin: 0, padding: '0 4px' }}>{marketplace}</Tag>}
        </div>
        <Text style={{ fontSize: 11, color: '#71717a', display: 'block', marginBottom: 3 }}>{description}</Text>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 10, color: '#a1a1aa' }}>{time}</Text>
          {user && <Text style={{ fontSize: 10, color: '#71717a' }}>by {user}</Text>}
          {department && <Tag style={{ fontSize: 8, borderRadius: 3, margin: 0 }}>{department}</Tag>}
          {status && (
            <Tag style={{ 
              fontSize: 8, 
              borderRadius: 3, 
              margin: 0,
              color: status === 'completed' ? '#2E7D32' : status === 'pending' ? '#ED6C02' : '#4F46E5',
              background: status === 'completed' ? '#ecfdf5' : status === 'pending' ? '#fffbeb' : '#eff6ff',
              border: 'none'
            }}>
              {status}
            </Tag>
          )}
        </div>
      </div>
    </div>
  );
};

const ActivityTimeline = ({ events = [] }) => {
  const defaultEvents = events.length > 0 ? events : [
    { type: 'success', title: 'Listing Published', description: '12 products published to Amazon India', time: '2m ago', user: 'System', department: 'Automation', marketplace: 'Amazon', status: 'completed' },
    { type: 'info', title: 'Images Generated', description: '8 new lifestyle images ready for review', time: '15m ago', user: 'AI Agent', department: 'Design', marketplace: '-', status: 'completed' },
    { type: 'warning', title: 'Price Dispute Detected', description: '3 products have conflicting prices', time: '32m ago', user: 'System', department: 'Pricing', marketplace: 'Flipkart', status: 'pending' },
    { type: 'success', title: 'Content Approved', description: '24 product descriptions approved', time: '1h ago', user: 'Rahul M.', department: 'Content', marketplace: '-', status: 'completed' },
    { type: 'upload', title: 'Bulk Upload Complete', description: '156 products imported from CSV', time: '2h ago', user: 'Priya S.', department: 'Operations', marketplace: '-', status: 'completed' },
    { type: 'action', title: 'Marketplace Sync Started', description: 'Syncing 2,340 products to Flipkart', time: '2.5h ago', user: 'System', department: 'Automation', marketplace: 'Flipkart', status: 'completed' },
    { type: 'alert', title: 'Low Stock Alert', description: '5 products below minimum threshold', time: '3h ago', user: 'System', department: 'Inventory', marketplace: 'Amazon', status: 'pending' },
    { type: 'success', title: 'SEO Optimization Complete', description: '45 listings optimized with new keywords', time: '4h ago', user: 'AI Agent', department: 'SEO', marketplace: '-', status: 'completed' },
  ];

  return (
    <div style={{ 
      padding: '16px 20px', 
      background: '#fff', 
      borderRadius: 12, 
      border: '1px solid #e4e4e7'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: '#f4f4f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={14} color="#71717a" />
          </div>
          <Text strong style={{ fontSize: 14, color: '#18181b' }}>Activity Timeline</Text>
        </div>
        <Button type="link" size="small" style={{ fontSize: 11, padding: 0 }}>View All</Button>
      </div>
      <div style={{ maxHeight: 400, overflowY: 'auto' }}>
        {defaultEvents.map((event, i) => (
          <TimelineEvent key={i} {...event} />
        ))}
      </div>
    </div>
  );
};

export default ActivityTimeline;
