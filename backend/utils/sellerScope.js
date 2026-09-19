/**
 * Seller scoping — the single implementation of "which sellers may this user read?".
 *
 * Every read path that can be narrowed by seller must go through this helper.
 * Before it existed, `/data/ads-manager`, `/data/ads-report` and the ads export
 * accepted any `sellerId` from the query/body and never consulted `req.user`
 * (see docs/ads-module-deep-dive.md → F1), which allowed any user holding the
 * view permission to read another seller's advertising data.
 *
 * Contract:
 *   resolveSellerScope(user, requestedSellerId)
 *     → {
 *         isGlobal,        // role bypasses seller restrictions entirely
 *         allowed,         // string[] every seller id this user may read ('' when global)
 *         requested,       // string[] parsed from the caller's request ('' when none)
 *         sellerIds,       // string[] the ids to actually filter by ('' = no filter)
 *         denied,          // true  → the request explicitly asked for a seller outside `allowed`
 *         unrestricted,    // true  → no seller filter should be applied at all
 *         empty,           // true  → user has no sellers and is not global → return nothing
 *       }
 *
 * Rules:
 *   - global roles (admin / super_admin / developer / operational_manager) are unrestricted.
 *   - a request may pass one id, a comma separated list, or nothing.
 *   - nothing       → filter by every seller the user is assigned to.
 *   - subset        → filter by that subset.
 *   - anything else → `denied` (the caller answers 403; never silently widen or narrow).
 *   - `'all'` is accepted as "no explicit selection" (matches the dashboard's convention).
 */

const { isGlobalUserRole } = require('./roleUtils');

const GLOBAL_SENTINELS = new Set(['all', '*', '']);

/** Accept "id", "id1,id2", ['id1','id2'] and normalise to a clean array. */
function parseSellerIds(value) {
  if (value === undefined || value === null) return [];
  const raw = (Array.isArray(value) ? value : [value]).flatMap((v) => String(v).split(','));
  const out = [];
  for (const item of raw) {
    const id = typeof item === 'string' ? item.trim() : item;
    if (id === undefined || id === null) continue;
    const str = String(id).trim();
    if (!str || GLOBAL_SENTINELS.has(str.toLowerCase())) continue;
    if (!out.includes(str)) out.push(str);
  }
  return out;
}

function roleNameOf(user) {
  return user?.role?.Name || user?.role?.name || user?.RoleName || null;
}

function resolveSellerScope(user, requestedSellerId) {
  const isGlobal = isGlobalUserRole(roleNameOf(user));

  const allowed = (Array.isArray(user?.assignedSellers) ? user.assignedSellers : [])
    .map((s) => (s && typeof s === 'object' ? (s._id || s.Id || s.id) : s))
    .filter((s) => s !== undefined && s !== null && String(s).trim() !== '')
    .map((s) => String(s).trim());

  const requested = parseSellerIds(requestedSellerId);

  if (isGlobal) {
    return {
      isGlobal: true,
      allowed: [],
      requested,
      sellerIds: requested,          // globals may filter by whichever seller they asked for
      denied: false,
      unrestricted: requested.length === 0,
      empty: false,
    };
  }

  if (requested.length === 0) {
    return {
      isGlobal: false,
      allowed,
      requested,
      sellerIds: allowed,
      denied: false,
      unrestricted: false,
      empty: allowed.length === 0,
    };
  }

  const withinScope = requested.filter((id) => allowed.includes(id));
  if (withinScope.length === 0) {
    return {
      isGlobal: false,
      allowed,
      requested,
      sellerIds: [],
      denied: true,
      unrestricted: false,
      empty: allowed.length === 0,
    };
  }

  return {
    isGlobal: false,
    allowed,
    requested,
    sellerIds: withinScope,
    denied: false,
    unrestricted: false,
    empty: false,
  };
}

/**
 * Bind `alias.SellerId IN (@param_i…)` for a resolved scope.
 * Returns '' when no seller predicate should be applied (global user, no selection).
 * Callers must still honour `scope.empty` (→ return an empty payload, never an
 * unfiltered query) and `scope.denied` (→ 403) before calling this.
 */
function bindSellerFilter(request, scope, { alias = 'a', prefix = 'sellerScope' } = {}) {
  if (!scope) return '';
  // `unrestricted` means "no seller selection was made by a user who is allowed
  // to see everything" → no predicate. A global user who *did* pick a seller
  // still gets filtered (that is how the admin seller dropdown works).
  if (scope.unrestricted) return '';
  const ids = scope.sellerIds || [];
  if (ids.length === 0) return scope.isGlobal ? '' : ' AND 1 = 0';   // failure-closed
  const placeholders = ids.map((id, i) => {
    const name = `${prefix}_${i}`;
    request.input(name, require('../database/db').sql.VarChar, id);
    return `@${name}`;
  });
  return ` AND ${alias}.SellerId IN (${placeholders.join(', ')})`;
}

module.exports = { resolveSellerScope, bindSellerFilter, parseSellerIds };
