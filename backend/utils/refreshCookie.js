/**
 * Refresh-token cookie support (F2 — dual-mode transition).
 *
 * The refresh token keeps travelling in the JSON body (mobile / existing
 * clients, untouched). ADDITIVELY it is also set as an httpOnly cookie
 * `retailops_rt` so browser sessions can stop persisting the token in JS-
 * reachable storage. Cookie contents are NEVER logged.
 *
 * NO NEW DEPS: Express 5 provides res.cookie/clearCookie natively, but
 * parsing req.cookies would require cookie-parser. We parse exactly ONE
 * well-known cookie name from the raw Cookie header instead — deliberately
 * minimal, documented, and scoped to this file.
 */

const COOKIE_NAME = 'retailops_rt';

/** Cookie attributes — shared by set and clear so they always match. */
function cookieOptions() {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
    };
}

function setRefreshCookie(res, token) {
    if (!token) return;
    res.cookie(COOKIE_NAME, token, cookieOptions());
}

function clearRefreshCookie(res) {
    res.clearCookie(COOKIE_NAME, cookieOptions());
}

/**
 * Parse ONLY `retailops_rt` out of the raw Cookie header.
 * Returns the token string or null. Values are not validated/decoded here;
 * JWT verification happens in the auth controller as for body tokens.
 */
function parseRefreshCookie(req) {
    const header = req.headers && req.headers.cookie;
    if (!header || typeof header !== 'string') return null;
    for (const part of header.split(';')) {
        const eq = part.indexOf('=');
        if (eq === -1) continue;
        const name = part.slice(0, eq).trim();
        if (name !== COOKIE_NAME) continue;
        const value = part.slice(eq + 1).trim();
        // Strip an optional double-quoted wrapper per RFC 6265 cookie-value.
        const unquoted = value.length >= 2 && value.startsWith('"') && value.endsWith('"')
            ? value.slice(1, -1)
            : value;
        return unquoted || null;
    }
    return null;
}

/**
 * Origin allowlist for the CSRF guard on cookie-based refresh:
 * FRONTEND_URL / DASHBOARD_URL origins only. Empty allowlist → fail closed.
 */
function allowedOrigins() {
    return [process.env.FRONTEND_URL, process.env.DASHBOARD_URL]
        .filter(Boolean)
        .map((u) => {
            try { return new URL(u).origin; } catch { return null; }
        })
        .filter(Boolean);
}

/**
 * True when the request's Origin (preferred) or Referer origin is on the
 * allowlist. No Origin AND no Referer → reject (browsers always send one of
 * them on cross-site POSTs; non-browser clients use the body flow instead).
 */
function requestOriginAllowed(req) {
    const allow = allowedOrigins();
    if (allow.length === 0) return false;
    const headerValue = req.headers.origin || req.headers.referer;
    if (!headerValue) return false;
    let origin;
    try { origin = new URL(headerValue).origin; } catch { return false; }
    return allow.includes(origin);
}

module.exports = {
    COOKIE_NAME,
    cookieOptions,
    setRefreshCookie,
    clearRefreshCookie,
    parseRefreshCookie,
    requestOriginAllowed,
};
