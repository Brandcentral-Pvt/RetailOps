import React, { memo } from 'react';
import { Card, Tooltip } from 'antd';
import {
    TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
    Target, Activity, Zap, Award, Users, ShoppingBag,
    DollarSign, Percent, Package, BarChart3, Sparkles
} from 'lucide-react';
import { formatIndianCurrencyShort, formatNumber } from './utils';

const formatIndianCurrency = formatIndianCurrencyShort;

// Real % change across the period's series (first non-zero → last point).
// Returns null when the series is flat/empty so cards can show an honest
// neutral "no data" state instead of fabricated trends.
const computeTrend = (series = []) => {
    const data = (Array.isArray(series) ? series : []).map(Number).filter(v => !isNaN(v));
    const meaningful = data.filter(v => v !== 0);
    if (data.length < 2 || meaningful.length === 0) return null;
    const first = data.find(v => v !== 0) ?? data[0];
    const last = data[data.length - 1];
    if (first === 0) return null;
    const pct = ((last - first) / Math.abs(first)) * 100;
    if (Math.abs(pct) < 0.05) return { text: 'Flat', isPositive: true };
    return { text: `${pct > 0 ? '+' : ''}${pct.toFixed(1)}% vs period`, isPositive: pct >= 0 };
};

// ═══════════════════════════════════════════════════════════════
// PREMIUM SPARKLINE COMPONENT
// ═══════════════════════════════════════════════════════════════
const PremiumSparkline = memo(({ data = [0], color = 'var(--color-info-blue, #0288D1)', height = 36 }) => {
    const width = 200;
    const chartData = data.length > 0 ? data : [0];
    const max = Math.max(...chartData);
    const min = Math.min(...chartData);
    const range = max - min || 1;

    const points = chartData.map((val, index) => {
        const x = chartData.length > 1 ? (index / (chartData.length - 1)) * width : 0;
        const y = height - ((val - min) / range) * (height - 6) - 3;
        return { x, y };
    });

    if (points.length === 0) return null;

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        const cpX1 = p0.x + (p1.x - p0.x) / 2;
        const cpY1 = p0.y;
        const cpX2 = p0.x + (p1.x - p0.x) / 2;
        const cpY2 = p1.y;
        path += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
    }

    const fillPath = `${path} L ${width} ${height} L 0 ${height} Z`;
    const gradientId = `spark-grad-${color.replace('#', '')}-${Math.random().toString(36).substr(2, 5)}`;

    // Last point for end indicator
    const lastPoint = points[points.length - 1];

    return (
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
            <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                    <stop offset="100%" stopColor={color} stopOpacity="0.00" />
                </linearGradient>
            </defs>
            <path d={fillPath} fill={`url(#${gradientId})`} />
            <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            {/* End point indicator */}
            <circle cx={lastPoint.x} cy={lastPoint.y} r="3" fill={color} />
            <circle cx={lastPoint.x} cy={lastPoint.y} r="6" fill={color} fillOpacity="0.15" />
        </svg>
    );
});

// ═══════════════════════════════════════════════════════════════
// CIRCULAR PROGRESS (for Achievement Rate)
// ═══════════════════════════════════════════════════════════════
const CircularProgress = memo(({ percent = 0, color = '#2E7D32', size = 60 }) => {
    const radius = (size - 8) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (Math.min(percent, 100) / 100) * circumference;

    return (
        <div style={{ position: 'relative', width: size, height: size }}>
            <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="#f1f5f9"
                    strokeWidth="4"
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth="4"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
                />
            </svg>
            <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 700,
                color: color
            }}>
                {Math.round(percent)}%
            </div>
        </div>
    );
});

// ═══════════════════════════════════════════════════════════════
// PREMIUM KPI CARD
// ═══════════════════════════════════════════════════════════════
const KpiCard = memo(({ card, isLast }) => {
    const {
        label, value, subValue, trend, isPositive, color, sparkline, showProgress, progressValue
    } = card;

    const isNeutral = card.isNeutral ? true : isPositive === null || isPositive === undefined;
    const trendVal = trend ? trend.split(' ')[0] : '';
    const hasPercent = trendVal.includes('%');
    const displayTrend = isNeutral
        ? (trend || '—')
        : (hasPercent ? `${isPositive ? '+' : '-'}${trendVal.replace(/[+-]/g, '')}` : trendVal);
    const indicatorColor = isNeutral ? '#94a3b8' : (isPositive ? '#2E7D32' : '#D32F2F');

    const hasSparkTrend = Array.isArray(sparkline) && sparkline.length > 1 && sparkline.some(v => Number(v) !== 0);

    return (
        <div
            className="kpi-premium-card"
            style={{
                borderRadius: "var(--radius-md)",
                border: '1px solid var(--dash-border, #e2e8f0)',
                boxShadow: 'var(--dash-shadow, 0 1px 3px rgba(15,23,42,0.05))',
                background: 'var(--bg-primary, #fff)',
                overflow: 'hidden',
                height: 135,
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'default'
            }}
        >
            <div style={{ padding: '12px 12px 6px 12px', display: 'flex', flexDirection: 'column', height: '100%', flexGrow: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-secondary, #64748b)' }}>{label}</span>
                    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: indicatorColor }}>
                        {displayTrend}
                    </span>
                </div>
                <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary, #0f172a)', marginBottom: 6, fontFamily: 'system-ui, -apple-system' }}>
                    {value}
                </div>
                {subValue && (
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary, #64748b)', fontWeight: 500, marginBottom: 4 }}>
                        {subValue}
                    </div>
                )}
                <div style={{ marginTop: 'auto', marginBottom: 4 }}>
                    {showProgress ? (
                        <div style={{ height: 5, background: 'var(--border-light, #d9e6e9)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.min(progressValue, 100)}%`, background: color, borderRadius: 3 }} />
                        </div>
                    ) : hasSparkTrend ? (
                        <PremiumSparkline data={sparkline} color={indicatorColor} height={32} />
                    ) : (
                        <div style={{
                            height: 32,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--text-tertiary, #94a3b8)',
                            fontWeight: 500,
                            letterSpacing: '0.04em',
                            border: '1px dashed var(--border-light, #d9e6e9)',
                            borderRadius: 'var(--radius-sm, 6px)'
                        }}>
                            No data this period
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});

// ═══════════════════════════════════════════════════════════════
// MAIN KPI STRIP
// ═══════════════════════════════════════════════════════════════
const KpiStrip = ({
    adSales = 0,
    adSpend = 0,
    orders = 0,
    acos = 0,
    units = 0,
    targetTotal = 0,
    targetAchieved = 0,
    achievementRate = 0,
    brandCount = 0,
    sparklineData = {}
}) => {

    // ═══════════════════════════════════════════════════════════════
    // CARD DEFINITIONS — SPLIT INTO 2 GROUPS
    // ═══════════════════════════════════════════════════════════════

    // Marketplace trends are derived from the real period series
    const adRevTrend = computeTrend(sparklineData.adSales);
    const ordersTrend = computeTrend(sparklineData.orders);
    const acosTrend = computeTrend(sparklineData.acos);
    const unitsTrend = computeTrend(sparklineData.units);

    // GROUP 1: Marketplace & Ads (4 cards)
    const marketplaceCards = [
        {
            label: 'AD REVENUE',
            value: formatIndianCurrency(adSales),
            subValue: `Spend ${formatIndianCurrency(adSpend)}`,
            trend: adRevTrend ? adRevTrend.text : '—',
            isPositive: adRevTrend ? adRevTrend.isPositive : null,
            isNeutral: !adRevTrend,
            icon: <DollarSign size={16} strokeWidth={2.5} />,
            color: 'var(--color-info-blue, #0288D1)',
            gradient: 'linear-gradient(135deg, #0288D1 0%, #0288D1 100%)',
            sparkline: sparklineData.adSales,
        },
        {
            label: 'TOTAL ORDERS',
            value: formatNumber(orders),
            subValue: 'All channels combined',
            trend: ordersTrend ? ordersTrend.text : '—',
            isPositive: ordersTrend ? ordersTrend.isPositive : null,
            isNeutral: !ordersTrend,
            icon: <ShoppingBag size={16} strokeWidth={2.5} />,
            color: 'var(--color-info-blue, #0288D1)',
            gradient: 'linear-gradient(135deg, #22d3ee 0%, #0288D1 100%)',
            sparkline: sparklineData.orders,
        },
        {
            label: 'ACoS RATIO',
            value: adSales > 0 && adSpend > 0 ? `${acos.toFixed(1)}%` : '—',
            subValue: adSales > 0 && adSpend > 0
                ? (acos <= 25 ? 'Healthy range' : 'Needs attention')
                : 'No ad spend this period',
            trend: adSales > 0 && adSpend > 0 && acosTrend ? acosTrend.text : '—',
            isPositive: acosTrend && adSales > 0 ? !acosTrend.isPositive : null,
            isNeutral: !(adSales > 0 && adSpend > 0),
            icon: <Percent size={16} strokeWidth={2.5} />,
            color: '#2E7D32',
            gradient: 'linear-gradient(135deg, #34d399 0%, #2E7D32 100%)',
            sparkline: sparklineData.acos,
        },
        {
            label: 'UNITS SOLD',
            value: formatNumber(units),
            subValue: 'Across all SKUs',
            trend: unitsTrend ? unitsTrend.text : '—',
            isPositive: unitsTrend ? unitsTrend.isPositive : null,
            isNeutral: !unitsTrend,
            icon: <Package size={16} strokeWidth={2.5} />,
            color: '#9C27B0',
            gradient: 'linear-gradient(135deg, #a78bfa 0%, #9C27B0 100%)',
            sparkline: sparklineData.units,
        },
    ];

    // GROUP 2: Targets & Achievement (4 cards)
    const hasTargets = targetTotal > 0;
    const targetCards = [
        {
            label: 'TARGET POOL',
            value: hasTargets ? formatIndianCurrency(targetTotal) : '—',
            subValue: `${brandCount} active plans`,
            trend: hasTargets ? 'Goal Set' : '—',
            isPositive: hasTargets,
            isNeutral: !hasTargets,
            icon: <Target size={16} strokeWidth={2.5} />,
            color: '#1976D2',
            gradient: 'linear-gradient(135deg, #818cf8 0%, #1976D2 100%)',
            accentLeft: false,
        },
        {
            label: 'REVENUE ACHIEVED',
            value: hasTargets ? formatIndianCurrency(targetAchieved) : '—',
            subValue: hasTargets ? 'Cumulative pacing' : 'No targets set',
            trend: hasTargets ? 'Realized' : '—',
            isPositive: hasTargets,
            isNeutral: !hasTargets,
            icon: <Zap size={16} strokeWidth={2.5} />,
            color: '#2E7D32',
            gradient: 'linear-gradient(135deg, #34d399 0%, #2E7D32 100%)',
            accentLeft: false,
        },
        {
            label: 'PACING RATE',
            value: hasTargets ? `${achievementRate.toFixed(1)}%` : '—',
            subValue: hasTargets
                ? (achievementRate >= 100 ? 'Elite' : achievementRate >= 80 ? 'High' : achievementRate >= 50 ? 'On Track' : 'Critical')
                : 'No targets this period',
            trend: hasTargets
                ? (achievementRate >= 100 ? 'Outperforming' : achievementRate >= 50 ? 'On Schedule' : 'Below Target')
                : '—',
            isPositive: !hasTargets ? null : achievementRate >= 50,
            isNeutral: !hasTargets,
            icon: <Award size={16} strokeWidth={2.5} />,
            color: !hasTargets ? '#94a3b8' : achievementRate >= 100 ? '#2E7D32' : achievementRate >= 80 ? 'var(--color-info-blue, #0288D1)' : achievementRate >= 50 ? '#ED6C02' : '#D32F2F',
            gradient: !hasTargets
                ? 'linear-gradient(135deg, #cbd5e1 0%, #94a3b8 100%)'
                : achievementRate >= 100
                    ? 'linear-gradient(135deg, #34d399 0%, #2E7D32 100%)'
                    : achievementRate >= 80
                        ? 'linear-gradient(135deg, #60a5fa 0%, #0288D1 100%)'
                        : achievementRate >= 50
                            ? 'linear-gradient(135deg, #fbbf24 0%, #E65100 100%)'
                            : 'linear-gradient(135deg, #f87171 0%, #D32F2F 100%)',
            showProgress: hasTargets,
            progressValue: achievementRate,
            accentLeft: false,
        },
        {
            label: 'ACTIVE BRANDS',
            value: brandCount.toString(),
            subValue: 'Portfolio coverage',
            trend: 'Managed',
            isPositive: true,
            icon: <Users size={16} strokeWidth={2.5} />,
            color: '#9C27B0',
            gradient: 'linear-gradient(135deg, #f472b6 0%, #db2777 100%)',
            accentLeft: false,
        },
    ];

    return (
        <>
            {/* GROUP 1: MARKETPLACE METRICS */}
            <div style={{ marginBottom: 20 }}>
                <div className="kpi-section-header">
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        background: '#f8fafc',
                        padding: '5px 12px',
                        borderRadius: 8,
                        border: '1px solid #e2e8f0'
                    }}>
                        <BarChart3 size={13} style={{ color: '#1976D2' }} />
                        <span style={{
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 650,
                            color: '#334155',
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em'
                        }}>
                            Marketplace & Ads Performance
                        </span>
                    </div>
                    <div className="kpi-section-divider" />
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: 14
                }}>
                    {marketplaceCards.map((card, idx) => (
                        <KpiCard
                            key={`mkt-${idx}`}
                            card={card}
                            isLast={idx === marketplaceCards.length - 1}
                        />
                    ))}
                </div>
            </div>

            {/* GROUP 2: TARGETS & ACHIEVEMENT */}
            <div style={{ marginBottom: 24 }}>
                <div className="kpi-section-header">
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        background: '#f8fafc',
                        padding: '5px 12px',
                        borderRadius: 8,
                        border: '1px solid #e2e8f0'
                    }}>
                        <Target size={13} style={{ color: '#1976D2' }} />
                        <span style={{
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 650,
                            color: '#334155',
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em'
                        }}>
                            Revenue Targets & Achievements
                        </span>
                    </div>
                    <div className="kpi-section-divider" />
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: 14
                }}>
                    {targetCards.map((card, idx) => (
                        <KpiCard
                            key={`tgt-${idx}`}
                            card={card}
                            isLast={idx === targetCards.length - 1}
                        />
                    ))}
                </div>
            </div>
        </>
    );
};

export default memo(KpiStrip);