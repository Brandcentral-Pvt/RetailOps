// contexts/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../services/api';
import { AuthRequestError, safeAuthError } from '../services/authRequest';

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadingPermissions, setLoadingPermissions] = useState(false);   // ← NEW
    const [bootstrapping, setBootstrapping] = useState(false);
    const [error, setError] = useState(null);

    // Helper to normalize user object
    const normalizeUser = (raw) => ({
        ...raw,
        firstName: raw.firstName || raw.FirstName,
        lastName: raw.lastName || raw.LastName,
        fullName: raw.fullName || `${raw.firstName || raw.FirstName || ''} ${raw.lastName || raw.LastName || ''}`.trim(),
        role: typeof raw.role === 'object'
            ? {
                ...raw.role,
                name: raw.role.name || raw.role.Name,
                displayName: raw.role.displayName || raw.role.DisplayName || raw.role.Name,
            }
            : { name: raw.role, displayName: raw.role },
    });

    // ----- Restore session on mount -----
    useEffect(() => {
        const initAuth = async () => {
            try {
                const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/auth/me`, {
                    headers: {
                        // Token is now sent automatically via httpOnly cookie
                    },
                });
                if (response.ok) {
                    const result = await response.json();
                    if (result.success && result.data) {
                        const normalized = normalizeUser(result.data);
                        setUser(normalized);
                        localStorage.setItem('user', JSON.stringify(normalized));
                    } else throw new Error('Invalid user data');
                } else throw new Error('Session expired');
            } catch (err) {
                console.warn('Auth initialization warning:', err.message);
                localStorage.removeItem('user');
                setUser(null);
            }
            setLoading(false);
        };
        initAuth();
    }, []);

    // ----- Login -----
    // The authentication screen defers session publication until its success
    // transition. Other callers retain the normal immediate-login behavior.
    const login = async (email, password, options = {}) => {
        setBootstrapping(true);
        setError(null);
        try {
            const result = await authApi.login(email, password, { ...options, deferSession: true });
            if (!result.requiresOtp && !options.deferSession) await completeLogin(result);
            return result;
        } catch (err) {
            const safe = safeAuthError(err);
            if (!options.signal?.aborted) setError(safe.message);
            return { success: false, error: safe.message, ...safe };
        } finally {
            setBootstrapping(false);
        }
    };

    // ----- Register (same permission loading logic) -----
    const register = async (userData) => {
        try {
            setError(null);
            const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData),
            });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message || 'Registration failed');

            const { user: rawUser } = result.data;
            let normalized = normalizeUser(rawUser);
            if (normalized.permissions && normalized.permissions.length > 0) {
                setUser(normalized);
                localStorage.setItem('user', JSON.stringify(normalized));
            } else {
                setUser(normalized);
                setLoadingPermissions(true);
                try {
                    const meRes = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/auth/me`, {
                        credentials: 'same-origin',
                    });
                    if (meRes.ok) {
                        const meResult = await meRes.json();
                        if (meResult.success && meResult.data) {
                            const updated = normalizeUser({ ...normalized, permissions: meResult.data.permissions || [] });
                            setUser(updated);
                            localStorage.setItem('user', JSON.stringify(updated));
                        }
                    }
                } finally {
                    setLoadingPermissions(false);
                }
            }
            return { success: true };
        } catch (err) {
            setError(err.message);
            return { success: false, error: err.message };
        }
    };

    const logout = () => {
        setUser(null);
        setError(null);
        localStorage.removeItem('user');
        if (window.location.pathname !== '/login') {
            window.location.href = '/login';
        }
    };

    const refreshUser = (updatedUser) => {
        const normalized = normalizeUser(updatedUser);
        setUser(normalized);
        localStorage.setItem('user', JSON.stringify(normalized));
    };

    const hasPermission = (permissionName) => {
        if (!user) return false;
        const roleName = (user.role?.name || user.role || '').toString().toLowerCase();
        const isRoleAdmin = roleName === 'admin' || roleName === 'super_admin' || roleName === 'super admin' || roleName === 'supert admin' || roleName.includes('super') || roleName.includes('supert');
        if (isRoleAdmin) return true;
        
        // Priority 1: Check database/profile explicit permissions
        if (user.permissions && Array.isArray(user.permissions)) {
            if (user.permissions.includes(permissionName)) {
                return true;
            }
        }

        // Priority 2: Fall back to hardcoded default roles for operational manager
        if (roleName === 'operational_manager') {
            const excludedPermissions = [
                'settings_manage',
                'users_view',
                'users_manage',
                'roles_view',
                'roles_manage',
                'apikeys_manage'
            ];
            if (excludedPermissions.includes(permissionName)) {
                return false;
            }
            return true;
        }
        if (!user.role?.permissions) return false;
        return user.role.permissions.some(p => p.name === permissionName);
    };

    const hasAnyPermission = (permissionNames) => {
        if (!user || !user.role) return false;
        const roleName = (user.role?.name || user.role || '').toString().toLowerCase();
        const isRoleAdmin = roleName === 'admin' || roleName === 'super_admin' || roleName === 'super admin' || roleName === 'supert admin' || roleName.includes('super') || roleName.includes('supert');
        if (isRoleAdmin) return true;
        return permissionNames.some(name => hasPermission(name));
    };

    // ----- Complete Login (after OTP verification) -----
    const completeLogin = async (loginData) => {
        try {
            const { user: rawUser } = loginData.data || loginData;
            if (!rawUser) throw new AuthRequestError('SERVER_ERROR');
            const normalized = normalizeUser(rawUser);

            setUser(normalized);
            localStorage.setItem('user', JSON.stringify(normalized));

            // Tokens are now handled by httpOnly cookies


            // Check if setup wizard is needed
            if (loginData.requiresSetup || loginData.data?.requiresSetup) {
                // Will be handled by route protection
            }

            // Fetch permissions if missing
            if (!normalized.permissions || normalized.permissions.length === 0) {
                try {
                    const meRes = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/auth/me`, {
                        credentials: 'same-origin',
                    });
                    if (meRes.ok) {
                        const meResult = await meRes.json();
                        if (meResult.success && meResult.data) {
                            const updated = normalizeUser({ ...normalized, permissions: meResult.data.permissions || [] });
                            setUser(updated);
                            localStorage.setItem('user', JSON.stringify(updated));
                        }
                    }
                } catch (e) { console.warn('Permission fetch failed:', e.message); }
            }
        } catch {
            setUser(null);
            localStorage.removeItem('authToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
            throw new AuthRequestError('SERVER_ERROR');
        }
    };

    const value = {
        user,
        loading,
        loadingPermissions,
        bootstrapping,
        error,
        login,
        completeLogin,
        register,
        logout,
        refreshUser,
        hasPermission,
        hasAnyPermission,
        isAuthenticated: !!user,
        isAdmin: ['admin', 'super_admin', 'super admin', 'supert admin'].includes((user?.role?.name || user?.role || '').toString().toLowerCase()) || (user?.role?.name || user?.role || '').toString().toLowerCase().includes('super') || (user?.role?.name || user?.role || '').toString().toLowerCase().includes('supert'),
        isOperationalManager: (user?.role?.name || user?.role || '').toString().toLowerCase() === 'operational_manager',
        isGlobalUser: ['admin', 'super_admin', 'super admin', 'supert admin', 'operational_manager'].includes((user?.role?.name || user?.role || '').toString().toLowerCase()) || (user?.role?.name || user?.role || '').toString().toLowerCase().includes('super') || (user?.role?.name || user?.role || '').toString().toLowerCase().includes('supert'),
        isFirstLogin: !!user?.isFirstLogin,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};