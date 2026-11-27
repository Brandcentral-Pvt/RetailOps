const { sql, generateId } = require('../database/db');

// A new permission row only; no changes to GMS facts or automatic grants.
// Existing wildcard administrators retain access. Other roles need an explicit grant.
module.exports = { up: async (pool) => {
  await pool.request()
    .input('id', sql.VarChar, generateId())
    .query(`
      IF NOT EXISTS (SELECT 1 FROM Permissions WHERE Name = 'gms_tracker_delete')
        INSERT INTO Permissions (Id, Name, DisplayName, Description, Category, Action, CreatedAt)
        VALUES (@id, 'gms_tracker_delete', 'GMS Tracker: Delete', 'Clear all GMS data (global scope only)', 'GMS Tracker', 'delete', dbo.GetEnvDate());
      UPDATE Permissions SET Description = 'Export GMS Tracker data' WHERE Name = 'gms_tracker_export';
    `);
} };
