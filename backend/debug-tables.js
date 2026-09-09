const sql = require('mssql');

const config = {
  server: '127.0.0.1',
  database: 'retailops',
  user: 'sa',
  password: 'YourStrong@Passw0rd',
  port: 1433,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

async function run() {
  try {
    await sql.connect(config);
    
    // List all tables
    const result1 = await sql.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
    `);
    console.log('=== Tables in RetailOps Database ===');
    result1.recordset.forEach(t => console.log('  -', t.TABLE_NAME));
    console.log('');
    
    // Check AsinHistory structure
    const result2 = await sql.query(`
      SELECT TOP 5 * FROM AsinHistory
    `);
    console.log('=== AsinHistory Sample (Top 5) ===');
    console.log('Columns:', result2.columns);
    if (result2.recordset.length > 0) {
      console.log('Data:', result2.recordset[0]);
    }
    console.log('');
    
    // Check Asin table structure
    const result3 = await sql.query(`
      SELECT TOP 5 * FROM Asin
    `);
    console.log('=== Asin Sample (Top 5) ===');
    console.log('Columns:', result3.columns);
    if (result3.recordset.length > 0) {
      console.log('Data:', result3.recordset[0]);
    }
    
    await sql.close();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

run();