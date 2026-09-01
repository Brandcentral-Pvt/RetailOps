'use strict';
/**
 * requestGuard.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Lightweight Express middleware that:
 *
 *  1. Rejects requests whose Content-Length exceeds a configurable limit on
 *     non-upload routes (default 10 MB).  Upload routes already have a much
 *     larger server-level timeout set in server.js, so we skip them.
 *
 *  2. Sets a per-request timeout (REQUEST_TIMEOUT_MS below).  If the handler
 *     does not send a response within that window the middleware sends a 408,
 *     flags req.timedout, and destroys the client socket once the 408 has
 *     flushed (bounded by SOCKET_DESTROY_GRACE_MS), preventing hanging
 *     connections from accumulating.
 *
 * Usage:
 *   const requestGuard = require('./middleware/requestGuard');
 *   app.use(requestGuard);
 * ─────────────────────────────────────────────────────────────────────────────
 */

const PAYLOAD_LIMIT_BYTES = 10 * 1024 * 1024; // 10 MB
const REQUEST_TIMEOUT_MS = 120_000;           // 120 seconds for auth routes (bcrypt + DB + OTP)
// RB6: how long the 408 response gets to flush before the socket is force-
// destroyed anyway (covers handlers that never finish after the timeout).
const SOCKET_DESTROY_GRACE_MS = 5_000;

// Routes that handle large file uploads — skip payload guard + use longer timeout
const UPLOAD_PATH_PREFIXES = [
  '/api/upload',
  '/api/bulk',
  '/api/market-sync',
  '/api/files',
  '/api/export',
  '/api/asins',
  '/api/pems',
  '/api/auth',    // Auth routes have multiple DB/Redis calls (bcrypt, OTP, etc.)
];

function isUploadRoute(path) {
  return UPLOAD_PATH_PREFIXES.some(prefix => path.startsWith(prefix));
}

/**
 * requestGuard middleware
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function requestGuard(req, res, next) {
  // ── 1. Payload size check ─────────────────────────────────────────────────
  if (!isUploadRoute(req.path)) {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    if (contentLength > PAYLOAD_LIMIT_BYTES) {
      return res.status(413).json({
        error: 'Payload Too Large',
        message: `Request body must not exceed ${PAYLOAD_LIMIT_BYTES / 1024 / 1024} MB`,
      });
    }
  }

  // ── 2. Per-request timeout ────────────────────────────────────────────────
  // Skip timeout for upload routes (server.js already sets 600 s server timeout)
  if (!isUploadRoute(req.path)) {
    const timer = setTimeout(() => {
      // Handler already started responding — never stomp on it.
      if (res.headersSent || res.writableFinished) return;

      req.timedout = true; // downstream middleware can short-circuit on this flag

      console.warn(
        `⏱  [requestGuard] Timeout on ${req.method} ${req.originalUrl} after ${REQUEST_TIMEOUT_MS}ms`
      );
      res.status(408).json({
        error: 'Request Timeout',
        message: 'The server did not receive a complete request within the allowed time.',
      });

      // SECURITY/RESILIENCE (RB6): previously the 408 was sent while handler
      // work continued silently. LEAST-RISK abort strategy: after the 408
      // body has flushed, destroy the client socket so hanging handlers stop
      // holding connections. We deliberately do NOT cancel in-flight handler
      // work via AbortSignal into mssql — that risks partial writes across
      // many call sites; pool connections are bounded by their own request
      // timeouts instead.
      const destroySocket = () => {
        if (!res.socket || res.socket.destroyed) return;
        try { res.socket.destroy(); } catch (_) { /* socket already gone */ }
      };
      const grace = setTimeout(destroySocket, SOCKET_DESTROY_GRACE_MS);
      if (grace.unref) grace.unref();
      res.once('finish', () => {
        clearTimeout(grace);
        destroySocket();
      });
    }, REQUEST_TIMEOUT_MS);

    // Clear the timer once the response is sent so it doesn't fire spuriously
    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));
  }

  next();
}

module.exports = requestGuard;
