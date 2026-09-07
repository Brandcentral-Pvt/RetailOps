-- TaskFlow Migration: Phase 1 - Core Schema
-- Creates all core tables for the new TaskFlow system
-- Run this on production SQL Server

-- ============================================================
-- SLA POLICIES
-- ============================================================
IF OBJECT_ID(N'dbo.TaskSlaPolicies', N'U') IS NULL
BEGIN
    CREATE TABLE TaskSlaPolicies (
        Id VARCHAR(50) PRIMARY KEY,
        Name NVARCHAR(255) NOT NULL,
        Description NVARCHAR(MAX) NULL,
        SlaHours INT NOT NULL DEFAULT 48,
        WarningHours NVARCHAR(MAX) NULL, -- JSON array: [24, 12, 6]
        BusinessHoursOnly BIT NOT NULL DEFAULT 1,
        Timezone NVARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
        ExcludeWeekends BIT NOT NULL DEFAULT 1,
        HolidayCalendar NVARCHAR(100) NULL, -- 'india', 'us', etc.
        EscalationRules NVARCHAR(MAX) NOT NULL, -- JSON array of escalation rules
        NotificationChannels NVARCHAR(MAX) NOT NULL, -- JSON: {"email":true,"inApp":true,"slack":false,"webhook":null}
        IsDefault BIT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedBy VARCHAR(50) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        CONSTRAINT CK_TaskSlaPolicies_Default UNIQUE (IsDefault) WHERE IsDefault = 1
    );
    CREATE INDEX IX_TaskSlaPolicies_Active ON TaskSlaPolicies(IsActive);
    PRINT 'Created TaskSlaPolicies';
END

-- ============================================================
-- TASK TEMPLATES
-- ============================================================
IF OBJECT_ID(N'dbo.TaskTemplates', N'U') IS NULL
BEGIN
    CREATE TABLE TaskTemplates (
        Id VARCHAR(50) PRIMARY KEY,
        Code NVARCHAR(20) NOT NULL UNIQUE,
        Name NVARCHAR(255) NOT NULL,
        Description NVARCHAR(MAX) NULL,
        Category NVARCHAR(100) NOT NULL DEFAULT 'GENERAL',
        Department NVARCHAR(100) NOT NULL DEFAULT 'OPERATIONS',
        DefaultAssigneeRole NVARCHAR(50) NOT NULL DEFAULT 'brand_manager',
        DefaultReviewerRole NVARCHAR(50) NOT NULL DEFAULT 'reviewer',
        DefaultSlaPolicyId VARCHAR(50) NULL,
        DefaultPriority NVARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
        DefaultSlaHours INT NOT NULL DEFAULT 48,
        Frequency NVARCHAR(20) NOT NULL DEFAULT 'ONE_TIME',
        CronExpression NVARCHAR(100) NULL,
        BusinessDaysOnly BIT NOT NULL DEFAULT 1,
        ExcludeHolidays BIT NOT NULL DEFAULT 1,
        HolidayCalendar NVARCHAR(50) NULL,
        Timezone NVARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
        SubtaskDefinitions NVARCHAR(MAX) NULL, -- JSON array
        ActivityDefinitions NVARCHAR(MAX) NULL, -- JSON array
        Tags NVARCHAR(MAX) NULL, -- JSON array
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedBy VARCHAR(50) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        CONSTRAINT FK_TaskTemplates_SlaPolicy FOREIGN KEY (DefaultSlaPolicyId) REFERENCES TaskSlaPolicies(Id)
    );
    CREATE INDEX IX_TaskTemplates_Active ON TaskTemplates(IsActive);
    CREATE INDEX IX_TaskTemplates_Category ON TaskTemplates(Category);
    CREATE INDEX IX_TaskTemplates_Department ON TaskTemplates(Department);
    PRINT 'Created TaskTemplates';
END

-- ============================================================
-- TASK INSTANCES
-- ============================================================
IF OBJECT_ID(N'dbo.TaskInstances', N'U') IS NULL
BEGIN
    CREATE TABLE TaskInstances (
        Id VARCHAR(50) PRIMARY KEY,
        Code NVARCHAR(20) NOT NULL UNIQUE,
        TemplateId VARCHAR(50) NULL,
        Title NVARCHAR(255) NOT NULL,
        Description NVARCHAR(MAX) NULL,
        Status NVARCHAR(20) NOT NULL DEFAULT 'CREATED',
        AssigneeId VARCHAR(50) NULL,
        ReviewerId VARCHAR(50) NULL,
        AssigneeRole NVARCHAR(50) NULL,
        ReviewerRole NVARCHAR(50) NULL,
        SellerId VARCHAR(50) NULL,
        Department NVARCHAR(100) NOT NULL DEFAULT 'OPERATIONS',
        Priority NVARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
        SlaHours INT NOT NULL DEFAULT 48,
        SlaPolicyId VARCHAR(50) NULL,
        DueDate DATETIME2 NULL,
        AssignedAt DATETIME2 NULL,
        StartedAt DATETIME2 NULL,
        SubmittedAt DATETIME2 NULL,
        ReviewedAt DATETIME2 NULL,
        CompletedAt DATETIME2 NULL,
        SlaStatus NVARCHAR(20) NOT NULL DEFAULT 'WITHIN_SLA',
        SlaBreachedAt DATETIME2 NULL,
        EscalationLevel INT NOT NULL DEFAULT 0,
        Tags NVARCHAR(MAX) NULL, -- JSON array
        CreatedBy VARCHAR(50) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        CONSTRAINT FK_TaskInstances_Template FOREIGN KEY (TemplateId) REFERENCES TaskTemplates(Id),
        CONSTRAINT FK_TaskInstances_SlaPolicy FOREIGN KEY (SlaPolicyId) REFERENCES TaskSlaPolicies(Id),
        CONSTRAINT FK_TaskInstances_Assignee FOREIGN KEY (AssigneeId) REFERENCES Users(Id),
        CONSTRAINT FK_TaskInstances_Reviewer FOREIGN KEY (ReviewerId) REFERENCES Users(Id)
    );
    CREATE INDEX IX_TaskInstances_Status ON TaskInstances(Status);
    CREATE INDEX IX_TaskInstances_AssigneeId ON TaskInstances(AssigneeId);
    CREATE INDEX IX_TaskInstances_ReviewerId ON TaskInstances(ReviewerId);
    CREATE INDEX IX_TaskInstances_SellerId ON TaskInstances(SellerId);
    CREATE INDEX IX_TaskInstances_DueDate ON TaskInstances(DueDate);
    CREATE INDEX IX_TaskInstances_Status_DueDate ON TaskInstances(Status, DueDate);
    CREATE INDEX IX_TaskInstances_SlaStatus ON TaskInstances(SlaStatus);
    CREATE INDEX IX_TaskInstances_CreatedAt ON TaskInstances(CreatedAt);
    CREATE INDEX IX_TaskInstances_Assignee_Status ON TaskInstances(AssigneeId, Status);
    PRINT 'Created TaskInstances';
END

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
-- TASK SLA POLICIES (already created above)
-- ============================================================

-- ============================================================
-- TASK WATCHERS (notifications) - already created
-- ============================================================

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
-- TASK SLA POLICIES (already created at top)
-- ============================================================

-- ============================================================
-- DEFAULT SLA POLICY (insert if not exists)
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM TaskSlaPolicies WHERE IsDefault = 1)
BEGIN
    INSERT INTO TaskSlaPolicies (Id, Name, Description, SlaHours, WarningHours, BusinessHoursOnly, Timezone, ExcludeWeekends, HolidayCalendar, EscalationRules, NotificationChannels, IsDefault, IsActive, CreatedAt, UpdatedAt)
    VALUES (
        'sla-standard-48h',
        'Standard 48h',
        'Standard 48-hour SLA with 24h/12h/6h warnings',
        48,
        '[24, 12, 6]', -- JSON array
        1, -- BusinessHoursOnly
        'Asia/Kolkata',
        1, -- ExcludeWeekends
        'india', -- HolidayCalendar
        '[
            {"level":"assignee","hoursBeforeDue":24,"notify":["assignee"]},
            {"level":"reviewer","hoursBeforeDue":12,"notify":["reviewer"]},
            {"level":"manager","hoursAfterBreach":0,"notify":["manager"]},
            {"level":"admin","hoursAfterBreach":24,"notify":["admin"]}
        ]', -- EscalationRules JSON
        '{"email":true,"inApp":true,"slack":false,"webhook":null}', -- NotificationChannels JSON
        1, -- IsDefault
        1, -- IsActive
        dbo.GetEnvDate(),
        dbo.GetEnvDate()
    );
    PRINT 'Inserted default SLA policy';
END

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

PRINT 'TaskFlow Phase 1 Schema Migration Complete!';