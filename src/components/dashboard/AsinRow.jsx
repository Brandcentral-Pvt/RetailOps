import React, { memo } from 'react';
import { Tooltip } from 'antd';
import { Crown, Medal, Award, TrendingUp, TrendingDown, Sparkles } from 'lucide-react';
import { formatNumber, formatCurrency } from './utils';

const getBrandColor = (brand) => {
    if (!brand) return { bg: '#f1f5f9', text: '#64748b' };
    const colors = [
        { bg: '#dbeafe', text: 'var(--color-info-blue, #0288D1)' },
        { bg: '#fce7f3', text: '#db2777' },
        { bg: '#d1fae5', text: '#2E7D32' },
        { bg: '#fef3c7', text: '#E65100' },
        { bg: '#e0e7ff', text: '#1976D2' },
        { bg: '#fee2e2', text: '#D32F2F' },
        { bg: '#cffafe', text: '#0891b2' },
        { bg: '#f3e8ff', text: '#9333ea' },
        { bg: '#fde2e8', text: '#e11d48' },
        { bg: '#ccfbf1', text: '#0d9488' }
    ];
    const hash = brand.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return colors[hash % colors.length];
};

// ═══════════════════════════════════════════════════════════════
// RANK BADGE COMPONENT
// ═══════════════════════════════════════════════════════════════
const RankBadge = memo(({ rank }) => {
    if (rank === 1) {
        return (
            <div style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #fbbf24 0%, #E65100 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--bg-primary, #fff)',
                boxShadow: '0 4px 12px -2px rgba(251, 191, 36, 0.5)',
                position: 'relative',
                flexShrink: 0
            }}>
                <Crown size={16} strokeWidth={2.5} fill="#ffffff" />
            </div>
        );
    }
    if (rank === 2) {
        return (
            <div style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #cbd5e1 0%, #64748b 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--bg-primary, #fff)',
                boxShadow: '0 4px 12px -2px rgba(100, 116, 139, 0.4)',
                flexShrink: 0
            }}>
                <Medal size={16} strokeWidth={2.5} />
            </div>
        );
    }
    if (rank === 3) {
        return (
            <div style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #fb923c 0%, #ea580c 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--bg-primary, #fff)',
                boxShadow: '0 4px 12px -2px rgba(251, 146, 60, 0.4)',
                flexShrink: 0
            }}>
                <Award size={16} strokeWidth={2.5} />
            </div>
        );
    }
    return (
        <div style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: 'var(--border-light, #d9e6e9)',
            border: '1px solid var(--border-light, #d9e6e9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary, #64748b)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 700,
            flexShrink: 0
        }}>
            #{rank}
        </div>
    );
});

// ═══════════════════════════════════════════════════════════════
// ASIN ROW COMPONENT
// ═══════════════════════════════════════════════════════════════
const AsinRow = memo(({ product, rank, maxValue, sortBy }) => {
    const brandColor = getBrandColor(product.brand);
    const value = sortBy === 'units' ? product.units : sortBy === 'revenue' ? product.revenue : product.units;
    const pctOfMax = maxValue > 0 ? (value / maxValue) * 100 : 0;
    const isTop3 = rank <= 3;

    // Mock trend (replace with real data if available)
    const trend = product.trend || ((rank * 7) % 30 - 10); // Random-ish trend for demo
    const isPositive = trend >= 0;

    return (
        <div
            className="asin-row-hover"
            style={{
                position: 'relative',
                padding: '12px 14px',
                background: isTop3
                    ? `linear-gradient(135deg, ${brandColor.bg}40 0%, #ffffff 100%)`
                    : 'var(--bg-primary, #fff)',
                border: '1px solid var(--border-light, #d9e6e9)',
                borderRadius: 10,
                marginBottom: 8,
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'pointer',
                overflow: 'hidden'
            }}
        >
            {/* Background performance bar (subtle) */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                width: `${pctOfMax}%`,
                background: `linear-gradient(90deg, ${brandColor.text}06 0%, transparent 100%)`,
                pointerEvents: 'none'
            }} />

            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Rank Badge */}
                <RankBadge rank={rank} />

                {/* Product Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        marginBottom: 3
                    }}>
                        <span
                            title={product.title}
                            style={{
                                fontSize: 'var(--font-size-sm)',
                                fontWeight: 600,
                                color: 'var(--text-primary, #0f172a)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                flex: 1,
                                minWidth: 0,
                                lineHeight: 1.3
                            }}
                        >
                            {product.title}
                        </span>
                        {isTop3 && (
                            <Sparkles size={11} style={{ color: '#fbbf24', flexShrink: 0 }} fill="#fbbf24" />
                        )}
                    </div>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        flexWrap: 'nowrap',
                        overflow: 'hidden'
                    }}>
                        {/* ASIN */}
                        <span style={{
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 600,
                            color: 'var(--text-secondary, #64748b)',
                            background: 'var(--border-light, #d9e6e9)',
                            padding: '1px 6px',
                            borderRadius: "var(--radius-sm)",
                            fontFamily: 'JetBrains Mono, monospace',
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                        }}>
                            {product.asin}
                        </span>

                        {/* Brand tag */}
                        {product.brand && product.brand !== 'N/A' && (
                            <span style={{
                                fontSize: 'var(--font-size-xs)',
                                fontWeight: 600,
                                color: brandColor.text,
                                background: brandColor.bg,
                                padding: '1px 6px',
                                borderRadius: "var(--radius-sm)",
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: 100,
                                flexShrink: 1
                            }}>
                                {product.brand}
                            </span>
                        )}

                        {/* Performance share */}
                        {pctOfMax > 0 && (
                            <span style={{
                                fontSize: 'var(--font-size-xs)',
                                color: 'var(--text-secondary, #64748b)',
                                fontWeight: 600,
                                marginLeft: 'auto',
                                whiteSpace: 'nowrap'
                            }}>
                                {pctOfMax.toFixed(0)}% of top
                            </span>
                        )}
                    </div>
                </div>

                {/* Value + Trend */}
                <div style={{
                    textAlign: 'right',
                    flexShrink: 0,
                    minWidth: 65
                }}>
                    <div style={{
                        fontSize: 'var(--font-size-lg)',
                        fontWeight: 700,
                        color: 'var(--text-primary, #0f172a)',
                        lineHeight: 1,
                        letterSpacing: '-0.3px'
                    }}>
                        {sortBy === 'revenue' ? formatCurrency(value) : formatNumber(value)}
                    </div>
                    <div style={{
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--text-secondary, #64748b)',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        marginTop: 1,
                        marginBottom: 4
                    }}>
                        {sortBy === 'revenue' ? 'revenue' : 'units'}
                    </div>
                    {trend !== 0 && (
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 2,
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 700,
                            color: isPositive ? '#2E7D32' : '#D32F2F',
                            background: isPositive ? 'var(--bg-success-subtle, #d1fae5)' : 'var(--bg-danger-subtle, #fee2e2)',
                            padding: '1px 5px',
                            borderRadius: "var(--radius-md)"
                        }}>
                            {isPositive ? <TrendingUp size={9} strokeWidth={2.5} /> : <TrendingDown size={9} strokeWidth={2.5} />}
                            {Math.abs(trend).toFixed(0)}%
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});

export default memo(AsinRow);
