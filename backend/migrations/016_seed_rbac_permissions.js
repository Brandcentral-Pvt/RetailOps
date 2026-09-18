/**
 * Seed the Node-canonical Permissions + RolePermissions from the ROLR
 * controller's own defaultPermissions/defaultRoles (single source of truth).
 * init-database.sql only creates the empty Roles/Permissions/RolePermissions
 * tables (previously populated by the .NET EF migration chain, which is no
 * longer part of the app). Without this, every authorize() guard returns an
 * empty permission set and role-based routes are denied.
 *
 * Idempotent: roleController upserts missing permissions, replaces each role's
 * permission mapping, and never duplicates.
 */
const roleController = require('../controllers/roleController');

module.exports = {
  up: async () => {
    const fakeRes = {
      json: (body) => console.log('[migrate:016]', JSON.stringify(body)),
      status: (code) => ({ json: (body) => console.error('[migrate:016] seed failed', code, JSON.stringify(body)) }),
    };
    await roleController.seedRolesAndPermissions({}, fakeRes);
  },
};