import React from 'react';
import { Progress, Typography, Badge, Tag } from 'antd';
import { 
  ArrowRight, CheckCircle, Clock, AlertTriangle,
  FileText, Image, Search, Send, Map, Shield
} from 'lucide-react';

const { Text } = Typography;

const PipelineStage = ({ icon: Icon, name, waiting, running, completed, rejected, avgTime, isLast, color }) => (
  <div style={{ display: 'flex', alignItems: 'stretch', flex: 1 }}>
    <div style={{ 
      flex: 1, 
      padding: '12px', 
      background: '#fff', 
      border: '1px solid #e4e4e7', 
      borderRadius: 8,
      textAlign: 'center',
      position: 'relative'
    }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
        <Icon size={16} color={color} />
      </div>
      <Text style={{ fontSize: 11, fontWeight: 600, color: '#18181b', display: 'block', marginBottom: 6 }}>{name}</Text>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 6 }}>
        {waiting > 0 && <Tag style={{ fontSize: 9, borderRadius: 4, margin: 0, color: '#ED6C02', background: '#fffbeb', border: 'none' }}>{waiting} wait</Tag>}
        {running > 0 && <Tag style={{ fontSize: 9, borderRadius: 4, margin: 0, color: '#4F46E5', background: '#eff6ff', border: 'none' }}>{running} run</Tag>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
        <span style={{ fontSize: 10, color: '#2E7D32' }}>✓ {completed}</span>
        {rejected > 0 && <span style={{ fontSize: 10, color: '#C62828' }}>✗ {rejected}</span>}
      </div>
      {avgTime && (
        <Text style={{ fontSize: 9, color: '#a1a1aa', display: 'block', marginTop: 4 }}>
          <Clock size={9} style={{ marginRight: 2 }} />{avgTime}
        </Text>
      )}
    </div>
    {!isLast && (
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 4px' }}>
        <ArrowRight size={14} color="#d4d4d8" />
      </div>
    )}
  </div>
);

const ListingPipeline = ({ stages = [] }) => {
  const defaultStages = stages.length > 0 ? stages : [
    { icon: FileText, name: 'Submission', waiting: 45, running: 0, completed: 1234, rejected: 12, avgTime: '0.5h', color: '#4F46E5' },
    { icon: Shield, name: 'Validation', waiting: 12, running: 3, completed: 1222, rejected: 8, avgTime: '1.2h', color: '#1976D2' },
    { icon: Map, name: 'Category Map', waiting: 8, running: 2, completed: 1215, rejected: 5, avgTime: '0.8h', color: '#0288D1' },
    { icon: Image, name: 'Image Pipeline', waiting: 15, running: 4, completed: 1198, rejected: 3, avgTime: '2.5h', color: '#9C27B0' },
    { icon: FileText, name: 'Content', waiting: 22, running: 5, completed: 1180, rejected: 2, avgTime: '3.1h', color: '#ED6C02' },
    { icon: Search, name: 'SEO', waiting: 10, running: 2, completed: 1175, rejected: 1, avgTime: '1.5h', color: '#2E7D32' },
    { icon: Send, name: 'Publishing', waiting: 5, running: 2, completed: 1170, rejected: 0, avgTime: '0.3h', color: '#4F46E5' },
    { icon: CheckCircle, name: 'Live', waiting: 0, running: 0, completed: 1170, rejected: 0, avgTime: '-', color: '#2E7D32' },
  ];

  const totalRunning = defaultStages.reduce((a, b) => a + b.running, 0);
  const totalCompleted = defaultStages[defaultStages.length - 1]?.completed || 0;

  return (
    <div style={{ 
      padding: '16px 20px', 
      background: '#fff', 
      borderRadius: 12, 
      border: '1px solid #e4e4e7'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowRight size={14} color="#2E7D32" />
          </div>
          <Text strong style={{ fontSize: 14, color: '#18181b' }}>Listing Pipeline</Text>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Badge count={`${totalRunning} Processing`} style={{ backgroundColor: '#4F46E5' }} />
          <Badge count={`${totalCompleted} Live`} style={{ backgroundColor: '#2E7D32' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 0, overflowX: 'auto', paddingBottom: 8 }}>
        {defaultStages.map((stage, i) => (
          <PipelineStage key={i} {...stage} isLast={i === defaultStages.length - 1} />
        ))}
      </div>
    </div>
  );
};

export default ListingPipeline;
