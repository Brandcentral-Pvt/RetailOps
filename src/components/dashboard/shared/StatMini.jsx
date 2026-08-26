import React, { memo } from 'react';

const StatMini = memo(({ label, value, color, icon: Icon, pulse, animate }) => (
    <div
        className={pulse ? 'stat-pulse' : ''}
        style={{
            flex: 1,
            minWidth: 0,
            padding: '8px 10px',
            background: color ? `${color}08` : 'var(--bg-secondary, var(--bc-slate-50))',
            border: `1px solid ${color ? `${color}20` : 'var(--border-light, var(--border-light))'}`,
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
                    style={{ color: color || 'var(--bc-slate-500)', flexShrink: 0 }}
                />
            )}
            <span style={{
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                color: color || 'var(--bc-slate-500)',
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
            color: color || 'var(--bc-slate-900)',
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
