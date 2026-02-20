import React from 'react';
import { useAuth } from '../contexts/AuthContext';

/**
 * PermissionGate Component
 * 
 * Usage:
 * <PermissionGate permission="users_view">
 *   <UsersList />
 * </PermissionGate>
 * 
 * Or with multiple permissions (any):
 * <PermissionGate permission={['users_view', 'roles_view']}>
 *   <AdminDashboard />
 * </PermissionGate>
 */
const PermissionGate = ({
    children,
    permission,
    fallback = null,
    showIfAdmin = true
}) => {
    const { hasPermission, hasAnyPermission, isAdmin } = useAuth();

    if (showIfAdmin && isAdmin) {
        return <>{children}</>;
    }

    const hasAccess = Array.isArray(permission)
        ? hasAnyPermission(permission)
        : hasPermission(permission);

    if (!hasAccess) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
};

export default PermissionGate;
