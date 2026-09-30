/**
 * Migration 028: Daily routine support for PEMS templates.
 *
 *  PemsTaskTemplates
 *    AutoAssign       BIT       – when 1, the recurrence job creates one ASSIGNED instance per assignee
 *    DueTime          VARCHAR   – 'HH:mm' the routine is due on each run day (default 18:00)
 *    RunDays          VARCHAR   – comma list of weekdays (0=Sun … 6=Sat); NULL = Mon–Sat
 *    AssigneeUserIds  NVARCHAR  – JSON array; when empty the AssigneeRole is used
 *
 *  PemsRecurrenceLog
 *    AssigneeId       VARCHAR   – the person the occurrence was generated for
 *    The old unique index (TemplateId, OccurrenceFor) is replaced by one that includes AssigneeId
 *    so a template can fan out to many people for the same day.
 *
 * Existing recurring templates keep AutoAssign = 0, so their behaviour is unchanged.
 */
module.exports = {
  up: async (pool) => {
    const q = (s) => pool.request().query(s);

    await q(`IF COL_LENGTH('dbo.PemsTaskTemplates','AutoAssign') IS NULL
               ALTER TABLE dbo.PemsTaskTemplates ADD AutoAssign BIT NOT NULL CONSTRAINT DF_PemsTpl_AutoAssign DEFAULT 0;`);
    await q(`IF COL_LENGTH('dbo.PemsTaskTemplates','DueTime') IS NULL
               ALTER TABLE dbo.PemsTaskTemplates ADD DueTime VARCHAR(5) NULL;`);
    await q(`IF COL_LENGTH('dbo.PemsTaskTemplates','RunDays') IS NULL
               ALTER TABLE dbo.PemsTaskTemplates ADD RunDays VARCHAR(20) NULL;`);
    await q(`IF COL_LENGTH('dbo.PemsTaskTemplates','AssigneeUserIds') IS NULL
               ALTER TABLE dbo.PemsTaskTemplates ADD AssigneeUserIds NVARCHAR(MAX) NULL;`);

    await q(`IF COL_LENGTH('dbo.PemsRecurrenceLog','AssigneeId') IS NULL
               ALTER TABLE dbo.PemsRecurrenceLog ADD AssigneeId VARCHAR(50) NULL;`);
    await q(`IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_PemsRecurrence_TemplateOccurrence'
                        AND object_id = OBJECT_ID('dbo.PemsRecurrenceLog'))
               DROP INDEX UX_PemsRecurrence_TemplateOccurrence ON dbo.PemsRecurrenceLog;`);
    // Two filtered indexes keep the legacy rule (one row per template+occurrence when there is no assignee)
    // while allowing one row per assignee for fan-out templates.
    await q(`IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_PemsRecurrence_Legacy'
                            AND object_id = OBJECT_ID('dbo.PemsRecurrenceLog'))
               CREATE UNIQUE INDEX UX_PemsRecurrence_Legacy ON dbo.PemsRecurrenceLog(TemplateId, OccurrenceFor)
               WHERE AssigneeId IS NULL;`);
    await q(`IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_PemsRecurrence_Assignee'
                            AND object_id = OBJECT_ID('dbo.PemsRecurrenceLog'))
               CREATE UNIQUE INDEX UX_PemsRecurrence_Assignee ON dbo.PemsRecurrenceLog(TemplateId, OccurrenceFor, AssigneeId)
               WHERE AssigneeId IS NOT NULL;`);

    console.log('[Migration 028] ✅ Daily routine columns added to PemsTaskTemplates / PemsRecurrenceLog');
  },
};
