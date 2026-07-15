require('dotenv').config();
const { getPool, sql } = require('./database/db');
(async () => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(`
      SELECT 
        i.name as index_name,
        i.type_desc,
        COL_NAME(ic.object_id, ic.column_id) as column_name
      FROM sys.indexes i
      INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      WHERE i.object_id = OBJECT_ID('GmsDailyPerformance')
      ORDER BY i.name, ic.index_column_id
    `);
    console.log('Indexes on GmsDailyPerformance:');
    r.recordset.forEach(row => console.log(`  ${row.index_name} (${row.type_desc}): ${row.column_name}`));
    
    const r2 = await pool.request().query(`
      SELECT COUNT(*) as cnt FROM (
        SELECT DISTINCT Asin FROM GmsDailyPerformance WHERE Date >= DATEADD(MONTH, -3, dbo.GetEnvDate())
      ) d
    `);
    console.log('\nDistinct ASINs with GMS in last 3 months:', r2.recordset[0].cnt);
    
    process.exit(0);
  } catch (e) { console.error(e); process.exit(1); }
})();
