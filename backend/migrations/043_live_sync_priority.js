const { sql, getPool } = require('../database/db');

async function addSyncPriority() {
  const pool = await getPool();
  
  // Add SyncPriority column to Sellers table
  await pool.request().query(`
    IF COL_LENGTH('dbo.Sellers', 'SyncPriority') IS NULL
    BEGIN
      ALTER TABLE Sellers ADD SyncPriority INT NULL;
      CREATE INDEX IX_Sellers_SyncPriority ON Sellers(SyncPriority);
      PRINT 'Added SyncPriority column to Sellers table';
    END
    ELSE
    BEGIN
      PRINT 'SyncPriority column already exists';
    END
  `);
  
  console.log('Migration complete');
}

addSyncPriority().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });