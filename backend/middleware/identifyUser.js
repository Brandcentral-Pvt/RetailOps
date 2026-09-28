'use strict';
/**
 * Lightweight identity middleware for rate limiting.
 *
 * Verifies the Bearer JWT WITHOUT any DB / blacklist lookup and stamps a
 * minimal `req.user = { Id }` so the global rate limiter keys per user
 * instead of per office IP. The real `authenticate()` middleware (which
 * enforces blacklists, status, fingerprint and permissions) still runs on
 * every protected route and replaces `req.user` with the full user object.
 */

const jwt = require('jsonwebtoken');
const config = require('../config/env');

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return next();

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret);
    if (decoded && decoded.userId) {
      req.user = { Id: decoded.userId, _id: decoded.userId };
      req.userId = req.userId || decoded.userId;
    }
  } catch (_) {
    // Invalid/expired token — route-level auth still gets the final say;
    // the limiter just falls back to IP keying for this request.
  }
  next();
};