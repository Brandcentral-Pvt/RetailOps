'use strict';
/**
 * HTTPS redirect middleware (production only).
 *
 * SECURITY (RB3): the previous implementation built the 301 target by
 * reflecting the raw Host header — a client-controlled value — which allowed
 * open-redirect/cache-poisoning abuse (attacker sends Host: evil.com and gets
 * redirected to https://evil.com/<path>).
 *
 * New policy:
 *   - The redirect host is NEVER taken from the request unless it matches an
 *     allowlist derived from FRONTEND_URL / DASHBOARD_URL env origins (plus
 *     the product's own *.brandcentral.in domain family).
 *   - Otherwise the preferred configured origin is used; if nothing is
 *     configured we fall back to the documented production dashboard host
 *     (same default as authController.forgotPassword).
 *   - The original path+query is preserved verbatim.
 */
const FALLBACK_HOST = 'data.brandcentral.in';
const BRAND_DOMAIN_SUFFIX = '.brandcentral.in';

function getAllowedHosts() {
  const hosts = new Set();
  for (const origin of [process.env.FRONTEND_URL, process.env.DASHBOARD_URL]) {
    if (!origin) continue;
    try {
      const u = new URL(origin);
      if (u.protocol === 'https:' || u.protocol === 'http:') hosts.add(u.hostname.toLowerCase());
    } catch (_) { /* ignore malformed env values */ }
  }
  return hosts;
}

function pickRedirectHost(reqHost) {
  const host = String(reqHost || '').toLowerCase().split(':')[0]; // strip port
  if (!host) return FALLBACK_HOST;
  // Echo the request Host ONLY after validating it against known-good values.
  if (getAllowedHosts().has(host)) return host;
  if (host.endsWith(BRAND_DOMAIN_SUFFIX)) return host;
  // Fail closed: never reflect unknown hosts.
  const preferred = process.env.FRONTEND_URL || process.env.DASHBOARD_URL;
  if (preferred) {
    try { return new URL(preferred).hostname.toLowerCase(); } catch (_) { /* fall through */ }
  }
  return FALLBACK_HOST;
}

const httpsRedirect = (req, res, next) => {
  if (process.env.NODE_ENV !== 'production') return next();
  const forwardedProto = req.headers['x-forwarded-proto'];
  const needsUpgrade =
    (forwardedProto && forwardedProto !== 'https') ||
    (!forwardedProto && !req.secure);
  if (!needsUpgrade) return next();

  // Defensive: path must start with '/' and contain no CR/LF (header injection).
  let targetPath = req.url || '/';
  if (!targetPath.startsWith('/') || /[\r\n]/.test(targetPath)) targetPath = '/';
  return res.redirect(301, `https://${pickRedirectHost(req.headers.host)}${targetPath}`);
};

module.exports = httpsRedirect;
