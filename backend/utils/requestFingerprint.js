const crypto = require('crypto');

/**
 * Stable request identity helpers used by login, OTP verification and bearer
 * authentication. Every stage must derive exactly the same fingerprint or a
 * token issued immediately after OTP can fail its first authenticated request.
 */
function clientIp(req) {
  const forwarded = req?.headers?.['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (raw) {
    const first = String(raw).split(',')[0]?.trim();
    if (first) return first;
  }
  return req?.socket?.remoteAddress || req?.ip || 'unknown';
}

function headerValue(req, name) {
  const value = req?.headers?.[name];
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === 'string' ? raw.trim() : '';
}

/**
 * Bind native sessions to a stable, SecureStore-backed installation id when it
 * is supplied. IP addresses are intentionally *not* part of that native
 * identity: cellular/Wi-Fi transitions must not invalidate a valid session.
 *
 * Browser and older clients retain the old user-agent/IP fallback so existing
 * tokens remain valid through this deployment.
 */
function deviceFingerprint(req) {
  const deviceId = headerValue(req, 'x-device-id') || headerValue(req, 'x-device-fingerprint');
  if (deviceId && deviceId.length <= 256) {
    return crypto.createHash('sha256').update(`device:${deviceId}`).digest('hex');
  }
  return Buffer.from(`${headerValue(req, 'user-agent')}|${clientIp(req)}`).toString('base64').slice(0, 32);
}

module.exports = { clientIp, deviceFingerprint };
