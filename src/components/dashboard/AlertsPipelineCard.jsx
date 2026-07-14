import React, { memo, useMemo } from 'react';
import { Card, Tooltip, Progress } from 'antd';
import { Link } from 'react-router-dom';
import {
    Play, Activity, AlertTriangle, CheckCircle2, RefreshCw,
    AlertCircle, Bell, Shield, ChevronRight, Zap, Clock,
    Database, ArrowUpRight, XCircle, Info, Loader2,
    Sparkles, TrendingUp, Eye
} from 'lucide-react';
import StatChip from './shared/StatChip';

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
const getAlertSeverity = (type = '') => {
    const t = String(type).toUpperCase();
    if (t.includes('ERROR') || t.includes('FAILURE') || t.includes('CRITICAL')) {
        return {
            level: 'critical',
            color: 'var(--text-danger, #D32F2F)',
            bg: '#fef2f2',
            border: '#fecaca',
            icon: AlertCircle,
            label: 'CRITICAL'
        };
    }
    if (t === 'DELETE' || t.includes('WARN')) {
        return {
            level: 'warning',
            color: '#ED6C02',
            bg: '#fffbeb',
            border: '#fde68a',
            icon: AlertTriangle,
            label: 'WARNING'
        };
    }
    if (t === 'UPDATE' || t.includes('STATUS')) {
        return {
            level: 'info',
            color: '#ED6C02',
            bg: '#fff7ed',
            border: '#fed7aa',
            icon: Info,
            label: 'UPDATE'
        };
    }
    if (t === 'CREATE' || t.includes('SUCCESS') || t === 'IMPORT') {
        return {
            level: 'success',
            color: '#2E7D32',
            bg: '#ecfdf5',
            border: '#a7f3d0',
            icon: CheckCircle2,
            label: 'SUCCESS'
        };
    }
    return {
        level: 'neutral',
        color: 'var(--color-info-blue, #0288D1)',
        bg: '#eff6ff',
        border: '#bfdbfe',
        icon: Info,
        label: 'INFO'
    };
};

const formatLogTime = (dateString) => {
    if (!dateString) return 'Now';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return 'Now';
    const diffMs = Date.now() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    if (diffSec < 30) return 'just now';
    if (diffMin < 1) return `${diffSec}s ago`;
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

const getPipelineStatus = (status = '') => {
    const s = String(status).toUpperCase();
    if (s === 'RUNNING' || s === 'IN_PROGRESS') {
        return {
            color: 'var(--color-info-blue, #0288D1)',
            bg: '#eff6ff',
            border: '#bfdbfe',
            icon: Loader2,
            label: 'RUNNING',
            isAnimated: true
        };
    }
    if (s === 'COMPLETED' || s === 'SUCCESS') {
        return {
            color: '#2E7D32',
            bg: '#ecfdf5',
            border: '#a7f3d0',
            icon: CheckCircle2,
            label: 'COMPLETED'
        };
    }
    if (s === 'FAILED' || s === 'ERROR') {
        return {
            color: 'var(--text-danger, #D32F2F)',
            bg: '#fef2f2',
            border: '#fecaca',
            icon: XCircle,
            label: 'FAILED'
        };
    }
    return {
        color: 'var(--text-secondary, #64748b)',
        bg: '#f8fafc',
        border: 'var(--border-light, #d9e6e9)',
        icon: Clock,
        label: 'IDLE'
    };
};

// ═══════════════════════════════════════════════════════════════
// ALERT ITEM COMPONENT
// ═══════════════════════════════════════════════════════════════
const AlertItem = memo(({ alert }) => {
    const type = alert.Type || alert.type;
    const severity = getAlertSeverity(type);
    const SeverityIcon = severity.icon;
    const title = alert.EntityTitle || alert.entityTitle || alert.title || 'System Alert';
    const subtitle = alert.Description || alert.description || alert.subtitle || 'Activity detected';
    const timeStr = formatLogTime(alert.CreatedAt || alert.createdAt);
    const isFresh = (() => {
        const dt = alert.CreatedAt || alert.createdAt;
        if (!dt) return false;
        const diff = Date.now() - new Date(dt).getTime();
        return diff < 60000; // less than 1 min
    })();

    return (
        <div
            className="alert-item-hover"
            style={{
                position: 'relative',
                padding: '12px 14px',
                background: severity.bg,
                border: `1px solid ${severity.border}`,
                borderLeft: `3px solid ${severity.color}`,
                borderRadius: 10,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                transition: 'all 0.2s',
                cursor: 'pointer'
            }}
        >
            {/* Severity Icon */}
            <div style={{
                width: 28,
                height: 28,
                borderRadius: "var(--radius-md)",
                background: `${severity.color}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: severity.color,
                flexShrink: 0
            }}>
                <SeverityIcon size={14} strokeWidth={2.5} />
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 2
                }}>
                    <span style={{
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 700,
                        color: severity.color,
                        background: 'var(--bg-primary, #fff)',
                        padding: '1px 6px',
                        borderRadius: "var(--radius-sm)",
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        border: `1px solid ${severity.border}`,
                        whiteSpace: 'nowrap'
                    }}>
                        {severity.label}
                    </span>
                    {isFresh && (
                        <span className="fresh-dot" style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: 'var(--text-success, #2E7D32)',
                            display: 'inline-block'
                        }} />
                    )}
                    <span style={{
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--text-tertiary, #94a3b8)',
                        fontWeight: 600,
                        marginLeft: 'auto',
                        whiteSpace: 'nowrap'
                    }}>
                        {timeStr}
                    </span>
                </div>
                <div style={{
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 600,
                    color: 'var(--text-primary, #0f172a)',
                    lineHeight: 1.3,
                    marginBottom: 2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                }}>
                    {title}
                </div>
                <div style={{
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--text-secondary, #64748b)',
                    fontWeight: 500,
                    lineHeight: 1.3,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                }}>
                    {subtitle}
                </div>
            </div>
        </div>
    );
});

// ═══════════════════════════════════════════════════════════════
// PIPELINE TASK COMPONENT
// ═══════════════════════════════════════════════════════════════
const PipelineTaskItem = memo(({ task }) => {
    const status = getPipelineStatus(task.status);
    const StatusIcon = status.icon;
    const taskName = task.taskName || task.TaskName || task.sellerName || `Sync #${task.id || ''}`;
    const progress = task.progress || (status.label === 'COMPLETED' ? 100 : status.label === 'RUNNING' ? 65 : 0);
    const asinCount = task.asinCount || 0;

    return (
        <div
            className="pipeline-task-hover"
            style={{
                position: 'relative',
                padding: '11px 14px',
                background: 'var(--bg-primary, #fff)',
                border: `1px solid ${status.border}`,
                borderRadius: 10,
                transition: 'all 0.2s',
                overflow: 'hidden'
            }}
        >
            {/* Top: Task name + Status */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: progress > 0 && status.label === 'RUNNING' ? 8 : 0
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                    <div style={{
                        width: 26,
                        height: 26,
                        borderRadius: "var(--radius-md)",
                        background: `${status.color}15`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: status.color,
                        flexShrink: 0
                    }}>
                        <StatusIcon
                            size={13}
                            strokeWidth={2.5}
                            className={status.isAnimated ? 'spinning-icon' : ''}
                        />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                            fontSize: 'var(--font-size-sm)',
                            fontWeight: 600,
                            color: 'var(--text-primary, #0f172a)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            lineHeight: 1.2
                        }}>
                            {taskName}
                        </div>
                        {asinCount > 0 && (
                            <div style={{
                                fontSize: 'var(--font-size-xs)',
                                color: 'var(--text-secondary, #64748b)',
                                fontWeight: 500,
                                marginTop: 1
                            }}>
                                {asinCount.toLocaleString('en-IN')} ASINs
                            </div>
                        )}
                    </div>
                </div>

                {/* Status badge */}
                <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 700,
                    color: status.color,
                    background: status.bg,
                    padding: '3px 8px',
                    borderRadius: "var(--radius-lg)",
                    border: `1px solid ${status.border}`,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    marginLeft: 6
                }}>
                    {status.isAnimated && (
                        <span className="status-pulse" style={{
                            width: 5,
                            height: 5,
                            borderRadius: '50%',
                            background: status.color,
                            display: 'inline-block'
                        }} />
                    )}
                    {status.label}
                </div>
            </div>

            {/* Progress Bar (only for running) */}
            {progress > 0 && status.label === 'RUNNING' && (
                <div>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: 3
                    }}>
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary, #64748b)', fontWeight: 600 }}>
                            Progress
                        </span>
                        <span style={{ fontSize: 'var(--font-size-xs)', color: status.color, fontWeight: 700 }}>
                            {progress}%
                        </span>
                    </div>
                    <div style={{
                        height: 4,
                        background: 'var(--border-light, #d9e6e9)',
                        borderRadius: 2,
                        overflow: 'hidden',
                        position: 'relative'
                    }}>
                        <div
                            className="progress-fill-animated"
                            style={{
                                height: '100%',
                                width: `${progress}%`,
                                background: `linear-gradient(90deg, ${status.color}80 0%, ${status.color} 100%)`,
                                borderRadius: 2,
                                transition: 'width 0.6s ease',
                                boxShadow: `0 0 8px ${status.color}50`
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
});

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
const AlertsPipelineCard = ({
    alerts = [],
    pipelineTasks = [],
    onSyncClick,
    syncLoading
}) => {
    const displayAlerts = alerts.slice(0, 3);
    const activeTasks = pipelineTasks.slice(0, 3);

    // Compute alert stats
    const alertStats = useMemo(() => {
        let critical = 0, warning = 0, info = 0;
        alerts.forEach(a => {
            const type = String(a.Type || a.type || '').toUpperCase();
            if (type.includes('ERROR') || type.includes('FAILURE') || type.includes('CRITICAL')) critical++;
            else if (type === 'DELETE' || type.includes('WARN')) warning++;
            else info++;
        });
        return { critical, warning, info, total: alerts.length };
    }, [alerts]);

    // Compute pipeline stats
    const pipelineStats = useMemo(() => {
        let running = 0, completed = 0, failed = 0, idle = 0;
        pipelineTasks.forEach(t => {
            const s = String(t.status || '').toUpperCase();
            if (s === 'RUNNING' || s === 'IN_PROGRESS') running++;
            else if (s === 'COMPLETED' || s === 'SUCCESS') completed++;
            else if (s === 'FAILED' || s === 'ERROR') failed++;
            else idle++;
        });
        return { running, completed, failed, idle, total: pipelineTasks.length };
    }, [pipelineTasks]);

    return (
        <>
            <Card
                styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column', height: '100%' } }}
                style={{
                    borderRadius: "var(--radius-xl)",
                    border: '1px solid var(--border-light, #d9e6e9)',
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.02)',
                    background: 'var(--bg-primary, #fff)',
                    minHeight: 850,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                {/* ═══════════════════════════════════════════════════
                    HEADER
                ═══════════════════════════════════════════════════ */}
                <div style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--border-light, #d9e6e9)',
                    background: 'linear-gradient(135deg, #fef2f2 0%, #ffffff 100%)'
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 12
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                            <div style={{
                                width: 38,
                                height: 38,
                                borderRadius: 11,
                                background: 'linear-gradient(135deg, #f87171 0%, var(--text-danger, #D32F2F) 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--bg-primary, #fff)',
                                boxShadow: '0 4px 12px -2px rgba(239, 68, 68, 0.4)'
                            }}>
                                <Bell size={18} strokeWidth={2.5} />
                            </div>
                            <div>
                                <div style={{
                                    fontSize: 'var(--font-size-base)',
                                    fontWeight: 700,
                                    color: 'var(--text-primary, #0f172a)',
                                    letterSpacing: '-0.01em',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    lineHeight: 1.2
                                }}>
                                    Alerts & Pipeline
                                    <span className="status-pulse" style={{
                                        width: 6,
                                        height: 6,
                                        borderRadius: '50%',
                                        background: 'var(--text-success, #2E7D32)'
                                    }} />
                                </div>
                                <div style={{
                                    fontSize: 'var(--font-size-xs)',
                                    color: 'var(--text-secondary, #64748b)',
                                    fontWeight: 500,
                                    marginTop: 1
                                }}>
                                    Real-time monitoring & sync status
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════
                    SYSTEM ALERTS SECTION
                ═══════════════════════════════════════════════════ */}
                <div style={{
                    padding: '14px 20px 12px',
                    borderBottom: '1px solid var(--border-light, #d9e6e9)'
                }}>
                    {/* Section header with stats */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 12,
                        flexWrap: 'wrap',
                        gap: 8
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                fontSize: 'var(--font-size-xs)',
                                fontWeight: 700,
                                color: 'var(--text-danger, #D32F2F)',
                                background: 'var(--bg-danger-subtle, #fef2f2)',
                                padding: '3px 9px',
                                borderRadius: "var(--radius-lg)",
                                textTransform: 'uppercase',
                                letterSpacing: '0.06em',
                                border: '1px solid #fecaca'
                            }}>
                                <Shield size={10} strokeWidth={2.5} />
                                System Alerts
                            </div>
                            {alertStats.total > 0 && (
                                <span style={{
                                    fontSize: 'var(--font-size-xs)',
                                    color: 'var(--text-secondary, #64748b)',
                                    fontWeight: 600
                                }}>
                                    {alertStats.total}
                                </span>
                            )}
                        </div>
                        <Link
                            to="/activity-log"
                            className="section-link"
                            style={{
                                fontSize: 'var(--font-size-xs)',
                                fontWeight: 600,
                                color: 'var(--text-danger, #D32F2F)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                transition: 'all 0.2s',
                                textDecoration: 'none'
                            }}
                        >
                            View All
                            <ArrowUpRight size={11} strokeWidth={2.5} />
                        </Link>
                    </div>

                    {/* Alert stats chips */}
                    {alertStats.total > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                            {alertStats.critical > 0 && (
                                <StatChip
                                    icon={AlertCircle}
                                    value={alertStats.critical}
                                    label="Critical"
                                    color="#D32F2F"
                                />
                            )}
                            {alertStats.warning > 0 && (
                                <StatChip
                                    icon={AlertTriangle}
                                    value={alertStats.warning}
                                    label="Warning"
                                    color="#ED6C02"
                                />
                            )}
                            {alertStats.info > 0 && (
                                <StatChip
                                    icon={Info}
                                    value={alertStats.info}
                                    label="Info"
                                    color="var(--color-info-blue, #0288D1)"
                                />
                            )}
                        </div>
                    )}

                    {/* Alert items list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {displayAlerts.length === 0 ? (
                            <div style={{
                                padding: '20px 12px',
                                textAlign: 'center',
                                background: '#f0fdf4',
                                border: '1px dashed var(--bg-success-subtle, #a7f3d0)',
                                borderRadius: 10
                            }}>
                                <CheckCircle2 size={24} style={{ color: '#2E7D32', margin: '0 auto 6px' }} />
                                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: '#2E7D32', marginBottom: 2 }}>
                                    All Clear
                                </div>
                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary, #64748b)' }}>
                                    No active alerts at this time
                                </div>
                            </div>
                        ) : (
                            displayAlerts.map((alert, idx) => (
                                <AlertItem key={idx} alert={alert} />
                            ))
                        )}
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════
                    DATA PIPELINE SECTION
                ═══════════════════════════════════════════════════ */}
                <div style={{
                    padding: '14px 20px',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    {/* Section header */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 12,
                        flexWrap: 'wrap',
                        gap: 8
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                fontSize: 'var(--font-size-xs)',
                                fontWeight: 700,
                                color: '#0891b2',
                                background: '#ecfeff',
                                padding: '3px 9px',
                                borderRadius: "var(--radius-lg)",
                                textTransform: 'uppercase',
                                letterSpacing: '0.06em',
                                border: '1px solid #a5f3fc'
                            }}>
                                <Database size={10} strokeWidth={2.5} />
                                Data Pipeline
                            </div>
                            {pipelineStats.running > 0 && (
                                <span style={{
                                    fontSize: 'var(--font-size-xs)',
                                    color: '#0891b2',
                                    fontWeight: 600,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4
                                }}>
                                    <Loader2 size={11} className="spinning-icon" />
                                    {pipelineStats.running} active
                                </span>
                            )}
                        </div>
                        <Link
                            to="/scrape-tasks"
                            className="section-link"
                            style={{
                                fontSize: 'var(--font-size-xs)',
                                fontWeight: 600,
                                color: 'var(--text-danger, #D32F2F)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                transition: 'all 0.2s',
                                textDecoration: 'none'
                            }}
                        >
                            All Tasks
                            <ArrowUpRight size={11} strokeWidth={2.5} />
                        </Link>
                    </div>

                    {/* Pipeline stats chips */}
                    {pipelineStats.total > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                            {pipelineStats.running > 0 && (
                                <StatChip
                                    icon={Loader2}
                                    value={pipelineStats.running}
                                    label="Running"
                                    color="var(--color-info-blue, #0288D1)"
                                    animate
                                />
                            )}
                            {pipelineStats.completed > 0 && (
                                <StatChip
                                    icon={CheckCircle2}
                                    value={pipelineStats.completed}
                                    label="Done"
                                    color="#2E7D32"
                                />
                            )}
                            {pipelineStats.failed > 0 && (
                                <StatChip
                                    icon={XCircle}
                                    value={pipelineStats.failed}
                                    label="Failed"
                                    color="#D32F2F"
                                />
                            )}
                            {pipelineStats.idle > 0 && (
                                <StatChip
                                    icon={Clock}
                                    value={pipelineStats.idle}
                                    label="Idle"
                                    color="#64748b"
                                />
                            )}
                        </div>
                    )}

                    {/* Pipeline tasks list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, marginBottom: 12, overflowY: 'auto' }}>
                        {activeTasks.length === 0 ? (
                            <div style={{
                                padding: '20px 12px',
                                textAlign: 'center',
                                background: 'var(--bg-secondary, #f8fafc)',
                                border: '1px dashed var(--border-light, #d9e6e9)',
                                borderRadius: 10
                            }}>
                                <Database size={24} style={{ color: 'var(--text-tertiary, #94a3b8)', margin: '0 auto 6px' }} />
                                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-secondary, #64748b)', marginBottom: 2 }}>
                                    No Pipeline Activity
                                </div>
                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary, #94a3b8)' }}>
                                    Click sync below to start extraction
                                </div>
                            </div>
                        ) : (
                            activeTasks.map((task, idx) => (
                                <PipelineTaskItem key={idx} task={task} />
                            ))
                        )}
                    </div>

                    {/* Sync Now Button */}
                    <button
                        className="sync-button-premium"
                        onClick={onSyncClick}
                        disabled={syncLoading}
                        style={{
                            width: '100%',
                            padding: '11px 18px',
                            background: syncLoading
                                ? 'linear-gradient(135deg, var(--text-tertiary, #94a3b8) 0%, var(--text-secondary, #64748b) 100%)'
                                : 'linear-gradient(135deg, #1976D2 0%, #1565C0 100%)',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: 'var(--radius-md, 8px)',
                            fontSize: 'var(--font-size-sm)',
                            fontWeight: 600,
                            cursor: syncLoading ? 'wait' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 7,
                            boxShadow: syncLoading
                                ? 'none'
                                : '0 4px 12px -2px rgba(25, 118, 210, 0.4)',
                            transition: 'all 0.2s',
                            letterSpacing: '0.02em'
                        }}
                    >
                        {syncLoading ? (
                            <>
                                <Loader2 size={14} className="spinning-icon" strokeWidth={2.5} />
                                Syncing Pipeline...
                            </>
                        ) : (
                            <>
                                <Zap size={14} strokeWidth={2.5} />
                                Trigger Pipeline Sync
                                <ArrowUpRight size={12} strokeWidth={2.5} />
                            </>
                        )}
                    </button>
                </div>
            </Card>
        </>
    );
};

export default memo(AlertsPipelineCard);