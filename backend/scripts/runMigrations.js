/* CLI: node backend/scripts/runMigrations.js [--quiet] */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { runMigrations } = require('../database/migrate');

const quiet = process.argv.includes('--quiet');

(async () => {
  try {
    const results = await runMigrations({ quiet });
    console.log(`\nMigrations: ${results.applied} applied, ${results.skipped} skipped, ${results.failed} failed`);
    if (results.failed > 0) {
      console.error(results.errors);
      process.exit(1);
    }
    process.exit(0);
  } catch (err) {
    console.error('Migration run failed:', err.message);
    process.exit(1);
  }
})();
