/**
 * Global user roles that have unrestricted seller scope.
 *
 * Keep this vocabulary in one place. Route-level permission enforcement still
 * uses permissions (`*` for a full-access account); this helper only answers
 * the separate data-scope question, "may this user select any seller?".
 */
const GLOBAL_ROLES = Object.freeze(['admin', 'super_admin', 'developer', 'operational_manager']);

const ROLE_ALIASES = Object.freeze({
  superadmin: 'super_admin',
  operationalmanager: 'operational_manager',
  brandmanager: 'brand_manager',
  catalogmanager: 'catalog_manager',
  listingteam: 'listing_team',
  sellerclient: 'seller_client',
});

/** Normalize legacy SQL spellings before comparing role names. */
function normalizeRoleName(roleName) {
  if (roleName === undefined || roleName === null) return '';
  const normalized = String(roleName)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  return ROLE_ALIASES[normalized] || normalized;
}

/**
 * Check if a role name represents a global (full-scope) user.
 * @param {string} roleName
 * @returns {boolean}
 */
function isGlobalUserRole(roleName) {
  return GLOBAL_ROLES.includes(normalizeRoleName(roleName));
}

module.exports = { GLOBAL_ROLES, normalizeRoleName, isGlobalUserRole };
