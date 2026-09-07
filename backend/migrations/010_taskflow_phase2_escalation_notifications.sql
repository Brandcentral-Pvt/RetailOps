-- TaskFlow Migration: Phase 2 - SLA Engine, Escalation Engine, Notifications
-- Run this after Phase 1 migration

-- ============================================================
-- ESCALATION POLICIES TABLE
-- ============================================================
IF OBJECT_ID(N'dbo.TaskEscalationPolicies', N'U') IS NULL
BEGIN
    CREATE TABLE TaskEscalationPolicies (
        Id VARCHAR(50) PRIMARY KEY,
        Name NVARCHAR(255) NOT NULL,
        Description NVARCHAR(MAX) NULL,
        TriggerType NVARCHAR(50) NOT NULL, -- SLA_BREACH, SLA_WARNING, MANUAL, OVERDUE_SUBTASK, STALLED_TASK, CUSTOM
        Conditions NVARCHAR(MAX) NOT NULL, -- JSON: { slaBreached: true, overdueHours: 24, ... }
        Actions NVARCHAR(MAX) NOT NULL, -- JSON array of actions
        NotifyRoles NVARCHAR(MAX) NULL, -- JSON array: ['assignee', 'reviewer', 'manager', 'admin']
        NotifyUsers NVARCHAR(MAX) NULL, -- JSON array of user IDs
        Channels NVARCHAR(MAX) NOT NULL, -- JSON array: ['in_app', 'email', 'slack', 'webhook', 'sms']
        DelayMinutes INT NOT NULL DEFAULT 0,
        RepeatIntervalMinutes INT NOT NULL DEFAULT 0,
        MaxEscalations INT NOT NULL DEFAULT 3,
        CooldownMinutes INT NOT NULL DEFAULT 60,
        Priority INT NOT NULL DEFAULT 10,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedBy VARCHAR(50) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()
    );
    CREATE INDEX IX_TaskEscalationPolicies_Active ON TaskEscalationPolicies(IsActive);
    CREATE INDEX IX_TaskEscalationPolicies_Trigger ON TaskEscalationPolicies(TriggerType);
    PRINT 'Created TaskEscalationPolicies';
END

-- ============================================================
-- ESCALATIONS LOG
-- ============================================================
IF OBJECT_ID(N'dbo.TaskEscalations', N'U') IS NULL
BEGIN
    CREATE TABLE TaskEscalations (
        Id VARCHAR(50) PRIMARY KEY,
        TaskId VARCHAR(50) NOT NULL,
        RuleId VARCHAR(50) NOT NULL,
        TriggerType NVARCHAR(50) NOT NULL, -- AUTOMATIC, MANUAL
        EscalationLevel NVARCHAR(20) NOT NULL, -- ASSIGNEE, REVIEWER, MANAGER, ADMIN
        TriggeredAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        Metadata NVARCHAR(MAX) NULL, -- JSON: { triggerType, slaStatus, hoursOverdue, previousLevel }
        NotifiedUsers NVARCHAR(MAX) NULL, -- JSON array
        Status NVARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, COMPLETED, FAILED
        ErrorMessage NVARCHAR(MAX) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        CONSTRAINT FK_TaskEscalations_Task FOREIGN KEY (TaskId) REFERENCES TaskInstances(Id) ON DELETE CASCADE,
        CONSTRAINT FK_TaskEscalations_Rule FOREIGN KEY (RuleId) REFERENCES TaskEscalationPolicies(Id)
    );
    CREATE INDEX IX_TaskEscalations_TaskId ON TaskEscalations(TaskId);
    CREATE INDEX IX_TaskEscalations_RuleId ON TaskEscalations(RuleId);
    CREATE INDEX IX_TaskEscalations_TriggeredAt ON TaskEscalations(TriggeredAt DESC);
    CREATE INDEX IX_TaskEscalations_Status ON TaskEscalations(Status);
    PRINT 'Created TaskEscalations';
END

-- ============================================================
-- NOTIFICATIONS TABLE (unified)
-- ============================================================
IF OBJECT_ID(N'dbo.TaskNotifications', N'U') IS NULL
BEGIN
    CREATE TABLE TaskNotifications (
        Id VARCHAR(50) PRIMARY KEY,
        UserId VARCHAR(50) NOT NULL,
        Type NVARCHAR(50) NOT NULL, -- TASK_ASSIGNED, TASK_APPROVED, SLA_WARNING, etc.
        Title NVARCHAR(255) NOT NULL,
        Message NVARCHAR(MAX) NOT NULL,
        ActionUrl NVARCHAR(500) NULL,
        Priority NVARCHAR(20) NOT NULL DEFAULT 'normal',
        IsRead BIT NOT NULL DEFAULT 0,
        ReadAt DATETIME2 NULL,
        TaskId VARCHAR(50) NULL,
        Metadata NVARCHAR(MAX) NULL, -- JSON
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        CONSTRAINT FK_TaskNotifications_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
        CONSTRAINT FK_TaskNotifications_Task FOREIGN KEY (TaskId) REFERENCES TaskInstances(Id) ON DELETE SET NULL
    );
    CREATE INDEX IX_TaskNotifications_UserId_IsRead ON TaskNotifications(UserId, IsRead);
    CREATE INDEX IX_TaskNotifications_UserId_CreatedAt ON TaskNotifications(UserId, CreatedAt DESC);
    CREATE INDEX IX_TaskNotifications_TaskId ON TaskNotifications(TaskId);
    CREATE INDEX IX_TaskNotifications_Type ON TaskNotifications(Type);
    PRINT 'Created TaskNotifications';
END

-- ============================================================
-- NOTIFICATION PREFERENCES
-- ============================================================
IF OBJECT_ID(N'dbo.UserNotificationPreferences', N'U') IS NULL
BEGIN
    CREATE TABLE UserNotificationPreferences (
        UserId VARCHAR(50) PRIMARY KEY,
        Email BIT NOT NULL DEFAULT 1,
        InApp BIT NOT NULL DEFAULT 1,
        Slack BIT NOT NULL DEFAULT 0,
        Webhook BIT NOT NULL DEFAULT 0,
        Sms BIT NOT NULL DEFAULT 0,
        QuietHoursStart NVARCHAR(10) NOT NULL DEFAULT '22:00',
        QuietHoursEnd NVARCHAR(10) NOT NULL DEFAULT '08:00',
        Timezone NVARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
        EmailDigest BIT NOT NULL DEFAULT 0,
        DigestFrequency NVARCHAR(20) NULL, -- DAILY, WEEKLY, NEVER
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        CONSTRAINT FK_UserNotificationPreferences_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
    );
    PRINT 'Created UserNotificationPreferences';
END

-- ============================================================
-- ESCALATIONS LOG TABLE
-- ============================================================
IF OBJECT_ID(N'dbo.TaskEscalations', N'U') IS NULL
BEGIN
    CREATE TABLE TaskEscalations (
        Id VARCHAR(50) PRIMARY KEY,
        TaskId VARCHAR(50) NOT NULL,
        RuleId VARCHAR(50) NOT NULL,
        TriggerType NVARCHAR(50) NOT NULL, -- AUTOMATIC, MANUAL
        EscalationLevel NVARCHAR(20) NOT NULL, -- ASSIGNEE, REVIEWER, MANAGER, ADMIN
        TriggeredAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        Metadata NVARCHAR(MAX) NULL, -- JSON
        NotifiedUsers NVARCHAR(MAX) NULL, -- JSON array
        Status NVARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, COMPLETED, FAILED
        ErrorMessage NVARCHAR(MAX) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        CONSTRAINT FK_TaskEscalations_Task FOREIGN KEY (TaskId) REFERENCES TaskInstances(Id) ON DELETE CASCADE,
        CONSTRAINT FK_TaskEscalations_Rule FOREIGN KEY (RuleId) REFERENCES TaskEscalationPolicies(Id)
    );
    CREATE INDEX IX_TaskEscalations_TaskId ON TaskEscalations(TaskId);
    CREATE INDEX IX_TaskEscalations_RuleId ON TaskEscalations(RuleId);
    CREATE INDEX IX_TaskEscalations_TriggeredAt ON TaskEscalations(TriggeredAt DESC);
    CREATE INDEX IX_TaskEscalations_Status ON TaskEscalations(Status);
    PRINT 'Created TaskEscalations';
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

PRINT 'TaskFlow Phase 2 Migration Complete!';
PRINT 'New tables: TaskEscalationPolicies, TaskEscalations, TaskNotifications, UserNotificationPreferences';
PRINT 'Default escalation policies inserted: SLA Warning, SLA Breach, Stalled Task';
PRINT 'Run escalation engine: escalationEngine.startMonitoring(15)';
PRINT 'Run SLA engine: slaEngine.startMonitoring(30)';