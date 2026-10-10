const { sql } = require('../database/db');
const { isGlobalUserRole, normalizeRoleName } = require('../utils/roleUtils');

/**
 * Canonical access profile for an authenticated user.
 *
 * This module is deliberately shared by `middleware/auth` and the auth
 * controller.  The permissions shown to a client must be the same effective
 * permissions that route middleware enforces: role permissions plus a user's
 * explicit grants, minus explicit exclusions.
 */

const FALLBACK_ROLE = Object.freeze({ Name: 'viewer', DisplayName: 'Viewer' });

function roleNameFrom(user) {
  return user?.RoleName
    ?? user?.role?.Name
    ?? user?.role?.name
    ?? user?.role
    ?? FALLBACK_ROLE.Name;
}

function displayNameFrom(user) {
  return user?.RoleDisplayName
    ?? user?.role?.DisplayName
    ?? user?.role?.displayName
    ?? null;
}

function canonicalRole(name) {
  const normalized = normalizeRoleName(name);
  // `super_admin` is an older database spelling. It is the same mobile
  // persona as admin, while the original value remains in `sourceRole` for
  // audits and diagnostics.
  return normalized === 'super_admin' ? 'admin' : normalized || FALLBACK_ROLE.Name;
}

function scopeForRole(roleName) {
  const canonical = canonicalRole(roleName);
  if (canonical === 'seller_client') return 'self';
  return isGlobalUserRole(canonical) ? 'global' : 'assigned';
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || value.trim() === '') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // An invalid override must never widen access. It is a data-quality issue,
    // not a reason to grant whatever string happened to be stored.
    return [];
  }
}

function permissionLookup(rows) {
  const lookup = new Map();
  for (const row of rows ?? []) {
    if (!row?.Name) continue;
    const name = String(row.Name).trim();
    if (!name) continue;
    lookup.set(name.toLowerCase(), name);
    if (row.Id !== undefined && row.Id !== null) lookup.set(String(row.Id).trim().toLowerCase(), name);
  }
  return lookup;
}

/** Resolve id-or-name permission overrides into canonical permission names. */
function normalizeOverrides(value, lookup) {
  const out = [];
  for (const entry of asArray(value)) {
    if (entry === undefined || entry === null) continue;
    const key = String(entry).trim().toLowerCase();
    if (!key) continue;
    const permission = lookup.get(key);
    // Unknown values are ignored failure-closed. Admin UI writes IDs/names
    // from Permissions, so accepting arbitrary strings would be a privilege
    // escalation if a malformed DB value ever appeared.
    if (permission && !out.some((p) => p.toLowerCase() === permission.toLowerCase())) out.push(permission);
  }
  return out;
}

/**
 * Merge the three sources the server recognizes into one effective set.
 * Exported as a pure helper so the contract is regression-testable without a
 * database or JWT.
 */
function resolveEffectivePermissions({ rolePermissions = [], allPermissions = [], extraPermissions, excludedPermissions }) {
  const lookup = permissionLookup(allPermissions);
  const byLowerName = new Map();

  for (const row of rolePermissions) {
    const candidate = typeof row === 'string' ? row : row?.Name;
    if (!candidate) continue;
    const canonical = lookup.get(String(candidate).trim().toLowerCase()) ?? String(candidate).trim();
    if (canonical) byLowerName.set(canonical.toLowerCase(), canonical);
  }

  for (const permission of normalizeOverrides(extraPermissions, lookup)) {
    byLowerName.set(permission.toLowerCase(), permission);
  }

  for (const permission of normalizeOverrides(excludedPermissions, lookup)) {
    byLowerName.delete(permission.toLowerCase());
  }

  return [...byLowerName.values()].sort((a, b) => a.localeCompare(b));
}

async function resolveRoleInfo(user, pool) {
  const existingName = roleNameFrom(user);
  const existingDisplayName = displayNameFrom(user);
  if (user?.RoleName || user?.role?.Name || user?.role?.name) {
    return {
      sourceName: String(existingName),
      name: canonicalRole(existingName),
      displayName: existingDisplayName || existingName || FALLBACK_ROLE.DisplayName,
    };
  }

  if (!user?.RoleId) {
    return { sourceName: FALLBACK_ROLE.Name, name: FALLBACK_ROLE.Name, displayName: FALLBACK_ROLE.DisplayName };
  }

  const roleResult = await pool.request()
    .input('roleId', sql.VarChar, user.RoleId)
    .query('SELECT Name, DisplayName FROM Roles WHERE Id = @roleId');
  const row = roleResult.recordset[0] ?? FALLBACK_ROLE;
  return {
    sourceName: row.Name,
    name: canonicalRole(row.Name),
    displayName: row.DisplayName || row.Name || FALLBACK_ROLE.DisplayName,
  };
}

async function resolveAssignedSellers(user, pool, roleName, { includeDetails = false } = {}) {
  const userId = user?.Id ?? user?.id ?? user?._id;
  if (!userId) return { ids: [], sellers: [] };

  // Listing team members inherit the seller portfolios of their linked brand
  // managers. This is the same rule the old middleware enforced; keeping it in
  // the shared resolver means `/auth/me` can no longer disagree with routes.
  const isListingTeam = canonicalRole(roleName) === 'listing_team';
  const inheritedSellerIds = isListingTeam ? `
    SELECT DISTINCT SellerId FROM UserSellers WHERE UserId = @userId
    UNION
    SELECT DISTINCT US.SellerId
    FROM UserSellers US
    JOIN UserBrandManagers UBM ON US.UserId = UBM.BrandManagerId
    WHERE UBM.UserId = @userId
  ` : 'SELECT DISTINCT SellerId FROM UserSellers WHERE UserId = @userId';

  // Normal API requests only need IDs for server-side scope checks. Avoid a
  // Sellers join (and optional display columns) on every protected request.
  if (!includeDetails) {
    const result = await pool.request()
      .input('userId', sql.VarChar, userId)
      .query(inheritedSellerIds);
    return {
      ids: result.recordset.map((row) => String(row.SellerId)).filter(Boolean),
      sellers: [],
    };
  }

  const sellerResult = await pool.request()
    .input('userId', sql.VarChar, userId)
    .query(`
      SELECT S.Id, S.Name, S.Marketplace, S.SellerId, S.IsActive, S.[Plan], S.PartnerTag, S.CreatedAt
      FROM Sellers S
      JOIN (${inheritedSellerIds}) AS ScopedSellers ON ScopedSellers.SellerId = S.Id
      WHERE S.IsActive = 1
    `);

  const sellers = sellerResult.recordset.map((seller) => ({
    Id: seller.Id,
    Name: seller.Name,
    Marketplace: seller.Marketplace,
    SellerId: seller.SellerId,
    IsActive: seller.IsActive,
    Plan: seller.Plan,
    PartnerTag: seller.PartnerTag,
    CreatedAt: seller.CreatedAt,
  }));
  return { ids: sellers.map((seller) => String(seller.Id)), sellers };
}

/**
 * Read the server-side source of truth for a user's RBAC + seller scope.
 * Do not cache this across requests: administrators can change role mappings or
 * per-user grants while a user has a valid access token.
 */
async function resolveAccessProfile(user, pool, { includeSellers = false } = {}) {
  const role = await resolveRoleInfo(user, pool);

  const rolePermissionsResult = await pool.request()
    .input('roleId', sql.VarChar, user.RoleId)
    .query(`
      SELECT P.Name
      FROM Permissions P
      JOIN RolePermissions RP ON P.Id = RP.PermissionId
      WHERE RP.RoleId = @roleId
    `);

  const needsOverrideLookup = asArray(user?.ExtraPermissions).length > 0 || asArray(user?.ExcludedPermissions).length > 0;
  const allPermissions = needsOverrideLookup
    ? (await pool.request().query('SELECT Id, Name FROM Permissions')).recordset
    : rolePermissionsResult.recordset;
  const permissions = resolveEffectivePermissions({
    rolePermissions: rolePermissionsResult.recordset,
    allPermissions,
    extraPermissions: user?.ExtraPermissions,
    excludedPermissions: user?.ExcludedPermissions,
  });

  const sellers = await resolveAssignedSellers(user, pool, role.name, { includeDetails: includeSellers });
  return {
    role: {
      Name: role.name,
      name: role.name,
      DisplayName: role.displayName,
      displayName: role.displayName,
      sourceRole: role.sourceName,
    },
    permissions,
    assignedSellers: sellers.ids,
    sellers: sellers.sellers,
    scope: scopeForRole(role.name),
  };
}

/**
 * The only user shape that may cross the auth API boundary.
 *
 * Never spread a SQL Users row here. Those rows contain Password, RefreshToken,
 * password history flags and per-user permission override storage.
 */
function toPublicUser(user, profile) {
  const id = String(user?.Id ?? user?.id ?? user?._id ?? '');
  const email = String(user?.Email ?? user?.email ?? '').trim().toLowerCase();
  const needsPasswordReset = Boolean(user?.ForcePasswordReset)
    || Boolean(user?.PasswordExpiresAt && new Date(user.PasswordExpiresAt) < new Date());
  const requiresSetup = Boolean(user?.IsFirstLogin) && !user?.SetupCompletedAt;

  return {
    Id: id,
    id,
    _id: id,
    Email: email,
    email,
    FirstName: user?.FirstName ?? user?.firstName ?? '',
    LastName: user?.LastName ?? user?.lastName ?? '',
    Avatar: user?.Avatar ?? user?.avatar ?? null,
    Phone: user?.Phone ?? user?.phone ?? null,
    role: profile.role,
    permissions: profile.permissions,
    assignedSellers: profile.assignedSellers,
    sellers: profile.sellers,
    scope: profile.scope,
    requiresSetup,
    needsPasswordReset,
  };
}

module.exports = {
  canonicalRole,
  scopeForRole,
  resolveEffectivePermissions,
  resolveAccessProfile,
  toPublicUser,
};
