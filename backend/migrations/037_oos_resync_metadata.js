/**
 * Migration 037: OOS resync metadata
 *
 * Adds resync request/dispatch/completion metadata to OosResyncJobs:
 *   - RequestedAt: when the resync was requested (UTC)
 *   - DispatchAttempt: retry counter
 *   - ProviderRequestId: provider job identifier
 *   - CompletedAt: when dispatch/completion finished
 *   - FailureCode: terminal failure reason
 *   - ErrorMessage: last error text
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { sequelize } = queryInterface;
    const query = async (sql) => {
      const [results] = await sequelize.query(sql);
      return results;
    };

    // RequestedAt - when resync was requested
    await query(`
      IF COL_LENGTH('dbo.OosResyncJobs', 'RequestedAt') IS NULL
        ALTER TABLE dbo.OosResyncJobs ADD RequestedAt DATETIME2 NULL;
    `);

    // DispatchAttempt - retry counter
    await query(`
      IF COL_LENGTH('dbo.OosResyncJobs', 'DispatchAttempt') IS NULL
        ALTER TABLE dbo.OosResyncJobs ADD DispatchAttempt INT NOT NULL DEFAULT 0;
    `);

    // ProviderRequestId - provider job identifier
    await query(`
      IF COL_LENGTH('dbo.OosResyncJobs', 'ProviderRequestId') IS NULL
        ALTER TABLE dbo.OosResyncJobs ADD ProviderRequestId VARCHAR(100) NULL;
    `);

    // CompletedAt - when dispatch/completion finished
    await query(`
      IF COL_LENGTH('dbo.OosResyncJobs', 'CompletedAt') IS NULL
        ALTER TABLE dbo.OosResyncJobs ADD CompletedAt DATETIME2 NULL;
    `);

    // FailureCode - terminal failure reason
    await query(`
      IF COL_LENGTH('dbo.OosResyncJobs', 'FailureCode') IS NULL
        ALTER TABLE dbo.OosResyncJobs ADD FailureCode VARCHAR(50) NULL;
    `);

    // ErrorMessage - last error text
    await query(`
      IF COL_LENGTH('dbo.OosResyncJobs', 'ErrorMessage') IS NULL
        ALTER TABLE dbo.OosResyncJobs ADD ErrorMessage NVARCHAR(1000) NULL;
    `);

    console.log('[Migration 037] OOS resync metadata columns added');
  },

  down: async (queryInterface, Sequelize) => {
    const { sequelize } = queryInterface;
    const query = async (sql) => {
      const [results] = await sequelize.query(sql);
      return results;
    };

    await query(`IF COL_LENGTH('dbo.OosResyncJobs', 'ErrorMessage') IS NOT NULL ALTER TABLE dbo.OosResyncJobs DROP COLUMN ErrorMessage;`);
    await query(`IF COL_LENGTH('dbo.OosResyncJobs', 'FailureCode') IS NOT NULL ALTER TABLE dbo.OosResyncJobs DROP COLUMN FailureCode;`);
    await query(`IF COL_LENGTH('dbo.OosResyncJobs', 'CompletedAt') IS NOT NULL ALTER TABLE dbo.OosResyncJobs DROP COLUMN CompletedAt;`);
    await query(`IF COL_LENGTH('dbo.OosResyncJobs', 'ProviderRequestId') IS NOT NULL ALTER TABLE dbo.OosResyncJobs DROP COLUMN ProviderRequestId;`);
    await query(`IF COL_LENGTH('dbo.OosResyncJobs', 'DispatchAttempt') IS NOT NULL ALTER TABLE dbo.OosResyncJobs DROP COLUMN DispatchAttempt;`);
    await query(`IF COL_LENGTH('dbo.OosResyncJobs', 'RequestedAt') IS NOT NULL ALTER TABLE dbo.OosResyncJobs DROP COLUMN RequestedAt;`);

    console.log('[Migration 037] Rolled back OOS resync metadata');
  }
};
