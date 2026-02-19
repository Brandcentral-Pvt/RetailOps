import React from 'react';
import * as LucideIcons from 'lucide-react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const KPICard = ({ title, value, icon, trend, trendType = 'neutral', subtitle = 'vs last month' }) => {
  const IconComponent = LucideIcons[icon] || LucideIcons.Activity;

  const getTrendConfig = () => {
    if (trendType === 'positive') return { class: 'text-success', icon: TrendingUp, bg: 'rgba(16, 185, 129, 0.1)' };
    if (trendType === 'negative') return { class: 'text-danger', icon: TrendingDown, bg: 'rgba(239, 68, 68, 0.1)' };
    return { class: 'text-muted', icon: Minus, bg: 'rgba(107, 114, 128, 0.1)' };
  };

  const trendConfig = getTrendConfig();
  const TrendIcon = trendConfig.icon;

  return (
    <div className="kpi-card border-0 shadow-sm overflow-hidden" style={{ borderRadius: '16px', background: '#fff' }}>
      <div className="card-body p-4">
        <div className="d-flex justify-content-between align-items-start mb-3">
          <div
            className="icon-wrapper d-flex align-items-center justify-content-center"
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'rgba(59, 130, 246, 0.08)',
              color: '#3b82f6'
            }}
          >
            <IconComponent size={20} strokeWidth={2.5} />
          </div>
          <div
            className={`trend-badge px-2 py-1 rounded-pill d-flex align-items-center gap-1 small fw-bold ${trendConfig.class}`}
            style={{ background: trendConfig.bg, fontSize: '11px' }}
          >
            <TrendIcon size={12} strokeWidth={3} />
            {trend}%
          </div>
        </div>

        <div>
          <div className="text-muted small fw-bold text-uppercase mb-1" style={{ letterSpacing: '0.02em', fontSize: '10px' }}>{title}</div>
          <div className="h3 mb-1 fw-bold" style={{ color: '#111827' }}>{value}</div>
          <div className="text-muted smallest">{subtitle}</div>
        </div>
      </div>
    </div>
  );
};

export default KPICard;
