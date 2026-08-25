// contexts/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { CometChatUIKit } from '@cometchat/chat-uikit-react';
import { authApi } from '../services/api';
import { queryClient } from '../lib/queryClient';
import { disconnectAll as disconnectRealtime } from '../services/realtimeService';
import { disconnectActiveSocket } from './SocketContext';
import { ADMIN_ROLES } from '../constants/permissions';
import { setRefreshToken, clearRefreshToken } from '../lib/authMemory';

const AuthContext = createContext(null);

// Every auth-relevant / audit-relevant key this app writes to storage.
// Cleared together on logout (grep-verified against src/).
const AUTH_STORAGE_KEYS = [
    'authToken',
    'refreshToken',
    'user',
    'fba_keepa_key',        // services/db.js saveKeepaKey
    'keepa-api-key',        // legacy slot read by services/keepaService.js
    'seller_hub_settings',  // legacy slot read by services/octoparseService.js
    'selectedSeller',       // useAdsFilters / AdsManagerPage / AsinManagerPage
    'selectedMarketplace',  // AsinManagerPage
    'dash-cache',           // store/dashboardStore.ts (zustand persist)
];

// Exact-match admin test for the current user's role name.
const isAdminRole = (user) => {
    const roleName = (user?.role?.name || user?.role || '').toString().toLowerCase();
    return ADMIN_ROLES.includes(roleName);
};

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
            const token = localStorage.getItem('authToken');
            if (token) {
                try {
                    const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/auth/me`, {
                        headers: { Authorization: `Bearer ${token}` },
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
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('user');
                    setUser(null);
                }
            } else {
                setUser(null);
            }
            setLoading(false);
        };
        initAuth();
    }, []);

    // ----- Login -----
    const login = async (email, password) => {
        const MIN_BOOTSTRAP_MS = 1500;
        const startTime = Date.now();
        setBootstrapping(true);
        setError(null);

        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message || 'Login failed');

            // OTP required — return OTP data without setting user
            if (result.requiresOtp) {
                setBootstrapping(false);
                return { success: true, requiresOtp: true, tempToken: result.tempToken, destination: result.destination, expiresIn: result.expiresIn };
            }

            // Trusted device or forcePasswordReset — return directly
            if (result.forcePasswordReset) {
                setBootstrapping(false);
                return { success: true, forcePasswordReset: true, reason: result.reason };
            }

            const { user: rawUser, accessToken } = result.data;
            let normalized = normalizeUser(rawUser);

            // If the login response already includes the permissions array, use it immediately.
            if (normalized.permissions && normalized.permissions.length > 0) {
                // Store first then trigger reactivity
                localStorage.setItem('authToken', accessToken);
                localStorage.setItem('user', JSON.stringify(normalized));
                setUser(normalized);
            } else {
                // Permissions missing – fetch them now
                localStorage.setItem('authToken', accessToken);
                setUser(normalized);                // set user without permissions
                setLoadingPermissions(true);        // start permission loading
                try {
                    const meRes = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/auth/me`, {
                        headers: { Authorization: `Bearer ${accessToken}` },
                    });
                    if (meRes.ok) {
                        const meResult = await meRes.json();
                        if (meResult.success && meResult.data) {
                            const updated = normalizeUser({ ...normalized, permissions: meResult.data.permissions || [] });
                            setUser(updated);
                            localStorage.setItem('user', JSON.stringify(updated));
                        }
                    }
                } catch (permErr) {
                    console.warn('Permission fetch failed:', permErr.message);
                } finally {
                    setLoadingPermissions(false);   // done loading permissions
                }
            }

            return { 
                success: true, 
                requiresSetup: result.requiresSetup, 
                needsPasswordReset: result.needsPasswordReset, 
                forcePasswordReset: result.forcePasswordReset 
            };
        } catch (err) {
            setError(err.message);
            return { success: false, error: err.message };
        } finally {
            const elapsed = Date.now() - startTime;
            const remaining = MIN_BOOTSTRAP_MS - elapsed;
            if (remaining > 0) {
                await new Promise(r => setTimeout(r, remaining));
            }
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

            const { user: rawUser, accessToken } = result.data;
            let normalized = normalizeUser(rawUser);
            if (normalized.permissions && normalized.permissions.length > 0) {
                setUser(normalized);
                localStorage.setItem('authToken', accessToken);
                localStorage.setItem('user', JSON.stringify(normalized));
            } else {
                setUser(normalized);
                localStorage.setItem('authToken', accessToken);
                setLoadingPermissions(true);
                try {
                    const meRes = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/auth/me`, {
                        headers: { Authorization: `Bearer ${accessToken}` },
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

    // ----- Logout (single teardown path for every caller) -----
    const logout = () => {
        // 1) Best-effort server revocation — never blocks the UI on failure.
        //    (authApi.logout reads the token synchronously, so call it before clearing storage.)
        try {
            Promise.resolve(authApi.logout()).catch(() => { /* revocation is best-effort */ });
        } catch { /* noop */ }

        // 2) Clear ALL auth/audit-relevant storage keys.
        AUTH_STORAGE_KEYS.forEach((key) => {
            try {
                localStorage.removeItem(key);
                sessionStorage.removeItem(key);
            } catch { /* storage may be unavailable */ }
        });
        clearRefreshToken();

        // 3) CometChat teardown — best-effort, non-blocking.
        try {
            Promise.resolve(CometChatUIKit.logout()).catch(() => { /* noop */ });
        } catch { /* UIKit may not be initialized */ }

        // 4) Socket teardown — realtimeService singleton + per-user SocketContext socket.
        try { disconnectRealtime(); } catch { /* noop */ }
        try { disconnectActiveSocket(); } catch { /* noop */ }

        // 5) Drop all cached React Query state (in-memory data from the dead session).
        try { queryClient.clear(); } catch { /* noop */ }

        setUser(null);
        setError(null);

        // 6) Full reload so every in-memory state dies with the session.
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
        const isRoleAdmin = ADMIN_ROLES.includes(roleName); // EXACT match only — see constants/permissions.js
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
        const isRoleAdmin = ADMIN_ROLES.includes(roleName); // EXACT match only — see constants/permissions.js
        if (isRoleAdmin) return true;
        return permissionNames.some(name => hasPermission(name));
    };

    // ----- Complete Login (after OTP verification) -----
    const completeLogin = async (loginData) => {
        try {
            const { user: rawUser, accessToken, refreshToken } = loginData.data || loginData;
            const normalized = normalizeUser(rawUser);

            // Store tokens
            localStorage.setItem('authToken', accessToken);
            // SECURITY: refresh token in memory only — httpOnly cookie carries it across reloads
            if (refreshToken) setRefreshToken(refreshToken);
            localStorage.setItem('user', JSON.stringify(normalized));
            setUser(normalized);

            // Check if setup wizard is needed
            if (loginData.requiresSetup || loginData.data?.requiresSetup) {
                // Will be handled by route protection
            }

            // Fetch permissions if missing
            if (!normalized.permissions || normalized.permissions.length === 0) {
                try {
                    const meRes = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/auth/me`, {
                        headers: { Authorization: `Bearer ${accessToken}` },
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
        } catch (err) {
            console.error('completeLogin error:', err);
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
        // EXACT match against ADMIN_ROLES — no substring leniency (see constants/permissions.js)
        isAdmin: isAdminRole(user),
        isOperationalManager: (user?.role?.name || user?.role || '').toString().toLowerCase() === 'operational_manager',
        isGlobalUser: isAdminRole(user) || (user?.role?.name || user?.role || '').toString().toLowerCase() === 'operational_manager',
        isFirstLogin: !!user?.isFirstLogin,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};