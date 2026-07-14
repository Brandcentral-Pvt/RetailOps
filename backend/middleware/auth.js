const jwt = require('jsonwebtoken');
const { sql, getPool } = require('../database/db');
const config = require('../config/env');
const tokenBlacklist = require('../services/tokenBlacklistService');
const { isGlobalUserRole } = require('../utils/roleUtils');

/**
 * SQL-based Authentication Middleware
 */
exports.authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  try {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];

    if (await tokenBlacklist.isBlacklisted(token)) {
      return res.status(401).json({ success: false, message: 'Token revoked' });
    }

    const decoded = jwt.verify(token, config.jwt.secret);

    if (await tokenBlacklist.isUserBlacklisted(decoded.userId, decoded.iat)) {
      return res.status(401).json({ success: false, message: 'Session invalidated' });
    }

    const pool = await getPool();

    const userResult = await pool.request()
      .input('id', sql.VarChar, decoded.userId)
      .query(`
        SELECT U.Id, U.Email, U.FirstName, U.LastName, U.Avatar, U.IsActive,
               U.RoleId, U.ExtraPermissions, U.ExcludedPermissions,
               U.PasswordExpiresAt, U.IsOnline, U.LastSeen,
               R.Name as RoleName, R.DisplayName as RoleDisplayName 
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

    if (decoded.fp) {
      const currentFp = Buffer.from(`${req.headers['user-agent'] || ''}|${req.headers['x-forwarded-for'] || req.socket.remoteAddress || ''}`).toString('base64').slice(0, 32);
      if (decoded.fp !== currentFp) {
        console.warn(`[SECURITY] Fingerprint mismatch for user ${decoded.userId} from ${req.headers['x-forwarded-for'] || req.socket.remoteAddress}`);
        if (process.env.NODE_ENV === 'production') {
          return res.status(401).json({ success: false, message: 'Session invalid: device mismatch' });
        }
      }
    }

    if (userData.PasswordExpiresAt && new Date(userData.PasswordExpiresAt) < new Date()) {
      req.forcePasswordReset = true;
    }

    const permissionsResult = await pool.request()
      .input('roleId', sql.VarChar, userData.RoleId)
      .query(`
        SELECT P.Name 
        FROM Permissions P
        JOIN RolePermissions RP ON P.Id = RP.PermissionId
        WHERE RP.RoleId = @roleId
      `);
    let permissions = permissionsResult.recordset.map(p => p.Name);

    const allPermsResult = await pool.request().query('SELECT Id, Name FROM Permissions');
    const permMap = {};
    allPermsResult.recordset.forEach(p => {
      permMap[p.Id] = p.Name;
      permMap[p.Name] = p.Name;
    });

    let extraPerms = [];
    let exclPerms = [];
    try {
      if (userData.ExtraPermissions) {
        extraPerms = JSON.parse(userData.ExtraPermissions).map(idOrName => permMap[idOrName] || idOrName);
      }
    } catch (e) {
      console.error('Failed to parse ExtraPermissions:', e);
    }
    try {
      if (userData.ExcludedPermissions) {
        exclPerms = JSON.parse(userData.ExcludedPermissions).map(idOrName => permMap[idOrName] || idOrName);
      }
    } catch (e) {
      console.error('Failed to parse ExcludedPermissions:', e);
    }

    extraPerms.forEach(p => {
      if (p && !permissions.includes(p)) {
        permissions.push(p);
      }
    });
    permissions = permissions.filter(p => !exclPerms.includes(p));

    let assignedSellers = [];
    if (userData.RoleName === 'listing_team') {
      const bmSellersResult = await pool.request()
        .input('userId', sql.VarChar, userData.Id)
        .query(`
          SELECT DISTINCT SellerId FROM UserSellers WHERE UserId = @userId
          UNION
          SELECT DISTINCT US.SellerId 
          FROM UserSellers US
          JOIN UserBrandManagers UBM ON US.UserId = UBM.BrandManagerId
          WHERE UBM.UserId = @userId
        `);
      assignedSellers = bmSellersResult.recordset.map(s => s.SellerId);
    } else {
      const sellersResult = await pool.request()
        .input('userId', sql.VarChar, userData.Id)
        .query(`SELECT SellerId FROM UserSellers WHERE UserId = @userId`);
      assignedSellers = sellersResult.recordset.map(s => s.SellerId);
    }

    req.userId = userData.Id;
    req.user = {
      Id: userData.Id,
      _id: userData.Id,
      Email: userData.Email,
      FirstName: userData.FirstName,
      LastName: userData.LastName,
      Avatar: userData.Avatar,
      IsActive: userData.IsActive,
      IsOnline: userData.IsOnline,
      LastSeen: userData.LastSeen,
      role: {
        Name: userData.RoleName === 'super_admin' ? 'admin' : userData.RoleName,
        name: userData.RoleName === 'super_admin' ? 'admin' : userData.RoleName,
        DisplayName: userData.RoleDisplayName
      },
      assignedSellers: assignedSellers,
      permissions: permissions,
      hasPermission: async (perm) => permissions.includes(perm),
      hasAnyPermission: async (perms) => perms.some(p => permissions.includes(p))
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') return res.status(401).json({ success: false, message: 'Token expired. Please login again.' });
    if (error.name === 'JsonWebTokenError') return res.status(401).json({ success: false, message: 'Invalid token' });
    console.error('[AUTH] Authentication error:', error.message);
    res.status(500).json({ success: false, message: 'Authentication failed' });
  }
};

/**
 * Require Permission Middleware (SQL Version)
 */
exports.requirePermission = (permissionName) => {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required' });
    if (req.user.role?.name === 'admin' || req.user.role?.Name === 'admin' || req.user.role?.name === 'super_admin' || req.user.role?.Name === 'super_admin') return next();

    const hasPerm = await req.user.hasPermission(permissionName);
    if (!hasPerm) return res.status(403).json({ success: false, message: 'Missing required permission' });
    next();
  };
};

/**
 * Require Any Permission Middleware (SQL Version)
 */
exports.requireAnyPermission = (permissionNames) => {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required' });
    if (req.user.role?.name === 'admin' || req.user.role?.Name === 'admin' || req.user.role?.name === 'super_admin' || req.user.role?.Name === 'super_admin') return next();

    const hasAny = await req.user.hasAnyPermission(permissionNames);
    if (!hasAny) return res.status(403).json({ success: false, message: 'Missing required permissions' });
    next();
  };
};

/**
 * Require Role Middleware (SQL Version)
 */
exports.requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required' });
    const currentRole = req.user.role?.Name || req.user.role?.name || req.user.role;
    if (!roles.includes(currentRole)) return res.status(403).json({ success: false, message: 'Required role not found' });
    next();
  };
};

/**
 * Check Seller Access Middleware (SQL Version)
 */
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

/**
 * Check User Hierarchy Access Middleware (SQL Version)
 */
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
