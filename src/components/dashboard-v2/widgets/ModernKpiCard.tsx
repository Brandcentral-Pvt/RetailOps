import React from 'react';
import { Card, Row, Col, Statistic, Progress, Tag, Tooltip } from 'antd';
import { 
  TrendingUp, TrendingDown, DollarSign, ShoppingCart, 
  Target, Activity, ArrowUpRight, ArrowDownRight, AlertTriangle 
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip } from 'recharts';
import styles from './ModernKpiCard.module.css';

interface KpiData {
  id: string;
  title: string;
  value: number;
  prefix?: string;
  suffix?: string;
  trend: number;
  trendLabel?: string;
  target?: number;
  achievement?: number;
  sparklineData?: Array<{ name: string; value: number }>;
  status?: 'success' | 'warning' | 'danger' | 'info';
  icon?: React.ReactNode;
  color?: string;
}

interface ModernKpiCardProps {
  kpi: KpiData;
  compact?: boolean;
  showSparkline?: boolean;
  showTarget?: boolean;
  onClick?: () => void;
}

const ModernKpiCard: React.FC<ModernKpiCardProps> = ({
  kpi,
  compact = false,
  showSparkline = true,
  showTarget = false,
  onClick
}) => {
  const {
    title,
    value,
    prefix = '',
    suffix = '',
    trend,
    trendLabel,
    target,
    achievement,
    sparklineData = [],
    status = 'info',
    icon,
    color = '#1890ff'
  } = kpi;

  const isPositive = trend >= 0;
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;
  const trendColor = isPositive ? '#52c41a' : '#ff4d4f';

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'success': return '#52c41a';
      case 'warning': return '#faad14';
      case 'danger': return '#ff4d4f';
      default: return '#1890ff';
    }
  };

  const cardColor = getStatusColor(status);

  const renderSparkline = () => {
    if (!showSparkline || sparklineData.length === 0) return null;
    
    return (
      <div className={styles.sparklineContainer}>
        <ResponsiveContainer width="100%" height={60}>
          <AreaChart data={sparklineData}>
            <defs>
              <linearGradient id={`gradient-${kpi.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={cardColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={cardColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis hide />
            <YAxis hide />
            <RechartsTooltip 
              contentStyle={{ 
                backgroundColor: '#fff', 
                border: 'none', 
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}
            />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke={cardColor} 
              strokeWidth={2}
              fill={`url(#gradient-${kpi.id})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const renderTargetProgress = () => {
    if (!showTarget || !target) return null;
    
    const progressValue = achievement || ((value / target) * 100);
    
    return (
      <div className={styles.targetSection}>
        <div className={styles.targetLabel}>
          <Target size={14} />
          <span>Target: {prefix}{target.toLocaleString()}{suffix}</span>
        </div>
        <Progress 
          percent={Math.min(progressValue, 100)} 
          strokeColor={progressValue >= 100 ? '#52c41a' : cardColor}
          size="small"
          showInfo={false}
        />
        <div className={styles.achievementText}>
          {progressValue.toFixed(1)}% achieved
        </div>
      </div>
    );
  };

  return (
    <Card 
      className={`${styles.kpiCard} ${compact ? styles.compact : ''}`}
      onClick={onClick}
      hoverable={!!onClick}
      bordered={false}
    >
      <Row gutter={16} align="middle">
        <Col flex="auto">
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>
              {icon && <span className={styles.iconWrapper}>{icon}</span>}
              <span>{title}</span>
            </div>
            <Tooltip title={trendLabel || `vs last period`}>
              <Tag 
                color={trendColor} 
                className={styles.trendTag}
                icon={isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              >
                {isPositive ? '+' : ''}{trend.toFixed(1)}%
              </Tag>
            </Tooltip>
          </div>
          
          <div className={styles.cardValue}>
            <Statistic
              value={value}
              prefix={prefix}
              suffix={suffix}
              valueStyle={{ 
                fontSize: compact ? 24 : 32, 
                fontWeight: 700,
                color: cardColor,
                margin: 0
              }}
              formatter={(val) => val.toLocaleString()}
            />
          </div>

          {renderSparkline()}
          {renderTargetProgress()}
        </Col>
      </Row>
    </Card>
  );
};

export default ModernKpiCard;
export type { KpiData, ModernKpiCardProps };
