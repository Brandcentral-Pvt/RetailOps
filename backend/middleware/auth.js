const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config/env');

// Demo mode bypass for development
const DEMO_MODE = process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'development';

exports.authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  // DEMO_MODE: only bypass auth when there is no real token provided
  if (DEMO_MODE && (!authHeader || !authHeader.startsWith('Bearer '))) {
    req.userId = 'demo-user';
    req.user = { _id: 'demo-user', role: { name: 'admin' }, assignedSellers: [] };
    return next();
  }

  try {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(token, config.jwtSecret);

    const user = await User.findById(decoded.userId)
      .populate('role')
      .populate('role.permissions')
      .populate('assignedSellers');

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated' });
    }

    req.userId = user._id;
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    console.error('Auth middleware error:', error);
    res.status(500).json({ success: false, message: 'Authentication failed' });
  }
};

exports.requirePermission = (permissionName) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      // Admin has all permissions
      if (req.user.role && req.user.role.name === 'admin') {
        return next();
      }

      const hasPermission = await req.user.hasPermission(permissionName);

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to perform this action'
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ success: false, message: 'Permission check failed' });
    }
  };
};

exports.requireAnyPermission = (permissionNames) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      // Admin has all permissions
      if (req.user.role && req.user.role.name === 'admin') {
        return next();
      }

      const hasPermission = await req.user.hasAnyPermission(permissionNames);

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to perform this action'
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ success: false, message: 'Permission check failed' });
    }
  };
};

exports.requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (!req.user.role || !roles.includes(req.user.role.name)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have the required role'
      });
    }

    next();
  };
};

exports.auth = exports.authenticate;
exports.isAdmin = exports.requireRole('admin');
