/**
 * Critical Covering Indexes
 *
 * Rewritten as a JS migration (previously a plain .sql file).
 *
 * Why: the live DB (EF-scaffolded) and a fresh init-database.sql install use
 * different column sets. A raw .sql file with hard-coded INCLUDE lists failed
 * on the live DB (invalid columns: Brand, ImageUrl, Sku, OrderedRevenue dup,
 * BSR/LQS casing) and blocked every subsequent migration.
 *
 * Strategy: each index is created only when
 *   1. the table exists,
 *   2. all KEY columns exist on that table,
 *   3. the index name isn't already taken, and
 *   4. INCLUDE columns are filtered down to columns that actually exist.
 * Failures are logged and skipped — a missing covering index must never block
 * schema migrations (009/010/011 depend on the chain continuing).
 */
const { sql } = require('../database/db');

async function tableExists(pool, table) {
  const r = await pool.request()
    .input('t', sql.NVarChar, table)
    .query(`SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = @t`);
  return r.recordset.length > 0;
}

async function existingColumns(pool, table) {
  const r = await pool.request()
    .input('t', sql.NVarChar, table)
    .query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = @t`);
  return new Set(r.recordset.map((row) => row.COLUMN_NAME));
}

async function indexExists(pool, name) {
  const r = await pool.request()
    .input('n', sql.NVarChar, name)
    .query('SELECT 1 FROM sys.indexes WHERE name = @n');
  return r.recordset.length > 0;
}

/**
 * Best-effort covering index creation.
 * @param {object} pool mssql pool
 * @param {{ table: string, name: string, key: string[], desc?: string[], include?: string[] }} spec
 */
async function ensureIndex(pool, spec) {
  const { table, name, key, desc = [], include = [] } = spec;
  try {
    if (!(await tableExists(pool, table))) {
      console.log(`  ⏭ skip ${name}: table ${table} not present`);
      return;
    }
    if (await indexExists(pool, name)) {
      return;
    }
    const cols = await existingColumns(pool, table);
    const missing = key.filter((c) => !cols.has(c));
    if (missing.length > 0) {
      console.log(`  ⏭ skip ${name}: missing key column(s) ${missing.join(', ')} on ${table}`);
      return;
    }
    const keyList = key.map((c) => (desc.includes(c) ? `${c} DESC` : c));
    const includeList = include.filter((c) => cols.has(c));
    const ddl = [`CREATE INDEX ${name} ON ${table}(${keyList.join(', ')})`];
    if (includeList.length > 0) ddl.push(`INCLUDE (${includeList.join(', ')})`);
    await pool.request().query(`${ddl.join(' ')};`);
    console.log(`  ✅ ${name}`);
  } catch (err) {
    console.log(`  ⏭ skip ${name}: ${err.message.split('\n')[0]}`);
  }
}

// Keep the verify-query hint from the original script near the top for anyone
// inspecting index usage afterwards:
// SELECT OBJECT_NAME(i.object_id) AS TableName, i.name AS IndexName, ds.user_seeks
// FROM sys.dm_db_index_usage_stats ds JOIN sys.indexes i ON ds.object_id=i.object_id
//   AND ds.index_id=i.index_id WHERE i.name LIKE 'IX_%Covering%' ORDER BY ds.user_seeks DESC;

module.exports = {
  up: async (pool) => {
    const specs = [
      // 1. ASINS — seller dashboard queries
      { table: 'Asins', name: 'IX_Asins_Seller_Status_Synced_Covering',
        key: ['SellerId', 'Status', 'LastScrapedAt'], desc: ['LastScrapedAt'],
        include: ['AsinCode', 'Title', 'Price', 'Bsr', 'LqsScore', 'LqsGrade', 'ImagesCount', 'MainImageUrl', 'Category', 'Rating', 'ReviewCount'] },
      { table: 'Asins', name: 'IX_Asins_Seller_Active_Covering',
        key: ['SellerId', 'Status', 'CreatedAt'], desc: ['CreatedAt'],
        include: ['AsinCode', 'Title', 'Price', 'Bsr', 'LqsScore', 'LqsGrade', 'Category', 'MainImageUrl'] },
      { table: 'Asins', name: 'IX_Asins_Category_Seller_Covering',
        key: ['Category', 'SellerId'],
        include: ['AsinCode', 'Title', 'Price', 'Bsr', 'LqsScore', 'Status', 'ImagesCount'] },

      // 2. SCHEDULED RUNS — pipeline monitoring
      { table: 'ScheduledRunDetails', name: 'IX_ScheduledRunDetails_Run_Seller_Covering',
        key: ['RunId', 'SellerId'],
        include: ['Status', 'AsinsCount', 'ProcessedCount', 'ErrorMessage', 'StartTime', 'EndTime'] },

      // 3. PEMS TASKS — task management queries
      { table: 'PemsTaskInstances', name: 'IX_PemsTaskInstances_Assignee_Due_Status_Covering',
        key: ['AssigneeId', 'DueDate', 'Status'],
        include: ['TemplateId', 'Title', 'Priority', 'SlaHours', 'IsEscalated', 'ReviewerId', 'CreatedAt'] },
      { table: 'PemsTaskInstances', name: 'IX_PemsTaskInstances_Reviewer_Status_Covering',
        key: ['ReviewerId', 'Status'],
        include: ['AssigneeId', 'Title', 'DueDate', 'Priority', 'SlaHours', 'IsEscalated', 'CreatedAt'] },
      { table: 'PemsTaskInstances', name: 'IX_PemsTaskInstances_Template_Status_Covering',
        key: ['TemplateId', 'Status'],
        include: ['AssigneeId', 'ReviewerId', 'DueDate', 'Priority', 'SlaHours', 'IsEscalated', 'CreatedAt'] },

      // 4. ASIN HISTORY — trend queries
      { table: 'AsinHistory', name: 'IX_AsinHistory_AsinId_Date_Covering',
        key: ['AsinId', 'Date'], desc: ['Date'],
        include: ['Price', 'BSR', 'Rating', 'ReviewCount', 'StockLevel', 'LQS'] },

      // 5. ASIN WEEK HISTORY — weekly trends
      { table: 'AsinWeekHistory', name: 'IX_AsinWeekHistory_AsinId_Week_Covering',
        key: ['AsinId', 'WeekStartDate'], desc: ['WeekStartDate'],
        include: ['AvgPrice', 'AvgBSR', 'AvgRating', 'TotalReviews', 'AvgLQS'] },

      // 6. ADS PERFORMANCE — dashboard ad queries
      { table: 'AdsPerformance', name: 'IX_AdsPerformance_Asin_Date_Covering',
        key: ['Asin', 'Date'], desc: ['Date'],
        include: ['AdSales', 'AdSpend', 'Orders', 'OrganicSales', 'Impressions', 'Clicks', 'ReportType'] },

      // 7. GMS DAILY PERFORMANCE — revenue/order queries (dedupe fixed: was OrderedRevenue twice)
      { table: 'GmsDailyPerformance', name: 'IX_GmsDailyPerformance_Asin_Date_Covering',
        key: ['Asin', 'Date'], desc: ['Date'],
        include: ['OrderedUnits', 'OrderedRevenue'] },

      // 8. SELLERS — dashboard seller queries (INCLUDE uses Id-derived cols only)
      { table: 'Sellers', name: 'IX_Sellers_Marketplace_Active_Covering',
        key: ['Marketplace', 'IsActive'],
        include: ['Name', 'Email', 'OctoparseId', 'LastScrapedAt', 'CreatedAt'] },

      // 9. ACTIONS — PEMS task actions
      { table: 'Actions', name: 'IX_Actions_AssignedTo_Status_Covering',
        key: ['AssignedTo', 'Status'],
        include: ['Title', 'Description', 'DueDate', 'Priority', 'SellerId', 'CreatedAt'] },

      // 10. ALERTS — dashboard alert queries
      { table: 'Alerts', name: 'IX_Alerts_SellerId_CreatedAt_Covering',
        key: ['SellerId', 'CreatedAt'], desc: ['CreatedAt'],
        include: ['Severity', 'Message'] },

      // 11. WEBHOOK LOGS — debugging
      { table: 'WebhookLogs', name: 'IX_WebhookLogs_WebhookId_CreatedAt',
        key: ['WebhookId', 'CreatedAt'], desc: ['CreatedAt'] },
    ];

    console.log('008_critical_covering_indexes: creating available covering indexes…');
    for (const spec of specs) {
      await ensureIndex(pool, spec);
    }
    console.log('008_critical_covering_indexes complete');
  },
};