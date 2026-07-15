require('dotenv').config();
const { getPool, sql } = require('./database/db');
(async () => {
  try {
    const pool = await getPool();
    console.log('Checking GMS data size...');
    const r1 = await pool.request().query(`SELECT COUNT(*) as cnt FROM GmsDailyPerformance`);
    console.log('GmsDailyPerformance rows:', r1.recordset[0].cnt);
    const r2 = await pool.request().query(`SELECT COUNT(*) as cnt FROM Asins WHERE Status = 'Active' AND Brand IS NOT NULL AND Brand <> ''`);
    console.log('Active ASINs with brand:', r2.recordset[0].cnt);
    const r3 = await pool.request().query(`SELECT COUNT(DISTINCT Brand) as cnt FROM Asins WHERE Brand IS NOT NULL AND Brand <> ''`);
    console.log('Distinct brands:', r3.recordset[0].cnt);
    const r4 = await pool.request().query(`SELECT COUNT(*) as cnt FROM Asins WHERE Tags LIKE '%Top 80% Contributor%' OR Tags LIKE '%Bottom 20% Contributor%'`);
    console.log('ASINs w/ Pareto tags:', r4.recordset[0].cnt);
    const r5 = await pool.request().query(`SELECT TOP 3 Brand, COUNT(*) as asins, SUM(ISNULL(OrderedRevenue,0)) as gms FROM GmsDailyPerformance g GROUP BY Brand ORDER BY gms DESC`);
    console.log('Top brands by GMS:');
    r5.recordset.forEach(b => console.log(`  ${b.Brand || '(null)'}: ${b.asins} ASINs, ${(b.gms||0).toLocaleString()} GMS`));
    process.exit(0);
  } catch (e) { console.error(e); process.exit(1); }
})();
