import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../services/db';
import api from '../services/api';
import { useSocket } from '../contexts/SocketContext';
import { useDebounce } from '../hooks/useDebounce';
import {
    Table, Input, Select, Button, DatePicker, Tooltip, Modal, Descriptions, Segmented
} from 'antd';
import {
    Search, RefreshCw, Eye, User, Activity,
    Cpu, Zap, Trash2, Edit3, LogIn, LogOut, XCircle, AlertTriangle,
    PlusCircle, ClipboardList, Target, Box, Info, Database
} from 'lucide-react';
import styles from './ActivityLog.module.css';

const { RangePicker } = DatePicker;

const IMPORTANT_TYPES = [
    'CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE',
    'AUTH_SUCCESS', 'AUTH_FAILURE', 'AUTH_LOGOUT',
    'SYSTEM_ERROR', 'IMPORT', 'LIVE_SYNC', 'LIVE_SYNC_TEST',
    'AUTOMATION_TASK', 'TARGET_UPDATE', 'TARGET_IMPORT', 'TARGET_DELETE'
];

// Event types are grouped onto a small set of semantic tones rather than
// fifteen near-identical hexes. Every tone maps to a design token that ships
// a paired background/text/border, so badges stay legible in both themes.
const TONE_CLASS = {
    success: styles.toneSuccess,
    info: styles.toneInfo,
    warning: styles.toneWarning,
    danger: styles.toneDanger,
    accent: styles.toneAccent,
    neutral: styles.toneNeutral,
};

const TYPE_STYLES = {
    CREATE: { icon: <PlusCircle size={13} />, tone: 'success', label: 'Created' },
    UPDATE: { icon: <Edit3 size={13} />, tone: 'info', label: 'Updated' },
    DELETE: { icon: <Trash2 size={13} />, tone: 'danger', label: 'Deleted' },
    STATUS_CHANGE: { icon: <Activity size={13} />, tone: 'warning', label: 'Status Change' },
    AUTH_SUCCESS: { icon: <LogIn size={13} />, tone: 'success', label: 'Login' },
    AUTH_FAILURE: { icon: <XCircle size={13} />, tone: 'danger', label: 'Login Failed' },
    AUTH_LOGOUT: { icon: <LogOut size={13} />, tone: 'neutral', label: 'Logout' },
    SYSTEM_ERROR: { icon: <AlertTriangle size={13} />, tone: 'danger', label: 'Error' },
    IMPORT: { icon: <ClipboardList size={13} />, tone: 'info', label: 'Import' },
    LIVE_SYNC: { icon: <Zap size={13} />, tone: 'accent', label: 'Live Sync' },
    LIVE_SYNC_TEST: { icon: <Zap size={13} />, tone: 'accent', label: 'Sync Test' },
    AUTOMATION_TASK: { icon: <Cpu size={13} />, tone: 'accent', label: 'Automation' },
    TARGET_UPDATE: { icon: <Edit3 size={13} />, tone: 'info', label: 'Target Update' },
    TARGET_IMPORT: { icon: <ClipboardList size={13} />, tone: 'success', label: 'Target Import' },
    TARGET_DELETE: { icon: <Trash2 size={13} />, tone: 'danger', label: 'Target Delete' },
};

const ENTITY_STYLES = {
    OBJECTIVE: { tone: 'info', icon: <Target size={11} /> },
    ACTION: { tone: 'warning', icon: <PlusCircle size={11} /> },
    USER: { tone: 'accent', icon: <User size={11} /> },
    SELLER: { tone: 'success', icon: <Box size={11} /> },
    ASIN: { tone: 'info', icon: <Box size={11} /> },
    SYSTEM: { tone: 'neutral', icon: <Database size={11} /> },
};

const OTP_ACTION_STYLES = {
    OTP_SENT: { tone: 'info', label: 'Sent' },
    OTP_VERIFIED: { tone: 'success', label: 'Verified' },
    OTP_FAILED: { tone: 'danger', label: 'Failed' },
};

function formatTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function relativeTime(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return formatTime(dateStr);
}

const renderMetadata = (metadata) => {
    if (!metadata) {
        return <p className={styles.metadataEmpty}>No additional data.</p>;
    }

    let data = metadata;
    if (typeof data === 'string') {
        try {
            data = JSON.parse(data);
        } catch {
            return <pre className={styles.metadataRaw}>{data}</pre>;
        }
    }

    if (typeof data !== 'object' || data === null) {
        return <pre className={styles.metadataRaw}>{String(data)}</pre>;
    }

    return (
        <Descriptions bordered size="small" column={1}>
            {Object.entries(data).map(([key, value]) => (
                <Descriptions.Item key={key} label={key.charAt(0).toUpperCase() + key.slice(1)}>
                    {typeof value === 'object' && value !== null ? (
                        <pre className={styles.metadataJson}>{JSON.stringify(value, null, 2)}</pre>
                    ) : String(value)}
                </Descriptions.Item>
            ))}
        </Descriptions>
    );
};

// ── Main Component ────────────────────────────────────────────────────────────

const ActivityLog = () => {
    const socket = useSocket();

    // Tab state
    const [activeTab, setActiveTab] = useState('activity');

    // Activity logs state (server-side)
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [total, setTotal] = useState(0);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('ALL');
    const [dateRange, setDateRange] = useState(null);
    const [showAllEvents, setShowAllEvents] = useState(false);

    // Detail modal
    const [selectedLog, setSelectedLog] = useState(null);
    const [detailOpen, setDetailOpen] = useState(false);

    // OTP state
    const [otpLogs, setOtpLogs] = useState([]);
    const [otpLoading, setOtpLoading] = useState(false);
    const [otpPage, setOtpPage] = useState(1);
    const [otpTotal, setOtpTotal] = useState(0);
    const [otpActionFilter, setOtpActionFilter] = useState('');
    const [otpEmailFilter, setOtpEmailFilter] = useState('');

    // Typing in either search box used to refetch on every keystroke, because
    // the raw value sat in the fetch effect's dependency list.
    const debouncedSearch = useDebounce(searchQuery, 350);
    const debouncedOtpEmail = useDebounce(otpEmailFilter, 350);

    // Real-time socket
    useEffect(() => {
        if (!socket) return;
        const handler = (data) => {
            if (!data) return;
            setLogs(prev => [{ ...data, _id: data.Id, createdAt: data.CreatedAt }, ...prev]);
        };
        socket.on('new_system_log', handler);
        return () => socket.off('new_system_log', handler);
    }, [socket]);

    // Fetch logs with server-side filtering
    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const params = {
                page, limit: pageSize,
                hideNoise: showAllEvents ? 'false' : 'true'
            };
            if (filterType !== 'ALL') params.type = filterType;
            if (debouncedSearch) params.search = debouncedSearch;
            if (dateRange?.[0]) params.startDate = dateRange[0].toISOString();
            if (dateRange?.[1]) params.endDate = dateRange[1].toISOString();

            const res = await db.getSystemLogs(params);
            if (res?.success) {
                setLogs(res.data || []);
                setTotal(res.pagination?.total || 0);
            }
        } catch (e) {
            console.error('Failed to load logs:', e);
        } finally {
            setLoading(false);
        }
    }, [page, pageSize, filterType, debouncedSearch, dateRange, showAllEvents]);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    // OTP logs
    const fetchOtpLogs = useCallback(async (p = 1) => {
        setOtpLoading(true);
        try {
            const params = { page: p, limit: 20 };
            if (otpActionFilter) params.action = otpActionFilter;
            if (debouncedOtpEmail) params.email = debouncedOtpEmail;
            const res = await api.securityApi.getOtpLogs(params);
            if (res?.success) {
                setOtpLogs(res.data || []);
                setOtpTotal(res.total || 0);
                setOtpPage(p);
            }
        } catch (e) { console.error('OTP logs error:', e); }
        finally { setOtpLoading(false); }
    }, [otpActionFilter, debouncedOtpEmail]);

    useEffect(() => { if (activeTab === 'otp') fetchOtpLogs(1); }, [activeTab, fetchOtpLogs]);

    const clearFilters = () => {
        setSearchQuery('');
        setFilterType('ALL');
        setDateRange(null);
        setPage(1);
    };
    const hasFilters = Boolean(searchQuery || filterType !== 'ALL' || dateRange);

    const openDetail = (log) => {
        setSelectedLog(log);
        setDetailOpen(true);
    };

    // ── Activity table columns ────────────────────────────────────────────
    const columns = [
        {
            title: 'Event',
            key: 'event',
            width: 150,
            render: (_, r) => {
                const s = TYPE_STYLES[r.type] || { icon: <Info size={13} />, tone: 'neutral', label: r.type || 'Event' };
                return (
                    <span className={`${styles.badge} ${TONE_CLASS[s.tone]}`}>
                        {s.icon} {s.label}
                    </span>
                );
            }
        },
        {
            title: 'Details',
            key: 'details',
            render: (_, r) => (
                <button type="button" className={styles.detailsButton}
                    onClick={() => openDetail(r)}
                    aria-label={`View details for ${r.entityTitle || r.entityType || 'this event'}`}>
                    <div className={styles.detailsTitle}>
                        {r.entityTitle || r.entityType || 'System Activity'}
                    </div>
                    <div className={styles.detailsDescription}>
                        {r.description || 'No description'}
                    </div>
                </button>
            )
        },
        {
            title: 'Entity',
            dataIndex: 'entityType',
            key: 'entityType',
            width: 110,
            render: (type) => {
                const s = ENTITY_STYLES[type] || { tone: 'neutral', icon: <Info size={11} /> };
                return (
                    <span className={`${styles.entityBadge} ${TONE_CLASS[s.tone]}`}>
                        {s.icon} {type || 'SYSTEM'}
                    </span>
                );
            }
        },
        {
            title: 'User',
            key: 'user',
            width: 170,
            render: (_, r) => {
                const name = r.user?.firstName ? `${r.user.firstName} ${r.user.lastName || ''}`.trim() : 'System';
                const email = r.user?.email || '';
                const isSystem = name === 'System' || !r.user?.firstName;
                return (
                    <div className={styles.userCell}>
                        <div className={`${styles.avatar} ${isSystem ? styles.avatarSystem : ''}`}
                            aria-hidden="true">
                            {name.charAt(0)}
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div className={styles.userName}>{name}</div>
                            {email && <div className={styles.userEmail}>{email}</div>}
                        </div>
                    </div>
                );
            }
        },
        {
            title: 'Time',
            key: 'time',
            width: 130,
            sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
            render: (_, r) => (
                <Tooltip title={formatTime(r.createdAt)}>
                    <span className={styles.timeCell}>{relativeTime(r.createdAt)}</span>
                </Tooltip>
            )
        },
        {
            title: '',
            key: 'action',
            width: 44,
            render: (_, r) => (
                <Tooltip title="View details">
                    <Button type="text" size="small" icon={<Eye size={13} />}
                        aria-label={`View details for ${r.entityTitle || r.entityType || 'this event'}`}
                        onClick={() => openDetail(r)} />
                </Tooltip>
            )
        }
    ];

    // ── OTP columns ────────────────────────────────────────────────────────
    const otpColumns = [
        {
            title: 'Time', dataIndex: 'CreatedAt', key: 'CreatedAt', width: 170,
            sorter: (a, b) => new Date(a.CreatedAt) - new Date(b.CreatedAt),
            render: (v) => <span className={styles.timeCell}>{formatTime(v)}</span>
        },
        {
            title: 'User', key: 'user', width: 200,
            render: (_, r) => {
                const name = [r.FirstName, r.LastName].filter(Boolean).join(' ') || r.Email;
                const initial = (r.FirstName || r.Email || 'U').charAt(0).toUpperCase();
                return (
                    <div className={styles.userCell}>
                        <div className={styles.avatar} aria-hidden="true">{initial}</div>
                        <div style={{ minWidth: 0 }}>
                            <div className={styles.userName}>{name}</div>
                            {r.Email && <div className={styles.userEmail}>{r.Email}</div>}
                        </div>
                    </div>
                );
            }
        },
        {
            title: 'Action', dataIndex: 'Action', key: 'Action', width: 120,
            render: (v) => {
                const s = OTP_ACTION_STYLES[v] || { tone: 'neutral', label: v };
                return <span className={`${styles.badge} ${TONE_CLASS[s.tone]}`}>{s.label}</span>;
            }
        },
        {
            title: 'Status', dataIndex: 'Status', key: 'Status', width: 100,
            render: (v) => (
                <span className={`${styles.badge} ${v === 'SUCCESS' ? TONE_CLASS.success : TONE_CLASS.danger}`}>
                    {v}
                </span>
            )
        },
        {
            title: 'Reason', dataIndex: 'Reason', key: 'Reason', width: 180, ellipsis: true,
            render: (v) => (
                <span className={v ? styles.reasonCell : styles.reasonEmpty}>{v || '—'}</span>
            )
        },
        {
            title: 'IP', dataIndex: 'IpAddress', key: 'IpAddress', width: 130,
            render: (v) => <span className={styles.monoCell}>{v || '—'}</span>
        },
    ];

    const isActivity = activeTab === 'activity';

    return (
        <div className={styles.page}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.headerRow}>
                    <div>
                        <div className={styles.titleRow}>
                            <h2 className={styles.title}>
                                {isActivity ? 'Activity Log' : 'OTP Audit'}
                            </h2>
                            {isActivity && total > 0 && (
                                <span className={styles.countBadge}>{total.toLocaleString()} events</span>
                            )}
                        </div>
                        <p className={styles.subtitle}>
                            {isActivity ? 'Track system events, user actions, and automation logs.' : 'OTP verification attempts and security events.'}
                        </p>
                    </div>
                    <div className={styles.headerActions}>
                        <Segmented
                            value={activeTab}
                            onChange={setActiveTab}
                            options={[
                                { label: 'System Logs', value: 'activity' },
                                { label: 'OTP Audit', value: 'otp' },
                            ]}
                        />
                        <Button icon={<RefreshCw size={13} />}
                            onClick={isActivity ? fetchLogs : () => fetchOtpLogs(1)}
                            loading={loading || otpLoading}
                            style={{ fontWeight: 600, fontSize: 'var(--bc-text-sm)' }}>
                            Refresh
                        </Button>
                    </div>
                </div>
            </div>

            <div className={styles.body}>
                {/* Activity Tab */}
                {isActivity && (
                    <>
                        <div className={styles.filters}>
                            <Input className={styles.searchInput} prefix={<Search size={13} />}
                                size="small" allowClear placeholder="Search events..."
                                value={searchQuery}
                                onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                                aria-label="Search events" />
                            <Select className={styles.typeSelect} size="small" value={filterType}
                                aria-label="Filter by event type"
                                onChange={v => { setFilterType(v); setPage(1); }}
                                options={[
                                    { value: 'ALL', label: 'All Events' },
                                    ...IMPORTANT_TYPES.map(t => ({ value: t, label: TYPE_STYLES[t]?.label || t }))
                                ]} />
                            <RangePicker className={styles.dateRange} size="small" value={dateRange}
                                aria-label="Filter by date range"
                                onChange={v => { setDateRange(v); setPage(1); }} />
                            <div className={styles.showAll}>
                                <input id="activity-show-all" type="checkbox" className={styles.showAllCheckbox}
                                    checked={showAllEvents}
                                    onChange={e => { setShowAllEvents(e.target.checked); setPage(1); }} />
                                <label className={styles.showAllLabel} htmlFor="activity-show-all">Show all events</label>
                            </div>
                            {hasFilters && (
                                <Button size="small" danger onClick={clearFilters}
                                    style={{ fontWeight: 600, fontSize: 'var(--bc-text-sm)' }}>Clear</Button>
                            )}
                        </div>

                        <div className={styles.card}>
                            <Table className={styles.table} columns={columns} dataSource={logs}
                                rowKey={r => r._id ?? r.Id ?? `${r.type}-${r.createdAt}-${r.entityType}`}
                                loading={loading} size="small" scroll={{ x: 'max-content' }}
                                pagination={{
                                    current: page, pageSize, total,
                                    showSizeChanger: true, pageSizeOptions: ['25', '50', '100'],
                                    showTotal: (t, range) => (
                                        <span className={styles.paginationSummary}>
                                            Showing <span className={styles.paginationStrong}>{range[0]}-{range[1]}</span>
                                            {' '}of <span className={styles.paginationStrong}>{t.toLocaleString()}</span> events
                                        </span>
                                    ),
                                    onChange: (p, ps) => { setPage(p); if (ps !== pageSize) setPageSize(ps); }
                                }}
                            />
                        </div>
                    </>
                )}

                {/* OTP Tab */}
                {activeTab === 'otp' && (
                    <>
                        <div className={styles.filters}>
                            <Select className={styles.typeSelect} size="small" allowClear placeholder="Action"
                                value={otpActionFilter || undefined} aria-label="Filter by OTP action"
                                onChange={v => setOtpActionFilter(v || '')}
                                options={[
                                    { value: 'OTP_SENT', label: 'Sent' },
                                    { value: 'OTP_VERIFIED', label: 'Verified' },
                                    { value: 'OTP_FAILED', label: 'Failed' },
                                ]} />
                            <Input className={styles.searchInput} prefix={<Search size={12} />} size="small"
                                placeholder="Email..." allowClear value={otpEmailFilter}
                                aria-label="Filter by email"
                                onChange={e => setOtpEmailFilter(e.target.value)} />
                        </div>
                        <div className={styles.card}>
                            <Table className={styles.table} columns={otpColumns} dataSource={otpLogs}
                                rowKey={r => r.Id ?? r.id}
                                loading={otpLoading} size="small" scroll={{ x: 'max-content' }}
                                pagination={{
                                    current: otpPage, pageSize: 20, total: otpTotal, onChange: fetchOtpLogs,
                                    showTotal: t => <span className={styles.paginationSummary}>{t} records</span>
                                }} />
                        </div>
                    </>
                )}
            </div>

            {/* Detail Modal */}
            <Modal open={detailOpen} onCancel={() => setDetailOpen(false)} centered width={620} destroyOnHidden
                title={
                    <div className={styles.modalHeader}>
                        <div className={styles.modalIcon}>
                            <Activity size={15} style={{ color: 'var(--bc-text-inverse)' }} />
                        </div>
                        <div>
                            <div className={styles.modalTitle}>Event Details</div>
                            <div className={styles.modalSubtitle}>{selectedLog?.type || 'Activity'}</div>
                        </div>
                    </div>
                }
                footer={
                    <Button type="primary" onClick={() => setDetailOpen(false)}
                        style={{ fontWeight: 600, fontSize: 'var(--bc-text-sm)' }}>Close</Button>
                }
            >
                {selectedLog && (
                    <div className={styles.section}>
                        <Descriptions bordered size="small" column={2}>
                            <Descriptions.Item label="Type">
                                {(() => {
                                    const s = TYPE_STYLES[selectedLog.type] || { tone: 'neutral', label: selectedLog.type };
                                    return (
                                        <span className={`${styles.badge} ${TONE_CLASS[s.tone]}`}>
                                            {s.label || selectedLog.type}
                                        </span>
                                    );
                                })()}
                            </Descriptions.Item>
                            <Descriptions.Item label="Entity">{selectedLog.entityType || 'SYSTEM'}</Descriptions.Item>
                            <Descriptions.Item label="Time" span={2}>{formatTime(selectedLog.createdAt)}</Descriptions.Item>
                            <Descriptions.Item label="User" span={2}>
                                {selectedLog.user?.firstName
                                    ? `${selectedLog.user.firstName} ${selectedLog.user.lastName || ''}`.trim()
                                    : 'System'}
                                {selectedLog.user?.email && (
                                    <span style={{ marginLeft: 6, fontSize: 'var(--bc-text-xs)', color: 'var(--bc-text-secondary)' }}>
                                        ({selectedLog.user.email})
                                    </span>
                                )}
                            </Descriptions.Item>
                        </Descriptions>
                        <div>
                            <span className={styles.sectionLabel}>Description</span>
                            <div className={styles.descriptionBox}>
                                {selectedLog.description || 'No description available.'}
                            </div>
                        </div>
                        <div>
                            <span className={styles.sectionLabel}>Metadata</span>
                            <div className={styles.metadataScroll}>
                                {renderMetadata(selectedLog.metadata)}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default ActivityLog;
