import React, { useState, useEffect, useMemo } from 'react';
import { roleApi } from '../services/api';
import {
    Shield,
    Plus,
    Pencil,
    Trash2,
    CheckCircle2,
    AlertTriangle,
    Check,
    X,
    Settings,
    Users,
    Layout,
    FileText,
    BarChart3,
    Package,
    ShoppingCart,
    Settings2,
    Database,
    Key,
    Bell,
    Search,
    DollarSign,
    TrendingUp,
    Warehouse,
    MessageSquare,
    Zap
} from 'lucide-react';
import { PageLoader } from '@/components/application/loading-indicator/PageLoader';

const getPriorityDescription = (level) => {
    if (level >= 90) return 'Full Administrative Access';
    if (level >= 70) return 'High Administrative Access';
    if (level >= 50) return 'Team Management Access';
    if (level >= 30) return 'Standard Access';
    if (level >= 10) return 'Limited Access';
    return 'Basic Access';
};

const getCategoryIcon = (category) => {
    const icons = {
        'Dashboard': BarChart3,
        'Reports': FileText,
        'SKU': Package,
        'Seller': ShoppingCart,
        'Scraping': Search,
        'Settings': Settings2,
        'Users': Users,
        'Roles': Key,
        'Inventory': Warehouse,
        'Messaging': MessageSquare,
        'Profit': DollarSign,
        'Advertising': TrendingUp,
        'Actions': Zap,
        'Alerts': Bell,
        'Default': Settings
    };
    const Icon = icons[category] || icons['Default'];
    return Icon;
};

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

    // Group roles by priority
    const groupedRoles = useMemo(() => {
        const sorted = [...roles].sort((a, b) => {
            if (b.level !== a.level) return b.level - a.level;
            return (a.displayName || '').localeCompare(b.displayName || '');
        });
        
        const groups = {};
        sorted.forEach(role => {
            const level = role.level;
            if (!groups[level]) {
                groups[level] = [];
            }
            groups[level].push(role);
        });
        return groups;
    }, [roles]);

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
                level: 10,
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
        const categoryPerms = permissionsGrouped[category] || [];
        const categoryIds = categoryPerms.map(p => p._id);
        const allSelected = categoryIds.every(id => selectedPermissions.includes(id));

        if (allSelected) {
            setSelectedPermissions(prev => prev.filter(id => !categoryIds.includes(id)));
        } else {
            setSelectedPermissions(prev => [...new Set([...prev, ...categoryIds])]);
        }
    };

    const handleDisplayNameChange = (e) => {
        const value = e.target.value;
        setRoleFormData(prev => {
            const newData = { ...prev, displayName: value };
            if (!editingRole) {
                newData.name = value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
            }
            return newData;
        });
    };

    const getCategorySelectionCount = (category) => {
        const categoryPerms = permissionsGrouped[category] || [];
        const selected = categoryPerms.filter(p => selectedPermissions.includes(p._id)).length;
        return `${selected}/${categoryPerms.length}`;
    };

    if (loading && roles.length === 0) {
        return <PageLoader message="Loading Roles..." />;
    }

    const priorityLevels = Object.keys(groupedRoles).sort((a, b) => Number(b) - Number(a));

    return (
        <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh' }}>
            <style>{`
                .roles-page { padding: 24px 32px; }
                .role-card { border-radius: 20px; transition: all 0.2s ease; }
                .role-card:hover { box-shadow: 0 8px 24px rgba(0,0,0,0.08); transform: translateY(-2px); }
                .group-header { background: #f1f5f9; padding: 16px 24px; border-radius: 14px; margin-bottom: 20px; margin-top: 24px; }
                .group-header:first-of-type { margin-top: 0; }
                .perm-card { border-radius: 16px; background: #fafbfd; transition: all 0.2s; }
                .perm-card:hover { background: #f5f6ff; }
                .perm-row { border-radius: 8px; transition: all 0.15s; cursor: pointer; }
                .perm-row:hover { background: #f1f5f9; }
                .perm-row label { cursor: pointer; }
                .select-all-btn { border-radius: 20px; font-size: 11px; padding: 6px 14px; font-weight: 600; transition: all 0.15s; }
                .select-all-btn:hover { transform: scale(1.02); }
                .modal-custom { background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(8px); }
                .action-btn { transition: all 0.15s; }
                .action-btn:hover { transform: scale(1.08); background: #f0f1f5 !important; }
                .duplicate-warning { cursor: help; transition: all 0.15s; }
                .duplicate-warning:hover { transform: scale(1.15); }
                @media (max-width: 768px) {
                    .roles-page { padding: 16px; }
                    .group-header { padding: 12px 16px; }
                }
            `}</style>

            {/* Header */}
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
                <div className="d-flex align-items-center gap-3">
                    <div className="d-flex align-items-center justify-content-center" style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)' }}>
                        <Shield size={24} style={{ color: '#4f46e5' }} />
                    </div>
                    <div>
                        <h1 className="h4 fw-bold mb-0" style={{ color: '#111827' }}>Roles & Permissions</h1>
                        <p className="small mb-0" style={{ color: '#6b7280' }}>Define access levels and security policies</p>
                    </div>
                </div>
                <button 
                    className="btn fw-semibold d-flex align-items-center gap-2" 
                    onClick={() => handleOpenRoleModal()}
                    style={{ 
                        background: '#4f46e5', color: 'white', borderRadius: 12, padding: '12px 24px',
                        border: 'none', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.35)', fontSize: 14,
                        transition: 'all 0.2s'
                    }}
                >
                    <Plus size={18} />
                    Create New Role
                </button>
            </div>

            {/* Info Panel */}
            <div className="d-flex align-items-start gap-3 p-4 mb-4" style={{ background: '#eff6ff', borderRadius: 16, border: '1px solid #dbeafe' }}>
                <div className="d-flex align-items-center justify-content-center" style={{ width: 40, height: 40, borderRadius: 10, background: 'white', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                    <Settings size={18} style={{ color: '#2563eb' }} />
                </div>
                <div>
                    <h6 className="fw-bold mb-1" style={{ color: '#1d4ed8' }}>Role Hierarchy & Priority</h6>
                    <p className="small mb-0" style={{ color: '#1e40af', opacity: 0.8 }}>
                        Roles are grouped by priority level. Higher priority (e.g., 100) = more administrative power. 
                        System roles are read-only. Custom roles can be created, edited, and deleted.
                    </p>
                </div>
            </div>

            {/* Role Groups */}
            {priorityLevels.map(level => {
                const levelNum = Number(level);
                const rolesInGroup = groupedRoles[level] || [];
                const PriorityIcon = levelNum >= 70 ? Shield : levelNum >= 50 ? Users : Settings;
                
                return (
                    <div key={level} className="mb-5">
                        <div className="group-header d-flex align-items-center gap-3">
                            <PriorityIcon size={18} style={{ color: '#4f46e5' }} />
                            <div className="d-flex align-items-center gap-2">
                                <span className="fw-bold" style={{ color: '#1e293b' }}>Priority {level}</span>
                                <span className="text-muted" style={{ fontSize: 13 }}>–</span>
                                <span className="text-muted" style={{ fontSize: 13 }}>{getPriorityDescription(levelNum)}</span>
                            </div>
                            <div className="ms-auto badge" style={{ background: '#e0e7ff', color: '#4f46e5', fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 20 }}>
                                {rolesInGroup.length} role{rolesInGroup.length !== 1 ? 's' : ''}
                            </div>
                        </div>

                        <div className="row g-4">
                            {rolesInGroup.map(role => {
                                const roleColor = role.color || '#6b7280';
                                const isDuplicate = rolesInGroup.filter(r => r.displayName === role.displayName).length > 1;
                                
                                return (
                                    <div key={role._id} className="col-md-6 col-lg-4">
                                        <div className="role-card bg-white border" style={{ borderRadius: 20, overflow: 'hidden', border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
                                            <div className="p-4 d-flex flex-column" style={{ minHeight: 200 }}>
                                                <div className="d-flex justify-content-between align-items-start mb-3">
                                                    <div className="d-flex align-items-center gap-2">
                                                        <span 
                                                            className="badge fw-bold" 
                                                            style={{ 
                                                                background: `${roleColor}15`, 
                                                                color: roleColor, 
                                                                border: `1px solid ${roleColor}30`,
                                                                padding: '6px 14px', borderRadius: 20, fontSize: 12 
                                                            }}
                                                        >
                                                            Priority {role.level}
                                                        </span>
                                                        {isDuplicate && (
                                                            <div title="Duplicate role name" style={{ color: '#f59e0b' }}>
                                                                <AlertTriangle size={14} />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="d-flex gap-1">
                                                        <button
                                                            className="btn d-flex align-items-center justify-content-center"
                                                            onClick={() => handleOpenRoleModal(role)}
                                                            style={{ width: 36, height: 36, borderRadius: 10, background: '#f9fafc', border: '1px solid #e5e7eb' }}
                                                            title="Edit Role"
                                                        >
                                                            <Pencil size={14} style={{ color: '#4f46e5' }} />
                                                        </button>
                                                        {!role.isSystem && (
                                                            <button
                                                                className="btn d-flex align-items-center justify-content-center"
                                                                onClick={() => handleDeleteRole(role._id)}
                                                                style={{ width: 36, height: 36, borderRadius: 10, background: '#f9fafc', border: '1px solid #e5e7eb' }}
                                                                title="Delete Role"
                                                            >
                                                                <Trash2 size={14} style={{ color: '#ef4444' }} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="mb-3">
                                                    <h5 className="fw-bold mb-1" style={{ color: '#111827' }}>{role.displayName}</h5>
                                                    <code className="small" style={{ color: '#6b7280', background: '#f3f4f6', padding: '2px 8px', borderRadius: 6 }}>{role.name}</code>
                                                </div>

                                                <p className="small mb-3 flex-grow-1" style={{ color: '#6b7280', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                    {role.description || 'Dedicated role for managing platform operations and specialized data access.'}
                                                </p>

                                                <div className="d-flex align-items-center justify-content-between pt-3 border-top" style={{ borderColor: '#f1f5f9' }}>
                                                    <div className="d-flex align-items-center gap-1" style={{ color: '#4f46e5', fontSize: 13, fontWeight: 600 }}>
                                                        <Key size={14} />
                                                        {role.permissions?.length || 0} Capabilities
                                                    </div>
                                                    {role.isSystem && (
                                                        <span className="d-flex align-items-center gap-1" style={{ color: '#059669', fontSize: 12, fontWeight: 600 }}>
                                                            <CheckCircle2 size={12} />
                                                            System Role
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}

            {roles.length === 0 && (
                <div className="text-center py-5">
                    <div className="d-flex align-items-center justify-content-center mx-auto mb-3" style={{ width: 64, height: 64, borderRadius: 16, background: '#f3f4f6' }}>
                        <Shield size={28} style={{ color: '#9ca3af' }} />
                    </div>
                    <h5 className="fw-bold mb-2" style={{ color: '#374151' }}>No roles found</h5>
                    <p className="text-muted mb-4">Create your first role to get started with access control.</p>
                    <button className="btn fw-semibold" onClick={() => handleOpenRoleModal()} style={{ background: '#4f46e5', color: 'white', borderRadius: 10, padding: '12px 24px', border: 'none' }}>
                        <Plus size={18} className="me-2" />
                        Create New Role
                    </button>
                </div>
            )}

            {/* Role Modal */}
            {showRoleModal && (
                <div className="modal show d-block modal-custom" style={{ position: 'fixed', inset: 0, zIndex: 1050 }}>
                    <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable" style={{ maxWidth: 1024, width: '95%', margin: '24px auto' }}>
                        <div className="modal-content border-0" style={{ borderRadius: 24, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                            <div className="modal-header border-0 px-5 pt-5 pb-3">
                                <div className="d-flex align-items-center gap-4">
                                    <div className="d-flex align-items-center justify-content-center" style={{ width: 52, height: 52, borderRadius: 14, background: '#e0e7ff' }}>
                                        <Shield size={24} style={{ color: '#4f46e5' }} />
                                    </div>
                                    <div>
                                        <h5 className="h5 fw-bold mb-0" style={{ color: '#111827' }}>
                                            {editingRole ? `Edit Role: ${editingRole.displayName}` : 'Create New Role'}
                                        </h5>
                                        <p className="small mb-0" style={{ color: '#6b7280' }}>Configure role details and permissions</p>
                                    </div>
                                </div>
                                <button type="button" className="btn-close position-absolute" style={{ top: 20, right: 20 }} onClick={() => setShowRoleModal(false)}></button>
                            </div>
                            
                            <div className="modal-body px-5 py-4">
                                <div className="row g-4 mb-5 pb-4 border-bottom" style={{ borderColor: '#f1f5f9' }}>
                                    <div className="col-md-3">
                                        <label className="small fw-bold text-uppercase mb-2" style={{ color: '#4f46e5', letterSpacing: '0.05em' }}>Technical Name</label>
                                        <input
                                            type="text"
                                            className="form-control form-control-lg"
                                            style={{ borderRadius: 12, background: '#f9fafc', border: '1px solid #e5e7eb' }}
                                            value={roleFormData.name}
                                            onChange={(e) => setRoleFormData({ ...roleFormData, name: e.target.value })}
                                            disabled={editingRole?.isSystem}
                                            placeholder="e.g. data_analyst"
                                        />
                                    </div>
                                    <div className="col-md-3">
                                        <label className="small fw-bold text-uppercase mb-2" style={{ color: '#4f46e5', letterSpacing: '0.05em' }}>Display Label</label>
                                        <input
                                            type="text"
                                            className="form-control form-control-lg"
                                            style={{ borderRadius: 12, background: '#f9fafc', border: '1px solid #e5e7eb' }}
                                            value={roleFormData.displayName}
                                            onChange={handleDisplayNameChange}
                                            placeholder="e.g. Data Analyst"
                                        />
                                    </div>
                                    <div className="col-md-2">
                                        <label className="small fw-bold text-uppercase mb-2" style={{ color: '#4f46e5', letterSpacing: '0.05em' }}>Priority Level</label>
                                        <input
                                            type="number"
                                            className="form-control form-control-lg"
                                            style={{ borderRadius: 12, background: '#f9fafc', border: '1px solid #e5e7eb' }}
                                            value={roleFormData.level}
                                            onChange={(e) => setRoleFormData({ ...roleFormData, level: parseInt(e.target.value) || 0 })}
                                            min="0" max="100"
                                        />
                                    </div>
                                    <div className="col-md-2">
                                        <label className="small fw-bold text-uppercase mb-2" style={{ color: '#4f46e5', letterSpacing: '0.05em' }}>Theme Color</label>
                                        <div className="d-flex align-items-center bg-light rounded-3 px-3" style={{ height: 48, border: '1px solid #e5e7eb' }}>
                                            <input
                                                type="color"
                                                className="border-0 bg-transparent p-0"
                                                style={{ width: 32, height: 32, cursor: 'pointer' }}
                                                value={roleFormData.color}
                                                onChange={(e) => setRoleFormData({ ...roleFormData, color: e.target.value })}
                                            />
                                            <span className="ms-2 small font-monospace text-muted">{roleFormData.color}</span>
                                        </div>
                                    </div>
                                    <div className="col-md-12">
                                        <label className="small fw-bold text-uppercase mb-2" style={{ color: '#4f46e5', letterSpacing: '0.05em' }}>Description</label>
                                        <textarea
                                            className="form-control"
                                            style={{ borderRadius: 12, background: '#f9fafc', border: '1px solid #e5e7eb' }}
                                            rows={2}
                                            placeholder="Describe the primary responsibilities of this role..."
                                            value={roleFormData.description}
                                            onChange={(e) => setRoleFormData({ ...roleFormData, description: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="d-flex align-items-center gap-3 mb-4">
                                    <h6 className="fw-bold mb-0" style={{ color: '#111827' }}>Access Control Matrix</h6>
                                    <div className="flex-grow-1" style={{ height: 1, background: '#f1f5f9' }}></div>
                                    <span className="small" style={{ color: '#6b7280' }}>{selectedPermissions.length} selected</span>
                                </div>

                                <div className="row row-cols-1 row-cols-md-2 g-4">
                                    {Object.entries(permissionsGrouped).map(([category, perms]) => {
                                        const CategoryIcon = getCategoryIcon(category);
                                        const allSelected = perms.every(p => selectedPermissions.includes(p._id));
                                        
                                        return (
                                            <div key={category} className="col">
                                                <div className="perm-card border h-100" style={{ borderRadius: 20, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                                                    <div className="d-flex justify-content-between align-items-center py-3 px-4" style={{ background: '#f8f9fc', borderBottom: '1px solid #f1f5f9' }}>
                                                        <div className="d-flex align-items-center gap-2">
                                                            <CategoryIcon size={16} style={{ color: '#4f46e5' }} />
                                                            <span className="text-uppercase small fw-bold" style={{ color: '#4f46e5', letterSpacing: '0.05em' }}>{category}</span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            className="btn select-all-btn fw-semibold"
                                                            onClick={() => toggleAllPermissions(category)}
                                                            style={{ 
                                                                background: allSelected ? '#f1f5f9' : '#e0e7ff', 
                                                                color: allSelected ? '#4b5563' : '#4f46e5',
                                                                border: 'none', padding: '6px 12px'
                                                            }}
                                                        >
                                                            {allSelected ? <><X size={12} className="me-1" /> Deselect</> : <><Check size={12} className="me-1" /> Select All</>}
                                                            <span className="ms-1" style={{ opacity: 0.7 }}>({getCategorySelectionCount(category)})</span>
                                                        </button>
                                                    </div>
                                                    <div className="p-3" style={{ maxHeight: 280, overflowY: 'auto' }}>
                                                        {perms.map(perm => {
                                                            const isChecked = selectedPermissions.includes(perm._id);
                                                            return (
                                                                <div 
                                                                    key={perm._id} 
                                                                    className="perm-row d-flex align-items-center py-2 px-2"
                                                                    onClick={() => togglePermission(perm._id)}
                                                                    style={{ borderRadius: 8, cursor: 'pointer', marginBottom: 4 }}
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        className="form-check-input"
                                                                        checked={isChecked}
                                                                        onChange={() => togglePermission(perm._id)}
                                                                        style={{ width: 18, height: 18, cursor: 'pointer' }}
                                                                    />
                                                                    <label
                                                                        className="form-check-label ms-2 small fw-medium"
                                                                        style={{ cursor: 'pointer', color: isChecked ? '#111827' : '#4b5563' }}
                                                                    >
                                                                        {perm.displayName}
                                                                    </label>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            
                            <div className="modal-footer border-0 px-5 pb-5 pt-3 gap-3">
                                <button 
                                    type="button" 
                                    className="btn fw-semibold px-4" 
                                    onClick={() => setShowRoleModal(false)} 
                                    style={{ 
                                        background: '#f3f4f6', 
                                        color: '#374151', 
                                        borderRadius: 10, 
                                        border: '1px solid #e5e7eb',
                                        padding: '12px 24px'
                                    }}
                                >
                                    Discard Changes
                                </button>
                                <button 
                                    type="button" 
                                    className="btn fw-semibold px-5" 
                                    onClick={handleSaveRole} 
                                    style={{ 
                                        background: '#4f46e5', 
                                        color: 'white', 
                                        borderRadius: 10, 
                                        border: 'none',
                                        padding: '12px 32px',
                                        boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
                                    }}
                                >
                                    {editingRole ? 'Update Role' : 'Create Role'}
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