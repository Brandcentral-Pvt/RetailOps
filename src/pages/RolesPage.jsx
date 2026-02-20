import React, { useState, useEffect } from 'react';
import { roleApi } from '../services/api';
import {
    Shield,
    Plus,
    Pencil,
    Trash2,
    CheckCircle2,
    ChevronRight,
    Info
} from 'lucide-react';

const RolesPage = () => {
    const [roles, setRoles] = useState([]);
    const [permissions, setPermissions] = useState([]);
    const [permissionsGrouped, setPermissionsGrouped] = useState({});
    const [loading, setLoading] = useState(true);
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [editingRole, setEditingRole] = useState(null);
    const [selectedPermissions, setSelectedPermissions] = useState([]);

    const [roleFormData, setRoleFormData] = useState({
        name: '',
        displayName: '',
        description: '',
        level: 0,
        color: '#4F46E5',
        permissions: [],
    });

    const loadRoles = async () => {
        setLoading(true);
        try {
            const response = await roleApi.getAll();
            if (response.success) {
                setRoles(response.data.roles);
            }
        } catch (error) {
            console.error('Failed to load roles:', error);
        }
        setLoading(false);
    };

    const loadPermissions = async () => {
        try {
            const response = await roleApi.getPermissions();
            if (response.success) {
                setPermissions(response.data.permissions);
                setPermissionsGrouped(response.data.groupedPermissions);
            }
        } catch (error) {
            console.error('Failed to load permissions:', error);
        }
    };

    useEffect(() => {
        loadRoles();
        loadPermissions();
    }, []);

    const handleOpenRoleModal = (role = null) => {
        if (role) {
            setEditingRole(role);
            setRoleFormData({
                name: role.name,
                displayName: role.displayName,
                description: role.description || '',
                level: role.level,
                color: role.color,
                permissions: role.permissions?.map(p => p._id) || [],
            });
            setSelectedPermissions(role.permissions?.map(p => p._id) || []);
        } else {
            setEditingRole(null);
            setRoleFormData({
                name: '',
                displayName: '',
                description: '',
                level: 0,
                color: '#4F46E5',
                permissions: [],
            });
            setSelectedPermissions([]);
        }
        setShowRoleModal(true);
    };

    const handleSaveRole = async () => {
        try {
            const data = { ...roleFormData, permissions: selectedPermissions };
            if (editingRole) {
                await roleApi.update(editingRole._id, data);
            } else {
                await roleApi.create(data);
            }
            setShowRoleModal(false);
            loadRoles();
        } catch (error) {
            console.error('Failed to save role:', error);
            alert(error.message || 'Failed to save role');
        }
    };

    const handleDeleteRole = async (roleId) => {
        if (!window.confirm('Are you sure you want to delete this role? This cannot be undone.')) return;
        try {
            await roleApi.delete(roleId);
            loadRoles();
        } catch (error) {
            console.error('Failed to delete role:', error);
            alert(error.message || 'Failed to delete role');
        }
    };

    const togglePermission = (permissionId) => {
        setSelectedPermissions(prev =>
            prev.includes(permissionId)
                ? prev.filter(id => id !== permissionId)
                : [...prev, permissionId]
        );
    };

    const toggleAllPermissions = (category) => {
        const categoryPerms = permissions.filter(p => p.category === category);
        const categoryIds = categoryPerms.map(p => p._id);
        const allSelected = categoryIds.every(id => selectedPermissions.includes(id));

        if (allSelected) {
            setSelectedPermissions(prev => prev.filter(id => !categoryIds.includes(id)));
        } else {
            setSelectedPermissions(prev => [...new Set([...prev, ...categoryIds])]);
        }
    };

    if (loading && roles.length === 0) {
        return (
            <div className="page-content bg-light" style={{ minHeight: '100vh' }}>
                <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
                    <div className="loading-spinner"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="page-content" style={{ backgroundColor: '#f8fafc', minHeight: '100vh' }}>
            <header className="main-header bg-white border-bottom py-3 px-4 sticky-top shadow-sm">
                <div className="d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center gap-3">
                        <div className="p-2 bg-primary-subtle text-primary rounded-3">
                            <Shield size={24} />
                        </div>
                        <div>
                            <h1 className="h4 fw-bold mb-0 text-dark">Roles & Permissions</h1>
                            <p className="smallest text-muted mb-0">Define access levels and security policies</p>
                        </div>
                    </div>
                    <button className="btn btn-primary fw-bold d-flex align-items-center gap-2 shadow-sm" onClick={() => handleOpenRoleModal()}>
                        <Plus size={18} />
                        Create Custom Role
                    </button>
                </div>
            </header>

            <div className="container-fluid px-4 py-4">
                {/* Helper Note */}
                <div className="alert alert-info border-0 shadow-sm d-flex align-items-start gap-3 p-4 mb-4" style={{ borderRadius: '16px', backgroundColor: '#eff6ff' }}>
                    <div className="p-2 bg-white text-info rounded-circle shadow-sm">
                        <Info size={18} />
                    </div>
                    <div>
                        <h6 className="fw-bold text-info mb-1">Role Hierarchy & Priority</h6>
                        <p className="smallest mb-0 text-info-emphasis opacity-75">
                            System roles (Admin, Manager, etc.) provide the foundational structure. Custom roles allow you to fine-tune access for specific teams or specialized requirements. Higher priority levels (e.g., 100) indicate more administrative power.
                        </p>
                    </div>
                </div>

                <div className="row g-4">
                    {roles.map(role => (
                        <div key={role._id} className="col-md-6 col-lg-4 col-xl-3">
                            <div className="card h-100 border-0 shadow-sm hover-shadow transition-all" style={{ borderRadius: '24px', overflow: 'hidden' }}>
                                <div className="card-body p-4 d-flex flex-column">
                                    <div className="d-flex justify-content-between align-items-start mb-3">
                                        <span
                                            className="badge rounded-pill px-3 py-2 fw-bold"
                                            style={{
                                                backgroundColor: `${role.color || '#6B7280'}15`,
                                                color: role.color || '#6B7280',
                                                border: `1px solid ${role.color || '#6B7280'}30`
                                            }}
                                        >
                                            Priority {role.level}
                                        </span>
                                        {!role.isSystem && (
                                            <div className="d-flex gap-2">
                                                <button
                                                    className="btn btn-icon btn-light border shadow-none hover-primary transition-all"
                                                    onClick={() => handleOpenRoleModal(role)}
                                                    style={{ width: '32px', height: '32px', borderRadius: '10px' }}
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button
                                                    className="btn btn-icon btn-light-danger border-0 shadow-none hover-danger transition-all"
                                                    onClick={() => handleDeleteRole(role._id)}
                                                    style={{ width: '32px', height: '32px', borderRadius: '10px' }}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        )}
                                        {role.isSystem && (
                                            <button
                                                className="btn btn-icon btn-light border shadow-none hover-primary transition-all"
                                                onClick={() => handleOpenRoleModal(role)}
                                                style={{ width: '32px', height: '32px', borderRadius: '10px' }}
                                            >
                                                <Pencil size={14} />
                                            </button>
                                        )}
                                    </div>

                                    <div className="mb-3">
                                        <h5 className="fw-bold text-dark mb-1">{role.displayName}</h5>
                                        <div className="smallest text-muted font-monospace">{role.name}</div>
                                    </div>

                                    <p className="smallest text-muted mb-4 flex-grow-1" style={{ display: '-webkit-box', WebkitLineClamp: '3', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                        {role.description || 'Dedicated role for managing platform operations and specialized data access.'}
                                    </p>

                                    <div className="d-flex align-items-center justify-content-between pt-3 border-top border-light">
                                        <div className="d-flex align-items-center gap-1 text-primary smallest fw-bold">
                                            <Shield size={12} />
                                            {role.permissions?.length || 0} Capabilities
                                        </div>
                                        {role.isSystem && (
                                            <span className="smallest fw-bold text-muted d-flex align-items-center gap-1">
                                                <CheckCircle2 size={12} className="text-success" />
                                                System Role
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* New Role Card */}
                    <div className="col-md-6 col-lg-4 col-xl-3">
                        <div
                            className="card h-100 border-2 border-dashed border-primary-subtle shadow-none d-flex align-items-center justify-content-center cursor-pointer hover-bg-light transition-all"
                            style={{ borderRadius: '24px', minHeight: '220px', backgroundColor: 'transparent' }}
                            onClick={() => handleOpenRoleModal()}
                        >
                            <div className="text-center p-4">
                                <div className="avatar bg-white shadow-sm rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3" style={{ width: '56px', height: '56px' }}>
                                    <Plus size={28} className="text-primary" />
                                </div>
                                <h6 className="fw-bold text-dark mb-1">Create Custom Role</h6>
                                <p className="smallest text-muted mb-0">Tailor access for unique workflows</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Role Management Modal */}
            {showRoleModal && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)' }}>
                    <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable" style={{ maxWidth: '1280px', width: '95%' }}>
                        <div className="modal-content border-0 shadow-2xl" style={{ borderRadius: '28px' }}>
                            <div className="modal-header border-0 px-4 pt-4 pb-0">
                                <div className="d-flex align-items-center gap-3">
                                    <div className="p-3 bg-primary-subtle text-primary rounded-4">
                                        <Shield size={24} />
                                    </div>
                                    <div>
                                        <h5 className="h5 fw-bold mb-0 text-dark">
                                            {editingRole ? `Configure Role: ${editingRole.displayName}` : 'Create Security Role'}
                                        </h5>
                                        <p className="smallest text-muted mb-0">Set permissions and hierarchy levels</p>
                                    </div>
                                </div>
                                <button type="button" className="btn-close" onClick={() => setShowRoleModal(false)}></button>
                            </div>
                            <div className="modal-body px-4 py-4">
                                <div className="row g-4 mb-4 pb-4 border-bottom border-light">
                                    <div className="col-md-3">
                                        <label className="form-label smallest fw-bold text-primary text-uppercase mb-2">Technical Name</label>
                                        <input
                                            type="text"
                                            className="form-control form-control-lg bg-light border-0 px-3 fs-6"
                                            style={{ borderRadius: '12px' }}
                                            value={roleFormData.name}
                                            onChange={(e) => setRoleFormData({ ...roleFormData, name: e.target.value })}
                                            disabled={editingRole?.isSystem}
                                            placeholder="e.g. data_analyst"
                                            required
                                        />
                                    </div>
                                    <div className="col-md-3">
                                        <label className="form-label smallest fw-bold text-primary text-uppercase mb-2">Display Label</label>
                                        <input
                                            type="text"
                                            className="form-control form-control-lg bg-light border-0 px-3 fs-6"
                                            style={{ borderRadius: '12px' }}
                                            value={roleFormData.displayName}
                                            onChange={(e) => setRoleFormData({ ...roleFormData, displayName: e.target.value })}
                                            placeholder="e.g. Data Analyst"
                                            required
                                        />
                                    </div>
                                    <div className="col-md-2">
                                        <label className="form-label smallest fw-bold text-primary text-uppercase mb-2">Hierarchy Level</label>
                                        <input
                                            type="number"
                                            className="form-control form-control-lg bg-light border-0 px-3 fs-6"
                                            style={{ borderRadius: '12px' }}
                                            value={roleFormData.level}
                                            onChange={(e) => setRoleFormData({ ...roleFormData, level: parseInt(e.target.value) })}
                                            min="0" max="100"
                                        />
                                    </div>
                                    <div className="col-md-2">
                                        <label className="form-label smallest fw-bold text-primary text-uppercase mb-2">Theming Color</label>
                                        <div className="d-flex align-items-center bg-light rounded-3 px-2" style={{ height: '48px' }}>
                                            <input
                                                type="color"
                                                className="form-control form-control-color border-0 bg-transparent p-1 cursor-pointer"
                                                style={{ height: '36px', width: '36px' }}
                                                value={roleFormData.color}
                                                onChange={(e) => setRoleFormData({ ...roleFormData, color: e.target.value })}
                                            />
                                            <span className="ms-2 smallest text-muted font-monospace">{roleFormData.color}</span>
                                        </div>
                                    </div>
                                    <div className="col-md-12">
                                        <label className="form-label smallest fw-bold text-primary text-uppercase mb-2">Role Summary</label>
                                        <textarea
                                            className="form-control bg-light border-0 px-3 fs-6"
                                            style={{ borderRadius: '12px' }}
                                            rows="2"
                                            placeholder="Describe the primary responsibilities and limitations of this role..."
                                            value={roleFormData.description}
                                            onChange={(e) => setRoleFormData({ ...roleFormData, description: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="d-flex align-items-center gap-3 mb-4">
                                    <h6 className="fw-bold mb-0 text-dark">Access Control Matrix</h6>
                                    <div className="h-px bg-light flex-grow-1"></div>
                                    <div className="smallest text-muted">Select specific capabilities</div>
                                </div>

                                <div className="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-4">
                                    {Object.entries(permissionsGrouped).map(([category, perms]) => (
                                        <div key={category} className="col">
                                            <div className="card h-100 border-0 shadow-sm transition-all" style={{ borderRadius: '20px', overflow: 'hidden', backgroundColor: '#fafbfd' }}>
                                                <div className="card-header border-0 d-flex justify-content-between align-items-center py-3 px-4" style={{ backgroundColor: 'rgba(79, 70, 229, 0.05)' }}>
                                                    <span className="text-uppercase smallest fw-bold text-primary">{category}</span>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-soft-primary px-3 py-1 smallest fw-bold border-0 shadow-sm"
                                                        onClick={() => toggleAllPermissions(category)}
                                                        style={{ borderRadius: '8px' }}
                                                    >
                                                        Toggle Logic
                                                    </button>
                                                </div>
                                                <div className="card-body py-3 px-4" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                                    <div className="d-flex flex-column gap-1">
                                                        {perms.map(perm => (
                                                            <div
                                                                key={perm._id}
                                                                className={`form-check py-2.5 px-3 rounded-3 transition-all cursor-pointer d-flex align-items-center ${selectedPermissions.includes(perm._id) ? 'bg-primary-subtle' : 'hover-bg-light'}`}
                                                                onClick={() => togglePermission(perm._id)}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    className="form-check-input shadow-none cursor-pointer"
                                                                    id={`perm-${perm._id}`}
                                                                    checked={selectedPermissions.includes(perm._id)}
                                                                    onChange={(e) => {
                                                                        e.stopPropagation();
                                                                        togglePermission(perm._id);
                                                                    }}
                                                                    style={{ width: '18px', height: '18px' }}
                                                                />
                                                                <label className="form-check-label smallest text-dark ms-2 fw-medium cursor-pointer w-100" onClick={(e) => e.stopPropagation()}>
                                                                    {perm.displayName}
                                                                </label>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="modal-footer border-0 px-4 pb-4 pt-3 gap-3">
                                <button type="button" className="btn btn-light fw-bold px-4 py-2" onClick={() => setShowRoleModal(false)} style={{ borderRadius: '12px' }}>Discard Changes</button>
                                <button type="button" className="btn btn-primary fw-bold px-5 py-2 shadow-lg" onClick={handleSaveRole} style={{ borderRadius: '12px' }}>
                                    {editingRole ? 'Update Configuration' : 'Release Role'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RolesPage;
