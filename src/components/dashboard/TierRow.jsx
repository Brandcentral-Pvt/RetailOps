import React, { memo } from 'react';

const TierRow = memo(({ tier, total }) => {
    const TierIcon = tier.icon;
    const pct = total > 0 ? (tier.value / total) * 100 : 0;

    return (
        <div
            className="tier-row-hover"
            style={{
                padding: '10px 12px',
                background: 'var(--bg-primary, #fff)',
                border: `1px solid ${tier.color}20`,
                borderRadius: 10,
                cursor: 'pointer',
                transition: 'all 0.2s',
                position: 'relative',
                overflow: 'hidden'
            }}
        >
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                width: `${pct}%`,
                background: `linear-gradient(90deg, ${tier.color}10 0%, transparent 100%)`,
                pointerEvents: 'none',
                transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
            }} />

            <div style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: 10
            }}>
                <div style={{
                    width: 30,
                    height: 30,
                    borderRadius: 9,
                    background: tier.bg,
                    border: `1px solid ${tier.color}30`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: tier.color,
                    flexShrink: 0
                }}>
                    <TierIcon size={14} strokeWidth={2.5} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        marginBottom: 1
                    }}>
                        <span style={{
                            fontSize: 'var(--font-size-sm)',
                            fontWeight: 700,
                            color: tier.color,
                            letterSpacing: '0.01em'
                        }}>
                            {tier.label}
                        </span>
                        <span style={{
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 600,
                            color: 'var(--text-secondary, #64748b)',
                            background: 'var(--border-light, #d9e6e9)',
                            padding: '1px 5px',
                            borderRadius: "var(--radius-sm)"
                        }}>
                            {tier.range}
                        </span>
                    </div>
                    <div style={{
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--text-secondary, #64748b)',
                        fontWeight: 500
                    }}>
                        {tier.description}
                    </div>
                </div>

                <div style={{
                    textAlign: 'right',
                    flexShrink: 0
                }}>
                    <div style={{
                        fontSize: 'var(--font-size-lg)',
                        fontWeight: 700,
                        color: tier.color,
                        lineHeight: 1,
                        letterSpacing: '-0.3px'
                    }}>
                        {tier.value}
                    </div>
                    <div style={{
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--text-secondary, #64748b)',
                        fontWeight: 600,
                        marginTop: 2
                    }}>
                        {pct.toFixed(0)}%
                    </div>
                </div>
            </div>
        </div>
    );
});

export default memo(TierRow);
