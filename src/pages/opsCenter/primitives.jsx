import React from 'react';
import { Link } from 'react-router-dom';

/**
 * OpsCenter primitives — formatting helpers and the small structural
 * components the new dashboard is built from. Entirely self-contained:
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

/** Compact integer: 1.2K / 34.5K / 1.2M */
export const fmtNum = (n) => {
    const v = Number(n) || 0;
    const a = Math.abs(v);
    if (a >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
    if (a >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
    return `${Math.round(v)}`;
};

export const fmtPct = (n, digits = 1) => `${(Number(n) || 0).toFixed(digits)}%`;

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

/** A grid panel with an uppercase kicker header, right-side meta and an
 *  optional drill-down link ({ to, label }). */
export const Panel = ({ span = 6, kicker, meta, linkTo, linkLabel, children, minHeight }) => (
    <section className="ops-panel" style={{ gridColumn: `span ${span}`, minHeight: minHeight || undefined }}>
        {(kicker || meta || linkTo) && (
            <div className="ops-panel__head">
                <span className="ops-panel__kicker">{kicker}</span>
                <span className="ops-panel__meta">
                    {meta}
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

/** KPI tile: uppercase label, big tabular value, sub line, sparkline slot. */
export const Tile = ({ label, value, unit, sub, spark, span }) => (
    <div className="ops-panel ops-tile" style={span ? { gridColumn: `span ${span}` } : undefined}>
        <span className="ops-tile__label">{label}</span>
        <div className="ops-tile__value ops-num">
            {value}
            {unit && <small> {unit}</small>}
        </div>
        {sub && <div className="ops-tile__sub ops-num">{sub}</div>}
        {spark && <div className="ops-tile__spark">{spark}</div>}
    </div>
);

/** Chip with fixed palette lookup. */
export const Chip = ({ label, palette }) => {
    const c = palette?.[String(label || '').toUpperCase()] || { bg: '#eef1f5', fg: '#51607a' };
    return (
        <span className="ops-chip" style={{ background: c.bg, color: c.fg }}>
            {String(label || '—').toUpperCase()}
        </span>
    );
};

/** Segmented horizontal bar + legend. segments: [{ label, value, color }] */
export const SegmentedBar = ({ segments, total }) => {
    const t = total ?? segments.reduce((s, x) => s + x.value, 0);
    return (
        <div>
            <div className="ops-segbar" role="img" aria-label="status distribution">
                {t > 0 && segments.filter(s => s.value > 0).map((s) => (
                    <i key={s.label} style={{ width: `${(s.value / t) * 100}%`, background: s.color }} />
                ))}
            </div>
            <div className="ops-seglegend">
                {segments.map((s) => (
                    <span key={s.label}>
                        <i className="ops-seglegend__dot" style={{ background: s.color }} />
                        {s.label} <b className="ops-num">{s.value}</b>
                    </span>
                ))}
            </div>
        </div>
    );
};

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
            {Array.from({ length: 3 }).map((_, i) => (
                <div key={`r${i}`} className="ops-panel" style={{ gridColumn: 'span 4', minHeight: 190 }}>
                    <div className="ops-skel" style={{ width: 120, height: 11 }} />
                    <div className="ops-skel" style={{ width: '100%', height: 130, marginTop: 14 }} />
                </div>
            ))}
        </div>
    </div>
);
