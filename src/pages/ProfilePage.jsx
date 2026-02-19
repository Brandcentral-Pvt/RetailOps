import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { User, Mail, Shield, Calendar, Camera, Edit2, Loader2 } from 'lucide-react';

const ProfilePage = () => {
    const { id } = useParams();
    const { user: currentUser, refreshUser, logout: authLogout } = useAuth();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [pwdData, setPwdData] = useState({ current: '', new: '', confirm: '' });
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: ''
    });

    useEffect(() => {
        const fetchUser = async () => {
            try {
                setLoading(true);
                const targetId = id || currentUser?._id;

                if (!targetId) {
                    setError('User not found');
                    return;
                }

                const response = await api.userApi.getById(targetId);
                if (response.success) {
                    setUser(response.data);
                    setFormData({
                        firstName: response.data.firstName || '',
                        lastName: response.data.lastName || '',
                        email: response.data.email || '',
                        phone: response.data.phone || ''
                    });
                } else {
                    setError('Failed to fetch user data');
                }
            } catch (err) {
                console.error('Error fetching profile:', err);
                setError(err.message || 'Error loading profile');
            } finally {
                setLoading(false);
            }
        };

        fetchUser();
    }, [id, currentUser?._id]);

    const handleSave = async () => {
        try {
            setSaving(true);
            const response = await api.userApi.update(user._id, formData);
            if (response.success) {
                const updatedUser = response.data;
                setUser(updatedUser);
                setIsEditing(false);
                if (currentUser?._id === user._id) {
                    refreshUser(updatedUser);
                }
                alert('Profile updated successfully');
            }
        } catch (err) {
            console.error('Error updating profile:', err);
            alert('Failed to update profile: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handlePasswordChange = async () => {
        if (pwdData.new !== pwdData.confirm) {
            alert('New passwords do not match');
            return;
        }
        try {
            setSaving(true);
            const response = await api.authApi.changePassword(pwdData.current, pwdData.new);
            if (response.success) {
                alert('Password changed successfully');
                setShowPasswordModal(false);
                setPwdData({ current: '', new: '', confirm: '' });
            }
        } catch (err) {
            alert(err.message || 'Failed to change password');
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = () => {
        if (window.confirm('Are you sure you want to log out?')) {
            authLogout();
        }
    };

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
                <Loader2 className="animate-spin text-primary" size={48} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="container py-5 text-center">
                <div className="alert alert-danger p-4 shadow-sm" style={{ borderRadius: '12px' }}>
                    <h5 className="fw-bold">Error Loading Profile</h5>
                    <p className="mb-0">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="container-fluid py-4">
            <div className="row justify-content-center">
                <div className="col-lg-10 col-xl-8">
                    {/* Header Card */}
                    <div className="card border-0 shadow-sm mb-4 overflow-hidden" style={{ borderRadius: '16px' }}>
                        <div className="bg-primary" style={{ height: '120px' }}></div>
                        <div className="card-body pt-0 px-4 pb-4">
                            <div className="d-flex justify-content-end mb-3">
                                {isEditing ? (
                                    <div className="d-flex gap-2">
                                        <button
                                            className="btn btn-light rounded-pill px-4 fw-bold"
                                            onClick={() => setIsEditing(false)}
                                            disabled={saving}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            className="btn btn-primary rounded-pill px-4 fw-bold"
                                            onClick={handleSave}
                                            disabled={saving}
                                        >
                                            {saving ? 'Saving...' : 'Save Changes'}
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        className="btn btn-light rounded-pill px-4 fw-bold d-flex align-items-center gap-2"
                                        onClick={() => setIsEditing(true)}
                                    >
                                        <Edit2 size={16} />
                                        Edit Profile
                                    </button>
                                )}
                            </div>
                            <div className="d-flex align-items-center gap-4" style={{ marginTop: '-48px' }}>
                                <div className="position-relative">
                                    <div className="rounded-circle border border-4 border-white shadow-lg overflow-hidden" style={{ width: '120px', height: '120px' }}>
                                        <img
                                            src={`https://ui-avatars.com/api/?name=${user?.firstName}+${user?.lastName}&background=4f46e5&color=fff&size=128`}
                                            alt="Profile"
                                            className="w-100 h-100 object-fit-cover"
                                        />
                                    </div>
                                    <button className="btn btn-primary btn-sm rounded-circle position-absolute bottom-0 end-0 p-2 shadow">
                                        <Camera size={14} />
                                    </button>
                                </div>
                                <div className="text-dark"> {/* Changed text-white to text-dark as it's not on primary background anymore */}
                                    <h2 className="fw-bold mb-1">{user?.firstName} {user?.lastName}</h2>
                                    <div className="d-flex align-items-center gap-2 opacity-75">
                                        <Shield size={16} />
                                        <span className="small fw-medium">{user?.role?.displayName || 'User'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="row g-4">
                        {/* Information Section */}
                        <div className="col-md-7">
                            <div className="card border-0 shadow-sm h-100" style={{ borderRadius: '16px' }}>
                                <div className="card-header bg-transparent border-0 pt-4 px-4">
                                    <h5 className="fw-bold mb-0">Personal Information</h5>
                                </div>
                                <div className="card-body p-4">
                                    <div className="row g-4">
                                        <div className="col-sm-6">
                                            <label className="text-muted small fw-medium mb-1">First Name</label>
                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    value={formData.firstName}
                                                    onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                                                />
                                            ) : (
                                                <div className="p-3 bg-light rounded fw-medium">
                                                    {user?.firstName || 'N/A'}
                                                </div>
                                            )}
                                        </div>
                                        <div className="col-sm-6">
                                            <label className="text-muted small fw-medium mb-1">Last Name</label>
                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    value={formData.lastName}
                                                    onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                                                />
                                            ) : (
                                                <div className="p-3 bg-light rounded fw-medium">
                                                    {user?.lastName || 'N/A'}
                                                </div>
                                            )}
                                        </div>
                                        <div className="col-12">
                                            <label className="text-muted small fw-medium mb-1">Email Address</label>
                                            {isEditing ? (
                                                <input
                                                    type="email"
                                                    className="form-control"
                                                    value={formData.email}
                                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                                    disabled // Email usually shouldn't be changed here or needs verification
                                                />
                                            ) : (
                                                <div className="p-3 bg-light rounded d-flex align-items-center gap-3 fw-medium">
                                                    <Mail size={18} className="text-muted" />
                                                    {user?.email || 'N/A'}
                                                </div>
                                            )}
                                        </div>
                                        <div className="col-sm-6">
                                            <label className="text-muted small fw-medium mb-1">Account Created</label>
                                            <div className="p-3 bg-light rounded d-flex align-items-center gap-3 fw-medium">
                                                <Calendar size={18} className="text-muted" />
                                                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                                            </div>
                                        </div>
                                        <div className="col-sm-6">
                                            <label className="text-muted small fw-medium mb-1">Contact Number</label>
                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    value={formData.phone}
                                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                                />
                                            ) : (
                                                <div className="p-3 bg-light rounded fw-medium text-muted">
                                                    {user?.phone || 'Not provided'}
                                                </div>
                                            )}
                                        </div>
                                        <div className="col-12">
                                            <label className="text-muted small fw-medium mb-1">Role Permissions</label>
                                            <div className="p-3 bg-light rounded text-uppercase small fw-bold text-primary border border-primary-subtle" style={{ letterSpacing: '0.05em' }}>
                                                {user?.role?.displayName || user?.role?.name || 'Standard User'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Recent Activity Section */}
                        <div className="col-md-5">
                            <div className="card border-0 shadow-sm h-100" style={{ borderRadius: '16px' }}>
                                <div className="card-header bg-transparent border-0 pt-4 px-4">
                                    <div className="d-flex justify-content-between align-items-center">
                                        <h5 className="fw-bold mb-0">Security & Activity</h5>
                                        <Shield size={18} className="text-primary" />
                                    </div>
                                </div>
                                <div className="card-body p-4">
                                    <div className="list-group list-group-flush border-top-0">
                                        <div className="list-group-item px-0 border-0 bg-transparent mb-4">
                                            <div className="d-flex justify-content-between align-items-center mb-2">
                                                <div className="d-flex align-items-center">
                                                    <div className="bg-success-subtle p-2 rounded-circle me-3">
                                                        <Shield size={16} className="text-success" />
                                                    </div>
                                                    <div>
                                                        <span className="small fw-bold d-block">Two-Factor Auth</span>
                                                        <p className="text-muted extra-small mb-0">Secured via Authenticator</p>
                                                    </div>
                                                </div>
                                                <span className="badge bg-success-subtle text-success rounded-pill px-2">Active</span>
                                            </div>
                                        </div>
                                        <div className="list-group-item px-0 border-0 bg-transparent mb-4">
                                            <div className="d-flex justify-content-between align-items-center mb-2">
                                                <div className="d-flex align-items-center">
                                                    <div className="bg-primary-subtle p-2 rounded-circle me-3">
                                                        <Calendar size={16} className="text-primary" />
                                                    </div>
                                                    <div>
                                                        <span className="small fw-bold d-block">Last Login</span>
                                                        <p className="text-muted extra-small mb-0">{new Date().toLocaleDateString()}</p>
                                                    </div>
                                                </div>
                                                <span className="text-muted extra-small">Just now</span>
                                            </div>
                                        </div>
                                        <hr className="my-2 opacity-10" />
                                        <div className="mt-auto">
                                            <button
                                                className="btn btn-primary w-100 rounded-pill py-2 shadow-sm fw-semibold mb-2"
                                                onClick={() => setShowPasswordModal(true)}
                                            >
                                                Change Password
                                            </button>
                                            <button
                                                className="btn btn-outline-danger w-100 rounded-pill py-2 fw-semibold"
                                                onClick={handleLogout}
                                            >
                                                Log Out Current Session
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <style jsx>{`
                .extra-small {
                    font-size: 0.75rem;
                }
                .backdrop-blur {
                    backdrop-filter: blur(8px);
                }
            `}</style>

            {/* Password Modal */}
            {showPasswordModal && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1050 }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '20px' }}>
                            <div className="modal-header border-0 px-4 pt-4">
                                <h5 className="fw-bold mb-0">Change Password</h5>
                                <button type="button" className="btn-close" onClick={() => setShowPasswordModal(false)}></button>
                            </div>
                            <div className="modal-body p-4">
                                <div className="mb-3">
                                    <label className="form-label small fw-bold text-muted">CURRENT PASSWORD</label>
                                    <input
                                        type="password"
                                        className="form-control bg-light border-0"
                                        value={pwdData.current}
                                        onChange={e => setPwdData({ ...pwdData, current: e.target.value })}
                                    />
                                </div>
                                <div className="mb-3">
                                    <label className="form-label small fw-bold text-muted">NEW PASSWORD</label>
                                    <input
                                        type="password"
                                        className="form-control bg-light border-0"
                                        value={pwdData.new}
                                        onChange={e => setPwdData({ ...pwdData, new: e.target.value })}
                                    />
                                </div>
                                <div className="mb-0">
                                    <label className="form-label small fw-bold text-muted">CONFIRM NEW PASSWORD</label>
                                    <input
                                        type="password"
                                        className="form-control bg-light border-0"
                                        value={pwdData.confirm}
                                        onChange={e => setPwdData({ ...pwdData, confirm: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="modal-footer border-0 p-4 pt-0">
                                <button className="btn btn-light rounded-pill px-4" onClick={() => setShowPasswordModal(false)}>Cancel</button>
                                <button
                                    className="btn btn-primary rounded-pill px-4"
                                    onClick={handlePasswordChange}
                                    disabled={saving}
                                >
                                    {saving ? 'Saving...' : 'Update Password'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProfilePage;
