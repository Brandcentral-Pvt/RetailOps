import React, { useMemo } from 'react';
import { Card, Typography, Tooltip, Tag } from 'antd';
import { 
  TrendingUp, TrendingDown, Minus, Target, 
  ArrowUpRight, ArrowDownRight 
} from 'lucide-react';

const { Text } = Typography;

const MiniSparkline = ({ data, color, height = 24 }) => {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data) || 1;
  const min = Math.min(...data) || 0;
  const range = max - min || 1;
  
  return (
    <svg width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`M 0 ${height - ((data[0] - min) / range) * (height - 4) + 2} ${data.map((v, i) => `L ${(i / (data.length - 1)) * 100} ${height - ((v - min) / range) * (height - 4) + 2}`).join(' ')} L 100 ${height} L 0 ${height} Z`}
        fill={`url(#grad-${color.replace('#', '')})`}
      />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        points={data.map((v, i) => `${(i / (data.length - 1)) * 100},${height - ((v - min) / range) * (height - 4) + 2}`).join(' ')}
      />
    </svg>
  );
};

const KPICard = ({ 
  label, 
  value, 
  prevValue, 
  target, 
  color, 
  format = 'number',
  sparkData,
  icon: Icon,
  isInverted = false
}) => {
  const change = prevValue ? ((value - prevValue) / (prevValue || 1)) * 100 : 0;
  const isGood = isInverted ? change < 0 : change > 0;
  const targetProgress = target ? Math.min((value / target) * 100, 100) : null;

  const formatValue = (val) => {
    if (format === 'currency') return `₹${(val / 1000).toFixed(1)}K`;
    if (format === 'percent') return `${val.toFixed(1)}%`;
    if (format === 'ratio') return val.toFixed(2);
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
    return val.toFixed(0);
  };

  return (
    <Tooltip title={`${label}: ${formatValue(value)}${target ? ` (Target: ${formatValue(target)})` : ''}`}>
      <div style={{
        padding: '12px 14px',
        background: '#fff',
        borderRadius: 10,
        border: '1px solid #e4e4e7',
        minWidth: 160,
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.2s',
        cursor: 'default'
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.boxShadow = `0 4px 12px ${color}15`; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#e4e4e7'; e.currentTarget.style.boxShadow = 'none'; }}
      >
        {sparkData && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 30, opacity: 0.5 }}>
            <MiniSparkline data={sparkData} color={color} height={30} />
          </div>
        )}
        
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {label}
            </Text>
            {Icon && <Icon size={14} color={color} />}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <Text style={{ fontSize: 22, fontWeight: 600, color: '#18181b' }}>
              {formatValue(value)}
            </Text>
            {change !== 0 && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 2,
                fontSize: 10, 
                fontWeight: 600,
                color: isGood ? '#2E7D32' : '#C62828',
                padding: '2px 6px',
                borderRadius: "var(--radius-sm)",
                background: isGood ? '#ecfdf5' : '#fef2f2'
              }}>
                {isGood ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                {Math.abs(change).toFixed(1)}%
              </div>
            )}
          </div>

          {targetProgress !== null && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <Text style={{ fontSize: 9, color: '#71717a' }}>Target</Text>
                <Text style={{ fontSize: 9, fontWeight: 600, color: targetProgress >= 80 ? '#2E7D32' : '#ED6C02' }}>
                  {targetProgress.toFixed(0)}%
                </Text>
              </div>
              <div style={{ height: 4, background: '#f4f4f5', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ 
                  width: `${targetProgress}%`, 
                  height: '100%', 
                  background: targetProgress >= 80 ? '#2E7D32' : targetProgress >= 50 ? '#ED6C02' : '#C62828',
                  borderRadius: 2,
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </Tooltip>
  );
};

const ExecutiveKPIs = ({ data = [] }) => {
  const kpis = useMemo(() => {
    const sum = { spend: 0, sales: 0, orders: 0, impressions: 0, clicks: 0, organicSales: 0 };
    data.forEach(d => {
      sum.spend += Number(d.spend || 0);
      sum.sales += Number(d.sales || 0);
      sum.orders += Number(d.orders || 0);
      sum.impressions += Number(d.impressions || 0);
      sum.clicks += Number(d.clicks || 0);
      sum.organicSales += Number(d.organicSales || 0);
    });
    
    return {
      spend: sum.spend,
      sales: sum.sales,
      acos: sum.sales > 0 ? (sum.spend / sum.sales) * 100 : 0,
      roas: sum.spend > 0 ? sum.sales / sum.spend : 0,
      orders: sum.orders,
      impressions: sum.impressions,
      clicks: sum.clicks,
      ctr: sum.impressions > 0 ? (sum.clicks / sum.impressions) * 100 : 0,
      cvr: sum.clicks > 0 ? (sum.orders / sum.clicks) * 100 : 0,
      organicSales: sum.organicSales,
      totalSales: sum.sales + sum.organicSales,
    };
  }, [data]);

  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', 
      gap: 12,
      marginBottom: 16
    }}>
      <KPICard label="Ad Spend" value={kpis.spend} format="currency" color="#D32F2F" 
        sparkData={data.slice(-7).map(d => Number(d.spend || 0))} />
      <KPICard label="Ad Sales" value={kpis.sales} format="currency" color="#2E7D32" 
        sparkData={data.slice(-7).map(d => Number(d.sales || 0))} />
      <KPICard label="ACOS" value={kpis.acos} format="percent" color="#C62828" isInverted={true}
        target={25} sparkData={data.slice(-7).map(d => { const s = Number(d.sales || 0); return s > 0 ? (Number(d.spend || 0) / s) * 100 : 0; })} />
      <KPICard label="ROAS" value={kpis.roas} format="ratio" color="#E65100"
        target={3} sparkData={data.slice(-7).map(d => { const s = Number(d.spend || 0); return s > 0 ? Number(d.sales || 0) / s : 0; })} />
      <KPICard label="Orders" value={kpis.orders} format="number" color="#9333ea"
        sparkData={data.slice(-7).map(d => Number(d.orders || 0))} />
      <KPICard label="CTR" value={kpis.ctr} format="percent" color="#0d9488"
        sparkData={data.slice(-7).map(d => { const i = Number(d.impressions || 0); return i > 0 ? (Number(d.clicks || 0) / i) * 100 : 0; })} />
      <KPICard label="CVR" value={kpis.cvr} format="percent" color="#1976D2"
        sparkData={data.slice(-7).map(d => { const c = Number(d.clicks || 0); return c > 0 ? (Number(d.orders || 0) / c) * 100 : 0; })} />
      <KPICard label="Organic Sales" value={kpis.organicSales} format="currency" color="#2E7D32"
        sparkData={data.slice(-7).map(d => Number(d.organicSales || 0))} />
    </div>
  );
};

export default ExecutiveKPIs;
