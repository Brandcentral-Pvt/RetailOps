/**
 * Targeted backfill for DLY-003 only (ASP Monitoring & Mismatch Check).
 * Run: node backend/scripts/backfillDly003.js --apply
 */
const sql = require('mssql');
require('dotenv').config({ path: './.env' });

const { asinUsableSqlFor } = require('../utils/asinUtils');

const APPLY = process.argv.includes('--apply');
const DRY_RUN = !APPLY;

const SIGNALS = {
  'DLY-003': [
    {
      code: 'PRICE_DISPUTE', severity: 'critical',
      where: `a.PriceDispute = 1 AND a.CurrentPrice IS NOT NULL AND a.UploadedPrice IS NOT NULL`,
      numeric: 'ABS(a.CurrentPrice - a.UploadedPrice)',
      string: 'a.CurrentPrice',
      labelTpl: (row) => `Price dispute: current ${row.CurrentPrice} vs uploaded ${row.UploadedPrice} (delta ${Math.abs(row.CurrentPrice - row.UploadedPrice)})`,
    },
    {
      code: 'ASP_MISMATCH', severity: 'major',
      where: `a.CurrentPrice IS NOT NULL AND a.UploadedPrice IS NOT NULL AND a.CurrentPrice <> a.UploadedPrice AND a.PriceDispute = 0`,
      numeric: 'ABS(a.CurrentPrice - a.UploadedPrice)',
      string: 'a.CurrentPrice',
      labelTpl: (row) => `ASP mismatch: current ${row.CurrentPrice} vs uploaded ${row.UploadedPrice} (delta ${Math.abs(row.CurrentPrice - row.UploadedPrice)})`,
    },
  ],
};

const genId = () => Math.random().toString(36).substring(2, 15) + Date.now().toString(36);

async function main() {
  const pool = await sql.connect({
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    server: '127.0.0.1', database: 'retailops', port: 1433,
    options: { trustServerCertificate: true, encrypt: false, requestTimeout: 600000 },
  });

  const tasks = await pool.request().query(`
    SELECT ti.Id AS taskId, t.TaskCode
    FROM PemsTaskInstances ti
    JOIN PemsTaskTemplates t ON ti.TemplateId = t.Id
    WHERE ti.Status IN ('ASSIGNED','IN_PROGRESS','SUBMITTED','RESUBMITTED')
      AND t.TaskCode = 'DLY-003'
  `);

  let totalInserted = 0, totalSkipped = 0;
  const byTemplate = {};

  for (const task of tasks.recordset) {
    const signals = SIGNALS[task.TaskCode] || [];
    if (!signals.length) continue;

    const brands = await pool.request()
      .input('taskId', sql.VarChar, task.taskId)
      .query(`SELECT SellerId, SellerName FROM PemsTaskBrands WHERE TaskInstanceId = @taskId`);

    if (!brands.recordset.length) continue;

    for (const { SellerId, SellerName } of brands.recordset) {
      for (const sig of signals) {
        const usable = asinUsableSqlFor('a.AsinCode');
        const cols = ['a.AsinCode'];
        if (sig.numeric) cols.push(sig.numeric + ' AS numericValue');
        if (sig.string) cols.push('CAST(' + sig.string + ' AS NVARCHAR(100)) AS stringValue');
        cols.push('a.CurrentPrice', 'a.UploadedPrice', 'a.Mrp', 'a.DiscountPercentage', 'a.DealType',
                  'a.SoldBy', 'a.BuyBoxWin');

        const q = `
          SELECT ${cols.join(', ')}
          FROM Asins a
          WHERE a.SellerId = @sellerId
            AND ${asinUsableSqlFor('a.AsinCode')}
            AND ${sig.where}
        `;

        const res = await pool.request()
          .input('sellerId', sql.VarChar, SellerId)
          .query(q);

        if (!res.recordset.length) continue;

        for (const row of res.recordset) {
          const label = typeof sig.labelTpl === 'function' ? sig.labelTpl(row) : sig.label;
          const remarks = typeof sig.labelTpl === 'function' ? sig.labelTpl(row) : (sig.label || '');
          const numericValue = sig.numeric ? row.numericValue : null;
          const stringValue = sig.string ? row.stringValue : null;

          try {
            await pool.request()
              .input('id', sql.VarChar, Math.random().toString(36).substring(2, 15) + Date.now().toString(36))
              .input('taskId', sql.VarChar, task.taskId)
              .input('asinCode', sql.VarChar, row.AsinCode)
              .input('sellerId', sql.VarChar, SellerId)
              .input('sellerName', sql.NVarChar, SellerName)
              .input('signalCode', sql.VarChar, sig.code)
              .input('signalLabel', sql.NVarChar, label)
              .input('severity', sql.VarChar, sig.severity)
              .input('numericValue', sql.Decimal(18, 4), numericValue)
              .input('stringValue', sql.NVarChar, stringValue)
              .input('remarks', sql.NVarChar, remarks)
              .query(`
                INSERT INTO PemsTaskAsins (Id, TaskInstanceId, AsinCode, SellerId, SellerName, SignalCode, SignalLabel, Severity, NumericValue, StringValue, Remarks, Status, CreatedAt, UpdatedAt)
                VALUES (@id, @taskId, @asinCode, @sellerId, @sellerName, @signalCode, @signalLabel, @severity, @numericValue, @stringValue, @remarks, 'OPEN', dbo.GetEnvDate(), dbo.GetEnvDate())
              `);
            totalInserted++;
            console.log(`Inserted ${sig.code} for ${row.AsinCode} (seller ${SellerId})`);
          } catch (e) {
            if (e.number === 2627 || e.number === 2601) {
              // duplicate, skip
            } else {
              console.error(`Insert failed for ${sig.code}/${row.AsinCode}:`, e.message);
              throw e;
            }
          }
        }
      }
    }
  }

  console.log('\n=== DLY-003 BACKFILL COMPLETE ===');
  console.log('Total inserted:', totalInserted);
  await pool.close();
}

main().catch(e => { console.error('ERROR:', e); process.exit(1); });