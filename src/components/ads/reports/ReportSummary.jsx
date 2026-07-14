import React, { useMemo } from 'react';
import { Card, Typography, Tag } from 'antd';
import { 
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Minus 
} from 'lucide-react';

const { Text } = Typography;

const ReportMetricCard = ({ 
  label, 
  current, 
  previous, 
  format = 'number',
  color,
  icon: Icon
}) => {
  const change = previous ? ((current - previous) / (previous || 1)) * 100 : 0;
  const isGood = change > 0;
  const isStable = Math.abs(change) < 1;

  const formatValue = (val) => {
    if (format === 'currency') return `₹${(val / 1000).toFixed(1)}K`;
    if (format === 'percent') return `${val.toFixed(1)}%`;
    if (format === 'ratio') return val.toFixed(2);
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
    return val.toFixed(0);
  };

  return (
    <div style={{
      padding: '14px 16px',
      background: '#fff',
      borderRadius: 10,
      border: '1px solid #e4e4e7',
      minWidth: 150
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: '#71717a', textTransform: 'uppercase' }}>{label}</Text>
        {Icon && <Icon size={14} color={color || '#71717a'} />}
      </div>
      <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 600, color: '#18181b', marginBottom: 4 }}>
        {formatValue(current)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {isStable ? (
          <Tag style={{ fontSize: 9, borderRadius: "var(--radius-sm)", background: '#f4f4f5', color: '#71717a', border: 'none' }}>
            <Minus size={10} /> Stable
          </Tag>
        ) : (
          <Tag style={{ 
            fontSize: 9, 
            borderRadius: "var(--radius-sm)", 
            background: isGood ? '#ecfdf5' : '#fef2f2', 
            color: isGood ? '#2E7D32' : '#C62828',
            border: 'none'
          }}>
            {isGood ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
            {Math.abs(change).toFixed(1)}%
          </Tag>
        )}
        <Text style={{ fontSize: 10, color: '#a1a1aa' }}>vs previous</Text>
      </div>
    </div>
  );
};

const ReportSummary = ({ data = [], previousData = [] }) => {
  const current = useMemo(() => {
    const sum = { spend: 0, sales: 0, orders: 0, impressions: 0, clicks: 0 };
    data.forEach(d => {
      sum.spend += Number(d.spend || 0);
      sum.sales += Number(d.sales || 0);
      sum.orders += Number(d.orders || 0);
      sum.impressions += Number(d.impressions || 0);
      sum.clicks += Number(d.clicks || 0);
    });
    sum.acos = sum.sales > 0 ? (sum.spend / sum.sales) * 100 : 0;
    sum.roas = sum.spend > 0 ? sum.sales / sum.spend : 0;
    sum.ctr = sum.impressions > 0 ? (sum.clicks / sum.impressions) * 100 : 0;
    return sum;
  }, [data]);

  const prev = useMemo(() => {
    const sum = { spend: 0, sales: 0, orders: 0, impressions: 0, clicks: 0 };
    previousData.forEach(d => {
      sum.spend += Number(d.spend || 0);
      sum.sales += Number(d.sales || 0);
      sum.orders += Number(d.orders || 0);
      sum.impressions += Number(d.impressions || 0);
      sum.clicks += Number(d.clicks || 0);
    });
    sum.acos = sum.sales > 0 ? (sum.spend / sum.sales) * 100 : 0;
    sum.roas = sum.spend > 0 ? sum.sales / sum.spend : 0;
    sum.ctr = sum.impressions > 0 ? (sum.clicks / sum.impressions) * 100 : 0;
    return sum;
  }, [previousData]);

  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', 
      gap: 12,
      marginBottom: 16
    }}>
      <ReportMetricCard label="Total Spend" current={current.spend} previous={prev.spend} format="currency" color="#D32F2F" />
      <ReportMetricCard label="Total Sales" current={current.sales} previous={prev.sales} format="currency" color="#2E7D32" />
      <ReportMetricCard label="ACOS" current={current.acos} previous={prev.acos} format="percent" color="#C62828" />
      <ReportMetricCard label="ROAS" current={current.roas} previous={prev.roas} format="ratio" color="#E65100" />
      <ReportMetricCard label="Orders" current={current.orders} previous={prev.orders} format="number" color="#9333ea" />
      <ReportMetricCard label="CTR" current={current.ctr} previous={prev.ctr} format="percent" color="#0d9488" />
    </div>
  );
};

export default ReportSummary;
