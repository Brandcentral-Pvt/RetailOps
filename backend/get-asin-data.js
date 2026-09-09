const sql = require('mssql');

const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT),
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function run() {
  try {
    await sql.connect(config);
    
    // Query ASIN history data for June and July 2026
    const result = await sql.query(`
      SELECT 
        a.Id as AsinId,
        a.AsinCode,
        CONVERT(VARCHAR(10), ah.Date, 120) as Date,
        ah.ReviewCount as Review,
        ah.Rating,
        ah.BSR
      FROM AsinHistory ah
      JOIN Asin a ON ah.AsinId = a.Id
      WHERE ah.Date >= '2026-06-01' AND ah.Date < '2026-08-01'
      ORDER BY ah.Date, a.Id
    `);
    
    console.log('Result columns:', result.columns);
    console.log('Total rows:', result.recordset.length);
    
    if (result.recordset.length > 0) {
      console.log('\nFirst 10 rows:');
      console.log(JSON.stringify(result.recordset.slice(0, 10), null, 2));
      
      console.log('\nLast 5 rows:');
      console.log(JSON.stringify(result.recordset.slice(-5), null, 2));
      
      // Group by date
      console.log('\nData by date:');
      const byDate = {};
      result.recordset.forEach(row => {
        const date = row.Date;
        if (!byDate[date]) byDate[date] = [];
        byDate[date].push({
          AsinId: row.AsinId,
          AsinCode: row.AsinCode,
          Review: row.Review,
          Rating: row.Rating,
          BSR: row.BSR
        });
      });
      console.log(Object.keys(byDate).length, 'dates found');
      console.log('Sample dates:', Object.keys(byDate).slice(0, 5));
    }
    
    await sql.close();
  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
  }
}

run();
"