/**
 * Sellers schema sync for the Node write path.
 *
 * sellerController.js inserts these columns that init-database.sql's Sellers
 * table never had (they existed only in the deleted EF-live database):
 *   IsPriority, ScrapeLimit, LiveSyncClientId, LiveSyncClientSecret,
 *   PartnerTag, LiveSyncEnabled, [Plan]
 * Idempotent: only adds columns that are still missing.
 */
module.exports = {
  up: async (pool) => {
    const additions = [
      ['IsPriority', 'BIT NULL'],
      ['ScrapeLimit', 'INT NULL'],
      ['LiveSyncClientId', 'NVARCHAR(500) NULL'],
      ['LiveSyncClientSecret', 'NVARCHAR(500) NULL'],
      ['PartnerTag', 'NVARCHAR(200) NULL'],
      ['LiveSyncEnabled', 'BIT NULL'],
      ['[Plan]', 'NVARCHAR(500) NULL'],
    ];
    let added = 0;
    for (const [col, def] of additions) {
      const exists = await pool.request()
        .input('col', require('mssql').NVarChar, col.replace(/[\[\]]/g, ''))
        .query('SELECT 1 c FROM sys.columns WHERE object_id = OBJECT_ID(\'dbo.Sellers\') AND name = @col');
      if (exists.recordset.length === 0) {
        await pool.request().query(`ALTER TABLE dbo.Sellers ADD ${col} ${def}`);
        added++;
      }
    }
    return { columnsAdded: added };
  },
};