import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Tooltip } from 'antd';

/**
 * OpsCenter primitives — formatting helpers and the small structural
 * components the dashboard is built from. Entirely self-contained:
 * nothing here imports from the legacy dashboard components.
 */

// ── Formatting ────────────────────────────────────────────────────────

/** Compact Indian currency: ₹12.3K / ₹4.56L / ₹7.89Cr */
export const fmtINR = (n) => {
    const v = Number(n) || 0;
    const a = Math.abs(v);
    if (a >= 1e7) return `₹${(v / 1e7).toFixed(2)}Cr`;
    if (a >= 1e5) return `₹${(v / 1e5).toFixed(2)}L`;
    if (a >= 1e3) return `₹${(v / 1e3).toFixed(1)}K`;
    return `₹${Math.round(v)}`;
};

/** Full Indian-grouped currency: ₹12,34,567 */
export const fmtINRFull = (n, digits = 0) => {
    const v = Number(n) || 0;
    return `₹${v.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
};

/** Compact integer: 1.2K / 34.5K / 1.2M */
export const fmtNum = (n) => {
    const v = Number(n) || 0;
    const a = Math.abs(v);
    if (a >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
    if (a >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
    return `${Math.round(v)}`;
};

/** Full grouped integer: 12,34,567 */
export const fmtNumFull = (n) => (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

export const fmtPct = (n, digits = 1) => `${(Number(n) || 0).toFixed(digits)}%`;

/** Relative change in % — null when there is no prior value (never a fake 0). */
export const pctDelta = (cur, prev) => {
    const c = Number(cur) || 0;
    const p = Number(prev) || 0;
    if (p <= 0) return null;
    return ((c - p) / p) * 100;
};

/** Absolute change in points for ratio metrics (ACoS, TACoS) — null when no prior. */
export const pointDelta = (cur, prev) => {
    if (prev === null || prev === undefined) return null;
    const p = Number(prev);
    if (!Number.isFinite(p) || p === 0) return null;
    return (Number(cur) || 0) - p;
};

export const timeAgo = (date) => {
    if (!date) return '—';
    const diff = Date.now() - new Date(date).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
};

/** Wall-clock that refreshes on an interval — keeps "overdue" flags honest
 *  on long-lived tabs while staying pure during render. */
export const useNow = (intervalMs = 30000) => {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), intervalMs);
        return () => clearInterval(id);
    }, [intervalMs]);
    return now;
};

// ── Palette (single source for charts + chips) ────────────────────────

export const OPS_COLOR = {
    accent: '#1349c6',
    accentSoft: '#e8eefb',
    pos: '#067647',
    neg: '#d92d20',
    warn: '#b54708',
    ink3: '#8896ab',
    line: '#e3e8ee',
    slate: '#51607a',
    violet: '#6172f3',
    teal: '#0e7490',
};

export const TASK_STATUS_COLORS = {
    COMPLETED: '#067647',
    IN_PROGRESS: '#1349c6',
    IN_REVIEW: '#b54708',
    PENDING: '#98a2b3',
    TODO: '#c7d0dc',
    CANCELLED: '#475467',
};

export const PIPELINE_COLORS = {
    running: '#1349c6',
    completed: '#067647',
    failed: '#d92d20',
    idle: '#c7d0dc',
};

export const PRIORITY_CHIP = {
    HIGH: { bg: '#fdecea', fg: '#b42318' },
    MEDIUM: { bg: '#fef0e6', fg: '#b54708' },
    LOW: { bg: '#eef1f5', fg: '#51607a' },
};

// ── Structure ─────────────────────────────────────────────────────────

/** A grid panel with an uppercase kicker header, right-side meta, optional
 *  header actions and an optional drill-down link. `id` lets insights and
 *  KPI tiles scroll the panel into view. */
export const Panel = ({ id, span = 6, kicker, meta, actions, linkTo, linkLabel, children, minHeight, className = '' }) => (
    <section
        id={id}
        className={`ops-panel ${className}`}
        style={{ gridColumn: `span ${span}`, minHeight: minHeight || undefined }}
    >
        {(kicker || meta || linkTo || actions) && (
            <div className="ops-panel__head">
                <span className="ops-panel__kicker">{kicker}</span>
                <span className="ops-panel__meta">
                    {meta}
                    {actions}
                    {linkTo && (
                        <Link className="ops-link" to={linkTo}>{linkLabel || 'View all'} →</Link>
                    )}
                </span>
            </div>
        )}
        {children}
    </section>
);

/** Honest mini-state: error (with retry) or genuinely-empty, so a failed
 *  query never masquerades as "no activity". */
export const MiniState = ({ tone = 'empty', title, note, onRetry }) => (
    <div className={`ops-mini ops-mini--${tone}`}>
        <span className="ops-mini__label">{title}</span>
        {note && <span className="ops-mini__note">{note}</span>}
        {onRetry && (
            <button type="button" className="ops-retry" onClick={onRetry}>Retry</button>
        )}
    </div>
);

/** Definition tooltip — wraps any label with an explanation. */
export const Tip = ({ text, children }) => (
    <Tooltip title={text} mouseEnterDelay={0.25}>
        <span className="ops-tip">{children}</span>
    </Tooltip>
);

/**
 * Period-over-period delta chip.
 *  value   – relative % (or points when `points`), null → "no prior data"
 *  invert  – lower is better (ACoS, TACoS): negative renders green
 *  neutral – informative only (Ad spend): no good/bad colouring
 */
export const Delta = ({ value, invert = false, neutral = false, points = false, compact = false, label }) => {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) {
        return <span className="ops-delta ops-delta--none">{compact ? '—' : 'no prior data'}</span>;
    }
    const v = Number(value);
    const up = v > 0.05;
    const down = v < -0.05;
    const good = neutral ? null : (invert ? down : up);
    const tone = (!up && !down) ? 'flat' : neutral ? 'neutral' : good ? 'pos' : 'neg';
    const arrow = up ? '▲' : down ? '▼' : '■';
    const mag = Math.abs(v);
    const text = points ? `${mag.toFixed(1)} pts` : `${mag >= 100 ? mag.toFixed(0) : mag.toFixed(1)}%`;
    return (
        <span className={`ops-delta ops-delta--${tone} ops-num`} title={label}>
            {arrow} {text}{label && !compact ? <em> {label}</em> : null}
        </span>
    );
};

/** KPI tile: uppercase label, big tabular value, sub line, delta, sparkline.
 *  Clickable tiles drive the trend chart focus. */
export const Tile = ({ label, value, unit, sub, spark, span, delta, active, onClick, tip }) => {
    const clickable = typeof onClick === 'function';
    return (
        <div
            className={`ops-panel ops-tile ${clickable ? 'ops-tile--clickable' : ''} ${active ? 'ops-tile--active' : ''}`}
            style={span ? { gridColumn: `span ${span}` } : undefined}
            onClick={onClick}
            onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : undefined}
            aria-pressed={clickable ? !!active : undefined}
        >
            <div className="ops-tile__top">
                <span className="ops-tile__label">{tip ? <Tip text={tip}>{label}</Tip> : label}</span>
                {delta}
            </div>
            <div className="ops-tile__value ops-num">
                {value}
                {unit && <small> {unit}</small>}
            </div>
            {sub && <div className="ops-tile__sub ops-num">{sub}</div>}
            {spark && <div className="ops-tile__spark">{spark}</div>}
        </div>
    );
};

/** Chip with fixed palette lookup. */
export const Chip = ({ label, palette }) => {
    const c = palette?.[String(label || '').toUpperCase()] || { bg: '#eef1f5', fg: '#51607a' };
    return (
        <span className="ops-chip" style={{ background: c.bg, color: c.fg }}>
            {String(label || '—').toUpperCase()}
        </span>
    );
};

/** Compact segmented control (hand-rolled to keep the flat corporate look). */
export const Segmented = ({ options, value, onChange, ariaLabel }) => (
    <div className="ops-seg" role="tablist" aria-label={ariaLabel}>
        {options.map((o) => (
            <button
                key={o.value}
                type="button"
                role="tab"
                aria-selected={value === o.value}
                className={`ops-seg__btn ${value === o.value ? 'ops-seg__btn--on' : ''}`}
                onClick={() => onChange(o.value)}
                title={o.title}
            >
                {o.label}
            </button>
        ))}
    </div>
);

/**
 * Segmented horizontal bar + legend. segments: [{ key?, label, value, color }]
 * When `onSelect` is given the legend entries become filters; `selected`
 * highlights the active one (click again to clear).
 */
export const SegmentedBar = ({ segments, total, onSelect, selected }) => {
    const t = total ?? segments.reduce((s, x) => s + x.value, 0);
    const keyOf = (s) => s.key ?? s.label;
    return (
        <div>
            <div className="ops-segbar" role="img" aria-label="status distribution">
                {t > 0 && segments.filter(s => s.value > 0).map((s) => (
                    <i
                        key={keyOf(s)}
                        style={{
                            width: `${(s.value / t) * 100}%`,
                            background: s.color,
                            opacity: selected && selected !== keyOf(s) ? 0.3 : 1,
                        }}
                    />
                ))}
            </div>
            <div className="ops-seglegend">
                {segments.map((s) => {
                    const k = keyOf(s);
                    const inner = (
                        <>
                            <i className="ops-seglegend__dot" style={{ background: s.color }} />
                            {s.label} <b className="ops-num">{s.value}</b>
                        </>
                    );
                    return onSelect ? (
                        <button
                            key={k}
                            type="button"
                            className={`ops-seglegend__btn ${selected === k ? 'ops-seglegend__btn--on' : ''}`}
                            onClick={() => onSelect(selected === k ? null : k)}
                            aria-pressed={selected === k}
                        >
                            {inner}
                        </button>
                    ) : (
                        <span key={k}>{inner}</span>
                    );
                })}
            </div>
        </div>
    );
};

/** Sortable table header cell. */
export const SortHeader = ({ label, sortKey, activeKey, dir, onSort, numeric, tip, width }) => {
    const active = activeKey === sortKey;
    return (
        <th
            className={`${numeric ? 'ops-table__num' : ''} ops-table__sortable ${active ? 'ops-table__sortable--on' : ''}`}
            style={width ? { width } : undefined}
            aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
        >
            <button type="button" className="ops-table__sortbtn" onClick={() => onSort(sortKey)}>
                {tip ? <Tip text={tip}>{label}</Tip> : label}
                <span className="ops-table__sorticon" aria-hidden="true">
                    {active ? (dir === 'asc' ? '↑' : '↓') : '↕'}
                </span>
            </button>
        </th>
    );
};

/** Small inline share bar used inside table cells / leaderboards. */
export const ShareBar = ({ pct, color = OPS_COLOR.accent, max = 100 }) => (
    <span className="ops-sharebar" aria-hidden="true">
        <i style={{ width: `${Math.max(0, Math.min(100, (Number(pct) || 0) / (max || 100) * 100))}%`, background: color }} />
    </span>
);

/** Skeleton placeholder page shown until the orchestration loader hydrates. */
export const SkeletonPage = () => (
    <div className="ops">
        <div className="ops-head">
            <div style={{ flex: 1 }}>
                <div className="ops-skel" style={{ width: 280, height: 22 }} />
                <div className="ops-skel" style={{ width: 380, height: 12, marginTop: 8 }} />
            </div>
            <div className="ops-skel" style={{ width: 420, height: 30 }} />
        </div>
        <div className="ops-grid">
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="ops-panel" style={{ gridColumn: 'span 2', minHeight: 108 }}>
                    <div className="ops-skel" style={{ width: '60%', height: 10 }} />
                    <div className="ops-skel" style={{ width: '80%', height: 22, marginTop: 12 }} />
                    <div className="ops-skel" style={{ width: '45%', height: 10, marginTop: 10 }} />
                </div>
            ))}
            <div className="ops-panel" style={{ gridColumn: 'span 8', minHeight: 260 }}>
                <div className="ops-skel" style={{ width: 180, height: 11 }} />
                <div className="ops-skel" style={{ width: '100%', height: 200, marginTop: 14 }} />
            </div>
            <div className="ops-panel" style={{ gridColumn: 'span 4', minHeight: 260 }}>
                <div className="ops-skel" style={{ width: 140, height: 11 }} />
                <div className="ops-skel" style={{ width: '100%', height: 200, marginTop: 14 }} />
            </div>
            <div className="ops-panel" style={{ gridColumn: 'span 12', minHeight: 300 }}>
                <div className="ops-skel" style={{ width: 160, height: 11 }} />
                <div className="ops-skel" style={{ width: '100%', height: 240, marginTop: 14 }} />
            </div>
        </div>
    </div>
);
