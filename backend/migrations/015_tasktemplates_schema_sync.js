/**
 * TaskTemplates schema sync : migration 009 created a minimal TaskTemplates
 * (Id/Title/Description/Category/Priority/Type/TimeLimit/IsActive/timestamps).
 * Both the taskflow service INSERTs (services/taskflow/service.js) and the
 * init-database.sql seed reference the full canonical column set (Code, Name,
 * Department, SLA/Frequency fields, definitions, tags ...), so add every column
 * missing from the live table. Idempotent — COL_LENGTH-guarded per column.
 */
const { sql } = require('../database/db');

const ADD_COLUMNS = [
  ['Code', 'NVARCHAR(20) NULL'],
  ['Name', 'NVARCHAR(255) NULL'],
  ['Department', 'NVARCHAR(100) NOT NULL DEFAULT \'OPERATIONS\''],
  ['DefaultAssigneeRole', 'NVARCHAR(50) NULL'],
  ['DefaultReviewerRole', 'NVARCHAR(50) NULL'],
  ['DefaultSlaPolicyId', 'VARCHAR(50) NULL'],
  ['DefaultPriority', 'NVARCHAR(20) NOT NULL DEFAULT \'MEDIUM\''],
  ['DefaultSlaHours', 'INT NOT NULL DEFAULT 48'],
  ['Frequency', 'NVARCHAR(20) NOT NULL DEFAULT \'ONE_TIME\''],
  ['CronExpression', 'NVARCHAR(100) NULL'],
  ['BusinessDaysOnly', 'BIT NOT NULL DEFAULT 1'],
  ['ExcludeHolidays', 'BIT NOT NULL DEFAULT 1'],
  ['HolidayCalendar', 'NVARCHAR(50) NULL'],
  ['Timezone', 'NVARCHAR(50) NOT NULL DEFAULT \'Asia/Kolkata\''],
  ['SubtaskDefinitions', 'NVARCHAR(MAX) NULL'],
  ['ActivityDefinitions', 'NVARCHAR(MAX) NULL'],
  ['Tags', 'NVARCHAR(MAX) NULL'],
  ['CreatedBy', 'VARCHAR(50) NULL'],
  ['TemplateVersion', 'INT NOT NULL DEFAULT 1'],
  ['ExecutionComplexity', 'NVARCHAR(20) NOT NULL DEFAULT \'MEDIUM\''],
  ['EstimatedExecutionMinutes', 'INT NOT NULL DEFAULT 60'],
  ['AutoAssignEnabled', 'BIT NOT NULL DEFAULT 0'],
  ['ReviewRequired', 'BIT NOT NULL DEFAULT 1'],
  ['EscalationHours', 'INT NOT NULL DEFAULT 24'],
  ['CriticalityScore', 'INT NOT NULL DEFAULT 5'],
  ['AutomationEligible', 'BIT NOT NULL DEFAULT 0'],
  ['TemplateOwnerId', 'VARCHAR(50) NULL'],
  ['LastGeneratedAt', 'DATETIME2 NULL'],
  ['NextScheduledDate', 'DATETIME2 NULL'],
];

module.exports = {
  up: async (pool) => {
    for (const [name, ddl] of ADD_COLUMNS) {
      const full = `ALTER TABLE dbo.TaskTemplates ADD [${name}] ${ddl};`;
      await pool.request()
        .input('name', sql.NVarChar, name)
        .input('ddl', sql.NVarChar, full)
        .query(`
          IF COL_LENGTH('dbo.TaskTemplates', @name) IS NULL
          BEGIN
            EXEC sp_executesql @ddl;
          END
        `);
    }

    // Unique Code index (matches init-database.sql) — guarded against duplicates
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_TaskTemplates_Code' AND object_id = OBJECT_ID(N'dbo.TaskTemplates'))
      BEGIN
        DECLARE @dupes INT = (SELECT COUNT(*) FROM (SELECT Code FROM dbo.TaskTemplates WHERE Code IS NOT NULL GROUP BY Code HAVING COUNT(*) > 1) d);
        IF @dupes = 0
        BEGIN
          CREATE UNIQUE INDEX UX_TaskTemplates_Code ON dbo.TaskTemplates(Code) WHERE Code IS NOT NULL;
        END
        ELSE
        BEGIN
          PRINT 'SKIP UX_TaskTemplates_Code — duplicate Code values present';
        END
      END
    `);
  },
};