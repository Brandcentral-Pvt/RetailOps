const { sql, getPool } = require('../database/db');

async function createPasswordResetsTable() {
  const pool = await getPool();
  
  try {
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='PasswordResets' AND xtype='U')
      CREATE TABLE PasswordResets (
        Id NVARCHAR(50) PRIMARY KEY,
        UserId NVARCHAR(50) NOT NULL,
        Token NVARCHAR(255) NOT NULL,
        ExpiresAt DATETIME NOT NULL,
        UsedAt DATETIME NULL,
        CreatedAt DATETIME DEFAULT GETUTCDATE()
      )
    `);
    
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_PasswordResets_Token')
      CREATE INDEX IX_PasswordResets_Token ON PasswordResets(Token)
    `);
    
    console.log('PasswordResets table created successfully');
  } catch (error) {
    console.error('Failed to create PasswordResets table:', error.message);
    throw error;
  }
}

if (require.main === module) {
  createPasswordResetsTable().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = createPasswordResetsTable;
