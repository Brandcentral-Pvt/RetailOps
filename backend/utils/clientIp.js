/**
 * SECURITY: single source of truth for client IP derivation.
 *
 * NEVER parse X-Forwarded-For manually — it is fully client-controlled and
 * trivially spoofable when read raw. Express computes `req.ip` honoring
 * `app.set('trust proxy', 1)` (server.js): the single nginx reverse proxy on
 * the same host is trusted to overwrite XFF with the real client address,
 * and any deeper spoofed hops are ignored. Direct connections fall back to
 * the socket address.
 *
 * Deployment note: trust proxy=1 assumes exactly ONE trusted proxy in front
 * of this process. If topology ever changes (e.g., CDN -> nginx), revisit
 * server.js — do NOT reintroduce manual XFF parsing here.
 */
function getClientIp(req) {
  let ip =
    (req && req.ip) ||
    (req && req.socket && req.socket.remoteAddress) ||
    'unknown';
  // Normalize IPv6-mapped IPv4 (::ffff:203.0.113.7 -> 203.0.113.7) so
  // rate-limit keys / fingerprints are stable across stacks.
  if (typeof ip === 'string' && ip.startsWith('::ffff:')) ip = ip.slice(7);
  return ip;
}

module.exports = { getClientIp };
