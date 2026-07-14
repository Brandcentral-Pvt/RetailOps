import React, { useMemo, memo } from 'react';
import { Card } from 'antd';
import { Link } from 'react-router-dom';
import {
    CheckCircle2, Clock, AlertTriangle, ListTodo,
    PlayCircle, ArrowUpRight, ClipboardList, Sparkles,
    TrendingUp, Activity, Award
} from 'lucide-react';
import StatChip from './shared/StatChip';
import SegmentedProgress from './shared/SegmentedProgress';
import TaskItem from './TaskItem';

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
const TasksOverviewCard = ({ tasks = [], loading = false }) => {
    const counts = useMemo(() => {
        const total = tasks.length;
        const completed = tasks.filter((t) => (t.status || '').toUpperCase() === 'COMPLETED').length;
        const inProgress = tasks.filter((t) => (t.status || '').toUpperCase() === 'IN_PROGRESS').length;
        const pending = tasks.filter((t) => (t.status || '').toUpperCase() === 'PENDING').length;
        const overdue = tasks.filter((t) => {
            if ((t.status || '').toUpperCase() === 'COMPLETED') return false;
            if (t.dueDate) return new Date(t.dueDate) < new Date();
            return false;
        }).length;
        const todo = Math.max(0, total - completed - inProgress - pending - overdue);
        const completionRate = total > 0 ? (completed / total) * 100 : 0;

        return { total, completed, inProgress, pending, overdue, todo, completionRate };
    }, [tasks]);

    // Sort tasks: Overdue → Active → Pending → Todo → Completed
    const sortedTasks = useMemo(() => {
        const priorityOrder = (t) => {
            const status = (t.status || '').toUpperCase();
            const isOverdue = status !== 'COMPLETED' && t.dueDate && new Date(t.dueDate) < new Date();
            if (isOverdue) return 0;
            if (status === 'IN_PROGRESS') return 1;
            if (status === 'PENDING') return 2;
            if (status === 'TODO' || !status) return 3;
            return 4; // Completed
        };

        return [...tasks]
            .sort((a, b) => {
                const orderDiff = priorityOrder(a) - priorityOrder(b);
                if (orderDiff !== 0) return orderDiff;
                // Then by created date desc
                return new Date(b.createdAt || b.CreatedAt || 0).getTime() -
                    new Date(a.createdAt || a.CreatedAt || 0).getTime();
            })
            .slice(0, 5);
    }, [tasks]);

    return (
        <>
            <Card
                styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column', height: '100%' } }}
                style={{
                    borderRadius: "var(--radius-xl)",
                    border: '1px solid var(--border-light, #d9e6e9)',
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.02)',
                    background: 'var(--bg-primary, #fff)',
                    height: '100%',
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
                        gap: 12,
                        marginBottom: 14
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 11, flex: 1, minWidth: 0 }}>
                            <div style={{
                                width: 38,
                                height: 38,
                                borderRadius: 11,
                                background: 'linear-gradient(135deg, #D32F2F 0%, #d94033 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#ffffff',
                                boxShadow: '0 4px 12px -2px rgba(251, 79, 64, 0.4)',
                                flexShrink: 0
                            }}>
                                <ClipboardList size={20} strokeWidth={2.5} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
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
                                    Optimization Tasks
                                    {counts.overdue > 0 && (
                                        <span className="live-dot-tasks" style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 3,
                                            fontSize: 'var(--font-size-xs)',
                                            fontWeight: 700,
                                            color: 'var(--text-danger, #D32F2F)',
background: 'var(--bg-danger-subtle, #fef2f2)',
                                        border: '1px solid var(--bg-danger-subtle, #fecaca)',
                                            padding: '1px 6px',
                                            borderRadius: 10
                                        }}>
                                            <AlertTriangle size={9} strokeWidth={2.5} />
                                            {counts.overdue} overdue
                                        </span>
                                    )}
                                </div>
                                <div style={{
                                    fontSize: 'var(--font-size-xs)',
                                    color: 'var(--text-secondary, #64748b)',
                                    fontWeight: 500,
                                    marginTop: 1
                                }}>
                                    Workflow management & assignments
                                </div>
                            </div>
                        </div>

                        <Link
                            to="/tasks"
                            className="section-link-tasks"
                            style={{
                                fontSize: 'var(--font-size-xs)',
                                fontWeight: 600,
                                color: 'var(--text-danger, #D32F2F)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                transition: 'all 0.2s',
                                textDecoration: 'none',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            View All
                            <ArrowUpRight size={11} strokeWidth={2.5} />
                        </Link>
                    </div>

                    {/* Completion Rate + Progress */}
                        <div style={{
                            padding: '10px 14px',
                            background: 'var(--bg-primary, #fff)',
                            border: '1px solid var(--border-light, #d9e6e9)',
                            borderRadius: 10
                        }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: 8
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Award size={13} style={{ color: counts.completionRate >= 70 ? '#2E7D32' : counts.completionRate >= 40 ? '#ED6C02' : '#94a3b8' }} strokeWidth={2.5} />
                                    <span style={{
                                        fontSize: 'var(--font-size-xs)',
                                        fontWeight: 600,
                                        color: 'var(--text-secondary, #64748b)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em'
                                }}>
                                    Completion Rate
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                                <span style={{
                                    fontSize: 18,
                                    fontWeight: 700,
                                    color: counts.completionRate >= 70 ? '#2E7D32' : counts.completionRate >= 40 ? '#ED6C02' : '#64748b',
                                    letterSpacing: '-0.3px'
                                }}>
                                    {counts.completionRate.toFixed(0)}%
                                </span>
                                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary, #64748b)', fontWeight: 600 }}>
                                    ({counts.completed}/{counts.total})
                                </span>
                            </div>
                        </div>
                        <SegmentedProgress
                            segments={[
                                { label: 'Completed', value: counts.completed, color: '#2E7D32' },
                                { label: 'In Progress', value: counts.inProgress, color: 'var(--color-info-blue, #0288D1)' },
                                { label: 'Pending', value: counts.pending, color: '#ED6C02' },
                                { label: 'Overdue', value: counts.overdue, color: '#D32F2F' },
                                { label: 'Todo', value: counts.todo, color: '#94a3b8' },
                            ].filter(s => s.value > 0)}
                            height={6}
                        />
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════
                    STAT CHIPS ROW
                ═══════════════════════════════════════════════════ */}
                {counts.total > 0 && (
                    <div style={{
                        padding: '12px 20px',
                        background: 'var(--bg-secondary, #f8fafc)',
                        borderBottom: '1px solid var(--border-light, #d9e6e9)',
                        display: 'flex',
                        gap: 6,
                        flexWrap: 'wrap'
                    }}>
                        {counts.overdue > 0 && (
                            <StatChip
                                icon={AlertTriangle}
                                value={counts.overdue}
                                label="Overdue"
                                color="#D32F2F"
                                animate
                                animateClass="pulse-task-icon"
                            />
                        )}
                        {counts.inProgress > 0 && (
                            <StatChip
                                icon={PlayCircle}
                                value={counts.inProgress}
                                label="Active"
                                color="var(--color-info-blue, #0288D1)"
                                animate
                                animateClass="pulse-task-icon"
                            />
                        )}
                        {counts.pending > 0 && (
                            <StatChip
                                icon={Clock}
                                value={counts.pending}
                                label="Pending"
                                color="#ED6C02"
                            />
                        )}
                        {counts.todo > 0 && (
                            <StatChip
                                icon={ListTodo}
                                value={counts.todo}
                                label="Todo"
                                color="#94a3b8"
                            />
                        )}
                        {counts.completed > 0 && (
                            <StatChip
                                icon={CheckCircle2}
                                value={counts.completed}
                                label="Done"
                                color="#2E7D32"
                            />
                        )}
                    </div>
                )}

                {/* ═══════════════════════════════════════════════════
                    TASK LIST
                ═══════════════════════════════════════════════════ */}
                <div style={{
                    padding: '14px 20px',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    overflowY: 'auto'
                }}>
                    {sortedTasks.length === 0 ? (
                        loading ? (
                            <div style={{
                                padding: '40px 12px',
                                textAlign: 'center'
                            }}>
                                <div style={{
                                    display: 'inline-block',
                                    width: 32,
                                    height: 32,
                                    border: '3px solid var(--border-light, #d9e6e9)',
                                    borderTop: '3px solid var(--text-brand, #1976D2)',
                                    borderRadius: '50%',
                                    animation: 'spin 1s linear infinite',
                                    marginBottom: 12
                                }} />
                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary, #64748b)', fontWeight: 600 }}>
                                    Loading tasks...
                                </div>
                            </div>
                        ) : (
                            <div style={{
                                padding: '32px 12px',
                                textAlign: 'center',
                                background: 'var(--bg-secondary, #f8fafc)',
                                    border: '1px dashed var(--border-light, #d9e6e9)',
                                borderRadius: 10,
                                margin: 'auto'
                            }}>
                                <div style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, var(--bg-success-subtle, #ecfdf5) 0%, var(--bg-success-subtle, #d1fae5) 100%)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: 12,
                                    border: '2px solid var(--bg-success-subtle, #a7f3d0)'
                                }}>
                                    <Sparkles size={20} style={{ color: '#2E7D32' }} strokeWidth={2.5} />
                                </div>
                                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary, #0f172a)', marginBottom: 4 }}>
                                    All Caught Up! 🎉
                                </div>
                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary, #64748b)' }}>
                                    No optimization tasks at this time
                                </div>
                            </div>
                        )
                    ) : (
                        sortedTasks.map((task, idx) => (
                            <TaskItem
                                key={task.id || task._id || idx}
                                task={task}
                                isLast={idx === sortedTasks.length - 1}
                            />
                        ))
                    )}
                </div>

                {/* ═══════════════════════════════════════════════════
                    FOOTER (Summary stats)
                ═══════════════════════════════════════════════════ */}
                {counts.total > 0 && (
                    <div style={{
                        padding: '10px 20px',
                        background: 'var(--bg-secondary, #f8fafc)',
                        borderTop: '1px solid var(--border-light, #d9e6e9)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 8
                    }}>
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--text-secondary, #64748b)',
                            fontWeight: 600
                        }}>
                            <Activity size={10} strokeWidth={2.5} />
                            Showing top {sortedTasks.length} of {counts.total}
                        </div>

                        <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 600,
                        color: counts.completionRate >= 70 ? '#2E7D32' : counts.completionRate >= 40 ? '#E65100' : '#64748b',
                            background: counts.completionRate >= 70 ? 'var(--bg-success-subtle, #d1fae5)' : counts.completionRate >= 40 ? 'var(--bg-warning-subtle, #fef3c7)' : 'var(--border-light, #d9e6e9)',
                            padding: '3px 8px',
                            borderRadius: "var(--radius-lg)",
                            border: `1px solid ${counts.completionRate >= 70 ? 'var(--bg-success-subtle, #a7f3d0)' : counts.completionRate >= 40 ? 'var(--bg-warning-subtle, #fde68a)' : 'var(--border-light, #d9e6e9)'}`
                        }}>
                            <TrendingUp size={10} strokeWidth={2.5} />
                            {counts.completionRate >= 70 ? 'Healthy' : counts.completionRate >= 40 ? 'Moderate' : 'Needs Focus'}
                        </div>
                    </div>
                )}

            </Card>
        </>
    );
};

export default memo(TasksOverviewCard);