/**
 * Persistent Creators API daily quota ledger.
 *
 * The old live-sync held its 8640-TPD budget purely in memory (_tpdCounters),
 * so any PM2 restart silently reset the counter — the process could re-spend
 * the whole daily quota against Amazon's *server-side* counter and get 429s.
 *
 * This table is the durable truth: one row per UTC day per account, counting
 * every Creators API request made by ANY caller (live sync + keyword
 * research) so the daily budget survives restarts and is shared account-wide.
 */
module.exports = {
  up: async (pool) => {
    await pool.request().query(`
      IF OBJECT_ID(N'dbo.CreatorsApiQuota', N'U') IS NULL
      BEGIN
        CREATE TABLE dbo.CreatorsApiQuota (
          Id NVARCHAR(50) NOT NULL PRIMARY KEY,
          AccountKey NVARCHAR(60) NOT NULL,
          UsageDate NVARCHAR(10) NOT NULL,
          RequestsUsed INT NOT NULL DEFAULT 0,
          Quota INT NOT NULL DEFAULT 8640,
          CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
          UpdatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()
        );
        CREATE UNIQUE INDEX IX_CreatorsApiQuota_AccountUsage
          ON dbo.CreatorsApiQuota(AccountKey, UsageDate);
        CREATE INDEX IX_CreatorsApiQuota_UsageDate ON dbo.CreatorsApiQuota(UsageDate);
      END
    `);
    console.log('[Migration 025] ✅ Added CreatorsApiQuota daily usage ledger');
  },
};