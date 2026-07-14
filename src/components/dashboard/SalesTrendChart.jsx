import React, { Suspense, lazy, useState, useMemo, memo } from 'react';
import { Card, Segmented, Tooltip } from 'antd';
import {
    TrendingUp, TrendingDown, DollarSign, Target,
    BarChart3, Activity, ArrowUpRight, ArrowDownRight,
    Calendar, Eye, EyeOff, Sparkles
} from 'lucide-react';
import { ChartSkeleton as SkeletonChart } from '../ui/skeleton';
import { formatIndianCurrencyShort, formatIndianCurrencyFull } from './utils';

const Chart = lazy(() => import('react-apexcharts'));

// ═══════════════════════════════════════════════════════════════
// METRIC SUMMARY CARD (top mini stats)
// ═══════════════════════════════════════════════════════════════
const MetricSummary = memo(({ label, value, change, color, icon: Icon, isPositive }) => (
    <div style={{
        padding: '10px 14px',
        background: `linear-gradient(135deg, ${color}08 0%, ${color}03 100%)`,
        border: `1px solid ${color}20`,
        borderRadius: 10,
        minWidth: 130,
        flex: 1
    }}>
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            marginBottom: 4
        }}>
            <Icon size={10} style={{ color }} strokeWidth={2.5} />
            <span style={{
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 700,
                    color: 'var(--text-secondary, #64748b)',
                    textTransform: 'uppercase',
                letterSpacing: '0.06em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
            }}>
                {label}
            </span>
        </div>
        <div style={{
            fontSize: 'var(--font-size-lg)',
            fontWeight: 700,
            color: 'var(--text-primary, #0f172a)',
            letterSpacing: '-0.3px',
            lineHeight: 1.1,
            marginBottom: 3
        }}>
            {value}
        </div>
        {change !== undefined && (
            <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                color: isPositive ? '#2E7D32' : '#D32F2F',
                background: isPositive ? 'var(--bg-success-subtle, #d1fae5)' : 'var(--bg-danger-subtle, #fee2e2)',
                padding: '1px 6px',
                borderRadius: "var(--radius-md)"
            }}>
                {isPositive ? <ArrowUpRight size={9} strokeWidth={2.5} /> : <ArrowDownRight size={9} strokeWidth={2.5} />}
                {Math.abs(change).toFixed(1)}%
            </div>
        )}
    </div>
));

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
const SalesTrendChart = ({
    labels = [],
    revenueData = [],
    spendData = [],
    title = 'Sales & Spend Trend',
    subtitle = 'Revenue vs Ad Spend Performance'
}) => {
    const [chartType, setChartType] = useState('area'); // area, line, bar
    const [showRevenue, setShowRevenue] = useState(true);
    const [showSpend, setShowSpend] = useState(true);

    // ═══════════════════════════════════════════════════════════════
    // CALCULATIONS
    // ═══════════════════════════════════════════════════════════════
    const stats = useMemo(() => {
        const totalRevenue = revenueData.reduce((sum, v) => sum + (Number(v) || 0), 0);
        const totalSpend = spendData.reduce((sum, v) => sum + (Number(v) || 0), 0);
        const profit = totalRevenue - totalSpend;
        const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
        const acos = totalRevenue > 0 ? (totalSpend / totalRevenue) * 100 : 0;

        // Calculate trends (compare first half vs second half)
        const mid = Math.floor(revenueData.length / 2);
        const firstHalfRev = revenueData.slice(0, mid).reduce((s, v) => s + (Number(v) || 0), 0);
        const secondHalfRev = revenueData.slice(mid).reduce((s, v) => s + (Number(v) || 0), 0);
        const revenueChange = firstHalfRev > 0 ? ((secondHalfRev - firstHalfRev) / firstHalfRev) * 100 : 0;

        const firstHalfSpend = spendData.slice(0, mid).reduce((s, v) => s + (Number(v) || 0), 0);
        const secondHalfSpend = spendData.slice(mid).reduce((s, v) => s + (Number(v) || 0), 0);
        const spendChange = firstHalfSpend > 0 ? ((secondHalfSpend - firstHalfSpend) / firstHalfSpend) * 100 : 0;

        // Find peak day
        let peakValue = 0;
        let peakIndex = 0;
        revenueData.forEach((v, i) => {
            if (v > peakValue) {
                peakValue = v;
                peakIndex = i;
            }
        });

        return {
            totalRevenue,
            totalSpend,
            profit,
            roas,
            acos,
            revenueChange,
            spendChange,
            peakValue,
            peakDay: labels[peakIndex] || '—',
            avgRevenue: revenueData.length > 0 ? totalRevenue / revenueData.length : 0
        };
    }, [revenueData, spendData, labels]);

    // ═══════════════════════════════════════════════════════════════
    // CHART CONFIG
    // ═══════════════════════════════════════════════════════════════
    const series = useMemo(() => {
        const s = [];
        if (showRevenue) {
            s.push({
                name: 'Revenue',
                type: chartType,
                data: revenueData
            });
        }
        if (showSpend) {
            s.push({
                name: 'Ad Spend',
                type: chartType,
                data: spendData
            });
        }
        return s;
    }, [showRevenue, showSpend, revenueData, spendData, chartType]);

    const colors = useMemo(() => {
        const c = [];
        if (showRevenue) c.push('var(--color-info-blue, #0288D1)');
        if (showSpend) c.push('#ED6C02');
        return c;
    }, [showRevenue, showSpend]);

    const options = useMemo(() => ({
        chart: {
            type: chartType,
            toolbar: {
                show: false
            },
            zoom: { enabled: false },
            sparkline: { enabled: false },
            fontFamily: 'Inter, -apple-system, sans-serif',
            animations: {
                enabled: true,
                easing: 'easeinout',
                speed: 600
            },
            dropShadow: {
                enabled: chartType === 'line',
                top: 4,
                left: 0,
                blur: 8,
                opacity: 0.15
            }
        },
        stroke: {
            curve: 'smooth',
            width: chartType === 'bar' ? 0 : [3, 2.5]
        },
        fill: chartType === 'area' ? {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.4,
                opacityTo: 0.05,
                stops: [0, 95, 100]
            }
        } : {
            type: 'solid',
            opacity: chartType === 'bar' ? 0.85 : 1
        },
        plotOptions: chartType === 'bar' ? {
            bar: {
                borderRadius: 6,
                borderRadiusApplication: 'end',
                columnWidth: '55%',
                dataLabels: { position: 'top' }
            }
        } : {},
        colors,
        xaxis: {
            categories: labels.length > 0 ? labels : ['01 Jun', '02 Jun', '03 Jun', '04 Jun', '05 Jun', '06 Jun', '07 Jun'],
            axisBorder: { show: false },
            axisTicks: { show: false },
            labels: {
                style: {
                    colors: '#94a3b8',
                    fontSize: '10px',
                    fontWeight: 600
                },
                rotate: 0
            }
        },
        yaxis: {
            labels: {
                style: {
                    colors: '#94a3b8',
                    fontSize: '10px',
                    fontWeight: 600
                },
                formatter: (val) => val === 0 ? '0' : formatIndianCurrencyShort(val)
            }
        },
        grid: {
            borderColor: 'var(--border-light, #d9e6e9)',
            strokeDashArray: 4,
            xaxis: { lines: { show: false } },
            yaxis: { lines: { show: true } },
            padding: { top: 0, right: 10, bottom: 0, left: 10 }
        },
        legend: {
            show: false
        },
        dataLabels: { enabled: false },
        markers: {
            size: chartType === 'line' ? 0 : 0,
            strokeWidth: 2,
            strokeColors: '#fff',
            hover: {
                size: 7,
                sizeOffset: 3
            }
        },
        tooltip: {
            theme: 'light',
            shared: true,
            intersect: false,
            style: {
                fontSize: 'var(--font-size-sm)',
                fontFamily: 'Inter, sans-serif'
            },
            y: {
                formatter: (val) => formatIndianCurrencyFull(val)
            },
            marker: { show: true },
            x: {
                show: true
            }
        }
    }), [chartType, colors, labels]);

    return (
        <>
            <Card
                className="sales-trend-card"
                styles={{ body: { padding: 0 } }}
                style={{
                    borderRadius: "var(--radius-xl)",
                    border: '1px solid var(--border-light, #d9e6e9)',
                    background: 'var(--bg-primary, #fff)',
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.02)',
                    height: '100%',
                    overflow: 'hidden'
                }}
            >
                {/* ═══════════════════════════════════════════════════
                    HEADER SECTION
                ═══════════════════════════════════════════════════ */}
                <div style={{
                    padding: '18px 20px 14px',
                    borderBottom: '1px solid var(--border-light, #d9e6e9)'
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 12,
                        marginBottom: 14,
                        flexWrap: 'wrap'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
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
                                <BarChart3 size={20} strokeWidth={2.5} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                    fontSize: 'var(--font-size-base)',
                                    fontWeight: 700,
                                    color: 'var(--text-primary, #0f172a)',
                                    letterSpacing: '-0.01em',
                                    lineHeight: 1.2,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8
                                }}>
                                    {title}
                                    <span className="live-pulse" style={{
                                        width: 6,
                                        height: 6,
                                        borderRadius: '50%',
                                        background: 'var(--text-success, #2E7D32)',
                                        display: 'inline-block'
                                    }} />
                                </div>
                                <div style={{
                                    fontSize: 'var(--font-size-xs)',
                                    color: 'var(--text-secondary, #64748b)',
                                    fontWeight: 500,
                                    marginTop: 2
                                }}>
                                    {subtitle}
                                </div>
                            </div>
                        </div>

                        {/* Chart Type Toggle */}
                        <Segmented
                            value={chartType}
                            onChange={setChartType}
                            size="small"
                            options={[
                                {
                                    label: <Tooltip title="Area Chart"><Activity size={12} /></Tooltip>,
                                    value: 'area'
                                },
                                {
                                    label: <Tooltip title="Line Chart"><TrendingUp size={12} /></Tooltip>,
                                    value: 'line'
                                },
                                {
                                    label: <Tooltip title="Bar Chart"><BarChart3 size={12} /></Tooltip>,
                                    value: 'bar'
                                }
                            ]}
                            style={{
                                background: 'var(--border-light, #d9e6e9)',
                                fontWeight: 600
                            }}
                        />
                    </div>

                    {/* ═══════════════════════════════════════════════════
                        METRICS SUMMARY (4 mini cards)
                    ═══════════════════════════════════════════════════ */}
                    <div style={{
                        display: 'flex',
                        gap: 8,
                        flexWrap: 'wrap'
                    }}>
                        <MetricSummary
                            label="Total Revenue"
                            value={formatIndianCurrencyShort(stats.totalRevenue)}
                            change={stats.revenueChange}
                            isPositive={stats.revenueChange >= 0}
                            color="var(--color-info-blue, #0288D1)"
                            icon={DollarSign}
                        />
                        <MetricSummary
                            label="Total Spend"
                            value={formatIndianCurrencyShort(stats.totalSpend)}
                            change={stats.spendChange}
                            isPositive={stats.spendChange <= 0}
                            color="#ED6C02"
                            icon={Target}
                        />
                        <MetricSummary
                            label="Net Profit"
                            value={formatIndianCurrencyShort(stats.profit)}
                            color={stats.profit >= 0 ? '#2E7D32' : '#D32F2F'}
                            icon={TrendingUp}
                        />
                        <MetricSummary
                            label="ROAS"
                            value={`${stats.roas.toFixed(2)}x`}
                            color={stats.roas >= 4 ? '#2E7D32' : stats.roas >= 2 ? '#ED6C02' : '#D32F2F'}
                            icon={Sparkles}
                        />
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════
                    LEGEND CONTROLS
                ═══════════════════════════════════════════════════ */}
                <div style={{
                    padding: '12px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--bg-secondary, #f8fafc)',
                    borderBottom: '1px solid var(--border-light, #d9e6e9)'
                }}>
                    <div style={{ display: 'flex', gap: 14 }}>
                        <div
                            className={`legend-toggle ${!showRevenue ? 'disabled' : ''}`}
                            onClick={() => setShowRevenue(!showRevenue)}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '4px 10px',
                                background: showRevenue ? 'var(--bg-info-subtle, #eff6ff)' : 'var(--border-light, #d9e6e9)',
                                border: `1px solid ${showRevenue ? '#bfdbfe' : 'var(--border-light, #d9e6e9)'}`,
                                borderRadius: "var(--radius-md)"
                            }}
                        >
                            {showRevenue ? <Eye size={10} style={{ color: 'var(--color-info-blue, #0288D1)' }} /> : <EyeOff size={10} style={{ color: 'var(--text-tertiary, #94a3b8)' }} />}
                            <div style={{
                                width: 10,
                                height: 10,
                                borderRadius: 2,
                                background: showRevenue
                                    ? 'linear-gradient(135deg, #0288D1 0%, #0288D1 100%)'
                                    : 'var(--border-medium, #cbd5e1)'
                            }} />
                            <span style={{
                                fontSize: 'var(--font-size-xs)',
                                fontWeight: 600,
                                color: showRevenue ? '#1e40af' : 'var(--text-tertiary, #94a3b8)'
                            }}>
                                Revenue
                            </span>
                        </div>

                        <div
                            className={`legend-toggle ${!showSpend ? 'disabled' : ''}`}
                            onClick={() => setShowSpend(!showSpend)}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '4px 10px',
                                background: showSpend ? 'var(--bg-warning-subtle, #fffbeb)' : 'var(--border-light, #d9e6e9)',
                                border: `1px solid ${showSpend ? '#fde68a' : 'var(--border-light, #d9e6e9)'}`,
                                borderRadius: "var(--radius-md)"
                            }}
                        >
                            {showSpend ? <Eye size={10} style={{ color: '#E65100' }} /> : <EyeOff size={10} style={{ color: 'var(--text-tertiary, #94a3b8)' }} />}
                            <div style={{
                                width: 10,
                                height: 10,
                                borderRadius: 2,
                                background: showSpend
                                    ? 'linear-gradient(135deg, #fbbf24 0%, #ED6C02 100%)'
                                    : 'var(--border-medium, #cbd5e1)'
                            }} />
                            <span style={{
                                fontSize: 'var(--font-size-xs)',
                                fontWeight: 600,
                                color: showSpend ? '#92400e' : 'var(--text-tertiary, #94a3b8)'
                            }}>
                                Ad Spend
                            </span>
                        </div>
                    </div>

                    {/* Peak Indicator */}
                    {stats.peakValue > 0 && (
                        <Tooltip title={`Peak revenue day: ${formatIndianCurrencyFull(stats.peakValue)}`}>
                            <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 600,
                            color: '#9C27B0',
                            background: '#f5f3ff',
                                padding: '3px 9px',
                                borderRadius: "var(--radius-lg)",
                                border: '1px solid #ddd6fe',
                                cursor: 'help'
                            }}>
                                <Sparkles size={10} strokeWidth={2.5} />
                                Peak: {stats.peakDay}
                            </div>
                        </Tooltip>
                    )}
                </div>

                {/* ═══════════════════════════════════════════════════
                    CHART AREA
                ═══════════════════════════════════════════════════ */}
                <div style={{ padding: '16px 12px 20px' }}>
                    <Suspense fallback={<SkeletonChart height={260} />}>
                        {series.length > 0 ? (
                            <Chart
                                options={options}
                                series={series}
                                type={chartType === 'bar' ? 'bar' : chartType === 'line' ? 'line' : 'area'}
                                height={260}
                            />
                        ) : (
                            <div style={{
                                height: 260,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--text-tertiary, #94a3b8)',
                                gap: 8
                            }}>
                                <EyeOff size={24} />
                                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                                    No series selected
                                </div>
                                <div style={{ fontSize: 'var(--font-size-xs)' }}>
                                    Toggle Revenue or Ad Spend above to view data
                                </div>
                            </div>
                        )}
                    </Suspense>
                </div>

                {/* ═══════════════════════════════════════════════════
                    FOOTER (Average info)
                ═══════════════════════════════════════════════════ */}
                <div style={{
                    padding: '10px 20px',
                    background: 'var(--bg-secondary, #f8fafc)',
                    borderTop: '1px solid var(--border-light, #d9e6e9)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 10
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--text-secondary, #64748b)',
                            fontWeight: 600
                        }}>
                            <Calendar size={10} />
                            {labels.length || 0} data points
                        </div>
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--text-secondary, #64748b)',
                            fontWeight: 600
                        }}>
                            <Activity size={10} />
                            Avg: {formatIndianCurrencyShort(stats.avgRevenue)}/day
                        </div>
                    </div>

                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 600,
                        color: stats.acos <= 25 ? '#2E7D32' : '#E65100',
                        background: stats.acos <= 25 ? 'var(--bg-success-subtle, #d1fae5)' : 'var(--bg-warning-subtle, #fef3c7)',
                        padding: '3px 9px',
                        borderRadius: "var(--radius-lg)",
                        border: `1px solid ${stats.acos <= 25 ? 'var(--bg-success-subtle, #a7f3d0)' : 'var(--bg-warning-subtle, #fde68a)'}`
                    }}>
                        Blended ACoS: {stats.acos.toFixed(1)}%
                    </div>
                </div>
            </Card>
        </>
    );
};

export default memo(SalesTrendChart);