import React from 'react';
import { Tag, Tooltip } from 'antd';
import { 
  CheckCircle, AlertTriangle, RefreshCw, Zap, Cloud 
} from 'lucide-react';

const StatusItem = ({ icon, label, value, color, tooltip }) => (
  <Tooltip title={tooltip}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
      <div>
        <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-secondary, #64748b)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>{value}</div>
      </div>
    </div>
  </Tooltip>
);

const GlobalStatusBar = ({ 
  healthScore = 85,
  hasTargets = true,
  activeAlerts = 0,
  runningAutomations = 0,
  pendingTasks = 0,
  marketplaceStatus = 'operational'
}) => {
  const getHealthColor = (score) => {
    if (score >= 80) return '#2E7D32';
    if (score >= 60) return '#ED6C02';
    return '#D32F2F';
  };

  const getHealthLabel = (score) => {
    if (score >= 80) return 'Healthy';
    if (score >= 60) return 'Warning';
    return 'Critical';
  };

  const healthValue = hasTargets ? `${healthScore}% ${getHealthLabel(healthScore)}` : '— No targets';
  const healthColor = hasTargets ? getHealthColor(healthScore) : '#94a3b8';
  const healthTooltip = hasTargets ? 'Overall system health score' : 'Set revenue targets to compute a health score';

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between',
      padding: '14px 20px',
      background: 'var(--bg-primary, #fff)',
      borderRadius: "var(--radius-xl, 16px)",
      border: '1px solid var(--dash-border, #e2e8f0)',
      boxShadow: 'var(--dash-shadow, 0 1px 3px rgba(15,23,42,0.05))',
      marginBottom: 20,
      flexWrap: 'wrap',
      gap: 16
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <StatusItem 
          icon={<CheckCircle size={16} />}
          label="Health" 
          value={healthValue}
          color={healthColor}
          tooltip={healthTooltip}
        />
        <div style={{ width: 1, height: 32, background: 'var(--border-light, #d9e6e9)' }} />
        <StatusItem 
          icon={<AlertTriangle size={16} />}
          label="Alerts" 
          value={activeAlerts}
          color={activeAlerts > 0 ? '#D32F2F' : '#2E7D32'}
          tooltip="Active alerts requiring attention"
        />
        <div style={{ width: 1, height: 32, background: 'var(--border-light, #d9e6e9)' }} />
        <StatusItem 
          icon={<RefreshCw size={16} />}
          label="Automations" 
          value={`${runningAutomations} Running`}
          color="var(--text-brand, #1976D2)"
          tooltip="Currently running automation jobs"
        />
        <div style={{ width: 1, height: 32, background: 'var(--border-light, #d9e6e9)' }} />
        <StatusItem 
          icon={<Zap size={16} />}
          label="Tasks" 
          value={`${pendingTasks} Pending`}
          color={pendingTasks > 5 ? '#ED6C02' : '#2E7D32'}
          tooltip="Tasks pending your attention"
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Cloud size={16} style={{ color: 'var(--text-secondary, #64748b)' }} />
        <Tag color={marketplaceStatus === 'operational' ? 'green' : marketplaceStatus === 'degraded' ? 'orange' : 'red'} style={{ borderRadius: "var(--radius-sm)", fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>
          Marketplace {marketplaceStatus}
        </Tag>
      </div>
    </div>
  );
};

export default GlobalStatusBar;
