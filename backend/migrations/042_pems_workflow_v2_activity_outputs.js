'use strict';

/**
 * Phase 2.2: Add nullable template identity and typed output fields to the
 * EXISTING PEMS activity rows. No parallel workflow tables and no backfill.
 *
 * Legacy rows retain NULL workflow keys, NULL output and revision zero.
 * This migration is idempotent and may be safely rerun on a dev database.
 */
module.exports = {
  up: async (pool) => {
    const run = query => pool.request().query(query);
    await run(`
      IF COL_LENGTH('dbo.PemsSubTasks', 'WorkflowPhaseKey') IS NULL
        ALTER TABLE dbo.PemsSubTasks ADD WorkflowPhaseKey VARCHAR(50) NULL;
    `);
    await run(`
      IF COL_LENGTH('dbo.PemsActivities', 'WorkflowActivityKey') IS NULL
        ALTER TABLE dbo.PemsActivities ADD WorkflowActivityKey VARCHAR(50) NULL;
      IF COL_LENGTH('dbo.PemsActivities', 'ActivityType') IS NULL
        ALTER TABLE dbo.PemsActivities ADD ActivityType VARCHAR(40) NULL;
      IF COL_LENGTH('dbo.PemsActivities', 'OutputJson') IS NULL
        ALTER TABLE dbo.PemsActivities ADD OutputJson NVARCHAR(MAX) NULL;
      IF COL_LENGTH('dbo.PemsActivities', 'OutputRevision') IS NULL
        ALTER TABLE dbo.PemsActivities ADD OutputRevision INT NOT NULL
          CONSTRAINT DF_PemsActivities_OutputRevision DEFAULT(0);
      IF COL_LENGTH('dbo.PemsActivities', 'OutputUpdatedBy') IS NULL
        ALTER TABLE dbo.PemsActivities ADD OutputUpdatedBy VARCHAR(50) NULL;
      IF COL_LENGTH('dbo.PemsActivities', 'OutputUpdatedAt') IS NULL
        ALTER TABLE dbo.PemsActivities ADD OutputUpdatedAt DATETIME2 NULL;
    `);
    await run(`
      IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID('dbo.PemsSubTasks')
          AND name = 'UX_PemsSubTasks_WorkflowPhase'
      )
        CREATE UNIQUE INDEX UX_PemsSubTasks_WorkflowPhase
          ON dbo.PemsSubTasks(TaskInstanceId, WorkflowPhaseKey)
          WHERE WorkflowPhaseKey IS NOT NULL;
    `);
    await run(`
      IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE object_id = OBJECT_ID('dbo.PemsActivities')
          AND name = 'UX_PemsActivities_WorkflowActivity'
      )
        CREATE UNIQUE INDEX UX_PemsActivities_WorkflowActivity
          ON dbo.PemsActivities(TaskInstanceId, WorkflowActivityKey)
          WHERE WorkflowActivityKey IS NOT NULL;
    `);
  },
};
