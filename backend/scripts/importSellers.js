/* CLI: node backend/scripts/importSellers.js [path/to/sellers.tsv]
 * Imports the EF-marketplace Sellers dump into Sellers.
 * Idempotent: upserts by Sellers.Id. Marketplace mapping:
 *   1 -> amazon.in, 2 -> ajio, 3 -> myntra  (raw value kept in OctoparseMarketplace)
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { sql, getPool } = require('../database/db');

const MARKETPLACE_MAP = { '1': 'amazon.in', '2': 'ajio', '3': 'myntra' };

const NULL_CELLS = new Set(['NULL', '', 'null']);

function cell(row, idx) {
  const v = row[idx];
  return v === undefined || NULL_CELLS.has(v) ? null : v;
}

function toInt(v) {
  if (v === null) return 0;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? 0 : n;
}

function parseTsv(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(l => l.length > 0);
  const rows = lines.slice(1).map(l => l.split('\t'));
  return rows.map(r => {
    const marketplaceRaw = cell(r, 4);
    const marketplace = MARKETPLACE_MAP[marketplaceRaw] || marketplaceRaw || 'amazon.in';
    const id = cell(r, 0);
    return {
      Id: id,
      SellerId: id,
      Name: cell(r, 1),
      Email: cell(r, 2),
      Phone: cell(r, 3),
      Marketplace: marketplace,
      OctoparseMarketplace: marketplaceRaw,
      OctoparseId: cell(r, 5),
      CometChatUid: cell(r, 7),
      IsActive: toInt(cell(r, 8)),
      LastScrapedAt: cell(r, 9),
      CreatedAt: cell(r, 10) || '2026-01-01T00:00:00',
      CreatedBy: cell(r, 11),
      UpdatedAt: cell(r, 12) || '2026-01-01T00:00:00',
      UpdatedBy: cell(r, 13),
      IsDeleted: toInt(cell(r, 14)),
      DeletedAt: cell(r, 15),
      DeletedBy: cell(r, 16),
    };
  });
}

async function main() {
  const filePath = process.argv[2] || path.join(__dirname, '..', 'data', 'sellers.tsv');
  const rows = parseTsv(filePath);
  if (rows.length === 0) {
    console.error('No rows parsed from', filePath);
    process.exit(1);
  }

  const pool = await getPool();
  const request = pool.request();
  request.input('json', sql.NVarChar(sql.MAX), JSON.stringify(rows));

  const result = await request.query(`
    MERGE INTO Sellers AS t
    USING (
      SELECT [Id], [SellerId], [Name], [Email], [Phone], [Marketplace], [OctoparseMarketplace],
             [OctoparseId], [CometChatUid], [IsActive], [LastScrapedAt], [CreatedAt], [CreatedBy],
             [UpdatedAt], [UpdatedBy], [IsDeleted], [DeletedAt], [DeletedBy]
      FROM OPENJSON(@json) WITH (
        Id VARCHAR(50) '$.Id',
        SellerId NVARCHAR(100) '$.SellerId',
        Name NVARCHAR(255) '$.Name',
        Email NVARCHAR(255) '$.Email',
        Phone NVARCHAR(50) '$.Phone',
        Marketplace NVARCHAR(50) '$.Marketplace',
        OctoparseMarketplace NVARCHAR(50) '$.OctoparseMarketplace',
        OctoparseId NVARCHAR(100) '$.OctoparseId',
        CometChatUid NVARCHAR(100) '$.CometChatUid',
        IsActive BIT '$.IsActive',
        LastScrapedAt DATETIME2 '$.LastScrapedAt',
        CreatedAt DATETIME2 '$.CreatedAt',
        CreatedBy NVARCHAR(100) '$.CreatedBy',
        UpdatedAt DATETIME2 '$.UpdatedAt',
        UpdatedBy NVARCHAR(100) '$.UpdatedBy',
        IsDeleted BIT '$.IsDeleted',
        DeletedAt DATETIME2 '$.DeletedAt',
        DeletedBy NVARCHAR(100) '$.DeletedBy'
      )
    ) AS s
    ON t.Id = s.Id
    WHEN MATCHED THEN UPDATE SET
        SellerId = s.SellerId,
        Name = s.Name,
        Email = s.Email,
        Phone = s.Phone,
        Marketplace = s.Marketplace,
        OctoparseMarketplace = s.OctoparseMarketplace,
        OctoparseId = s.OctoparseId,
        CometChatUid = s.CometChatUid,
        IsActive = s.IsActive,
        LastScrapedAt = s.LastScrapedAt,
        CreatedAt = s.CreatedAt,
        CreatedBy = s.CreatedBy,
        UpdatedAt = s.UpdatedAt,
        UpdatedBy = s.UpdatedBy,
        IsDeleted = s.IsDeleted,
        DeletedAt = s.DeletedAt,
        DeletedBy = s.DeletedBy
    WHEN NOT MATCHED THEN INSERT (
        Id, SellerId, Name, Email, Phone, Marketplace, OctoparseMarketplace, OctoparseId,
        CometChatUid, IsActive, LastScrapedAt, CreatedAt, CreatedBy, UpdatedAt, UpdatedBy,
        IsDeleted, DeletedAt, DeletedBy, IsPriority, ScrapeLimit, LiveSyncEnabled, [Plan]
    ) VALUES (
        s.Id, s.SellerId, s.Name, s.Email, s.Phone, s.Marketplace, s.OctoparseMarketplace, s.OctoparseId,
        s.CometChatUid, s.IsActive, s.LastScrapedAt, s.CreatedAt, s.CreatedBy, s.UpdatedAt, s.UpdatedBy,
        s.IsDeleted, s.DeletedAt, s.DeletedBy, 0, 100, 0, 'Starter'
    );
  `);

  const summary = await pool.request().query(`
    SELECT
      (SELECT COUNT(*) FROM Sellers) AS Total,
      (SELECT COUNT(*) FROM Sellers WHERE Marketplace = 'amazon.in') AS AmazonIn,
      (SELECT COUNT(*) FROM Sellers WHERE Marketplace = 'ajio') AS Ajio,
      (SELECT COUNT(*) FROM Sellers WHERE IsDeleted = 1) AS Deleted,
      (SELECT COUNT(*) FROM Sellers WHERE IsActive = 1) AS Active
  `);

  console.log(`Parsed ${rows.length} rows from ${filePath}`);
  console.log(`MERGE rows affected: ${result.rowsAffected[0]}`);
  console.log('Sellers summary:', JSON.stringify(summary.recordset[0]));
  process.exit(0);
}

main().catch(err => { console.error('Import failed:', err); process.exit(1); });