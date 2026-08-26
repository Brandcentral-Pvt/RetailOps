import React, { memo } from 'react';
import { Tooltip } from 'antd';
import { format, isToday, isTomorrow, isYesterday, differenceInDays } from 'date-fns';
import { User, CheckCircle2, Clock, AlertTriangle, ListTodo, PlayCircle, Flag, Calendar, Zap } from 'lucide-react';

const formatDueDate = (date) => {
    if (!date) return { label: 'No due date', color: 'var(--bc-slate-400)', urgent: false };
    const d = new Date(date);
    if (isNaN(d.getTime())) return { label: 'No due date', color: 'var(--bc-slate-400)', urgent: false };

    const now = new Date();
    const days = differenceInDays(d, now);

    if (days < 0) {
        const overdueDays = Math.abs(days);
        return {
            label: overdueDays === 1 ? '1 day overdue' : `${overdueDays}d overdue`,
            color: 'var(--text-danger, #D32F2F)',
            urgent: true
        };
    }
    if (isToday(d)) return { label: 'Due today', color: '#ED6C02', urgent: true };
    if (isTomorrow(d)) return { label: 'Due tomorrow', color: '#ED6C02', urgent: false };
    if (days <= 3) return { label: `Due in ${days}d`, color: '#ED6C02', urgent: false };
    if (days <= 7) return { label: format(d, 'EEE, MMM d'), color: 'var(--text-secondary, var(--bc-slate-500))', urgent: false };
    return { label: format(d, 'MMM d, yyyy'), color: 'var(--bc-slate-400)', urgent: false };
};

const getStatusConfig = (task) => {
    const status = (task.status || 'todo').toUpperCase();
    const isOverdue = status !== 'COMPLETED' && task.dueDate && new Date(task.dueDate) < new Date();

    if (isOverdue) {
        return {
            label: 'OVERDUE',
            color: 'var(--text-danger, #D32F2F)',
            bg: 'var(--bc-red-50)',
            border: 'var(--bc-red-200)',
            icon: AlertTriangle,
            pulse: true
        };
    }

    switch (status) {
        case 'COMPLETED':
            return {
                label: 'DONE',
                color: '#2E7D32',
                bg: '#ecfdf5',
                border: '#a7f3d0',
                icon: CheckCircle2
            };
        case 'IN_PROGRESS':
            return {
                label: 'ACTIVE',
                color: 'var(--color-info-blue, #0288D1)',
                bg: 'var(--bc-blue-50)',
                border: 'var(--bc-blue-200)',
                icon: PlayCircle,
                pulse: true
            };
        case 'PENDING':
            return {
                label: 'PENDING',
                color: '#ED6C02',
                bg: 'var(--bc-amber-50)',
                border: 'var(--bc-amber-200)',
                icon: Clock
            };
        default:
            return {
                label: 'TODO',
                color: 'var(--text-secondary, var(--bc-slate-500))',
                bg: 'var(--bc-slate-50)',
                border: 'var(--border-light, var(--border-light))',
                icon: ListTodo
            };
    }
};

const getPriorityConfig = (priority = 'NORMAL') => {
    const p = String(priority).toUpperCase();
    if (p === 'HIGH' || p === 'URGENT' || p === 'CRITICAL') {
        return { color: 'var(--text-danger, #D32F2F)', label: 'High', icon: '🔴' };
    }
    if (p === 'MEDIUM') {
        return { color: '#ED6C02', label: 'Medium', icon: '🟡' };
    }
    if (p === 'LOW') {
        return { color: '#2E7D32', label: 'Low', icon: '🟢' };
    }
    return { color: 'var(--text-secondary, var(--bc-slate-500))', label: 'Normal', icon: '⚪' };
};

const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
};

const getAvatarColor = (name) => {
    if (!name) return { bg: 'var(--bc-slate-100)', text: 'var(--bc-slate-500)' };
    const colors = [
        { bg: 'var(--color-data-blue-bg, var(--bc-blue-100))', text: 'var(--color-info-blue, #0288D1)' },
        { bg: '#fce7f3', text: '#db2777' },
        { bg: '#d1fae5', text: '#2E7D32' },
        { bg: 'var(--bc-amber-100)', text: '#E65100' },
        { bg: 'var(--bc-indigo-100)', text: 'var(--bc-ro-500)' },
        { bg: 'var(--bc-red-100)', text: '#D32F2F' },
        { bg: 'var(--bc-cyan-100)', text: 'var(--bc-cyan-600)' },
        { bg: '#f3e8ff', text: '#9333ea' }
    ];
    const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return colors[hash % colors.length];
};

const TaskItem = memo(({ task, isLast }) => {
    const status = getStatusConfig(task);
    const priority = getPriorityConfig(task.priority || task.Priority);
    const StatusIcon = status.icon;
    const dueDateInfo = formatDueDate(task.dueDate || task.DueDate);
    const assigneeName = task.assigneeName || task.AssigneeName || '';
    const avatarColor = getAvatarColor(assigneeName);
    const title = task.title || task.Title || 'Untitled Task';
    const isCompleted = (task.status || '').toUpperCase() === 'COMPLETED';

    return (
        <div
            className="task-item-hover"
            style={{
                padding: '12px 14px',
                background: 'var(--bg-primary, #fff)',
                border: '1px solid var(--border-light, var(--border-light))',
                borderLeft: `3px solid ${status.color}`,
                borderRadius: 10,
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden'
            }}
        >
            {/* Top Row: Status + Priority + Time */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 6,
                flexWrap: 'wrap'
            }}>
                {/* Status badge */}
                <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 8px',
                    background: status.bg,
                    border: `1px solid ${status.border}`,
                    borderRadius: "var(--radius-lg)",
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 700,
                    color: status.color,
                    letterSpacing: '0.04em'
                }}>
                    <StatusIcon
                        size={10}
                        strokeWidth={2.5}
                        className={status.pulse ? 'pulse-task-icon' : ''}
                    />
                    {status.label}
                </div>

                {/* Priority indicator */}
                {task.priority && (
                    <Tooltip title={`Priority: ${priority.label}`}>
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 600,
                            color: priority.color
                        }}>
                            <Flag size={9} strokeWidth={2.5} />
                            {priority.label}
                        </div>
                    </Tooltip>
                )}

                {/* Due date */}
                <div style={{
                    marginLeft: 'auto',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 600,
                    color: dueDateInfo.color,
                    background: dueDateInfo.urgent ? `${dueDateInfo.color}10` : 'transparent',
                    padding: dueDateInfo.urgent ? '2px 6px' : '0',
                    borderRadius: 6,
                    border: dueDateInfo.urgent ? `1px solid ${dueDateInfo.color}25` : 'none'
                }}>
                    {dueDateInfo.urgent && <Zap size={9} strokeWidth={2.5} />}
                    {!dueDateInfo.urgent && <Calendar size={9} strokeWidth={2.5} />}
                    {dueDateInfo.label}
                </div>
            </div>

            {/* Title */}
            <div style={{
                fontSize: 'var(--font-size-sm)',
                fontWeight: 600,
                color: isCompleted ? 'var(--bc-slate-500)' : 'var(--bc-slate-900)',
                lineHeight: 1.3,
                marginBottom: 6,
                textDecoration: isCompleted ? 'line-through' : 'none',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
            }} title={title}>
                {title}
            </div>

            {/* Bottom: Assignee + Tags */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8
            }}>
                {/* Assignee */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                    <div style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                    background: avatarColor.bg,
                    color: avatarColor.text,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 700,
                    flexShrink: 0,
                        border: `1.5px solid ${avatarColor.text}20`
                    }}>
                        {assigneeName ? getInitials(assigneeName) : <User size={11} />}
                    </div>
                    <span style={{
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--text-secondary, var(--bc-slate-500))',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }}>
                        {assigneeName || 'Unassigned'}
                    </span>
                </div>

                {/* Task tag/category */}
                {(task.category || task.Category) && (
                    <span style={{
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 600,
                        color: 'var(--text-secondary, var(--bc-slate-500))',
                        background: 'var(--border-light, var(--border-light))',
                        padding: '2px 7px',
                        borderRadius: 6,
                        whiteSpace: 'nowrap',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                    }}>
                        {task.category || task.Category}
                    </span>
                )}
            </div>
        </div>
    );
});

export default memo(TaskItem);
