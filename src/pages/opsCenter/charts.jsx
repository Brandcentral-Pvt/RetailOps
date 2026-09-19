import React, { useId } from 'react';

/**
 * OpsCenter charts — dependency-free SVG primitives tuned for a dense,
 * corporate look. No chart library, no legacy components.
 */

const buildPoints = (data, w, h, padL, padR, padT, padB, max) => {
    const n = data.length;
    if (n === 0) return [];
    if (n === 1) return [[padL, h - padB]];
    return data.map((v, i) => [
        padL + (i * (w - padL - padR)) / (n - 1),
        h - padB - ((Number(v) || 0) / max) * (h - padT - padB),
    ]);
};

const toPolyline = (pts) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

/** Tiny inline trend line. data: number[] */
export const Sparkline = ({ data = [], width = 220, height = 30, color = '#1349c6', filled = true }) => {
    const gid = useId().replace(/[:]/g, '');
    const clean = (data || []).map((v) => Number(v) || 0);
    if (clean.length < 2) {
        return <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true" />;
    }
    const max = Math.max(...clean, 1);
    const padT = 3, padB = 3, padL = 1, padR = 1;
    const pts = buildPoints(clean, width, height, padL, padR, padT, padB, max);
    const line = toPolyline(pts);
    const area = `${padL},${height - padB} ${line} ${width - padR},${height - padB}`;
    return (
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
            {filled && (
                <>
                    <defs>
                        <linearGradient id={`sg-${gid}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
                            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
                        </linearGradient>
                    </defs>
                    <polygon points={area} fill={`url(#sg-${gid})`} />
                </>
            )}
            <polyline
                points={line}
                fill="none"
                stroke={color}
                strokeWidth="1.6"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
            />
        </svg>
    );
};

const niceMax = (v) => {
    if (v <= 0) return 1;
    const pow = 10 ** Math.floor(Math.log10(v));
    return Math.ceil(v / pow) * pow;
};

/**
 * Dual-series corporate trend: filled area for series[0], line for the rest.
 * props: labels[], series [{ name, color, data }], height
 */
export const TrendChart = ({ labels = [], series = [], height = 230 }) => {
    const W = 760;
    const H = height;
    const padL = 52, padR = 10, padT = 12, padB = 24;
    const n = labels.length;
    const all = series.flatMap((s) => (s.data || []).map((v) => Number(v) || 0));
    const max = niceMax(Math.max(...all, 1));
    const gridLines = [0.25, 0.5, 0.75, 1].map((f) => f * max);

    const xLabels = [];
    if (n > 0) {
        const step = Math.max(1, Math.ceil(n / 6));
        for (let i = n - 1; i >= 0; i -= step) xLabels.unshift(i);
        if (!xLabels.includes(0)) xLabels.unshift(0);
    }

    const fmtAxis = (v) => {
        if (v >= 1e7) return `${(v / 1e7).toFixed(1)}Cr`;
        if (v >= 1e5) return `${(v / 1e5).toFixed(1)}L`;
        if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
        return `${Math.round(v)}`;
    };

    return (
        <div>
            <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="revenue and spend trend">
                {gridLines.map((v) => {
                    const y = H - padB - (v / max) * (H - padT - padB);
                    return (
                        <g key={v}>
                            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#eef1f5" strokeWidth="1" />
                            <text x={padL - 7} y={y + 3} textAnchor="end" fontSize="9.5" fill="#8896ab" className="ops-num">
                                {fmtAxis(v)}
                            </text>
                        </g>
                    );
                })}
                {series.map((s, si) => {
                    const pts = buildPoints(s.data || [], W, H, padL, padR, padT, padB, max);
                    if (pts.length === 0) return null;
                    const line = toPolyline(pts);
                    return (
                        <g key={s.name || si}>
                            {si === 0 && (
                                <polygon
                                    points={`${padL},${H - padB} ${line} ${W - padR},${H - padB}`}
                                    fill={s.color}
                                    fillOpacity="0.08"
                                />
                            )}
                            <polyline
                                points={line}
                                fill="none"
                                stroke={s.color}
                                strokeWidth="1.8"
                                strokeLinejoin="round"
                                strokeLinecap="round"
                            />
                        </g>
                    );
                })}
                {xLabels.map((i) => {
                    const x = padL + (i * (W - padL - padR)) / Math.max(n - 1, 1);
                    return (
                        <text key={i} x={x} y={H - 7} textAnchor="middle" fontSize="9.5" fill="#8896ab">
                            {labels[i]}
                        </text>
                    );
                })}
            </svg>
            <div className="ops-legend" style={{ marginTop: 4 }}>
                {series.map((s, si) => (
                    <span key={s.name || si}>
                        <i style={{ background: s.color }} />
                        {s.name}
                        {' '}
                        <b className="ops-num">{fmtAxis((s.data || []).reduce((a, b) => a + (Number(b) || 0), 0))}</b>
                    </span>
                ))}
            </div>
        </div>
    );
};

/** Progress ring. pct: 0-100+ (clamped visually at 100 for the arc). */
export const Ring = ({ pct, size = 92, stroke = 9, color = '#1349c6', trackColor = '#eef1f5', label }) => {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const clamped = Math.max(0, Math.min(100, Number(pct) || 0));
    return (
        <svg width={size} height={size} role="img" aria-label={`${label || 'achievement'} ${clamped}%`}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
            <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={color}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={`${(c * clamped) / 100} ${c}`}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
            <text x="50%" y="47%" textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.21} fontWeight="700" fill="#0f172a" className="ops-num">
                {Math.round(Number(pct) || 0)}%
            </text>
            {label && (
                <text x="50%" y="66%" textAnchor="middle" fontSize={size * 0.11} fill="#8896ab">
                    {label}
                </text>
            )}
        </svg>
    );
};
