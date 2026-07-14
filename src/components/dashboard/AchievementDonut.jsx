import React, { useMemo, memo } from 'react';
import { Card } from 'antd';
import {
    Award, Activity, AlertTriangle,
    TrendingUp, TrendingDown, Sparkles, Target,
    ArrowUpRight, CheckCircle2, Zap
} from 'lucide-react';
import { Link } from 'react-router-dom';
import PremiumDonutChart from './PremiumDonutChart';
import TierRow from './TierRow';

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
const AchievementDonut = ({ targets = [], overallRate = 0 }) => {
    // ═══════════════════════════════════════════════════════════════
    // CALCULATE SEGMENTS
    // ═══════════════════════════════════════════════════════════════
    const tiers = useMemo(() => {
        let elite = 0;
        let high = 0;
        let onTrack = 0;
        let critical = 0;

        targets.forEach((t) => {
            const total = t.TotalTargetValue || 0;
            const achieved = t.overallAchieved || 0;
            const pct = total > 0 ? (achieved / total) * 100 : 0;

            if (pct >= 100) elite++;
            else if (pct >= 80) high++;
            else if (pct >= 50) onTrack++;
            else critical++;
        });

        return [
            {
                key: 'elite',
                label: 'Elite',
                range: '100%+',
                description: 'Exceeded all targets',
                value: elite,
                color: '#2E7D32',
                bg: '#d1fae5',
                icon: Crown
            },
            {
                key: 'high',
                label: 'High',
                range: '80-99%',
                description: 'Strong performance',
                value: high,
                color: 'var(--color-info-blue, #0288D1)',
                bg: '#dbeafe',
                icon: Star
            },
            {
                key: 'ontrack',
                label: 'On Track',
                range: '50-79%',
                description: 'Steady progress',
                value: onTrack,
                color: '#ED6C02',
                bg: '#fef3c7',
                icon: Activity
            },
            {
                key: 'critical',
                label: 'Critical',
                range: '<50%',
                description: 'Needs attention',
                value: critical,
                color: 'var(--text-danger, #D32F2F)',
                bg: '#fee2e2',
                icon: AlertTriangle
            }
        ];
    }, [targets]);

    const total = tiers.reduce((sum, t) => sum + t.value, 0);

    // ═══════════════════════════════════════════════════════════════
    // OVERALL STATUS
    // ═══════════════════════════════════════════════════════════════
    const overallStatus = useMemo(() => {
        if (overallRate >= 100) return {
            label: 'Outperforming',
            color: '#2E7D32',
            bg: '#d1fae5',
            border: '#a7f3d0',
            icon: Sparkles,
            message: 'Exceptional results across portfolio'
        };
        if (overallRate >= 80) return {
            label: 'High Performance',
            color: 'var(--color-info-blue, #0288D1)',
            bg: '#dbeafe',
            border: '#bfdbfe',
            icon: TrendingUp,
            message: 'Strong overall achievement'
        };
        if (overallRate >= 50) return {
            label: 'On Track',
            color: '#ED6C02',
            bg: '#fef3c7',
            border: '#fde68a',
            icon: Activity,
            message: 'Steady progress towards goals'
        };
        return {
            label: 'Critical',
            color: 'var(--text-danger, #D32F2F)',
            bg: '#fee2e2',
            border: '#fecaca',
            icon: AlertTriangle,
            message: 'Immediate attention required'
        };
    }, [overallRate]);

    const StatusIcon = overallStatus.icon;

    // ═══════════════════════════════════════════════════════════════
    // INSIGHTS
    // ═══════════════════════════════════════════════════════════════
    const insights = useMemo(() => {
        if (total === 0) return null;

        const elitePct = ((tiers[0].value / total) * 100).toFixed(0);
        const criticalPct = ((tiers[3].value / total) * 100).toFixed(0);
        const healthyCount = tiers[0].value + tiers[1].value;
        const healthyPct = ((healthyCount / total) * 100).toFixed(0);

        return {
            elitePct,
            criticalPct,
            healthyCount,
            healthyPct,
            isHealthy: healthyCount >= total / 2
        };
    }, [tiers, total]);

    return (
        <>
            <Card
                styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column', height: '100%' } }}
                style={{
                    borderRadius: "var(--radius-xl)",
                    border: '1px solid var(--border-light, #d9e6e9)',
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.02)',
                    background: 'var(--bg-primary, #fff)',
                    height: '100%',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                {/* ═══════════════════════════════════════════════════
                    HEADER
                ═══════════════════════════════════════════════════ */}
                <div style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--border-light, #d9e6e9)',
                    background: 'linear-gradient(135deg, #fef2f2 0%, #ffffff 100%)'
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 12
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 11, flex: 1, minWidth: 0 }}>
                            <div style={{
                                width: 38,
                                height: 38,
                                borderRadius: 11,
                                background: 'linear-gradient(135deg, #D32F2F 0%, #d94033 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--bg-primary, #fff)',
                                boxShadow: '0 4px 12px -2px rgba(251, 79, 64, 0.4)',
                                flexShrink: 0
                            }}>
                                <Award size={20} strokeWidth={2.5} className="floating-icon" />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                    fontSize: 'var(--font-size-base)',
                                    fontWeight: 700,
                                    color: 'var(--text-primary, #0f172a)',
                                    letterSpacing: '-0.01em',
                                    lineHeight: 1.2
                                }}>
                                    Achievement Status
                                </div>
                                <div style={{
                                    fontSize: 'var(--font-size-xs)',
                                    color: 'var(--text-secondary, #64748b)',
                                    fontWeight: 500,
                                    marginTop: 1
                                }}>
                                    Target tier distribution & performance
                                </div>
                            </div>
                        </div>

                        <Link
                            to="/target-achievement/dashboard"
                            className="section-link-donut"
                            style={{
                                fontSize: 'var(--font-size-xs)',
                                fontWeight: 600,
                                color: 'var(--text-danger, #D32F2F)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                transition: 'all 0.2s',
                                textDecoration: 'none',
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                            }}
                        >
                            Details
                            <ArrowUpRight size={11} strokeWidth={2.5} />
                        </Link>
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════
                    BODY
                ═══════════════════════════════════════════════════ */}
                {targets.length === 0 ? (
                    /* Empty State */
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 40,
                        textAlign: 'center'
                    }}>
                        <div style={{
                            width: 64,
                            height: 64,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 14,
                            border: '2px solid #fbbf24'
                        }}>
                            <Target size={28} style={{ color: 'var(--text-warning, #E65100)' }} strokeWidth={2.5} />
                        </div>
                        <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--text-primary, #0f172a)', marginBottom: 4 }}>
                            No Targets Defined
                        </div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary, #64748b)' }}>
                            Create target plans to see achievement distribution
                        </div>
                    </div>
                ) : (
                    <>
                        {/* ═══════════════════════════════════════════════════
                            DONUT CHART
                        ═══════════════════════════════════════════════════ */}
                        <div style={{
                            padding: '24px 20px 20px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center'
                        }}>
                            <PremiumDonutChart
                                segments={tiers}
                                total={total}
                                overallRate={overallRate}
                                color={overallStatus.color}
                            />

                            {/* Status Badge */}
                            <div
                                className="status-glow"
                                style={{
                                    marginTop: 18,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '6px 14px',
                                    background: overallStatus.bg,
                                    border: `1px solid ${overallStatus.border}`,
                                    borderRadius: 20,
                                    fontSize: 'var(--font-size-xs)',
                                    fontWeight: 700,
                                    color: overallStatus.color,
                                    boxShadow: `0 4px 12px -2px ${overallStatus.color}30`
                                }}
                            >
                                <StatusIcon size={12} strokeWidth={2.5} />
                                {overallStatus.label}
                            </div>

                            <div style={{
                                fontSize: 'var(--font-size-xs)',
                                color: 'var(--text-secondary, #64748b)',
                                fontWeight: 500,
                                marginTop: 6,
                                textAlign: 'center'
                            }}>
                                {overallStatus.message}
                            </div>
                        </div>

                        {/* ═══════════════════════════════════════════════════
                            INSIGHT CARDS (Health summary)
                        ═══════════════════════════════════════════════════ */}
                        {insights && (
                            <div style={{
                                padding: '0 20px 14px',
                                display: 'flex',
                                gap: 8
                            }}>
                                <div style={{
                                    flex: 1,
                                    padding: '10px 12px',
                                    background: insights.isHealthy ? 'var(--bg-success-subtle, #ecfdf5)' : 'var(--bg-warning-subtle, #fffbeb)',
                                    border: `1px solid ${insights.isHealthy ? 'var(--bg-success-subtle, #a7f3d0)' : 'var(--bg-warning-subtle, #fde68a)'}`,
                                    borderRadius: 10
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 5,
                                        marginBottom: 4
                                    }}>
                                        {insights.isHealthy ? (
                                            <CheckCircle2 size={11} style={{ color: '#2E7D32' }} strokeWidth={2.5} />
                                        ) : (
                                            <Activity size={11} style={{ color: '#ED6C02' }} strokeWidth={2.5} />
                                        )}
                                        <span style={{
                                            fontSize: 'var(--font-size-xs)',
                                            fontWeight: 700,
                                            color: insights.isHealthy ? '#2E7D32' : '#E65100',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em'
                                        }}>
                                            Healthy
                                        </span>
                                    </div>
                                    <div style={{
                                        fontSize: 'var(--font-size-lg)',
                                        fontWeight: 700,
                                        color: insights.isHealthy ? '#2E7D32' : '#E65100',
                                        letterSpacing: '-0.3px'
                                    }}>
                                        {insights.healthyCount}/{total}
                                    </div>
                                    <div style={{
                                        fontSize: 'var(--font-size-xs)',
                                        color: 'var(--text-secondary, #64748b)',
                                        fontWeight: 600,
                                        marginTop: 1
                                    }}>
                                        {insights.healthyPct}% performing well
                                    </div>
                                </div>

                                <div style={{
                                    flex: 1,
                                    padding: '10px 12px',
                                    background: parseInt(insights.criticalPct) > 30 ? 'var(--bg-danger-subtle, #fef2f2)' : 'var(--bg-secondary, #f8fafc)',
                                    border: `1px solid ${parseInt(insights.criticalPct) > 30 ? 'var(--bg-danger-subtle, #fecaca)' : 'var(--border-light, var(--border-light, #d9e6e9))'}`,
                                    borderRadius: 10
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 5,
                                        marginBottom: 4
                                    }}>
                                        {parseInt(insights.criticalPct) > 30 ? (
                                            <AlertTriangle size={11} style={{ color: 'var(--text-danger, #D32F2F)' }} strokeWidth={2.5} />
                                        ) : (
                                            <Zap size={11} style={{ color: 'var(--text-secondary, #64748b)' }} strokeWidth={2.5} />
                                        )}
                                        <span style={{
                                            fontSize: 'var(--font-size-xs)',
                                            fontWeight: 700,
                                            color: parseInt(insights.criticalPct) > 30 ? '#D32F2F' : '#64748b',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em'
                                        }}>
                                            Need Focus
                                        </span>
                                    </div>
                                    <div style={{
                                        fontSize: 'var(--font-size-lg)',
                                        fontWeight: 700,
                                        color: parseInt(insights.criticalPct) > 30 ? '#D32F2F' : '#64748b',
                                        letterSpacing: '-0.3px'
                                    }}>
                                        {tiers[3].value}/{total}
                                    </div>
                                    <div style={{
                                        fontSize: 'var(--font-size-xs)',
                                        color: 'var(--text-secondary, #64748b)',
                                        fontWeight: 600,
                                        marginTop: 1
                                    }}>
                                        {insights.criticalPct}% below 50%
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ═══════════════════════════════════════════════════
                            TIER BREAKDOWN ROWS
                        ═══════════════════════════════════════════════════ */}
                        <div style={{
                            padding: '0 20px 16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6
                        }}>
                            <div style={{
                                fontSize: 'var(--font-size-xs)',
                                fontWeight: 700,
                                color: 'var(--text-secondary, #64748b)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.08em',
                                marginBottom: 4,
                                paddingLeft: 2
                            }}>
                                Tier Breakdown
                            </div>
                            {tiers.map((tier) => (
                                <TierRow
                                    key={tier.key}
                                    tier={tier}
                                    total={total}
                                />
                            ))}
                        </div>
                    </>
                )}
            </Card>
        </>
    );
};

export default memo(AchievementDonut);