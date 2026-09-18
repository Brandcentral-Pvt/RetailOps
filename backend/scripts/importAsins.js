/* CLI: node backend/scripts/importAsins.js [path/to/asins.csv]
 * Imports the Asins dump (ID,SellerID,ASIN — trailing comma columns ignored) into Asins.
 * Idempotent: MERGE on the unique (AsinCode, SellerId) key (UC_Asin_Seller).
 * Rows whose SellerId is not in the Sellers table are skipped and counted.
 * Marketplace is resolved from the seller; Status='Active', ScrapeStatus='PENDING'
 * to match the app's bulk-upload convention. */
const fs = require('fs');
const readline = require('readline');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { sql, getPool } = require('../database/db');

const CHUNK = 20000;

async function main() {
  const filePath = process.argv[2] || path.join(__dirname, '..', 'data', 'asins.csv');
  if (!fs.existsSync(filePath)) { console.error('Missing file:', filePath); process.exit(1); }

  const pool = await getPool();
  const sellerRes = await pool.request().query('SELECT Id, Marketplace FROM Sellers');
  const sellerMap = new Map(sellerRes.recordset.map(s => [String(s.Id).trim().toLowerCase(), s.Marketplace]));

  const rows = [];
  const seen = new Set();
  let read = 0, dupKeys = 0, orphan = 0;

  const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });
  let first = true;
  for await (const line of rl) {
    if (first) { first = false; continue; }
    if (!line.trim()) continue;
    const p = line.split(',');
    const id = (p[0] || '').trim();
    const sid = (p[1] || '').trim();
    const asin = (p[2] || '').trim();
    if (!id || !sid || !asin) continue;
    read++;

    const key = asin + '|' + sid;
    if (seen.has(key)) { dupKeys++; continue; }
    seen.add(key);

    const marketplace = sellerMap.get(String(sid).toLowerCase());
    if (marketplace === undefined) { orphan++; continue; }

    rows.push({
      Id: id,
      SellerId: sid,
      AsinCode: asin,
      Marketplace: marketplace || null,
    });
  }
  console.log(`Read ${read} rows | unique (ASIN,SellerId): ${rows.length} | dup keys skipped: ${dupKeys} | orphan sellers skipped: ${orphan}`);

  let inserted = 0, updated = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const request = pool.request();
    request.input('json', sql.NVarChar(sql.MAX), JSON.stringify(chunk));
    const result = await request.query(`
      MERGE INTO Asins AS t
      USING (
        SELECT [Id], [SellerId], [AsinCode], [Marketplace]
        FROM OPENJSON(@json) WITH (
          Id VARCHAR(24) '$.Id',
          SellerId VARCHAR(24) '$.SellerId',
          AsinCode VARCHAR(50) '$.AsinCode',
          Marketplace NVARCHAR(200) '$.Marketplace'
        )
      ) AS s
      ON t.AsinCode = s.AsinCode AND t.SellerId = s.SellerId
      WHEN MATCHED THEN UPDATE SET
        Marketplace = s.Marketplace,
        Status = 'Active',
        ScrapeStatus = 'PENDING',
        UpdatedAt = dbo.GetEnvDate()
      WHEN NOT MATCHED THEN INSERT (
        Id, AsinCode, SellerId, Marketplace, Status, ScrapeStatus, CreatedAt, UpdatedAt
      ) VALUES (
        s.Id, s.AsinCode, s.SellerId, s.Marketplace, 'Active', 'PENDING', dbo.GetEnvDate(), dbo.GetEnvDate()
      );
    `);
    updated += result.rowsAffected[0] === undefined ? 0 : 0;
    console.log(`  batch ${i / CHUNK + 1}/${Math.ceil(rows.length / CHUNK)} done (rows affected: ${result.rowsAffected[0]})`);
  }
  process.exit(0);
}

main().catch(err => { console.error('Import failed:', err); process.exit(1); });