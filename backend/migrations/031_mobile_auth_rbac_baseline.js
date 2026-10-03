/**
 * 031 — mobile authentication / RBAC baseline.
 *
 * Migration 016 may already be recorded on production databases from before
 * `seller_client` and its seller-facing capabilities were added. Re-running
 * that migration is deliberately impossible, so this migration adds only the
 * missing, safe baseline rows:
 *   - missing seller/mobile capability permissions and target edit grants;
 *   - the system seller_client role and its minimum capability set;
 *   - the missing Brand Manager mappings caused by the historical
 *     `brand_manager` / `Brand Manager` key mismatch;
 *   - the explicit `*` permission for legacy admin rows.
 *
 * It never deletes mappings, so a deliberate per-role grant remains intact.
 */
const { sql, generateId } = require('../database/db');

const PERMISSIONS = [
  { name: '*', displayName: 'Full Access (Wildcard)', description: 'Grants all permissions; held only by full-access administrator roles.', category: 'System', action: 'wildcard' },
  { name: 'alerts_view', displayName: 'Alerts: View', description: 'View alerts without granting full dashboard management.', category: 'Analytics', action: 'view' },
  { name: 'tasks_submit', displayName: 'Optimization Tasks: Submit', description: 'Raise a seller-facing request.', category: 'Automation', action: 'submit' },
  { name: 'tasks_approve', displayName: 'Optimization Tasks: Approve', description: 'Approve or reject tasks assigned to a seller.', category: 'Automation', action: 'approve' },
  { name: 'targets_create', displayName: 'Targets: Create Goals', description: 'Create seller targets and goals.', category: 'Targets', action: 'create' },
  { name: 'targets_edit', displayName: 'Targets: Edit Goals', description: 'Edit seller targets and achievements.', category: 'Targets', action: 'edit' },
];

const SELLER_PERMISSIONS = [
  'dashboard_view', 'alerts_view',
  'asinmanager_view', 'asinmanager_export', 'asintracker_view', 'keywords_view',
  'adsreport_view', 'adsreport_export',
  'gms_tracker_view', 'gms_tracker_export',
  'skureport_view', 'parentreport_view', 'monthlyreport_view', 'inventoryreport_view',
  'targets_view', 'tasks_view', 'tasks_submit', 'tasks_approve', 'chat_view',
];

const BRAND_MANAGER_PERMISSIONS = [
  'seller_view',
  'asinmanager_view', 'asinmanager_export', 'asinmanager_import', 'asintracker_view',
  'keywords_view', 'keywords_export',
  'tasks_view', 'tasks_manage',
  'targets_view', 'targets_create', 'targets_edit',
  'gms_tracker_view', 'gms_tracker_import', 'gms_tracker_export',
  'dashboard_view', 'alerts_view', 'chat_view',
  'adsreport_view', 'adsreport_export', 'actions_view',
  'skureport_view', 'parentreport_view', 'monthlyreport_view', 'inventoryreport_view',
];

async function ensurePermission(pool, permission) {
  const found = await pool.request()
    .input('name', sql.NVarChar, permission.name)
    .query('SELECT Id FROM Permissions WHERE Name = @name');
  if (found.recordset[0]) return found.recordset[0].Id;

  const id = generateId();
  await pool.request()
    .input('id', sql.VarChar, id)
    .input('name', sql.NVarChar, permission.name)
    .input('displayName', sql.NVarChar, permission.displayName)
    .input('description', sql.NVarChar, permission.description)
    .input('category', sql.NVarChar, permission.category)
    .input('action', sql.NVarChar, permission.action)
    .query(`
      INSERT INTO Permissions (Id, Name, DisplayName, Description, Category, Action, CreatedAt)
      VALUES (@id, @name, @displayName, @description, @category, @action, dbo.GetEnvDate())
    `);
  return id;
}

async function permissionIds(pool) {
  const result = await pool.request().query('SELECT Id, Name FROM Permissions');
  return new Map(result.recordset.map((row) => [row.Name, row.Id]));
}

async function ensureRole(pool, { name, displayName, description, level, color }) {
  const found = await pool.request()
    .input('name', sql.NVarChar, name)
    .query('SELECT Id FROM Roles WHERE Name = @name');
  if (found.recordset[0]) return found.recordset[0].Id;

  const id = generateId();
  await pool.request()
    .input('id', sql.VarChar, id)
    .input('name', sql.NVarChar, name)
    .input('displayName', sql.NVarChar, displayName)
    .input('description', sql.NVarChar, description)
    .input('level', sql.Int, level)
    .input('color', sql.NVarChar, color)
    .query(`
      INSERT INTO Roles (Id, Name, DisplayName, Description, Level, Color, IsSystem, IsActive, CreatedAt, UpdatedAt)
      VALUES (@id, @name, @displayName, @description, @level, @color, 1, 1, dbo.GetEnvDate(), dbo.GetEnvDate())
    `);
  return id;
}

async function grant(pool, roleId, permissionId) {
  if (!permissionId) return false;
  const result = await pool.request()
    .input('roleId', sql.VarChar, roleId)
    .input('permissionId', sql.VarChar, permissionId)
    .query(`
      IF NOT EXISTS (
        SELECT 1 FROM RolePermissions WHERE RoleId = @roleId AND PermissionId = @permissionId
      )
      BEGIN
        INSERT INTO RolePermissions (RoleId, PermissionId) VALUES (@roleId, @permissionId);
        SELECT CAST(1 AS INT) AS inserted;
      END
      ELSE SELECT CAST(0 AS INT) AS inserted;
    `);
  return result.recordset[0]?.inserted === 1;
}

module.exports = {
  up: async (pool) => {
    for (const permission of PERMISSIONS) await ensurePermission(pool, permission);
    const ids = await permissionIds(pool);

    const sellerRoleId = await ensureRole(pool, {
      name: 'seller_client',
      displayName: 'Seller',
      description: 'External seller account holder. Scoped to their own seller account.',
      level: 20,
      color: '#0E7490',
    });

    let mappingsAdded = 0;
    for (const name of SELLER_PERMISSIONS) {
      if (await grant(pool, sellerRoleId, ids.get(name))) mappingsAdded += 1;
    }

    // Repair the role-key spelling bug without removing a manually granted
    // capability. Both spellings occur in historical SQL databases.
    for (const roleName of ['Brand Manager', 'brand_manager']) {
      const found = await pool.request().input('name', sql.NVarChar, roleName).query('SELECT Id FROM Roles WHERE Name = @name');
      const roleId = found.recordset[0]?.Id;
      if (!roleId) continue;
      for (const name of BRAND_MANAGER_PERMISSIONS) {
        if (await grant(pool, roleId, ids.get(name))) mappingsAdded += 1;
      }
    }

    // Full access is a permission, not a frontend or middleware role-name
    // exception. Cover the canonical and older super-admin row names.
    for (const roleName of ['admin', 'super_admin']) {
      const found = await pool.request().input('name', sql.NVarChar, roleName).query('SELECT Id FROM Roles WHERE Name = @name');
      if (found.recordset[0] && await grant(pool, found.recordset[0].Id, ids.get('*'))) mappingsAdded += 1;
    }

    return { sellerRoleId, mappingsAdded };
  },
};
