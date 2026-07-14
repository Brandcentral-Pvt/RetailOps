import React, { memo } from 'react';

const StatMini = memo(({ label, value, color, icon: Icon, pulse, animate }) => (
    <div
        className={pulse ? 'stat-pulse' : ''}
        style={{
            flex: 1,
            minWidth: 0,
            padding: '8px 10px',
            background: color ? `${color}08` : 'var(--bg-secondary, #f8fafc)',
            border: `1px solid ${color ? `${color}20` : 'var(--border-light, #d9e6e9)'}`,
            borderRadius: 'var(--radius-md)',
            transition: 'all 0.2s',
            cursor: 'default'
        }}
    >
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            marginBottom: 2
        }}>
            {Icon && (
                <Icon
                    size={9}
                    className={animate ? 'rotating-icon-mini' : ''}
                    style={{ color: color || '#64748b', flexShrink: 0 }}
                />
            )}
            <span style={{
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                color: color || '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
            }}>
                {label}
            </span>
        </div>
        <div style={{
            fontSize: 'var(--font-size-base)',
            fontWeight: 700,
            color: color || '#0f172a',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
        }}>
            {value}
        </div>
    </div>
));

export default StatMini;
