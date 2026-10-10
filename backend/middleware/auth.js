const jwt = require('jsonwebtoken');
const { sql, getPool } = require('../database/db');
const config = require('../config/env');
const tokenBlacklist = require('../services/tokenBlacklistService');
const { isGlobalUserRole } = require('../utils/roleUtils');
const { deviceFingerprint } = require('../utils/requestFingerprint');
const { resolveAccessProfile } = require('../services/accessProfileService');
const eventBus = require('../services/eventBus');

/**
 * The route exceptions are intentionally narrow. This runs inside the common
 * bearer middleware, so it protects every feature router rather than relying
 * on each controller to remember a first-login/password-expiry check.
 */
function isCredentialMaintenanceRequest(req, allowSetupWizard) {
  const pathname = String(req.originalUrl || req.url || '').split('?')[0];
  if (/\/(?:api\/)?auth\/(me|logout|change-password|request-password-change|change-password-with-otp)$/.test(pathname)) {
    return true;
  }
  return allowSetupWizard && /\/(?:api\/)?setup-wizard\//.test(pathname);
}

/**
 * SQL-based authentication middleware.
 *
 * `resolveAccessProfile` is also used by /auth/login and /auth/me. Keeping a
 * single resolver makes the permissions the mobile app composes into its
 * navigation exactly match the permissions route middleware enforces.
 */
exports.authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  try {
    // Access token comes from the httpOnly cookie set at login. The Bearer
    // header stays supported for non-browser clients (mobile, integrations,
    // socket handshakes) that cannot rely on the cookie jar.
    const cookieToken = req.cookies?.accessToken;
    const headerToken =
      authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    const token = cookieToken || headerToken;

    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (await tokenBlacklist.isBlacklisted(token)) {
      return res.status(401).json({ success: false, message: 'Token revoked' });
    }

    const decoded = jwt.verify(token, config.jwt.secret);
    // A refresh token must never be accepted at an access-token endpoint when
    // JWT_REFRESH_SECRET intentionally falls back to JWT_SECRET in a legacy
    // deployment.
    if (decoded.type !== 'access') {
      return res.status(401).json({ success: false, message: 'Invalid access token' });
    }

    if (decoded.type !== 'access') {
      return res.status(401).json({ success: false, message: 'Invalid token type' });
    }

    if (await tokenBlacklist.isUserBlacklisted(decoded.userId, decoded.iat)) {
      return res.status(401).json({ success: false, message: 'Session invalidated' });
    }

    const pool = await getPool();
    const userResult = await pool.request()
      .input('id', sql.VarChar, decoded.userId)
      .query(`
        SELECT U.Id, U.Email, U.FirstName, U.LastName, U.Avatar, U.Phone, U.IsActive,
               U.RoleId, U.ExtraPermissions, U.ExcludedPermissions,
               U.PasswordExpiresAt, U.ForcePasswordReset, U.IsFirstLogin,
               U.SetupCompletedAt, U.SecurityPolicyAccepted, U.IsOnline, U.LastSeen,
               R.Name AS RoleName, R.DisplayName AS RoleDisplayName
        FROM Users U
        LEFT JOIN Roles R ON U.RoleId = R.Id
        WHERE U.Id = @id
      `);

    if (userResult.recordset.length === 0) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    const userData = userResult.recordset[0];
    if (!userData.IsActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated' });
    }

    if (decoded.fp && decoded.fp !== deviceFingerprint(req)) {
      console.warn(`[SECURITY] Fingerprint mismatch for user ${decoded.userId}`);
      if (process.env.NODE_ENV === 'production') {
        return res.status(401).json({ success: false, message: 'Session invalid: device mismatch' });
      }
    }

    const needsPasswordReset = Boolean(userData.ForcePasswordReset)
      || Boolean(userData.PasswordExpiresAt && new Date(userData.PasswordExpiresAt) < new Date());
    const requiresSetup = Boolean(userData.IsFirstLogin) && !userData.SetupCompletedAt;
    req.forcePasswordReset = needsPasswordReset;
    req.requiresSetup = requiresSetup;

    // UI routing is a convenience, not a security boundary. A client with a
    // temporary/expired credential must not call normal protected APIs by
    // bypassing the mobile setup screen. Leave only the authoritative session
    // read, logout and credential-maintenance endpoints reachable.
    if ((needsPasswordReset || requiresSetup) && !isCredentialMaintenanceRequest(req, requiresSetup)) {
      return res.status(428).json({
        success: false,
        code: 'CREDENTIAL_UPDATE_REQUIRED',
        message: 'Password update required before continuing',
      });
    }

    const access = await resolveAccessProfile(userData, pool);
    const permissions = access.permissions;

    req.userId = userData.Id;
    req.user = {
      Id: userData.Id,
      id: userData.Id,
      _id: userData.Id,
      Email: userData.Email,
      FirstName: userData.FirstName,
      LastName: userData.LastName,
      Avatar: userData.Avatar,
      Phone: userData.Phone,
      IsActive: userData.IsActive,
      IsOnline: userData.IsOnline,
      LastSeen: userData.LastSeen,
      role: access.role,
      assignedSellers: access.assignedSellers,
      sellers: access.sellers,
      scope: access.scope,
      permissions,
      hasPermission: async (permission) => permissions.includes(permission),
      hasAnyPermission: async (requested) => requested.some((permission) => permissions.includes(permission)),
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') return res.status(401).json({ success: false, message: 'Token expired. Please login again.' });
    if (error.name === 'JsonWebTokenError') return res.status(401).json({ success: false, message: 'Invalid token' });
    console.error('[AUTH] Authentication error:', error.message);
    res.status(500).json({ success: false, message: 'Authentication failed' });
  }
};

/** Require one effective permission. Admin access is data (`*`), not a role-name bypass. */
exports.requirePermission = (permissionName) => {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required' });
    const hasWildcard = await req.user.hasPermission('*');
    if (hasWildcard) return next();

    const hasPermission = await req.user.hasPermission(permissionName);
    if (!hasPermission) {
      eventBus.emit(eventBus.EVENTS.PERMISSION_DENIED, {
        userId: req.user?.Id,
        permission: permissionName,
        url: req.originalUrl,
        ip: req.ip,
      });
      return res.status(403).json({ success: false, message: 'Missing required permission' });
    }
    next();
  };
};

/** Require at least one effective permission. */
exports.requireAnyPermission = (permissionNames) => {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required' });
    const hasWildcard = await req.user.hasPermission('*');
    if (hasWildcard) return next();

    const hasAnyPermission = await req.user.hasAnyPermission(permissionNames);
    if (!hasAnyPermission) {
      eventBus.emit(eventBus.EVENTS.PERMISSION_DENIED, {
        userId: req.user?.Id,
        permission: permissionNames,
        url: req.originalUrl,
        ip: req.ip,
      });
      return res.status(403).json({ success: false, message: 'Missing required permissions' });
    }
    next();
  };
};

/** Role checks remain for legacy route contracts; new visibility uses permissions. */
exports.requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required' });
    const currentRole = req.user.role?.Name || req.user.role?.name || req.user.role;
    if (!roles.includes(currentRole)) return res.status(403).json({ success: false, message: 'Required role not found' });
    next();
  };
};

/** Check a requested seller is inside the server-resolved seller scope. */
exports.checkSellerAccess = async (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required' });

  const roleName = req.user.role?.Name || req.user.role?.name;
  if (isGlobalUserRole(roleName)) return next();

  const sellerId = req.params.id || req.params.sellerId || req.query?.sellerId;
  if (!sellerId) return next();

  if (!req.user.assignedSellers || !req.user.assignedSellers.includes(sellerId.toString())) {
    return res.status(403).json({ success: false, message: 'Access to this seller denied' });
  }
  next();
};

/** Check user hierarchy access for legacy people-management endpoints. */
exports.checkUserHierarchyAccess = async (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required' });

  const targetUserId = req.params.id;
  if (!targetUserId || req.user.Id === targetUserId || req.user._id === targetUserId) return next();

  const roleName = req.user.role?.Name || req.user.role?.name;
  if (isGlobalUserRole(roleName)) return next();

  const hasGlobalView = await req.user.hasPermission('users_view');
  if (hasGlobalView) return next();

  try {
    const pool = await getPool();
    const supervisorResult = await pool.request()
      .input('userId', sql.VarChar, targetUserId)
      .input('supervisorId', sql.VarChar, req.user.Id || req.user._id)
      .query('SELECT 1 FROM UserSupervisors WHERE UserId = @userId AND SupervisorId = @supervisorId');

    if (supervisorResult.recordset.length > 0) return next();

    res.status(403).json({ success: false, message: 'Access denied: User is not in your hierarchy' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Hierarchy check failed' });
  }
};

exports.auth = exports.authenticate;
exports.isAdmin = exports.requireRole('admin', 'super_admin');
exports.isGlobalUser = exports.requireRole('admin', 'super_admin', 'developer', 'operational_manager');
