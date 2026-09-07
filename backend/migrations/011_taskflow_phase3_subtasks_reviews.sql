-- TaskFlow Migration: Phase 3 - Subtasks, Activities, Reviews, Evidence
-- Run this after Phase 2 migration

-- ============================================================
-- SUBTASKS
-- ============================================================
IF OBJECT_ID(N'dbo.TaskSubTasks', N'U') IS NULL
BEGIN
    CREATE TABLE TaskSubTasks (
        Id VARCHAR(50) PRIMARY KEY,
        TaskId VARCHAR(50) NOT NULL,
        Code NVARCHAR(20) NOT NULL,
        Title NVARCHAR(255) NOT NULL,
        Description NVARCHAR(MAX) NULL,
        Status NVARCHAR(20) NOT NULL DEFAULT 'PENDING',
        SortOrder INT NOT NULL DEFAULT 0,
        ExpectedOutput NVARCHAR(MAX) NULL,
        AssigneeId VARCHAR(50) NULL,
        CompletedAt DATETIME2 NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        CONSTRAINT FK_TaskSubTasks_Task FOREIGN KEY (TaskId) REFERENCES TaskInstances(Id) ON DELETE CASCADE,
        CONSTRAINT FK_TaskSubTasks_Assignee FOREIGN KEY (AssigneeId) REFERENCES Users(Id)
    );
    CREATE INDEX IX_TaskSubTasks_TaskId ON TaskSubTasks(TaskId);
    CREATE INDEX IX_TaskSubTasks_AssigneeId ON TaskSubTasks(AssigneeId);
    CREATE INDEX IX_TaskSubTasks_Status ON TaskSubTasks(Status);
    PRINT 'Created TaskSubTasks';
END

-- ============================================================
-- TASK ACTIVITIES (steps within subtasks)
-- ============================================================
IF OBJECT_ID(N'dbo.TaskActivities', N'U') IS NULL
BEGIN
    CREATE TABLE TaskActivities (
        Id VARCHAR(50) PRIMARY KEY,
        SubTaskId VARCHAR(50) NOT NULL,
        TaskId VARCHAR(50) NOT NULL,
        StepNo INT NOT NULL,
        Title NVARCHAR(255) NOT NULL,
        Instructions NVARCHAR(MAX) NULL,
        ExpectedOutput NVARCHAR(MAX) NULL,
        IsMandatory BIT NOT NULL DEFAULT 1,
        IsCompleted BIT NOT NULL DEFAULT 0,
        CompletedAt DATETIME2 NULL,
        CompletedBy VARCHAR(50) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        CONSTRAINT FK_TaskActivities_SubTask FOREIGN KEY (SubTaskId) REFERENCES TaskSubTasks(Id) ON DELETE CASCADE,
        CONSTRAINT FK_TaskActivities_Task FOREIGN KEY (TaskId) REFERENCES TaskInstances(Id) ON DELETE CASCADE,
        CONSTRAINT FK_TaskActivities_CompletedBy FOREIGN KEY (CompletedBy) REFERENCES Users(Id)
    );
    CREATE INDEX IX_TaskActivities_SubTaskId ON TaskActivities(SubTaskId);
    CREATE INDEX IX_TaskActivities_TaskId ON TaskActivities(TaskId);
    CREATE INDEX IX_TaskActivities_IsCompleted ON TaskActivities(IsCompleted);
    PRINT 'Created TaskActivities';
END

-- ============================================================
-- TASK ATTACHMENTS (evidence)
-- ============================================================
IF OBJECT_ID(N'dbo.TaskAttachments', N'U') IS NULL
BEGIN
    CREATE TABLE TaskAttachments (
        Id VARCHAR(50) PRIMARY KEY,
        TaskId VARCHAR(50) NOT NULL,
        SubTaskId VARCHAR(50) NULL,
        ActivityId VARCHAR(50) NULL,
        FileName NVARCHAR(255) NOT NULL,
        FileUrl NVARCHAR(500) NOT NULL,
        FileType NVARCHAR(50) NOT NULL DEFAULT 'FILE',
        FileSize BIGINT NULL,
        MimeType NVARCHAR(100) NULL,
        Remarks NVARCHAR(MAX) NULL,
        UploadedBy VARCHAR(50) NOT NULL,
        UploadedByName NVARCHAR(255) NULL,
        UploadedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        CONSTRAINT FK_TaskAttachments_Task FOREIGN KEY (TaskId) REFERENCES TaskInstances(Id) ON DELETE CASCADE,
        CONSTRAINT FK_TaskAttachments_SubTask FOREIGN KEY (SubTaskId) REFERENCES TaskSubTasks(Id) ON DELETE CASCADE,
        CONSTRAINT FK_TaskAttachments_Activity FOREIGN KEY (ActivityId) REFERENCES TaskActivities(Id) ON DELETE CASCADE,
        CONSTRAINT FK_TaskAttachments_UploadedBy FOREIGN KEY (UploadedBy) REFERENCES Users(Id)
    );
    CREATE INDEX IX_TaskAttachments_TaskId ON TaskAttachments(TaskId);
    CREATE INDEX IX_TaskAttachments_SubTaskId ON TaskAttachments(SubTaskId);
    CREATE INDEX IX_TaskAttachments_ActivityId ON TaskAttachments(ActivityId);
    PRINT 'Created TaskAttachments';
END

-- ============================================================
-- TASK COMMENTS (collaboration)
-- ============================================================
IF OBJECT_ID(N'dbo.TaskComments', N'U') IS NULL
BEGIN
    CREATE TABLE TaskComments (
        Id VARCHAR(50) PRIMARY KEY,
        TaskId VARCHAR(50) NOT NULL,
        SubTaskId VARCHAR(50) NULL,
        AuthorId VARCHAR(50) NOT NULL,
        Content NVARCHAR(MAX) NOT NULL,
        IsInternal BIT NOT NULL DEFAULT 0, -- internal notes vs client-visible
        ParentCommentId VARCHAR(50) NULL, -- for threaded replies
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        UpdatedAt DATETIME2 NULL,
        DeletedAt DATETIME2 NULL,
        CONSTRAINT FK_TaskComments_Task FOREIGN KEY (TaskId) REFERENCES TaskInstances(Id) ON DELETE CASCADE,
        CONSTRAINT FK_TaskComments_SubTask FOREIGN KEY (SubTaskId) REFERENCES TaskSubTasks(Id) ON DELETE CASCADE,
        CONSTRAINT FK_TaskComments_Author FOREIGN KEY (AuthorId) REFERENCES Users(Id),
        CONSTRAINT FK_TaskComments_Parent FOREIGN KEY (ParentCommentId) REFERENCES TaskComments(Id)
    );
    CREATE INDEX IX_TaskComments_TaskId ON TaskComments(TaskId);
    CREATE INDEX IX_TaskComments_SubTaskId ON TaskComments(SubTaskId);
    CREATE INDEX IX_TaskComments_AuthorId ON TaskComments(AuthorId);
    CREATE INDEX IX_TaskComments_CreatedAt ON TaskComments(CreatedAt);
    PRINT 'Created TaskComments';
END

-- ============================================================
-- TASK AUDIT LOG (event-sourced)
-- ============================================================
IF OBJECT_ID(N'dbo.TaskAuditLogs', N'U') IS NULL
BEGIN
    CREATE TABLE TaskAuditLogs (
        Id VARCHAR(50) PRIMARY KEY,
        TaskId VARCHAR(50) NOT NULL,
        Action NVARCHAR(50) NOT NULL, -- CREATED, STATUS_CHANGED, ASSIGNED, SUBMITTED, REVIEWED, APPROVED, REJECTED, REWORK, COMPLETED, CANCELLED, SUBTASK_COMPLETED, ACTIVITY_COMPLETED, EVIDENCE_UPLOADED, COMMENT_ADDED
        FromStatus NVARCHAR(20) NULL,
        ToStatus NVARCHAR(20) NULL,
        ActorId VARCHAR(50) NULL,
        ActorName NVARCHAR(255) NULL,
        Details NVARCHAR(MAX) NULL,
        Metadata NVARCHAR(MAX) NULL, -- JSON for additional context
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        CONSTRAINT FK_TaskAuditLogs_Task FOREIGN KEY (TaskId) REFERENCES TaskInstances(Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_TaskAuditLogs_TaskId_CreatedAt ON TaskAuditLogs(TaskId, CreatedAt DESC);
    CREATE INDEX IX_TaskAuditLogs_Action ON TaskAuditLogs(Action);
    CREATE INDEX IX_TaskAuditLogs_ActorId ON TaskAuditLogs(ActorId);
    PRINT 'Created TaskAuditLogs';
END

-- ============================================================
-- TASK WATCHERS (notifications)
-- ============================================================
IF OBJECT_ID(N'dbo.TaskWatchers', N'U') IS NULL
BEGIN
    CREATE TABLE TaskWatchers (
        Id VARCHAR(50) PRIMARY KEY,
        TaskId VARCHAR(50) NOT NULL,
        UserId VARCHAR(50) NOT NULL,
        NotifyOnStatusChange BIT NOT NULL DEFAULT 1,
        NotifyOnComment BIT NOT NULL DEFAULT 1,
        NotifyOnSla BIT NOT NULL DEFAULT 1,
        NotifyOnAssignment BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        CONSTRAINT FK_TaskWatchers_Task FOREIGN KEY (TaskId) REFERENCES TaskInstances(Id) ON DELETE CASCADE,
        CONSTRAINT FK_TaskWatchers_User FOREIGN KEY (UserId) REFERENCES Users(Id),
        CONSTRAINT UQ_TaskWatchers_Task_User UNIQUE (TaskId, UserId)
    );
    CREATE INDEX IX_TaskWatchers_TaskId ON TaskWatchers(TaskId);
    CREATE INDEX IX_TaskWatchers_UserId ON TaskWatchers(UserId);
    PRINT 'Created TaskWatchers';
END

-- ============================================================
-- RECURRENCE LOG (for recurring tasks)
-- ============================================================
IF OBJECT_ID(N'dbo.TaskRecurrenceLog', N'U') IS NULL
BEGIN
    CREATE TABLE TaskRecurrenceLog (
        Id VARCHAR(50) PRIMARY KEY,
        TemplateId VARCHAR(50) NOT NULL,
        InstanceId VARCHAR(50) NOT NULL,
        OccurrenceFor DATETIME2 NOT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        CONSTRAINT FK_TaskRecurrenceLog_Template FOREIGN KEY (TemplateId) REFERENCES TaskTemplates(Id) ON DELETE CASCADE,
        CONSTRAINT FK_TaskRecurrenceLog_Instance FOREIGN KEY (InstanceId) REFERENCES TaskInstances(Id) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX UQ_TaskRecurrenceLog_Template_Occurrence ON TaskRecurrenceLog(TemplateId, OccurrenceFor);
    CREATE INDEX IX_TaskRecurrenceLog_InstanceId ON TaskRecurrenceLog(InstanceId);
    PRINT 'Created TaskRecurrenceLog';
END

-- ============================================================
-- TASK SLA POLICIES (already created in Phase 2)
-- ============================================================

-- ============================================================
-- DEFAULT TEMPLATE (example)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM TaskTemplates WHERE Code = 'TPL-0001')
BEGIN
    INSERT INTO TaskTemplates (Id, Code, Name, Description, Category, Department, DefaultAssigneeRole, DefaultReviewerRole, DefaultSlaPolicyId, DefaultPriority, DefaultSlaHours, Frequency, BusinessDaysOnly, ExcludeHolidays, Timezone, IsActive, CreatedAt, UpdatedAt)
    VALUES (
        'tpl-standard-audit',
        'TPL-0001',
        'Standard Quality Audit',
        'Standard quality audit template for seller listings',
        'COMPLIANCE',
        'OPERATIONS',
        'brand_manager',
        'reviewer',
        'sla-standard-48h',
        'MEDIUM',
        48,
        'ONE_TIME',
        1, -- BusinessDaysOnly
        1, -- ExcludeHolidays
        'Asia/Kolkata',
        1,
        dbo.GetEnvDate(),
        dbo.GetEnvDate()
    );
    PRINT 'Inserted default template';
END

-- ============================================================
-- DEFAULT ESCALATION POLICIES
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM TaskEscalationPolicies WHERE Id = 'esc-sla-warning')
BEGIN
    INSERT INTO TaskEscalationPolicies (Id, Name, Description, TriggerType, Conditions, Actions, NotifyRoles, Channels, DelayMinutes, RepeatIntervalMinutes, MaxEscalations, CooldownMinutes, Priority, IsActive, CreatedAt, UpdatedAt)
    VALUES (
        'esc-sla-warning',
        'SLA Warning',
        'Notify assignee when task is at risk of SLA breach',
        'SLA_WARNING',
        '{"atRisk": true}',
        '[{"type": "SEND_NOTIFICATION", "notifyRoles": ["assignee"], "channels": ["in_app", "email"]}]',
        '["assignee"]',
        '["in_app", "email"]',
        0,
        360,
        3,
        360,
        10,
        1,
        dbo.GetEnvDate(),
        dbo.GetEnvDate()
    );
    PRINT 'Inserted default escalation policy: SLA Warning';
END

IF NOT EXISTS (SELECT 1 FROM TaskEscalationPolicies WHERE Id = 'esc-sla-breach')
BEGIN
    INSERT INTO TaskEscalationPolicies (Id, Name, Description, TriggerType, Conditions, Actions, NotifyRoles, Channels, DelayMinutes, RepeatIntervalMinutes, MaxEscalations, CooldownMinutes, Priority, IsActive, CreatedAt, UpdatedAt)
    VALUES (
        'esc-sla-breach',
        'SLA Breach',
        'Escalate when task SLA is breached',
        'SLA_BREACH',
        '{"slaBreached": true}',
        '[{"type": "SEND_NOTIFICATION", "notifyRoles": ["assignee", "reviewer", "manager"], "channels": ["in_app", "email"]}, {"type": "ADD_WATCHER", "targetUserId": "{{reviewerId}}"}, {"type": "ADD_COMMENT", "message": "SLA breached - automatic escalation triggered"}]',
        '["assignee", "reviewer", "manager"]',
        '["in_app", "email", "slack"]',
        0,
        120,
        3,
        60,
        5,
        1,
        dbo.GetEnvDate(),
        dbo.GetEnvDate()
    );
    PRINT 'Inserted default escalation policy: SLA Breach';
END

IF NOT EXISTS (SELECT 1 FROM TaskEscalationPolicies WHERE Id = 'esc-stalled-task')
BEGIN
    INSERT INTO TaskEscalationPolicies (Id, Name, Description, TriggerType, Conditions, Actions, NotifyRoles, Channels, DelayMinutes, RepeatIntervalMinutes, MaxEscalations, CooldownMinutes, Priority, IsActive, CreatedAt, UpdatedAt)
    VALUES (
        'esc-stalled-task',
        'Stalled Task',
        'Escalate when task has no activity for 48 hours',
        'STALLED_TASK',
        '{"stalledHours": 48}',
        '[{"type": "SEND_NOTIFICATION", "notifyRoles": ["assignee", "reviewer"], "channels": ["in_app", "email"]}, {"type": "ADD_COMMENT", "message": "Task appears stalled - no activity for 48 hours"}]',
        '["assignee", "reviewer"]',
        '["in_app", "email"]',
        0,
        1440,
        2,
        1440,
        15,
        1,
        dbo.GetEnvDate(),
        dbo.GetEnvDate()
    );
    PRINT 'Inserted default escalation policy: Stalled Task';
END

IF NOT EXISTS (SELECT 1 FROM TaskEscalationPolicies WHERE Id = 'esc-overdue-subtask')
BEGIN
    INSERT INTO TaskEscalationPolicies (Id, Name, Description, TriggerType, Conditions, Actions, NotifyRoles, Channels, DelayMinutes, RepeatIntervalMinutes, MaxEscalations, CooldownMinutes, Priority, IsActive, CreatedAt, UpdatedAt)
    VALUES (
        'esc-overdue-subtask',
        'Overdue Subtask',
        'Escalate when subtask is overdue by 24 hours',
        'OVERDUE_SUBTASK',
        '{"overdueHours": 24}',
        '[{"type": "CREATE_SUBTASK", "title": "Resolve overdue subtask", "assigneeId": "{{assigneeId}}"}, {"type": "SEND_NOTIFICATION", "notifyRoles": ["assignee"], "channels": ["in_app", "email"]}]',
        '["assignee"]',
        '["in_app", "email"]',
        0,
        720,
        2,
        720,
        20,
        1,
        dbo.GetEnvDate(),
        dbo.GetEnvDate()
    );
    PRINT 'Inserted default escalation policy: Overdue Subtask';
END

-- ============================================================
-- DEFAULT NOTIFICATION PREFERENCES
-- ============================================================
-- These will be created per-user on first login

PRINT 'TaskFlow Phase 3 Migration Complete!';
PRINT 'New tables: TaskSubTasks, TaskActivities, TaskAttachments, TaskComments, TaskAuditLogs, TaskWatchers, TaskRecurrenceLog';
PRINT 'Default escalation policies inserted: SLA Warning, SLA Breach, Stalled Task, Overdue Subtask';
PRINT 'Run: escalationEngine.startMonitoring(15)';
PRINT 'Run: slaEngine.startMonitoring(30)';