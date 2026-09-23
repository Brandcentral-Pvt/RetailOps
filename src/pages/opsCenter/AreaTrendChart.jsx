import React, { useMemo } from 'react';
import { LineChart } from '@visactor/react-vchart';
import { fmtByUnit } from './charts';

/**
 * Shared analytical trend chart, rendered with the VChart LineChart
 * (@visactor/react-vchart). Used by the Operations Command Center.
 *
 * Data is folded into a single dataset where every row carries the series
 * key ({ bucket, key, value }) and the series are split per line via
 * `seriesField`. Unlike per-series datasets, this keeps each line on its
 * own scale-safe coordinate so the series never overplot.
 *
 * Props contract (shared with the legacy TrendChart it replaces):
 *   labels[]            x bucket labels
 *   series [{ key, name, color, data, weight?, dashed? }]
 *                       weight 1.4–2.4 — primary series are heavier so
 *                       overlapping lines stay distinguishable without extra
 *                       colours (focus +0.8, dim ×0.7)
 *   unit                'inr' | 'num' | 'pct'  (all series share one unit)
 *   hidden              array of hidden series keys
 *   onToggle(key)       legend click
 *   focusKey            emphasised series key
 *   onFocus(key)        legend double-click / focus handler
 *   granularity         'day' | 'week' | 'month' (tooltip hint)
 *   height
 */

const numOrNull = (v) => (v !== null && v !== undefined && Number.isFinite(Number(v)) ? Number(v) : null);

const fmtValue = (v, unit, { full = false } = {}) => (numOrNull(v) === null ? '—' : fmtByUnit(Number(v), unit, { full }));

export const AreaTrendChart = ({
    labels = [], series = [], unit = 'inr', hidden = [], onToggle, focusKey, onFocus,
    height = 235, granularity = 'day',
}) => {
    const hiddenSet = useMemo(() => new Set(hidden), [hidden]);
    const nameByKey = useMemo(() => Object.fromEntries(series.map((s) => [s.key, s.name])), [series]);
    const colorByKey = useMemo(() => Object.fromEntries(series.map((s) => [s.key, s.color])), [series]);
    const focused = focusKey && series.some((s) => s.key === focusKey && !hiddenSet.has(focusKey)) ? focusKey : null;

    /* Fold every visible series into one dataset; hidden series simply carry
       no rows, so VChart never creates a line for them. */
    const data = useMemo(() => ({
        id: 'trend',
        values: series
            .filter((s) => !hiddenSet.has(s.key))
            .flatMap((s) => labels.map((bucket, i) => ({ bucket, key: s.key, value: numOrNull((s.data || [])[i]) }))),
    }), [labels, series, hiddenSet]);

    /* Per-series styling: VChart only applies seriesStyle when the chart is
       configured with seriesField, matched by the series key above. */
    const seriesStyle = useMemo(() => series.map((s) => {
        const off = hiddenSet.has(s.key);
        const isFocus = !off && focused === s.key;
        const dim = !off && focused && focused !== s.key;
        const base = s.weight || (s.dashed ? 1.6 : 1.8);
        return {
            name: s.key,
            line: {
                style: {
                    stroke: s.color,
                    strokeWidth: isFocus ? base + 0.8 : dim ? base * 0.7 : base,
                    strokeDasharray: s.dashed ? [4, 3] : undefined,
                    opacity: dim ? 0.3 : 1,
                },
            },
        };
    }), [series, hiddenSet, focused]);

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
            content: [{
                key: (d) => nameByKey[d?.key] || d?.key,
                shapeType: 'circle',
                shapeColor: (d) => colorByKey[d?.key],
                value: (d) => fmtValue(d?.value, unit, { full: true }),
            }],
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

    const axes = [
        {
            orient: 'left',
            grid: { visible: true, style: { stroke: '#eef1f5', lineWidth: 1 } },
            label: { visible: true, formatMethod: (v) => fmtByUnit(v, unit, { full: true }), style: { fill: '#8896ab', fontSize: 11 } },
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

    return (
        <div className="ops-chart">
            <LineChart
                data={data}
                seriesField="key"
                xField="bucket"
                yField="value"
                stack={false}
                seriesStyle={seriesStyle}
                line={{ style: { curveType: 'monotone' } }}
                point={{ state: { dimension_hover: { size: 6 } } }}
                axes={axes}
                tooltip={tooltip}
                crosshair={crosshair}
                animation={false}
                height={height}
            />
            <div className="ops-legend" style={{ marginTop: 4 }}>
                {series.map((s) => {
                    const off = hiddenSet.has(s.key);
                    const dim = focused && focused !== s.key;
                    const total = (s.data || []).reduce((a, b) => a + (numOrNull(b) ?? 0), 0);
                    const summary = unit === 'pct' ? 'avg' : 'total';
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