import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import {
    Drawer, Typography, Tag, Button, Empty, Spin, Tooltip, message,
    ConfigProvider, Segmented, Progress, Card, List, Space, Row, Col,
    Statistic, Alert, Pagination
} from 'antd';
import {
    Download, FileText, FileSpreadsheet, Clock, CheckCircle2,
    AlertTriangle, RefreshCw, Calendar, Info, DownloadCloud,
    Archive, Activity, XCircle, Loader2, Search, Trash2,
    FileJson, FileCode2, File, Sparkles, ArrowUpRight,
    Database, Zap, Filter, HardDrive, TrendingUp, X
} from 'lucide-react';
import { exportApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';

const { Text, Paragraph, Title } = Typography;

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const b = Number(bytes);
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
    return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const formatRelativeTime = (dateString) => {
    if (!dateString) return 'just now';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '—';
    const diff = Date.now() - d.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 30) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const getFileIcon = (format) => {
    const f = String(format || '').toLowerCase();
    if (f.includes('csv')) return { Icon: FileText, color: '#2E7D32', bg: '#ecfdf5', border: '#a7f3d0' };
    if (f.includes('xls') || f.includes('xlsx')) return { Icon: FileSpreadsheet, color: '#2E7D32', bg: '#ecfdf5', border: '#a7f3d0' };
    if (f.includes('json')) return { Icon: FileJson, color: '#E65100', bg: '#fffbeb', border: '#fef3c7' };
    if (f.includes('xml')) return { Icon: FileCode2, color: '#9C27B0', bg: '#f5f3ff', border: '#ddd6fe' };
    if (f.includes('pdf')) return { Icon: FileText, color: '#C62828', bg: '#fef2f2', border: '#fee2e2' };
    if (f.includes('zip')) return { Icon: Archive, color: '#1976D2', bg: '#eef2ff', border: '#e0e7ff' };
    return { Icon: File, color: 'var(--text-secondary)', bg: '#f3f4f6', border: '#e5e7eb' };
};

const getStatusConfig = (status) => {
    const s = String(status || '').toLowerCase();
    switch (s) {
        case 'completed':
        case 'success':
            return {
                label: 'READY',
                color: 'success',
                colorCode: '#52c41a',
                icon: CheckCircle2
            };
        case 'processing':
        case 'in_progress':
            return {
                label: 'PROCESSING',
                color: 'processing',
                colorCode: '#1890ff',
                icon: Loader2,
                animated: true
            };
        case 'failed':
        case 'error':
            return {
                label: 'FAILED',
                color: 'error',
                colorCode: '#ff4d4f',
                icon: XCircle
            };
        case 'pending':
        case 'queued':
            return {
                label: 'QUEUED',
                color: 'warning',
                colorCode: '#faad14',
                icon: Clock
            };
        case 'expired':
        case 'cancelled':
            return {label:s.toUpperCase(),color:'default',colorCode:'#94a3b8',icon:Clock};
        default:
            return {
                label: 'PENDING',
                color: 'default',
                colorCode: '#bfbfbf',
                icon: Clock
            };
    }
};

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
const DownloadsDrawer = ({ isOpen, onClose,refreshRevision:externalRevision=0 }) => {
    const [downloads, setDownloads] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filterStatus, setFilterStatus] = useState('all');
    const socket = useSocket();
    const {user}=useAuth();
    const permissions=user?.permissions||[];
    const canAds=['adsreport_view','adsreport_export'].every(p=>permissions.includes('*')||permissions.includes(p));
    const principal=JSON.stringify([user?.Id||user?.id||user?._id,user?.role?.name,user?.assignedSellers,permissions]);
    const canGms=permissions.includes('*')||permissions.includes('gms_tracker_export');
    const [reports,setReports]=useState({});
    const [pages,setPages]=useState({ads:1,gms:1});
    const [action,setAction]=useState(null);
    const actionLock=useRef(false);
    const [source,setSource]=useState('all');
    const [refreshRevision,setRefreshRevision]=useState(0);
    useEffect(()=>{setPages({ads:1,gms:1});setSource('all');setReports({});},[principal]);
    useEffect(()=>{
        if(!isOpen)return;
        let stopped=false,timer,controller;
        const kinds=[...(canAds?['ads']:[]),...(canGms?['gms']:[])];
        if(!kinds.length)return;
        const load=async()=>{
            controller=new AbortController();
            const results=await Promise.allSettled(kinds.map(kind=>exportApi.getReportDownloads(kind,{page:pages[kind],signal:controller.signal})));
            if(stopped)return;
            const next={};let active=false;
            results.forEach((result,i)=>{
                const kind=kinds[i],data=result.status==='fulfilled'&&result.value?.success?result.value.data:null;
                if(data&&Array.isArray(data.rows)){next[kind]={principal,...data};active=active||data.activeCount>0;}
                else next[kind]={principal,rows:[],total:0,error:result.status==='rejected'?result.reason?.message:'Invalid report history response'};
            });
            setReports(next);
            timer=setTimeout(load,active?3000:15000);
        };
        void load();
        return ()=>{stopped=true;clearTimeout(timer);controller?.abort();};
    },[isOpen,canAds,canGms,principal,pages,refreshRevision,externalRevision]);

    // Normalize schema
    const normalize = useCallback((d) => {
        if (!d) return {};
        return {
            id: d.Id || d.id || d._id,
            status: (d.Status || d.status || 'completed').toLowerCase(),
            fileName: d.FileName || d.fileName || 'unnamed_export',
            format: (d.Format || d.format || 'csv').toLowerCase(),
            rowCount: d.RowCount !== undefined ? d.RowCount : d.rowCount,
            fileSize: d.FileSize !== undefined ? d.FileSize : d.fileSize,
            createdAt: d.CreatedAt || d.createdAt,
            progress: d.Progress !== undefined ? d.Progress : d.progress,
            errorMessage: d.ErrorMessage || d.errorMessage
        };
    }, []);

    const fetchDownloads = useCallback(async () => {
        try {
            const res = await exportApi.getDownloads();
            if (res && res.success) {
                setDownloads(res.data || []);
            }
        } catch (err) {
            console.error('Downloads sync error:', err);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            fetchDownloads().finally(() => setLoading(false));
        }
    }, [isOpen, fetchDownloads,externalRevision]);

    // Real-time socket events integration
    useEffect(() => {
        if (!socket || !isOpen) return;

        const handleExportProgress = (data) => {
            if (!data) return;
            const updated = normalize(data);
            
            setDownloads(prev => {
                const idx = prev.findIndex(d => (d.Id || d.id || d._id) === updated.id);
                if (idx !== -1) {
                    const next = [...prev];
                    next[idx] = {
                        ...next[idx],
                        Status: updated.status,
                        Progress: updated.progress,
                        FilePath: updated.filePath || next[idx].FilePath || next[idx].filePath,
                        ErrorMessage: updated.errorMessage || next[idx].ErrorMessage || next[idx].errorMessage
                    };
                    return next;
                } else {
                    fetchDownloads();
                    return prev;
                }
            });
        };

        socket.on('export_progress', handleExportProgress);
        return () => {
            socket.off('export_progress', handleExportProgress);
        };
    }, [socket, isOpen, fetchDownloads, normalize]);

    // Normalize all downloads
    const normalizedDownloads = useMemo(() => {
        const legacy=downloads.map(normalize).map(d=>({...d,source:'legacy',key:'legacy:'+d.id}));
        const canonical=['ads','gms'].flatMap(kind=>{
            if(!(kind==='ads'?canAds:canGms)||reports[kind]?.principal!==principal)return [];
            return reports[kind].rows.map(j=>{
                const f=j.filters||{};
                const range=kind==='ads'?(f.allHistory?'all-history':f.startDate+'-'+f.endDate):(f.exportDateType==='all'?'all-history':f.exportDateType==='custom'?(f.exportCustomDates||[]).join('-'):f.startDate+'-'+f.endDate);
                return {id:j.id,key:kind+':'+j.id,source:kind,status:String(j.status).toLowerCase(),
                    fileName:(kind==='ads'?'ads-intelligence-':'gms_export_'+f.exportLevel+'_')+range+'.'+j.format,
                    format:j.format,rowCount:j.rawCount,fileSize:j.bytes,createdAt:j.createdAt,
                    expiresAt:j.expiresAt,stage:j.stage,attemptCount:j.attemptCount,errorMessage:j.errorCode,
                    scope:j.sellerScope?.global?'All authorized sellers':j.sellerScope?.ids?.length?j.sellerScope.ids.length+' authorized seller(s)':f.sellerId||f.sellerIds?.join(', ')||'Authorized sellers'};
            });
        });
        return [...legacy,...canonical].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    }, [downloads, normalize, reports, canAds,canGms, principal]);

    // Compute stats
    const stats = useMemo(() => {
        const total = normalizedDownloads.length;
        const completed = normalizedDownloads.filter(d => d.status === 'completed').length;
        const processing = normalizedDownloads.filter(d => ['processing','pending','queued'].includes(d.status)).length;
        const failed = normalizedDownloads.filter(d => d.status === 'failed').length;
        const totalSize = normalizedDownloads
            .filter(d => d.fileSize)
            .reduce((sum, d) => sum + Number(d.fileSize), 0);
        return { total, completed, processing, failed, totalSize };
    }, [normalizedDownloads]);

    // Filter downloads
    const filteredDownloads = useMemo(() => {
        const selected=normalizedDownloads.filter(d=>source==='all'||d.source===source);
        if (filterStatus === 'all') return selected;
        return selected.filter(d => {
            if (filterStatus === 'processing') return ['processing','pending','queued'].includes(d.status);
            if (filterStatus === 'completed') return d.status === 'completed';
            if (filterStatus === 'failed') return d.status === 'failed';
            return true;
        });
    }, [normalizedDownloads, filterStatus,source]);

    const handleDownloadTrigger = async (item) => {
        if (item.status !== 'completed') return;

        const key = `dnld-${item.id}`;
        message.loading({ content: `Preparing ${item.fileName}...`, key, duration: 0 });

        try {
            const blob = await (item.source==='legacy'?exportApi.downloadFile(item.id,{fileName:item.fileName,fileSize:item.fileSize}):exportApi.downloadReportFile(item.source,item.id,{fileName:item.fileName,fileSize:item.fileSize}));
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = item.fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(()=>window.URL.revokeObjectURL(url),30000);
            message.success({ content: '✨ Download complete!', key, duration: 2 });
        } catch (err) {
            console.error('Download failed:', err);
            message.error({ content: err.message || 'Failed to download file', key, duration: 5 });
        }
    };

    const handleReportAction=async(item,operation)=>{
        if(actionLock.current)return;
        actionLock.current=true;setAction(item.id+operation);
        try{await exportApi.mutateReportDownload(item.source,item.id,operation);message.success(operation==='retry'?'Export queued again':'Export cancelled');}
        catch(e){message.error(e.message);}
        finally{actionLock.current=false;setAction(null);setRefreshRevision(v=>v+1);}
    };
    const handleRefresh = () => {
        setRefreshRevision(v=>v+1);
        setLoading(true);
        fetchDownloads().finally(() => setLoading(false));
    };

    return (
        <ConfigProvider
            theme={{
                token: {
                    borderRadius: "var(--radius-md)",
                    colorPrimary: '#1976D2',
                    colorBgLayout: '#f8fafc'
                },
                components: {
                    Card: {
                        colorBorderSecondary: '#e2e8f0'
                    }
                }
            }}
        >
            <Drawer
                title={
                    <Space size="middle">
                        <div style={{
                            width: 38,
                            height: 38,
                            borderRadius: "var(--radius-md)",
                            background: 'linear-gradient(135deg, #1976D2 0%, #1976D2 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            boxShadow: '0 4px 10px rgba(79,70,229,0.2)'
                        }}>
                            <DownloadCloud size={18} strokeWidth={2.5} />
                        </div>
                        <div>
                            <Title level={5} style={{ margin: 0, fontWeight: 600, color: '#0f172a' }}>
                                Exports Center
                            </Title>
                            <Text type="secondary" style={{ fontSize: 'var(--font-size-xs)', display: 'block', marginTop: 1 }}>
                                Manage and download your exported reports
                            </Text>
                        </div>
                    </Space>
                }
                placement="right"
                onClose={onClose}
                open={isOpen}
                extra={
                    <Space size="small">
                        <Button
                            type="text"
                            shape="circle"
                            onClick={handleRefresh}
                            disabled={loading}
                            icon={loading ? <span className="icon-[svg-spinners--eclipse]" style={{ fontSize: 14 }} aria-hidden="true" /> : <RefreshCw size={14} />}
                        />
                        <Button
                            type="text"
                            shape="circle"
                            onClick={onClose}
                            icon={<X size={16} />}
                        />
                    </Space>
                }
                styles={{
                    wrapper: { width: 420 },
                    body: { padding: '16px', background: '#f8fafc' },
                    header: { padding: '16px 20px', background: '#ffffff', borderBottom: '1px solid #e2e8f0' }
                }}
            >
                <Spin spinning={loading} size="large">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
                        
                        {/* Statistics Summary Widgets */}
                        {stats.total > 0 && (
                            <Row gutter={[8, 8]}>
                                <Col span={6}>
                                    <Card size="small" styles={{ body: { padding: '10px 6px', textAlign: 'center' } }}>
                                        <Statistic
                                            title={<Text type="secondary" style={{ fontSize: 10, fontWeight: 600 }}>TOTAL</Text>}
                                            value={stats.total}
                                            valueStyle={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: '#0f172a' }}
                                        />
                                    </Card>
                                </Col>
                                <Col span={6}>
                                    <Card size="small" styles={{ body: { padding: '10px 6px', textAlign: 'center' } }}>
                                        <Statistic
                                            title={<Text type="secondary" style={{ fontSize: 10, fontWeight: 600 }}>ACTIVE</Text>}
                                            value={stats.processing}
                                            valueStyle={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: '#1890ff' }}
                                        />
                                    </Card>
                                </Col>
                                <Col span={6}>
                                    <Card size="small" styles={{ body: { padding: '10px 6px', textAlign: 'center' } }}>
                                        <Statistic
                                            title={<Text type="secondary" style={{ fontSize: 10, fontWeight: 600 }}>READY</Text>}
                                            value={stats.completed}
                                            valueStyle={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: '#52c41a' }}
                                        />
                                    </Card>
                                </Col>
                                <Col span={6}>
                                    <Card size="small" styles={{ body: { padding: '10px 6px', textAlign: 'center' } }}>
                                        <Statistic
                                            title={<Text type="secondary" style={{ fontSize: 10, fontWeight: 600 }}>FAILED</Text>}
                                            value={stats.failed}
                                            valueStyle={{ fontSize: 'var(--font-size-lg)', fontWeight: 800, color: '#ff4d4f' }}
                                        />
                                    </Card>
                                </Col>
                            </Row>
                        )}

                        {(canAds||canGms)&&<Segmented block value={source} onChange={setSource} options={[{label:'All',value:'all'},...(canAds?[{label:'Ads',value:'ads'}]:[]),...(canGms?[{label:'GMS',value:'gms'}]:[]),{label:'Other',value:'legacy'}]}/>}
                        {['ads','gms'].filter(kind=>reports[kind]?.principal===principal&&reports[kind]?.error).map(kind=><Alert key={kind} type="error" showIcon message={kind.toUpperCase()+': '+reports[kind].error} action={<Button size="small" onClick={handleRefresh}>Retry</Button>}/>)}
                        {/* Navigation Tabs */}
                        {stats.total > 0 && (
                            <Segmented
                                value={filterStatus}
                                onChange={setFilterStatus}
                                block
                                options={[
                                    { label: `All (${stats.total})`, value: 'all' },
                                    { label: `Active (${stats.processing})`, value: 'processing' },
                                    { label: `Ready (${stats.completed})`, value: 'completed' },
                                    { label: `Failed (${stats.failed})`, value: 'failed' }
                                ]}
                                style={{ fontWeight: 600 }}
                            />
                        )}

                        {/* Downloads List using Ant Design Components */}
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            <List
                                rowKey={item=>item.key}
                                dataSource={filteredDownloads}
                                locale={{
                                    emptyText: stats.total === 0 ? (
                                        <Empty
                                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                                            description={
                                                <Space orientation="vertical" size="small" style={{ width: '100%' }}>
                                                    <Text strong>No Exports Registered</Text>
                                                    <Text type="secondary" style={{ fontSize: 'var(--font-size-xs)' }}>
                                                        Your downloaded files and matrix spreadsheets will show up here.
                                                    </Text>
                                                </Space>
                                            }
                                        />
                                    ) : (
                                        <Empty
                                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                                            description={`No ${filterStatus} downloads matched.`}
                                        />
                                    )
                                }}
                                renderItem={(item) => {
                                    const fileConfig = getFileIcon(item.format);
                                    const statusConfig = getStatusConfig(item.status);
                                    const isClickable = item.status === 'completed';
                                    
                                    return (
                                        <List.Item style={{ padding: '6px 0', border: 'none' }}>
                                            <Card
                                                hoverable={isClickable}
                                                style={{
                                                    width: '100%',
                                                    borderLeft: `4px solid ${statusConfig.colorCode}`,
                                                    borderRadius: "var(--radius-md)",
                                                    boxShadow: '0 1px 2px rgba(0,0,0,0.01)'
                                                }}
                                                styles={{ body: { padding: 14 } }}
                                                onClick={() => isClickable && handleDownloadTrigger(item)}
                                            >
                                                <div style={{ display: 'flex', gap: 12, alignItems: 'start' }}>
                                                    {/* File Type Icon badge */}
                                                    <div style={{
                                                        width: 38,
                                                        height: 38,
                                                        borderRadius: "var(--radius-md)",
                                                        background: fileConfig.bg,
                                                        border: `1px solid ${fileConfig.border}`,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: fileConfig.color,
                                                        flexShrink: 0
                                                    }}>
                                                        <fileConfig.Icon size={18} />
                                                    </div>

                                                    {/* Description Details */}
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8, marginBottom: 4 }}>
                                                            <Typography.Text strong style={{ fontSize: 'var(--font-size-sm)', lineHeight: 1.3 }} ellipsis={{ tooltip: item.fileName }}>
                                                                {item.fileName}
                                                            </Typography.Text>
                                                            <Tag color={statusConfig.color} style={{ margin: 0, textTransform: 'uppercase', fontSize: 9, fontWeight: 600 }}>
                                                                {statusConfig.label}
                                                            </Tag>
                                                        </div>

                                                        {/* Metadata row */}
                                                        <Space size="middle" separator={<span style={{ color: '#d9d9d9', fontSize: 10 }}>|</span>} style={{ fontSize: 'var(--font-size-xs)', color: '#8c8c8c', marginBottom: item.status === 'processing' || item.status === 'failed' ? 8 : 0, display: 'flex', flexWrap: 'wrap' }}>
                                                            <Text type="secondary" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: fileConfig.color }}>
                                                                {item.format.toUpperCase()}
                                                            </Text>
                                                            {item.rowCount !== undefined && item.rowCount !== null && (
                                                                <span>{item.rowCount.toLocaleString()} rows</span>
                                                            )}
                                                            {item.fileSize !== undefined && item.fileSize !== null && (
                                                                <span>{formatSize(item.fileSize)}</span>
                                                            )}
                                                            <span style={{ color: '#bfbfbf' }}>{formatRelativeTime(item.createdAt)}</span>
                                                        </Space>

                                                        {item.source!=='legacy'&&<div style={{marginTop:6}}>
                                                            <Text type="secondary">{item.source.toUpperCase()} report · {item.scope}</Text>
                                                            {['queued','processing'].includes(item.status)&&<div role="status"><Space size={6}><Loader2 size={14} className="spin-animation"/><Text>{({queued:'Waiting for worker',generating:'Reading and reconciling reports',writing:'Writing financial workbook',verifying:'Verifying report',storing:'Validating and saving artifact',retry_wait:'Waiting to retry'})[item.stage]||'Processing export'}</Text></Space></div>}
                                                            {item.attemptCount>0&&<div><Text type="secondary">Attempt {item.attemptCount}/3</Text></div>}
                                                            {item.expiresAt&&item.status==='completed'&&<div><Text type="secondary">Expires {new Date(item.expiresAt).toLocaleString()}</Text></div>}
                                                            {['queued','processing','failed'].includes(item.status)&&<Button size="small" style={{marginTop:6}} disabled={!!action} loading={action===item.id+(item.status==='failed'?'retry':'cancel')} onClick={e=>{e.stopPropagation();handleAdsAction(item,item.status==='failed'?'retry':'cancel');}}>{item.status==='failed'?'Retry':'Cancel'}</Button>}
                                                        </div>}
                                                        {/* Native Ant Design Progress */}
                                                        {item.status === 'processing' && item.source==='legacy' && (
                                                            <div style={{ marginTop: 6 }}>
                                                                <Progress
                                                                    percent={Math.round(item.progress || 0)}
                                                                    size="small"
                                                                    status="active"
                                                                    strokeColor={{
                                                                        '0%': '#1890ff',
                                                                        '100%': '#69c0ff',
                                                                    }}
                                                                />
                                                            </div>
                                                        )}

                                                        {/* Native Ant Design Alert for Errors */}
                                                        {item.status === 'failed' && item.errorMessage && (
                                                            <div style={{ marginTop: 8 }}>
                                                                <Alert
                                                                    message={item.errorMessage}
                                                                    type="error"
                                                                    showIcon
                                                                    style={{ padding: '4px 8px', fontSize: 'var(--font-size-xs)' }}
                                                                />
                                                            </div>
                                                        )}

                                                        {/* Native Action Button */}
                                                        {isClickable && (
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTop: '1px solid #f0f0f0' }}>
                                                                <span style={{ fontSize: 'var(--font-size-xs)', color: '#52c41a', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                                    <Sparkles size={11} style={{ fill: '#52c41a' }} />
                                                                    File ready
                                                                </span>
                                                                <Button
                                                                    type="primary"
                                                                    size="small"
                                                                    icon={<Download size={12} />}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDownloadTrigger(item);
                                                                    }}
                                                                    style={{ borderRadius: 6, fontWeight: 600 }}
                                                                >
                                                                    Download
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </Card>
                                        </List.Item>
                                    );
                                }}
                            />
                        </div>

                        {['ads','gms'].filter(kind=>(source==='all'||source===kind)&&reports[kind]?.principal===principal&&reports[kind].total>50).map(kind=><div key={kind}><Text type="secondary">{kind.toUpperCase()} history</Text><Pagination size="small" current={pages[kind]} pageSize={50} total={reports[kind].total} showSizeChanger={false} onChange={page=>setPages(prev=>({...prev,[kind]:page}))}/></div>)}
                        {/* Footer Status Metadata */}
                        {stats.total > 0 && (
                            <div style={{
                                padding: '12px 4px 4px',
                                borderTop: '1px solid #e2e8f0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                color: '#64748b'
                            }}>
                                <Typography.Text type="secondary" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
                                    Showing {filteredDownloads.length} of {stats.total} exports
                                </Typography.Text>
                                {stats.totalSize > 0 && (
                                    <Tag color="purple" style={{ margin: 0, fontWeight: 600 }}>
                                        Disk Used: {formatSize(stats.totalSize)}
                                    </Tag>
                                )}
                            </div>
                        )}

                    </div>
                </Spin>

                <style>{`
                    @keyframes spin-animation {
                        to { transform: rotate(360deg); }
                    }
                    .spin-animation {
                        animation: spin-animation 1.2s linear infinite;
                    }
                    /* Custom scrollbars matching the rest of the application */
                    ::-webkit-scrollbar {
                        width: 6px;
                    }
                    ::-webkit-scrollbar-track {
                        background: transparent;
                    }
                    ::-webkit-scrollbar-thumb {
                        background: #cbd5e1;
                        border-radius: 3px;
                    }
                    ::-webkit-scrollbar-thumb:hover {
                        background: #94a3b8;
                    }
                `}</style>
            </Drawer>
        </ConfigProvider>
    );
};

export default memo(DownloadsDrawer);