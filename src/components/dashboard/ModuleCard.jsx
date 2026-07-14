import React, { memo } from 'react';
import { ChevronRight, Activity, ArrowUpRight } from 'lucide-react';
import CircularRing from './shared/CircularRing';
import StatMini from './shared/StatMini';
import SegmentedProgress from './shared/SegmentedProgress';

const ModuleCard = memo(({ module, onClick }) => {
    const {
        title, subtitle, icon: Icon, color, gradient, badge,
        primaryMetric, stats, segments, progress, statusText, statusColor,
        hasAnimation
    } = module;

    return (
        <div
            onClick={onClick}
            className="module-card"
            style={{
                position: 'relative',
                background: 'var(--bg-primary, #fff)',
                borderRadius: "var(--radius-xl)",
                border: '1px solid var(--border-light, #d9e6e9)',
                overflow: 'hidden',
                cursor: 'pointer',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
        >
            {/* Top gradient accent */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 4,
                background: gradient || color,
                borderRadius: '16px 16px 0 0'
            }} />

            {/* Top section: Icon + Title + Badge */}
            <div style={{ padding: '18px 18px 12px' }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    marginBottom: 14
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11, flex: 1, minWidth: 0 }}>
                        <div style={{
                            width: 42,
                            height: 42,
                            borderRadius: "var(--radius-lg)",
                            background: gradient || `${color}15`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: gradient ? 'var(--bg-primary, #fff)' : color,
                            flexShrink: 0,
                            boxShadow: gradient ? `0 4px 12px -2px ${color}40` : 'none'
                        }}>
                            <Icon
                                size={20}
                                strokeWidth={2.5}
                                className={hasAnimation ? 'rotating-icon' : ''}
                            />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                                fontSize: 'var(--font-size-base)',
                                fontWeight: 700,
                                color: 'var(--text-primary, #0f172a)',
                                letterSpacing: '-0.01em',
                                lineHeight: 1.2,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            }}>
                                {title}
                            </div>
                            {subtitle && (
                                <div style={{
                                    fontSize: 'var(--font-size-xs)',
                                    color: 'var(--text-secondary, #64748b)',
                                    fontWeight: 500,
                                    marginTop: 2,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }}>
                                    {subtitle}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Status Badge / Action arrow */}
                    {badge ? (
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '3px 8px',
                            background: `${badge.color}15`,
                            border: `1px solid ${badge.color}30`,
                            borderRadius: "var(--radius-lg)",
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 600,
                            color: badge.color,
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                        }}>
                            {badge.icon && <badge.icon size={10} strokeWidth={2.5} />}
                            {badge.text}
                        </div>
                    ) : (
                        <div className="action-arrow" style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            background: 'var(--bg-secondary, #f8fafc)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-tertiary, #94a3b8)',
                            transition: 'all 0.2s'
                        }}>
                            <ChevronRight size={14} strokeWidth={2.5} />
                        </div>
                    )}
                </div>

                {/* Primary Metric (Big number with optional ring) */}
                {primaryMetric && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        padding: '12px 14px',
                        background: `linear-gradient(135deg, ${color}06 0%, ${color}02 100%)`,
                        border: `1px solid ${color}15`,
                        borderRadius: "var(--radius-lg)",
                        marginBottom: 12
                    }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                                fontSize: 'var(--font-size-xs)',
                                fontWeight: 600,
                                color: 'var(--text-secondary, #64748b)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.06em',
                                marginBottom: 2
                            }}>
                                {primaryMetric.label}
                            </div>
                            <div style={{
                                fontSize: 22,
                                fontWeight: 700,
                                color: 'var(--text-primary, #0f172a)',
                                letterSpacing: '-0.5px',
                                lineHeight: 1,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            }}>
                                {primaryMetric.value}
                            </div>
                            {primaryMetric.subValue && (
                                <div style={{
                                    fontSize: 'var(--font-size-xs)',
                                    color: 'var(--text-secondary, #64748b)',
                                    fontWeight: 500,
                                    marginTop: 3
                                }}>
                                    {primaryMetric.subValue}
                                </div>
                            )}
                        </div>
                        {progress !== undefined && (
                            <CircularRing
                                percent={progress}
                                color={color}
                                size={50}
                                strokeWidth={4}
                            />
                        )}
                    </div>
                )}

                {/* Stats Grid (2x2 mini stat blocks) */}
                {stats && stats.length > 0 && (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: 6,
                        marginBottom: segments && segments.length > 0 ? 12 : 0
                    }}>
                        {stats.map((s, i) => (
                            <StatMini
                                key={i}
                                label={s.label}
                                value={s.value}
                                color={s.color}
                                icon={s.icon}
                                pulse={s.pulse}
                                animate={s.animate}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Bottom: Segmented progress + Status */}
            {(segments || statusText) && (
                <div style={{
                    padding: '12px 18px 14px',
                    background: 'var(--bg-secondary, #f8fafc)',
                    borderTop: '1px solid var(--border-light, #d9e6e9)',
                    marginTop: 'auto'
                }}>
                    {segments && segments.length > 0 && (
                        <>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: 6
                            }}>
                                <span style={{
                                    fontSize: 'var(--font-size-xs)',
                                    fontWeight: 600,
                                    color: 'var(--text-secondary, #64748b)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                }}>
                                    Distribution
                                </span>
                                {statusText && (
                                    <span style={{
                                        fontSize: 'var(--font-size-xs)',
                                        fontWeight: 600,
                                        color: statusColor || 'var(--text-secondary, #64748b)',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 3
                                    }}>
                                        <Activity size={9} />
                                        {statusText}
                                    </span>
                                )}
                            </div>
                            <SegmentedProgress segments={segments} height={6} />
                            <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '4px 10px',
                                marginTop: 8
                            }}>
                                {segments.map((seg, i) => (
                                    <div key={i} style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        fontSize: 'var(--font-size-xs)',
                                        fontWeight: 600,
                                        color: 'var(--text-secondary, #64748b)'
                                    }}>
                                        <div style={{
                                            width: 6,
                                            height: 6,
                                            borderRadius: '50%',
                                            background: seg.color
                                        }} />
                                        <span style={{ color: seg.color }}>{seg.value}</span>
                                        <span>{seg.label}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {!segments && statusText && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <span style={{
                                fontSize: 'var(--font-size-xs)',
                                fontWeight: 600,
                                color: statusColor || 'var(--text-secondary, #64748b)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4
                            }}>
                                <Activity size={11} />
                                {statusText}
                            </span>
                            <span style={{
                                fontSize: 'var(--font-size-xs)',
                                fontWeight: 600,
                                color: 'var(--text-tertiary, #94a3b8)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3
                            }}>
                                View Details
                                <ArrowUpRight size={11} strokeWidth={2.5} />
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});

export default ModuleCard;
