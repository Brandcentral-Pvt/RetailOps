/**
 * ASIN Manager seller-scoping helpers.
 *
 * The ASIN module grew its own ad-hoc scope checks — and on many routes, none at
 * all: `checkSellerAccess` only ever looked at `params`/`query`, so every seller
 * carried in a request body walked straight through, and id-addressed handlers
 * (trends, sub-BSR, parent children, week-history writes, tag writes, bulk
 * updates, recalculate-lqs) never consulted `req.user` at all.
 * See docs/asin-manager-deep-dive.md → F1/F2/F3/F4.
 *
 * This module is the single answer to "may this user touch that seller / that
 * ASIN?" for the ASIN controllers, the tag controllers and the ledger endpoint.
 * The seller-list logic itself lives in utils/sellerScope.js so the ASIN module
 * behaves exactly like the ads/data/keyword modules.
 *
 * Contract:
 *   - global roles (admin / super_admin / developer / operational_manager) → unrestricted;
 *   - a request naming a seller outside `assignedSellers` → 403 `forbidden_seller`;
 *   - a non-global user with no assignments → 403 on writes (never an unscoped write);
 *   - unknown ASIN ids → 404 (from loadAsinInScope), and the caller's own list
 *     semantics are preserved for reads;
 *   - nothing here ever widens access: an unresolved scope is a 403, not a full
 *     table scan.
 */

const { sql, getPool } = require('../database/db');
const { buildInClause } = require('./sqlHelpers');
const { resolveSellerScope } = require('./sellerScope');

const DEFAULT_MESSAGE = 'You do not have access to the requested seller(s).';

/** 403 in the same shape the ads/data controllers use. */
function forbidden(res, message = DEFAULT_MESSAGE) {
  return res.status(403).json({
    success: false,
    error: 'forbidden_seller',
    code: 'forbidden_seller',
    message,
  });
}

/** 404 in the same shape the ASIN controller already uses. */
function notFound(res, message = 'ASIN not found') {
  return res.status(404).json({ success: false, error: 'not_found', message });
}

/** Resolve a scope without ever throwing. */
function scopeFor(req, requestedSellerId) {
  return resolveSellerScope(req.user, requestedSellerId);
}

/**
 * Guard a write/read that names its seller in the body or query.
 * Returns the resolved scope, or `null` after answering 403.
 *
 * `empty` covers the "non-global user with no sellers" case, which must never
 * fall through to an unfiltered query.
 */
function requireSellerScope(req, res, requestedSellerId, { message } = {}) {
  const scope = scopeFor(req, requestedSellerId);
  if (scope.denied || scope.empty) {
    forbidden(res, message);
    return null;
  }
  if (!scope.isGlobal && scope.sellerIds.length === 0) {
    forbidden(res, message);
    return null;
  }
  return scope;
}

/**
 * Load an ASIN by internal id and verify the caller's scope covers its seller.
 * Resolves to `{ asin, scope }`, or `null` after answering 404/403.
 */
async function loadAsinInScope(req, res, id, { columns = 'Id, AsinCode, SellerId', message } = {}) {
  const pool = await getPool();
  const result = await pool.request()
    .input('id', sql.VarChar, id)
    .query(`SELECT ${columns} FROM Asins WHERE Id = @id`);

  if (result.recordset.length === 0) {
    notFound(res, message || 'ASIN not found');
    return null;
  }

  const asin = result.recordset[0];
  const scope = scopeFor(req, asin.SellerId);
  if (scope.denied) {
    forbidden(res, message);
    return null;
  }
  return { asin, scope };
}

/**
 * Verify a set of seller ids is entirely inside the caller's scope.
 * Returns `true` when the caller may proceed, otherwise answers 403 and returns false.
 */
function assertSellersInScope(req, res, sellerIds, { message } = {}) {
  const scope = scopeFor(req, null);
  if (scope.isGlobal) return true;
  if (scope.empty) {
    forbidden(res, message);
    return false;
  }
  const allowed = new Set(scope.allowed);
  const foreign = [...new Set((sellerIds || []).filter(Boolean).map((s) => String(s)))]
    .filter((s) => !allowed.has(s));
  if (foreign.length > 0) {
    forbidden(res, message);
    return false;
  }
  return true;
}

/**
 * Verify every ASIN id belongs to a seller inside the caller's scope.
 * One query, no writes; returns `true` or answers 403.
 */
async function assertAsinsInScope(req, res, asinIds, { message } = {}) {
  const scope = scopeFor(req, null);
  if (scope.isGlobal) return true;
  if (scope.empty) {
    forbidden(res, message);
    return false;
  }
  const ids = (asinIds || []).filter(Boolean).map((s) => String(s));
  if (ids.length === 0) return true;

  const pool = await getPool();
  const request = pool.request();
  const inClause = buildInClause(request, 'scopeAsin', ids);
  const result = await request.query(
    `SELECT DISTINCT SellerId FROM Asins WHERE Id IN (${inClause})`
  );
  const sellers = result.recordset.map((r) => r.SellerId).filter(Boolean).map((s) => String(s));
  const allowed = new Set(scope.allowed);
  if (sellers.some((s) => !allowed.has(s))) {
    forbidden(res, message);
    return false;
  }
  return true;
}

/** Best-effort temp-file cleanup for 403 paths on multer-uploaded imports. */
function cleanupUpload(filePath) {
  try {
    if (filePath) require('fs').unlinkSync(filePath);
  } catch (err) {
    /* the temp file is not worth failing the request over */
  }
}

module.exports = {
  forbidden,
  notFound,
  scopeFor,
  requireSellerScope,
  loadAsinInScope,
  assertSellersInScope,
  assertAsinsInScope,
  cleanupUpload,
};
