/* CLI: node backend/scripts/importUserSellers.js [path/to/usersellers.tsv]
 * Seeds UserSellers (UserId, SellerId) bindings from a TSV dump (header: UserId\tSellerId).
 * Idempotent: MERGE on the composite PK. Validates UserIds against Users (FK) and
 * reports SellerIds missing from Sellers (no FK there, informational only). */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { sql, getPool } = require('../database/db');

function parseTsv(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(l => l.trim().length > 0);
  const rows = lines.slice(1).map(l => {
    const [UserId, SellerId] = l.split('\t').map(s => s.trim());
    return { UserId, SellerId };
  });
  return rows.filter(r => r.UserId && r.SellerId);
}

async function main() {
  const filePath = process.argv[2] || path.join(__dirname, '..', 'data', 'usersellers.tsv');
  let rows = parseTsv(filePath);
  if (rows.length === 0) { console.error('No rows parsed from', filePath); process.exit(1); }

  const seen = new Set();
  rows = rows.filter(r => {
    const key = r.UserId + '|' + r.SellerId;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  console.log(`Parsed ${fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(l => l.trim().length > 0).length - 1} rows, ${rows.length} unique after dedupe`);

  const pool = await getPool();

  const userIds = [...new Set(rows.map(r => r.UserId))];
  const sellerIds = [...new Set(rows.map(r => r.SellerId))];

  const usr = await pool.request();
  usr.input('ids', sql.NVarChar(sql.MAX), JSON.stringify(userIds));
  const existingUsers = new Set((await usr.query(
    "SELECT Id FROM Users WHERE Id IN (SELECT value FROM OPENJSON(@ids))"
  )).recordset.map(r => r.Id));
  const orphansUsers = userIds.filter(id => !existingUsers.has(id));

  const sel = await pool.request();
  sel.input('ids', sql.NVarChar(sql.MAX), JSON.stringify(sellerIds));
  const existingSellers = new Set((await sel.query(
    "SELECT Id FROM Sellers WHERE Id IN (SELECT value FROM OPENJSON(@ids))"
  )).recordset.map(r => r.Id));
  const orphansSellers = sellerIds.filter(id => !existingSellers.has(id));

  console.log(`Distinct UserIds: ${userIds.length}, distinct SellerIds: ${sellerIds.length}`);
  if (orphansUsers.length > 0) {
    console.error(`ABORT: ${orphansUsers.length} UserIds not in Users (FK_UserSellers_User would fail):`, orphansUsers.join(', '));
    process.exit(1);
  }
  if (orphansSellers.length > 0) {
    console.warn(`WARN: ${orphansSellers.length} SellerIds not in Sellers (informational, no FK):`);
    console.warn(orphansSellers.join(', '));
  }

  const request = pool.request();
  request.input('json', sql.NVarChar(sql.MAX), JSON.stringify(rows));
  const result = await request.query(`
    MERGE INTO UserSellers AS t
    USING (
      SELECT [UserId], [SellerId]
      FROM OPENJSON(@json) WITH (
        UserId VARCHAR(50) '$.UserId',
        SellerId VARCHAR(50) '$.SellerId'
      )
    ) AS s
    ON t.UserId = s.UserId AND t.SellerId = s.SellerId
    WHEN NOT MATCHED THEN INSERT (UserId, SellerId) VALUES (s.UserId, s.SellerId);
  `);

  const summary = await pool.request().query(`
    SELECT
      (SELECT COUNT(*) FROM UserSellers) AS Total,
      (SELECT COUNT(DISTINCT UserId) FROM UserSellers) AS Users,
      (SELECT COUNT(DISTINCT SellerId) FROM UserSellers) AS Sellers
  `);
  console.log(`MERGE rows affected: ${result.rowsAffected[0]}`);
  console.log('UserSellers summary:', JSON.stringify(summary.recordset[0]));
  process.exit(0);
}

main().catch(err => { console.error('Import failed:', err); process.exit(1); });