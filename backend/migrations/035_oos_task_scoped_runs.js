/**
 * Migration 035: Task-scoped OOS runs
 * 
 * Scope run uniqueness by (TaskInstanceId, SellerId, RunDate) for task-bound runs
 * Keep backward compatibility for legacy runs
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { sequelize } = queryInterface;
    const query = async (sql) => {
      const [results] = await sequelize.query(sql);
      return results;
    };

    // Add TaskInstanceId column if it doesn't exist
    await query(`
      IF COL_LENGTH('dbo.OosRuns', 'TaskInstanceId') IS NULL
        ALTER TABLE dbo.OosRuns ADD TaskInstanceId VARCHAR(50) NULL;
    `);

    // Backfill TaskInstanceId from bindings
    await query(`
      UPDATE r
      SET TaskInstanceId = b.TaskInstanceId
      FROM dbo.OosRuns r
      INNER JOIN dbo.OosTaskBindings b ON b.OosRunId = r.Id
      WHERE r.TaskInstanceId IS NULL AND b.TaskInstanceId IS NOT NULL;
    `);

    // Create task-scoped unique index for runs with TaskInstanceId
    await query(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_OosRuns_Task_Seller_RunDate')
        CREATE UNIQUE NONCLUSTERED INDEX UX_OosRuns_Task_Seller_RunDate
        ON dbo.OosRuns (TaskInstanceId, SellerId, RunDate)
        WHERE TaskInstanceId IS NOT NULL;
    `);

    // Create seller/date index for legacy runs without task binding
    await query(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_OosRuns_Seller_RunDate_Legacy')
        CREATE UNIQUE NONCLUSTERED INDEX UX_OosRuns_Seller_RunDate_Legacy
        ON dbo.OosRuns (SellerId, RunDate)
        WHERE TaskInstanceId IS NULL;
    `);

    console.log('[Migration 035] OOS runs scoped to task instances');
  },

  down: async (queryInterface, Sequelize) => {
    const { sequelize } = queryInterface;
    const query = async (sql) => {
      const [results] = await sequelize.query(sql);
      return results;
    };

    await query(`IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_OosRuns_Task_Seller_RunDate') DROP INDEX UX_OosRuns_Task_Seller_RunDate ON dbo.OosRuns;`);
    await query(`IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_OosRuns_Seller_RunDate_Legacy') DROP INDEX UX_OosRuns_Seller_RunDate_Legacy ON dbo.OosRuns;`);
    // Don't drop TaskInstanceId to preserve data
    console.log('[Migration 035] Rolled back OOS task-scoped run indexes');
  }
};
