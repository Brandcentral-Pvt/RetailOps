const sql = require('mssql');
require('dotenv').config({ path: './.env' });
const { asinUsableSqlFor } = require('../utils/asinUtils');

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

  console.log('Found', tasks.recordset.length, 'DLY-003 tasks');

  const usable = asinUsableSqlFor('a.AsinCode');
  const where = `a.PriceDispute = 1 AND a.CurrentPrice IS NOT NULL AND a.UploadedPrice IS NOT NULL`;
  const cols = ['a.AsinCode', 'ABS(a.CurrentPrice - a.UploadedPrice) AS numericValue', 'a.CurrentPrice AS stringValue', 'a.CurrentPrice', 'a.UploadedPrice'];

  let total = 0;
  for (const task of tasks.recordset) {
    const brands = await pool.request()
      .input('taskId', sql.VarChar, task.taskId)
      .query(`SELECT SellerId, SellerName FROM PemsTaskBrands WHERE TaskInstanceId = @taskId`);

    console.log('Task', task.taskId.substring(0,8), 'has', brands.recordset.length, 'brands');

    for (const { SellerId, SellerName } of brands.recordset) {
      const q = `SELECT ${cols.join(', ')} FROM Asins a WHERE a.SellerId = @sellerId AND ${usable} AND ${where}`;

      const res = await pool.request()
        .input('sellerId', sql.VarChar, SellerId)
        .query(q);

      if (res.recordset.length) {
        console.log('  Seller', SellerId, '(', SellerName, '):', res.recordset.length, 'rows');
      }
    }
  }
  console.log('Done checking');
  await pool.close();
}

main().catch(e => { console.error('ERROR:', e); process.exit(1); });