import React from 'react';
import { Navigate } from 'react-router-dom';
import { Alert, Button } from 'antd';
import { useAuth } from '../contexts/AuthContext';
import Spinner from './Spinner';

const ProtectedRoute = ({ children, permission, requiredRole }) => {
    const {
        isAuthenticated,
        sessionError,
        retrySession,
        loading,             // general auth loading (user still being fetched)
        loadingPermissions,  // true while permissions are loaded after login
        hasPermission,
        user,
    } = useAuth();

    // Still verifying the user’s session OR loading permissions
    if (loading || loadingPermissions) {
        return <Spinner fullPage tip="Verifying access..." />;
    }

    if (!isAuthenticated && sessionError) {
        return <main style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:24}}>
            <div style={{width:'100%',maxWidth:460}}>
                <Alert showIcon type="warning" message="Session verification unavailable" description={sessionError}
                    action={<Button onClick={retrySession}>Retry</Button>}/>
            </div>
        </main>;
    }
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    const currentPath = window.location.pathname;
    const roleName = (user?.role?.name || user?.role?.displayName || '').toString().toLowerCase().trim();
    const isBrandManager = roleName === 'brand manager' || roleName === 'brand_manager';

    // Automatic login redirection to authorized page for restricted roles
    if (currentPath === '/' || currentPath === '/dashboard') {
        if (!hasPermission('dashboard_view') && !isBrandManager) {
            return <Navigate to="/asin-tracker" replace />;
        }
    }

    // Role check
    if (requiredRole && user?.role?.name !== requiredRole) {
        return <Navigate to="/unauthorized" replace />;
    }

    // Permission check – only runs when permissions are fully loaded
    if (permission) {
        const permissionsToCheck = Array.isArray(permission) ? permission : [permission];
        
        // If checking monthlyreport_view, we also allow access for targets_view
        if (permissionsToCheck.includes('monthlyreport_view')) {
            permissionsToCheck.push('targets_view');
        }
        if (permissionsToCheck.includes('dashboard_view') && isBrandManager) {
            permissionsToCheck.push('targets_view');
        }

        const hasAccess = permissionsToCheck.some(p => hasPermission(p)) || (isBrandManager && (permissionsToCheck.includes('monthlyreport_view') || permissionsToCheck.includes('dashboard_view')));

        if (!hasAccess) {
            return <Navigate to="/unauthorized" replace />;
        }
    }

    return children;
};

export default ProtectedRoute;