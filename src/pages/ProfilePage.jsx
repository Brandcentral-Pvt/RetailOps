import { Spinner } from "@/components/Spinner";
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import {
    Card, Input, Button, Row, Col, Typography, Avatar,
    Tag, Divider, Modal, Space, message, Tooltip, Steps
} from 'antd';
import {
    User, Mail, Shield, Calendar, Camera, Edit2,
    Smartphone, Lock, LogOut, Key, CheckCircle2,
    ChevronRight, Activity, X, Eye, ArrowLeft, Send, ShieldCheck, Bell, Clock
} from 'lucide-react';
import { PageLoader } from '@/components/application/loading-indicator/PageLoader';

const { Text } = Typography;

const ProfilePage = () => {
    const { id } = useParams();
    const { user: currentUser, refreshUser, logout: authLogout } = useAuth();

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [saving, setSaving] = useState(false);

    const [pwdData, setPwdData] = useState({ current: '', newPw: '', confirm: '' });
    const [otpStep, setOtpStep] = useState(0);
    const [otpToken, setOtpToken] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [otpDestination, setOtpDestination] = useState('');
    

    const [formData, setFormData] = useState({ firstName: '', lastName: '', email: '', phone: '' });

    const [messageApi, msgCtx] = message.useMessage();

    useEffect(() => {
        const fetchUser = async () => {
            try {
                setLoading(true);
                const targetId = id || currentUser?._id;
                if (!targetId) return;
                const response = await api.userApi.getById(targetId);
                if (response.success) {
                    const d = response.data;
                    const u = {
                        ...d,
                        _id: d.Id || d._id || d.id,
                        firstName: d.firstName || d.FirstName || '',
                        lastName: d.lastName || d.LastName || '',
                        email: d.email || d.Email || '',
                        phone: d.phone || d.Phone || ''
                    };
                    setUser(u);
                    setFormData({ firstName: u.firstName, lastName: u.lastName, email: u.email, phone: u.phone });
                }
            } catch (e) {
                console.error(e);
                messageApi.error('Failed to load profile');
            } finally {
                setLoading(false);
            }
        };
        fetchUser();
    }, [id, currentUser?._id]);

    const handleSave = async () => {
        if (!formData.firstName || !formData.lastName) {
            messageApi.warning('First name and last name are required');
            return;
        }
        try {
            setSaving(true);
            const res = await api.authApi.updateProfile({
                firstName: formData.firstName,
                lastName: formData.lastName,
                phone: formData.phone
            });
            if (res.success) {
                setUser(prev => ({
                    ...prev,
                    firstName: res.data.FirstName || res.data.firstName,
                    lastName: res.data.LastName || res.data.lastName,
                    phone: res.data.Phone || res.data.phone
                }));
                setIsEditing(false);
                if (currentUser?._id === user?._id || currentUser?.id === user?._id) {
                    refreshUser(res.data);
                }
                messageApi.success('Profile updated successfully');
            } else {
                messageApi.error(res.message || 'Failed to update profile');
            }
        } catch (e) {
            console.error('Update profile error:', e);
            messageApi.error(e.message || 'Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    const openPasswordModal = () => {
        setPwdData({ current: '', newPw: '', confirm: '' });
        setOtpStep(0);
        setOtpToken('');
        setOtpCode('');
        setOtpDestination('');
        setShowPasswordModal(true);
    };

    const closePasswordModal = () => {
        setShowPasswordModal(false);
        setPwdData({ current: '', newPw: '', confirm: '' });
        setOtpStep(0);
        setOtpToken('');
        setOtpCode('');
    };

    const handleRequestOtp = async () => {
        if (!pwdData.current) {
            messageApi.warning('Please enter your current password');
            return;
        }
        if (pwdData.newPw !== pwdData.confirm) {
            messageApi.error('New passwords do not match');
            return;
        }
        if (pwdData.newPw.length < 8) {
            messageApi.error('Password must be at least 8 characters');
            return;
        }
        try {
            setSaving(true);
            const res = await api.authApi.requestPasswordChange(pwdData.current);
            // otpExpiry available for future countdown timer
            if (res.success) {
                setOtpToken(res.tempToken);
                setOtpDestination(res.destination);
// setOtpExpiry(res.expiresIn || 600);
                setOtpStep(1);
                messageApi.success(res.message || 'Verification code sent');
            } else {
                messageApi.error(res.message || 'Failed to send code');
            }
        } catch (e) {
            console.error('Request OTP error:', e);
            messageApi.error(e.message || 'Failed to send verification code');
        } finally {
            setSaving(false);
        }
    };

    const handleVerifyOtpAndPasswordChange = async () => {
        if (!otpCode || otpCode.length !== 6) {
            messageApi.warning('Please enter the 6-digit code');
            return;
        }
        try {
            setSaving(true);
            const res = await api.authApi.changePasswordWithOtp(otpToken, otpCode, pwdData.newPw);
            if (res.success) {
                setOtpStep(2);
                messageApi.success('Password changed successfully');
                setTimeout(() => {
                    closePasswordModal();
                    authLogout();
                }, 2000);
            } else {
                messageApi.error(res.message || 'Failed to change password');
            }
        } catch (e) {
            console.error('Verify OTP error:', e);
            messageApi.error(e.message || 'Failed to change password');
        } finally {
            setSaving(false);
        }
    };

    const handleResendOtp = async () => {
        try {
            const res = await api.authApi.requestPasswordChange(pwdData.current);
            // otpExpiry available for future countdown timer
            if (res.success) {
                setOtpToken(res.tempToken);
                messageApi.success('New code sent');
            }
        } catch (e) {
            messageApi.error(e.message || 'Failed to resend code');
        }
    };

    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

    if (loading && !user) return <Spinner />;

    const roleDisplay = user?.role?.DisplayName || user?.role?.displayName || user?.role?.name || 'Member';
    const isOwnProfile = currentUser?._id === user?._id || currentUser?.id === user?._id || currentUser?._id === user?.Id;

    // Real backend fields available: lastSeen (from userController), isFirstLogin (from setupWizardService)
    // Not available: setupCompletedAt, passwordChangedAt, active sessions, 2FA status

    return (
        <div style={{ background: '#f8fafc', minHeight: 'calc(100vh - 60px)' }}>
            {msgCtx}

            {/* Page Header */}
            <div style={{ padding: '20px 24px 16px', background: '#fff', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                            {isOwnProfile ? 'My Profile' : `${user?.firstName || ''} ${user?.lastName || ''}`}
                        </h2>
                        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', margin: 0, marginTop: 4 }}>
                            {isOwnProfile ? 'Manage your account settings and security' : `Viewing ${user?.firstName}'s profile`}
                        </p>
                    </div>
                    {isOwnProfile && (
                        <Space size={8} wrap>
                            <Button size="small" icon={<Key size={13} />} onClick={openPasswordModal}
                                style={{ borderRadius: "var(--radius-md)", fontWeight: 600, fontSize: 'var(--font-size-xs)', height: 32 }}>Change Password</Button>
                            <Button size="small" danger icon={<LogOut size={13} />} onClick={() => Modal.confirm({
                                title: 'Sign Out', content: 'Are you sure you want to sign out?', okText: 'Sign Out', okType: 'danger', centered: true,
                                onOk: () => authLogout()
                            })} style={{ borderRadius: "var(--radius-md)", fontWeight: 600, fontSize: 'var(--font-size-xs)', height: 32 }}>Sign Out</Button>
                        </Space>
                    )}
                </div>
            </div>

            <div style={{ padding: '20px 24px' }}>
                <Row gutter={[20, 20]}>
                    {/* Left: Profile Card */}
                    <Col xs={24} lg={8}>
                        <Card style={{ borderRadius: 12, border: '1px solid var(--border-light)', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}
                            bodyStyle={{ padding: '24px 20px', textAlign: 'center' }}>
                            <div style={{ position: 'relative', display: 'inline-block', marginBottom: 16 }}>
                                <Avatar size={88} src={`https://ui-avatars.com/api/?name=${encodeURIComponent((user?.firstName || '') + ' ' + (user?.lastName || ''))}&background=18181b&color=fff&size=176&bold=true`}
                                    style={{ border: '3px solid var(--border-light)' }} />
                                {isOwnProfile && (
                                    <Tooltip title="Avatar upload coming soon">
                                        <div style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: '50%', background: 'var(--surface-primary)', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'not-allowed', opacity: 0.6 }}>
                                            <Camera size={12} style={{ color: 'var(--text-muted)' }} />
                                        </div>
                                    </Tooltip>
                                )}
                            </div>
                            <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                                {user?.firstName} {user?.lastName}
                            </div>
                            <Tag style={{ fontSize: 10, borderRadius: "var(--radius-sm)", padding: '2px 8px', fontWeight: 600, background: 'var(--bg-primary-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)' }}>
                                {roleDisplay}
                            </Tag>

                            <Divider style={{ margin: '18px 0' }} />

                            <div style={{ display: 'flex', justifyContent: 'space-around', gap: 16 }}>
                                <div style={{ textAlign: 'center', flex: 1 }}>
                                    <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Joined</div>
                                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>{formatDate(user?.createdAt)}</div>
                                </div>
                                <div style={{ width: 1, background: 'var(--border-light)', margin: '0 4px' }} />
                                <div style={{ textAlign: 'center', flex: 1 }}>
                                    <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status</div>
                                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, marginTop: 4 }} style={{ color: user?.isActive !== false ? 'var(--text-success)' : 'var(--text-danger)' }}>
                                        {user?.isActive !== false ? 'Active' : 'Inactive'}
                                    </div>
                                </div>
                            </div>

                            <Divider style={{ margin: '18px 0' }} />

                            {isOwnProfile ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <Button block size="small" icon={isEditing ? <X size={13} /> : <Edit2 size={13} />}
                                        type={isEditing ? 'default' : 'primary'}
                                        onClick={() => {
                                            if (isEditing) {
                                                setFormData({ firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone });
                                            }
                                            setIsEditing(!isEditing);
                                        }}
                                        style={{ borderRadius: "var(--radius-md)", fontWeight: 600, fontSize: 'var(--font-size-xs)', height: 36 }}>
                                        {isEditing ? 'Cancel' : 'Edit Profile'}
                                    </Button>
                                    <Button block size="small" icon={<Lock size={13} />}
                                        onClick={openPasswordModal}
                                        style={{ borderRadius: "var(--radius-md)", fontWeight: 600, fontSize: 'var(--font-size-xs)', height: 36 }}>
                                        Change Password
                                    </Button>
                                </div>
                            ) : (
                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
                                    <Eye size={12} style={{ marginRight: 4 }} /> View Only
                                </div>
                            )}
                        </Card>
                    </Col>

                    {/* Right: Details */}
                    <Col xs={24} lg={16}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            {/* Personal Info */}
                            <Card style={{ borderRadius: 12, border: '1px solid var(--border-light)', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}
                                bodyStyle={{ padding: '20px 24px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{ width: 32, height: 32, borderRadius: "var(--radius-md)", background: 'var(--bg-primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <User size={14} style={{ color: 'var(--text-primary)' }} />
                                        </div>
                                        <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--text-primary)' }}>Personal Information</div>
                                    </div>
                                    {isEditing && isOwnProfile && (
                                        <Button size="small" type="primary" loading={saving} onClick={handleSave}
                                            style={{ borderRadius: "var(--radius-md)", fontWeight: 600, fontSize: 'var(--font-size-xs)', height: 30 }}>Save</Button>
                                    )}
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div>
                                        <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>First Name <span style={{ color: 'var(--text-danger)' }}>*</span></label>
                                        {isEditing && isOwnProfile ? (
                                            <Input size="small" value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} style={{ borderRadius: "var(--radius-md)" }} />
                                        ) : (
                                            <div style={{ padding: '10px 12px', background: 'var(--surface-secondary)', borderRadius: "var(--radius-md)", fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', border: '1px solid var(--border-light)', minHeight: 40 }}>{user?.firstName || '—'}</div>
                                        )}
                                    </div>
                                    <div>
                                        <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>Last Name <span style={{ color: 'var(--text-danger)' }}>*</span></label>
                                        {isEditing && isOwnProfile ? (
                                            <Input size="small" value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} style={{ borderRadius: "var(--radius-md)" }} />
                                        ) : (
                                            <div style={{ padding: '10px 12px', background: 'var(--surface-secondary)', borderRadius: "var(--radius-md)", fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', border: '1px solid var(--border-light)', minHeight: 40 }}>{user?.lastName || '—'}</div>
                                        )}
                                    </div>
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>Email</label>
                                        <div style={{ padding: '10px 12px', background: 'var(--surface-muted)', borderRadius: "var(--radius-md)", fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', border: '1px dashed var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 40 }}>
                                            <span><Mail size={12} style={{ marginRight: 8 }} />{user?.email || '—'}</span>
                                            <Tag style={{ fontSize: 9, borderRadius: "var(--radius-sm)", padding: '1px 8px', background: 'var(--bg-success-subtle)', color: 'var(--text-success)', border: '1px solid var(--border-success)', fontWeight: 600 }}>Verified</Tag>
                                        </div>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>Phone</label>
                                        {isEditing && isOwnProfile ? (
                                            <Input size="small" prefix={<Smartphone size={12} />} placeholder="+91 000 000 0000" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} style={{ borderRadius: "var(--radius-md)" }} />
                                        ) : (
                                            <div style={{ padding: '10px 12px', background: 'var(--surface-secondary)', borderRadius: "var(--radius-md)", fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', border: '1px solid var(--border-light)', minHeight: 40, display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <Smartphone size={12} style={{ color: 'var(--text-muted)' }} />{user?.phone || 'Not set'}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>Role</label>
                                        <div style={{ padding: '10px 12px', background: 'var(--surface-secondary)', borderRadius: "var(--radius-md)", fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', border: '1px solid var(--border-light)', minHeight: 40, display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <Shield size={12} style={{ color: 'var(--text-muted)' }} />{roleDisplay}
                                        </div>
                                    </div>
                                </div>
                            </Card>

                            {/* Security — only real backend fields shown */}
                            <Card style={{ borderRadius: 12, border: '1px solid var(--border-light)', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}
                                bodyStyle={{ padding: '20px 24px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                                    <div style={{ width: 32, height: 32, borderRadius: "var(--radius-md)", background: 'var(--bg-warning-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Shield size={14} style={{ color: 'var(--text-warning)' }} />
                                    </div>
                                    <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--text-primary)' }}>Security</div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                                    {/* Setup Status */}
                                    <div style={{ padding: '14px 16px', background: user?.isFirstLogin ? 'var(--bg-danger-subtle)' : 'var(--bg-success-subtle)', borderRadius: "var(--radius-md)", border: `1px solid ${user?.isFirstLogin ? 'var(--border-danger)' : 'var(--border-success)'}` }}>
                                        <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6, color: user?.isFirstLogin ? 'var(--text-danger)' : 'var(--text-success)' }}>Setup Status</div>
                                        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                                            {user?.isFirstLogin ? 'Initial Setup Required' : 'Setup Complete'}
                                        </div>
                                    </div>

                                    {/* Account Created */}
                                    <div style={{ padding: '14px 16px', background: 'var(--surface-secondary)', borderRadius: "var(--radius-md)", border: '1px solid var(--border-light)' }}>
                                        <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Account Created</div>
                                        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)' }}><Calendar size={12} style={{ marginRight: 6, verticalAlign: 'middle' }} />{formatDate(user?.createdAt)}</div>
                                    </div>

                                    {/* Last Seen — real from backend */}
                                    <div style={{ padding: '14px 16px', background: 'var(--surface-secondary)', borderRadius: "var(--radius-md)", border: '1px solid var(--border-light)' }}>
                                        <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Last Activity</div>
                                        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <Clock size={12} style={{ color: 'var(--text-muted)' }} />
                                            {user?.lastSeen ? formatDate(user.lastSeen) : 'Current session'}
                                        </div>
                                    </div>

                                    {/* Password Changed — backend doesn't provide this yet */}
                                    <div style={{ padding: '14px 16px', background: 'var(--surface-muted)', borderRadius: "var(--radius-md)", border: '1px dashed var(--border-light)' }}>
                                        <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Password Changed</div>
                                        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--text-muted)' }}>Not tracked</div>
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <Bell size={9} /> Backend field not available
                                        </div>
                                    </div>
                                </div>

                                {/* Password change action */}
                                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div>
                                        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>Update Credentials</div>
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 2 }}>Change your password securely with OTP verification</div>
                                    </div>
                                    <Button size="small" icon={<Lock size={13} />} onClick={openPasswordModal}
                                        style={{ borderRadius: "var(--radius-md)", fontWeight: 600, fontSize: 'var(--font-size-xs)', height: 32 }}>Change Password</Button>
                                </div>
                            </Card>
                        </div>
                    </Col>
                </Row>
            </div>

            {/* Password Modal with OTP Flow */}
            <Modal open={showPasswordModal} onCancel={closePasswordModal}
                title={<span style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--text-primary)' }}>Change Password</span>}
                centered width={460}
                footer={null}
                styles={{ body: { padding: '20px 24px' } }}>
                
                {otpStep === 0 && (
                    <>
                        <Steps current={0} size="small" style={{ marginBottom: 20 }}
                            items={[
                                { title: 'Verify Current', icon: <Lock size={12} /> },
                                { title: 'Enter OTP', icon: <ShieldCheck size={12} /> },
                                { title: 'Complete', icon: <CheckCircle2 size={12} /> }
                            ]}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div>
                                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Current Password <span style={{ color: 'var(--text-danger)' }}>*</span></label>
                                <Input.Password size="small" value={pwdData.current} onChange={e => setPwdData({ ...pwdData, current: e.target.value })} placeholder="Enter current password" style={{ borderRadius: "var(--radius-md)" }} />
                            </div>
                            <div>
                                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>New Password <span style={{ color: 'var(--text-danger)' }}>*</span></label>
                                <Input.Password size="small" value={pwdData.newPw} onChange={e => setPwdData({ ...pwdData, newPw: e.target.value })} placeholder="Enter new password (min 8 chars)" style={{ borderRadius: "var(--radius-md)" }} />
                            </div>
                            <div>
                                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Confirm Password <span style={{ color: 'var(--text-danger)' }}>*</span></label>
                                <Input.Password size="small" value={pwdData.confirm} onChange={e => setPwdData({ ...pwdData, confirm: e.target.value })} placeholder="Confirm new password" style={{ borderRadius: "var(--radius-md)" }}
                                    status={pwdData.confirm && pwdData.newPw !== pwdData.confirm ? 'error' : ''} />
                                {pwdData.confirm && pwdData.newPw !== pwdData.confirm && (
                                    <div style={{ fontSize: 10, color: 'var(--text-danger)', marginTop: 2 }}>Passwords do not match</div>
                                )}
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
                            <Button onClick={closePasswordModal} style={{ borderRadius: "var(--radius-md)", fontSize: 'var(--font-size-xs)' }}>Cancel</Button>
                            <Button type="primary" loading={saving} onClick={handleRequestOtp}
                                icon={<Send size={12} />}
                                disabled={!pwdData.current || !pwdData.newPw || !pwdData.confirm || pwdData.newPw !== pwdData.confirm}
                                style={{ borderRadius: "var(--radius-md)", fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>
                                Send Verification Code
                            </Button>
                        </div>
                    </>
                )}

                {otpStep === 1 && (
                    <>
                        <Steps current={1} size="small" style={{ marginBottom: 20 }}
                            items={[
                                { title: 'Verify Current', status: 'finish', icon: <Lock size={12} /> },
                                { title: 'Enter OTP', icon: <ShieldCheck size={12} /> },
                                { title: 'Complete', icon: <CheckCircle2 size={12} /> }
                            ]}
                        />
                        <div style={{ textAlign: 'center', padding: '10px 0' }}>
                            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--bg-primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                                <ShieldCheck size={24} style={{ color: 'var(--text-primary)' }} />
                            </div>
                            <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Verification Code Sent</div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 16 }}>
                                A 6-digit code has been sent to <strong>{otpDestination}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                                <Input.OTP length={6} size="large" value={otpCode} onChange={setOtpCode}
                                    style={{ borderRadius: "var(--radius-md)" }} />
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                Didn't receive the code?{' '}
                                <Button type="link" size="small" onClick={handleResendOtp} style={{ fontSize: 10, padding: 0 }}>
                                    Resend
                                </Button>
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
                            <Button onClick={() => setOtpStep(0)} icon={<ArrowLeft size={12} />} style={{ borderRadius: "var(--radius-md)", fontSize: 'var(--font-size-xs)' }}>Back</Button>
                            <Button type="primary" loading={saving} onClick={handleVerifyOtpAndPasswordChange}
                                disabled={!otpCode || otpCode.length !== 6}
                                style={{ borderRadius: "var(--radius-md)", fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>
                                Verify & Change Password
                            </Button>
                        </div>
                    </>
                )}

                {otpStep === 2 && (
                    <>
                        <Steps current={2} size="small" style={{ marginBottom: 20 }}
                            items={[
                                { title: 'Verify Current', status: 'finish', icon: <Lock size={12} /> },
                                { title: 'Enter OTP', status: 'finish', icon: <ShieldCheck size={12} /> },
                                { title: 'Complete', status: 'finish', icon: <CheckCircle2 size={12} /> }
                            ]}
                        />
                        <div style={{ textAlign: 'center', padding: '20px 0' }}>
                            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--bg-success-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                                <CheckCircle2 size={28} style={{ color: 'var(--text-success)' }} />
                            </div>
                            <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Password Changed!</div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                                You will be logged out shortly. Please login with your new password.
                            </div>
                        </div>
                    </>
                )}
            </Modal>
        </div>
    );
};

export default ProfilePage;
