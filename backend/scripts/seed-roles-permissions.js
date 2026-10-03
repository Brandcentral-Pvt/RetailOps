const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { sql, getPool, generateId } = require('../database/db');

async function seed() {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  const request = transaction.request();

  try {
    console.log('🌱 Starting seed: roles and permissions...');

    // 1. Insert missing permissions
    const existingPermsResult = await request.query('SELECT Name FROM Permissions');
    const existingPermNames = new Set(existingPermsResult.recordset.map(p => p.Name));

    const newPermissions = [
      { name: '*', displayName: 'Full Access (Wildcard)', description: 'Grants all permissions; held only by admin/super_admin', category: 'System', action: 'wildcard' },
      { name: 'alerts_view', displayName: 'Alerts: View', description: 'View own alerts without full dashboard access', category: 'Analytics', action: 'view' },
      { name: 'tasks_submit', displayName: 'Optimization Tasks: Submit', description: 'Raise a new task/request (seller-facing)', category: 'Automation', action: 'submit' },
      { name: 'tasks_approve', displayName: 'Optimization Tasks: Approve', description: 'Approve/reject tasks assigned to seller', category: 'Automation', action: 'approve' },
    ];

    for (const perm of newPermissions) {
      if (!existingPermNames.has(perm.name)) {
        await request
          .input('id', sql.VarChar, generateId())
          .input('name', sql.VarChar, perm.name)
          .input('displayName', sql.VarChar, perm.displayName)
          .input('description', sql.NVarChar, perm.description || null)
          .input('category', sql.NVarChar, perm.category)
          .input('action', sql.NVarChar, perm.action)
          .query(`
            INSERT INTO Permissions (Id, Name, DisplayName, Description, Category, Action, CreatedAt, UpdatedAt)
            VALUES (@id, @name, @displayName, @description, @category, @action, dbo.GetEnvDate(), dbo.GetEnvDate())
          `);
        console.log(`  ✅ Added permission: ${perm.name}`);
      }
    }

    // 2. Refresh permissions list
    const allPermsResult = await request.query('SELECT Id, Name FROM Permissions');
    const allPermissions = allPermsResult.recordset;
    const getPermIds = (filterFn) => allPermissions.filter(filterFn).map(p => p.Id);

    // 3. Seed roles and permissions
    const defaultRoles = [
      {
        name: 'admin',
        displayName: 'Super Admin',
        description: 'Master access to all system modules and security settings.',
        isSystem: true,
        level: 100,
        color: '#EF4444',
      },
      {
        name: 'operational_manager',
        displayName: 'Operational Manager',
        description: 'Full operational control over marketplace, tasks, and teams except security settings.',
        isSystem: true,
        level: 90,
        color: '#8B5CF6',
      },
      {
        name: 'Brand Manager',
        displayName: 'Brand Manager',
        description: 'Manages specific brands, view ASIN manager with export, and manage optimization tasks.',
        isSystem: true,
        level: 50,
        color: '#3B82F6',
      },
      {
        name: 'catalog_manager',
        displayName: 'Catalog Manager',
        description: 'Access to ASIN Manager (export only, view all sellers) and Optimization Tasks.',
        isSystem: true,
        level: 30,
        color: '#F472B6',
      },
      {
        name: 'listing_team',
        displayName: 'Listing Team',
        description: 'Access to ASIN Manager and Optimization Tasks for assigned Brand Managers data.',
        isSystem: true,
        level: 25,
        color: '#10B981',
      },
      {
        name: 'seller_client',
        displayName: 'Seller',
        description: 'External seller account holder. Scoped to their own seller account: performance, products, requests, chat. No internal operations.',
        isSystem: true,
        level: 20,
        color: '#0E7490',
      },
    ];

    const permissionSets = {
      admin: allPermissions.map(p => p.Id),
      operational_manager: getPermIds(p => !['settings_manage', 'users_view', 'users_manage', 'roles_view', 'roles_manage', 'apikeys_manage'].includes(p.Name)),
      'brand_manager': getPermIds(p => ['seller_view', 'asinmanager_view', 'asinmanager_export', 'asinmanager_import', 'asintracker_view', 'keywords_view', 'keywords_export', 'tasks_view', 'tasks_manage', 'targets_view', 'gms_tracker_view', 'gms_tracker_import', 'gms_tracker_export', 'dashboard_view', 'alerts_view', 'chat_view', 'adsreport_view', 'adsreport_export', 'actions_view', 'skureport_view', 'parentreport_view', 'monthlyreport_view', 'inventoryreport_view'].includes(p.Name)),
      catalog_manager: getPermIds(p => ['seller_view', 'asinmanager_view', 'asinmanager_export', 'asintracker_view', 'keywords_view', 'keywords_export', 'tasks_view', 'tasks_manage', 'targets_view', 'gms_tracker_view', 'dashboard_view', 'alerts_view', 'chat_view', 'inventoryreport_view'].includes(p.Name)),
      listing_team: getPermIds(p => ['seller_view', 'asinmanager_view', 'asintracker_view', 'keywords_view', 'keywords_export', 'tasks_view', 'tasks_manage', 'targets_view', 'gms_tracker_view', 'dashboard_view', 'alerts_view', 'chat_view', 'actions_view'].includes(p.Name)),
      seller_client: getPermIds(p => ['dashboard_view', 'alerts_view', 'asinmanager_view', 'asinmanager_export', 'asintracker_view', 'keywords_view', 'adsreport_view', 'adsreport_export', 'gms_tracker_view', 'gms_tracker_export', 'skureport_view', 'parentreport_view', 'monthlyreport_view', 'inventoryreport_view', 'targets_view', 'tasks_view', 'tasks_submit', 'tasks_approve', 'chat_view'].includes(p.Name)),
    };

    for (const roleData of defaultRoles) {
      const existingResult = await request
        .input('name', sql.NVarChar, roleData.name)
        .query('SELECT Id, IsSystem FROM Roles WHERE Name = @name');

      const roleId = existingResult.recordset.length > 0 ? existingResult.recordset[0].Id : generateId();
      const rolePerms = permissionSets[roleData.name] || [];

      if (existingResult.recordset.length === 0) {
        await request
          .input('id', sql.VarChar, roleId)
          .input('name', sql.NVarChar, roleData.name)
          .input('displayName', sql.NVarChar, roleData.displayName)
          .input('description', sql.NVarChar, roleData.description || null)
          .input('level', sql.Int, roleData.level)
          .input('color', sql.NVarChar, roleData.color)
          .input('isSystem', sql.Bit, 1)
          .input('isActive', sql.Bit, 1)
          .query(`
            INSERT INTO Roles (Id, Name, DisplayName, Description, Level, Color, IsSystem, IsActive, CreatedAt, UpdatedAt)
            VALUES (@id, @name, @displayName, @description, @level, @color, @isSystem, @isActive, dbo.GetEnvDate(), dbo.GetEnvDate())
          `);
        console.log(`  ✅ Created role: ${roleData.name}`);
      } else if (existingResult.recordset[0].IsSystem) {
        await request
          .input('id', sql.VarChar, roleId)
          .input('displayName', sql.NVarChar, roleData.displayName)
          .input('description', sql.NVarChar, roleData.description || null)
          .input('level', sql.Int, roleData.level)
          .input('color', sql.NVarChar, roleData.color)
          .query(`
            UPDATE Roles SET
              DisplayName = @displayName,
              Description = @description,
              Level = @level,
              Color = @color,
              UpdatedAt = dbo.GetEnvDate()
            WHERE Id = @id
          `);
        console.log(`  🔄 Updated role: ${roleData.name}`);
      }

      // Update role permissions
      await request.input('roleId', sql.VarChar, roleId).query('DELETE FROM RolePermissions WHERE RoleId = @roleId');
      for (const permId of rolePerms) {
        await request
          .input('roleId', sql.VarChar, roleId)
          .input('permId', sql.VarChar, permId)
          .query('INSERT INTO RolePermissions (RoleId, PermissionId) VALUES (@roleId, @permId)');
      }
      console.log(`  ✅ Synced ${rolePerms.length} permissions for role: ${roleData.name}`);
    }

    await transaction.commit();
    console.log('🎉 Seed completed successfully!');
  } catch (err) {
    await transaction.rollback();
    console.error('❌ Seed failed:', err);
    throw err;
  } finally {
    await pool.close();
  }
}

seed().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});