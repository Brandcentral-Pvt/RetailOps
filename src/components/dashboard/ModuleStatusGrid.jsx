import React, { memo, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Target, Package, Zap, ClipboardList, AlertCircle, RefreshCw,
    CheckCircle2, Clock, AlertTriangle, TrendingUp,
    Activity, Layers, Sparkles
} from 'lucide-react';
import { formatIndianCurrencyShort, formatNumber } from './utils';
import ModuleCard from './ModuleCard';

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
const ModuleStatusGrid = ({ moduleStats }) => {
    const navigate = useNavigate();

    const modules = useMemo(() => [
        // ═══ 1. TARGET MANAGEMENT ═══
        {
            title: 'Target Management',
            subtitle: 'Revenue & sales tracking',
            path: '/target-achievement/dashboard',
            color: '#1976D2',
            gradient: 'linear-gradient(135deg, #1976D2 0%, #1976D2 100%)',
            icon: Target,
            badge: {
                text: `${moduleStats.targets.rate.toFixed(0)}% Pacing`,
                color: moduleStats.targets.rate >= 80 ? '#2E7D32' : moduleStats.targets.rate >= 50 ? '#ED6C02' : '#D32F2F',
                icon: TrendingUp
            },
            primaryMetric: {
                label: 'Total Targets',
                value: moduleStats.targets.total.toString(),
                subValue: `Achievement rate: ${moduleStats.targets.rate.toFixed(1)}%`
            },
            progress: moduleStats.targets.rate,
            stats: [
                { label: 'Completed', value: moduleStats.targets.completed, color: '#2E7D32', icon: CheckCircle2 },
                { label: 'On Track', value: moduleStats.targets.onTrack, color: 'var(--color-info-blue, #0288D1)', icon: TrendingUp },
                { label: 'At Risk', value: moduleStats.targets.atRisk, color: 'var(--text-danger, #D32F2F)', icon: AlertTriangle },
                { label: 'Plans', value: moduleStats.targets.total, color: '#1976D2', icon: Layers }
            ],
            segments: [
                { label: 'Completed', value: moduleStats.targets.completed, color: '#2E7D32' },
                { label: 'On Track', value: moduleStats.targets.onTrack, color: 'var(--color-info-blue, #0288D1)' },
                { label: 'At Risk', value: moduleStats.targets.atRisk, color: 'var(--text-danger, #D32F2F)' }
            ],
            statusText: moduleStats.targets.rate >= 80 ? 'Excellent' : moduleStats.targets.rate >= 50 ? 'On Track' : 'Needs Attention',
            statusColor: moduleStats.targets.rate >= 80 ? '#2E7D32' : moduleStats.targets.rate >= 50 ? '#ED6C02' : '#D32F2F'
        },

        // ═══ 2. ASIN CATALOG ═══
        {
            title: 'ASIN Catalog',
            subtitle: 'Product portfolio tracking',
            path: '/asin-tracker',
            color: 'var(--color-info-blue, #0288D1)',
            gradient: 'linear-gradient(135deg, #0288D1 0%, #0288D1 100%)',
            icon: Package,
            badge: {
                text: 'Live',
                color: '#2E7D32',
                icon: Activity
            },
            primaryMetric: {
                label: 'Tracked ASINs',
                value: formatNumber(moduleStats.asins.total),
                subValue: `${moduleStats.asins.active} active products`
            },
            stats: [
                { label: 'Active', value: formatNumber(moduleStats.asins.active), color: '#2E7D32', icon: CheckCircle2 },
                { label: 'Out of Stock', value: moduleStats.asins.outOfStock, color: 'var(--text-danger, #D32F2F)', icon: AlertCircle, pulse: moduleStats.asins.outOfStock > 0 },
                { label: 'New', value: moduleStats.asins.newThisMonth, color: '#9C27B0', icon: Sparkles },
                { label: 'Total', value: formatNumber(moduleStats.asins.total), color: 'var(--color-info-blue, #0288D1)', icon: Package }
            ],
            statusText: 'Catalog Healthy',
            statusColor: '#2E7D32'
        },

        // ═══ 3. ADS PERFORMANCE ═══
        {
            title: 'Ads Performance',
            subtitle: 'Campaign metrics & ROAS',
            path: '/ads-report',
            color: '#2E7D32',
            gradient: 'linear-gradient(135deg, #34d399 0%, #2E7D32 100%)',
            icon: Zap,
            badge: {
                text: moduleStats.ads.acos <= 25 ? 'Healthy' : 'High ACoS',
                color: moduleStats.ads.acos <= 25 ? '#2E7D32' : '#ED6C02',
                icon: moduleStats.ads.acos <= 25 ? CheckCircle2 : AlertTriangle
            },
            primaryMetric: {
                label: 'Total Ad Sales',
                value: formatIndianCurrencyShort(moduleStats.ads.totalSales),
                subValue: `Spend: ${formatIndianCurrencyShort(moduleStats.ads.totalSpend)}`
            },
            stats: [
                { label: 'ACoS', value: `${moduleStats.ads.acos.toFixed(1)}%`, color: moduleStats.ads.acos <= 25 ? '#2E7D32' : '#ED6C02' },
                { label: 'ROAS', value: `${moduleStats.ads.roas.toFixed(2)}x`, color: moduleStats.ads.roas >= 4 ? '#2E7D32' : '#ED6C02' },
                { label: 'Spend', value: formatIndianCurrencyShort(moduleStats.ads.totalSpend), color: 'var(--text-danger, #D32F2F)' },
                { label: 'Sales', value: formatIndianCurrencyShort(moduleStats.ads.totalSales), color: '#2E7D32' }
            ],
            statusText: moduleStats.ads.roas >= 4 ? 'High ROAS' : 'Moderate Performance',
            statusColor: moduleStats.ads.roas >= 4 ? '#2E7D32' : '#ED6C02'
        },

        // ═══ 4. OPTIMIZATION TASKS ═══
        {
            title: 'Optimization Tasks',
            subtitle: 'Workflow management',
            path: '/tasks',
            color: '#ED6C02',
            gradient: 'linear-gradient(135deg, #fbbf24 0%, #ED6C02 100%)',
            icon: ClipboardList,
            badge: moduleStats.tasks.overdue > 0 ? {
                text: `${moduleStats.tasks.overdue} Overdue`,
                color: 'var(--text-danger, #D32F2F)',
                icon: AlertTriangle
            } : {
                text: 'On Schedule',
                color: '#2E7D32',
                icon: CheckCircle2
            },
            primaryMetric: {
                label: 'Total Tasks',
                value: moduleStats.tasks.total.toString(),
                subValue: `${moduleStats.tasks.completed} completed of ${moduleStats.tasks.total}`
            },
            progress: moduleStats.tasks.total > 0 ? (moduleStats.tasks.completed / moduleStats.tasks.total) * 100 : 0,
            stats: [
                { label: 'Completed', value: moduleStats.tasks.completed, color: '#2E7D32', icon: CheckCircle2 },
                { label: 'In Progress', value: moduleStats.tasks.inProgress, color: 'var(--color-info-blue, #0288D1)', icon: Activity },
                { label: 'Pending', value: moduleStats.tasks.pending, color: '#ED6C02', icon: Clock },
                { label: 'Overdue', value: moduleStats.tasks.overdue, color: 'var(--text-danger, #D32F2F)', icon: AlertTriangle, pulse: moduleStats.tasks.overdue > 0 }
            ],
            segments: [
                { label: 'Done', value: moduleStats.tasks.completed, color: '#2E7D32' },
                { label: 'Active', value: moduleStats.tasks.inProgress, color: 'var(--color-info-blue, #0288D1)' },
                { label: 'Pending', value: moduleStats.tasks.pending, color: '#ED6C02' },
                { label: 'Overdue', value: moduleStats.tasks.overdue, color: 'var(--text-danger, #D32F2F)' }
            ]
        },

        // ═══ 5. ALERTS & RULES ═══
        {
            title: 'Alerts & Rules',
            subtitle: 'Active monitoring system',
            path: '/alerts',
            color: 'var(--text-danger, #D32F2F)',
            gradient: 'linear-gradient(135deg, #f87171 0%, #D32F2F 100%)',
            icon: AlertCircle,
            badge: moduleStats.alerts.critical > 0 ? {
                text: `${moduleStats.alerts.critical} Critical`,
                color: 'var(--text-danger, #D32F2F)',
                icon: AlertCircle
            } : {
                text: 'All Clear',
                color: '#2E7D32',
                icon: CheckCircle2
            },
            primaryMetric: {
                label: 'Active Alerts',
                value: moduleStats.alerts.total.toString(),
                subValue: `${moduleStats.alerts.critical} require attention`
            },
            stats: [
                { label: 'Critical', value: moduleStats.alerts.critical, color: 'var(--text-danger, #D32F2F)', icon: AlertCircle, pulse: moduleStats.alerts.critical > 0 },
                { label: 'Warning', value: moduleStats.alerts.warning, color: '#ED6C02', icon: AlertTriangle },
                { label: 'Info', value: moduleStats.alerts.info, color: 'var(--color-info-blue, #0288D1)', icon: Activity },
                { label: 'Total', value: moduleStats.alerts.total, color: 'var(--text-secondary, #64748b)', icon: Layers }
            ],
            segments: [
                { label: 'Critical', value: moduleStats.alerts.critical, color: 'var(--text-danger, #D32F2F)' },
                { label: 'Warning', value: moduleStats.alerts.warning, color: '#ED6C02' },
                { label: 'Info', value: moduleStats.alerts.info, color: 'var(--color-info-blue, #0288D1)' }
            ]
        },

        // ═══ 6. DATA PIPELINE ═══
        {
            title: 'Data Pipeline',
            subtitle: 'Octoparse sync engine',
            path: '/scrape-tasks',
            color: 'var(--color-info-blue, #0288D1)',
            gradient: 'linear-gradient(135deg, #22d3ee 0%, #0288D1 100%)',
            icon: RefreshCw,
            hasAnimation: moduleStats.pipeline.running > 0,
            badge: moduleStats.pipeline.running > 0 ? {
                text: 'Syncing',
                color: 'var(--color-info-blue, #0288D1)',
                icon: RefreshCw
            } : {
                text: 'Idle',
                color: 'var(--text-secondary, #64748b)',
                icon: Clock
            },
            primaryMetric: {
                label: 'Pipeline Tasks',
                value: moduleStats.pipeline.total.toString(),
                subValue: moduleStats.pipeline.running > 0 ? `${moduleStats.pipeline.running} running now` : 'No active jobs'
            },
            stats: [
                { label: 'Running', value: moduleStats.pipeline.running, color: 'var(--color-info-blue, #0288D1)', icon: RefreshCw, animate: moduleStats.pipeline.running > 0 },
                { label: 'Completed', value: moduleStats.pipeline.completed, color: '#2E7D32', icon: CheckCircle2 },
                { label: 'Failed', value: moduleStats.pipeline.failed, color: 'var(--text-danger, #D32F2F)', icon: AlertCircle, pulse: moduleStats.pipeline.failed > 0 },
                { label: 'Idle', value: moduleStats.pipeline.idle, color: 'var(--text-secondary, #64748b)', icon: Clock }
            ],
            segments: [
                { label: 'Done', value: moduleStats.pipeline.completed, color: '#2E7D32' },
                { label: 'Running', value: moduleStats.pipeline.running, color: 'var(--color-info-blue, #0288D1)' },
                { label: 'Failed', value: moduleStats.pipeline.failed, color: 'var(--text-danger, #D32F2F)' },
                { label: 'Idle', value: moduleStats.pipeline.idle, color: 'var(--text-secondary, #64748b)' }
            ]
        }
    ], [moduleStats]);

    return (
        <>
            {/* Section Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 14
            }}>
                <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'linear-gradient(135deg, var(--bg-danger-subtle, #fef2f2) 0%, var(--bg-danger-subtle, #fee2e2) 100%)',
                    padding: '5px 12px',
                    borderRadius: 20,
                    border: '1px solid var(--bg-danger-subtle, #fecaca)'
                }}>
                    <Layers size={13} style={{ color: 'var(--text-danger, #D32F2F)' }} />
                    <span style={{
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 700,
                        color: 'var(--text-danger, #D32F2F)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em'
                    }}>
                        Module Health Overview
                    </span>
                </div>
                <div style={{
                    flex: 1,
                    height: 1,
                    background: 'linear-gradient(90deg, var(--border-light, #d9e6e9) 0%, transparent 100%)'
                }} />
                <span style={{
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--text-secondary, #64748b)',
                    fontWeight: 600
                }}>
                    {modules.length} modules · Real-time sync
                </span>
            </div>

            {/* Module Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                gap: 18,
                marginBottom: 24
            }}>
                {modules.map((m, idx) => (
                    <ModuleCard
                        key={idx}
                        module={m}
                        onClick={() => navigate(m.path)}
                    />
                ))}
            </div>
        </>
    );
};

export default memo(ModuleStatusGrid);