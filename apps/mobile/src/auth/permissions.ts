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

/** Known registry roles, widened for server-created custom internal roles. */
export type KnownRoleKey =
  | 'admin'
  | 'operational_manager'
  | 'Brand Manager'
  | 'catalog_manager'
  | 'listing_team'
  | 'reviewer'
  | 'viewer'
  | 'seller_client';
export type RoleKey = KnownRoleKey | (string & {});

/** Pseudo-roles used by the screen inventory. They are not real accounts. */
export type PseudoRole = 'ALL_INTERNAL' | 'ALL_AUTHENTICATED' | 'ALL_SURFACES' | 'NONE';
export type RoleRef = KnownRoleKey | PseudoRole;

export type Session = {
  userId: string;
  email: string;
  displayName: string;
  role: RoleKey;
  /** Every effective permission from the backend, including per-user overrides. */
  permissions: string[];
  /** The seller accounts this user may read. Empty on a global internal account. */
  sellerIds: string[];
  /** Server-derived; never inferred from a role on the device. */
  scope: ScopeMode;
  token: string;
  expiresAt: number;
  requiresSetup: boolean;
  needsPasswordReset: boolean;
};

/* ── Permission expression evaluation ───────────────────────────────────── */

/** Every permission string the session holds, lower-cased for comparison. */
export function permissionSet(permissions: string[]): Set<string> {
  return new Set(permissions.map((permission) => permission.trim().toLowerCase()).filter(Boolean));
}

/** Supports the registry's human-friendly `a or b` and `a | b` any-of forms. */
const splitAlternatives = (expression: string): string[] =>
  expression
    .split(/\s+or\s+|\s*\|\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);

function permissionMatches(granted: string, requirement: string): boolean {
  if (requirement === '*') return true;
  if (!requirement.includes('*')) return granted === requirement;
  // Registry wildcards are permission-family patterns (`*_export`,
  // `*report_view`). Escape every non-wildcard character before matching.
  const escaped = requirement
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${escaped}$`, 'i').test(granted);
}

/**
 * Does the session satisfy this screen's permission requirement?
 *
 * - `null` / `undefined` / `''` → no gate, everyone passes.
 * - `"a or b"` / `"a | b"`    → holds at least one.
 * - wildcards                    → match a permission family.
 * - an effective `*` grant       → every permission requirement passes.
 */
export function satisfies(granted: Set<string>, requirement: string | null | undefined): boolean {
  if (requirement == null) return true;
  const expression = String(requirement).trim();
  if (expression === '' || expression === 'NONE' || expression === '—') return true;
  if (granted.has('*')) return true;

  return splitAlternatives(expression).some((alternative) => {
    const normalized = alternative.toLowerCase();
    for (const permission of granted) {
      if (permissionMatches(permission, normalized)) return true;
    }
    return false;
  });
}

/** Convenience wrapper: build the set from a session and test in one call. */
export function sessionSatisfies(session: Session | null, requirement: string | null | undefined): boolean {
  if (!session) return false;
  return satisfies(permissionSet(session.permissions), requirement);
}

/* ── Surface ───────────────────────────────────────────────────────────── */

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

/* ── The single gate ───────────────────────────────────────────────────── */

export type GateResult =
  | { allowed: true }
  | { allowed: false; reason: 'no-session' | 'wrong-surface' | 'no-permission' };

/** The one function navigation and every screen call. */
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

/* ── Scope ─────────────────────────────────────────────────────────────── */

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
      return {
        canSwitch: true,
        canSelectAll: false,
        sellers: allSellers.filter((seller) => session.sellerIds.includes(seller.id)),
      };
    case 'self':
      return {
        canSwitch: false,
        canSelectAll: false,
        sellers: allSellers.filter((seller) => session.sellerIds.includes(seller.id)),
      };
  }
}
