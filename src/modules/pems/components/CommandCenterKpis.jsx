import React from 'react';
import { Typography, Tooltip, Switch, Space } from 'antd';
import {
  ArrowUpOutlined, ArrowDownOutlined, MinusOutlined,
  ThunderboltOutlined, EyeOutlined, ClockCircleOutlined,
  WarningOutlined, CheckCircleOutlined, SafetyCertificateOutlined,
  BarChartOutlined, DollarOutlined, ShoppingCartOutlined,
  StarOutlined, FilterOutlined, AimOutlined
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
      {Math.abs(value).toFixed(1)}%
      {label && <span style={{ color: '#94A3B8', fontWeight: 400 }}> {label}</span>}
    </span>
  );
}

export function CommandCenterKpis({ kpi, risk, loading, onDrillDown, disputesOnly, onDisputesToggle }) {
  const successRate = kpi.slaCompliance != null && kpi.approved != null && kpi.total > 0
    ? Math.round((kpi.approved / kpi.total) * 100) : null;

  const retailCards = [
    {
      key: 'dispute_volume',
      title: 'Dispute Volume',
      value: kpi.autoTasks ?? kpi.activeDisputes ?? 0,
      subtitle: 'System-auto detected issues',
      color: '#0891B2',
      icon: <ThunderboltOutlined />,
      trend: kpi.disputeTrend,
    },
    {
      key: 'success_rate',
      title: 'Action Success Rate',
      value: successRate != null ? `${successRate}%` : '—',
      subtitle: 'Tasks approved vs total',
      color: successRate >= 80 ? '#16A34A' : '#EA580C',
      icon: <AimOutlined />,
      trend: kpi.successTrend,
    },
    {
      key: 'pricing_health',
      title: 'Pricing Health',
      value: kpi.pricingMismatches ?? '—',
      subtitle: 'ASP/SP Mismatches',
      color: '#0891B2',
      icon: <DollarOutlined />,
      trend: kpi.pricingTrend,
    },
    {
      key: 'buybox',
      title: 'BuyBox Integrity',
      value: kpi.buyBoxPct != null ? `${kpi.buyBoxPct}%` : '—',
      subtitle: 'Listings holding BuyBox',
      color: '#7C3AED',
      icon: <ShoppingCartOutlined />,
      trend: kpi.buyBoxTrend,
    },
    {
      key: 'catalog_quality',
      title: 'Catalog Quality',
      value: kpi.avgHealth != null ? `${kpi.avgHealth.toFixed(1)}` : '—',
      subtitle: 'Avg AI Health Score',
      color: '#2563EB',
      icon: <StarOutlined />,
      trend: kpi.qualityTrend,
    },
    {
      key: 'pending_review',
      title: 'Pending Review',
      value: kpi.pendingReview || 0,
      subtitle: 'Awaiting supervisor',
      color: '#EA580C',
      icon: <EyeOutlined />,
      trend: risk?.staleReviews > 0 ? -33 : null,
    },
    {
      key: 'sla',
      title: 'SLA Compliance',
      value: `${kpi.slaCompliance ?? 100}%`,
      subtitle: 'Within SLA window',
      color: (kpi.slaCompliance ?? 100) >= 90 ? '#16A34A' : '#DC2626',
      icon: <SafetyCertificateOutlined />,
    },
    {
      key: 'overdue',
      title: 'Overdue',
      value: kpi.overdue || 0,
      subtitle: 'Past SLA deadline',
      color: '#DC2626',
      icon: <ClockCircleOutlined />,
      trend: kpi.overdueTrend,
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', letterSpacing: '0.02em' }}>
          Universal Operational Health
        </Text>
        <Space size={8}>
          <FilterOutlined style={{ color: '#64748B', fontSize: 13 }} />
          <Text style={{ fontSize: 11, color: '#64748B' }}>Disputes Only</Text>
          <Switch size="small" checked={disputesOnly} onChange={onDisputesToggle} style={{ background: disputesOnly ? '#DC2626' : '#CBD5E1' }} />
        </Space>
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)',
        gap: 12,
      }}>
        {retailCards.map(card => (
          <Tooltip key={card.key} title={card.subtitle} placement="bottom">
            <div
              onClick={() => onDrillDown?.(card.key)}
              style={{
                padding: '12px 14px',
                borderRadius: 14,
                background: '#FFFFFF',
                border: '1px solid #E5E7EB',
                cursor: 'pointer',
                transition: 'all 0.12s ease',
                position: 'relative',
                overflow: 'hidden',
                height: 82,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = card.color + '30';
                e.currentTarget.style.boxShadow = `0 4px 12px ${card.color}12`;
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#E5E7EB';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <div>
                <div style={{
                  fontSize: 9, fontWeight: 600,
                  color: '#64748B',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginBottom: 2,
                }}>
                  <span style={{ marginRight: 4, opacity: 0.6, fontSize: 10 }}>{card.icon}</span>
                  {card.title}
                </div>
                <div style={{
                  fontSize: 28, fontWeight: 700,
                  color: card.color,
                  lineHeight: 1.1,
                  letterSpacing: '-0.02em',
                }}>
                  {card.value}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                {card.trend != null && <MiniTrend value={card.trend} />}
                <Text style={{ fontSize: 9, color: '#94A3B8' }}>{card.subtitle}</Text>
              </div>
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                height: 2,
                background: `linear-gradient(90deg, ${card.color}60, ${card.color}10)`,
              }} />
            </div>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}
