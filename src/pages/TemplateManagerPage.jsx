import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import {
    Plus,
    Edit2,
    Trash2,
    Search,
    Clock,
    AlertCircle,
    Check,
    X,
    Loader2,
    ChevronRight,
    Tag,
    Zap,
    Sparkles
} from 'lucide-react';

const TemplateManagerPage = () => {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [currentTemplate, setCurrentTemplate] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        type: 'GENERAL_OPTIMIZATION',
        priority: 'MEDIUM',
        category: 'Operations & General',
        estimatedMinutes: 30
    });

    const categories = [
        'SEO & Content',
        'Sales & Marketing',
        'Operations & General',
        'PPC & Advertising',
        'Compliance & Legal'
    ];

    const types = [
        { value: 'TITLE_OPTIMIZATION', label: 'Title SEO' },
        { value: 'A_PLUS_CONTENT', label: 'A+ Content' },
        { value: 'PRICING_STRATEGY', label: 'Pricing' },
        { value: 'INVENTORY_MANAGEMENT', label: 'Inventory' },
        { value: 'GENERAL_OPTIMIZATION', label: 'General' },
        { value: 'IMAGE_OPTIMIZATION', label: 'Images' },
        { value: 'DESCRIPTION_OPTIMIZATION', label: 'Description' }
    ];

    const priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const res = await db.getTaskTemplates();
            if (res && res.success) {
                setTemplates(res.data);
            }
        } catch (error) {
            console.error('Failed to fetch templates:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTemplates();
    }, []);

    const handleOpenModal = (template = null) => {
        if (template) {
            setCurrentTemplate(template);
            setFormData({
                title: template.title || '',
                description: template.description || '',
                type: template.type || 'GENERAL_OPTIMIZATION',
                priority: template.priority || 'MEDIUM',
                category: template.category || 'Operations & General',
                estimatedMinutes: template.estimatedMinutes || 30
            });
        } else {
            setCurrentTemplate(null);
            setFormData({
                title: '',
                description: '',
                type: 'GENERAL_OPTIMIZATION',
                priority: 'MEDIUM',
                category: 'Operations & General',
                estimatedMinutes: 30
            });
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setCurrentTemplate(null);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'estimatedMinutes' ? parseInt(value) || 0 : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (currentTemplate) {
                await db.updateTemplate(currentTemplate._id, formData);
            } else {
                await db.createTemplate(formData);
            }
            await fetchTemplates();
            handleCloseModal();
        } catch (error) {
            console.error('Failed to save template:', error);
            alert('Failed to save template. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this template?')) return;
        try {
            await db.deleteTemplate(id);
            await fetchTemplates();
        } catch (error) {
            console.error('Failed to delete template:', error);
            alert('Failed to delete template.');
        }
    };

    const filteredTemplates = templates.filter(t =>
        t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getPriorityBadge = (p) => {
        switch (p) {
            case 'URGENT': return 'bg-soft-danger text-danger';
            case 'HIGH': return 'bg-soft-warning text-warning';
            case 'MEDIUM': return 'bg-soft-primary text-primary';
            default: return 'bg-soft-secondary text-secondary';
        }
    };

    return (
        <div className="container-fluid py-4 min-vh-100 bg-light">
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h3 className="fw-bold text-dark mb-1">Task Templates</h3>
                    <p className="text-muted small mb-0">Manage reusable task definitions for your projects</p>
                </div>
                <button
                    className="btn btn-primary d-flex align-items-center gap-2 shadow-sm"
                    onClick={() => handleOpenModal()}
                >
                    <Plus size={18} />
                    New Template
                </button>
            </div>

            {/* Stats & Search */}
            <div className="row g-3 mb-4">
                <div className="col-md-8">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-body p-3">
                            <div className="input-group">
                                <span className="input-group-text bg-white border-end-0">
                                    <Search size={18} className="text-muted" />
                                </span>
                                <input
                                    type="text"
                                    className="form-control border-start-0 ps-0"
                                    placeholder="Search by title or category..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="col-md-4">
                    <div className="card border-0 shadow-sm h-100 bg-primary text-white overflow-hidden">
                        <div className="card-body p-3 position-relative">
                            <div className="d-flex align-items-center gap-3">
                                <div className="p-2 bg-white bg-opacity-25 rounded-3">
                                    <Zap size={24} />
                                </div>
                                <div>
                                    <h4 className="fw-bold mb-0">{templates.length}</h4>
                                    <div className="small opacity-75">Active Templates</div>
                                </div>
                            </div>
                            <Sparkles className="position-absolute end-0 bottom-0 opacity-10 m-2" size={48} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Template List */}
            <div className="card border-0 shadow-sm overflow-hidden">
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead className="bg-white">
                            <tr>
                                <th className="px-4 py-3 text-uppercase small fw-bold text-muted border-0">Template</th>
                                <th className="py-3 text-uppercase small fw-bold text-muted border-0">Category</th>
                                <th className="py-3 text-uppercase small fw-bold text-muted border-0">Type</th>
                                <th className="py-3 text-uppercase small fw-bold text-muted border-0">Priority</th>
                                <th className="py-3 text-uppercase small fw-bold text-muted border-0 text-end px-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="text-center py-5">
                                        <Loader2 className="animate-spin text-primary" size={32} />
                                    </td>
                                </tr>
                            ) : filteredTemplates.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="text-center py-5 text-muted">
                                        No templates found.
                                    </td>
                                </tr>
                            ) : (
                                filteredTemplates.map(t => (
                                    <tr key={t._id}>
                                        <td className="px-4 py-3">
                                            <div className="fw-bold text-dark">{t.title}</div>
                                            <div className="small text-muted text-truncate" style={{ maxWidth: '300px' }}>
                                                {t.description}
                                            </div>
                                        </td>
                                        <td className="py-3">
                                            <span className="badge bg-light text-dark border small">
                                                {t.category}
                                            </span>
                                        </td>
                                        <td className="py-3">
                                            <div className="d-flex align-items-center gap-2 small text-muted">
                                                <Tag size={14} />
                                                {t.type}
                                            </div>
                                        </td>
                                        <td className="py-3">
                                            <span className={`badge rounded-pill small ${getPriorityBadge(t.priority)}`}>
                                                {t.priority}
                                            </span>
                                        </td>
                                        <td className="py-3 text-end px-4">
                                            <div className="d-flex justify-content-end gap-2">
                                                <button
                                                    className="btn btn-icon btn-sm btn-soft-primary"
                                                    onClick={() => handleOpenModal(t)}
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    className="btn btn-icon btn-sm btn-soft-danger"
                                                    onClick={() => handleDelete(t._id)}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow">
                            <div className="modal-header border-bottom px-4">
                                <h5 className="modal-title fw-bold">
                                    {currentTemplate ? 'Edit Template' : 'New Task Template'}
                                </h5>
                                <button onClick={handleCloseModal} className="btn-close shadow-none"></button>
                            </div>
                            <form onSubmit={handleSubmit}>
                                <div className="modal-body p-4">
                                    <div className="mb-3">
                                        <label className="form-label small fw-bold text-muted">Title</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            name="title"
                                            value={formData.title}
                                            onChange={handleInputChange}
                                            required
                                        />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label small fw-bold text-muted">Description</label>
                                        <textarea
                                            className="form-control"
                                            rows="3"
                                            name="description"
                                            value={formData.description}
                                            onChange={handleInputChange}
                                            required
                                        ></textarea>
                                    </div>
                                    <div className="row g-3 mb-3">
                                        <div className="col-md-6">
                                            <label className="form-label small fw-bold text-muted">Category</label>
                                            <select
                                                className="form-select"
                                                name="category"
                                                value={formData.category}
                                                onChange={handleInputChange}
                                            >
                                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label small fw-bold text-muted">Type</label>
                                            <select
                                                className="form-select"
                                                name="type"
                                                value={formData.type}
                                                onChange={handleInputChange}
                                            >
                                                {types.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="row g-3">
                                        <div className="col-md-6">
                                            <label className="form-label small fw-bold text-muted">Priority</label>
                                            <select
                                                className="form-select"
                                                name="priority"
                                                value={formData.priority}
                                                onChange={handleInputChange}
                                            >
                                                {priorities.map(p => <option key={p} value={p}>{p}</option>)}
                                            </select>
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label small fw-bold text-muted">Estimated Minutes</label>
                                            <div className="input-group">
                                                <input
                                                    type="number"
                                                    className="form-control"
                                                    name="estimatedMinutes"
                                                    value={formData.estimatedMinutes}
                                                    onChange={handleInputChange}
                                                />
                                                <span className="input-group-text bg-light small"><Clock size={14} /></span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer border-top px-4 py-3">
                                    <button type="button" className="btn btn-light px-4" onClick={handleCloseModal}>Cancel</button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary px-4 d-flex align-items-center gap-2"
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : (currentTemplate ? <Check size={18} /> : <Plus size={18} />)}
                                        {currentTemplate ? 'Update Template' : 'Create Template'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .bg-soft-primary { background-color: #e7f1ff; }
                .bg-soft-success { background-color: #d1e7dd; }
                .bg-soft-warning { background-color: #fff3cd; }
                .bg-soft-danger { background-color: #f8d7da; }
                .bg-soft-secondary { background-color: #f8f9fa; }
                
                .btn-soft-primary { color: #0d6efd; background-color: #e7f1ff; border: none; }
                .btn-soft-primary:hover { color: white; background-color: #0d6efd; }
                
                .btn-soft-danger { color: #dc3545; background-color: #f8d7da; border: none; }
                .btn-soft-danger:hover { color: white; background-color: #dc3545; }
                
                .btn-icon { width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center; }
                
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default TemplateManagerPage;
