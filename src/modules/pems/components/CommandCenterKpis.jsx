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

const TONE = {
  success: '#16A34A',
  danger: '#DC2626',
  warning: '#EA580C',
  neutral: '#94A3B8',
};

function MiniTrend({ value, label }) {
  if (value === undefined || value === null) return null;
  const isUp = value > 0;
  const isDown = value < 0;
  return (
    <span style={{
      fontSize: 'var(--bc-text-xs)',
      fontWeight: 'var(--bc-weight-semibold)',
      color: isUp ? TONE.success : isDown ? TONE.danger : TONE.neutral,
      display: 'inline-flex', alignItems: 'center', gap: 2,
    }}>
      {isUp ? <ArrowUpOutlined style={{ fontSize: 10 }} /> : isDown ? <ArrowDownOutlined style={{ fontSize: 10 }} /> : <MinusOutlined style={{ fontSize: 10 }} />}
      {Math.abs(value).toFixed(1)}%
      {label && <span style={{ color: 'var(--bc-text-muted)', fontWeight: 'var(--bc-weight-regular)' }}> {label}</span>}
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
      color: successRate >= 80 ? TONE.success : TONE.warning,
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
      color: TONE.warning,
      icon: <EyeOutlined />,
      trend: risk?.staleReviews > 0 ? -33 : null,
    },
    {
      key: 'sla',
      title: 'SLA Compliance',
      value: `${kpi.slaCompliance ?? 100}%`,
      subtitle: 'Within SLA window',
      color: (kpi.slaCompliance ?? 100) >= 90 ? TONE.success : TONE.danger,
      icon: <SafetyCertificateOutlined />,
    },
    {
      key: 'overdue',
      title: 'Overdue',
      value: kpi.overdue || 0,
      subtitle: 'Past SLA deadline',
      color: TONE.danger,
      icon: <ClockCircleOutlined />,
      trend: kpi.overdueTrend,
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ fontSize: 'var(--bc-text-base)', fontWeight: 'var(--bc-weight-bold)', color: 'var(--bc-text-heading)', letterSpacing: '0.01em' }}>
          Universal Operational Health
        </Text>
        <Space size={8}>
          <FilterOutlined style={{ color: 'var(--bc-text-secondary)', fontSize: 13 }} />
          <Text style={{ fontSize: 'var(--bc-text-xs)', color: 'var(--bc-text-secondary)' }}>Disputes Only</Text>
          <Switch size="small" checked={disputesOnly} onChange={onDisputesToggle} style={{ background: disputesOnly ? TONE.danger : 'var(--bc-border-strong)' }} />
        </Space>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: 12,
      }}>
        {retailCards.map(card => (
          <Tooltip key={card.key} title={card.subtitle} placement="bottom">
            <div
              onClick={() => onDrillDown?.(card.key)}
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--bc-radius-xl)',
                background: 'var(--bc-surface-card)',
                border: '1px solid var(--bc-border-default)',
                cursor: 'pointer',
                transition: 'all 0.12s ease',
                position: 'relative',
                overflow: 'hidden',
                height: 84,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minWidth: 0,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = card.color + '40';
                e.currentTarget.style.boxShadow = `0 4px 12px ${card.color}14`;
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--bc-border-default)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <div>
                <div style={{
                  fontSize: 'var(--bc-text-xs)',
                  fontWeight: 'var(--bc-weight-semibold)',
                  color: 'var(--bc-text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginBottom: 2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  <span style={{ marginRight: 4, opacity: 0.6, fontSize: 10 }}>{card.icon}</span>
                  {card.title}
                </div>
                <div style={{
                  fontSize: 'var(--bc-text-2xl)',
                  fontWeight: 'var(--bc-weight-bold)',
                  color: card.color,
                  lineHeight: 1.1,
                  letterSpacing: '-0.02em',
                }}>
                  {card.value}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                {card.trend != null && <MiniTrend value={card.trend} />}
                <Text style={{ fontSize: 'var(--bc-text-xs)', color: 'var(--bc-text-muted)' }}>{card.subtitle}</Text>
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
