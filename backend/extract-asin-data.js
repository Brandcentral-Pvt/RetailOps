/**
 * ASIN Data Extraction Script
 * Extracts ASIN history data for June and July 2026 from SQL Server
 * Uses credentials from environment variables
 */

require('dotenv').config({ path: __dirname + '/../.env' });

const sql = require('mssql');

// Database configuration from .env
const config = {
  server: process.env.DB_SERVER || '127.0.0.1',
  database: process.env.DB_NAME || 'retailops',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'YourStrong@Passw0rd',
  port: parseInt(process.env.DB_PORT) || 1433,
  options: {
    encrypt: process.env.DB_ENCRYPT !== 'false', // false for local dev, true for Azure
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERT === 'true' || true,
  },
  requestTimeout: 120000,
  connectionTimeout: 30000,
};

// SQL Query: ASIN History for June & July 2026
const QUERY = `
  SELECT 
    a.AsinCode as ASIN,
    ah.ReviewCount as Review,
    ah.Rating,
    ah.BSR as BSR,
    ah.StockLevel as sub_BSR,
    CONVERT(VARCHAR(10), ah.Date, 120) as Date
  FROM AsinHistory ah
  JOIN Asin a ON ah.AsinId = a.Id
  WHERE ah.Date >= '2026-06-01' AND ah.Date < '2026-08-01'
  ORDER BY ah.Date, a.AsinCode
`;

/**
 * Main function to execute the data extraction
 */
async function extractAsinData() {
  let pool;

  try {
    console.log('🔌 Connecting to SQL Server...');
    console.log(`   Server: ${process.env.DB_SERVER}`);
    console.log(`   Database: ${process.env.DB_NAME}`);
    console.log(`   User: ${process.env.DB_USER}`);
    console.log('');

    pool = await sql.connect(config);
    console.log('✅ Connected to SQL Server successfully');
    console.log('');

    console.log('📊 Executing query...');
    console.log('   Query: ASIN history for June & July 2026');
    console.log('');

    const result = await pool.request().query(QUERY);

    console.log('📈 Results Summary:');
    console.log(`   └─ Total rows: ${result.recordset.length}`);
    console.log('');

    if (result.recordset.length === 0) {
      console.log('⚠️  No data found for the specified date range.');
      console.log('   Date range: 2026-06-01 to 2026-08-01');
      await sql.close();
      return;
    }

    // Display column headers
    const headers = result.columns.map(col => col.toString().padEnd(15));
    console.log('📋 Data Format:');
    console.log(`   ${'ASIN'.padEnd(20)} | ${'Review'.padEnd(10)} | ${'Rating'.padEnd(10)} | ${'BSR'.padEnd(10)} | ${'sub_BSR'.padEnd(10)} | ${'Date'}`);
    console.log(`   ${'-'.repeat(20)} | ${'-'.repeat(10)} | ${'-'.repeat(10)} | ${'-'.repeat(10)} | ${'-'.repeat(10)} | ${'-'.repeat(10)}`);

    // Display first 20 rows
    const displayRows = result.recordset.slice(0, 20);
    displayRows.forEach((row, index) => {
      const asin = row.ASIN || row.AsinCode || 'N/A';
      const review = row.Review !== undefined ? row.Review : 'N/A';
      const rating = row.Rating !== undefined ? row.Rating : 'N/A';
      const bsr = row.BSR !== undefined ? row.BSR : 'N/A';
      const subBSR = row.sub_BSR !== undefined ? row.sub_BSR : 'N/A';
      const date = row.Date !== undefined ? row.Date : 'N/A';
      console.log(`   ${asin.padEnd(20)} | ${String(review).padEnd(10)} | ${String(rating).padEnd(10)} | ${String(bsr).padEnd(10)} | ${String(subBSR).padEnd(10)} | ${date}`);
    });

    if (result.recordset.length > 20) {
      console.log(`   ... and ${result.recordset.length - 20} more rows`);
    }

    // Date-wise summary
    console.log('');
    console.log('📅 Date-wise Summary:');
    const byDate = {};
    result.recordset.forEach(row => {
      const date = row.Date || 'N/A';
      if (!byDate[date]) byDate[date] = 0;
      byDate[date]++;
    });

    Object.entries(byDate)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([date, count]) => {
        console.log(`   ${date}: ${count} ASINs`);
      });

    // Save to CSV file
    console.log('');
    console.log('💾 Saving to CSV...');
    const fs = require('fs');
    const csvContent = [
      ['ASIN', 'Review', 'Rating', 'BSR', 'sub_BSR', 'Date'].join(','),
      ...result.recordset.map(row => [
        row.AsinCode || row.ASIN || '',
        row.ReviewCount || row.Review || '',
        row.Rating || '',
        row.BSR || '',
        row.StockLevel || row.sub_BSR || '',
        row.Date || ''
      ].join(','))
    ].join('\n');

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `asin-june-july-${timestamp}.csv`;
    fs.writeFileSync(filename, csvContent);
    console.log(`   ✅ Saved to: ${filename}`);

    console.log('');
    console.log('🎉 Extraction complete!');
    console.log(`   • ${result.recordset.length} records extracted`);
    console.log(`   • Date range: June 1 - July 31, 2026`);
    console.log(`   • Output: ${filename}`);

    await sql.close();
    console.log('');
    console.log('🔒 Database connection closed');

  } catch (err) {
    console.error('❌ Error during data extraction:');
    console.error(`   ${err.message}`);
    if (err.number) console.error(`   SQL Error Number: ${err.number}`);
    if (err.errors) console.error(`   SQL Details: ${JSON.stringify(err.errors)}`);
    
    // Attempt to close pool if it was created
    try { await sql.close(); } catch (_) {}
    process.exit(1);
  }
}

// Run the extraction
extractAsinData();