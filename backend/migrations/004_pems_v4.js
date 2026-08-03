/**
 * PEMS V4 — recurrence engine support, SLA notification dedup,
 * event-store integrity and query-support indexes.
 * Idempotent — safe to run multiple times.
 */
module.exports = {
  up: async (pool, sql) => {
    // ── Recurrence: templates ──
    await pool.request().query(`
      IF COL_LENGTH('dbo.PemsTaskTemplates', 'LastGeneratedAt') IS NULL
        ALTER TABLE PemsTaskTemplates ADD LastGeneratedAt DATETIME2 NULL;
      IF COL_LENGTH('dbo.PemsTaskTemplates', 'NextScheduledDate') IS NULL
        ALTER TABLE PemsTaskTemplates ADD NextScheduledDate DATETIME2 NULL;
    `);

    // ── Recurrence: occurrence log (unique guard prevents duplicates) ──
    await pool.request().query(`
      IF OBJECT_ID(N'dbo.PemsRecurrenceLog', N'U') IS NULL
      BEGIN
        CREATE TABLE PemsRecurrenceLog (
          Id VARCHAR(50) PRIMARY KEY,
          TemplateId VARCHAR(50) NOT NULL,
          InstanceId VARCHAR(50) NOT NULL,
          OccurrenceFor DATETIME2 NOT NULL,
          Status NVARCHAR(20) NOT NULL DEFAULT 'CREATED',
          CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()
        );
        CREATE UNIQUE INDEX UX_PemsRecurrence_TemplateOccurrence ON PemsRecurrenceLog(TemplateId, OccurrenceFor);
        CREATE INDEX IX_PemsRecurrence_Template ON PemsRecurrenceLog(TemplateId);
      END
    `);

    // ── SLA notification dedup ──
    await pool.request().query(`
      IF COL_LENGTH('dbo.PemsTaskInstances', 'LastSlaWarningAt') IS NULL
        ALTER TABLE PemsTaskInstances ADD LastSlaWarningAt DATETIME2 NULL;
      IF COL_LENGTH('dbo.PemsTaskInstances', 'LastSlaBreachAt') IS NULL
        ALTER TABLE PemsTaskInstances ADD LastSlaBreachAt DATETIME2 NULL;
    `);

    // ── Event-store integrity: unique (TaskInstanceId, Version) ──
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = 'UX_PemsTaskEvents_TaskVersion' AND object_id = OBJECT_ID('dbo.PemsTaskEvents')
      )
        CREATE UNIQUE INDEX UX_PemsTaskEvents_TaskVersion ON PemsTaskEvents(TaskInstanceId, Version);
    `);

    // ── Query-support indexes ──
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = 'IX_PemsInstances_FrequencyStatus' AND object_id = OBJECT_ID('dbo.PemsTaskInstances')
      )
        CREATE INDEX IX_PemsInstances_FrequencyStatus ON PemsTaskInstances(Frequency, Status) INCLUDE (Department, DueDate);

      IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = 'IX_PemsTemplates_FrequencyActive' AND object_id = OBJECT_ID('dbo.PemsTaskTemplates')
      )
        CREATE INDEX IX_PemsTemplates_FrequencyActive ON PemsTaskTemplates(Frequency, IsActive) INCLUDE (NextScheduledDate);
    `);
  },
};
