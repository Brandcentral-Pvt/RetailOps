import React from 'react';
import { Tag, Tooltip } from 'antd';
import { 
  CheckCircleOutlined, WarningOutlined, AlertOutlined, 
  SyncOutlined, ThunderboltOutlined, CloudServerOutlined 
} from '@ant-design/icons';

const StatusItem = ({ icon, label, value, color, tooltip }) => (
  <Tooltip title={tooltip}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#18181b' }}>{value}</div>
      </div>
    </div>
  </Tooltip>
);

const GlobalStatusBar = ({ 
  healthScore = 85,
  activeAlerts = 0,
  runningAutomations = 0,
  pendingTasks = 0,
  marketplaceStatus = 'operational'
}) => {
  const getHealthColor = (score) => {
    if (score >= 80) return '#2E7D32';
    if (score >= 60) return '#ED6C02';
    return '#C62828';
  };

  const getHealthLabel = (score) => {
    if (score >= 80) return 'Healthy';
    if (score >= 60) return 'Warning';
    return 'Critical';
  };

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between',
      padding: '12px 20px',
      background: '#fff',
      borderRadius: 12,
      border: '1px solid #e4e4e7',
      marginBottom: 20,
      flexWrap: 'wrap',
      gap: 16
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <StatusItem 
          icon={<CheckCircleOutlined />} 
          label="Health" 
          value={`${healthScore}% ${getHealthLabel(healthScore)}`}
          color={getHealthColor(healthScore)}
          tooltip="Overall system health score"
        />
        <div style={{ width: 1, height: 32, background: '#e4e4e7' }} />
        <StatusItem 
          icon={<AlertOutlined />} 
          label="Alerts" 
          value={activeAlerts}
          color={activeAlerts > 0 ? '#C62828' : '#2E7D32'}
          tooltip="Active alerts requiring attention"
        />
        <div style={{ width: 1, height: 32, background: '#e4e4e7' }} />
        <StatusItem 
          icon={<SyncOutlined />} 
          label="Automations" 
          value={`${runningAutomations} Running`}
          color="#4F46E5"
          tooltip="Currently running automation jobs"
        />
        <div style={{ width: 1, height: 32, background: '#e4e4e7' }} />
        <StatusItem 
          icon={<ThunderboltOutlined />} 
          label="Tasks" 
          value={`${pendingTasks} Pending`}
          color={pendingTasks > 5 ? '#ED6C02' : '#2E7D32'}
          tooltip="Tasks pending your attention"
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <CloudServerOutlined style={{ fontSize: 14, color: '#71717a' }} />
        <Tag color={marketplaceStatus === 'operational' ? 'green' : marketplaceStatus === 'degraded' ? 'orange' : 'red'} style={{ borderRadius: 4, fontWeight: 600, fontSize: 11 }}>
          Marketplace {marketplaceStatus}
        </Tag>
      </div>
    </div>
  );
};

export default GlobalStatusBar;
