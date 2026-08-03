/* ═══════════════════════════════════════════════════════════════════════════
   CommandCenterKpis — v2
   Redesigned KPI strip for the Task Execution Center.
   Same props API as v1: { kpi, risk, loading, onDrillDown, disputesOnly, onDisputesToggle }
   Expected location: src/modules/pems/components/CommandCenterKpis.jsx
   ═══════════════════════════════════════════════════════════════════════════ */
import React from 'react';
import { Typography, Tooltip, Switch, Space } from 'antd';
import {
  ArrowUpOutlined, ArrowDownOutlined, MinusOutlined,
  ThunderboltOutlined, EyeOutlined, ClockCircleOutlined,
  SafetyCertificateOutlined, DollarOutlined, ShoppingCartOutlined,
  StarOutlined, AimOutlined, FilterOutlined
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
<<<<<<< HEAD
      fontSize: 'var(--bc-text-xs)',
      fontWeight: 'var(--bc-weight-semibold)',
      color: isUp ? TONE.success : isDown ? TONE.danger : TONE.neutral,
      display: 'inline-flex', alignItems: 'center', gap: 2,
    }}>
      {isUp ? <ArrowUpOutlined style={{ fontSize: 10 }} /> : isDown ? <ArrowDownOutlined style={{ fontSize: 10 }} /> : <MinusOutlined style={{ fontSize: 10 }} />}
      {Math.abs(value).toFixed(1)}%
      {label && <span style={{ color: 'var(--bc-text-muted)', fontWeight: 'var(--bc-weight-regular)' }}> {label}</span>}
=======
      fontSize: 11, fontWeight: 600,
      color: isUp ? 'var(--bc-green-600, #16a34a)' : isDown ? 'var(--bc-red-600, #dc2626)' : 'var(--bc-text-muted, #94a3b8)',
      display: 'inline-flex', alignItems: 'center', gap: 2, whiteSpace: 'nowrap',
    }}>
      {isUp ? <ArrowUpOutlined style={{ fontSize: 10 }} /> : isDown ? <ArrowDownOutlined style={{ fontSize: 10 }} /> : <MinusOutlined style={{ fontSize: 10 }} />}
      {Math.abs(value).toFixed(1)}%
      {label && <span style={{ color: 'var(--bc-text-muted, #94a3b8)', fontWeight: 400 }}> {label}</span>}
>>>>>>> 6957627aacacd9b2675c14e8ed4b5cb398e08c77
    </span>
  );
}

function KpiCard({ card }) {
  return (
    <Tooltip key={card.key} title={card.subtitle} placement="bottom">
      <div className="pems-kpi-card" onClick={() => card.onClick?.()}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div className="pems-section-label" style={{ marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {card.title}
            </div>
            <div style={{
              fontSize: 25, fontWeight: 800, color: card.color,
              lineHeight: 1.15, letterSpacing: '-0.02em',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {card.value}
            </div>
          </div>
          <div style={{
            width: 34, height: 34, borderRadius: 'var(--bc-radius-lg, 8px)',
            background: `${card.color}1A`, color: card.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, flexShrink: 0,
          }}>
            {card.icon}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, minHeight: 16 }}>
          {card.trend != null
            ? <MiniTrend value={card.trend} />
            : <Text style={{ fontSize: 10, color: 'var(--bc-text-muted, #94a3b8)' }}>{card.subtitle}</Text>}
        </div>
        <div className="pems-kpi-accent" style={{ background: `linear-gradient(90deg, ${card.color}B3, ${card.color}14)` }} />
      </div>
    </Tooltip>
  );
}

export function CommandCenterKpis({ kpi, risk, loading, onDrillDown, disputesOnly, onDisputesToggle, title = 'Operational Overview', lastUpdated }) {
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
<<<<<<< HEAD
      color: successRate >= 80 ? TONE.success : TONE.warning,
=======
      color: successRate >= 80 ? 'var(--bc-green-600, #16a34a)' : '#EA580C',
>>>>>>> 6957627aacacd9b2675c14e8ed4b5cb398e08c77
      icon: <AimOutlined />,
      trend: kpi.successTrend,
    },
    {
      key: 'pricing_health',
      title: 'Pricing Health',
      value: kpi.pricingMismatches ?? '—',
      subtitle: 'ASP/SP mismatches',
      color: '#0891B2',
      icon: <DollarOutlined />,
      trend: kpi.pricingTrend,
    },
    {
      key: 'buybox',
      title: 'BuyBox Integrity',
      value: kpi.buyBoxPct != null ? `${kpi.buyBoxPct}%` : '—',
      subtitle: 'Listings holding BuyBox',
      color: 'var(--bc-violet-600, #7c3aed)',
      icon: <ShoppingCartOutlined />,
      trend: kpi.buyBoxTrend,
    },
    {
      key: 'catalog_quality',
      title: 'Catalog Quality',
      value: kpi.avgHealth != null ? Number(kpi.avgHealth).toFixed(1) : '—',
      subtitle: 'Avg AI Health Score',
      color: 'var(--bc-ro-500, #1976D2)',
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
<<<<<<< HEAD
      color: (kpi.slaCompliance ?? 100) >= 90 ? TONE.success : TONE.danger,
=======
      color: (kpi.slaCompliance ?? 100) >= 90 ? 'var(--bc-green-600, #16a34a)' : 'var(--bc-red-600, #dc2626)',
>>>>>>> 6957627aacacd9b2675c14e8ed4b5cb398e08c77
      icon: <SafetyCertificateOutlined />,
    },
    {
      key: 'overdue',
      title: 'Overdue',
      value: kpi.overdue || 0,
      subtitle: 'Past SLA deadline',
<<<<<<< HEAD
      color: TONE.danger,
=======
      color: 'var(--bc-red-600, #dc2626)',
>>>>>>> 6957627aacacd9b2675c14e8ed4b5cb398e08c77
      icon: <ClockCircleOutlined />,
      trend: kpi.overdueTrend,
    },
  ].map(card => ({ ...card, onClick: () => onDrillDown?.(card.key) }));

  return (
    <div>
<<<<<<< HEAD
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
=======
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
        <Space size={8} align="center">
          <span className="pems-live-dot" />
          <Text style={{ fontSize: 13, fontWeight: 700, color: 'var(--bc-text-heading, #0f172a)', letterSpacing: '0.02em' }}>
            {title}
          </Text>
          {lastUpdated && (
            <Text style={{ fontSize: 11, color: 'var(--bc-text-muted, #94a3b8)' }}>
              · synced {lastUpdated}
            </Text>
          )}
        </Space>
        <Space size={10} align="center">
          <FilterOutlined style={{ color: disputesOnly ? 'var(--bc-red-500, #ef4444)' : 'var(--bc-text-muted, #94a3b8)', fontSize: 12, transition: 'color 0.15s' }} />
          <Text style={{ fontSize: 11, fontWeight: disputesOnly ? 700 : 500, color: disputesOnly ? 'var(--bc-red-600, #dc2626)' : 'var(--bc-text-secondary, #64748b)' }}>
            Disputes only
          </Text>
          <Switch
            size="small"
            checked={disputesOnly}
            onChange={onDisputesToggle}
            loading={loading}
            style={{ background: disputesOnly ? 'var(--bc-red-500, #ef4444)' : 'var(--bc-slate-300, #cbd5e1)' }}
          />
        </Space>
      </div>
      <div className="pems-kpi-grid">
        {retailCards.map(card => <KpiCard key={card.key} card={card} />)}
>>>>>>> 6957627aacacd9b2675c14e8ed4b5cb398e08c77
      </div>
    </div>
  );
}
