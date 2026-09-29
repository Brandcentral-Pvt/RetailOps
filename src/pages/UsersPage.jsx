import { Spinner } from "@/components/Spinner";
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { userApi, roleApi } from '../services/api';
import { useSocket } from '../contexts/SocketContext';
import {
    Users, Shield, UserPlus, Search, Pencil, Trash2, Mail, Phone,
    Clock, CheckCircle2, XCircle, Info, UserCheck, RefreshCw, Store, Check,
    SlidersHorizontal, Lock, Plus, User, AlertCircle, Send, Eye, Briefcase
} from 'lucide-react';
import {
    Button, Segmented, Table, Modal, Input, Row, Col,
    Typography, Tooltip, Select, Switch,
    notification, message as antdMessage, Popconfirm, Drawer
} from 'antd';

const { Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

// ============================================
// HELPER FUNCTIONS
// ============================================

// Deterministic avatar colour per person, drawn from solid design tokens that
// keep white initials at or above WCAG AA contrast.
const getAvatarBackground = (firstName = '', lastName = '') => {
    const name = `${firstName || ''}${lastName || ''}`.trim() || '?';
    const backgrounds = [
        'var(--bc-ro-500)',
        'var(--bc-green-700)',
        'var(--bc-amber-700)',
        'var(--bc-ro-700)',
        'var(--bc-indigo-600)',
        'var(--text-danger)',
        'var(--bc-violet-600)',
        'var(--bc-amber-800)',
        'var(--bc-ro-600)',
        'var(--bc-ro-800)',
    ];

    // FNV-1a: a two-character sum clusters heavily onto a few buckets.
    let hash = 0x811c9dc5;
    for (let i = 0; i < name.length; i += 1) {
        hash ^= name.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return backgrounds[hash % backgrounds.length];
};

// Role tone as explicit token pairs (foreground + surface). Colour strings are
// never alpha-suffixed, so `var(--x)15` style hacks are impossible here.
const getRoleTone = (roleName) => {
    const tones = {
        super_admin: { color: 'var(--text-danger)', background: 'var(--bg-danger-subtle)' },
        admin: { color: 'var(--text-warning)', background: 'var(--bg-warning-subtle)' },
        catalog_manager: { color: 'var(--text-warning)', background: 'var(--bg-warning-subtle)' },
        listing_team: { color: 'var(--text-success)', background: 'var(--bg-success-subtle)' },
        operational_manager: { color: 'var(--text-brand)', background: 'var(--bg-info-subtle)' },
        finance_manager: { color: 'var(--text-brand)', background: 'var(--bg-info-subtle)' },
        brand_manager: { color: 'var(--text-brand)', background: 'var(--bg-info-subtle)' },
        team_lead: { color: 'var(--text-brand)', background: 'var(--bg-info-subtle)' },
        senior_executive: { color: 'var(--text-primary)', background: 'var(--bg-tertiary)' },
        executive: { color: 'var(--text-muted)', background: 'var(--bg-tertiary)' },
        viewer: { color: 'var(--text-muted)', background: 'var(--bg-tertiary)' },
    };
    return tones[roleName?.toLowerCase()] || { color: 'var(--text-muted)', background: 'var(--bg-tertiary)' };
};

const getRoleColor = (roleName) => getRoleTone(roleName).color;

// Field Label Component
const FieldLabel = ({ children }) => (
    <div style={{
        fontSize: 'var(--font-size-xs)',
        fontWeight: 600,
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        marginBottom: 6
    }}>
        {children}
    </div>
);

// Enhanced Avatar Component
const EnhancedAvatar = ({ firstName, lastName, size = 40, showStatus = false, isOnline = false }) => {
    const initials = `${(firstName || '')[0]?.toUpperCase() || ''}${(lastName || '')[0]?.toUpperCase() || ''}` || 'U';

    return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
            <div style={{
                width: size,
                height: size,
                borderRadius: '50%',
                background: getAvatarBackground(firstName, lastName),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--bc-white)',
                fontSize: size * 0.4,
                fontWeight: 600,
                boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.18)',
                letterSpacing: '0.02em',
                transition: 'transform 0.2s ease'
            }}>
                {initials}
            </div>
            {showStatus && (
                <div style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: size * 0.25,
                    height: size * 0.25,
                    borderRadius: '50%',
                    background: isOnline ? 'var(--text-success)' : 'var(--text-muted)',
                    border: '2px solid var(--bg-secondary)',
                    boxShadow: 'var(--shadow-xs)',
                    animation: isOnline ? 'pulse 2s infinite' : 'none'
                }} />
            )}
        </div>
    );
};

// Enhanced Role Badge Component
const RoleBadge = ({ role }) => {
    if (!role) return null;

    const tone = role.color
        ? { color: role.color, background: 'var(--bg-tertiary)' }
        : getRoleTone(role.name);

    return (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            background: tone.background,
            border: '1px solid var(--border-light)',
            borderRadius: "var(--radius-lg)",
            cursor: 'default'
        }}>
            <span style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: tone.color,
                flexShrink: 0
            }} />
            <span style={{
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                color: tone.color,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                lineHeight: 1,
                whiteSpace: 'nowrap'
            }}>
                {role.displayName || 'Standard'}
            </span>
        </span>
    );
};

// Format Last Active Time
const formatLastActive = (timestamp) => {
    if (!timestamp) return { text: 'Never', color: 'var(--text-muted)', isOnline: false };

    const date = new Date(timestamp);
    const diff = Date.now() - date.getTime();

    if (diff < 300000) return { text: 'Online now', color: 'var(--text-success)', isOnline: true };
    if (diff < 3600000) return { text: `${Math.floor(diff / 60000)}m ago`, color: 'var(--text-brand)', isOnline: false };
    if (diff < 86400000) return { text: `${Math.floor(diff / 3600000)}h ago`, color: 'var(--text-warning)', isOnline: false };
    if (diff < 604800000) return { text: `${Math.floor(diff / 86400000)}d ago`, color: 'var(--text-warning)', isOnline: false };
    return {
        text: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        color: 'var(--text-muted)',
        isOnline: false
    };
};

const UsersPage = () => {
    const socket = useSocket();
    const [messageApi, messageContextHolder] = antdMessage.useMessage();
    const [notificationApi, notificationContextHolder] = notification.useNotification();

    const [activeTab, setActiveTab] = useState('users');
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [matrixRoles, setMatrixRoles] = useState([]);
    const [matrixSaving, setMatrixSaving] = useState(false);
    const [sellers, setSellers] = useState([]);
    const [managers, setManagers] = useState([]);
    const [groupedPermissions, setGroupedPermissions] = useState({});
    const [allPermissions, setAllPermissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [selectedRole, setSelectedRole] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalRecords, setTotalRecords] = useState(0);
    const [serverActiveCount, setServerActiveCount] = useState(0);
    const [serverInactiveCount, setServerInactiveCount] = useState(0);
    const [permissionSearch, setPermissionSearch] = useState('');
    const [showUserModal, setShowUserModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [prevAssignedSellers, setPrevAssignedSellers] = useState([]);
    const [userFormData, setUserFormData] = useState({
        email: '', password: '', firstName: '', lastName: '', phone: '',
        role: '', isActive: true, assignedSellers: [], brandManagers: [], supervisors: []
    });
    const [modalSearchSupervisor, setModalSearchSupervisor] = useState('');
    const [modalSearchBrandManager, setModalSearchBrandManager] = useState('');
    const [modalSearchSeller, setModalSearchSeller] = useState('');
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailUser, setEmailUser] = useState(null);
    const [emailForm, setEmailForm] = useState({ subject: '', message: '' });
    const [sendingEmail, setSendingEmail] = useState(false);
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [showProfileDrawer, setShowProfileDrawer] = useState(false);
    const [profileUser, setProfileUser] = useState(null);
    const [editingRole, setEditingRole] = useState(null);
    const [roleFormData, setRoleFormData] = useState({
        name: '', displayName: '', description: '', level: 30, color: '#1e293b'
    });

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchText);
            setCurrentPage(1);
        }, 300);
        return () => clearTimeout(handler);
    }, [searchText]);

    const selectedRoleObj = useMemo(() => roles.find(r => (r._id || r.id) === userFormData.role), [roles, userFormData.role]);
    const roleName = selectedRoleObj?.name?.toLowerCase() || '';
    const roleDisplayName = selectedRoleObj?.displayName?.toLowerCase() || '';
    const isListingTeam = roleName === 'listing_team' || roleDisplayName === 'listing team';
    const isCatalogManager = roleName === 'catalog_manager' || roleDisplayName === 'catalog manager' || roleName === 'catalogue_manager' || roleDisplayName === 'catalogue manager';

    const inheritedSellers = useMemo(() => {
        return sellers.filter(s => {
            return managers.some(m => {
                const isSelectedBM = userFormData.brandManagers.includes(m._id || m.id);
                if (!isSelectedBM) return false;
                return (m.assignedSellers || []).includes(s._id || s.id);
            });
        });
    }, [sellers, managers, userFormData.brandManagers]);

    const activeCount = useMemo(() => serverActiveCount, [serverActiveCount]);
    const totalRecordCount = useMemo(() => totalRecords || users.length, [totalRecords, users]);
    const inactiveCount = useMemo(() => serverInactiveCount, [serverInactiveCount]);

    const loadUsers = useCallback(async () => {
        setLoading(true);
        try {
            const params = {
                page: currentPage, limit: pageSize,
                search: debouncedSearch, role: selectedRole, isActive: selectedStatus
            };
            const response = await userApi.getAll(params);
            if (response.success) {
                setUsers(response.data.users || []);
                setTotalRecords(response.data.pagination?.total || 0);
                setServerActiveCount(response.data.pagination?.activeCount || 0);
                setServerInactiveCount(response.data.pagination?.inactiveCount || 0);
            }
        } catch (error) {
            console.error('Failed to load users:', error);
            messageApi.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    }, [currentPage, pageSize, debouncedSearch, selectedRole, selectedStatus]);

    const loadRolesAndPerms = useCallback(async () => {
        try {
            const [rolesRes, permsRes] = await Promise.all([
                userApi.getRoles(), roleApi.getPermissions()
            ]);
            if (rolesRes.success) {
                const rolesData = rolesRes.data?.roles || rolesRes.data || [];
                const allRoles = Array.isArray(rolesData) ? rolesData : [];
                setRoles(allRoles);
                setMatrixRoles(JSON.parse(JSON.stringify(allRoles)));
            }
            if (permsRes.success) {
                setGroupedPermissions(permsRes.data?.groupedPermissions || {});
                setAllPermissions(permsRes.data?.permissions || []);
            }
        } catch (error) {
            console.error('Failed to load roles:', error);
        }
    }, []);

    const loadSellersAndManagers = useCallback(async () => {
        try {
            const [sellersRes, managersRes] = await Promise.all([
                userApi.getSellers(), userApi.getManagers()
            ]);
            const sellersData = sellersRes?.data?.sellers || sellersRes?.data || [];
            setSellers(Array.isArray(sellersData) ? sellersData : []);
            if (managersRes.success) setManagers(managersRes.data || []);
        } catch (error) {
            console.error('Failed to load sellers:', error);
        }
    }, []);

    useEffect(() => { loadUsers(); }, [loadUsers]);
    useEffect(() => { loadRolesAndPerms(); loadSellersAndManagers(); }, [loadRolesAndPerms, loadSellersAndManagers]);

    useEffect(() => {
        if (!socket) return;
        const handler = (updatedRole) => {
            setRoles(prev => prev.map(role =>
                (role._id === updatedRole._id || role.id === updatedRole.id) ? updatedRole : role
            ));
        };
        socket.on('role_permissions_updated', handler);
        return () => socket.off('role_permissions_updated', handler);
    }, [socket]);

    const handleToggleStatus = useCallback(async (userId) => {
        try {
            await userApi.toggleStatus(userId);
            messageApi.success('User status updated');
            setUsers(prev => prev.map(u =>
                (u._id === userId || u.id === userId) ? { ...u, isActive: !u.isActive } : u
            ));
        } catch (error) {
            messageApi.error(error.message || 'Failed to toggle status');
        }
    }, [messageApi]);

    const handleDeleteUser = useCallback(async (userId) => {
        try {
            await userApi.delete(userId);
            messageApi.success('User removed');
            setUsers(prev => prev.filter(u => u._id !== userId && u.id !== userId));
            setTotalRecords(prev => Math.max(0, prev - 1));
        } catch (error) {
            messageApi.error(error.message || 'Failed to remove user');
        }
    }, [messageApi]);

    const handleOpenUserModal = async (user = null) => {
        setModalSearchSupervisor('');
        setModalSearchBrandManager('');
        setModalSearchSeller('');
        if (user) {
            try {
                const response = await userApi.getById(user._id || user.id);
                const fullUser = response.data;
                setEditingUser(fullUser);
                const prevBrands = fullUser.assignedSellers?.map(s => s._id || s.id || s) || [];
                setPrevAssignedSellers(prevBrands);
                setUserFormData({
                    email: fullUser.email || '', password: '',
                    firstName: fullUser.firstName || '', lastName: fullUser.lastName || '',
                    phone: fullUser.phone || '',
                    role: fullUser.role?._id || fullUser.role?.id || fullUser.role || '',
                    isActive: fullUser.isActive !== undefined ? fullUser.isActive : true,
                    assignedSellers: fullUser.assignedSellers?.map(s => s._id || s.id || s) || [],
                    brandManagers: fullUser.brandManagers?.map(s => s._id || s.id || s) || [],
                    supervisors: fullUser.supervisors?.map(s => s._id || s.id || s) || []
                });
            } catch {
                setEditingUser(user);
                const prevBrands = user.assignedSellers?.map(s => s._id || s.id || s) || [];
                setPrevAssignedSellers(prevBrands);
                setUserFormData({
                    email: user.email || '', password: '',
                    firstName: user.firstName || '', lastName: user.lastName || '',
                    phone: user.phone || '',
                    role: user.role?._id || user.role?.id || user.role || '',
                    isActive: user.isActive !== undefined ? user.isActive : true,
                    assignedSellers: user.assignedSellers?.map(s => s._id || s.id || s) || [],
                    brandManagers: user.brandManagers?.map(s => s._id || s.id || s) || [],
                    supervisors: user.supervisors?.map(s => s._id || s.id || s) || []
                });
            }
        } else {
            setEditingUser(null);
            setPrevAssignedSellers([]);
            setUserFormData({
                email: '', password: '', firstName: '', lastName: '', phone: '',
                role: '', isActive: true, assignedSellers: [], brandManagers: [], supervisors: []
            });
        }
        setShowUserModal(true);
    };

    const handleUserRoleChange = (roleId) => {
        const sel = roles.find(r => r._id === roleId || r.id === roleId);
        const isBM = sel?.name === 'brand_manager' || sel?.displayName === 'Brand Manager';
        setUserFormData(prev => ({
            ...prev, role: roleId,
            assignedSellers: isBM ? sellers.map(s => s._id || s.id) : prev.assignedSellers
        }));
    };

    const handleSaveUser = async () => {
        if (!userFormData.firstName || !userFormData.lastName || !userFormData.email || !userFormData.role) {
            messageApi.warning('Please complete all required fields');
            return;
        }
        try {
            const sel = roles.find(r => r._id === userFormData.role || r.id === userFormData.role);
            const rn = sel?.name?.toLowerCase() || '';
            const rdn = sel?.displayName?.toLowerCase() || '';
            const isLT = rn === 'listing_team' || rdn === 'listing team';

            let finalSellers = userFormData.assignedSellers;
            if (isLT) {
                const ids = [];
                sellers.forEach(s => {
                    const inherited = managers.some(m => {
                        if (!userFormData.brandManagers.includes(m._id || m.id)) return false;
                        return (m.assignedSellers || []).includes(s._id || s.id);
                    });
                    if (inherited) ids.push(s._id || s.id);
                });
                finalSellers = ids;
            }

            const data = {
                ...userFormData, roleId: userFormData.role,
                assignedSellerIds: finalSellers,
                brandManagers: userFormData.brandManagers,
                supervisors: userFormData.supervisors
            };

            let result;
            if (editingUser) {
                result = await userApi.update(editingUser._id || editingUser.id, data);
                messageApi.success('User updated successfully');

                const addedBrands = finalSellers.filter(id => !prevAssignedSellers.includes(id));
                const removedBrands = prevAssignedSellers.filter(id => !finalSellers.includes(id));
                if (addedBrands.length > 0 || removedBrands.length > 0) {
                    try {
                        const uid = editingUser._id || editingUser.id;
                        const addedNames = addedBrands.map(id => sellers.find(s => (s._id || s.id) === id)?.name || id).filter(Boolean);
                        const removedNames = removedBrands.map(id => sellers.find(s => (s._id || s.id) === id)?.name || id).filter(Boolean);
                        let msg = '';
                        if (addedNames.length > 0) msg += `Brands assigned: ${addedNames.join(', ')}. `;
                        if (removedNames.length > 0) msg += `Brands removed: ${removedNames.join(', ')}.`;
                        await userApi.sendEmail({ userId: uid, subject: 'Your brand assignments have been updated', message: msg.trim() });
                    } catch {
                        console.warn('Brand change notification email failed');
                    }
                }
            } else {
                result = await userApi.create(data);
                messageApi.success('User created successfully');

                const newUserId = result?.data?._id || result?.data?.id;
                const actualPassword = userFormData.password || '';
                if (newUserId) {
                    try {
                        await userApi.sendCredentials(newUserId, actualPassword);
                        messageApi.success('Credentials email sent');
                    } catch {
                        messageApi.warning('User created but credentials email failed');
                    }
                }
            }
            setShowUserModal(false);
            loadUsers();
        } catch (error) {
            messageApi.error(error.message || 'Failed to save user');
        }
    };

    const handleSendEmail = (user) => {
        setEmailUser(user);
        setEmailForm({ subject: '', message: '' });
        setShowEmailModal(true);
    };

    const handleSendEmailSubmit = async () => {
        if (!emailForm.subject || !emailForm.message) {
            messageApi.error('Subject and message are required');
            return;
        }
        setSendingEmail(true);
        try {
            let result;
            if (emailForm.type === 'credentials') {
                // Send credentials email using the dedicated endpoint
                const password = emailUser?.password || userFormData?.password || '';
                result = await userApi.sendCredentials(emailUser._id || emailUser.id, password);
            } else {
                // Send custom email
                result = await userApi.sendEmail({
                    userId: emailUser._id || emailUser.id,
                    subject: emailForm.subject, 
                    message: emailForm.message
                });
            }
            if (result?.success) {
                messageApi.success('Email sent successfully');
                setShowEmailModal(false);
            } else {
                messageApi.error(result?.message || 'Failed to send email');
            }
        } catch (error) {
            messageApi.error(error.message || 'Failed to send email');
        } finally {
            setSendingEmail(false);
        }
    };

    const handleToggleCellPermission = (roleId, permId) => {
        setMatrixRoles(prev => prev.map(r => {
            if ((r._id || r.id) === roleId) {
                const ids = r.permissions?.map(p => p._id || p.id || p) || [];
                const isAssigned = ids.includes(permId);
                const updated = isAssigned ? ids.filter(id => id !== permId) : [...ids, permId];
                const permsObjects = updated.map(id => {
                    const found = allPermissions.find(p => p._id === id || p.id === id);
                    return found || { id, _id: id };
                });
                return { ...r, permissions: permsObjects };
            }
            return r;
        }));
    };

    const toPermissionIds = (permissions) =>
        (permissions || []).map(p => p._id || p.id || p).filter(Boolean).sort();

    // Some deployments return only `groupedPermissions`, so derive the total
    // rather than rendering a misleading "2/0".
    const totalPermissionCount = allPermissions.length || Object.values(groupedPermissions)
        .reduce((sum, perms) => sum + (perms?.length || 0), 0);

    // Roles whose edited permission set differs from what the server returned.
    const dirtyRoleIds = useMemo(() => {
        const dirty = new Set();
        matrixRoles.forEach(edited => {
            const id = edited._id || edited.id;
            const original = roles.find(r => (r._id || r.id) === id);
            const before = toPermissionIds(original?.permissions).join(',');
            const after = toPermissionIds(edited.permissions).join(',');
            if (before !== after) dirty.add(id);
        });
        return dirty;
    }, [matrixRoles, roles]);

    const hasUnsavedMatrixChanges = dirtyRoleIds.size > 0;

    const handleDiscardMatrixChanges = useCallback(() => {
        setMatrixRoles(prev => prev.map(edited => {
            const id = edited._id || edited.id;
            const original = roles.find(r => (r._id || r.id) === id);
            return original ? { ...original } : edited;
        }));
    }, [roles]);

    const handleSaveMatrixPermissions = async () => {
        const changed = matrixRoles.filter(r => dirtyRoleIds.has(r._id || r.id));
        if (changed.length === 0) return;

        setMatrixSaving(true);
        try {
            for (const r of changed) {
                const ids = toPermissionIds(r.permissions);
                await roleApi.update(r._id || r.id, { permissions: ids });
                if (socket) socket.emit('update_role_permissions', { roleId: r._id || r.id, permissions: ids });
            }
            notificationApi.success({
                message: 'Permissions Saved',
                description: `Updated ${changed.length} ${changed.length === 1 ? 'role' : 'roles'}.`,
                placement: 'topRight'
            });
            await loadRolesAndPerms();
        } catch (error) {
            messageApi.error(error.message || 'Failed to save permissions');
        } finally {
            setMatrixSaving(false);
        }
    };

    const handleOpenRoleModal = (role = null) => {
        if (role) {
            setEditingRole(role);
            setRoleFormData({
                name: role.name || '', displayName: role.displayName || '',
                description: role.description || '', level: role.level || 30,
                color: role.color || '#1e293b'
            });
        } else {
            setEditingRole(null);
            setRoleFormData({ name: '', displayName: '', description: '', level: 30, color: '#1e293b' });
        }
        setShowRoleModal(true);
    };

    const handleSaveRole = async () => {
        if (!roleFormData.displayName) {
            messageApi.warning('Display name is required');
            return;
        }
        try {
            const nameSlug = roleFormData.name || roleFormData.displayName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
            const data = { ...roleFormData, name: nameSlug };
            if (editingRole) {
                await roleApi.update(editingRole._id || editingRole.id, data);
                messageApi.success('Role updated');
            } else {
                await roleApi.create(data);
                messageApi.success('Role created');
            }
            setShowRoleModal(false);
            loadRolesAndPerms();
        } catch (error) {
            messageApi.error(error.message || 'Failed to save role');
        }
    };

    const handleDeleteRole = async (roleId) => {
        try {
            await roleApi.delete(roleId);
            messageApi.success('Role deleted');
            loadRolesAndPerms();
        } catch (error) {
            messageApi.error(error.message || 'Failed to delete role');
        }
    };

    const filteredGroupedPermissions = useMemo(() => {
        if (!permissionSearch) return groupedPermissions;
        const result = {};
        Object.entries(groupedPermissions).forEach(([cat, perms]) => {
            const filtered = perms.filter(p =>
                p.displayName?.toLowerCase().includes(permissionSearch.toLowerCase()) ||
                p.name?.toLowerCase().includes(permissionSearch.toLowerCase())
            );
            if (filtered.length > 0) result[cat] = filtered;
        });
        return result;
    }, [groupedPermissions, permissionSearch]);

    const filteredSupervisors = useMemo(() => {
        const q = modalSearchSupervisor.toLowerCase();
        return managers.filter(m =>
            `${m.firstName || ''} ${m.lastName || ''} ${m.email || ''}`.toLowerCase().includes(q)
        );
    }, [managers, modalSearchSupervisor]);

    const filteredBrandManagers = useMemo(() => {
        const q = modalSearchBrandManager.toLowerCase();
        return managers.filter(m =>
            m.role?.name?.toLowerCase() === 'brand_manager' || m.role?.displayName?.toLowerCase() === 'brand manager'
        ).filter(m =>
            `${m.firstName || ''} ${m.lastName || ''} ${m.email || ''}`.toLowerCase().includes(q)
        );
    }, [managers, modalSearchBrandManager]);

    const filteredSellers = useMemo(() => {
        const list = isListingTeam ? inheritedSellers : sellers;
        const q = modalSearchSeller.toLowerCase();
        return list.filter(s => `${s.name || ''} ${s.code || ''}`.toLowerCase().includes(q));
    }, [isListingTeam, inheritedSellers, sellers, modalSearchSeller]);

    const brandOwnershipMap = useMemo(() => {
        const map = {};
        const editingId = editingUser?._id || editingUser?.id;
        users.forEach(u => {
            const uid = u._id || u.id;
            if (uid === editingId) return;
            (u.assignedSellers || []).forEach(s => {
                const sid = typeof s === 'string' ? s : s._id || s.id || s;
                if (!map[sid]) map[sid] = [];
                map[sid].push(`${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email);
            });
        });
        return map;
    }, [users, editingUser]);

    // ============================================
    // ENHANCED TABLE COLUMNS
    // ============================================
    const columns = useMemo(() => [
        {
            title: 'Name',
            key: 'name',
            width: 320,
            render: (_, record) => {
                const lastActive = formatLastActive(record.lastSeen);
                return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <EnhancedAvatar
                            firstName={record.firstName}
                            lastName={record.lastName}
                            size={40}
                            showStatus={true}
                            isOnline={lastActive.isOnline}
                        />
                        <div>
                            <div style={{
                                fontSize: 'var(--font-size-base)',
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                                marginBottom: 2,
                                transition: 'color 0.2s'
                            }}>
                                {record.firstName} {record.lastName}
                            </div>
                            <div style={{
                                fontSize: 'var(--font-size-sm)',
                                color: 'var(--text-secondary)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4
                            }}>
                                <Mail size={11} strokeWidth={2} style={{ color: 'var(--text-muted)' }} />
                                {record.email}
                            </div>
                        </div>
                    </div>
                );
            }
        },
        {
            title: 'Role',
            key: 'role',
            width: 200,
            render: (_, record) => {
                const roleId = record.role?._id || record.role?.id || record.role;
                const resolved = roles.find(r => (r._id || r.id) === roleId) ||
                    (typeof record.role === 'object' ? record.role : null);
                return <RoleBadge role={resolved} />;
            }
        },
        {
            title: 'Supervisors',
            key: 'supervisors',
            width: 160,
            render: (_, record) => {
                const list = record.supervisors || [];
                if (list.length === 0) {
                    return (
                        <span style={{
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--border-medium)',
                            fontStyle: 'italic'
                        }}>—</span>
                    );
                }
                return (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        {list.slice(0, 3).map((s, i) => (
                            <Tooltip key={i} title={`${s.firstName} ${s.lastName}`}>
                                <div style={{
                                    marginLeft: i > 0 ? -8 : 0,
                                    transition: 'transform 0.2s',
                                    cursor: 'pointer'
                                }}
                                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                >
                                    <EnhancedAvatar
                                        firstName={s.firstName}
                                        lastName={s.lastName}
                                        size={28}
                                    />
                                </div>
                            </Tooltip>
                        ))}
                        {list.length > 3 && (
                            <Tooltip title={list.slice(3).map(s => `${s.firstName} ${s.lastName}`).join(', ')}>
                                <div style={{
                                    marginLeft: -8,
                                    width: 28,
                                    height: 28,
                                    borderRadius: '50%',
                                    background: 'var(--bg-tertiary)',
                                    color: 'var(--text-muted)',
                                    border: '2px solid white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 10,
                                    fontWeight: 600,
                                    boxShadow: 'var(--shadow-sm)'
                                }}>
                                    +{list.length - 3}
                                </div>
                            </Tooltip>
                        )}
                    </div>
                );
            }
        },
        {
            title: 'Status',
            dataIndex: 'isActive',
            key: 'isActive',
            width: 130,
            render: (isActive, record) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Switch
                        size="small"
                        checked={isActive}
                        onChange={() => handleToggleStatus(record._id || record.id)}
                        style={{
                            background: isActive ? 'var(--text-success)' : 'var(--border-medium)'
                        }}
                    />
                    <span style={{
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: 600,
                        color: isActive ? 'var(--text-success)' : 'var(--text-muted)',
                        transition: 'color 0.2s'
                    }}>
                        {isActive ? 'Active' : 'Inactive'}
                    </span>
                </div>
            )
        },
        {
            title: 'Last Active',
            dataIndex: 'lastSeen',
            key: 'lastSeen',
            width: 140,
            render: (val) => {
                const lastActive = formatLastActive(val);
                return (
                    <Tooltip title={val ? new Date(val).toLocaleString() : 'Never logged in'}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Clock
                                size={11}
                                style={{ color: lastActive.color }}
                                strokeWidth={2.5}
                            />
                            <span style={{
                                fontSize: 'var(--font-size-sm)',
                                color: lastActive.color,
                                fontWeight: lastActive.isOnline ? 600 : 500
                            }}>
                                {lastActive.text}
                            </span>
                        </div>
                    </Tooltip>
                );
            }
        },
        {
            title: '',
            key: 'actions',
            fixed: 'right',
            width: 140,
            align: 'right',
            render: (_, record) => (
                <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                    <Tooltip title="View Profile">
                        <Button
                            type="text"
                            size="small"
                            aria-label="View profile"
                            onClick={() => { setProfileUser(record); setShowProfileDrawer(true); }}
                            icon={<Eye size={14} strokeWidth={2} />}
                            style={{
                                color: 'var(--text-secondary)',
                                width: 32,
                                height: 32,
                                borderRadius: 6
                            }}
                        />
                    </Tooltip>
                    <Tooltip title="Send Email">
                        <Button
                            type="text"
                            size="small"
                            aria-label="Send email"
                            onClick={() => handleSendEmail(record)}
                            icon={<Send size={14} strokeWidth={2} />}
                            style={{
                                color: 'var(--text-secondary)',
                                width: 32,
                                height: 32,
                                borderRadius: 6
                            }}
                        />
                    </Tooltip>
                    <Tooltip title="Edit User">
                        <Button
                            type="text"
                            size="small"
                            aria-label="Edit user"
                            onClick={() => handleOpenUserModal(record)}
                            icon={<Pencil size={14} strokeWidth={2} />}
                            style={{
                                color: 'var(--text-secondary)',
                                width: 32,
                                height: 32,
                                borderRadius: 6
                            }}
                        />
                    </Tooltip>
                    <Popconfirm
                        title="Remove this user?"
                        description="This action cannot be undone."
                        onConfirm={() => handleDeleteUser(record._id || record.id)}
                        okButtonProps={{ danger: true }}
                        okText="Remove"
                        cancelText="Cancel"
                    >
                        <Tooltip title="Remove User">
                            <Button
                                type="text"
                                danger
                                size="small"
                                aria-label="Remove user"
                                icon={<Trash2 size={14} strokeWidth={2} />}
                                style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 6
                                }}
                            />
                        </Tooltip>
                    </Popconfirm>
                </div>
            )
        }
    ], [roles, handleToggleStatus, handleDeleteUser]);

    if (loading && users.length === 0) {
        return <Spinner />;
    }

    // Selection Card Component
    const SelectionCard = ({ isChecked, onClick, icon: ItemIcon, iconBg, name, subtitle, readOnly = false, badge = null }) => (
        <div
            onClick={readOnly ? undefined : onClick}
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                background: isChecked ? 'var(--bg-info-subtle)' : 'var(--bc-white)',
                border: `2px solid ${isChecked ? 'var(--text-brand)' : badge ? 'var(--text-warning)' : 'var(--border-light)'}`,
                borderRadius: "var(--radius-md)",
                cursor: readOnly ? 'default' : 'pointer',
                transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
                if (!readOnly && !isChecked) {
                    e.currentTarget.style.borderColor = badge ? 'var(--text-warning)' : 'var(--border-medium)';
                    e.currentTarget.style.background = 'var(--bg-hover)';
                    e.currentTarget.style.transform = 'translateX(2px)';
                }
            }}
            onMouseLeave={(e) => {
                if (!readOnly && !isChecked) {
                    e.currentTarget.style.borderColor = badge ? 'var(--text-warning)' : 'var(--border-light)';
                    e.currentTarget.style.background = 'var(--bg-secondary)';
                    e.currentTarget.style.transform = 'translateX(0)';
                }
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                    width: 32, height: 32, borderRadius: "var(--radius-md)",
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isChecked ? (iconBg || 'var(--text-brand)') : badge ? 'var(--bg-warning-subtle)' : 'var(--bg-tertiary)',
                    color: isChecked ? 'var(--bc-white)' : badge ? 'var(--text-warning)' : 'var(--text-secondary)',
                    fontSize: 'var(--font-size-xs)', fontWeight: 600,
                    transition: 'all 0.2s'
                }}>
                    {ItemIcon ? <ItemIcon size={14} /> : name?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                    <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>{name}</div>
                    {subtitle && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginTop: 1 }}>{subtitle}</div>}
                    {badge && !isChecked && (
                        <div style={{
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--text-warning)',
                            marginTop: 3,
                            padding: '1px 6px',
                            background: 'var(--bg-warning-subtle)',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--bg-warning-subtle)',
                            display: 'inline-block'
                        }}>
                            {badge}
                        </div>
                    )}
                </div>
            </div>
            <div style={{
                width: 20, height: 20, borderRadius: '50%',
                border: `2px solid ${isChecked ? 'var(--text-brand)' : badge ? 'var(--text-warning)' : 'var(--border-medium)'}`,
                background: isChecked ? 'var(--text-brand)' : 'var(--bc-white)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s'
            }}>
                {isChecked && <Check size={12} color="var(--bc-white)" strokeWidth={3} />}
            </div>
        </div>
    );

    return (
        <>
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.6; }
                }
                
                @keyframes shimmer {
                    0% { background-position: -1000px 0; }
                    100% { background-position: 1000px 0; }
                }
                
                .users-table .ant-table-tbody > tr:hover > td {
                    background: var(--bg-hover) !important;
                }
                
                .users-table .ant-table-thead > tr > th {
                    background: var(--bg-hover) !important;
                    color: var(--text-secondary) !important;
                    font-weight: 700 !important;
                    font-size: 11px !important;
                    text-transform: uppercase !important;
                    letter-spacing: 0.05em !important;
                    border-bottom: 2px solid var(--border-light) !important;
                }
                
                .users-table .ant-table-tbody > tr > td {
                    padding: 14px 16px !important;
                }
                
                .stat-card-enter {
                    animation: slideUp 0.4s ease forwards;
                }
                
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>

            <div style={{ background: 'var(--bg-secondary)', minHeight: 'calc(100vh - 60px)' }}>
                {messageContextHolder}
                {notificationContextHolder}

                {/* Page Header */}
                <div style={{
                    padding: '20px clamp(16px, 2.2vw, 28px)',
                    borderBottom: '1px solid var(--border-light)',
                    background: 'var(--bg-secondary)'
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: 20,
                        flexWrap: 'wrap'
                    }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                marginBottom: 6,
                                flexWrap: 'wrap'
                            }}>
                                <h2 style={{
                                    fontSize: 'var(--font-size-xl)',
                                    fontWeight: 600,
                                    color: 'var(--text-primary)',
                                    margin: 0,
                                    letterSpacing: '-0.02em',
                                    lineHeight: 1.2
                                }}>
                                    Team Members
                                </h2>
                                <span style={{
                                    padding: '3px 10px',
                                    background: 'var(--bg-info-subtle)',
                                    color: 'var(--text-brand)',
                                    borderRadius: "var(--radius-lg)",
                                    fontSize: 'var(--font-size-xs)',
                                    fontWeight: 600,
                                    letterSpacing: '0.02em',
                                    border: '1px solid var(--border-light)'
                                }}>
                                    {totalRecordCount} {totalRecordCount === 1 ? 'Member' : 'Members'}
                                </span>
                            </div>
                            <p style={{
                                fontSize: 'var(--font-size-sm)',
                                color: 'var(--text-muted)',
                                margin: 0,
                                lineHeight: 1.5
                            }}>
                                Manage users, roles and permissions across your team
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
                            <Button
                                icon={<RefreshCw size={14} />}
                                onClick={loadUsers}
                                loading={loading}
                                style={{
                                    borderRadius: "var(--radius-md)",
                                    fontWeight: 600,
                                    fontSize: 'var(--font-size-sm)',
                                    height: 38,
                                    paddingInline: 16,
                                    border: '1px solid var(--border-light)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6
                                }}
                            >
                                Refresh
                            </Button>
                            {activeTab === 'users' ? (
                                <Button
                                    type="primary"
                                    icon={<UserPlus size={14} />}
                                    onClick={() => handleOpenUserModal()}
                                    style={{
                                        borderRadius: "var(--radius-md)",
                                        fontWeight: 600,
                                        fontSize: 'var(--font-size-sm)',
                                        height: 38,
                                        paddingInline: 18,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6
                                    }}
                                >
                                    Add User
                                </Button>
                            ) : (
                                <Button
                                    type="primary"
                                    icon={<Plus size={14} />}
                                    onClick={() => handleOpenRoleModal()}
                                    style={{
                                        borderRadius: "var(--radius-md)",
                                        fontWeight: 600,
                                        fontSize: 'var(--font-size-sm)',
                                        height: 38,
                                        paddingInline: 18,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6
                                    }}
                                >
                                    Create Role
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                <div style={{ padding: '20px clamp(16px, 2.2vw, 28px)' }}>
                    {/* Tab Switcher + Filters */}
                    <div style={{
                        background: 'var(--bg-secondary)',
                        borderRadius: "var(--radius-lg)",
                        border: '1px solid var(--border-light)',
                        padding: '14px 18px',
                        marginBottom: 20,
                        boxShadow: 'var(--shadow-xs)'
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 16
                        }}>
                            <Segmented
                                value={activeTab}
                                onChange={setActiveTab}
                                options={[
                                    {
                                        label: (
                                            <span style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 6,
                                                fontSize: 'var(--font-size-sm)',
                                                fontWeight: 600,
                                                padding: '2px 4px'
                                            }}>
                                                <Users size={14} /> Members
                                            </span>
                                        ),
                                        value: 'users'
                                    },
                                    {
                                        label: (
                                            <span style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 6,
                                                fontSize: 'var(--font-size-sm)',
                                                fontWeight: 600,
                                                padding: '2px 4px'
                                            }}>
                                                <Lock size={14} /> Permissions
                                            </span>
                                        ),
                                        value: 'roles'
                                    }
                                ]}
                                style={{
                                    background: 'var(--bg-tertiary)',
                                    padding: 4,
                                    borderRadius: "var(--radius-md)"
                                }}
                            />

                            {activeTab === 'users' ? (
                                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                                    <Input
                                        prefix={<Search size={14} style={{ color: 'var(--text-muted)' }} />}
                                        placeholder="Search users..."
                                        allowClear
                                        value={searchText}
                                        onChange={e => setSearchText(e.target.value)}
                                        style={{
                                            width: 260,
                                            borderRadius: "var(--radius-md)",
                                            height: 38
                                        }}
                                    />
                                    <Select
                                        placeholder="All Roles"
                                        allowClear
                                        value={selectedRole || undefined}
                                        onChange={v => { setSelectedRole(v || ''); setCurrentPage(1); }}
                                        style={{ width: 160 }}
                                        size="middle"
                                        suffixIcon={<SlidersHorizontal size={12} style={{ color: 'var(--text-muted)' }} />}
                                    >
                                        {roles.map(r => (
                                            <Option key={r._id || r.id} value={r.name || r.id}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span style={{
                                                        width: 8,
                                                        height: 8,
                                                        borderRadius: '50%',
                                                        background: r.color || 'var(--text-muted)',
                                                        flexShrink: 0
                                                    }} />
                                                    <span>{r.displayName}</span>
                                                </div>
                                            </Option>
                                        ))}
                                    </Select>
                                    <Select
                                        placeholder="All Status"
                                        allowClear
                                        value={selectedStatus || undefined}
                                        onChange={v => { setSelectedStatus(v !== undefined ? v : ''); setCurrentPage(1); }}
                                        style={{ width: 140 }}
                                        size="middle"
                                    >
                                        <Option value="true">
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text-success)', flexShrink: 0 }} />
                                                Active
                                            </span>
                                        </Option>
                                        <Option value="false">
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--border-medium)', flexShrink: 0 }} />
                                                Inactive
                                            </span>
                                        </Option>
                                    </Select>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                                    <Input
                                        prefix={<Search size={14} style={{ color: 'var(--text-muted)' }} />}
                                        placeholder="Search permissions..."
                                        allowClear
                                        value={permissionSearch}
                                        onChange={e => setPermissionSearch(e.target.value)}
                                        style={{ width: 240, borderRadius: "var(--radius-md)", height: 38 }}
                                    />
                                    <span
                                        aria-live="polite"
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 6,
                                            fontSize: 'var(--font-size-sm)',
                                            fontWeight: 600,
                                            color: hasUnsavedMatrixChanges ? 'var(--text-warning)' : 'var(--text-muted)',
                                            background: hasUnsavedMatrixChanges ? 'var(--bg-warning-subtle)' : 'transparent',
                                            border: hasUnsavedMatrixChanges ? '1px solid var(--border-light)' : '1px solid transparent',
                                            padding: '4px 10px',
                                            borderRadius: "var(--radius-lg)"
                                        }}
                                    >
                                        {hasUnsavedMatrixChanges
                                            ? `${dirtyRoleIds.size} unsaved ${dirtyRoleIds.size === 1 ? 'change' : 'changes'}`
                                            : 'All changes saved'}
                                    </span>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <Button
                                            onClick={handleDiscardMatrixChanges}
                                            disabled={!hasUnsavedMatrixChanges || matrixSaving}
                                            style={{
                                                borderRadius: "var(--radius-md)",
                                                fontWeight: 600,
                                                fontSize: 'var(--font-size-sm)',
                                                height: 38
                                            }}
                                        >
                                            Discard
                                        </Button>
                                        <Button
                                            type="primary"
                                            icon={<CheckCircle2 size={14} />}
                                            loading={matrixSaving}
                                            disabled={!hasUnsavedMatrixChanges}
                                            onClick={handleSaveMatrixPermissions}
                                            style={{
                                                borderRadius: "var(--radius-md)",
                                                fontWeight: 600,
                                                fontSize: 'var(--font-size-sm)',
                                                height: 38,
                                                paddingInline: 16,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 6
                                            }}
                                        >
                                            Save Changes
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                            {/* USERS TAB */}
                            {activeTab === 'users' && (
                        <>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                                gap: 16,
                                marginBottom: 20
                            }}>
                                {/* Card 1: Total Users */}
                                <div
                                    style={{
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-light)',
                                        borderRadius: "var(--radius-lg)",
                                        padding: '16px 20px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 14
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = 'var(--border-medium)';
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.04)';
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = 'var(--border-light)';
                                        e.currentTarget.style.boxShadow = 'none';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                    }}
                                >
                                    {/* Icon */}
                                    <div style={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: 10,
                                        background: 'var(--bg-info-subtle)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0
                                    }}>
                                        <Users size={22} color="var(--text-primary)" strokeWidth={2.2} />
                                    </div>

                                    {/* Content */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            fontSize: 'var(--font-size-xs)',
                                            fontWeight: 600,
                                            color: 'var(--text-muted)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            marginBottom: 4
                                        }}>
                                            Total Users
                                        </div>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'baseline',
                                            gap: 8
                                        }}>
                                            <div style={{
                                                fontSize: 26,
                                                fontWeight: 800,
                                                color: 'var(--text-primary)',
                                                lineHeight: 1,
                                                letterSpacing: '-0.02em'
                                            }}>
                                                {totalRecordCount}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Card 2: Active Users */}
                                <div
                                    style={{
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-light)',
                                        borderRadius: "var(--radius-lg)",
                                        padding: '16px 20px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 14
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = 'var(--border-medium)';
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.04)';
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = 'var(--border-light)';
                                        e.currentTarget.style.boxShadow = 'none';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                    }}
                                >
                                    {/* Icon */}
                                    <div style={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: 10,
                                        background: 'var(--bg-success-subtle)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                        position: 'relative'
                                    }}>
                                        <UserCheck size={22} color="var(--text-success)" strokeWidth={2.2} />
                                        {activeCount > 0 && (
                                            <span style={{
                                                position: 'absolute',
                                                top: -2,
                                                right: -2,
                                                width: 10,
                                                height: 10,
                                                borderRadius: '50%',
                                                background: 'var(--text-success)',
                                                border: '2px solid var(--bg-secondary)',
                                                animation: 'pulse 2s infinite'
                                            }} />
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            fontSize: 'var(--font-size-xs)',
                                            fontWeight: 600,
                                            color: 'var(--text-muted)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            marginBottom: 4
                                        }}>
                                            Active Users
                                        </div>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'baseline',
                                            gap: 8
                                        }}>
                                            <div style={{
                                                fontSize: 26,
                                                fontWeight: 800,
                                                color: 'var(--text-primary)',
                                                lineHeight: 1,
                                                letterSpacing: '-0.02em'
                                            }}>
                                                {activeCount}
                                            </div>
                                            <div style={{
                                                fontSize: 'var(--font-size-xs)',
                                                fontWeight: 600,
                                                color: 'var(--text-muted)'
                                            }}>
                                                {totalRecordCount > 0 ? Math.round((activeCount / totalRecordCount) * 100) : 0}%
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Card 3: Inactive Users */}
                                <div
                                    style={{
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-light)',
                                        borderRadius: "var(--radius-lg)",
                                        padding: '16px 20px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 14
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = 'var(--border-medium)';
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.04)';
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = 'var(--border-light)';
                                        e.currentTarget.style.boxShadow = 'none';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                    }}
                                >
                                    {/* Icon */}
                                    <div style={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: 10,
                                        background: 'var(--bg-danger-subtle)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0
                                    }}>
                                        <XCircle size={22} color="var(--text-danger)" strokeWidth={2.2} />
                                    </div>

                                    {/* Content */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            fontSize: 'var(--font-size-xs)',
                                            fontWeight: 600,
                                            color: 'var(--text-muted)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            marginBottom: 4
                                        }}>
                                            Inactive Users
                                        </div>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'baseline',
                                            gap: 8
                                        }}>
                                            <div style={{
                                                fontSize: 26,
                                                fontWeight: 800,
                                                color: 'var(--text-primary)',
                                                lineHeight: 1,
                                                letterSpacing: '-0.02em'
                                            }}>
                                                {inactiveCount}
                                            </div>
                                            {inactiveCount > 0 && (
                                                <div style={{
                                                    fontSize: 'var(--font-size-xs)',
                                                    fontWeight: 600,
                                                    color: 'var(--text-danger)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 2
                                                }}>
                                                    <AlertCircle size={11} strokeWidth={2.5} />
                                                    Review
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Enhanced Table */}
                            <div style={{
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-light)',
                                borderRadius: "var(--radius-lg)",
                                overflow: 'hidden',
                                boxShadow: 'var(--shadow-xs)'
                            }}>
                                <Table
                                    className="users-table"
                                    columns={columns}
                                    dataSource={users.map(u => ({ ...u, key: u._id || u.id }))}
                                    loading={loading}
                                    pagination={{
                                        current: currentPage,
                                        pageSize,
                                        total: totalRecords,
                                        showSizeChanger: true,
                                        pageSizeOptions: ['10', '20', '50', '100'],
                                        showTotal: (total, range) => (
                                            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                                                Showing <strong>{range[0]}-{range[1]}</strong> of <strong>{total}</strong> users
                                            </span>
                                        ),
                                        onChange: (page, size) => { setCurrentPage(page); if (size) setPageSize(size); },
                                        style: { padding: '16px 20px', margin: 0, borderTop: '1px solid var(--bg-tertiary)' }
                                    }}
                                    scroll={{ x: 1000 }}
                                    locale={{
                                        emptyText: (
                                            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                                                <div style={{
                                                    width: 80,
                                                    height: 80,
                                                    borderRadius: '50%',
                                                    background: 'var(--bg-tertiary)',
                                                    margin: '0 auto 16px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    <Users size={40} color="var(--border-medium)" />
                                                </div>
                                                <div style={{
                                                    fontSize: 'var(--font-size-lg)',
                                                    fontWeight: 600,
                                                    color: 'var(--text-muted)',
                                                    marginBottom: 6
                                                }}>
                                                    No users found
                                                </div>
                                                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: 16 }}>
                                                    Try adjusting your filters or add a new user
                                                </div>
                                                <Button
                                                    type="primary"
                                                    icon={<UserPlus size={14} />}
                                                    onClick={() => handleOpenUserModal()}
                                                    style={{ borderRadius: "var(--radius-md)" }}
                                                >
                                                    Add User
                                                </Button>
                                            </div>
                                        )
                                    }}
                                />
                            </div>
                        </>
                    )}

                    {/* PERMISSIONS TAB */}
                    {activeTab === 'roles' && (
                        <>
                            {Object.keys(filteredGroupedPermissions).length === 0 && (
                                <div style={{
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-light)',
                                    borderRadius: "var(--radius-lg)",
                                    padding: '56px 24px',
                                    textAlign: 'center'
                                }}>
                                    <div style={{
                                        width: 64,
                                        height: 64,
                                        borderRadius: '50%',
                                        background: 'var(--bg-tertiary)',
                                        margin: '0 auto 16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <Lock size={26} style={{ color: 'var(--text-muted)' }} />
                                    </div>
                                    <div style={{
                                        fontSize: 'var(--font-size-lg)',
                                        fontWeight: 600,
                                        color: 'var(--text-primary)',
                                        marginBottom: 6
                                    }}>
                                        {permissionSearch ? 'No matching permissions' : 'No permissions available'}
                                    </div>
                                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                                        {permissionSearch
                                            ? `Nothing matches "${permissionSearch}". Try a different search term.`
                                            : 'Permissions will appear here once they are defined for your roles.'}
                                    </div>
                                </div>
                            )}
                            {Object.entries(filteredGroupedPermissions).map(([category, perms]) => (
                            <div key={category} style={{
                                border: '1px solid var(--border-light)',
                                borderRadius: "var(--radius-lg)",
                                overflow: 'hidden',
                                marginBottom: 16,
                                boxShadow: 'var(--shadow-xs)',
                                background: 'var(--bg-secondary)'
                            }}>
                                <div style={{
                                    padding: '14px 20px',
                                    borderBottom: '1px solid var(--bg-tertiary)',
                                    background: 'var(--bg-hover)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10
                                }}>
                                    <div style={{
                                        width: 28,
                                        height: 28,
                                        borderRadius: 6,
                                        background: 'var(--bg-info-subtle)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <Shield size={14} style={{ color: 'var(--text-brand)' }} />
                                    </div>
                                    <span style={{
                                        fontWeight: 600,
                                        color: 'var(--text-primary)',
                                        fontSize: 'var(--font-size-sm)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em'
                                    }}>
                                        {category}
                                    </span>
                                    <span style={{
                                        fontSize: 'var(--font-size-xs)',
                                        fontWeight: 600,
                                        color: 'var(--text-secondary)',
                                        background: 'var(--bg-secondary)',
                                        padding: '2px 10px',
                                        borderRadius: "var(--radius-lg)",
                                        border: '1px solid var(--border-light)'
                                    }}>
                                        {perms.length} {perms.length === 1 ? 'permission' : 'permissions'}
                                    </span>
                                </div>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr>
                                                <th style={{
                                                    width: 260,
                                                    padding: '12px 20px',
                                                    fontSize: 'var(--font-size-xs)',
                                                    fontWeight: 600,
                                                    color: 'var(--text-muted)',
                                                    textAlign: 'left',
                                                    background: 'var(--bg-hover)',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.05em',
                                                    borderBottom: '1px solid var(--border-light)',
                                                    position: 'sticky',
                                                    left: 0,
                                                    zIndex: 2
                                                }}>
                                                    Role
                                                </th>
                                                {perms.map(p => (
                                                    <th key={p._id || p.id} style={{
                                                        padding: '12px 14px',
                                                        fontSize: 'var(--font-size-xs)',
                                                        fontWeight: 600,
                                                        color: 'var(--text-muted)',
                                                        textAlign: 'center',
                                                        minWidth: 130,
                                                        borderLeft: '1px solid var(--bg-tertiary)',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.04em',
                                                        background: 'var(--bg-hover)',
                                                        borderBottom: '1px solid var(--border-light)'
                                                    }}>
                                                        <Tooltip title={p.name}>{p.displayName}</Tooltip>
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {matrixRoles.map(role => {
                                                const rolePermIds = toPermissionIds(role.permissions);
                                                const roleColor = role.color || getRoleColor(role.name);
                                                const isDirty = dirtyRoleIds.has(role._id || role.id);
                                                return (
                                                    <tr
                                                        key={role._id || role.id}
                                                        style={{
                                                            borderBottom: '1px solid var(--bg-tertiary)',
                                                            transition: 'background 0.15s'
                                                        }}
                                                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                                                        onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                                                    >
                                                        <td style={{
                                                            padding: '12px 20px',
                                                            fontSize: 'var(--font-size-sm)',
                                                            fontWeight: 600,
                                                            color: 'var(--text-primary)',
                                                            background: 'var(--bg-hover)',
                                                            borderRight: '1px solid var(--border-light)',
                                                            position: 'sticky',
                                                            left: 0,
                                                            zIndex: 1
                                                        }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                                                    <span style={{
                                                                        width: 8,
                                                                        height: 8,
                                                                        borderRadius: '50%',
                                                                        background: roleColor,
                                                                        flexShrink: 0
                                                                    }} />
                                                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                        {role.displayName}
                                                                    </span>
                                                                    {isDirty && (
                                                                        <Tooltip title="Unsaved permission changes">
                                                                            <AlertCircle size={12} style={{ color: 'var(--text-warning)', flexShrink: 0 }} />
                                                                        </Tooltip>
                                                                    )}
                                                                    <span style={{
                                                                        fontSize: 'var(--font-size-xs)',
                                                                        fontWeight: 600,
                                                                        color: 'var(--text-muted)'
                                                                    }}>
                                                                        {rolePermIds.length}/{totalPermissionCount}
                                                                    </span>
                                                                </div>
                                                                <div style={{ display: 'flex', gap: 4 }}>
                                                                    <Button
                                                                        type="text"
                                                                        size="small"
                                                                        aria-label={`Edit ${role.displayName} role`}
                                                                        onClick={() => handleOpenRoleModal(role)}
                                                                        icon={<Pencil size={12} />}
                                                                        style={{ color: 'var(--text-secondary)' }}
                                                                    />
                                                                    {role.name !== 'super_admin' && (
                                                                        <Popconfirm
                                                                            title="Delete this role?"
                                                                            description="Users with this role will lose permissions."
                                                                            onConfirm={() => handleDeleteRole(role._id || role.id)}
                                                                            okButtonProps={{ danger: true }}
                                                                        >
                                                                            <Button
                                                                                type="text"
                                                                                danger
                                                                                size="small"
                                                                                aria-label={`Delete ${role.displayName} role`}
                                                                                icon={<Trash2 size={12} />}
                                                                            />
                                                                        </Popconfirm>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        {perms.map(perm => {
                                                            const isAssigned = rolePermIds.includes(perm._id || perm.id);
                                                            return (
                                                                <td key={perm._id || perm.id} style={{
                                                                    padding: '10px',
                                                                    textAlign: 'center',
                                                                    borderLeft: '1px solid var(--bg-tertiary)'
                                                                }}>
                                                                    <button
                                                                        type="button"
                                                                        role="checkbox"
                                                                        aria-checked={isAssigned}
                                                                        aria-label={`${perm.displayName} for ${role.displayName}`}
                                                                        onClick={() => handleToggleCellPermission(role._id || role.id, perm._id || perm.id)}
                                                                        style={{
                                                                            width: 22,
                                                                            height: 22,
                                                                            padding: 0,
                                                                            borderRadius: 6,
                                                                            border: `2px solid ${isAssigned ? 'var(--text-success)' : 'var(--border-medium)'}`,
                                                                            background: isAssigned ? 'var(--text-success)' : 'var(--bg-secondary)',
                                                                            display: 'inline-flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            cursor: 'pointer',
                                                                            transition: 'all 0.2s ease'
                                                                        }}
                                                                        onMouseEnter={(e) => {
                                                                            if (!isAssigned) {
                                                                                e.currentTarget.style.borderColor = 'var(--text-muted)';
                                                                                e.currentTarget.style.background = 'var(--bg-hover)';
                                                                            }
                                                                        }}
                                                                        onMouseLeave={(e) => {
                                                                            if (!isAssigned) {
                                                                                e.currentTarget.style.borderColor = 'var(--border-medium)';
                                                                                e.currentTarget.style.background = 'var(--bg-secondary)';
                                                                            }
                                                                        }}
                                                                    >
                                                                        {isAssigned && <Check size={12} strokeWidth={3} color="var(--bc-white)" />}
                                                                    </button>
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            ))}
                        </>
                    )}
                </div>

                {/* USER MODAL */}
                <Modal
                    title={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{
                                width: 36,
                                height: 36,
                                borderRadius: "var(--radius-md)",
                                background: 'var(--bg-info-subtle)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--text-brand)'
                            }}>
                                <UserCheck size={18} strokeWidth={2} />
                            </div>
                            <div>
                                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                                    {editingUser ? 'Edit User' : 'Add New User'}
                                </div>
                                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginTop: 2 }}>
                                    {editingUser ? 'Update user information' : 'Create a new team member'}
                                </div>
                            </div>
                        </div>
                    }
                    open={showUserModal}
                    onCancel={() => setShowUserModal(false)}
                    centered
                    destroyOnHidden
                    width={720}
                    styles={{
                        body: { padding: '20px 24px' },
                        header: { padding: '16px 24px', borderBottom: '1px solid var(--bg-tertiary)' }
                    }}
                    footer={[
                        <Button
                            key="cancel"
                            onClick={() => setShowUserModal(false)}
                            style={{ borderRadius: "var(--radius-md)", fontWeight: 600, fontSize: 'var(--font-size-sm)', height: 36 }}
                        >
                            Cancel
                        </Button>,
                        <Button
                            key="save"
                            type="primary"
                            onClick={handleSaveUser}
                            style={{
                                borderRadius: "var(--radius-md)",
                                fontWeight: 600,
                                fontSize: 'var(--font-size-sm)',
                                height: 36,
                                background: 'var(--bg-brand)',
                                border: 'none'
                            }}
                        >
                            {editingUser ? 'Save Changes' : 'Create User'}
                        </Button>
                    ]}
                >
                    <div style={{ maxHeight: '65vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0' }}>
                        {/* Basic Info */}
                        <div style={{ background: 'var(--bg-hover)', borderRadius: 10, padding: 18, border: '1px solid var(--bg-tertiary)' }}>
                            <div style={{
                                fontSize: 'var(--font-size-xs)',
                                fontWeight: 600,
                                color: 'var(--text-muted)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                marginBottom: 14,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6
                            }}>
                                <User size={12} />
                                Basic Information
                            </div>
                            <Row gutter={[12, 14]}>
                                <Col span={12}>
                                    <FieldLabel>First Name *</FieldLabel>
                                    <Input
                                        value={userFormData.firstName}
                                        onChange={e => setUserFormData({ ...userFormData, firstName: e.target.value })}
                                        placeholder="John"
                                        style={{ borderRadius: "var(--radius-md)", height: 38 }}
                                    />
                                </Col>
                                <Col span={12}>
                                    <FieldLabel>Last Name *</FieldLabel>
                                    <Input
                                        value={userFormData.lastName}
                                        onChange={e => setUserFormData({ ...userFormData, lastName: e.target.value })}
                                        placeholder="Doe"
                                        style={{ borderRadius: "var(--radius-md)", height: 38 }}
                                    />
                                </Col>
                                <Col span={12}>
                                    <FieldLabel>Email *</FieldLabel>
                                    <Input
                                        type="email"
                                        disabled={!!editingUser}
                                        value={userFormData.email}
                                        onChange={e => setUserFormData({ ...userFormData, email: e.target.value })}
                                        placeholder="user@example.com"
                                        prefix={<Mail size={14} style={{ color: 'var(--text-muted)' }} />}
                                        style={{ borderRadius: "var(--radius-md)", height: 38 }}
                                    />
                                </Col>
                                <Col span={12}>
                                    <FieldLabel>Phone</FieldLabel>
                                    <Input
                                        value={userFormData.phone}
                                        onChange={e => setUserFormData({ ...userFormData, phone: e.target.value })}
                                        placeholder="+91 12345 67890"
                                        prefix={<Phone size={14} style={{ color: 'var(--text-muted)' }} />}
                                        style={{ borderRadius: "var(--radius-md)", height: 38 }}
                                    />
                                </Col>
                                {!editingUser && (
                                    <Col span={24}>
                                        <FieldLabel>Password *</FieldLabel>
                                        <Input.Password
                                            value={userFormData.password}
                                            onChange={e => setUserFormData({ ...userFormData, password: e.target.value })}
                                            placeholder="Enter strong password"
                                            prefix={<Lock size={14} style={{ color: 'var(--text-muted)' }} />}
                                            style={{ borderRadius: "var(--radius-md)", height: 38 }}
                                        />
                                    </Col>
                                )}
                            </Row>
                        </div>

                        {/* Role */}
                        <div style={{ background: 'var(--bg-hover)', borderRadius: 10, padding: 18, border: '1px solid var(--bg-tertiary)' }}>
                            <div style={{
                                fontSize: 'var(--font-size-xs)',
                                fontWeight: 600,
                                color: 'var(--text-muted)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                marginBottom: 12,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6
                            }}>
                                <Shield size={12} />
                                Role Assignment *
                            </div>
                            <Select
                                style={{ width: '100%', borderRadius: "var(--radius-md)" }}
                                value={userFormData.role || undefined}
                                onChange={handleUserRoleChange}
                                placeholder="Select role"
                                size="large"
                            >
                                {roles.map(r => (
                                    <Option key={r._id || r.id} value={r._id || r.id}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{
                                                width: 8,
                                                height: 8,
                                                borderRadius: '50%',
                                                background: r.color || 'var(--text-secondary)'
                                            }} />
                                            {r.displayName}
                                        </div>
                                    </Option>
                                ))}
                            </Select>
                        </div>

                        {/* Supervisors */}
                        <div style={{ background: 'var(--bg-hover)', borderRadius: 10, padding: 18, border: '1px solid var(--bg-tertiary)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                    <div style={{
                                        fontSize: 'var(--font-size-xs)',
                                        fontWeight: 600,
                                        color: 'var(--text-muted)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6
                                    }}>
                                        <Users size={12} />
                                        Supervisors
                                    </div>
                                    <span style={{
                                        fontSize: 'var(--font-size-xs)',
                                        fontWeight: 600,
                                        color: 'var(--text-brand)',
                                        background: 'var(--bg-info-subtle)',
                                        padding: '2px 10px',
                                        borderRadius: "var(--radius-lg)"
                                    }}>
                                        {userFormData.supervisors.length} selected
                                    </span>
                                </div>
                                <Input
                                    prefix={<Search size={12} />}
                                    placeholder="Search supervisors..."
                                    value={modalSearchSupervisor}
                                    onChange={e => setModalSearchSupervisor(e.target.value)}
                                    style={{ borderRadius: "var(--radius-md)", marginBottom: 10 }}
                                />
                                <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {filteredSupervisors.map(m => {
                                        const id = m._id || m.id;
                                        const checked = userFormData.supervisors.includes(id);
                                        return (
                                            <SelectionCard
                                                key={id}
                                                isChecked={checked}
                                                name={`${m.firstName} ${m.lastName}`}
                                                subtitle={m.role?.displayName || 'Manager'}
                                                onClick={() => setUserFormData({
                                                    ...userFormData,
                                                    supervisors: checked
                                                        ? userFormData.supervisors.filter(i => i !== id)
                                                        : [...userFormData.supervisors, id]
                                                })}
                                            />
                                        );
                                    })}
                                    {filteredSupervisors.length === 0 && (
                                        <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
                                            No supervisors found
                                        </div>
                                    )}
                                </div>
                            </div>

                        {/* Brand Managers (for Listing Team) */}
                        {isListingTeam && (
                            <div style={{ background: 'var(--bg-hover)', borderRadius: 10, padding: 18, border: '1px solid var(--bg-tertiary)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                    <div style={{
                                        fontSize: 'var(--font-size-xs)',
                                        fontWeight: 600,
                                        color: 'var(--text-muted)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6
                                    }}>
                                        <Briefcase size={12} />
                                        Brand Managers
                                    </div>
                                    <span style={{
                                        fontSize: 'var(--font-size-xs)',
                                        fontWeight: 600,
                                        color: 'var(--text-brand)',
                                        background: 'var(--bg-info-subtle)',
                                        padding: '2px 10px',
                                        borderRadius: "var(--radius-lg)"
                                    }}>
                                        {userFormData.brandManagers.length} linked
                                    </span>
                                </div>
                                <Input
                                    prefix={<Search size={12} />}
                                    placeholder="Search brand managers..."
                                    value={modalSearchBrandManager}
                                    onChange={e => setModalSearchBrandManager(e.target.value)}
                                    style={{ borderRadius: "var(--radius-md)", marginBottom: 10 }}
                                />
                                <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {filteredBrandManagers.map(m => {
                                        const id = m._id || m.id;
                                        const checked = userFormData.brandManagers.includes(id);
                                        return (
                                            <SelectionCard
                                                key={id}
                                                isChecked={checked}
                                                name={`${m.firstName} ${m.lastName}`}
                                                subtitle={m.email}
                                                onClick={() => setUserFormData({
                                                    ...userFormData,
                                                    brandManagers: checked
                                                        ? userFormData.brandManagers.filter(i => i !== id)
                                                        : [...userFormData.brandManagers, id]
                                                })}
                                            />
                                        );
                                    })}
                                    {filteredBrandManagers.length === 0 && (
                                        <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
                                            No brand managers found
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Brands */}
                        <div style={{ background: 'var(--bg-hover)', borderRadius: 10, padding: 18, border: '1px solid var(--bg-tertiary)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                <div style={{
                                    fontSize: 'var(--font-size-xs)',
                                    fontWeight: 600,
                                    color: 'var(--text-muted)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6
                                }}>
                                    <Store size={12} />
                                    Assigned Brands
                                </div>
                                <span style={{
                                    fontSize: 'var(--font-size-xs)',
                                    fontWeight: 600,
                                    color: 'var(--text-success)',
                                    background: 'var(--bg-success-subtle)',
                                    padding: '2px 10px',
                                    borderRadius: "var(--radius-lg)"
                                }}>
                                    {(isListingTeam ? inheritedSellers : userFormData.assignedSellers).length} brands
                                </span>
                            </div>

                            {isListingTeam && (
                                <div style={{
                                    background: 'var(--bg-info-subtle)',
                                    border: '1px solid var(--border-light)',
                                    borderRadius: "var(--radius-md)",
                                    padding: '10px 14px',
                                    marginBottom: 12,
                                    fontSize: 'var(--font-size-sm)',
                                    color: 'var(--text-brand)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8
                                }}>
                                    <Info size={14} />
                                    Brands are automatically inherited from assigned brand managers.
                                </div>
                            )}
                            {isCatalogManager && (
                                <div style={{
                                    background: 'var(--bg-warning-subtle)',
                                    border: '1px solid var(--bg-warning-subtle)',
                                    borderRadius: "var(--radius-md)",
                                    padding: '10px 14px',
                                    marginBottom: 12,
                                    fontSize: 'var(--font-size-sm)',
                                    color: 'var(--text-warning)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8
                                }}>
                                    <AlertCircle size={14} />
                                    Read-only access. Brand associations cannot be modified for this role.
                                </div>
                            )}

                            {!isListingTeam && (
                                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                                    <Input
                                        prefix={<Search size={12} />}
                                        placeholder="Search brands..."
                                        value={modalSearchSeller}
                                        onChange={e => setModalSearchSeller(e.target.value)}
                                        style={{ borderRadius: "var(--radius-md)", flex: 1 }}
                                    />
                                    <Button
                                        onClick={() => setUserFormData({ ...userFormData, assignedSellers: sellers.map(s => s._id || s.id) })}
                                        style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, borderRadius: "var(--radius-md)" }}
                                    >
                                        Select All
                                    </Button>
                                    <Button
                                        onClick={() => setUserFormData({ ...userFormData, assignedSellers: [] })}
                                        style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, borderRadius: "var(--radius-md)" }}
                                    >
                                        Clear
                                    </Button>
                                </div>
                            )}

                            <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {filteredSellers.map(s => {
                                    const id = s._id || s.id;
                                    const checked = isListingTeam ? true : userFormData.assignedSellers.includes(id);
                                    const owners = brandOwnershipMap[id];
                                    const badgeText = !checked && owners?.length
                                        ? `Assigned to ${owners.length === 1 ? owners[0] : `${owners[0]} +${owners.length - 1} more`}`
                                        : null;
                                    return (
                                        <SelectionCard
                                            key={id}
                                            isChecked={checked}
                                            readOnly={isListingTeam}
                                            icon={Store}
                                            iconBg="var(--text-success)"
                                            name={s.name}
                                            subtitle={s.code || 'Brand'}
                                            badge={badgeText}
                                            onClick={() => {
                                                if (isListingTeam) return;
                                                setUserFormData({
                                                    ...userFormData,
                                                    assignedSellers: checked
                                                        ? userFormData.assignedSellers.filter(i => i !== id)
                                                        : [...userFormData.assignedSellers, id]
                                                });
                                            }}
                                        />
                                    );
                                })}
                                {filteredSellers.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
                                        {isListingTeam ? 'Link brand managers to see brands' : 'No brands found'}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </Modal>

                {/* ROLE MODAL */}
                <Modal
                    title={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{
                                width: 36,
                                height: 36,
                                borderRadius: "var(--radius-md)",
                                background: 'var(--bg-info-subtle)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--text-brand)'
                            }}>
                                <Shield size={18} strokeWidth={2} />
                            </div>
                            <div>
                                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {editingRole ? 'Edit Role' : 'Create New Role'}
                                </div>
                                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginTop: 2 }}>
                                    {editingRole ? 'Modify role configuration' : 'Define a new role'}
                                </div>
                            </div>
                        </div>
                    }
                    open={showRoleModal}
                    onCancel={() => setShowRoleModal(false)}
                    centered
                    destroyOnHidden
                    width={500}
                    footer={[
                        <Button
                            key="cancel"
                            onClick={() => setShowRoleModal(false)}
                            style={{ borderRadius: "var(--radius-md)", fontWeight: 600, fontSize: 'var(--font-size-sm)', height: 36 }}
                        >
                            Cancel
                        </Button>,
                        <Button
                            key="save"
                            type="primary"
                            onClick={handleSaveRole}
                            style={{
                                borderRadius: "var(--radius-md)",
                                fontWeight: 600,
                                fontSize: 'var(--font-size-sm)',
                                height: 36,
                                background: 'var(--bg-brand)',
                                border: 'none'
                            }}
                        >
                            {editingRole ? 'Save Changes' : 'Create Role'}
                        </Button>
                    ]}
                >
                    <div style={{ padding: '12px 0' }}>
                        <div style={{ marginBottom: 16 }}>
                            <FieldLabel>Role Identifier</FieldLabel>
                            <Input
                                disabled={!!editingRole}
                                placeholder="e.g. analyst_l2"
                                value={roleFormData.name}
                                onChange={e => setRoleFormData({ ...roleFormData, name: e.target.value })}
                                style={{ borderRadius: "var(--radius-md)", height: 38 }}
                            />
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <FieldLabel>Display Name *</FieldLabel>
                            <Input
                                placeholder="e.g. Senior Analyst"
                                value={roleFormData.displayName}
                                onChange={e => setRoleFormData({ ...roleFormData, displayName: e.target.value })}
                                style={{ borderRadius: "var(--radius-md)", height: 38 }}
                            />
                        </div>
                        <Row gutter={12} style={{ marginBottom: 16 }}>
                            <Col span={12}>
                                <FieldLabel>Access Level (0-100)</FieldLabel>
                                <Input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={roleFormData.level}
                                    onChange={e => setRoleFormData({ ...roleFormData, level: parseInt(e.target.value) || 0 })}
                                    style={{ borderRadius: "var(--radius-md)", height: 38 }}
                                />
                            </Col>
                            <Col span={12}>
                                <FieldLabel>Color</FieldLabel>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Input
                                        type="color"
                                        value={roleFormData.color}
                                        onChange={e => setRoleFormData({ ...roleFormData, color: e.target.value })}
                                        style={{
                                            width: 50,
                                            height: 38,
                                            padding: 4,
                                            cursor: 'pointer',
                                            borderRadius: "var(--radius-md)"
                                        }}
                                    />
                                    <span style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                                        {roleFormData.color}
                                    </span>
                                </div>
                            </Col>
                        </Row>
                        <div>
                            <FieldLabel>Description</FieldLabel>
                            <TextArea
                                rows={3}
                                placeholder="Describe role responsibilities..."
                                value={roleFormData.description}
                                onChange={e => setRoleFormData({ ...roleFormData, description: e.target.value })}
                                style={{ borderRadius: "var(--radius-md)" }}
                            />
                        </div>
                    </div>
                </Modal>

                {/* EMAIL MODAL */}
                <Modal
                    title={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Mail size={16} color="var(--bc-white)" />
                            </div>
                            <div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Send Email</div>
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                    To: {emailUser?.firstName} {emailUser?.lastName}
                                </div>
                            </div>
                        </div>
                    }
                    open={showEmailModal}
                    onCancel={() => setShowEmailModal(false)}
                    centered
                    destroyOnHidden
                    width={540}
                    footer={[
                        <Button key="cancel" onClick={() => setShowEmailModal(false)}
                            style={{ borderRadius: 8, fontWeight: 600, fontSize: 12, height: 36 }}>
                            Cancel
                        </Button>,
                        <Button key="send" type="primary" loading={sendingEmail} onClick={handleSendEmailSubmit}
                            icon={<Send size={14} />}
                            style={{ borderRadius: 8, fontWeight: 600, fontSize: 12, height: 36, background: 'var(--text-primary)' }}>
                            Send Email
                        </Button>
                    ]}
                >
                    <div style={{ padding: '8px 0' }}>
                        {/* Email Type Selector */}
                        <div style={{ marginBottom: 16 }}>
                            <FieldLabel>Email Type</FieldLabel>
                            <Select
                                value={emailForm.type || 'custom'}
                                onChange={val => {
                                    if (val === 'credentials') {
                                        setEmailForm({
                                            type: 'credentials',
                                            subject: 'Your RetailOps Account Credentials',
                                            message: `Hi ${emailUser?.firstName},\n\nYour RetailOps account has been created. Below are your login credentials:\n\nEmail: ${emailUser?.email}\nPassword: [Temporary Password]\nDashboard: https://data.brandcentral.in\n\nPlease change your password after first login for security.\n\nBest regards,\nRetailOps Team`
                                        });
                                    } else if (val === 'welcome') {
                                        setEmailForm({
                                            type: 'welcome',
                                            subject: 'Welcome to RetailOps',
                                            message: `Hi ${emailUser?.firstName},\n\nWelcome to RetailOps! Your account has been set up and you're ready to start.\n\nHere's what you can do:\n- Access your dashboard at https://data.brandcentral.in\n- View and manage your assigned sellers\n- Track ASIN performance and analytics\n- Collaborate with your team\n\nIf you have any questions, feel free to reach out.\n\nBest regards,\nRetailOps Team`
                                        });
                                    } else {
                                        setEmailForm({ ...emailForm, type: val });
                                    }
                                }}
                                style={{ borderRadius: 8 }}
                                options={[
                                    { value: 'credentials', label: 'Send Credentials (with password)' },
                                    { value: 'welcome', label: 'Welcome Email' },
                                    { value: 'custom', label: 'Custom Message' }
                                ]}
                            />
                        </div>

                        {/* Recipient */}
                        <div style={{ marginBottom: 16 }}>
                            <FieldLabel>To</FieldLabel>
                            <Input
                                value={emailUser?.email}
                                disabled
                                prefix={<Mail size={14} style={{ color: 'var(--text-muted)' }} />}
                                style={{ borderRadius: 8, height: 40, background: 'var(--bg-hover)' }}
                            />
                        </div>

                        {/* Subject */}
                        <div style={{ marginBottom: 16 }}>
                            <FieldLabel>Subject *</FieldLabel>
                            <Input
                                placeholder="Enter subject"
                                value={emailForm.subject}
                                onChange={e => setEmailForm({ ...emailForm, subject: e.target.value })}
                                style={{ borderRadius: 8, height: 40 }}
                            />
                        </div>

                        {/* Message */}
                        <div>
                            <FieldLabel>Message *</FieldLabel>
                            <Input.TextArea
                                rows={8}
                                placeholder="Write your message..."
                                value={emailForm.message}
                                onChange={e => setEmailForm({ ...emailForm, message: e.target.value })}
                                style={{ borderRadius: 8 }}
                            />
                        </div>

                        {/* Info Note */}
                        {emailForm.type === 'credentials' && (
                            <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg-warning-subtle)', borderRadius: 8, border: '1px solid var(--bg-warning-subtle)' }}>
                                <Text style={{ fontSize: 11, color: 'var(--text-warning)' }}>
                                    ℹ️ This will send the user their login credentials. Make sure to set a temporary password when creating the user.
                                </Text>
                            </div>
                        )}
                    </div>
                </Modal>

                {/* USER PROFILE DRAWER */}
                <Drawer
                    title={null}
                    placement="right"
                    width={520}
                    open={showProfileDrawer}
                    onClose={() => setShowProfileDrawer(false)}
                    styles={{ body: { padding: 0 } }}
                >
                    {profileUser && (
                        <div>
                            {/* Profile Header */}
                            <div style={{
                                background: 'var(--bg-brand)',
                                padding: '32px 24px',
                                color: 'var(--bc-white)',
                                position: 'relative'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <EnhancedAvatar
                                        firstName={profileUser.firstName}
                                        lastName={profileUser.lastName}
                                        size={72}
                                        showStatus={true}
                                        isOnline={formatLastActive(profileUser.lastSeen).isOnline}
                                    />
                                    <div>
                                        <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>
                                            {profileUser.firstName} {profileUser.lastName}
                                        </div>
                                        <div style={{ fontSize: 'var(--font-size-sm)', opacity: 0.9, display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <Mail size={12} />
                                            {profileUser.email}
                                        </div>
                                        {profileUser.phone && (
                                            <div style={{ fontSize: 'var(--font-size-sm)', opacity: 0.9, display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                                <Phone size={12} />
                                                {profileUser.phone}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Profile Content */}
                            <div style={{ padding: 24 }}>
                                {/* Role Section */}
                                <div style={{ marginBottom: 24 }}>
                                    <div style={{
                                        fontSize: 'var(--font-size-xs)',
                                        fontWeight: 600,
                                        color: 'var(--text-secondary)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        marginBottom: 10
                                    }}>
                                        Role
                                    </div>
                                    <RoleBadge role={
                                        roles.find(r => (r._id || r.id) === (profileUser.role?._id || profileUser.role?.id || profileUser.role))
                                        || (typeof profileUser.role === 'object' ? profileUser.role : null)
                                    } />
                                </div>

                                {/* Status */}
                                <div style={{ marginBottom: 24 }}>
                                    <div style={{
                                        fontSize: 'var(--font-size-xs)',
                                        fontWeight: 600,
                                        color: 'var(--text-secondary)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        marginBottom: 10
                                    }}>
                                        Status
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <Switch
                                            checked={profileUser.isActive}
                                            onChange={() => {
                                                handleToggleStatus(profileUser._id || profileUser.id);
                                                setProfileUser({ ...profileUser, isActive: !profileUser.isActive });
                                            }}
                                        />
                                        <span style={{
                                            fontSize: 'var(--font-size-base)',
                                            fontWeight: 600,
                                            color: profileUser.isActive ? 'var(--text-success)' : 'var(--text-secondary)'
                                        }}>
                                            {profileUser.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                </div>

                                {/* Last Active */}
                                <div style={{ marginBottom: 24 }}>
                                    <div style={{
                                        fontSize: 'var(--font-size-xs)',
                                        fontWeight: 600,
                                        color: 'var(--text-secondary)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        marginBottom: 10
                                    }}>
                                        Last Active
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Clock size={14} style={{ color: 'var(--text-secondary)' }} />
                                        <span style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-primary)' }}>
                                            {profileUser.lastSeen ? new Date(profileUser.lastSeen).toLocaleString() : 'Never logged in'}
                                        </span>
                                    </div>
                                </div>

                                {/* Supervisors */}
                                {profileUser.supervisors && profileUser.supervisors.length > 0 && (
                                    <div style={{ marginBottom: 24 }}>
                                        <div style={{
                                            fontSize: 'var(--font-size-xs)',
                                            fontWeight: 600,
                                            color: 'var(--text-secondary)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            marginBottom: 10
                                        }}>
                                            Supervisors ({profileUser.supervisors.length})
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            {profileUser.supervisors.map((s, i) => (
                                                <div key={i} style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 10,
                                                    padding: 10,
                                                    background: 'var(--bg-hover)',
                                                    borderRadius: "var(--radius-md)",
                                                    border: '1px solid var(--bg-tertiary)'
                                                }}>
                                                    <EnhancedAvatar firstName={s.firstName} lastName={s.lastName} size={32} />
                                                    <div>
                                                        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                            {s.firstName} {s.lastName}
                                                        </div>
                                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                                                            {s.email}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Actions */}
                                <div style={{
                                    display: 'flex',
                                    gap: 8,
                                    marginTop: 24,
                                    paddingTop: 20,
                                    borderTop: '1px solid var(--bg-tertiary)'
                                }}>
                                    <Button
                                        icon={<Send size={14} />}
                                        onClick={() => {
                                            setShowProfileDrawer(false);
                                            handleSendEmail(profileUser);
                                        }}
                                        style={{ flex: 1, borderRadius: "var(--radius-md)", fontWeight: 600 }}
                                    >
                                        Send Email
                                    </Button>
                                    <Button
                                        type="primary"
                                        icon={<Pencil size={14} />}
                                        onClick={() => {
                                            setShowProfileDrawer(false);
                                            handleOpenUserModal(profileUser);
                                        }}
                                        style={{
                                            flex: 1,
                                            borderRadius: "var(--radius-md)",
                                            fontWeight: 600,
                                            background: 'var(--bg-brand)',
                                            border: 'none'
                                        }}
                                    >
                                        Edit User
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </Drawer>
            </div>
        </>
    );
};

export default UsersPage;