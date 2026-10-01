/* ═══════════════════════════════════════════════════════════════════════════
   CommandCenterKpis — v2
   Redesigned KPI strip for the Task Execution Center.
   Same props API as v1: { kpi, risk, loading, onDrillDown, disputesOnly, onDisputesToggle }
   Expected location: src/modules/tasks/components/CommandCenterKpis.jsx
   ═══════════════════════════════════════════════════════════════════════════ */
import React from 'react';
import { Tooltip, Switch } from 'antd';
import {
  ArrowUpOutlined, ArrowDownOutlined, MinusOutlined,
  ThunderboltOutlined, EyeOutlined, ClockCircleOutlined,
  SafetyCertificateOutlined, DollarOutlined, ShoppingCartOutlined,
  StarOutlined, AimOutlined, FilterOutlined
} from '@ant-design/icons';


function MiniTrend({ value, label }) {
  if (value === undefined || value === null) return null;
  const isUp = value > 0;
  const isDown = value < 0;
  const dir = isUp ? 'good' : isDown ? 'bad' : 'flat';
  return (
    <span className={`tasks-kpi-trend tasks-kpi-trend--${dir}`}>
      {isUp ? <ArrowUpOutlined /> : isDown ? <ArrowDownOutlined /> : <MinusOutlined />}
      {Math.abs(value).toFixed(1)}%
      {label && <span style={{ color: 'var(--tec-text-4, #94a3b8)', fontWeight: 400 }}> {label}</span>}
    </span>
  );
}

function KpiCard({ card }) {
  // Tone drives only the 2px top rule, the icon, and the value colour — the
  // card surface stays neutral so eight cards do not read as eight alerts.
  const tone = card.color || 'var(--tec-text, #0f172a)';
  return (
    <Tooltip key={card.key} title={card.subtitle} placement="bottom" mouseEnterDelay={0.4}>
      <button
        type="button"
        className="tasks-kpi-card"
        onClick={() => card.onClick?.()}
        aria-label={`${card.title}: ${card.value}. ${card.subtitle || ''}`}
      >
        <div className="tasks-kpi-card__label">{card.title}</div>
        <div className="tasks-kpi-card__row">
          <span className="tasks-kpi-card__value">{card.value}</span>
          <span className="tasks-kpi-card__icon" style={{ color: tone }}>{card.icon}</span>
        </div>
        <div className="tasks-kpi-card__row" style={{ minHeight: 16 }}>
          {card.trend != null
            ? <MiniTrend value={card.trend} />
            : <span className="tasks-kpi-card__context">{card.subtitle}</span>}
        </div>
        <span className="tasks-kpi-accent" style={{ background: tone }} />
      </button>
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
      color: successRate >= 80 ? 'var(--bc-green-600, #16a34a)' : '#EA580C',
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
      color: '#EA580C',
      icon: <EyeOutlined />,
      trend: risk?.staleReviews > 0 ? -33 : null,
    },
    {
      key: 'sla',
      title: 'SLA Compliance',
      value: `${kpi.slaCompliance ?? 100}%`,
      subtitle: 'Within SLA window',
      color: (kpi.slaCompliance ?? 100) >= 90 ? 'var(--bc-green-600, #16a34a)' : 'var(--bc-red-600, #dc2626)',
      icon: <SafetyCertificateOutlined />,
    },
    {
      key: 'overdue',
      title: 'Overdue',
      value: kpi.overdue || 0,
      subtitle: 'Past SLA deadline',
      color: 'var(--bc-red-600, #dc2626)',
      icon: <ClockCircleOutlined />,
      trend: kpi.overdueTrend,
    },
  ].map(card => ({ ...card, onClick: () => onDrillDown?.(card.key) }));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '18px 0 10px', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="tasks-live-dot" />
          <span className="tasks-section-label">{title}</span>
          {lastUpdated && <span className="tasks-kpi-card__context">· synced {lastUpdated}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FilterOutlined style={{ color: disputesOnly ? 'var(--bc-red-600, #dc2626)' : 'var(--tec-text-4, #94a3b8)', fontSize: 12 }} />
          <span style={{ fontSize: 12, fontWeight: disputesOnly ? 600 : 500, color: disputesOnly ? 'var(--bc-red-600, #dc2626)' : 'var(--tec-text-3, #64748b)' }}>
            Disputes only
          </span>
          <Switch
            size="small"
            checked={disputesOnly}
            onChange={onDisputesToggle}
            loading={loading}
            style={{ background: disputesOnly ? 'var(--bc-red-600, #dc2626)' : 'var(--bc-slate-300, #cbd5e1)' }}
          />
        </div>
      </div>
      <div className="tasks-kpi-grid">
        {retailCards.map(card => <KpiCard key={card.key} card={card} />)}
      </div>
    </div>
  );
}
