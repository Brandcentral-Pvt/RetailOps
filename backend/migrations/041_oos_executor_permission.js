/**
 * Migration 041: Add tasks_execute permission
 *
 * Adds the tasks_execute permission for executor-level OOS operations
 * (upload, reconcile, submit), separate from tasks_manage which is
 * administrator-level.
 */
module.exports = {
  up: async (pool) => {
    const q = (s) => pool.request().query(s);

    // Insert tasks_execute permission if not exists
    await q(`
      IF NOT EXISTS (SELECT 1 FROM dbo.Permissions WHERE Name = 'tasks_execute')
      BEGIN
        INSERT INTO dbo.Permissions (Id, Name, DisplayName, Description, Category, Action, CreatedAt)
        VALUES (
          SUBSTRING(LOWER(REPLACE(CAST(NEWID() AS VARCHAR(36)), '-', '')), 1, 24),
          'tasks_execute',
          'Optimization Tasks: Execute',
          'Execute routine OOS operations (upload, reconcile, submit)',
          'Automation',
          'execute',
          GETUTCDATE()
        );
      END
    `);

    // Grant tasks_execute to Brand Manager role
    await q(`
      IF NOT EXISTS (SELECT 1 FROM dbo.RolePermissions RP
                     JOIN dbo.Permissions P ON P.Id = RP.PermissionId
                     JOIN dbo.Roles R ON R.Id = RP.RoleId
                     WHERE P.Name = 'tasks_execute' AND R.Name = 'Brand Manager')
      BEGIN
        INSERT INTO dbo.RolePermissions (RoleId, PermissionId)
        SELECT R.Id, P.Id
        FROM dbo.Roles R, dbo.Permissions P
        WHERE R.Name = 'Brand Manager' AND P.Name = 'tasks_execute';
      END
    `);

    // Grant tasks_execute to catalog_manager role
    await q(`
      IF NOT EXISTS (SELECT 1 FROM dbo.RolePermissions RP
                     JOIN dbo.Permissions P ON P.Id = RP.PermissionId
                     JOIN dbo.Roles R ON R.Id = RP.RoleId
                     WHERE P.Name = 'tasks_execute' AND R.Name = 'catalog_manager')
      BEGIN
        INSERT INTO dbo.RolePermissions (RoleId, PermissionId)
        SELECT R.Id, P.Id
        FROM dbo.Roles R, dbo.Permissions P
        WHERE R.Name = 'catalog_manager' AND P.Name = 'tasks_execute';
      END
    `);

    // Grant tasks_execute to listing_team role
    await q(`
      IF NOT EXISTS (SELECT 1 FROM dbo.RolePermissions RP
                     JOIN dbo.Permissions P ON P.Id = RP.PermissionId
                     JOIN dbo.Roles R ON R.Id = RP.RoleId
                     WHERE P.Name = 'tasks_execute' AND R.Name = 'listing_team')
      BEGIN
        INSERT INTO dbo.RolePermissions (RoleId, PermissionId)
        SELECT R.Id, P.Id
        FROM dbo.Roles R, dbo.Permissions P
        WHERE R.Name = 'listing_team' AND P.Name = 'tasks_execute';
      END
    `);

    console.log('[Migration 039] ✅ OOS review and waiver fields');
  },
};