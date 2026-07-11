import React, { useMemo } from 'react';
import { Card, Typography, Tag, Button, Progress } from 'antd';
import { 
  Lightbulb, TrendingUp, TrendingDown, AlertTriangle, 
  CheckCircle, ArrowRight, Zap, Target
} from 'lucide-react';

const { Text } = Typography;

const InsightItem = ({ type, title, description, metric, value, color, onAction }) => {
  const typeConfig = {
    opportunity: { icon: Lightbulb, bg: '#ecfdf5', border: '#a7f3d0', color: '#2E7D32' },
    warning: { icon: AlertTriangle, bg: '#fffbeb', border: '#fed7aa', color: '#ED6C02' },
    critical: { icon: AlertTriangle, bg: '#fef2f2', border: '#fecaca', color: '#C62828' },
    success: { icon: CheckCircle, bg: '#ecfdf5', border: '#a7f3d0', color: '#2E7D32' },
    ai: { icon: Zap, bg: '#f3e8ff', border: '#e9d5ff', color: '#9C27B0' },
  };

  const config = typeConfig[type] || typeConfig.info;
  const Icon = config.icon;

  return (
    <div style={{
      padding: '10px 12px',
      background: config.bg,
      border: `1px solid ${config.border}`,
      borderRadius: 8,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      cursor: onAction ? 'pointer' : 'default',
      transition: 'all 0.2s'
    }}
    onMouseEnter={e => { if (onAction) e.currentTarget.style.transform = 'translateY(-1px)'; }}
    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
    onClick={onAction}
    >
      <div style={{ width: 28, height: 28, borderRadius: 7, background: `${config.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={14} color={config.color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 12, fontWeight: 600, color: '#18181b', display: 'block', marginBottom: 2 }}>{title}</Text>
        <Text style={{ fontSize: 11, color: '#71717a', display: 'block' }}>{description}</Text>
      </div>
      {metric && (
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <Text style={{ fontSize: 14, fontWeight: 700, color: config.color }}>{metric}</Text>
          {value && <Text style={{ fontSize: 9, color: '#71717a', display: 'block' }}>{value}</Text>}
        </div>
      )}
    </div>
  );
};

const InsightPanel = ({ data = [] }) => {
  const insights = useMemo(() => {
    if (data.length === 0) return [];

    const sum = { spend: 0, sales: 0, orders: 0, acos: 0 };
    data.forEach(d => {
      sum.spend += Number(d.spend || 0);
      sum.sales += Number(d.sales || 0);
      sum.orders += Number(d.orders || 0);
    });
    sum.acos = sum.sales > 0 ? (sum.spend / sum.sales) * 100 : 0;

    const result = [];

    // ACOS Analysis
    if (sum.acos > 30) {
      result.push({
        type: 'warning',
        title: 'High ACOS Detected',
        description: `Current ACOS is ${sum.acos.toFixed(1)}% — above the 30% threshold`,
        metric: `${sum.acos.toFixed(1)}%`,
        value: 'Target: <25%'
      });
    } else if (sum.acos < 20) {
      result.push({
        type: 'success',
        title: 'Excellent ACOS',
        description: `ACOS at ${sum.acos.toFixed(1)}% is well below target`,
        metric: `${sum.acos.toFixed(1)}%`,
        value: 'Target: <25%'
      });
    }

    // Top Performers
    const topSpend = [...data].sort((a, b) => Number(b.spend || 0) - Number(a.spend || 0))[0];
    if (topSpend) {
      result.push({
        type: 'ai',
        title: 'Top Spending ASIN',
        description: `${topSpend.asin} accounts for highest ad spend`,
        metric: `₹${Number(topSpend.spend || 0).toLocaleString('en-IN')}`,
        value: topSpend.title?.substring(0, 30) + '...'
      });
    }

    // Low Performers
    const lowPerformers = data.filter(d => {
      const spend = Number(d.spend || 0);
      const sales = Number(d.sales || 0);
      return spend > 1000 && sales < 100;
    });
    if (lowPerformers.length > 0) {
      result.push({
        type: 'critical',
        title: 'Budget Waste Detected',
        description: `${lowPerformers.length} products spending heavily with minimal sales`,
        metric: `${lowPerformers.length} ASINs`,
        value: 'Consider pausing or reducing bids'
      });
    }

    // Organic Growth
    const organicData = data.filter(d => Number(d.organicSales || 0) > Number(d.sales || 0));
    if (organicData.length > 0) {
      result.push({
        type: 'success',
        title: 'Strong Organic Performance',
        description: `${organicData.length} products have organic sales exceeding ad sales`,
        metric: `${organicData.length} products`,
        value: 'Organic ranking is healthy'
      });
    }

    // AI Recommendations
    result.push({
      type: 'ai',
      title: 'AI Recommendation',
      description: 'Reduce bids for low-CTR campaigns and increase budget for high-ROAS products',
      metric: 'Optimize',
      value: 'Save up to 15% ad spend'
    });

    return result.slice(0, 6);
  }, [data]);

  if (insights.length === 0) return null;

  return (
    <Card 
      size="small" 
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: '#f3e8ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Lightbulb size={12} color="#9C27B0" />
          </div>
          <Text strong style={{ fontSize: 13 }}>Executive Insights</Text>
          <Tag style={{ fontSize: 9, borderRadius: 4, background: '#f3e8ff', color: '#9C27B0', border: 'none' }}>AI Powered</Tag>
        </div>
      }
      style={{ marginBottom: 16, borderRadius: 10 }}
      styles={{ body: { padding: '8px 12px' } }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 8 }}>
        {insights.map((insight, i) => (
          <InsightItem key={i} {...insight} />
        ))}
      </div>
    </Card>
  );
};

export default InsightPanel;
