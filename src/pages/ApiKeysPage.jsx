import { Spinner } from "@/components/Spinner";
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Check, ChevronRight, Eye, EyeOff, RefreshCw, Plus, Trash2, Edit, AlertCircle, X } from 'lucide-react';
import api from '../services/api';
import { Alert, Input, Modal, Select, Button as AntdButton } from 'antd';
import styles from './ApiKeysPage.module.css';
import { PageLoader } from '@/components/application/loading-indicator/PageLoader';
import { LoadingIndicator } from '@/components/application/loading-indicator/loading-indicator';

const CATEGORY_COLORS = {
    'Scraping': 'var(--bc-indigo-500)',
    'Amazon Data': 'var(--bc-amber-500)',
    'AI': '#10B981',
    'Communication': 'var(--bc-pink-500)',
    'Other': 'var(--bc-slate-500)'
};

/* ─── Sub-components ───────────────────────────────────────────── */
const Toggle = ({ enabled }) => (
    <div style={{
        width: 44, height: 24, borderRadius: "var(--radius-lg)",
        background: enabled ? 'var(--bc-indigo-600)' : 'var(--bc-slate-300)',
        position: 'relative', flexShrink: 0,
    }}>
        <span style={{
            position: 'absolute',
            top: 2, left: enabled ? 20 : 2,
            width: 20, height: 20, borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            transition: 'left 200ms',
        }} />
    </div>
);

const CategoryPill = ({ label, color }) => (
    <span style={{
        fontSize: 'var(--font-size-xs)', fontWeight: 600, padding: '3px 8px',
        borderRadius: 6,
        background: color + '18',
        color,
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
    }}>
        {label}
    </span>
);

/* ─── Main Page ────────────────────────────────────────────────── */
const ApiKeysPage = () => {
    const [apiKeys, setApiKeys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [revealedKeys, setRevealedKeys] = useState({});
    const [copiedId, setCopiedId] = useState(null);

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [editingKey, setEditingKey] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        serviceId: '',
        value: '',
        category: 'Other',
        description: ''
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

useEffect(() => { fetchKeys(); }, []);

    const fetchKeys = async () => {
        setLoading(true);
        try {
            const res = await api.get('/keys');
            if (res.success) {
                setApiKeys(res.data);
            }
        } catch (err) {
            console.error('Fetch keys error:', err);
            setError('Failed to load API keys');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        try {
            if (editingKey) {
                await api.put(`/keys/${editingKey._id}`, formData);
            } else {
                await api.post('/keys', formData);
            }
            setModalOpen(false);
            fetchKeys();
        } catch (err) {
            setError(err.message || 'Error saving key');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this key?')) return;
        try {
            await api.delete(`/keys/${id}`);
            fetchKeys();
        } catch (err) {
            alert('Delete failed: ' + err.message);
        }
    };

    const toggleActive = async (key) => {
        try {
            await api.put(`/keys/${key._id}`, { isActive: !key.isActive });
            fetchKeys();
        } catch (err) {
            alert('Update failed: ' + err.message);
        }
    };

    const handleReveal = async (id) => {
        if (revealedKeys[id]) {
            setRevealedKeys(prev => {
                const updated = { ...prev };
                delete updated[id];
                return updated;
            });
            return;
        }
        try {
            const res = await api.get(`/keys/${id}/reveal`);
            if (res.success) {
                setRevealedKeys(prev => ({ ...prev, [id]: res.value }));
            }
        } catch (err) {
            alert('Reveal failed: ' + err.message);
        }
    };

    const openEditModal = (key) => {
        setEditingKey(key);
        setFormData({
            name: key.name,
            serviceId: key.serviceId,
            value: '', // Don't pre-fill masked value
            category: key.category,
            description: key.description || ''
        });
        setModalOpen(true);
    };

    const openAddModal = () => {
        setEditingKey(null);
        setFormData({
            name: '',
            serviceId: '',
            value: '',
            category: 'Other',
            description: ''
        });
        setModalOpen(true);
    };

    const handleCopy = (id, val) => {
        if (!val) return;
        navigator.clipboard.writeText(val).catch(() => { });
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

return (
    <div style={{ padding: '24px 12px' }}>
        {loading && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}>
                <LoadingIndicator type="line-simple" size="md" />
            </div>
        )}
        {/* Breadcrumb & Header */}
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <p className="text-muted small mb-0">Manage all your secure API integrations from one place</p>
                </div>
                <div className="d-flex align-items-center gap-3">
                    <AntdButton
                        type="primary"
                        onClick={openAddModal}
                        icon={<Plus size={18} />}
                        className="shadow-sm"
                        style={{ borderRadius: '10px', fontWeight: 600, height: 38, paddingInline: 16 }}
                    >
                        Add New Key
                    </AntdButton>
                    <div className="d-flex align-items-center gap-2 fs-13 text-muted">
                        <Link to="/settings" className="text-decoration-none text-muted">Settings</Link>
                        <ChevronRight size={14} />
                        <span className="fw-semibold text-dark">API Keys</span>
                    </div>
                </div>
            </div>

            {/* Security notice */}
            <Alert
                type="info"
                className="border-0 shadow-sm"
                style={{ borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--bc-indigo-50)', color: '#3730A3' }}
                message={
                    <div className="d-flex align-items-center gap-3">
                        <span className="fs-4">🔒</span>
                        <span className="small">
                            <strong>Secure Storage:</strong> All keys are stored in the backend database.
                            Values are masked by default and only revealed upon secure request.
                            Anonymized provider names are used to maintain abstraction and security.
                        </span>
                    </div>
                }
            />

            {/* Main Content Card */}
            <div className="card border-0 shadow-sm overflow-hidden" style={{ borderRadius: 'var(--radius-xl)' }}>
                <div className="card-header bg-white border-bottom py-3 px-4 d-flex justify-content-between align-items-center">
                    <div>
                        <h5 className="mb-1 fw-bold text-dark">Configured Integrations</h5>
                        <p className="mb-0 text-muted smallest">{apiKeys.length} active configurations</p>
                    </div>
                    <AntdButton
                        type="link"
                        onClick={fetchKeys}
                        disabled={loading}
                        icon={loading ? <span className="icon-[svg-spinners--eclipse]" style={{ fontSize: 14 }} aria-hidden="true" /> : <RefreshCw size={14} />}
                        className="text-decoration-none text-muted smallest fw-semibold"
                        style={{ padding: 0, height: 'auto' }}
                    >
                        Refresh List
                    </AntdButton>
                </div>

                <div className={styles.tableWrap}>
                    <table className={styles.table}>
                        <thead className="bg-light">
                            <tr>
                                <th className="text-uppercase text-muted smallest fw-bold tracking-wider">Service Provider</th>
                                <th className="text-uppercase text-muted smallest fw-bold tracking-wider">Category</th>
                                <th className="text-uppercase text-muted smallest fw-bold tracking-wider">API Key (Masked)</th>
                                <th className="text-uppercase text-muted smallest fw-bold tracking-wider text-center">Status</th>
                                <th className="text-uppercase text-muted smallest fw-bold tracking-wider text-end">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
{apiKeys.length === 0 ? (
    <tr>
        <td colSpan={5} className="text-center py-5 text-muted">
            No API keys configured. Click "Add New Key" to get started.
        </td>
    </tr>
) : apiKeys.map((key) => {
                                const isRevealed = !!revealedKeys[key._id];
                                const displayValue = isRevealed ? revealedKeys[key._id] : key.value;

                                return (
                                    <tr key={key._id}>
                                        <td>
                                            <div className="fw-bold text-dark">{key.name}</div>
                                            <div className="smallest text-muted">{key.description || 'No description provided'}</div>
                                            <div className="smallest text-muted-opacity fw-mono mt-1" style={{ fontSize: '10px' }}>ID: {key.serviceId}</div>
                                        </td>
                                        <td>
                                            <CategoryPill label={key.category} color={CATEGORY_COLORS[key.category] || CATEGORY_COLORS['Other']} />
                                        </td>
                                        <td>
                                            <div className="d-inline-flex align-items-center bg-light border px-2 py-1 rounded" style={{ minWidth: '180px' }}>
                                                <code className="smallest fw-mono text-secondary me-2">
                                                    {displayValue}
                                                </code>
                                                <div className="ms-auto d-flex gap-1">
                                                    <AntdButton
                                                        type="link"
                                                        onClick={() => handleReveal(key._id)}
                                                        className="text-muted hover-primary transition-all"
                                                        style={{ padding: 0, height: 'auto' }}
                                                        title={isRevealed ? "Mask" : "Reveal"}
                                                        aria-label={isRevealed ? "Mask key value" : "Reveal key value"}
                                                    >
                                                        {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                                                    </AntdButton>
                                                    <AntdButton
                                                        type="link"
                                                        onClick={() => handleCopy(key._id, displayValue)}
                                                        className="text-muted hover-success transition-all"
                                                        style={{ padding: 0, height: 'auto' }}
                                                        title="Copy"
                                                        aria-label="Copy key value"
                                                    >
                                                        {copiedId === key._id ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                                                    </AntdButton>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="text-center">
                                            <div
                                                className="d-inline-block cursor-pointer transition-all"
                                                onClick={() => toggleActive(key)}
                                                style={{ opacity: key.isActive ? 1 : 0.6 }}
                                            >
                                                <Toggle enabled={key.isActive} />
                                                <div className={`smallest fw-bold mt-1 ${key.isActive ? 'text-success' : 'text-danger'}`}>
                                                    {key.isActive ? 'Active' : 'Disabled'}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="text-end">
                                            <div className="d-flex justify-content-end gap-2">
                                                <AntdButton
                                                    type="text"
                                                    size="small"
                                                    onClick={() => openEditModal(key)}
                                                    icon={<Edit size={14} />}
                                                    className="text-secondary hover-bg-light"
                                                    title="Edit Configuration"
                                                    aria-label="Edit Configuration"
                                                >
                                                    Edit
                                                </AntdButton>
                                                <AntdButton
                                                    type="text"
                                                    size="small"
                                                    danger
                                                    onClick={() => handleDelete(key._id)}
                                                    icon={<Trash2 size={14} />}
                                                    className="hover-bg-danger-light"
                                                    title="Delete Configuration"
                                                    aria-label="Delete Configuration"
                                                >
                                                    Delete
                                                </AntdButton>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add / Edit Modal */}
            <Modal
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                centered
                width={500}
                footer={null}
                destroyOnHidden
                classNames={{ container: 'border-0 shadow-lg' }}
                styles={{ container: { borderRadius: 'var(--radius-xl)', padding: 0 }, body: { padding: 0 } }}
            >
                <div className="modal-header border-0 pb-0 pt-4 px-4">
                    <span className="fw-bold h5 mb-0 text-dark">
                        {editingKey ? 'Edit API Integration' : 'Add New Integration'}
                    </span>
                </div>
                <form onSubmit={handleSave}>
                    <div className="modal-body p-4">
                        {error && (
                            <Alert
                                type="error"
                                className="small border-0 mb-3"
                                style={{ padding: '8px 12px' }}
                                message={
                                    <span className="d-flex align-items-center gap-2">
                                        <AlertCircle size={14} /> {error}
                                    </span>
                                }
                            />
                        )}
                        <div className="mb-3">
                            <label className="d-block smallest fw-bold text-muted text-uppercase mb-2">Internal Alias Name</label>
                            <Input
                                type="text"
                                placeholder="e.g. Data Provider Alpha"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                required
                                className="border-0 bg-light px-3 py-2"
                                style={{ borderRadius: 'var(--radius-md)' }}
                            />
                        </div>
                        <div className="mb-3">
                            <label className="d-block smallest fw-bold text-muted text-uppercase mb-2">Service ID (Unique)</label>
                            <Input
                                type="text"
                                placeholder="e.g. scraper_primary"
                                value={formData.serviceId}
                                onChange={e => setFormData({ ...formData, serviceId: e.target.value })}
                                required
                                disabled={!!editingKey}
                                className="border-0 bg-light px-3 py-2"
                                style={{ borderRadius: 'var(--radius-md)' }}
                            />
                        </div>
                        <div className="mb-3">
                            <label className="d-block smallest fw-bold text-muted text-uppercase mb-2">Category</label>
                            <Select
                                value={formData.category}
                                onChange={(value) => setFormData({ ...formData, category: value })}
                                variant="borderless"
                                className="bg-light"
                                style={{ width: '100%' }}
                                options={['Scraping', 'Amazon Data', 'AI', 'Communication', 'Other'].map((c) => ({ value: c, label: c }))}
                            />
                        </div>
                        <div className="mb-3">
                            <label className="d-block smallest fw-bold text-muted text-uppercase mb-2">API Key Value</label>
                            <Input
                                type="password"
                                placeholder={editingKey ? "•••••••••••• (leave blank to keep current)" : "Paste your API key here"}
                                value={formData.value}
                                onChange={e => setFormData({ ...formData, value: e.target.value })}
                                required={!editingKey}
                                className="border-0 bg-light px-3 py-2"
                                style={{ borderRadius: 'var(--radius-md)' }}
                            />
                        </div>
                        <div className="mb-0">
                            <label className="d-block smallest fw-bold text-muted text-uppercase mb-2">Description (Optional)</label>
                            <Input.TextArea
                                rows={2}
                                placeholder="Briefly describe what this key is used for..."
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                className="border-0 bg-light px-3 py-2"
                                style={{ borderRadius: 'var(--radius-md)' }}
                            />
                        </div>
                    </div>
                    <div className="modal-footer border-0 pt-0 px-4 pb-4">
                        <AntdButton
                            type="link"
                            onClick={() => setModalOpen(false)}
                            className="text-decoration-none text-muted smallest fw-bold me-2"
                            style={{ padding: 0, height: 'auto' }}
                        >
                            Cancel
                        </AntdButton>
                        <AntdButton
                            type="primary"
                            htmlType="submit"
                            disabled={saving}
                            className="px-4 fw-bold shadow-sm"
                            style={{ borderRadius: '10px' }}
                        >
                            {saving ? <span className="icon-[svg-spinners--eclipse]" style={{ fontSize: 16 }} aria-hidden="true" /> : (editingKey ? 'Update Configuration' : 'Save Integration')}
                        </AntdButton>
                    </div>
                </form>
            </Modal>

            <style>{`
                .smallest { font-size: 11px; }
                .fs-13 { font-size: 13px; }
                .fw-mono { font-family: 'JetBrains Mono', 'Fira Code', monospace; }
                .tracking-wider { letter-spacing: 0.05em; }
                .text-muted-opacity { color: rgba(100, 116, 139, 0.7); }
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .hover-primary:hover { color: #4F46E5 !important; }
                .hover-success:hover { color: #16A34A !important; }
                .hover-bg-light:hover { background-color: #F8FAFC !important; }
                .hover-bg-danger-light:hover { background-color: #FEF2F2 !important; color: #DC2626 !important; }
                .cursor-pointer { cursor: pointer; }
                .transition-all { transition: all 0.2s ease; }
            `}</style>
        </div>
    );
};

export default ApiKeysPage;
