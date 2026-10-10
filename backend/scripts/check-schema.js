require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { sql, getPool } = require('../database/db');

async function check() {
  const pool = await getPool();
  const result = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Roles'");
  console.log('Roles columns:', result.recordset.map(r => r.COLUMN_NAME));
  await pool.close();
}

check().catch(console.error);