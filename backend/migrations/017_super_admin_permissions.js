/**
 * Ensure the system super-admin roles carry the full permission set.
 *
 * roleController.seedRolesAndPermissions (016) grants every permission to the
 * 'admin' role only; roles pre-seeded by init-database.sql as role-* (e.g.
 * role-super-admin, role-admin) end up with zero mapped permissions otherwise.
 * This grants all permissions to role-super-admin (and role-admin) idempotently.
 */
module.exports = {
  up: async (pool) => {
    const result = await pool.request().query(`
      INSERT INTO RolePermissions (RoleId, PermissionId)
      SELECT r.Id, p.Id
      FROM Roles r
      CROSS JOIN Permissions p
      WHERE r.Id IN ('role-admin', 'role-super-admin')
        AND r.Id NOT IN (SELECT DISTINCT RoleId FROM RolePermissions)
    `);
    return { rowsInserted: result.rowsAffected?.[0] || 0 };
  },
};