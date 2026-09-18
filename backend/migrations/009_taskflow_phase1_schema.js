/**
 * TaskFlow Phase 1 — core schema (TaskSlaPolicies, TaskTemplates,
 * TaskInstances, TaskSubTasks, TaskActivities, TaskAttachments,
 * TaskComments, TaskAuditLogs, TaskWatchers, TaskRecurrenceLog) plus
 * default SLA policy + default template seeds.
 *
 * Converted from plain .sql to JS because FK columns are typed from the
 * *actual* referenced column at runtime (live EF-schema treats Users.Id as
 * nvarchar(100); fresh init-database.sql installs use VARCHAR(50)).
 */
const { columnExists, createTableIfMissing } = require('./_helpers');

module.exports = {
  up: async (pool) => {
    // ── TaskSlaPolicies ──
    await createTableIfMissing(pool, {
      name: 'TaskSlaPolicies',
      columns: [
        ['Id', { type: 'VARCHAR(50)', pk: true }],
        ['Name', { ddl: 'NVARCHAR(255) NOT NULL' }],
        ['Description', { ddl: 'NVARCHAR(MAX) NULL' }],
        ['SlaHours', { ddl: 'INT NOT NULL DEFAULT 48' }],
        ['WarningHours', { ddl: 'NVARCHAR(MAX) NULL' }],
        ['BusinessHoursOnly', { ddl: 'BIT NOT NULL DEFAULT 1' }],
        ['Timezone', { ddl: "NVARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata'" }],
        ['ExcludeWeekends', { ddl: 'BIT NOT NULL DEFAULT 1' }],
        ['HolidayCalendar', { ddl: 'NVARCHAR(100) NULL' }],
        ['EscalationRules', { ddl: 'NVARCHAR(MAX) NOT NULL' }],
        ['NotificationChannels', { ddl: 'NVARCHAR(MAX) NOT NULL' }],
        ['IsDefault', { ddl: 'BIT NOT NULL DEFAULT 0' }],
        ['IsActive', { ddl: 'BIT NOT NULL DEFAULT 1' }],
        ['CreatedBy', { ddl: 'VARCHAR(50) NULL' }],
        ['CreatedAt', { ddl: 'DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()' }],
        ['UpdatedAt', { ddl: 'DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()' }],
      ],
      indexes: [
        { name: 'CK_TaskSlaPolicies_Default', cols: ['IsDefault'], unique: true, filter: 'IsDefault = 1' },
        { name: 'IX_TaskSlaPolicies_Active', cols: ['IsActive'] },
      ],
    });

    // ── TaskTemplates ──
    await createTableIfMissing(pool, {
      name: 'TaskTemplates',
      columns: [
        ['Id', { type: 'VARCHAR(50)', pk: true }],
        ['Code', { ddl: 'NVARCHAR(20) NOT NULL UNIQUE' }],
        ['Name', { ddl: 'NVARCHAR(255) NOT NULL' }],
        ['Description', { ddl: 'NVARCHAR(MAX) NULL' }],
        ['Category', { ddl: "NVARCHAR(100) NOT NULL DEFAULT 'GENERAL'" }],
        ['Department', { ddl: "NVARCHAR(100) NOT NULL DEFAULT 'OPERATIONS'" }],
        ['DefaultAssigneeRole', { ddl: "NVARCHAR(50) NOT NULL DEFAULT 'brand_manager'" }],
        ['DefaultReviewerRole', { ddl: "NVARCHAR(50) NOT NULL DEFAULT 'reviewer'" }],
        ['DefaultSlaPolicyId', { fk: { table: 'TaskSlaPolicies', col: 'Id' } }],
        ['DefaultPriority', { ddl: "NVARCHAR(20) NOT NULL DEFAULT 'MEDIUM'" }],
        ['DefaultSlaHours', { ddl: 'INT NOT NULL DEFAULT 48' }],
        ['Frequency', { ddl: "NVARCHAR(20) NOT NULL DEFAULT 'ONE_TIME'" }],
        ['CronExpression', { ddl: 'NVARCHAR(100) NULL' }],
        ['BusinessDaysOnly', { ddl: 'BIT NOT NULL DEFAULT 1' }],
        ['ExcludeHolidays', { ddl: 'BIT NOT NULL DEFAULT 1' }],
        ['HolidayCalendar', { ddl: 'NVARCHAR(50) NULL' }],
        ['Timezone', { ddl: "NVARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata'" }],
        ['SubtaskDefinitions', { ddl: 'NVARCHAR(MAX) NULL' }],
        ['ActivityDefinitions', { ddl: 'NVARCHAR(MAX) NULL' }],
        ['Tags', { ddl: 'NVARCHAR(MAX) NULL' }],
        ['IsActive', { ddl: 'BIT NOT NULL DEFAULT 1' }],
        ['CreatedBy', { ddl: 'VARCHAR(50) NULL' }],
        ['CreatedAt', { ddl: 'DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()' }],
        ['UpdatedAt', { ddl: 'DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()' }],
      ],
      indexes: [
        { name: 'IX_TaskTemplates_Active', cols: ['IsActive'] },
        { name: 'IX_TaskTemplates_Category', cols: ['Category'] },
        { name: 'IX_TaskTemplates_Department', cols: ['Department'] },
      ],
    });

    // ── TaskInstances ──
    await createTableIfMissing(pool, {
      name: 'TaskInstances',
      columns: [
        ['Id', { type: 'VARCHAR(50)', pk: true }],
        ['Code', { ddl: 'NVARCHAR(20) NOT NULL UNIQUE' }],
        ['TemplateId', { fk: { table: 'TaskTemplates', col: 'Id' } }],
        ['Title', { ddl: 'NVARCHAR(255) NOT NULL' }],
        ['Description', { ddl: 'NVARCHAR(MAX) NULL' }],
        ['Status', { ddl: "NVARCHAR(20) NOT NULL DEFAULT 'CREATED'" }],
        ['AssigneeId', { fk: { table: 'Users', col: 'Id' } }],
        ['ReviewerId', { fk: { table: 'Users', col: 'Id' } }],
        ['AssigneeRole', { ddl: 'NVARCHAR(50) NULL' }],
        ['ReviewerRole', { ddl: 'NVARCHAR(50) NULL' }],
        ['SellerId', { ddl: 'VARCHAR(50) NULL' }],
        ['Department', { ddl: "NVARCHAR(100) NOT NULL DEFAULT 'OPERATIONS'" }],
        ['Priority', { ddl: "NVARCHAR(20) NOT NULL DEFAULT 'MEDIUM'" }],
        ['SlaHours', { ddl: 'INT NOT NULL DEFAULT 48' }],
        ['SlaPolicyId', { fk: { table: 'TaskSlaPolicies', col: 'Id' } }],
        ['DueDate', { ddl: 'DATETIME2 NULL' }],
        ['AssignedAt', { ddl: 'DATETIME2 NULL' }],
        ['StartedAt', { ddl: 'DATETIME2 NULL' }],
        ['SubmittedAt', { ddl: 'DATETIME2 NULL' }],
        ['ReviewedAt', { ddl: 'DATETIME2 NULL' }],
        ['CompletedAt', { ddl: 'DATETIME2 NULL' }],
        ['SlaStatus', { ddl: "NVARCHAR(20) NOT NULL DEFAULT 'WITHIN_SLA'" }],
        ['SlaBreachedAt', { ddl: 'DATETIME2 NULL' }],
        ['EscalationLevel', { ddl: 'INT NOT NULL DEFAULT 0' }],
        ['Tags', { ddl: 'NVARCHAR(MAX) NULL' }],
        ['CreatedBy', { ddl: 'VARCHAR(50) NULL' }],
        ['CreatedAt', { ddl: 'DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()' }],
        ['UpdatedAt', { ddl: 'DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()' }],
      ],
      indexes: [
        { name: 'IX_TaskInstances_Status', cols: ['Status'] },
        { name: 'IX_TaskInstances_AssigneeId', cols: ['AssigneeId'] },
        { name: 'IX_TaskInstances_ReviewerId', cols: ['ReviewerId'] },
        { name: 'IX_TaskInstances_SellerId', cols: ['SellerId'] },
        { name: 'IX_TaskInstances_DueDate', cols: ['DueDate'] },
        { name: 'IX_TaskInstances_Status_DueDate', cols: ['Status', 'DueDate'] },
        { name: 'IX_TaskInstances_SlaStatus', cols: ['SlaStatus'] },
        { name: 'IX_TaskInstances_CreatedAt', cols: ['CreatedAt'] },
        { name: 'IX_TaskInstances_Assignee_Status', cols: ['AssigneeId', 'Status'] },
      ],
    });

    // ── TaskSubTasks ──
    await createTableIfMissing(pool, {
      name: 'TaskSubTasks',
      columns: [
        ['Id', { type: 'VARCHAR(50)', pk: true }],
        ['TaskId', { fk: { table: 'TaskInstances', col: 'Id' }, nullable: false, onDelete: 'CASCADE' }],
        ['Code', { ddl: 'NVARCHAR(20) NOT NULL' }],
        ['Title', { ddl: 'NVARCHAR(255) NOT NULL' }],
        ['Description', { ddl: 'NVARCHAR(MAX) NULL' }],
        ['Status', { ddl: "NVARCHAR(20) NOT NULL DEFAULT 'PENDING'" }],
        ['SortOrder', { ddl: 'INT NOT NULL DEFAULT 0' }],
        ['ExpectedOutput', { ddl: 'NVARCHAR(MAX) NULL' }],
        ['AssigneeId', { fk: { table: 'Users', col: 'Id' } }],
        ['CompletedAt', { ddl: 'DATETIME2 NULL' }],
        ['CreatedAt', { ddl: 'DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()' }],
        ['UpdatedAt', { ddl: 'DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()' }],
      ],
      indexes: [
        { name: 'IX_TaskSubTasks_TaskId', cols: ['TaskId'] },
        { name: 'IX_TaskSubTasks_AssigneeId', cols: ['AssigneeId'] },
        { name: 'IX_TaskSubTasks_Status', cols: ['Status'] },
      ],
    });

    // ── TaskActivities ──
    await createTableIfMissing(pool, {
      name: 'TaskActivities',
      columns: [
        ['Id', { type: 'VARCHAR(50)', pk: true }],
        ['SubTaskId', { fk: { table: 'TaskSubTasks', col: 'Id' }, nullable: false, onDelete: 'CASCADE' }],
        ['TaskId', { fk: { table: 'TaskInstances', col: 'Id' }, nullable: false, onDelete: 'CASCADE' }],
        ['StepNo', { ddl: 'INT NOT NULL' }],
        ['Title', { ddl: 'NVARCHAR(255) NOT NULL' }],
        ['Instructions', { ddl: 'NVARCHAR(MAX) NULL' }],
        ['ExpectedOutput', { ddl: 'NVARCHAR(MAX) NULL' }],
        ['IsMandatory', { ddl: 'BIT NOT NULL DEFAULT 1' }],
        ['IsCompleted', { ddl: 'BIT NOT NULL DEFAULT 0' }],
        ['CompletedAt', { ddl: 'DATETIME2 NULL' }],
        ['CompletedBy', { fk: { table: 'Users', col: 'Id' } }],
        ['CreatedAt', { ddl: 'DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()' }],
        ['UpdatedAt', { ddl: 'DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()' }],
      ],
      indexes: [
        { name: 'IX_TaskActivities_SubTaskId', cols: ['SubTaskId'] },
        { name: 'IX_TaskActivities_TaskId', cols: ['TaskId'] },
        { name: 'IX_TaskActivities_IsCompleted', cols: ['IsCompleted'] },
      ],
    });

    // ── TaskAttachments ──
    await createTableIfMissing(pool, {
      name: 'TaskAttachments',
      columns: [
        ['Id', { type: 'VARCHAR(50)', pk: true }],
        ['TaskId', { fk: { table: 'TaskInstances', col: 'Id' }, nullable: false, onDelete: 'CASCADE' }],
        ['SubTaskId', { fk: { table: 'TaskSubTasks', col: 'Id' }, onDelete: 'CASCADE' }],
        ['ActivityId', { fk: { table: 'TaskActivities', col: 'Id' }, onDelete: 'CASCADE' }],
        ['FileName', { ddl: 'NVARCHAR(255) NOT NULL' }],
        ['FileUrl', { ddl: 'NVARCHAR(500) NOT NULL' }],
        ['FileType', { ddl: "NVARCHAR(50) NOT NULL DEFAULT 'FILE'" }],
        ['FileSize', { ddl: 'BIGINT NULL' }],
        ['MimeType', { ddl: 'NVARCHAR(100) NULL' }],
        ['Remarks', { ddl: 'NVARCHAR(MAX) NULL' }],
        ['UploadedBy', { fk: { table: 'Users', col: 'Id' }, nullable: false }],
        ['UploadedByName', { ddl: 'NVARCHAR(255) NULL' }],
        ['UploadedAt', { ddl: 'DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()' }],
      ],
      indexes: [
        { name: 'IX_TaskAttachments_TaskId', cols: ['TaskId'] },
        { name: 'IX_TaskAttachments_SubTaskId', cols: ['SubTaskId'] },
        { name: 'IX_TaskAttachments_ActivityId', cols: ['ActivityId'] },
      ],
    });

    // ── TaskComments ──
    await createTableIfMissing(pool, {
      name: 'TaskComments',
      columns: [
        ['Id', { type: 'VARCHAR(50)', pk: true }],
        ['TaskId', { fk: { table: 'TaskInstances', col: 'Id' }, nullable: false, onDelete: 'CASCADE' }],
        ['SubTaskId', { fk: { table: 'TaskSubTasks', col: 'Id' }, onDelete: 'CASCADE' }],
        ['AuthorId', { fk: { table: 'Users', col: 'Id' }, nullable: false }],
        ['Content', { ddl: 'NVARCHAR(MAX) NOT NULL' }],
        ['IsInternal', { ddl: 'BIT NOT NULL DEFAULT 0' }],
        ['ParentCommentId', { fk: { table: 'TaskComments', col: 'Id' } }],
        ['CreatedAt', { ddl: 'DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()' }],
        ['UpdatedAt', { ddl: 'DATETIME2 NULL' }],
        ['DeletedAt', { ddl: 'DATETIME2 NULL' }],
      ],
      indexes: [
        { name: 'IX_TaskComments_TaskId', cols: ['TaskId'] },
        { name: 'IX_TaskComments_SubTaskId', cols: ['SubTaskId'] },
        { name: 'IX_TaskComments_AuthorId', cols: ['AuthorId'] },
        { name: 'IX_TaskComments_CreatedAt', cols: ['CreatedAt'] },
      ],
    });

    // ── TaskAuditLogs ──
    await createTableIfMissing(pool, {
      name: 'TaskAuditLogs',
      columns: [
        ['Id', { type: 'VARCHAR(50)', pk: true }],
        ['TaskId', { fk: { table: 'TaskInstances', col: 'Id' }, nullable: false, onDelete: 'CASCADE' }],
        ['Action', { ddl: 'NVARCHAR(50) NOT NULL' }],
        ['FromStatus', { ddl: 'NVARCHAR(20) NULL' }],
        ['ToStatus', { ddl: 'NVARCHAR(20) NULL' }],
        ['ActorId', { ddl: 'VARCHAR(50) NULL' }],
        ['ActorName', { ddl: 'NVARCHAR(255) NULL' }],
        ['Details', { ddl: 'NVARCHAR(MAX) NULL' }],
        ['Metadata', { ddl: 'NVARCHAR(MAX) NULL' }],
        ['CreatedAt', { ddl: 'DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()' }],
      ],
      indexes: [
        { name: 'IX_TaskAuditLogs_TaskId_CreatedAt', cols: ['TaskId', 'CreatedAt DESC'] },
        { name: 'IX_TaskAuditLogs_Action', cols: ['Action'] },
        { name: 'IX_TaskAuditLogs_ActorId', cols: ['ActorId'] },
      ],
    });

    // ── TaskWatchers ──
    await createTableIfMissing(pool, {
      name: 'TaskWatchers',
      columns: [
        ['Id', { type: 'VARCHAR(50)', pk: true }],
        ['TaskId', { fk: { table: 'TaskInstances', col: 'Id' }, nullable: false, onDelete: 'CASCADE' }],
        ['UserId', { fk: { table: 'Users', col: 'Id' }, nullable: false }],
        ['NotifyOnStatusChange', { ddl: 'BIT NOT NULL DEFAULT 1' }],
        ['NotifyOnComment', { ddl: 'BIT NOT NULL DEFAULT 1' }],
        ['NotifyOnSla', { ddl: 'BIT NOT NULL DEFAULT 1' }],
        ['NotifyOnAssignment', { ddl: 'BIT NOT NULL DEFAULT 1' }],
        ['CreatedAt', { ddl: 'DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()' }],
      ],
      indexes: [
        { name: 'UQ_TaskWatchers_Task_User', cols: ['TaskId', 'UserId'], unique: true },
        { name: 'IX_TaskWatchers_TaskId', cols: ['TaskId'] },
        { name: 'IX_TaskWatchers_UserId', cols: ['UserId'] },
      ],
    });

    // ── TaskRecurrenceLog ──
    await createTableIfMissing(pool, {
      name: 'TaskRecurrenceLog',
      columns: [
        ['Id', { type: 'VARCHAR(50)', pk: true }],
        ['TemplateId', { fk: { table: 'TaskTemplates', col: 'Id' }, nullable: false, onDelete: 'CASCADE' }],
        ['InstanceId', { fk: { table: 'TaskInstances', col: 'Id' }, nullable: false, onDelete: 'CASCADE' }],
        ['OccurrenceFor', { ddl: 'DATETIME2 NOT NULL' }],
        ['CreatedAt', { ddl: 'DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()' }],
      ],
      indexes: [
        { name: 'UQ_TaskRecurrenceLog_Template_Occurrence', cols: ['TemplateId', 'OccurrenceFor'], unique: true },
        { name: 'IX_TaskRecurrenceLog_InstanceId', cols: ['InstanceId'] },
      ],
    });

    // ── Default SLA policy ──
    if (await columnExists(pool, 'TaskSlaPolicies', 'IsDefault')) {
      await pool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM TaskSlaPolicies WHERE IsDefault = 1)
        BEGIN
          INSERT INTO TaskSlaPolicies (Id, Name, Description, SlaHours, WarningHours, BusinessHoursOnly, Timezone, ExcludeWeekends, HolidayCalendar, EscalationRules, NotificationChannels, IsDefault, IsActive, CreatedAt, UpdatedAt)
          VALUES (
            'sla-standard-48h', 'Standard 48h', 'Standard 48-hour SLA with 24h/12h/6h warnings', 48,
            '[24, 12, 6]', 1, 'Asia/Kolkata', 1, 'india',
            '[{"level":"assignee","hoursBeforeDue":24,"notify":["assignee"]},{"level":"reviewer","hoursBeforeDue":12,"notify":["reviewer"]},{"level":"manager","hoursAfterBreach":0,"notify":["manager"]},{"level":"admin","hoursAfterBreach":24,"notify":["admin"]}]',
            '{"email":true,"inApp":true,"slack":false,"webhook":null}',
            1, 1, dbo.GetEnvDate(), dbo.GetEnvDate()
          );
          PRINT 'Inserted default SLA policy';
        END
      `);
    }

    // ── Default template (example) ──
    if (await columnExists(pool, 'TaskTemplates', 'Code')) {
      await pool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM TaskTemplates WHERE Code = 'TPL-0001')
        BEGIN
          INSERT INTO TaskTemplates (Id, Code, Name, Description, Category, Department, DefaultAssigneeRole, DefaultReviewerRole, DefaultSlaPolicyId, DefaultPriority, DefaultSlaHours, Frequency, BusinessDaysOnly, ExcludeHolidays, Timezone, IsActive, CreatedAt, UpdatedAt)
          VALUES (
            'tpl-standard-audit', 'TPL-0001', 'Standard Quality Audit',
            'Standard quality audit template for seller listings',
            'COMPLIANCE', 'OPERATIONS', 'brand_manager', 'reviewer',
            'sla-standard-48h', 'MEDIUM', 48, 'ONE_TIME',
            1, 1, 'Asia/Kolkata', 1, dbo.GetEnvDate(), dbo.GetEnvDate()
          );
          PRINT 'Inserted default template';
        END
      `);
    }

    console.log('009_taskflow_phase1_schema complete');
  },
};