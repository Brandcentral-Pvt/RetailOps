/**
 * Migration 035: Conditional Workflow V2.3 Support
 * Adds conditional visibility, state tracking, and audit for activities/subtasks
 */
const { sql, getPool } = require('../database/db');

const migrations = [
  // Add conditional columns to PemsActivities
  `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.PemsActivities') AND name = 'VisibleWhen')
    ALTER TABLE dbo.PemsActivities ADD VisibleWhen NVARCHAR(MAX) NULL`,

  `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.PemsActivities') AND name = 'VisibilityState')
    ALTER TABLE dbo.PemsActivities ADD VisibilityState NVARCHAR(20) NOT NULL DEFAULT 'VISIBLE'`,

  `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.PemsActivities') AND name = 'ConditionEvaluatedAt')
    ALTER TABLE dbo.PemsActivities ADD ConditionEvaluatedAt DATETIME2 NULL`,

  `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.PemsActivities') AND name = 'ConditionEvaluatedBy')
    ALTER TABLE dbo.PemsActivities ADD ConditionEvaluatedBy VARCHAR(50) NULL`,

  `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.PemsActivities') AND name = 'ConditionResult')
    ALTER TABLE dbo.PemsActivities ADD ConditionResult NVARCHAR(MAX) NULL`,

  `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.PemsActivities') AND name = 'PreviousVisibilityState')
    ALTER TABLE dbo.PemsActivities ADD PreviousVisibilityState NVARCHAR(20) NULL`,

  // Add conditional columns to PemsSubTasks
  `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.PemsSubTasks') AND name = 'VisibilityState')
    ALTER TABLE dbo.PemsSubTasks ADD VisibilityState NVARCHAR(20) NOT NULL DEFAULT 'VISIBLE'`,

  `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.PemsSubTasks') AND name = 'ConditionEvaluatedAt')
    ALTER TABLE dbo.PemsSubTasks ADD ConditionEvaluatedAt DATETIME2 NULL`,

  `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.PemsSubTasks') AND name = 'MandatoryActivityCount')
    ALTER TABLE dbo.PemsSubTasks ADD MandatoryActivityCount INT NOT NULL DEFAULT 0`,

  `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.PemsSubTasks') AND name = 'CompletedMandatoryActivityCount')
    ALTER TABLE dbo.PemsSubTasks ADD CompletedMandatoryActivityCount INT NOT NULL DEFAULT 0`,

  // Add weighted progress and conditional progress to PemsTaskInstances
  `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.PemsTaskInstances') AND name = 'WeightedProgressPct')
    ALTER TABLE dbo.PemsTaskInstances ADD WeightedProgressPct DECIMAL(5,2) DEFAULT 0`,

  `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.PemsTaskInstances') AND name = 'ConditionalProgressEvaluatedAt')
    ALTER TABLE dbo.PemsTaskInstances ADD ConditionalProgressEvaluatedAt DATETIME2 NULL`,

  // Create table for conditional decision audit trail
  `IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PemsConditionalDecisions')
  CREATE TABLE PemsConditionalDecisions (
    Id VARCHAR(50) PRIMARY KEY,
    TaskInstanceId VARCHAR(50) NOT NULL,
    SubTaskId VARCHAR(50),
    ActivityId VARCHAR(50),
    ConditionExpression NVARCHAR(MAX) NOT NULL,
    InputValues NVARCHAR(MAX) NOT NULL,
    Result NVARCHAR(20) NOT NULL, -- 'VISIBLE', 'SKIPPED', 'WAITING'
    PreviousResult NVARCHAR(20),
    EvaluatedBy VARCHAR(50) NOT NULL,
    EvaluatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
    ReopenedDownstream BIT NOT NULL DEFAULT 0,
    DownstreamAffectedIds NVARCHAR(MAX)
CONSTRAINT FK_ConditionalDecision_Instance FOREIGN KEY (TaskInstanceId) REFERENCES PemsTaskInstances(Id) ON DELETE CASCADE,
  CONSTRAINT FK_ConditionalDecision_SubTask FOREIGN KEY (SubTaskId) REFERENCES PemsSubTasks(Id),
  CONSTRAINT FK_ConditionalDecision_Activity FOREIGN KEY (ActivityId) REFERENCES PemsActivities(Id)
  )`,

  // Indexes for conditional decisions
  `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ConditionalDecision_Instance' AND object_id = OBJECT_ID('PemsConditionalDecisions'))
    CREATE NONCLUSTERED INDEX IX_ConditionalDecision_Instance ON PemsConditionalDecisions(TaskInstanceId)`,

  `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ConditionalDecision_Activity' AND object_id = OBJECT_ID('PemsConditionalDecisions'))
    CREATE NONCLUSTERED INDEX IX_ConditionalDecision_Activity ON PemsConditionalDecisions(ActivityId)`,

  `IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ConditionalDecision_SubTask' AND object_id = OBJECT_ID('PemsConditionalDecisions'))
    CREATE NONCLUSTERED INDEX IX_ConditionalDecision_SubTask ON PemsConditionalDecisions(SubTaskId)`,
];

async function runMigration() {
  const pool = await getPool();
  let success = 0, failed = 0;
  for (let i = 0; i < migrations.length; i++) {
    try {
      await pool.request().query(migrations[i]);
      success++;
      console.log(`  ✅ Migration 035.${i + 1}/${migrations.length}`);
    } catch (err) {
      if (err.message.includes('already exists') || err.message.includes('There is already') || err.message.includes('duplicate')) {
        success++;
        console.log(`  ⏭️  Migration 035.${i + 1}/${migrations.length} (exists)`);
      } else {
        failed++;
        console.error(`  ❌ Migration 035.${i + 1}: ${err.message.substring(0, 120)}`);
      }
    }
  }
  console.log(`\nMigration 035 (Conditional Workflow V2.3): ${success} ok, ${failed} failed`);
}

module.exports = { runMigration, migrations };