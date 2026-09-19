import React, { useMemo } from 'react';
import { AreaChart } from '@visactor/react-vchart';
import { fmtByUnit } from '../opsCenter/charts';

/**
 * Ads Intelligence trend chart, rendered with the VChart AreaChart
 * (@visactor/react-vchart). Mirrors the TrendChart props contract from
 * opsCenter so the panels swap cleanly:
 *   labels[]            x bucket labels
 *   series [{ key, name, color, data, dashed? }]
 *   unit                'inr' | 'num' | 'pct'  (all series share one unit)
 *   hidden              array of hidden series keys
 *   onToggle(key)       legend click
 *   focusKey            emphasised series key
 *   onFocus(key)        legend double-click / focus handler
 *   granularity         'day' | 'week' | 'month' | 'auto' (tooltip hint)
 *   height
 */

const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

/** Returns Number when present, null otherwise — null stays a hole on the
 *  axis (a bucket with no ad rows) instead of a fabricated zero. */
const numOrNull = (v) => (v !== null && v !== undefined && Number.isFinite(Number(v)) ? Number(v) : null);

const fmtValue = (v, unit) => (numOrNull(v) === null ? '—' : fmtByUnit(Number(v), unit, { full: true }));

/** hex (#rrggbb) -> rgba() string with alpha 0..1. */
const rgba = (hex, a) => {
    const h = String(hex || '#c66913').replace('#', '');
    const r = parseInt(h.slice(0, 2) || '0', 16);
    const g = parseInt(h.slice(2, 4) || '0', 16);
    const b = parseInt(h.slice(4, 6) || '0', 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
};

export const AdsAreaChart = ({
    labels = [], series = [], unit = 'inr', hidden = [], onToggle, focusKey, onFocus,
    height = 230, granularity = 'day',
}) => {
    const hiddenSet = useMemo(() => new Set(hidden), [hidden]);
    const visible = useMemo(() => series.filter((s) => !hiddenSet.has(s.key)), [series, hiddenSet]);
    const focused = focusKey && visible.some((s) => s.key === focusKey) ? focusKey : null;

    const data = useMemo(() => series.map((s) => ({
        id: `ads-${s.key}`,
        values: labels.map((bucket, i) => ({ bucket, value: numOrNull((s.data || [])[i]) })),
    })), [labels, series]);

    const specSeries = useMemo(() => series.map((s) => {
        const off = hiddenSet.has(s.key);
        const isFocus = !off && focused === s.key;
        const dim = !off && focused && focused !== s.key;
        const base = s.weight || (s.dashed ? 1.6 : 1.8);
        return {
            type: 'area',
            name: s.name,
            dataKey: `ads-${s.key}`,
            xField: 'bucket',
            yField: 'value',
            visible: !off,
            connectNulls: false,
            tooltip: {
                visible: !off,
                dimension: {
                    visible: true,
                    content: [{
                        key: s.name,
                        shapeType: 'circle',
                        shapeColor: s.color,
                        value: (d) => fmtValue(d?.value, unit),
                    }],
                },
            },
            point: { visible: false },
            line: {
                style: {
                    stroke: s.color,
                    strokeWidth: isFocus ? base + 0.8 : dim ? base * 0.7 : base,
                    strokeDasharray: s.dashed ? [4, 3] : undefined,
                    opacity: dim ? 0.3 : 1,
                },
            },
            area: {
                style: {
                    fill: {
                        gradient: 'linear',
                        x0: 0,
                        y0: 0,
                        x1: 0,
                        y1: 1,
                        stops: [
                            { offset: 0, color: rgba(s.color, isFocus ? 0.16 : dim ? 0.04 : base > 2 ? 0.12 : 0.07) },
                            { offset: 1, color: rgba(s.color, 0.02) },
                        ],
                    },
                },
            },
        };
    }), [series, hiddenSet, focused, unit]);

    const axes = [
        {
            orient: 'left',
            grid: { visible: true, style: { stroke: '#eef1f5', lineWidth: 1 } },
            label: { visible: true, formatMethod: (v) => fmtByUnit(v, unit), style: { fill: '#8896ab', fontSize: 11 } },
            tick: { visible: false },
            domainLine: { visible: false },
        },
        {
            orient: 'bottom',
            label: { visible: true, style: { fill: '#8896ab', fontSize: 11 } },
            tick: { visible: false },
            domainLine: { visible: true, style: { stroke: '#e3e8ee', lineWidth: 1 } },
        },
    ];

    const tooltip = {
        visible: true,
        activeType: ['dimension'],
        renderMode: 'html',
        confine: true,
        dimension: {
            visible: true,
            title: {
                value: (d) => `${d?.bucket ?? ''}${granularity === 'week' ? ' · week' : ''}`,
            },
        },
        mark: { visible: false },
    };

    const crosshair = {
        xField: {
            visible: true,
            line: { style: { stroke: '#51607a', lineWidth: 1, lineDash: [3, 3] } },
        },
        yField: { visible: false },
    };

    return (
        <div className="ops-chart">
            <AreaChart
                data={data}
                series={specSeries}
                axes={axes}
                tooltip={tooltip}
                crosshair={crosshair}
                stack={false}
                xField="bucket"
                yField="value"
                animation={false}
                height={height}
            />
            <div className="ops-legend" style={{ marginTop: 4 }}>
                {series.map((s) => {
                    const off = hiddenSet.has(s.key);
                    const total = (s.data || []).reduce((a, b) => a + toNum(b), 0);
                    const summary = unit === 'pct'
                        ? `avg ${fmtByUnit(total / Math.max((s.data || []).filter((v) => toNum(v) > 0).length, 1), unit)}`
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