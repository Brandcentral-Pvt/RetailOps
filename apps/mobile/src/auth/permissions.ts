/**
 * The visibility formula, implemented once.
 *
 *   visibility = surface × RBAC permission × data scope
 *
 * No screen may branch on a role *name*. A screen asks for a permission, the
 * session answers, and the same code path works for internal staff and seller
 * clients. This module is the only place permissions are evaluated.
 *
 * Contract: docs/design/mobile/agents/02-consistency-contract.md
 */

export type Surface = 'internal' | 'seller' | 'both';

export type ScopeMode = 'global' | 'assigned' | 'self';

export type RoleKey =
  | 'admin'
  | 'operational_manager'
  | 'Brand Manager'
  | 'catalog_manager'
  | 'listing_team'
  | 'reviewer'
  | 'viewer'
  | 'seller_client';

/** Pseudo-roles used by the screen inventory. They are not real accounts. */
export type PseudoRole =
  | 'ALL_INTERNAL'
  | 'ALL_AUTHENTICATED'
  | 'ALL_SURFACES'
  | 'NONE';

export type RoleRef = RoleKey | PseudoRole;

export type Session = {
  userId: string;
  email: string;
  displayName: string;
  role: RoleKey;
  /** Every permission the backend granted, including extra_permissions. */
  permissions: string[];
  /**
   * The seller accounts this user may read. `[]` on the internal surface.
   * `self` scope is a single-entry list.
   */
  sellerIds: string[];
  scope: ScopeMode;
  token: string;
  expiresAt: number;
};

/* ── Permission expression evaluation ────────────────────────────────────────
 * The screen inventory stores permission requirements as short expressions,
 * e.g. "dashboard_view or targets_view", "chat_view", "asinmanager_manage",
 * or null for "no permission gate". We evaluate them against the session's
 * permission set rather than string-comparing, so a screen that requires any
 * one of several permissions behaves the way its spec says.
 * -------------------------------------------------------------------------- */

/** Every permission string the session holds, lower-cased for comparison. */
export function permissionSet(permissions: string[]): Set<string> {
  return new Set(permissions.map((p) => p.trim().toLowerCase()).filter(Boolean));
}

const splitAlternatives = (expr: string): string[] =>
  expr
    .split(/\s+or\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * Does the session satisfy this screen's permission requirement?
 *
 * - `null` / `undefined` / `''`  → no gate, everyone passes.
 * - `"a or b"`                   → holds at least one of them.
 * - `"a"`                        → holds it.
 *
 * `*` inside a permission matches any suffix (`asinmanager_*`), which is how
 * the inventory abbreviates the `_view _manage _import _export` families.
 */
export function satisfies(granted: Set<string>, requirement: string | null | undefined): boolean {
  if (requirement == null) return true;
  const expr = String(requirement).trim();
  if (expr === '' || expr === 'NONE' || expr === '—') return true;

  return splitAlternatives(expr).some((alt) => {
    const p = alt.toLowerCase();
    if (p.endsWith('_*')) {
      const prefix = p.slice(0, -1); // keep the underscore
      for (const g of granted) if (g.startsWith(prefix)) return true;
      return false;
    }
    if (p === '*') return true;
    return granted.has(p);
  });
}

/** Convenience wrapper: build the set from a session and test in one call. */
export function sessionSatisfies(session: Session | null, requirement: string | null | undefined): boolean {
  if (!session) return false;
  return satisfies(permissionSet(session.permissions), requirement);
}

/* ── Surface ─────────────────────────────────────────────────────────────── */

/** Which surface does this session see? Seller clients get the seller shell. */
// contract-allow: C-02 — surface membership is an account TYPE, not a
// capability. No permission means "you are a merchant"; the seller surface is
// defined by holding the seller_client role (registry/roles.json →
// pseudoRoles). Every OTHER role test in the app is a violation.
export function surfaceOf(session: Session | null): Surface {
  if (!session) return 'both';
  return session.role === 'seller_client' ? 'seller' : 'internal';
}

/** May this screen's surface be shown to this session at all? */
export function surfaceAllows(sessionSurface: Surface, screenSurface: Surface): boolean {
  if (screenSurface === 'both') return true;
  return screenSurface === sessionSurface;
}

/* ── The single gate ─────────────────────────────────────────────────────── */

export type GateResult =
  | { allowed: true }
  | { allowed: false; reason: 'no-session' | 'wrong-surface' | 'no-permission' };

/**
 * The one function navigation and every screen call. Returns *why* access was
 * refused so the 403 screen can say something useful.
 */
export function canAccess(
  session: Session | null,
  screen: { surface: Surface; permission: string | null; roleKeys: RoleRef[] },
): GateResult {
  if (!session) return { allowed: false, reason: 'no-session' };
  if (!surfaceAllows(surfaceOf(session), screen.surface)) {
    return { allowed: false, reason: 'wrong-surface' };
  }
  if (!sessionSatisfies(session, screen.permission)) {
    return { allowed: false, reason: 'no-permission' };
  }
  return { allowed: true };
}

/* ── Scope ───────────────────────────────────────────────────────────────── */

/**
 * The seller switcher offers depend on scope:
 *   global   → "All sellers" + every seller
 *   assigned → only assigned sellers, no "All sellers"
 *   self     → pinned to one seller, no switcher at all
 */
export function scopeOffers(
  session: Session,
  allSellers: { id: string; name: string }[],
): { canSwitch: boolean; canSelectAll: boolean; sellers: { id: string; name: string }[] } {
  switch (session.scope) {
    case 'global':
      return { canSwitch: true, canSelectAll: true, sellers: allSellers };
    case 'assigned':
      return { canSwitch: true, canSelectAll: false, sellers: allSellers.filter((s) => session.sellerIds.includes(s.id)) };
    case 'self':
      return { canSwitch: false, canSelectAll: false, sellers: allSellers.filter((s) => session.sellerIds.includes(s.id)) };
  }
}
