import React, { useId, useMemo, useRef, useState, useCallback } from 'react';

/**
 * OpsCenter charts — dependency-free SVG primitives tuned for a dense,
 * corporate look. No chart library, no legacy components.
 *
 * TrendChart and Bars are interactive: hover snaps a crosshair to the
 * nearest bucket and renders an HTML tooltip; TrendChart legends toggle
 * series and a `focusKey` emphasises one series (driven by the KPI tiles).
 */

const buildPoints = (data, w, h, padL, padR, padT, padB, max) => {
    const n = data.length;
    if (n === 0) return [];
    if (n === 1) return [[padL, h - padB - ((Number(data[0]) || 0) / max) * (h - padT - padB)]];
    return data.map((v, i) => [
        padL + (i * (w - padL - padR)) / (n - 1),
        h - padB - ((Number(v) || 0) / max) * (h - padT - padB),
    ]);
};

const toPolyline = (pts) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

const niceMax = (v) => {
    if (v <= 0) return 1;
    const pow = 10 ** Math.floor(Math.log10(v));
    const norm = v / pow;
    const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
    return step * pow;
};

/** Axis / tooltip formatters per unit. */
export const fmtByUnit = (v, unit, { full = false } = {}) => {
    const n = Number(v) || 0;
    if (unit === 'pct') return `${n.toFixed(full ? 2 : 1)}%`;
    if (unit === 'x') return `${n.toFixed(2)}×`;
    if (unit === 'inr') {
        if (full) return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
        const a = Math.abs(n);
        if (a >= 1e7) return `₹${(n / 1e7).toFixed(1)}Cr`;
        if (a >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
        if (a >= 1e3) return `₹${(n / 1e3).toFixed(0)}K`;
        return `₹${Math.round(n)}`;
    }
    if (full) return n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
    const a = Math.abs(n);
    if (a >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
    if (a >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
    return `${Math.round(n)}`;
};

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

/** Shared hover→index resolver for SVGs scaled with viewBox. */
const useHoverIndex = (n, W, padL, padR) => {
    const ref = useRef(null);
    const [hover, setHover] = useState(null);
    const onMove = useCallback((e) => {
        if (!ref.current || n === 0) return;
        const rect = ref.current.getBoundingClientRect();
        const xv = ((e.clientX - rect.left) / rect.width) * W;
        const inner = W - padL - padR;
        const rel = Math.max(0, Math.min(1, (xv - padL) / (inner || 1)));
        const idx = n === 1 ? 0 : Math.round(rel * (n - 1));
        setHover({ idx, px: e.clientX - rect.left, py: e.clientY - rect.top, width: rect.width });
    }, [n, W, padL, padR]);
    const onLeave = useCallback(() => setHover(null), []);
    return { ref, hover, onMove, onLeave };
};

const TooltipBox = ({ hover, children, chartHeight }) => {
    if (!hover) return null;
    const flip = hover.px > hover.width * 0.62;
    const style = {
        top: Math.max(4, Math.min((chartHeight || 200) - 60, hover.py - 12)),
        ...(flip ? { right: hover.width - hover.px + 12 } : { left: hover.px + 12 }),
    };
    return (
        <div className="ops-tooltip ops-num" style={style} role="status">
            {children}
        </div>
    );
};

/**
 * Interactive multi-series trend.
 * props:
 *   labels[]            x labels (bucket-aligned)
 *   series [{ key, name, color, data, dashed? }]
 *   unit                'inr' | 'num' | 'pct'  (all series in one chart share a unit)
 *   hidden              Set/array of hidden series keys
 *   onToggle(key)       legend click
 *   focusKey            emphasised series key
 *   onFocus(key)        legend double-click / focus handler (optional)
 *   height
 */
export const TrendChart = ({
    labels = [], series = [], unit = 'inr', hidden = [], onToggle, focusKey, onFocus, height = 230, granularity = 'day',
}) => {
    const W = 760;
    const H = height;
    const padL = 54, padR = 12, padT = 14, padB = 26;
    const n = labels.length;
    const hiddenSet = useMemo(() => new Set(hidden), [hidden]);
    const visible = series.filter((s) => !hiddenSet.has(s.key));
    const all = visible.flatMap((s) => (s.data || []).map((v) => Number(v) || 0));
    const max = niceMax(Math.max(...all, unit === 'pct' ? 5 : 1));
    const gridLines = [0.25, 0.5, 0.75, 1].map((f) => f * max);
    const { ref, hover, onMove, onLeave } = useHoverIndex(n, W, padL, padR);

    const xLabels = [];
    if (n > 0) {
        const step = Math.max(1, Math.ceil(n / 7));
        for (let i = n - 1; i >= 0; i -= step) xLabels.unshift(i);
        if (!xLabels.includes(0)) xLabels.unshift(0);
    }
    const xAt = (i) => padL + (i * (W - padL - padR)) / Math.max(n - 1, 1);

    const focused = focusKey && visible.some((s) => s.key === focusKey) ? focusKey : null;

    return (
        <div className="ops-chart">
            <svg
                ref={ref}
                width="100%"
                viewBox={`0 0 ${W} ${H}`}
                role="img"
                aria-label="trend chart"
                onMouseMove={onMove}
                onMouseLeave={onLeave}
            >
                {gridLines.map((v) => {
                    const y = H - padB - (v / max) * (H - padT - padB);
                    return (
                        <g key={v}>
                            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#eef1f5" strokeWidth="1" />
                            <text x={padL - 7} y={y + 3} textAnchor="end" fontSize="9.5" fill="#8896ab" className="ops-num">
                                {fmtByUnit(v, unit)}
                            </text>
                        </g>
                    );
                })}
                <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="#e3e8ee" strokeWidth="1" />
                {visible.map((s, si) => {
                    const pts = buildPoints(s.data || [], W, H, padL, padR, padT, padB, max);
                    if (pts.length === 0) return null;
                    const line = toPolyline(pts);
                    const dim = focused && focused !== s.key;
                    const isFocus = focused === s.key;
                    return (
                        <g key={s.key || si} opacity={dim ? 0.28 : 1}>
                            {(si === 0 || isFocus) && pts.length > 1 && (
                                <polygon
                                    points={`${padL},${H - padB} ${line} ${pts[pts.length - 1][0]},${H - padB}`}
                                    fill={s.color}
                                    fillOpacity={isFocus ? 0.12 : 0.07}
                                />
                            )}
                            <polyline
                                points={line}
                                fill="none"
                                stroke={s.color}
                                strokeWidth={isFocus ? 2.6 : 1.8}
                                strokeDasharray={s.dashed ? '4 3' : undefined}
                                strokeLinejoin="round"
                                strokeLinecap="round"
                            />
                            {pts.length === 1 && <circle cx={pts[0][0]} cy={pts[0][1]} r="3" fill={s.color} />}
                        </g>
                    );
                })}
                {hover && n > 0 && (
                    <g>
                        <line x1={xAt(hover.idx)} y1={padT} x2={xAt(hover.idx)} y2={H - padB} stroke="#51607a" strokeWidth="1" strokeDasharray="3 3" />
                        {visible.map((s) => {
                            const v = Number((s.data || [])[hover.idx]) || 0;
                            const y = H - padB - (v / max) * (H - padT - padB);
                            return <circle key={s.key} cx={xAt(hover.idx)} cy={y} r="3.5" fill="#fff" stroke={s.color} strokeWidth="2" />;
                        })}
                    </g>
                )}
                {xLabels.map((i) => (
                    <text key={i} x={xAt(i)} y={H - 8} textAnchor="middle" fontSize="9.5" fill="#8896ab">
                        {labels[i]}
                    </text>
                ))}
            </svg>

            <TooltipBox hover={hover} chartHeight={H}>
                <div className="ops-tooltip__title">
                    {labels[hover?.idx]}{granularity === 'week' ? ' · week' : ''}
                </div>
                {visible.map((s) => (
                    <div className="ops-tooltip__row" key={s.key}>
                        <i style={{ background: s.color }} />
                        <span>{s.name}</span>
                        <b>{fmtByUnit((s.data || [])[hover?.idx], unit, { full: true })}</b>
                    </div>
                ))}
            </TooltipBox>

            <div className="ops-legend" style={{ marginTop: 4 }}>
                {series.map((s) => {
                    const off = hiddenSet.has(s.key);
                    const total = (s.data || []).reduce((a, b) => a + (Number(b) || 0), 0);
                    const summary = unit === 'pct'
                        ? `avg ${fmtByUnit(total / Math.max((s.data || []).filter((v) => Number(v) > 0).length, 1), unit)}`
                        : fmtByUnit(total, unit);
                    return (
                        <button
                            key={s.key}
                            type="button"
                            className={`ops-legend__btn ${off ? 'ops-legend__btn--off' : ''} ${focused === s.key ? 'ops-legend__btn--focus' : ''}`}
                            onClick={() => onToggle && onToggle(s.key)}
                            onDoubleClick={() => onFocus && onFocus(s.key)}
                            aria-pressed={!off}
                            title={off ? 'Show series' : 'Hide series (double-click to focus)'}
                        >
                            <i style={{ background: s.color }} />
                            {s.name}
                            {' '}
                            <b className="ops-num">{summary}</b>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

/**
 * Hoverable bar chart (used for per-ASIN GMS drill-down).
 * props: labels[], data[], color, height, unit, secondary? [{name, data, unit}]
 */
export const Bars = ({ labels = [], data = [], color = '#1349c6', height = 120, unit = 'inr', secondary = [] }) => {
    const W = 760;
    const H = height;
    const padL = 46, padR = 6, padT = 8, padB = 20;
    const n = data.length;
    const clean = data.map((v) => Number(v) || 0);
    const max = niceMax(Math.max(...clean, 1));
    const { ref, hover, onMove, onLeave } = useHoverIndex(n, W, padL, padR);
    const inner = W - padL - padR;
    const slot = n > 0 ? inner / n : inner;
    const bw = Math.max(1.5, Math.min(18, slot * 0.66));
    const xLabels = [];
    if (n > 0) {
        const step = Math.max(1, Math.ceil(n / 8));
        for (let i = n - 1; i >= 0; i -= step) xLabels.unshift(i);
        if (!xLabels.includes(0)) xLabels.unshift(0);
    }

    return (
        <div className="ops-chart">
            <svg ref={ref} width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="bar chart" onMouseMove={onMove} onMouseLeave={onLeave}>
                {[0.5, 1].map((f) => {
                    const y = H - padB - f * (H - padT - padB);
                    return (
                        <g key={f}>
                            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#eef1f5" />
                            <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#8896ab" className="ops-num">{fmtByUnit(f * max, unit)}</text>
                        </g>
                    );
                })}
                <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="#e3e8ee" />
                {clean.map((v, i) => {
                    const h = (v / max) * (H - padT - padB);
                    const x = padL + i * slot + (slot - bw) / 2;
                    const active = hover && hover.idx === i;
                    return (
                        <rect
                            key={i}
                            x={x}
                            y={H - padB - h}
                            width={bw}
                            height={Math.max(0, h)}
                            fill={color}
                            opacity={hover ? (active ? 1 : 0.45) : 0.85}
                            rx="1"
                        />
                    );
                })}
                {xLabels.map((i) => (
                    <text key={i} x={padL + i * slot + slot / 2} y={H - 6} textAnchor="middle" fontSize="9" fill="#8896ab">{labels[i]}</text>
                ))}
            </svg>
            <TooltipBox hover={hover} chartHeight={H}>
                <div className="ops-tooltip__title">{labels[hover?.idx]}</div>
                <div className="ops-tooltip__row">
                    <i style={{ background: color }} />
                    <span>GMS</span>
                    <b>{fmtByUnit(clean[hover?.idx], unit, { full: true })}</b>
                </div>
                {secondary.map((s) => (
                    <div className="ops-tooltip__row" key={s.name}>
                        <i style={{ background: s.color || '#8896ab' }} />
                        <span>{s.name}</span>
                        <b>{fmtByUnit((s.data || [])[hover?.idx], s.unit || 'num', { full: true })}</b>
                    </div>
                ))}
            </TooltipBox>
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
