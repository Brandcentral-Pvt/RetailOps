import React, { useMemo } from 'react';
import { BarChart } from '@visactor/react-vchart';
import { fmtByUnit } from './charts';

/**
 * Shared analytical trend chart, rendered with the VChart BarChart
 * (@visactor/react-vchart). Used by the Operations Command Center and the
 * Ads Intelligence page so both surfaces stay visually identical.
 *
 * Props contract (shared with the AreaTrendChart it replaces):
 *   labels[]            x bucket labels
 *   series [{ key, name, color, data, weight?, dashed?, axis? }]
 *                       weight 1.4–2.4 — primary series are heavier so
 *                       overlapping lines stay distinguishable without extra
 *                       colours (focus +0.8, dim ×0.7)
 *                       axis 'right' | 'left' (default 'left') — series on
 *                       the right get their own scale so small-magnitude
 *                       (₹ K/L ads) bars stay visible next to large-magnitude
 *                       (₹ Cr GMS) ones.
 *   unit                'inr' | 'num' | 'pct'  (all series share one unit)
 *   hidden              array of hidden series keys
 *   onToggle(key)       legend click
 *   focusKey            emphasised series key
 *   onFocus(key)        legend double-click / focus handler
 *   granularity         'day' | 'week' | 'month' (tooltip hint)
 *   height
 */

const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const numOrNull = (v) => (v !== null && v !== undefined && Number.isFinite(Number(v)) ? Number(v) : null);

const fmtValue = (v, unit, { full = false } = {}) => (numOrNull(v) === null ? '—' : fmtByUnit(Number(v), unit, { full }));

export const AreaTrendChart = ({
    labels = [], series = [], unit = 'inr', hidden = [], onToggle, focusKey, onFocus,
    height = 235, granularity = 'day',
}) => {
    const hiddenSet = useMemo(() => new Set(hidden), [hidden]);
    const visible = useMemo(() => series.filter((s) => !hiddenSet.has(s.key)), [series, hiddenSet]);
    /* Dual scale: series tagged axis 'right' plot against their own axis so
       small-magnitude (₹ K/L ads) lines stay visible next to large-magnitude
       (₹ Cr GMS) ones. When nothing is tagged, a single left axis is used. */
    const rightIds = visible.filter((s) => s.axis === 'right').map((s) => `s-${s.key}`);
    const leftIds = visible.filter((s) => s.axis !== 'right').map((s) => `s-${s.key}`);
    const focused = focusKey && visible.some((s) => s.key === focusKey) ? focusKey : null;

    const data = useMemo(() => series.map((s) => ({
        id: `trend-${s.key}`,
        values: labels.map((bucket, i) => ({ bucket, value: numOrNull((s.data || [])[i]) })),
    })), [labels, series]);

    const specSeries = useMemo(() => series.map((s) => {
        const off = hiddenSet.has(s.key);
        const isFocus = !off && focused === s.key;
        const dim = !off && focused && focused !== s.key;
        const base = s.weight || (s.dashed ? 1.5 : 1.8);
        return {
            type: 'bar',
            id: `s-${s.key}`,
            name: s.name,
            dataKey: `trend-${s.key}`,
            xField: 'bucket',
            yField: 'value',
            visible: !off,
            stack: false,
            tooltip: {
                visible: !off,
                dimension: {
                    visible: true,
                    content: [{
                        key: s.name,
                        shapeType: 'square',
                        shapeColor: s.color,
                        value: (d) => fmtValue(d?.value, unit, { full: true }),
                    }],
                },
            },
            bar: {
                style: {
                    fill: s.color,
                    cornerRadius: [4, 4, 0, 0],
                },
            },
            barMaxWidth: 22,
            barMinWidth: 0.6,
            point: { visible: false },
        };
    }), [series, hiddenSet, focused, unit]);

    const axes = [
        {
            orient: 'left',
            seriesId: leftIds.length > 0 ? leftIds : undefined,
            grid: { visible: true, style: { stroke: '#eef1f5', lineWidth: 1 } },
            label: { visible: true, formatMethod: (v) => fmtByUnit(v, unit, { full: true }), style: { fill: '#8896ab', fontSize: 11 } },
            tick: { visible: false },
            domainLine: { visible: false },
        },
        ...(rightIds.length > 0
            ? [{
                orient: 'right',
                seriesId: rightIds,
                grid: { visible: false },
                label: { visible: true, formatMethod: (v) => fmtByUnit(v, unit, { full: true }), style: { fill: '#8896ab', fontSize: 11 } },
                tick: { visible: false },
                domainLine: { visible: true, style: { stroke: '#e3e8ee', lineWidth: 1 } },
            }]
            : []),
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
            <BarChart
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
                    const dim = focused && focused !== s.key;
                    const summary = unit === 'pct' ? 'avg' : 'total';
                    const total = (s.data || []).reduce((a, b) => a + toNum(b), 0);
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
                            <b className="ops-num">{dim ? summary : `${summary} ${fmtValue(total, unit)}`}</b>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
