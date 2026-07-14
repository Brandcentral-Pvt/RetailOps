import React, { memo } from 'react';
import { Tooltip } from 'antd';
import { Target } from 'lucide-react';
import useAnimatedCounter from './shared/hooks/useAnimatedCounter';

const PremiumDonutChart = memo(({ segments, total, overallRate, color }) => {
    const size = 200;
    const strokeWidth = 22;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const center = size / 2;

    let accumulated = 0;
    const segmentData = segments
        .filter(s => s.value > 0)
        .map(s => {
            const pct = total > 0 ? s.value / total : 0;
            const length = pct * circumference;
            const offset = -accumulated;
            accumulated += length;
            return {
                ...s,
                length,
                offset,
                pct
            };
        });

    const animatedRate = useAnimatedCounter(overallRate, 1500);

    return (
        <div style={{
            position: 'relative',
            width: size,
            height: size,
            margin: '0 auto'
        }}>
            <div style={{
                position: 'absolute',
                inset: '-10px',
                background: `radial-gradient(circle, ${color}15 0%, transparent 70%)`,
                borderRadius: '50%',
                pointerEvents: 'none'
            }} />

            <svg
                width={size}
                height={size}
                style={{ transform: 'rotate(-90deg)', position: 'relative' }}
            >
                <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke="#f1f5f9"
                    strokeWidth={strokeWidth}
                />

                {segmentData.map((seg, i) => (
                    <Tooltip key={i} title={`${seg.label}: ${seg.value} (${(seg.pct * 100).toFixed(1)}%)`}>
                        <circle
                            cx={center}
                            cy={center}
                            r={radius}
                            fill="none"
                            stroke={seg.color}
                            strokeWidth={strokeWidth}
                            strokeDasharray={`${seg.length} ${circumference}`}
                            strokeDashoffset={seg.offset}
                            strokeLinecap="butt"
                            style={{
                                cursor: 'pointer',
                                transition: 'stroke-width 0.2s, opacity 0.2s',
                                opacity: 0.95
                            }}
                            className="donut-segment"
                        />
                    </Tooltip>
                ))}

                <circle
                    cx={center}
                    cy={center}
                    r={radius - strokeWidth / 2 - 4}
                    fill="none"
                    stroke="#f1f5f9"
                    strokeWidth="1"
                    strokeDasharray="2 4"
                    opacity="0.5"
                />
            </svg>

            <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none'
            }}>
                <div style={{
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 700,
                    color: 'var(--text-secondary, #64748b)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    marginBottom: 2
                }}>
                    Overall
                </div>
                <div style={{
                    fontSize: 36,
                    fontWeight: 700,
                    color,
                    letterSpacing: '-1.5px',
                    lineHeight: 1,
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 2
                }}>
                    {animatedRate.toFixed(1)}
                    <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginLeft: 2 }}>%</span>
                </div>
                <div style={{
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 600,
                    color: 'var(--text-secondary, #64748b)',
                    marginTop: 6,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    background: `${color}10`,
                    border: `1px solid ${color}25`,
                    padding: '2px 8px',
                    borderRadius: 10
                }}>
                    <Target size={10} strokeWidth={2.5} style={{ color }} />
                    {total} {total === 1 ? 'plan' : 'plans'}
                </div>
            </div>
        </div>
    );
});

export default memo(PremiumDonutChart);
