/**
 * DataDrivenKpiCard - A fully data-driven KPI card component
 * Displays real-time metrics with trends, sparklines, and targets
 */

import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, Target, AlertTriangle } from 'lucide-react';
import type { KpiMetric } from '../types';
import { METRIC_CONFIG } from '../../../models/growth.types';

interface DataDrivenKpiCardProps {
  metric: KpiMetric;
  onClick?: () => void;
  showTarget?: boolean;
  showSparkline?: boolean;
  compact?: boolean;
}

const DataDrivenKpiCard: React.FC<DataDrivenKpiCardProps> = ({
  metric,
  onClick,
  showTarget = true,
  showSparkline = true,
  compact = false,
}) => {
  const {
    label,
    currentValue,
    previousValue,
    targetValue,
    unit,
    format,
    trend,
    changePercent,
    changeAbsolute,
    status,
    sparkline,
    isLoaded,
  } = metric;

  const config = METRIC_CONFIG[metric.metricType as keyof typeof METRIC_CONFIG];
  
  // Format value based on format type
  const formatValue = (value: number): string => {
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          maximumFractionDigits: 0,
        }).format(value);
      case 'percentage':
        return `${value.toFixed(1)}%`;
      case 'ratio':
        return value.toFixed(2);
      default:
        return new Intl.NumberFormat('en-IN', {
          notation: value > 10000 ? 'compact' : 'standard',
          maximumFractionDigits: value > 1000 ? 0 : 1,
        }).format(value);
    }
  };

  // Determine trend indicator
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-500' : 'text-gray-400';
  const trendBg = trend === 'up' ? 'bg-emerald-50' : trend === 'down' ? 'bg-red-50' : 'bg-gray-50';

  // Calculate progress to target
  const targetProgress = targetValue && targetValue > 0 
    ? Math.min((currentValue / targetValue) * 100, 100) 
    : 0;

  // Status color mapping
  const statusColors: Record<string, string> = {
    AHEAD: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    ON_TRACK: 'text-blue-600 bg-blue-50 border-blue-200',
    BEHIND: 'text-amber-600 bg-amber-50 border-amber-200',
    PENDING: 'text-gray-600 bg-gray-50 border-gray-200',
  };

  if (!isLoaded) {
    return (
      <div className="kpi-card-skeleton" style={{
        background: 'white',
        borderRadius: 'var(--radius-xl)',
        padding: compact ? '16px' : '20px',
        border: '1px solid var(--border-light, #e2e8f0)',
        minHeight: compact ? '100px' : '120px',
      }} />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={onClick ? { scale: 1.02, boxShadow: '0 8px 25px -2px rgba(0,0,0,0.1)' } : {}}
      onClick={onClick}
      className="data-driven-kpi-card"
      style={{
        background: 'white',
        borderRadius: 'var(--radius-xl)',
        padding: compact ? '16px' : '20px',
        border: '1px solid var(--border-light, #e2e8f0)',
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top accent bar based on status */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '3px',
        background: config?.color || '#6366f1',
        opacity: status === 'AHEAD' ? 1 : 0.7,
      }} />

      {/* Header: Icon + Label */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: compact ? '8px' : '12px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <div style={{
            width: compact ? 32 : 36,
            height: compact ? 32 : 36,
            borderRadius: 'var(--radius-lg)',
            background: `${config?.color}15` || '#6366f115',
            color: config?.color || '#6366f1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {config?.icon && <span style={{ fontSize: compact ? 16 : 18 }}>{config.icon}</span>}
          </div>
          <span style={{
            fontSize: compact ? '12px' : '13px',
            fontWeight: 600,
            color: 'var(--text-secondary, #64748b)',
          }}>
            {label}
          </span>
        </div>

        {/* Status badge */}
        {showTarget && status && (
          <div style={{
            padding: '4px 10px',
            borderRadius: '999px',
            fontSize: '11px',
            fontWeight: 700,
            ...(statusColors[status] || statusColors.PENDING),
          }}>
            {status.replace('_', ' ')}
          </div>
        )}
      </div>

      {/* Main value */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: '8px',
        marginBottom: compact ? '8px' : '12px',
      }}>
        <span style={{
          fontSize: compact ? 20 : 28,
          fontWeight: 800,
          color: 'var(--text-primary, #0f172a)',
          letterSpacing: '-0.02em',
        }}>
          {formatValue(currentValue)}
        </span>
        {unit && format !== 'currency' && (
          <span style={{
            fontSize: compact ? 12 : 14,
            color: 'var(--text-secondary, #64748b)',
            fontWeight: 500,
          }}>
            {unit}
          </span>
        )}
      </div>

      {/* Trend indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: showSparkline && sparkline?.length ? '12px' : '0',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '3px 8px',
          borderRadius: '999px',
          background: trendBg,
        }}>
          <TrendIcon size={14} className={trendColor} />
          <span style={{
            fontSize: '12px',
            fontWeight: 700,
            color: trend === 'up' ? '#059669' : trend === 'down' ? '#dc2626' : '#6b7280',
          }}>
            {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(1)}%
          </span>
        </div>
        <span style={{
          fontSize: '12px',
          color: 'var(--text-tertiary, #94a3b8)',
        }}>
          vs last period ({formatValue(changeAbsolute)})
        </span>
      </div>

      {/* Sparkline mini chart */}
      {showSparkline && sparkline && sparkline.length > 0 && (
        <div style={{
          height: 40,
          marginBottom: '12px',
        }}>
          <svg
            viewBox={`0 0 ${sparkline.length * 20} 40`}
            style={{ width: '100%', height: '100%' }}
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id={`gradient-${metric.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={config?.color || '#6366f1'} stopOpacity={0.3} />
                <stop offset="100%" stopColor={config?.color || '#6366f1'} stopOpacity={0} />
              </linearGradient>
            </defs>
            <path
              d={`M 0 40 L 0 ${40 - (sparkline[0].value / Math.max(...sparkline.map(p => p.value))) * 35} ${
                sparkline.map((point, i) => 
                  `L ${(i + 1) * 20} ${40 - (point.value / Math.max(...sparkline.map(p => p.value))) * 35}`
                ).join(' ')
              } L ${sparkline.length * 20} 40 Z`}
              fill={`url(#gradient-${metric.id})`}
            />
            <path
              d={`M 0 ${40 - (sparkline[0].value / Math.max(...sparkline.map(p => p.value))) * 35} ${
                sparkline.map((point, i) => 
                  `L ${(i + 1) * 20} ${40 - (point.value / Math.max(...sparkline.map(p => p.value))) * 35}`
                ).join(' ')
              }`}
              fill="none"
              stroke={config?.color || '#6366f1'}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}

      {/* Target progress bar */}
      {showTarget && targetValue && (
        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '6px',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--text-secondary, #64748b)',
            }}>
              <Target size={12} />
              <span>Target: {formatValue(targetValue)}</span>
            </div>
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              color: targetProgress >= 100 ? '#059669' : '#6366f1',
            }}>
              {targetProgress.toFixed(0)}%
            </span>
          </div>
          <div style={{
            height: 6,
            background: '#e2e8f0',
            borderRadius: '999px',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${targetProgress}%`,
              background: targetProgress >= 100 
                ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)'
                : `linear-gradient(90deg, ${config?.color || '#6366f1'} 0%, ${config?.color || '#6366f1'}cc 100%)`,
              borderRadius: '999px',
              transition: 'width 0.5s ease-out',
            }} />
          </div>
          {targetProgress < 50 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              marginTop: '6px',
              fontSize: '11px',
              color: '#dc2626',
              fontWeight: 600,
            }}>
              <AlertTriangle size={12} />
              <span>At risk - needs attention</span>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default memo(DataDrivenKpiCard);
