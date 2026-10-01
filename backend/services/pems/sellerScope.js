/**
 * Canonical seller scoping for the whole tasks module.
 *
 * The rule the business runs on: a user assigned N sellers may only ever see
 * or touch tasks belonging to those N sellers. Global roles (admin,
 * operational_manager, ...) are unrestricted.
 *
 * This lives in one place because the alternative — re-deriving "which sellers
 * can this person see" inside every query — is how the dashboards ended up
 * leaking every seller to every logged-in user.
 */

const { isGlobalUserRole } = require('../../utils/roleUtils');

const DENY_ALL = ' AND 1=0';

function userIdOf(user) {
  return user?.Id || user?._id || user?.id || null;
}

function roleNameOf(user) {
  return String(user?.role?.name || user?.role?.Name || user?.role || '').toLowerCase();
}

/** The seller ids assigned to a user, normalised to strings. */
function getAssignedSellerIds(user) {
  if (!user) return [];
  const raw = user.assignedSellers || user.AssignedSellers || user.sellers || [];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => (typeof s === 'string' ? s : s?._id || s?.Id || s?.id))
    .filter(Boolean)
    .map(String);
}

/** Parse a `?sellerId=a,b` style filter into a clean list. */
function parseRequestedSellerIds(input) {
  if (input === undefined || input === null || input === '') return [];
  const values = Array.isArray(input) ? input : String(input).split(',');
  return values.map((v) => String(v).trim()).filter((v) => v && v !== 'all');
}

/**
 * Resolves the effective seller scope for a request.
 *
 * Returns:
 *   unrestricted  – true for global roles, and for internal callers that pass
 *                   no user (scheduled jobs legitimately run unscoped).
 *   sellerIds     – the sellers this user may read/write.
 *   empty         – true when a restricted user may see nothing. Callers must
 *                   deny rather than fall through to "no filter".
 *   allowOwnBrandless – daily-routine tasks have SellerId NULL but are assigned
 *                   to / reviewed by a person. Those stay visible to that
 *                   person only, and only when no seller filter was requested.
 *   meId          – for the brand-less visibility rule.
 */
function resolveSellerScope(user, requestedSellerInput) {
  const requested = parseRequestedSellerIds(requestedSellerInput);
  const meId = userIdOf(user);
  const globalRole = isGlobalUserRole(roleNameOf(user));

  // No user = internal job (scheduler, script, migration). Unscoped by design.
  if (!user || globalRole) {
    return {
      unrestricted: true,
      sellerIds: requested,
      empty: false,
      allowOwnBrandless: false,
      meId,
      globalRole,
    };
  }

  const allowed = getAssignedSellerIds(user);
  const effective = requested.length > 0 ? requested.filter((id) => allowed.includes(id)) : allowed;

  return {
    unrestricted: false,
    sellerIds: effective,
    empty: effective.length === 0,
    // A brand filter was requested: it is an explicit narrowing, so do not
    // widen it back out with the user's own brand-less work.
    allowOwnBrandless: requested.length === 0 && Boolean(meId),
    meId,
    globalRole,
  };
}

/**
 * Builds the WHERE fragment restricting a query on a seller-owned table.
 * `alias` is the table alias (e.g. 'i' for PemsTaskInstances, 'a' for Actions).
 * Pass an empty string for un-aliased queries, where columns are bare.
 * Set `hasReviewer: false` for `Actions`, which has no ReviewerId column.
 *
 * Returns { clause, params } where params is [[name, value], ...] so the caller
 * can bind them on whichever request object it uses — the same clause is often
 * shared by a count query and a data query that each need their own bindings.
 */
function buildScopeClause(scope, alias, { includeOwnBrandless = true, hasReviewer = true } = {}) {
  if (!scope || scope.unrestricted) return { clause: '', params: [] };

  if (scope.empty && !scope.allowOwnBrandless) {
    return { clause: DENY_ALL, params: [] };
  }

  const p = alias ? `${alias}.` : '';
  const params = [];
  let parts = [];

  if (scope.sellerIds.length > 0) {
    const placeholders = scope.sellerIds
      .map((id, idx) => {
        const name = `ss${alias || 'x'}_${idx}`;
        params.push([name, id]);
        return `@${name}`;
      })
      .join(',');
    parts.push(`${p}SellerId IN (${placeholders})`);
  }

  if (includeOwnBrandless && scope.allowOwnBrandless) {
    params.push(['ssMe', String(scope.meId)]);
    // `Actions` has no ReviewerId column. Referencing it would fail the whole
    // query with "Invalid column name", so those tables fall back to
    // assignee-only rather than silently widening to everyone.
    const parties = hasReviewer
      ? `${p}AssignedTo = @ssMe OR ${p}ReviewerId = @ssMe`
      : `${p}AssignedTo = @ssMe`;
    parts.push(`(${p}SellerId IS NULL AND (${parties}))`);
  }

  if (!parts.length) return { clause: DENY_ALL, params: [] };
  return { clause: ` AND (${parts.join(' OR ')})`, params };
}

/** Bind a prepared params list onto a mssql request object. */
function applyScopeInputs(request, params, sqlLib) {
  params.forEach(([name, value]) => request.input(name, sqlLib.VarChar, value));
}

/**
 * In-memory equivalent, for rows already loaded (used by access middleware and
 * single-record lookups). A task with a SellerId outside the user's sellers is
 * denied; brand-less tasks are allowed only for their assignee/reviewer.
 */
function canViewTaskByScope(user, task) {
  if (!user || !task) return false;
  const scope = resolveSellerScope(user, null);
  if (scope.unrestricted) return true;

  const sellerId = task.SellerId || task.sellerId || null;
  if (sellerId) return scope.sellerIds.includes(String(sellerId));

  // Brand-less work: only the person it is assigned to / reviewed by.
  const me = String(scope.meId);
  return me === String(task.AssignedTo || '') || me === String(task.ReviewerId || '');
}

module.exports = {
  DENY_ALL,
  userIdOf,
  roleNameOf,
  getAssignedSellerIds,
  parseRequestedSellerIds,
  resolveSellerScope,
  buildScopeClause,
  canViewTaskByScope,
  applyScopeInputs,
};
