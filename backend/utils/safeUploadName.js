/**
 * Capability-model helpers for uploaded/served filenames.
 *
 * SECURITY MODEL (F1): every file written under /uploads is served PUBLICLY
 * (static mount in server.js). Access control for these URLs is therefore
 * UN-GUESSABILITY ONLY ("capability URL"): the filename must contain a fresh
 * 192-bit crypto-random token so it cannot be enumerated or derived from
 * timestamps, sequential ids, ASIN codes or client-supplied names.
 * The human-readable original name lives in DB records (Files.OriginalName,
 * Downloads.FileName, ...) and is only used for display / Content-Disposition.
 *
 * HISTORICAL FILES: files already on disk keep their old names — only NEW
 * uploads get capability names. DB rows referencing old paths are untouched.
 */

const crypto = require('crypto');
const path = require('path');

/** 24 random bytes → 48 hex chars (~192 bits of entropy). */
function randomToken() {
    return crypto.randomBytes(24).toString('hex');
}

/**
 * Sanitize an extension taken from a CLIENT-supplied original filename.
 *
 * path.extname() does NOT stop at separators ("a.b/c" → ".b/c"), so raw use of
 * extname would let separators/.. into the stored name. We reduce it to a
 * short [a-z0-9] token and, when an allowlist is given, require membership.
 */
function safeExtension(originalname, allowedExtensions = null) {
    const raw = path.extname(originalname || '').toLowerCase();
    const cleaned = `.${raw.replace(/[^a-z0-9]/g, '')}`.slice(0, 11); // '.' + up to 10 chars
    if (cleaned === '.') return '';
    if (allowedExtensions && !allowedExtensions.includes(cleaned)) return '';
    return cleaned;
}

/** Capability filename: <192-bit hex token><safe extension>. */
function randomFileName(originalname, allowedExtensions = null) {
    return `${randomToken()}${safeExtension(originalname, allowedExtensions)}`;
}

/**
 * Containment check for any path built partly from user input before it is
 * used for read/write/unlink/send. Returns the resolved path when it stays
 * inside rootDir, otherwise null.
 */
function resolveIfInside(rootDir, candidate) {
    const root = path.resolve(rootDir);
    const resolved = path.resolve(candidate);
    // Trailing sep guards against "uploads-extra"-style sibling prefix matches.
    const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
    if (resolved === root) return resolved;
    return resolved.startsWith(rootWithSep) ? resolved : null;
}

module.exports = { randomToken, safeExtension, randomFileName, resolveIfInside };
