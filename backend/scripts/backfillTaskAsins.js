/**
 * Phase 2 backfill: PemsTaskAsins apply (simplified, row-by-row for reliability).
 *
 * Run: node backend/scripts/backfillTaskAsins.js --apply
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
  'DLY-002': [
    {
      code: 'BUYBOX_LOST', severity: 'critical',
      where: `a.BuyBoxWin = 0`,
      numeric: 'a.CurrentPrice',
      string: 'a.SoldBy',
      labelTpl: (row) => `Buy Box lost to ${row.SoldBy || 'unknown'} at ${row.CurrentPrice}`,
    },
    {
      code: 'MRP_OVER_70', severity: 'major',
      where: `a.Mrp IS NOT NULL AND a.CurrentPrice IS NOT NULL AND a.CurrentPrice > 0 AND a.Mrp > a.CurrentPrice * 0.7`,
      numeric: 'a.Mrp / a.CurrentPrice * 100',
      string: null,
      labelTpl: (row) => `MRP ${row.Mrp} > 70% of ASP ${row.CurrentPrice}`,
    },
    {
      code: 'HAS_DEAL', severity: 'minor',
      where: `a.HasDeal = 1`,
      numeric: 'a.DiscountPercentage',
      string: 'a.DealType',
      labelTpl: (row) => `Active deal: ${row.DealType || 'Deal'} ${row.DiscountPercentage || 0}% off`,
    },
  ],
  'DLY-001': [
    { code: 'TITLE_F', severity: 'critical', where: `a.TitleGrade = 'F'`, string: 'a.TitleIssues', labelTpl: () => 'Title grade F' },
    { code: 'BULLET_F', severity: 'critical', where: `a.BulletGrade = 'F'`, string: 'a.BulletIssues', labelTpl: () => 'Bullet grade F' },
    { code: 'IMAGE_F', severity: 'critical', where: `a.ImageGrade = 'F'`, string: 'a.ImageIssues', labelTpl: () => 'Image grade F' },
    { code: 'DESC_F', severity: 'critical', where: `a.DescriptionGrade = 'F'`, string: 'a.DescriptionIssues', labelTpl: () => 'Description grade F' },
    { code: 'LQS_F', severity: 'critical', where: `a.LQSGrade = 'F'`, string: 'a.LqsIssues', labelTpl: () => 'LQS grade F' },
    { code: 'CDQ_F', severity: 'critical', where: `a.CdqGrade = 'F'`, string: null, labelTpl: () => 'CDQ grade F' },
    { code: 'TITLE_ISSUE', severity: 'major', where: `a.TitleGrade IN ('D','C')`, string: 'a.TitleIssues', labelTpl: (row) => `Title issues (grade ${row.TitleGrade})` },
    { code: 'BULLET_ISSUE', severity: 'major', where: `a.BulletGrade IN ('D','C')`, string: 'a.BulletIssues', labelTpl: (row) => `Bullet issues (grade ${row.BulletGrade})` },
    { code: 'IMAGE_ISSUE', severity: 'major', where: `a.ImageGrade IN ('D','C')`, string: 'a.ImageIssues', labelTpl: (row) => `Image issues (grade ${row.ImageGrade})` },
    { code: 'DESC_ISSUE', severity: 'major', where: `a.DescriptionGrade IN ('D','C')`, string: 'a.DescriptionIssues', labelTpl: (row) => `Description issues (grade ${row.DescriptionGrade})` },
    { code: 'LQS_ISSUE', severity: 'major', where: `a.LQSGrade IN ('D','C')`, string: 'a.LqsIssues', labelTpl: (row) => `LQS issues (grade ${row.LQSGrade})` },
    { code: 'SUPPRESSED', severity: 'critical', where: `a.AvailabilityStatus = 'Suppressed'`, string: null, labelTpl: () => 'ASIN suppressed' },
    { code: 'OOS', severity: 'major', where: `a.Availability = 'Out of Stock'`, string: null, labelTpl: () => 'Out of Stock' },
  ],
  'DLY-004': [], 'DLY-005': [], 'DLY-006': [],
  'DLY-007': [], 'DLY-008': [], 'DLY-009': [],
  'DLY-0011': [], 'DLY-0012-1': [], 'DLY-0012-2': [],
  'DLY-0010A': [], 'DLY-0010B': [],
};

const genId = () => Math.random().toString(36).substring(2, 15) + Date.now().toString(36);

async function main() {
  const pool = await sql.connect({
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    server: '127.0.0.1', database: 'retailops', port: 1433,
    options: { trustServerCertificate: true, encrypt: false, requestTimeout: 600000 },
  });

  const tasks = await pool.request().query(`
    SELECT ti.Id AS taskId, t.TaskCode, t.Category
    FROM PemsTaskInstances ti
    JOIN PemsTaskTemplates t ON ti.TemplateId = t.Id
    WHERE ti.Status IN ('ASSIGNED','IN_PROGRESS','SUBMITTED','RESUBMITTED')
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
        if (sig.string) cols.push(sig.string + ' AS stringValue');
        // Also fetch all columns needed for labelTpl
        cols.push('a.CurrentPrice', 'a.UploadedPrice', 'a.Mrp', 'a.DiscountPercentage', 'a.DealType',
                  'a.SoldBy', 'a.BuyBoxWin', 'a.TitleGrade', 'a.BulletGrade', 'a.ImageGrade',
                  'a.DescriptionGrade', 'a.LQSGrade', 'a.CdqGrade', 'a.AvailabilityStatus', 'a.Availability');

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

          if (DRY_RUN) {
            totalSkipped++;
            byTemplate[task.TaskCode] = (byTemplate[task.TaskCode] || 0) + 1;
            continue;
          }

          try {
            await pool.request()
              .input('id', sql.VarChar, genId())
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
            byTemplate[task.TaskCode] = (byTemplate[task.TaskCode] || 0) + 1;
          } catch (e) {
            if (e.number === 2627 || e.number === 2601) { // unique constraint violation
              totalSkipped++;
            } else {
              console.error(`Insert failed for ${task.TaskCode}/${sig.code}/${row.AsinCode}:`, e.message);
              throw e;
            }
          }
        }
      }
    }
  }

  console.log('\n=== ' + (DRY_RUN ? 'DRY-RUN' : 'APPLY') + ' SUMMARY ===');
  console.log('Rows processed:', totalInserted + totalSkipped);
  console.log('Inserted:', totalInserted);
  console.log('Skipped (duplicates/empty):', totalSkipped);
  console.log('\nPer template:');
  for (const [tpl, cnt] of Object.entries(byTemplate).sort((a,b)=>b[1]-a[1])) {
    console.log(`  ${tpl}: ${cnt}`);
  }
  if (DRY_RUN) console.log('\nRun with --apply to execute inserts.');

  await pool.close();
}

main().catch(e => { console.error('ERROR:', e); process.exit(1); });