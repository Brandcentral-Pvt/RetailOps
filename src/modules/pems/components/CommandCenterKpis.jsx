import React from 'react';
import { Typography, Tooltip } from 'antd';
import {
  ArrowUpOutlined, ArrowDownOutlined, MinusOutlined,
  ThunderboltOutlined, EyeOutlined, ClockCircleOutlined,
  WarningOutlined, CheckCircleOutlined, SafetyCertificateOutlined,
  BarChartOutlined, TrophyOutlined
} from '@ant-design/icons';

const { Text } = Typography;

function MiniTrend({ value, label }) {
  if (value === undefined || value === null) return null;
  const isUp = value > 0;
  const isDown = value < 0;
  return (
    <span style={{
      fontSize: 11, fontWeight: 600,
      color: isUp ? '#16A34A' : isDown ? '#DC2626' : '#94A3B8',
      display: 'inline-flex', alignItems: 'center', gap: 2,
    }}>
      {isUp ? <ArrowUpOutlined style={{ fontSize: 10 }} /> : isDown ? <ArrowDownOutlined style={{ fontSize: 10 }} /> : <MinusOutlined style={{ fontSize: 10 }} />}
      {Math.abs(value).toFixed(0)}%
      {label && <span style={{ color: '#94A3B8', fontWeight: 400 }}> {label}</span>}
    </span>
  );
}

function MiniSparkline({ data, color = '#2563EB', width = 56, height = 24 }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * height}`).join(' ');
  const fillPoints = `0,${height} ${points} ${width},${height}`;
  return (
    <svg width={width} height={height} style={{ overflow: 'visible', flexShrink: 0 }}>
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polygon points={fillPoints} fill={`url(#grad-${color.replace('#', '')})`} />
    </svg>
  );
}

export function CommandCenterKpis({ kpi, risk, loading, onDrillDown }) {
  const cards = [
    { key: 'all_tasks', title: 'All Tasks', value: kpi.total || 0, color: '#0F172A', icon: <BarChartOutlined />, trend: 8, spark: [80, 85, 92, 88, 95, 100, kpi.total || 0] },
    { key: 'my_open', title: 'My Open', value: kpi.active || 0, color: '#2563EB', icon: <ThunderboltOutlined />, trend: 12, spark: [3, 5, 4, 6, 8, 5, kpi.active || 0] },
    { key: 'pending_review', title: 'Pending Review', value: kpi.pendingReview || 0, color: '#7C3AED', icon: <EyeOutlined />, trend: risk?.staleReviews > 0 ? -33 : null, spark: [2, 3, 1, 4, 2, 3, kpi.pendingReview || 0] },
    { key: 'due_today', title: 'Due Today', value: 0, color: '#F59E0B', icon: <ClockCircleOutlined />, trend: null },
    { key: 'overdue', title: 'Overdue', value: kpi.overdue || 0, color: '#DC2626', icon: <WarningOutlined />, trend: -8, spark: [5, 4, 3, 2, 1, 2, kpi.overdue || 0] },
    { key: 'completed', title: 'Completed', value: kpi.approved || 0, color: '#16A34A', icon: <CheckCircleOutlined />, trend: 15, spark: [10, 12, 14, 11, 16, 18, kpi.approved || 0] },
    { key: 'sla', title: 'SLA Compliance', value: `${kpi.slaCompliance || 100}%`, color: (kpi.slaCompliance || 100) >= 90 ? '#16A34A' : '#DC2626', icon: <SafetyCertificateOutlined />, trend: null },
    { key: 'dept_load', title: 'Dept Load', value: `${kpi.total || 0}`, color: '#0288D1', icon: <BarChartOutlined />, trend: null },
    { key: 'health', title: 'Health Score', value: `${kpi.completionRate || 0}%`, color: (kpi.completionRate || 0) >= 80 ? '#16A34A' : '#F59E0B', icon: <TrophyOutlined />, trend: 5 },
  ];

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)',
      gap: 16,
      marginBottom: 24,
    }}>
      {cards.map(card => (
        <Tooltip key={card.key} title={`Click to view ${card.title}`} placement="bottom">
          <div
            onClick={() => onDrillDown?.(card.key)}
            style={{
              padding: '16px 16px',
              borderRadius: 18,
              background: '#FFFFFF',
              border: '1px solid #E5E7EB',
              cursor: 'pointer',
              transition: 'all 0.12s ease',
              position: 'relative',
              overflow: 'hidden',
              height: 96,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = card.color + '30';
              e.currentTarget.style.boxShadow = `0 8px 24px ${card.color}12, 0 2px 4px ${card.color}08`;
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = '#E5E7EB';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
              e.currentTarget.style.transform = 'none';
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{
                  fontSize: 11, fontWeight: 600,
                  color: '#64748B',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: 4,
                }}>
                  <span style={{ marginRight: 6, opacity: 0.6 }}>{card.icon}</span>
                  {card.title}
                </div>
                <div style={{
                  fontSize: 34, fontWeight: 700,
                  color: '#0F172A',
                  lineHeight: 1.1,
                  letterSpacing: '-0.02em',
                }}>
                  {card.value}
                </div>
              </div>
              <MiniSparkline data={card.spark} color={card.color} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              {card.trend !== null && card.trend !== undefined && (
                <MiniTrend value={card.trend} label="vs yesterday" />
              )}
            </div>
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              height: 3,
              background: `linear-gradient(90deg, ${card.color}50, ${card.color}10)`,
            }} />
          </div>
        </Tooltip>
      ))}
    </div>
  );
}
