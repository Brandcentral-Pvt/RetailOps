import React from 'react';
import { Tooltip } from 'antd';

const StatCard = ({ label, value, icon, trend, color = 'var(--text-brand, #1976D2)', onClick, variant = 'default' }) => {
  if (variant === 'compact') {
    const Icon = icon;
    return (
      <div style={{
        padding: '14px 16px',
        background: 'var(--bg-primary, #ffffff)',
        border: '1px solid var(--border-light, #d9e6e9)',
        borderRadius: 'var(--radius-lg)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34,
            height: 34,
            borderRadius: 'var(--radius-lg, 12px)',
            background: `${color}0D`,
            color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Icon size={16} strokeWidth={2} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              color: 'var(--text-secondary, #64748b)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: 3,
            }}>
              {label}
            </div>
            <div style={{
              fontSize: 'var(--font-size-xl)',
              fontWeight: 600,
              color: 'var(--text-primary, #0f172a)',
              letterSpacing: '-0.3px',
              lineHeight: 1,
            }}>
              {value}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const formatted = Intl.NumberFormat('en-IN').format(value);

  return (
    <div
      onClick={onClick}
      style={{
        flex: '1 1 0',
        minWidth: 140,
        background: 'var(--bg-primary, #ffffff)',
        border: '1px solid var(--border-light, #d9e6e9)',
        borderRadius: "var(--radius-lg)",
        padding: '14px 16px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.18s ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--border-medium, #CBD5E1)';
        if (onClick) e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border-light)';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <span style={{
          fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-secondary, #64748b)',
          textTransform: 'uppercase', letterSpacing: '0.06em'
        }}>
          {label}
        </span>
        {icon && (
          <span style={{ color: 'var(--text-muted, #94a3b8)', fontSize: 'var(--font-size-lg)', lineHeight: 1 }}>{icon}</span>
        )}
      </div>
      <Tooltip title={formatted !== String(value) ? value.toLocaleString('en-IN') : undefined}>
        <div style={{
          fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--text-primary)',
          letterSpacing: '-0.02em', lineHeight: 1, marginBottom: trend ? 6 : 0
        }}>
          {formatted}
        </div>
      </Tooltip>
      {trend && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
          {trend.direction === 'up' && (
            <span style={{ color: 'var(--text-success, #2E7D32)', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>↑</span>
          )}
          {trend.direction === 'down' && (
            <span style={{ color: 'var(--text-danger, #D32F2F)', fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>↓</span>
          )}
          {trend.direction === 'live' && (
            <span style={{
              width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--text-success, #2E7D32)',
              display: 'inline-block',
            }} />
          )}
          {trend.value && (
            <span style={{
              fontSize: 'var(--font-size-xs)', fontWeight: 600, padding: '2px 7px', borderRadius: 100,
              border: '1px solid',
              borderColor: trend.direction === 'up' ? '#A5D6A7' : trend.direction === 'down' ? '#EF9A9A' : 'var(--border-light, #d9e6e9)',
              color: trend.direction === 'up' ? 'var(--text-success, #2E7D32)' : trend.direction === 'down' ? 'var(--text-danger, #D32F2F)' : 'var(--text-secondary, #64748b)',
              background: trend.direction === 'up' ? '#E8F5E9' : trend.direction === 'down' ? '#FFEBEE' : 'var(--bg-secondary, #f8fafc)',
            }}>
              {trend.value}
            </span>
          )}
          {trend.label && (
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary, #64748b)', fontWeight: 500 }}>{trend.label}</span>
          )}
        </div>
      )}
    </div>
  );
};

export default StatCard;
