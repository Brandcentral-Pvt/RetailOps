import React, { memo } from 'react';

const StatChip = memo(({ icon: Icon, value, label, color, animate, animateClass = 'spinning-icon' }) => (
    <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '4px 9px',
        background: `${color}10`,
        border: `1px solid ${color}25`,
        borderRadius: 'var(--radius-lg)',
        whiteSpace: 'nowrap'
    }}>
        <Icon
            size={11}
            style={{ color }}
            strokeWidth={2.5}
            className={animate ? animateClass : ''}
        />
        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color }}>
            {value}
        </span>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary, #64748b)', fontWeight: 600 }}>
            {label}
        </span>
    </div>
));

export default StatChip;
