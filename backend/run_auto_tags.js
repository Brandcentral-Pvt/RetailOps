require('dotenv').config({ path: require('path').join(__dirname, '.env') });
process.env.TZ = process.env.AUTOMATION_TIMEZONE || 'Asia/Kolkata';

const path = require('path');
const mssql = require('mssql');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT),
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
    useUTC: false
  },
  requestTimeout: 600000,
  connectionTimeout: 60000,
  pool: { max: 5, min: 1, idleTimeoutMillis: 30000 }
};

const { getPool } = require('./database/db');
const AutoTagService = require('./services/autoTagService');

(async () => {
  try {
    const pool = await getPool();
    console.log('✅ Connected. Running Pareto 80/20 computation...');

    const result = await AutoTagService.runAllAutoTags(pool);

    console.log('\n📊 RESULTS:');
    console.log(JSON.stringify(result, null, 2));

    if (result.pareto?.details) {
      console.log('\n📋 BRAND BREAKDOWNS:');
      for (const b of result.pareto.details) {
        console.log(`  ${b.brand}: ${b.topCount} top + ${b.bottomCount} bottom = ${b.topCount + b.bottomCount} ASINs (Brand GMS: ${(b.brandTotalGms || 0).toLocaleString()})`);
      }
    }

    console.log('\n✅ Done!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed:', err.message);
    process.exit(1);
  }
})();
