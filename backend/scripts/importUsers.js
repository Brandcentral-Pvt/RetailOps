/* CLI: node backend/scripts/importUsers.js [path/to/users.csv]
 * Imports the EF-marketplace Users dump into Users.
 * Idempotent: upserts by Users.Id.
 * Dump RoleId -> current Roles.Name mapping (confirmed with user):
 *   08089989be4443258725247f -> brand_manager
 *   517131d7d7e04337bbdea3d4 -> operational_manager
 *   0ba9c815c59b4fc0a9d3c1e9 -> admin
 *   operator -> viewer
 *   3848e80c59e74beabc82988c -> viewer
 *   545deced4ea84d6799012b9a -> viewer
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { sql, getPool } = require('../database/db');

const ROLE_MAP = {
  '08089989be4443258725247f': 'brand_manager',
  '517131d7d7e04337bbdea3d4': 'operational_manager',
  '0ba9c815c59b4fc0a9d3c1e9': 'admin',
  'operator': 'viewer',
  '3848e80c59e74beabc82988c': 'viewer',
  '545deced4ea84d6799012b9a': 'viewer',
};

const NULL_CELLS = new Set(['NULL', 'null', '']);
const toNull = (v) => (v === undefined || v === null || NULL_CELLS.has(v.trim ? v.trim() : v) ? null : v);
const toInt = (v) => { const n = parseInt(v, 10); return Number.isNaN(n) ? 0 : n; };

function parseCsv(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(l => l.trim().length > 0);
  const rows = lines.slice(1).map(l => l.split(',').map(s => s.trim()));
  return rows.map(r => {
    const createdAt = toNull(r[10]) || toNull(r[11]) || new Date().toISOString();
    const updatedAt = toNull(r[11]) || createdAt;
    return {
      Id: toNull(r[0]),
      Email: toNull(r[1]),
      PasswordHash: toNull(r[2]),
      FirstName: toNull(r[3]),
      LastName: toNull(r[4]),
      Phone: toNull(r[5]),
      Avatar: toNull(r[6]),
      LegacyRoleId: toNull(r[7]),
      IsActive: toInt(r[8]),
      IsOnline: toInt(r[9]),
      CreatedAt: createdAt,
      UpdatedAt: updatedAt,
    };
  });
}

async function main() {
  const filePath = process.argv[2] || path.join(__dirname, '..', 'data', 'users.csv');
  const rows = parseCsv(filePath);
  if (rows.length === 0) { console.error('No rows parsed from', filePath); process.exit(1); }

  const pool = await getPool();

  const roleRows = await pool.request().query('SELECT Id, Name FROM Roles');
  const roleIdByName = {};
  roleRows.recordset.forEach(r => { roleIdByName[r.Name] = r.Id; });

  let unmapped = 0;
  const enriched = rows.map(r => {
    const roleName = ROLE_MAP[r.LegacyRoleId];
    const roleId = roleName ? roleIdByName[roleName] : undefined;
    if (!roleId) { unmapped++; console.warn('UNMAPPED RoleId:', r.LegacyRoleId, '->', roleName, 'for', r.Email); }
    return { ...r, RoleId: roleId || roleIdByName['viewer'], RoleName: roleName };
  });
  if (unmapped > 0) { console.error(`Aborting: ${unmapped} rows have no valid role mapping`); process.exit(1); }

  const request = pool.request();
  request.input('json', sql.NVarChar(sql.MAX), JSON.stringify(enriched));

  const result = await request.query(`
    MERGE INTO Users AS t
    USING (
      SELECT [Id], [Email], [PasswordHash], [FirstName], [LastName], [Phone], [Avatar],
             [RoleId], [IsActive], [IsOnline], [CreatedAt], [UpdatedAt]
      FROM OPENJSON(@json) WITH (
        Id VARCHAR(50) '$.Id',
        Email NVARCHAR(255) '$.Email',
        PasswordHash NVARCHAR(MAX) '$.PasswordHash',
        FirstName NVARCHAR(255) '$.FirstName',
        LastName NVARCHAR(255) '$.LastName',
        Phone NVARCHAR(50) '$.Phone',
        Avatar NVARCHAR(MAX) '$.Avatar',
        RoleId VARCHAR(50) '$.RoleId',
        IsActive BIT '$.IsActive',
        IsOnline BIT '$.IsOnline',
        CreatedAt DATETIME2 '$.CreatedAt',
        UpdatedAt DATETIME2 '$.UpdatedAt'
      )
    ) AS s
    ON t.Id = s.Id
    WHEN MATCHED THEN UPDATE SET
        Email = s.Email,
        Password = s.PasswordHash,
        PasswordHash = s.PasswordHash,
        FirstName = s.FirstName,
        LastName = s.LastName,
        Phone = s.Phone,
        Avatar = s.Avatar,
        RoleId = s.RoleId,
        IsActive = s.IsActive,
        IsOnline = s.IsOnline,
        UpdatedAt = s.UpdatedAt
    WHEN NOT MATCHED THEN INSERT (
        Id, Email, Password, PasswordHash, FirstName, LastName, Phone, Avatar,
        RoleId, IsActive, IsOnline, IsFirstLogin, IsEmailVerified, SecurityPolicyAccepted,
        CreatedAt, UpdatedAt
    ) VALUES (
        s.Id, s.Email, s.PasswordHash, s.PasswordHash, s.FirstName, s.LastName, s.Phone, s.Avatar,
        s.RoleId, s.IsActive, s.IsOnline, 0, 1, 1,
        s.CreatedAt, s.UpdatedAt
    );
  `);

  const summary = await pool.request().query(`
    SELECT
      (SELECT COUNT(*) FROM Users) AS Total,
      (SELECT COUNT(*) FROM Users WHERE IsActive = 1) AS Active,
      (SELECT COUNT(*) FROM Users WHERE RoleId = (SELECT Id FROM Roles WHERE Name = 'brand_manager')) AS BrandManagers,
      (SELECT COUNT(*) FROM Users WHERE RoleId = (SELECT Id FROM Roles WHERE Name = 'operational_manager')) AS Ops,
      (SELECT COUNT(*) FROM Users WHERE RoleId = (SELECT Id FROM Roles WHERE Name = 'admin')) AS Admins,
      (SELECT COUNT(*) FROM Users WHERE RoleId = (SELECT Id FROM Roles WHERE Name = 'viewer')) AS Viewers
  `);

  console.log(`Parsed ${rows.length} rows from ${filePath}`);
  console.log(`MERGE rows affected: ${result.rowsAffected[0]}`);
  console.log('Users summary:', JSON.stringify(summary.recordset[0]));
  process.exit(0);
}

main().catch(err => { console.error('Import failed:', err); process.exit(1); });