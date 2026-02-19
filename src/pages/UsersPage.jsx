import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { userApi, roleApi } from '../services/api';
import {
  Users,
  Shield,
  UserPlus,
  Search,
  Pencil,
  Pause,
  Play,
  Trash2,
  Mail,
  Phone,
  Calendar,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  UserCheck,
  UserX,
  Filter,
  Plus
} from 'lucide-react';

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editingRole, setEditingRole] = useState(null);
  const [filters, setFilters] = useState({ search: '', role: '', isActive: '' });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [permissions, setPermissions] = useState([]);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    role: '',
    isActive: true,
  });

  const [roleFormData, setRoleFormData] = useState({
    name: '',
    displayName: '',
    description: '',
    level: 0,
    color: '#4F46E5',
    permissions: [],
  });

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...filters,
      };
      if (!params.search) delete params.search;
      if (!params.role) delete params.role;
      if (params.isActive === '') delete params.isActive;

      const response = await userApi.getAll(params);
      if (response.success) {
        setUsers(response.data.users);
        setPagination(prev => ({ ...prev, ...response.data.pagination }));
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    }
    setLoading(false);
  }, [pagination.page, filters]);

  const loadRoles = async () => {
    try {
      const response = await roleApi.getAll();
      if (response.success) {
        setRoles(response.data.roles);
      }
    } catch (error) {
      console.error('Failed to load roles:', error);
    }
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

  const [permissionsGrouped, setPermissionsGrouped] = useState({});

  useEffect(() => {
    loadUsers();
    loadRoles();
  }, [loadUsers]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (page) => {
    setPagination(prev => ({ ...prev, page }));
  };

  const handleOpenUserModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        email: user.email,
        password: '',
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone || '',
        role: user.role?._id || user.role || '',
        isActive: user.isActive,
      });
    } else {
      setEditingUser(null);
      setFormData({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        phone: '',
        role: '',
        isActive: true,
      });
    }
    setShowModal(true);
  };

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
    loadPermissions();
  };

  const handleSaveUser = async () => {
    try {
      if (editingUser) {
        await userApi.update(editingUser._id, formData);
      } else {
        await userApi.create(formData);
      }
      setShowModal(false);
      loadUsers();
    } catch (error) {
      console.error('Failed to save user:', error);
      alert(error.message || 'Failed to save user');
    }
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

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await userApi.delete(userId);
      loadUsers();
    } catch (error) {
      console.error('Failed to delete user:', error);
      alert(error.message || 'Failed to delete user');
    }
  };

  const handleToggleUserStatus = async (userId) => {
    try {
      await userApi.toggleStatus(userId);
      loadUsers();
    } catch (error) {
      console.error('Failed to toggle user status:', error);
      alert(error.message || 'Failed to toggle user status');
    }
  };

  const handleDeleteRole = async (roleId) => {
    if (!window.confirm('Are you sure you want to delete this role?')) return;
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

  if (loading && users.length === 0) {
    return (
      <>
        <header className="main-header">
          <h1 className="page-title"><Users size={24} className="me-2" />User Management</h1>
        </header>
        <div className="page-content">
          <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
            <div className="loading-spinner"></div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <header className="main-header bg-white border-bottom py-3 px-4">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
          <div className="d-flex align-items-center gap-3">
            <div className="p-2 bg-primary-subtle text-primary rounded-3">
              <Users size={24} />
            </div>
            <div>
              <h1 className="h4 fw-bold mb-0 text-dark">User Management</h1>
              <p className="smallest text-muted mb-0">Manage platform access, roles, and permissions</p>
            </div>
          </div>
          <div className="d-flex gap-2">
            <button
              className="btn btn-white fw-bold d-flex align-items-center gap-2 shadow-sm border"
              onClick={() => document.getElementById('roles-section')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <Shield size={16} />
              Manage Roles
            </button>
            <button className="btn btn-primary fw-bold d-flex align-items-center gap-2 shadow-sm" onClick={() => handleOpenUserModal()}>
              <UserPlus size={16} />
              Add New User
            </button>
          </div>
        </div>
      </header>

      <div className="page-content px-4 py-4" style={{ backgroundColor: '#f8fafc' }}>
        {/* Statistics or Quick Filters - Optional but good for Premium feel */}
        <div className="row g-3 mb-4">
          <div className="col-md-3">
            <div className="card border-0 shadow-sm p-3" style={{ borderRadius: '16px' }}>
              <div className="d-flex align-items-center gap-3">
                <div className="p-2 bg-blue- soft text-primary rounded-circle" style={{ backgroundColor: '#eff6ff' }}>
                  <Users size={20} />
                </div>
                <div>
                  <div className="smallest fw-bold text-muted text-uppercase">Total Users</div>
                  <div className="h5 fw-bold mb-0">{pagination.total}</div>
                </div>
              </div>
            </div>
          </div>
          {/* Add more metric cards if needed */}
        </div>

        {/* Filters Card */}
        <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '20px', overflow: 'hidden' }}>
          <div className="card-body p-4">
            <div className="row g-3 align-items-end">
              <div className="col-md-5">
                <label className="form-label smallest fw-bold text-muted text-uppercase mb-2">Search Directory</label>
                <div className="input-group bg-light border-0 px-2 rounded-3" style={{ transition: 'all 0.2s' }}>
                  <span className="input-group-text bg-transparent border-0 text-muted pe-1">
                    <Search size={18} />
                  </span>
                  <input
                    type="text"
                    className="form-control bg-transparent border-0 shadow-none ps-1 fs-6"
                    placeholder="Search by name, email or phone..."
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                  />
                </div>
              </div>
              <div className="col-md-3">
                <label className="form-label smallest fw-bold text-muted text-uppercase mb-2">Access Role</label>
                <select
                  className="form-select bg-light border-0 rounded-3 fs-6"
                  value={filters.role}
                  onChange={(e) => handleFilterChange('role', e.target.value)}
                >
                  <option value="">All Roles</option>
                  {roles.map(role => (
                    <option key={role._id} value={role._id}>{role.displayName}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label smallest fw-bold text-muted text-uppercase mb-2">Status</label>
                <select
                  className="form-select bg-light border-0 rounded-3 fs-6"
                  value={filters.isActive}
                  onChange={(e) => handleFilterChange('isActive', e.target.value)}
                >
                  <option value="">All Accounts</option>
                  <option value="true">Active Only</option>
                  <option value="false">Inactive Only</option>
                </select>
              </div>
              <div className="col-md-1">
                <button
                  className="btn btn-light w-100 border-0 rounded-3 d-flex align-items-center justify-content-center"
                  style={{ height: '42px' }}
                  onClick={() => setFilters({ search: '', role: '', isActive: '' })}
                  title="Clear Filters"
                >
                  <XCircle size={20} className="text-muted" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Users Table Card */}
        <div className="card border-0 shadow-sm" style={{ borderRadius: '20px', overflow: 'hidden' }}>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead className="bg-light">
                  <tr>
                    <th className="px-4 py-3 border-0 smallest fw-bold text-muted text-uppercase">Team Member</th>
                    <th className="py-3 border-0 smallest fw-bold text-muted text-uppercase">Email Identity</th>
                    <th className="py-3 border-0 smallest fw-bold text-muted text-uppercase">Access Level</th>
                    <th className="py-3 border-0 smallest fw-bold text-muted text-uppercase">Account Status</th>
                    <th className="py-3 border-0 smallest fw-bold text-muted text-uppercase">Last Login</th>
                    <th className="px-4 py-3 border-0 text-end smallest fw-bold text-muted text-uppercase">Control</th>
                  </tr>
                </thead>
                <tbody className="border-top-0">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-5 text-muted">
                        <div className="mb-2">
                          <Users size={40} className="opacity-25" />
                        </div>
                        <div className="fw-bold">No team members found</div>
                        <div className="smallest">Try adjusting your filters or search terms.</div>
                      </td>
                    </tr>
                  ) : (
                    users.map(user => (
                      <tr key={user._id} className="hover-shadow-sm transition-all">
                        <td className="px-4">
                          <div className="d-flex align-items-center gap-3">
                            <Link
                              to={`/profile/${user._id}`}
                              className="avatar d-flex align-items-center justify-content-center text-white fw-bold shadow-sm text-decoration-none"
                              style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '12px',
                                background: user.role?.color ? `linear-gradient(135deg, ${user.role.color}, ${user.role.color}dd)` : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                                fontSize: '14px'
                              }}
                            >
                              {user.firstName?.[0]}{user.lastName?.[0]}
                            </Link>
                            <div>
                              <Link to={`/profile/${user._id}`} className="fw-bold text-dark fs-6 text-decoration-none hover-primary">{user.firstName} {user.lastName}</Link>
                              <div className="smallest text-muted d-flex align-items-center gap-1">
                                <Phone size={10} />
                                {user.phone || 'No phone set'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="d-flex align-items-center gap-2 text-dark">
                            <Mail size={14} className="text-muted" />
                            <span className="fs-6">{user.email}</span>
                          </div>
                        </td>
                        <td>
                          <span
                            className="badge rounded-pill px-3 py-2 fw-bold"
                            style={{
                              backgroundColor: `${user.role?.color || '#6B7280'}15`,
                              color: user.role?.color || '#6B7280',
                              border: `1px solid ${user.role?.color || '#6B7280'}30`
                            }}
                          >
                            {user.role?.displayName || 'Standard User'}
                          </span>
                        </td>
                        <td>
                          {user.isActive ? (
                            <span className="badge rounded-pill bg-success-subtle text-success px-3 py-2 d-inline-flex align-items-center gap-1 fw-bold">
                              <CheckCircle2 size={12} />
                              Active
                            </span>
                          ) : (
                            <span className="badge rounded-pill bg-danger-subtle text-danger px-3 py-2 d-inline-flex align-items-center gap-1 fw-bold">
                              <XCircle size={12} />
                              Inactive
                            </span>
                          )}
                        </td>
                        <td>
                          <div className="text-dark fs-6 d-flex align-items-center gap-2">
                            <Clock size={14} className="text-muted" />
                            {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never'}
                          </div>
                        </td>
                        <td className="px-4">
                          <div className="d-flex gap-2 justify-content-end">
                            <button
                              className="btn btn-icon btn-white border shadow-sm hover-primary"
                              onClick={() => handleOpenUserModal(user)}
                              title="Edit Member"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              className={`btn btn-icon border shadow-sm ${user.isActive ? 'btn-white hover-warning' : 'btn-soft-success'}`}
                              onClick={() => handleToggleUserStatus(user._id)}
                              title={user.isActive ? 'Deactivate Access' : 'Restore Access'}
                            >
                              {user.isActive ? <Pause size={14} /> : <Play size={14} />}
                            </button>
                            <button
                              className="btn btn-icon btn-white border shadow-sm hover-danger"
                              onClick={() => handleDeleteUser(user._id)}
                              title="Delete Member"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="d-flex justify-content-center p-3 border-top">
                <nav>
                  <ul className="pagination mb-0">
                    <li className={`page-item ${pagination.page === 1 ? 'disabled' : ''}`}>
                      <button className="page-link" onClick={() => handlePageChange(pagination.page - 1)}>Previous</button>
                    </li>
                    {[...Array(pagination.pages)].map((_, idx) => (
                      <li key={idx} className={`page-item ${pagination.page === idx + 1 ? 'active' : ''}`}>
                        <button className="page-link" onClick={() => handlePageChange(idx + 1)}>{idx + 1}</button>
                      </li>
                    ))}
                    <li className={`page-item ${pagination.page === pagination.pages ? 'disabled' : ''}`}>
                      <button className="page-link" onClick={() => handlePageChange(pagination.page + 1)}>Next</button>
                    </li>
                  </ul>
                </nav>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* User Modal */}
      {showModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(17, 24, 39, 0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '20px' }}>
              <div className="modal-header border-0 px-4 pt-4 pb-0">
                <h5 className="h5 fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                  <div className="p-2 bg-primary-subtle text-primary rounded-3">
                    {editingUser ? <Pencil size={20} /> : <UserPlus size={20} />}
                  </div>
                  {editingUser ? 'Edit Team Member' : 'Add New Member'}
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>
              <div className="modal-body px-4 py-4">
                <div className="row g-4">
                  <div className="col-md-6">
                    <label className="form-label smallest fw-bold text-muted text-uppercase mb-2">First Name</label>
                    <input
                      type="text"
                      className="form-control form-control-lg bg-light border-0 px-3 fs-6"
                      style={{ borderRadius: '12px' }}
                      placeholder="e.g. John"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label smallest fw-bold text-muted text-uppercase mb-2">Last Name</label>
                    <input
                      type="text"
                      className="form-control form-control-lg bg-light border-0 px-3 fs-6"
                      style={{ borderRadius: '12px' }}
                      placeholder="e.g. Doe"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label smallest fw-bold text-muted text-uppercase mb-2">Email Address</label>
                    <div className="input-group bg-light border-0 rounded-3">
                      <span className="input-group-text bg-transparent border-0 text-muted pe-1"><Mail size={16} /></span>
                      <input
                        type="email"
                        className="form-control bg-transparent border-0 shadow-none ps-1 fs-6"
                        placeholder="john.doe@example.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        disabled={!!editingUser}
                        required
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label smallest fw-bold text-muted text-uppercase mb-2">
                      Access Password {!editingUser && <span className="text-primary">*</span>}
                    </label>
                    <input
                      type="password"
                      className="form-control form-control-lg bg-light border-0 px-3 fs-6"
                      style={{ borderRadius: '12px' }}
                      placeholder={editingUser ? "Leave blank to keep same" : "Secure password"}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required={!editingUser}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label smallest fw-bold text-muted text-uppercase mb-2">Contact Number</label>
                    <div className="input-group bg-light border-0 rounded-3">
                      <span className="input-group-text bg-transparent border-0 text-muted pe-1"><Phone size={16} /></span>
                      <input
                        type="text"
                        className="form-control bg-transparent border-0 shadow-none ps-1 fs-6"
                        placeholder="+91 98765 43210"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label smallest fw-bold text-muted text-uppercase mb-2">Assigned Role</label>
                    <select
                      className="form-select form-control-lg bg-light border-0 px-3 fs-6"
                      style={{ borderRadius: '12px' }}
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      required
                    >
                      <option value="">Select Level</option>
                      {roles.map(role => (
                        <option key={role._id} value={role._id}>{role.displayName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12 mt-3">
                    <div className="form-check form-switch d-flex align-items-center gap-2 ps-0">
                      <label className="form-check-label smallest fw-bold text-muted text-uppercase order-0" htmlFor="isActive">Account Active</label>
                      <input
                        type="checkbox"
                        className="form-check-input ms-auto shadow-none"
                        id="isActive"
                        style={{ width: '40px', height: '20px', cursor: 'pointer' }}
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer border-0 px-4 pb-4 pt-0 gap-2">
                <button type="button" className="btn btn-white fw-bold px-4" onClick={() => setShowModal(false)} style={{ borderRadius: '12px' }}>Discard</button>
                <button type="button" className="btn btn-primary fw-bold px-4" onClick={handleSaveUser} style={{ borderRadius: '12px' }}>
                  {editingUser ? 'Update Profile' : 'Create Account'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Role Modal */}
      {showRoleModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(17, 24, 39, 0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable" style={{ maxWidth: '1200px', width: '95%' }}>
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '24px' }}>
              <div className="modal-header border-0 px-4 pt-4 pb-0">
                <h5 className="h5 fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                  <div className="p-2 bg-primary-subtle text-primary rounded-3">
                    <Shield size={20} />
                  </div>
                  {editingRole ? 'Configure Security Role' : 'Define New Role'}
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowRoleModal(false)}></button>
              </div>
              <div className="modal-body px-4 py-4">
                <div className="row g-4 mb-4 pb-4 border-bottom border-light">
                  <div className="col-md-4">
                    <label className="form-label smallest fw-bold text-primary text-uppercase mb-2 d-flex align-items-center gap-2">
                      <Shield size={14} />
                      Technical Identifier
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-lg bg-light border-0 px-3 fs-6 fw-medium"
                      style={{ borderRadius: '12px', height: '48px' }}
                      value={roleFormData.name}
                      onChange={(e) => setRoleFormData({ ...roleFormData, name: e.target.value })}
                      disabled={editingRole?.isSystem}
                      placeholder="e.g. system_admin"
                      required
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label smallest fw-bold text-primary text-uppercase mb-2 d-flex align-items-center gap-2">
                      <UserPlus size={14} />
                      Display Label
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-lg bg-light border-0 px-3 fs-6"
                      style={{ borderRadius: '12px', height: '48px' }}
                      value={roleFormData.displayName}
                      onChange={(e) => setRoleFormData({ ...roleFormData, displayName: e.target.value })}
                      placeholder="e.g. System Admin"
                      required
                    />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label smallest fw-bold text-primary text-uppercase mb-2 d-flex align-items-center gap-2">
                      <Shield size={14} />
                      Priority
                    </label>
                    <input
                      type="number"
                      className="form-control form-control-lg bg-light border-0 px-3 fs-6"
                      style={{ borderRadius: '12px', height: '48px' }}
                      value={roleFormData.level}
                      onChange={(e) => setRoleFormData({ ...roleFormData, level: parseInt(e.target.value) })}
                      min="0" max="100"
                    />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label smallest fw-bold text-primary text-uppercase mb-2 d-flex align-items-center gap-1">
                      Role Color
                    </label>
                    <div className="d-flex align-items-center justify-content-center bg-light rounded-3 px-2" style={{ height: '48px' }}>
                      <input
                        type="color"
                        className="form-control form-control-color border-0 bg-transparent p-0 cursor-pointer"
                        style={{ height: '32px', width: '32px' }}
                        value={roleFormData.color}
                        onChange={(e) => setRoleFormData({ ...roleFormData, color: e.target.value })}
                      />
                      <span className="ms-2 smallest text-muted font-monospace">{roleFormData.color}</span>
                    </div>
                  </div>
                  <div className="col-12 mt-3">
                    <label className="form-label smallest fw-bold text-primary text-uppercase mb-2 d-flex align-items-center gap-2">
                      Role Description
                    </label>
                    <input
                      className="form-control form-control-lg bg-light border-0 px-3 fs-6"
                      style={{ borderRadius: '12px', height: '48px' }}
                      placeholder="Provide a brief overview of what this role can do..."
                      value={roleFormData.description}
                      onChange={(e) => setRoleFormData({ ...roleFormData, description: e.target.value })}
                    />
                  </div>
                </div>

                <div className="d-flex align-items-center gap-2 mb-4">
                  <div className="h6 fw-bold mb-0 text-dark">Permission Matrix</div>
                  <div className="ms-auto smallest text-muted">Grant specific access capabilities for this role</div>
                </div>

                <div className="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-4">
                  {Object.entries(permissionsGrouped).map(([category, perms]) => (
                    <div key={category} className="col">
                      <div className="card h-100 border-0 shadow-sm" style={{ borderRadius: '16px', overflow: 'hidden', backgroundColor: '#fdfdfd' }}>
                        <div className="card-header border-0 d-flex justify-content-between align-items-center py-3 px-3" style={{ backgroundColor: 'rgba(79, 70, 229, 0.03)' }}>
                          <span className="text-uppercase smallest fw-bold text-primary">{category}</span>
                          <button
                            type="button"
                            className="btn btn-sm btn-soft-primary px-2 py-1 smallest fw-bold border-0 shadow-none"
                            onClick={() => toggleAllPermissions(category)}
                            style={{ fontSize: '10px' }}
                          >
                            Toggle All
                          </button>
                        </div>
                        <div className="card-body py-2 px-3" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                          {perms.map(perm => (
                            <div key={perm._id} className="form-check py-2 border-bottom border-light-subtle last-border-0 transition-all hover-bg-light rounded-2 px-4">
                              <input
                                type="checkbox"
                                className="form-check-input shadow-none cursor-pointer"
                                id={`perm-${perm._id}`}
                                checked={selectedPermissions.includes(perm._id)}
                                onChange={() => togglePermission(perm._id)}
                                style={{ width: '16px', height: '16px' }}
                              />
                              <label className="form-check-label smallest text-dark ms-2 fw-medium cursor-pointer w-100" htmlFor={`perm-${perm._id}`}>
                                {perm.displayName}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="modal-footer border-0 px-4 pb-4 pt-0 gap-2">
                  <button type="button" className="btn btn-white fw-bold px-4" onClick={() => setShowRoleModal(false)} style={{ borderRadius: '12px' }}>Cancel</button>
                  <button type="button" className="btn btn-primary fw-bold px-4" onClick={handleSaveRole} style={{ borderRadius: '12px' }}>
                    {editingRole ? 'Save Changes' : 'Create Role'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div id="roles-section" className="mt-5 px-4 mb-5">
        <div className="d-flex align-items-center gap-2 mb-4">
          <Shield size={20} className="text-primary" />
          <h5 className="h5 fw-bold mb-0 text-dark">Platform Roles</h5>
          <span className="badge rounded-pill bg-light text-muted border smallest px-3">{roles.length} Total</span>
        </div>
        <div className="row g-4">
          {roles.map(role => (
            <div key={role._id} className="col-md-4 col-lg-3">
              <div className="card h-100 border-0 shadow-sm hover-shadow transition-all" style={{ borderRadius: '20px' }}>
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
                      <button
                        className="btn btn-icon btn-light-danger border-0 shadow-none hover-danger transition-all"
                        onClick={() => handleDeleteRole(role._id)}
                        style={{ width: '30px', height: '30px' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <h6 className="h6 fw-bold text-dark mb-1">{role.displayName}</h6>
                  <p className="smallest text-muted mb-4 flex-grow-1" style={{ display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {role.description || 'No description provided for this role.'}
                  </p>

                  <div className="d-flex align-items-center justify-content-between pt-3 border-top border-light">
                    <div className="d-flex align-items-center gap-1 text-primary smallest fw-bold">
                      <Shield size={12} />
                      {role.permissions?.length || 0} Permissions
                    </div>
                    <button className="btn btn-link p-0 smallest fw-bold text-muted text-decoration-none d-flex align-items-center gap-1 hover-primary" onClick={() => handleOpenRoleModal(role)}>
                      Configure
                      <ChevronRight size={12} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div className="col-md-4 col-lg-3">
            <div
              className="card h-100 border-2 border-dashed border-light-subtle shadow-none d-flex align-items-center justify-content-center cursor-pointer hover-bg-light transition-all"
              style={{ borderRadius: '20px', minHeight: '180px' }}
              onClick={() => handleOpenRoleModal()}
            >
              <div className="text-center p-4">
                <div className="avatar bg-white shadow-sm rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3" style={{ width: '48px', height: '48px' }}>
                  <Plus size={24} className="text-primary" />
                </div>
                <div className="fw-bold text-dark">Add New Role</div>
                <div className="smallest text-muted">Create custom permissions</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UsersPage;
