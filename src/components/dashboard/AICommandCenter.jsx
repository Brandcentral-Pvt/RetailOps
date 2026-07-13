import React from 'react';
import { Progress, Tag, Typography, Badge, Tooltip } from 'antd';
import { 
  Brain, Search, FileText, Image, CheckCircle, 
  RefreshCw, Map, Tags, DollarSign, Shield, Send,
  Clock, TrendingUp, Zap
} from 'lucide-react';

const { Text } = Typography;

const AgentCard = ({ icon: Icon, name, status, queue, running, successRate, avgTime, confidence, color }) => {
  const statusConfig = {
    running: { color: '#4F46E5', bg: '#eff6ff', label: 'Running' },
    idle: { color: '#2E7D32', bg: '#ecfdf5', label: 'Idle' },
    error: { color: '#C62828', bg: '#fef2f2', label: 'Error' },
    queued: { color: '#ED6C02', bg: '#fffbeb', label: 'Queued' },
  };

  const config = statusConfig[status] || statusConfig.idle;

  return (
    <div style={{ 
      padding: '14px', 
      background: '#fff', 
      border: '1px solid #e4e4e7', 
      borderRadius: 10,
      transition: 'all 0.2s'
    }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.boxShadow = `0 4px 12px ${color}15`; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = '#e4e4e7'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={18} color={color} />
        </div>
        <div style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: 600, color: '#18181b', display: 'block' }}>{name}</Text>
          <Tag style={{ fontSize: 9, borderRadius: 4, margin: 0, color: config.color, background: config.bg, border: 'none' }}>
            {config.label}
          </Tag>
        </div>
        {confidence && (
          <Tooltip title={`Confidence: ${confidence}%`}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: confidence >= 80 ? '#ecfdf5' : confidence >= 60 ? '#fffbeb' : '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 10, fontWeight: 700, color: confidence >= 80 ? '#2E7D32' : confidence >= 60 ? '#ED6C02' : '#C62828' }}>{confidence}</Text>
            </div>
          </Tooltip>
        )}
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
        <div style={{ textAlign: 'center', padding: '6px 0', background: '#f4f4f5', borderRadius: 6 }}>
          <Text style={{ fontSize: 9, color: '#71717a', display: 'block' }}>Queue</Text>
          <Text style={{ fontSize: 13, fontWeight: 700, color: '#18181b' }}>{queue}</Text>
        </div>
        <div style={{ textAlign: 'center', padding: '6px 0', background: '#f4f4f5', borderRadius: 6 }}>
          <Text style={{ fontSize: 9, color: '#71717a', display: 'block' }}>Running</Text>
          <Text style={{ fontSize: 13, fontWeight: 700, color: '#18181b' }}>{running}</Text>
        </div>
        <div style={{ textAlign: 'center', padding: '6px 0', background: '#f4f4f5', borderRadius: 6 }}>
          <Text style={{ fontSize: 9, color: '#71717a', display: 'block' }}>Avg Time</Text>
          <Text style={{ fontSize: 13, fontWeight: 700, color: '#18181b' }}>{avgTime}</Text>
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={{ fontSize: 10, color: '#71717a' }}>Success Rate</Text>
          <Text style={{ fontSize: 10, fontWeight: 600, color: successRate >= 90 ? '#2E7D32' : '#ED6C02' }}>{successRate}%</Text>
        </div>
        <Progress percent={successRate} size="small" strokeColor={successRate >= 90 ? '#2E7D32' : '#ED6C02'} showInfo={false} />
      </div>
    </div>
  );
};

const AICommandCenter = ({ agents = [] }) => {
  const defaultAgents = agents.length > 0 ? agents : [
    { icon: Search, name: 'Keyword Research', status: 'running', queue: 12, running: 2, successRate: 94, avgTime: '2.3s', confidence: 87, color: '#4F46E5' },
    { icon: TrendingUp, name: 'SEO Agent', status: 'running', queue: 8, running: 1, successRate: 91, avgTime: '1.8s', confidence: 82, color: '#1976D2' },
    { icon: FileText, name: 'Content Writer', status: 'queued', queue: 24, running: 0, successRate: 88, avgTime: '5.2s', confidence: 79, color: '#ED6C02' },
    { icon: Image, name: 'Image Generation', status: 'running', queue: 6, running: 3, successRate: 92, avgTime: '8.5s', confidence: 85, color: '#9C27B0' },
    { icon: CheckCircle, name: 'Image QA', status: 'idle', queue: 0, running: 0, successRate: 96, avgTime: '0.8s', confidence: 94, color: '#2E7D32' },
    { icon: Map, name: 'Marketplace Transform', status: 'running', queue: 15, running: 2, successRate: 89, avgTime: '3.1s', confidence: 81, color: '#0288D1' },
    { icon: Tags, name: 'Attribute Mapper', status: 'queued', queue: 18, running: 0, successRate: 87, avgTime: '2.7s', confidence: 78, color: '#ED6C02' },
    { icon: DollarSign, name: 'Pricing Intelligence', status: 'running', queue: 5, running: 1, successRate: 93, avgTime: '1.5s', confidence: 88, color: '#2E7D32' },
    { icon: Shield, name: 'Validation Agent', status: 'running', queue: 22, running: 2, successRate: 90, avgTime: '1.2s', confidence: 86, color: '#4F46E5' },
    { icon: Send, name: 'Publishing Agent', status: 'queued', queue: 8, running: 0, successRate: 95, avgTime: '4.1s', confidence: 91, color: '#1976D2' },
  ];

  const runningCount = defaultAgents.filter(a => a.status === 'running').length;
  const totalQueue = defaultAgents.reduce((a, b) => a + b.queue, 0);

  return (
    <div style={{ 
      padding: '16px 20px', 
      background: '#fff', 
      borderRadius: 12, 
      border: '1px solid #e4e4e7'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: '#f3e8ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Brain size={14} color="#9C27B0" />
          </div>
          <Text strong style={{ fontSize: 14, color: '#18181b' }}>AI Command Center</Text>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Badge count={`${runningCount} Active`} style={{ backgroundColor: '#4F46E5' }} />
          <Badge count={`${totalQueue} Queued`} style={{ backgroundColor: '#ED6C02' }} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {defaultAgents.map((agent, i) => (
          <AgentCard key={i} {...agent} />
        ))}
      </div>
    </div>
  );
};

export default AICommandCenter;
