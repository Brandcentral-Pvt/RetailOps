/**
 * Sellers import columns for the production dump.
 *
 * The EF-marketplace Sellers export carries columns the Node schema lacks:
 *   Phone, OctoparseMarketplace, CometChatUid, CreatedBy, UpdatedBy,
 *   IsDeleted, DeletedAt, DeletedBy
 * Idempotent: only adds columns that are still missing.
 */
module.exports = {
  up: async (pool) => {
    const sql = require('mssql');
    const additions = [
      ['Phone', 'NVARCHAR(50) NULL'],
      ['OctoparseMarketplace', 'NVARCHAR(50) NULL'],
      ['CometChatUid', 'NVARCHAR(100) NULL'],
      ['CreatedBy', 'NVARCHAR(100) NULL'],
      ['UpdatedBy', 'NVARCHAR(100) NULL'],
      ['IsDeleted', 'BIT NOT NULL DEFAULT 0'],
      ['DeletedAt', 'DATETIME2 NULL'],
      ['DeletedBy', 'NVARCHAR(100) NULL'],
    ];
    let added = 0;
    for (const [col, def] of additions) {
      const exists = await pool.request()
        .input('col', sql.NVarChar, col.replace(/[\[\]]/g, ''))
        .query('SELECT 1 c FROM sys.columns WHERE object_id = OBJECT_ID(\'dbo.Sellers\') AND name = @col');
      if (exists.recordset.length === 0) {
        await pool.request().query(`ALTER TABLE dbo.Sellers ADD ${col} ${def}`);
        added++;
      }
    }
    return { columnsAdded: added };
  },
};