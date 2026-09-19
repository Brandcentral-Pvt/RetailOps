/**
 * Date-leading covering indexes for the Operations Command Center.
 *
 * The dashboard's GMS-first queries (dashboardController.getDashboardData)
 * aggregate GmsDailyPerformance / AdsPerformance over a *date window* across
 * all ASINs (per-day totals, GMS-ranked top products, GMS by seller). The
 * existing covering indexes lead with Asin, so a pure date-range predicate
 * has to scan them; leading with Date lets those aggregates seek.
 *
 * Best-effort, same contract as 008: created only when the table and key
 * columns exist, INCLUDE lists are filtered to real columns, failures are
 * logged and skipped so the migration chain never blocks.
 */
const { sql, tableExists, indexExists } = require('./_helpers');

async function existingColumns(pool, table) {
  const r = await pool.request()
    .input('t', sql.NVarChar, table)
    .query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = @t`);
  return new Set(r.recordset.map((row) => row.COLUMN_NAME));
}

async function ensureIndex(pool, { table, name, key, include = [] }) {
  try {
    if (!(await tableExists(pool, table))) {
      console.log(`  ⏭ skip ${name}: table ${table} not present`);
      return;
    }
    if (await indexExists(pool, name)) return;
    const cols = await existingColumns(pool, table);
    const missing = key.filter((c) => !cols.has(c));
    if (missing.length > 0) {
      console.log(`  ⏭ skip ${name}: missing key column(s) ${missing.join(', ')} on ${table}`);
      return;
    }
    const includeList = include.filter((c) => cols.has(c));
    const ddl = [`CREATE INDEX ${name} ON ${table}(${key.join(', ')})`];
    if (includeList.length > 0) ddl.push(`INCLUDE (${includeList.join(', ')})`);
    await pool.request().query(`${ddl.join(' ')};`);
    console.log(`  ✅ ${name}`);
  } catch (err) {
    console.log(`  ⏭ skip ${name}: ${err.message.split('\n')[0]}`);
  }
}

module.exports = {
  up: async (pool) => {
    console.log('024_dashboard_date_range_indexes: creating date-leading covering indexes…');
    await ensureIndex(pool, {
      table: 'GmsDailyPerformance',
      name: 'IX_GmsDailyPerformance_Date_Asin_Covering',
      key: ['Date', 'Asin'],
      include: ['OrderedRevenue', 'OrderedUnits', 'ShippedRevenue', 'CustomerReturns'],
    });
    await ensureIndex(pool, {
      table: 'AdsPerformance',
      name: 'IX_AdsPerformance_Date_ReportType_Covering',
      key: ['Date', 'ReportType'],
      include: ['Asin', 'AdSales', 'AdSpend', 'Orders', 'OrganicSales', 'Impressions', 'Clicks'],
    });
    console.log('024_dashboard_date_range_indexes complete');
  },
};
