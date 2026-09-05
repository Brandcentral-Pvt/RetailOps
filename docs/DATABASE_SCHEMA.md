# RetailOps V2.1 - Database Schema Documentation

**Version:** 2.1.0  
**Date:** September 3, 2026  
**Database:** SQL Server 2019+ / Azure SQL  
**ORM:** Entity Framework Core 8

---

## 1. Schema Overview

```
CORE TABLES                          PEMS TABLES
─────────────────────                ─────────────────
Sellers                              PemsTaskTemplates
Asins                                PemsTaskInstances
Users                                PemsSubTasks
Roles                                PemsTaskEvents
Permissions                          PemsTaskReviews
RefreshTokens                        PemsNotifications
OtpVerifications                     PemsEvidences
TrustedDevices                       PemsAssignmentRules
                                     PemsEscalationRules
SCHEDULING TABLES                    PemsTaskAuditLogs
────────────────────                 PemsActivities
ScheduledRuns                        PemsScorecards
ScheduledRunDetails
TaskTemplates
GoalTemplates

ANALYTICS TABLES                     COMMUNICATION TABLES
─────────────────────                ─────────────────────
AsinWeekHistory                      Conversations
AsinHistory                          Messages
GmsDailyPerformance                  MessageReactions
GmsTargets                           MessageStatus
GmsTargetBreakdowns                  CallLogs
RevenueCalculators

ALERTS & NOTIFICATIONS               SYSTEM TABLES
─────────────────────                ─────────────────
Alerts                               SystemLogs
AlertRules                           SystemSettings
                                     Webhooks
                                     WebhookLogs
                                     ApiKeys
                                     Downloads
                                     Files
```

---

## 2. Core Tables

### 2.1 Sellers

```sql
CREATE TABLE Sellers (
    Id VARCHAR(50) PRIMARY KEY,
    Name NVARCHAR(255) NOT NULL,
    Email NVARCHAR(255) NOT NULL UNIQUE,
    Phone NVARCHAR(50) NULL,
    Marketplace VARCHAR(20) NOT NULL CHECK (Marketplace IN ('amazon', 'ajio', 'both')),
    OctoparseId VARCHAR(100) NULL,
    OctoparseMarketplace VARCHAR(50) NULL,
    CometChatUid VARCHAR(100) NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    LastScrapedAt DATETIME2 NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE UNIQUE INDEX IX_Sellers_Email ON Sellers(Email);
CREATE INDEX IX_Sellers_OctoparseId ON Sellers(OctoparseId);
CREATE INDEX IX_Sellers_Marketplace_IsActive ON Sellers(Marketplace, IsActive);
CREATE INDEX IX_Sellers_CreatedAt ON Sellers(CreatedAt);
```

### 2.2 Asins

```sql
CREATE TABLE Asins (
    Id VARCHAR(50) PRIMARY KEY,
    SellerId VARCHAR(50) NOT NULL,
    AsinCode VARCHAR(20) NOT NULL,
    Title NVARCHAR(500) NULL,
    Description NVARCHAR(MAX) NULL,
    Price DECIMAL(18,2) NULL,
    Mrp DECIMAL(18,2) NULL,
    Bsr INT NULL,
    SubBsr INT NULL,
    Rating DECIMAL(3,2) NULL,
    ReviewCount INT NULL,
    IsBuyBoxWinner BIT NULL,
    Availability NVARCHAR(100) NULL,
    Category NVARCHAR(500) NULL,
    ImagesCount INT NULL DEFAULT 0,
    MainImageUrl NVARCHAR(500) NULL,
    BulletPointCount INT NULL DEFAULT 0,
    TitleLength INT NULL DEFAULT 0,
    
    -- LQS Scores
    LqsScore DECIMAL(5,2) NULL,
    LqsGrade VARCHAR(10) NULL,
    LqsTitle DECIMAL(5,2) NULL,
    LqsBullets DECIMAL(5,2) NULL,
    LqsImages DECIMAL(5,2) NULL,
    LqsIssues NVARCHAR(MAX) NULL,
    LqsSource VARCHAR(50) NULL,
    
    Status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (Status IN ('active', 'inactive', 'pending', 'error')),
    LastSyncedAt DATETIME2 NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    
    CONSTRAINT FK_Asins_Seller FOREIGN KEY (SellerId) REFERENCES Sellers(Id) ON DELETE CASCADE
);

CREATE INDEX IX_Asins_SellerId ON Asins(SellerId);
CREATE INDEX IX_Asins_AsinCode ON Asins(AsinCode);
CREATE INDEX IX_Asins_SellerId_AsinCode ON Asins(SellerId, AsinCode) INCLUDE (Title, Price, Bsr, Status);
CREATE INDEX IX_Asins_Status ON Asins(Status);
CREATE INDEX IX_Asins_LastSyncedAt ON Asins(LastSyncedAt);

-- Computed LQS Score
ALTER TABLE Asins ADD LqsScoreComputed AS (
    (ISNULL(LqsTitle,0) * 0.30 + ISNULL(LqsBullets,0) * 0.25 + ISNULL(LqsImages,0) * 0.25) / 0.80
) PERSISTED;
```

### 2.3 Users & Auth

```sql
CREATE TABLE Users (
    Id VARCHAR(50) PRIMARY KEY,
    Email NVARCHAR(255) NOT NULL UNIQUE,
    FirstName NVARCHAR(100) NOT NULL,
    LastName NVARCHAR(100) NOT NULL,
    PasswordHash NVARCHAR(255) NOT NULL,
    RefreshToken NVARCHAR(500) NULL,
    RefreshTokenExpiry DATETIME2 NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    IsOnline BIT NOT NULL DEFAULT 0,
    LastSeen DATETIME2 NULL,
    Avatar NVARCHAR(500) NULL,
    RoleId VARCHAR(50) NOT NULL,
    CometChatUid VARCHAR(100) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    
    CONSTRAINT FK_Users_Role FOREIGN KEY (RoleId) REFERENCES Roles(Id)
);

CREATE INDEX IX_Users_Email ON Users(Email);
CREATE INDEX IX_Users_RoleId ON Users(RoleId);
CREATE INDEX IX_Users_IsActive ON Users(IsActive);

CREATE TABLE Roles (
    Id VARCHAR(50) PRIMARY KEY,
    Name VARCHAR(100) NOT NULL UNIQUE,
    DisplayName NVARCHAR(200) NOT NULL,
    Description NVARCHAR(500) NULL,
    Level INT NOT NULL DEFAULT 0,
    Color NVARCHAR(20) NULL DEFAULT '#4F46E5',
    IsSystem BIT NOT NULL DEFAULT 0,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE Permissions (
    Id VARCHAR(50) PRIMARY KEY,
    Name VARCHAR(100) NOT NULL UNIQUE,
    DisplayName NVARCHAR(200) NOT NULL,
    Description NVARCHAR(500) NULL,
    Category VARCHAR(50) NOT NULL,
    Action VARCHAR(50) NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE RolePermissions (
    RoleId VARCHAR(50) NOT NULL,
    PermissionId VARCHAR(50) NOT NULL,
    PRIMARY KEY (RoleId, PermissionId),
    CONSTRAINT FK_RolePermissions_Role FOREIGN KEY (RoleId) REFERENCES Roles(Id) ON DELETE CASCADE,
    CONSTRAINT FK_RolePermissions_Permission FOREIGN KEY (PermissionId) REFERENCES Permissions(Id) ON DELETE CASCADE
);

CREATE TABLE RefreshTokens (
    Id VARCHAR(50) PRIMARY KEY,
    UserId VARCHAR(50) NOT NULL,
    TokenHash NVARCHAR(500) NOT NULL,
    ExpiresAt DATETIME2 NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    RevokedAt DATETIME2 NULL,
    ReplacedByTokenId VARCHAR(50) NULL,
    CONSTRAINT FK_RefreshTokens_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
);

CREATE INDEX IX_RefreshTokens_UserId ON RefreshTokens(UserId);
CREATE INDEX IX_RefreshTokens_ExpiresAt ON RefreshTokens(ExpiresAt);

CREATE TABLE OtpVerifications (
    Id VARCHAR(50) PRIMARY KEY,
    UserId VARCHAR(50) NOT NULL,
    Email NVARCHAR(255) NOT NULL,
    OtpCode NVARCHAR(10) NOT NULL,
    Purpose VARCHAR(50) NOT NULL,
    Attempts INT NOT NULL DEFAULT 0,
    ExpiresAt DATETIME2 NOT NULL,
    IsUsed BIT NOT NULL DEFAULT 0,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UsedAt DATETIME2 NULL,
    CONSTRAINT FK_OtpVerifications_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
);

CREATE INDEX IX_OtpVerifications_UserId_Purpose ON OtpVerifications(UserId, Purpose);
CREATE INDEX IX_OtpVerifications_ExpiresAt ON OtpVerifications(ExpiresAt);

CREATE TABLE TrustedDevices (
    Id VARCHAR(50) PRIMARY KEY,
    UserId VARCHAR(50) NOT NULL,
    DeviceId NVARCHAR(200) NOT NULL,
    DeviceName NVARCHAR(200) NULL,
    IpAddress NVARCHAR(50) NULL,
    UserAgent NVARCHAR(500) NULL,
    ExpiresAt DATETIME2 NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    LastUsedAt DATETIME2 NULL,
    CONSTRAINT FK_TrustedDevices_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
);

CREATE INDEX IX_TrustedDevices_UserId ON TrustedDevices(UserId);
CREATE INDEX IX_TrustedDevices_DeviceId ON TrustedDevices(DeviceId);
```

---

## 3. Marketplace Sync Tables

### 3.1 Scheduled Runs

```sql
CREATE TABLE ScheduledRuns (
    Id VARCHAR(50) PRIMARY KEY,
    StartTime DATETIME2 NOT NULL,
    EndTime DATETIME2 NULL,
    Status VARCHAR(20) NOT NULL CHECK (Status IN ('RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED')),
    Marketplace VARCHAR(20) NOT NULL CHECK (Marketplace IN ('amazon', 'ajio')),
    DetailsJson NVARCHAR(MAX) NULL,
    TotalSellers INT NOT NULL DEFAULT 0,
    SuccessfulSellers INT NOT NULL DEFAULT 0,
    FailedSellers INT NOT NULL DEFAULT 0,
    ErrorMessage NVARCHAR(MAX) NULL,
    ResumeRunId VARCHAR(50) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE INDEX IX_ScheduledRuns_Status ON ScheduledRuns(Status);
CREATE INDEX IX_ScheduledRuns_Marketplace ON ScheduledRuns(Marketplace);
CREATE INDEX IX_ScheduledRuns_StartTime ON ScheduledRuns(StartTime);

CREATE TABLE ScheduledRunDetails (
    Id VARCHAR(50) PRIMARY KEY,
    RunId VARCHAR(50) NOT NULL,
    SellerId VARCHAR(50) NOT NULL,
    SellerName NVARCHAR(255) NOT NULL,
    StartTime DATETIME2 NULL,
    EndTime DATETIME2 NULL,
    Status VARCHAR(20) NOT NULL CHECK (Status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED')),
    AsinsCount INT NULL,
    ProcessedCount INT NULL,
    ErrorMessage NVARCHAR(MAX) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    
    CONSTRAINT FK_ScheduledRunDetails_Run FOREIGN KEY (RunId) REFERENCES ScheduledRuns(Id) ON DELETE CASCADE
);

CREATE INDEX IX_ScheduledRunDetails_RunId ON ScheduledRunDetails(RunId);
CREATE INDEX IX_ScheduledRunDetails_SellerId ON ScheduledRunDetails(SellerId);
```

---

## 4. PEMS Tables (Project/Task Management)

### 4.1 Task Templates

```sql
CREATE TABLE PemsTaskTemplates (
    Id VARCHAR(50) PRIMARY KEY,
    Title NVARCHAR(255) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    Category VARCHAR(100) NOT NULL DEFAULT 'GENERAL',
    Priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (Priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    Type VARCHAR(100) NULL,
    TimeLimit INT NOT NULL DEFAULT 60,
    IsActive BIT NOT NULL DEFAULT 1,
    AutoAssignEnabled BIT NOT NULL DEFAULT 0,
    AutoAssignStrategy VARCHAR(50) NULL,
    ApprovalLevel INT NOT NULL DEFAULT 1,
    CreatedBy VARCHAR(50) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    
    CONSTRAINT FK_PemsTaskTemplates_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES Users(Id)
);

CREATE INDEX IX_PemsTaskTemplates_Category_IsActive ON PemsTaskTemplates(Category, IsActive);
CREATE INDEX IX_PemsTaskTemplates_CreatedBy ON PemsTaskTemplates(CreatedBy);

CREATE TABLE PemsTaskTemplateActivities (
    Id VARCHAR(50) PRIMARY KEY,
    TemplateId VARCHAR(50) NOT NULL,
    Title NVARCHAR(255) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    OrderIndex INT NOT NULL DEFAULT 0,
    IsRequired BIT NOT NULL DEFAULT 1,
    ExpectedOutput NVARCHAR(500) NULL,
    TimeLimit INT NULL,
    AssigneeRole VARCHAR(50) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    
    CONSTRAINT FK_PemsTaskTemplateActivities_Template FOREIGN KEY (TemplateId) REFERENCES PemsTaskTemplates(Id) ON DELETE CASCADE
);

CREATE INDEX IX_PemsTaskTemplateActivities_TemplateId ON PemsTaskTemplateActivities(TemplateId);
```

### 4.2 Task Instances

```sql
CREATE TABLE PemsTaskInstances (
    Id VARCHAR(50) PRIMARY KEY,
    TemplateId VARCHAR(50) NOT NULL,
    Title NVARCHAR(255) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    Status VARCHAR(20) NOT NULL DEFAULT 'CREATED' CHECK (Status IN ('CREATED', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED', 'COMPLETED', 'ESCALATED', 'CANCELLED')),
    Priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (Priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    AssigneeId VARCHAR(50) NULL,
    ReviewerId VARCHAR(50) NULL,
    DueDate DATETIME2 NOT NULL,
    StartedAt DATETIME2 NULL,
    CompletedAt DATETIME2 NULL,
    SlaHours INT NOT NULL DEFAULT 24,
    EscalatedAt DATETIME2 NULL,
    IsEscalated BIT NOT NULL DEFAULT 0,
    ParentInstanceId VARCHAR(50) NULL,
    OccurrenceNumber INT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    
    CONSTRAINT FK_PemsTaskInstances_Template FOREIGN KEY (TemplateId) REFERENCES PemsTaskTemplates(Id),
    CONSTRAINT FK_PemsTaskInstances_Assignee FOREIGN KEY (AssigneeId) REFERENCES Users(Id),
    CONSTRAINT FK_PemsTaskInstances_Reviewer FOREIGN KEY (ReviewerId) REFERENCES Users(Id),
    CONSTRAINT FK_PemsTaskInstances_Parent FOREIGN KEY (ParentInstanceId) REFERENCES PemsTaskInstances(Id)
);

CREATE INDEX IX_PemsTaskInstances_TemplateId ON PemsTaskInstances(TemplateId);
CREATE INDEX IX_PemsTaskInstances_AssigneeId_Status ON PemsTaskInstances(AssigneeId, Status);
CREATE INDEX IX_PemsTaskInstances_ReviewerId_Status ON PemsTaskInstances(ReviewerId, Status);
CREATE INDEX IX_PemsTaskInstances_DueDate ON PemsTaskInstances(DueDate);
CREATE INDEX IX_PemsTaskInstances_Status ON PemsTaskInstances(Status);
CREATE INDEX IX_PemsTaskInstances_EscalatedAt ON PemsTaskInstances(EscalatedAt);
CREATE INDEX IX_PemsTaskInstances_ParentInstanceId ON PemsTaskInstances(ParentInstanceId);
```

### 4.3 Sub Tasks

```sql
CREATE TABLE PemsSubTasks (
    Id VARCHAR(50) PRIMARY KEY,
    TaskInstanceId VARCHAR(50) NOT NULL,
    Title NVARCHAR(255) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    Status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (Status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED')),
    OrderIndex INT NOT NULL DEFAULT 0,
    IsRequired BIT NOT NULL DEFAULT 1,
    ExpectedOutput NVARCHAR(500) NULL,
    AssigneeId VARCHAR(50) NULL,
    StartedAt DATETIME2 NULL,
    CompletedAt DATETIME2 NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    
    CONSTRAINT FK_PemsSubTasks_TaskInstance FOREIGN KEY (TaskInstanceId) REFERENCES PemsTaskInstances(Id) ON DELETE CASCADE,
    CONSTRAINT FK_PemsSubTasks_Assignee FOREIGN KEY (AssigneeId) REFERENCES Users(Id)
);

CREATE INDEX IX_PemsSubTasks_TaskInstanceId ON PemsSubTasks(TaskInstanceId);
CREATE INDEX IX_PemsSubTasks_AssigneeId ON PemsSubTasks(AssigneeId);
```

### 4.4 Events & Audit

```sql
CREATE TABLE PemsTaskEvents (
    Id VARCHAR(50) PRIMARY KEY,
    TaskInstanceId VARCHAR(50) NOT NULL,
    EventType VARCHAR(50) NOT NULL,
    ActorId VARCHAR(50) NOT NULL,
    ActorName NVARCHAR(200) NOT NULL,
    FromStatus VARCHAR(20) NULL,
    ToStatus VARCHAR(20) NULL,
    MetadataJson NVARCHAR(MAX) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    
    CONSTRAINT FK_PemsTaskEvents_TaskInstance FOREIGN KEY (TaskInstanceId) REFERENCES PemsTaskInstances(Id) ON DELETE CASCADE,
    CONSTRAINT FK_PemsTaskEvents_Actor FOREIGN KEY (ActorId) REFERENCES Users(Id)
);

CREATE INDEX IX_PemsTaskEvents_TaskInstanceId ON PemsTaskEvents(TaskInstanceId);
CREATE INDEX IX_PemsTaskEvents_CreatedAt ON PemsTaskEvents(CreatedAt);
CREATE INDEX IX_PemsTaskEvents_EventType ON PemsTaskEvents(EventType);

CREATE TABLE PemsTaskAuditLogs (
    Id VARCHAR(50) PRIMARY KEY,
    TaskInstanceId VARCHAR(50) NOT NULL,
    Action NVARCHAR(100) NOT NULL,
    ActorId VARCHAR(50) NOT NULL,
    ActorName NVARCHAR(200) NOT NULL,
    ActorRole NVARCHAR(50) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    Details NVARCHAR(MAX) NULL,
    
    CONSTRAINT FK_PemsTaskAuditLogs_TaskInstance FOREIGN KEY (TaskInstanceId) REFERENCES PemsTaskInstances(Id) ON DELETE CASCADE,
    CONSTRAINT FK_PemsTaskAuditLogs_Actor FOREIGN KEY (ActorId) REFERENCES Users(Id)
);

CREATE INDEX IX_PemsTaskAuditLogs_TaskInstanceId ON PemsTaskAuditLogs(TaskInstanceId);
CREATE INDEX IX_PemsTaskAuditLogs_CreatedAt ON PemsTaskAuditLogs(CreatedAt);
```

### 4.5 Sub Tasks & Reviews

```sql
CREATE TABLE PemsTaskReviews (
    Id VARCHAR(50) PRIMARY KEY,
    TaskInstanceId VARCHAR(50) NOT NULL,
    ReviewerId VARCHAR(50) NOT NULL,
    Decision VARCHAR(20) NOT NULL CHECK (Decision IN ('APPROVED', 'REJECTED', 'CHANGES_REQUESTED')),
    Feedback NVARCHAR(MAX) NULL,
    QualityScore INT NULL CHECK (QualityScore BETWEEN 1 AND 100),
    ReviewChecklist NVARCHAR(MAX) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    
    CONSTRAINT FK_PemsTaskReviews_TaskInstance FOREIGN KEY (TaskInstanceId) REFERENCES PemsTaskInstances(Id) ON DELETE CASCADE,
    CONSTRAINT FK_PemsTaskReviews_Reviewer FOREIGN KEY (ReviewerId) REFERENCES Users(Id)
);

CREATE INDEX IX_PemsTaskReviews_TaskInstanceId ON PemsTaskReviews(TaskInstanceId);

CREATE TABLE PemsNotifications (
    Id VARCHAR(50) PRIMARY KEY,
    TaskInstanceId VARCHAR(50) NOT NULL,
    UserId VARCHAR(50) NOT NULL,
    Type VARCHAR(50) NOT NULL,
    Title NVARCHAR(255) NOT NULL,
    Message NVARCHAR(MAX) NULL,
    ActionUrl NVARCHAR(500) NULL,
    IsRead BIT NOT NULL DEFAULT 0,
    ReadAt DATETIME2 NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    
    CONSTRAINT FK_PemsNotifications_TaskInstance FOREIGN KEY (TaskInstanceId) REFERENCES PemsTaskInstances(Id) ON DELETE CASCADE,
    CONSTRAINT FK_PemsNotifications_User FOREIGN KEY (UserId) REFERENCES Users(Id)
);

CREATE INDEX IX_PemsNotifications_UserId_IsRead ON PemsNotifications(UserId, IsRead);
CREATE INDEX IX_PemsNotifications_TaskInstanceId ON PemsNotifications(TaskInstanceId);

CREATE TABLE PemsEvidences (
    Id VARCHAR(50) PRIMARY KEY,
    TaskInstanceId VARCHAR(50) NOT NULL,
    SubTaskId VARCHAR(50) NULL,
    ActorId VARCHAR(50) NOT NULL,
    FileName NVARCHAR(255) NOT NULL,
    FileUrl NVARCHAR(500) NOT NULL,
    FileSize BIGINT NULL,
    FileType NVARCHAR(50) NULL,
    Description NVARCHAR(MAX) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    
    CONSTRAINT FK_PemsEvidences_TaskInstance FOREIGN KEY (TaskInstanceId) REFERENCES PemsTaskInstances(Id) ON DELETE CASCADE,
    CONSTRAINT FK_PemsEvidences_SubTask FOREIGN KEY (SubTaskId) REFERENCES PemsSubTasks(Id) ON DELETE CASCADE,
    CONSTRAINT FK_PemsEvidences_Actor FOREIGN KEY (ActorId) REFERENCES Users(Id)
);

CREATE INDEX IX_PemsEvidences_TaskInstanceId ON PemsEvidences(TaskInstanceId);
```

### 4.6 Recurrence & Escalation

```sql
CREATE TABLE PemsRecurrenceRules (
    Id VARCHAR(50) PRIMARY KEY,
    TemplateId VARCHAR(50) NOT NULL,
    Frequency VARCHAR(20) NOT NULL CHECK (Frequency IN ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY')),
    Interval INT NOT NULL DEFAULT 1,
    DaysOfWeek NVARCHAR(50) NULL,
    DayOfMonth INT NULL,
    MonthOfYear INT NULL,
    StartDate DATETIME2 NOT NULL,
    EndDate DATETIME2 NULL,
    Occurrences INT NULL,
    TimeZone NVARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
    AssigneeStrategy VARCHAR(50) NULL,
    AutoAssign BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    
    CONSTRAINT FK_PemsRecurrenceRules_Template FOREIGN KEY (TemplateId) REFERENCES PemsTaskTemplates(Id) ON DELETE CASCADE
);

CREATE TABLE PemsEscalationRules (
    Id VARCHAR(50) PRIMARY KEY,
    TemplateId VARCHAR(50) NOT NULL,
    TriggerAfterHours INT NOT NULL,
    EscalationLevel INT NOT NULL DEFAULT 1,
    NotifyAssignee BIT NOT NULL DEFAULT 1,
    NotifyReviewer BIT NOT NULL DEFAULT 1,
    NotifyRoles NVARCHAR(200) NULL,
    CustomMessage NVARCHAR(500) NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    
    CONSTRAINT FK_PemsEscalationRules_Template FOREIGN KEY (TemplateId) REFERENCES PemsTaskTemplates(Id) ON DELETE CASCADE
);

CREATE TABLE PemsAssignmentRules (
    Id VARCHAR(50) PRIMARY KEY,
    TemplateId VARCHAR(50) NOT NULL,
    ConditionJson NVARCHAR(MAX) NULL,
    AssigneeRole VARCHAR(50) NULL,
    Strategy VARCHAR(50) NOT NULL DEFAULT 'round_robin',
    Priority INT NOT NULL DEFAULT 0,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    
    CONSTRAINT FK_PemsAssignmentRules_Template FOREIGN KEY (TemplateId) REFERENCES PemsTaskTemplates(Id) ON DELETE CASCADE
);

CREATE TABLE PemsActivities (
    Id VARCHAR(50) PRIMARY KEY,
    TemplateId VARCHAR(50) NOT NULL,
    Title NVARCHAR(255) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    OrderIndex INT NOT NULL DEFAULT 0,
    IsRequired BIT NOT NULL DEFAULT 1,
    ExpectedOutput NVARCHAR(500) NULL,
    TimeLimit INT NULL,
    AssigneeRole VARCHAR(50) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    
    CONSTRAINT FK_PemsActivities_Template FOREIGN KEY (TemplateId) REFERENCES PemsTaskTemplates(Id) ON DELETE CASCADE
);

CREATE TABLE PemsScorecards (
    Id VARCHAR(50) PRIMARY KEY,
    TaskInstanceId VARCHAR(50) NOT NULL,
    AvgAchievementPct DECIMAL(5,2) NULL,
    AvgQualityScore DECIMAL(5,2) NULL,
    AvgVariance DECIMAL(5,2) NULL,
    CompletedTasks INT NOT NULL DEFAULT 0,
    TotalTasks INT NOT NULL DEFAULT 0,
    CompletionRatePct DECIMAL(5,2) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    
    CONSTRAINT FK_PemsScorecards_TaskInstance FOREIGN KEY (TaskInstanceId) REFERENCES PemsTaskInstances(Id) ON DELETE CASCADE
);
```

---

## 5. Communication Tables

```sql
CREATE TABLE Conversations (
    Id VARCHAR(50) PRIMARY KEY,
    Type VARCHAR(20) NOT NULL DEFAULT 'DIRECT' CHECK (Type IN ('DIRECT', 'GROUP')),
    Title NVARCHAR(255) NULL,
    CreatedBy VARCHAR(50) NOT NULL,
    LastMessageId VARCHAR(50) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    
    CONSTRAINT FK_Conversations_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES Users(Id)
);

CREATE INDEX IX_Conversations_Type ON Conversations(Type);
CREATE INDEX IX_Conversations_UpdatedAt ON Conversations(UpdatedAt);

CREATE TABLE ConversationParticipants (
    ConversationId VARCHAR(50) NOT NULL,
    UserId VARCHAR(50) NOT NULL,
    JoinedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    LastReadAt DATETIME2 NULL,
    IsMuted BIT NOT NULL DEFAULT 0,
    PRIMARY KEY (ConversationId, UserId),
    
    CONSTRAINT FK_ConversationParticipants_Conversation FOREIGN KEY (ConversationId) REFERENCES Conversations(Id) ON DELETE CASCADE,
    CONSTRAINT FK_ConversationParticipants_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
);

CREATE INDEX IX_ConversationParticipants_UserId ON ConversationParticipants(UserId);

CREATE TABLE Messages (
    Id VARCHAR(50) PRIMARY KEY,
    ConversationId VARCHAR(50) NOT NULL,
    SenderId VARCHAR(50) NOT NULL,
    Type VARCHAR(20) NOT NULL DEFAULT 'TEXT' CHECK (Type IN ('TEXT', 'IMAGE', 'FILE', 'AUDIO', 'VIDEO', 'SYSTEM')),
    Content NVARCHAR(MAX) NULL,
    FileUrl NVARCHAR(500) NULL,
    ReplyToId VARCHAR(50) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    
    CONSTRAINT FK_Messages_Conversation FOREIGN KEY (ConversationId) REFERENCES Conversations(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Messages_Sender FOREIGN KEY (SenderId) REFERENCES Users(Id),
    CONSTRAINT FK_Messages_ReplyTo FOREIGN KEY (ReplyToId) REFERENCES Messages(Id)
);

CREATE INDEX IX_Messages_ConversationId ON Messages(ConversationId);
CREATE INDEX IX_Messages_SenderId ON Messages(SenderId);
CREATE INDEX IX_Messages_CreatedAt ON Messages(CreatedAt);

CREATE TABLE MessageReactions (
    MessageId VARCHAR(50) NOT NULL,
    UserId VARCHAR(50) NOT NULL,
    Emoji NVARCHAR(50) NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    PRIMARY KEY (MessageId, UserId, Emoji),
    
    CONSTRAINT FK_MessageReactions_Message FOREIGN KEY (MessageId) REFERENCES Messages(Id) ON DELETE CASCADE,
    CONSTRAINT FK_MessageReactions_User FOREIGN KEY (UserId) REFERENCES Users(Id)
);

CREATE TABLE MessageStatus (
    MessageId VARCHAR(50) NOT NULL,
    UserId VARCHAR(50) NOT NULL,
    IsRead BIT NOT NULL DEFAULT 0,
    ReadAt DATETIME2 NULL,
    PRIMARY KEY (MessageId, UserId),
    
    CONSTRAINT FK_MessageStatus_Message FOREIGN KEY (MessageId) REFERENCES Messages(Id) ON DELETE CASCADE,
    CONSTRAINT FK_MessageStatus_User FOREIGN KEY (UserId) REFERENCES Users(Id)
);

CREATE INDEX IX_MessageStatus_UserId_IsRead ON MessageStatus(UserId, IsRead);

CREATE TABLE CallLogs (
    Id VARCHAR(50) PRIMARY KEY,
    ConversationId VARCHAR(50) NOT NULL,
    CallerId VARCHAR(50) NOT NULL,
    ReceiverId VARCHAR(50) NOT NULL,
    Type VARCHAR(20) NOT NULL CHECK (Type IN ('AUDIO', 'VIDEO')),
    Status VARCHAR(20) NOT NULL DEFAULT 'INITIATED' CHECK (Status IN ('INITIATED', 'ONGOING', 'ENDED', 'REJECTED', 'MISSED')),
    StartedAt DATETIME2 NULL,
    EndedAt DATETIME2 NULL,
    Duration INT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    
    CONSTRAINT FK_CallLogs_Conversation FOREIGN KEY (ConversationId) REFERENCES Conversations(Id) ON DELETE CASCADE,
    CONSTRAINT FK_CallLogs_Caller FOREIGN KEY (CallerId) REFERENCES Users(Id),
    CONSTRAINT FK_CallLogs_Receiver FOREIGN KEY (ReceiverId) REFERENCES Users(Id)
);

CREATE INDEX IX_CallLogs_ConversationId ON CallLogs(ConversationId);
CREATE INDEX IX_CallLogs_CallerId ON CallLogs(CallerId);
CREATE INDEX IX_CallLogs_ReceiverId ON CallLogs(ReceiverId);
```

---

## 6. Analytics & LQS Tables

```sql
CREATE TABLE AsinWeekHistory (
    Id VARCHAR(50) PRIMARY KEY,
    AsinId VARCHAR(50) NOT NULL,
    WeekStartDate DATE NOT NULL,
    WeekEndDate DATE NOT NULL,
    AvgPrice DECIMAL(18,2) NULL,
    AvgBsr INT NULL,
    AvgRating DECIMAL(3,2) NULL,
    TotalReviews INT NULL,
    TotalUnitsSold INT NULL,
    Revenue DECIMAL(18,2) NULL,
    BuyBoxPercentage DECIMAL(5,2) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    
    CONSTRAINT FK_AsinWeekHistory_Asin FOREIGN KEY (AsinId) REFERENCES Asins(Id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IX_AsinWeekHistory_AsinId_Week ON AsinWeekHistory(AsinId, WeekStartDate);

CREATE TABLE AsinHistory (
    Id VARCHAR(50) PRIMARY KEY,
    AsinId VARCHAR(50) NOT NULL,
    FieldName NVARCHAR(100) NOT NULL,
    OldValue NVARCHAR(MAX) NULL,
    NewValue NVARCHAR(MAX) NULL,
    ChangedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    ChangedBy VARCHAR(50) NULL,
    ChangeReason NVARCHAR(200) NULL,
    
    CONSTRAINT FK_AsinHistory_Asin FOREIGN KEY (AsinId) REFERENCES Asins(Id) ON DELETE CASCADE
);

CREATE INDEX IX_AsinHistory_AsinId_ChangedAt ON AsinHistory(AsinId, ChangedAt);

CREATE TABLE GmsDailyPerformance (
    Id VARCHAR(50) PRIMARY KEY,
    AsinId VARCHAR(50) NOT NULL,
    Date DATE NOT NULL,
    Brand NVARCHAR(100) NULL,
    CustomerReturns INT NULL,
    Revenue DECIMAL(18,2) NULL,
    UnitsSold INT NULL,
    Bsr INT NULL,
    Price DECIMAL(18,2) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    
    CONSTRAINT FK_GmsDailyPerformance_Asin FOREIGN KEY (AsinId) REFERENCES Asins(Id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IX_GmsDailyPerformance_AsinId_Date ON GmsDailyPerformance(AsinId, Date);

CREATE TABLE GmsTargets (
    Id VARCHAR(50) PRIMARY KEY,
    Name NVARCHAR(255) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    OwnerId VARCHAR(50) NOT NULL,
    Marketplace VARCHAR(20) NULL,
    TargetType VARCHAR(50) NOT NULL,
    TargetValue DECIMAL(18,2) NOT NULL,
    CurrentValue DECIMAL(18,2) NOT NULL DEFAULT 0,
    Unit NVARCHAR(50) NULL,
    StartDate DATE NOT NULL,
    EndDate DATE NOT NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    
    CONSTRAINT FK_GmsTargets_Owner FOREIGN KEY (OwnerId) REFERENCES Users(Id)
);

CREATE TABLE GmsTargetBreakdowns (
    Id VARCHAR(50) PRIMARY KEY,
    TargetId VARCHAR(50) NOT NULL,
    PeriodType VARCHAR(20) NOT NULL,
    PeriodStart DATE NOT NULL,
    PeriodEnd DATE NOT NULL,
    AchievedValue DECIMAL(18,2) NOT NULL,
    PercentageContribution DECIMAL(5,2) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    
    CONSTRAINT FK_GmsTargetBreakdowns_Target FOREIGN KEY (TargetId) REFERENCES GmsTargets(Id) ON DELETE CASCADE
);

CREATE TABLE RevenueCalculators (
    Id VARCHAR(50) PRIMARY KEY,
    AsinId VARCHAR(50) NOT NULL,
    Price DECIMAL(18,2) NULL,
    ClosingFee DECIMAL(18,2) NULL,
    FbaFee DECIMAL(18,2) NULL,
    ReferralFee DECIMAL(18,2) NULL,
    ShippingFee DECIMAL(18,2) NULL,
    TotalCost DECIMAL(18,2) NULL,
    Profit DECIMAL(18,2) NULL,
    MarginPct DECIMAL(5,2) NULL,
    CalculatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    
    CONSTRAINT FK_RevenueCalculators_Asin FOREIGN KEY (AsinId) REFERENCES Asins(Id) ON DELETE CASCADE
);

CREATE INDEX IX_RevenueCalculators_AsinId ON RevenueCalculators(AsinId);
```

---

## 7. Alerts & Monitoring

```sql
CREATE TABLE AlertRules (
    Id VARCHAR(50) PRIMARY KEY,
    Name NVARCHAR(255) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    EntityType VARCHAR(50) NOT NULL,
    ConditionJson NVARCHAR(MAX) NOT NULL,
    Severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (Severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    IsActive BIT NOT NULL DEFAULT 1,
    CooldownMinutes INT NOT NULL DEFAULT 60,
    NotifyRoles NVARCHAR(200) NULL,
    CreatedBy VARCHAR(50) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    
    CONSTRAINT FK_AlertRules_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES Users(Id)
);

CREATE INDEX IX_AlertRules_EntityType_IsActive ON AlertRules(EntityType, IsActive);

CREATE TABLE Alerts (
    Id VARCHAR(50) PRIMARY KEY,
    RuleId VARCHAR(50) NOT NULL,
    EntityType VARCHAR(50) NOT NULL,
    EntityId VARCHAR(50) NOT NULL,
    EntityTitle NVARCHAR(255) NULL,
    Severity VARCHAR(20) NOT NULL,
    Message NVARCHAR(MAX) NOT NULL,
    DataJson NVARCHAR(MAX) NULL,
    IsAcknowledged BIT NOT NULL DEFAULT 0,
    AcknowledgedBy VARCHAR(50) NULL,
    AcknowledgedAt DATETIME2 NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    
    CONSTRAINT FK_Alerts_Rule FOREIGN KEY (RuleId) REFERENCES AlertRules(Id),
    CONSTRAINT FK_Alerts_AcknowledgedBy FOREIGN KEY (AcknowledgedBy) REFERENCES Users(Id)
);

CREATE INDEX IX_Alerts_RuleId ON Alerts(RuleId);
CREATE INDEX IX_Alerts_EntityType_EntityId ON Alerts(EntityType, EntityId);
CREATE INDEX IX_Alerts_IsAcknowledged_CreatedAt ON Alerts(IsAcknowledged, CreatedAt);
```

---

## 8. System Tables

```sql
CREATE TABLE SystemSettings (
    [Key] VARCHAR(100) PRIMARY KEY,
    Value NVARCHAR(MAX) NOT NULL,
    Description NVARCHAR(500) NULL,
    Category VARCHAR(50) NULL,
    IsEncrypted BIT NOT NULL DEFAULT 0,
    UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedBy VARCHAR(50) NULL
);

CREATE TABLE SystemLogs (
    Id VARCHAR(50) PRIMARY KEY,
    Type VARCHAR(50) NOT NULL,
    EntityType VARCHAR(50) NULL,
    EntityId VARCHAR(50) NULL,
    UserId VARCHAR(50) NULL,
    Description NVARCHAR(MAX) NOT NULL,
    MetadataJson NVARCHAR(MAX) NULL,
    Severity VARCHAR(20) NOT NULL DEFAULT 'INFO' CHECK (Severity IN ('DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL')),
    IpAddress NVARCHAR(50) NULL,
    UserAgent NVARCHAR(500) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    
    CONSTRAINT FK_SystemLogs_User FOREIGN KEY (UserId) REFERENCES Users(Id)
);

CREATE INDEX IX_SystemLogs_Type_CreatedAt ON SystemLogs(Type, CreatedAt);
CREATE INDEX IX_SystemLogs_EntityType_EntityId ON SystemLogs(EntityType, EntityId);
CREATE INDEX IX_SystemLogs_UserId ON SystemLogs(UserId);
CREATE INDEX IX_SystemLogs_Severity_CreatedAt ON SystemLogs(Severity, CreatedAt);

CREATE TABLE Webhooks (
    Id VARCHAR(50) PRIMARY KEY,
    Name NVARCHAR(255) NOT NULL,
    Url NVARCHAR(1000) NOT NULL,
    EventsJson NVARCHAR(MAX) NOT NULL DEFAULT '["*"]',
    Description NVARCHAR(MAX) NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedBy VARCHAR(50) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    
    CONSTRAINT FK_Webhooks_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES Users(Id)
);

CREATE TABLE WebhookLogs (
    Id VARCHAR(50) PRIMARY KEY,
    WebhookId VARCHAR(50) NOT NULL,
    Event NVARCHAR(100) NOT NULL,
    HttpStatus INT NULL,
    DurationMs INT NULL,
    RequestJson NVARCHAR(MAX) NULL,
    ResponseJson NVARCHAR(MAX) NULL,
    Attempt INT NOT NULL DEFAULT 1,
    Success BIT NOT NULL DEFAULT 0,
    ErrorMessage NVARCHAR(MAX) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    
    CONSTRAINT FK_WebhookLogs_Webhook FOREIGN KEY (WebhookId) REFERENCES Webhooks(Id) ON DELETE CASCADE
);

CREATE INDEX IX_WebhookLogs_WebhookId ON WebhookLogs(WebhookId);
CREATE INDEX IX_WebhookLogs_CreatedAt ON WebhookLogs(CreatedAt);

CREATE TABLE ApiKeys (
    Id VARCHAR(50) PRIMARY KEY,
    Name NVARCHAR(255) NOT NULL,
    KeyHash NVARCHAR(500) NOT NULL,
    KeyPrefix NVARCHAR(20) NOT NULL,
    Category VARCHAR(50) NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    ExpiresAt DATETIME2 NULL,
    CreatedBy VARCHAR(50) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    LastUsedAt DATETIME2 NULL,
    
    CONSTRAINT FK_ApiKeys_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES Users(Id)
);

CREATE INDEX IX_ApiKeys_IsActive ON ApiKeys(IsActive);
```

---

## 9. Files & Downloads

```sql
CREATE TABLE Downloads (
    Id VARCHAR(50) PRIMARY KEY,
    UserId VARCHAR(50) NOT NULL,
    FileName NVARCHAR(255) NOT NULL,
    FilePath NVARCHAR(500) NOT NULL,
    FileSize BIGINT NOT NULL,
    MimeType NVARCHAR(100) NULL,
    DownloadCount INT NOT NULL DEFAULT 0,
    ExpiresAt DATETIME2 NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    
    CONSTRAINT FK_Downloads_User FOREIGN KEY (UserId) REFERENCES Users(Id)
);

CREATE INDEX IX_Downloads_UserId ON Downloads(UserId);
CREATE INDEX IX_Downloads_ExpiresAt ON Downloads(ExpiresAt);

CREATE TABLE Files (
    Id VARCHAR(50) PRIMARY KEY,
    FileName NVARCHAR(255) NOT NULL,
    FilePath NVARCHAR(500) NOT NULL,
    FileSize BIGINT NOT NULL,
    MimeType NVARCHAR(100) NULL,
    EntityType VARCHAR(50) NULL,
    EntityId VARCHAR(50) NULL,
    UploadedBy VARCHAR(50) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    
    CONSTRAINT FK_Files_UploadedBy FOREIGN KEY (UploadedBy) REFERENCES Users(Id)
);

CREATE INDEX IX_Files_EntityType_EntityId ON Files(EntityType, EntityId);
```

---

## 10. Key Functions & Stored Procedures

```sql
-- Get UTC date for audit fields
CREATE FUNCTION dbo.GetEnvDate()
RETURNS DATETIME2
AS BEGIN
    RETURN SYSUTCDATETIME();
END;

-- Generate unique ID (24-char alphanumeric)
CREATE FUNCTION dbo.GenerateId()
RETURNS VARCHAR(50)
AS BEGIN
    RETURN REPLACE(CONVERT(VARCHAR(36), NEWID()), '-', '');
END;

-- Cleanup expired OTPs
CREATE PROCEDURE dbo.CleanupExpiredOtps
AS BEGIN
    SET NOCOUNT ON;
    DELETE FROM OtpVerifications WHERE ExpiresAt < dbo.GetEnvDate();
    DELETE FROM RefreshTokens WHERE ExpiresAt < dbo.GetEnvDate();
    DELETE FROM TrustedDevices WHERE ExpiresAt < dbo.GetEnvDate();
END;

-- Pipeline recovery: find interrupted runs
CREATE PROCEDURE dbo.GetInterruptedRuns
AS BEGIN
    SET NOCOUNT ON;
    SELECT TOP 1 * FROM ScheduledRuns 
    WHERE Status = 'RUNNING' 
    ORDER BY StartTime DESC;
END;

-- SLA breach detection
CREATE PROCEDURE dbo.GetSlaBreaches
AS BEGIN
    SET NOCOUNT ON;
    SELECT ti.* FROM PemsTaskInstances ti
    WHERE ti.Status IN ('ASSIGNED', 'IN_PROGRESS')
      AND ti.DueDate < DATEADD(HOUR, -ti.SlaHours, SYSUTCDATETIME())
      AND (ti.EscalatedAt IS NULL OR ti.EscalatedAt < DATEADD(HOUR, -24, SYSUTCDATETIME()));
END;
```

---

## 11. Indexing Strategy

### 11.1 Covering Indexes for Common Queries

```sql
-- Seller dashboard queries
CREATE INDEX IX_Asins_Seller_Status_Synced ON Asins(SellerId, Status, LastSyncedAt DESC)
    INCLUDE (AsinCode, Title, Price, Bsr, LqsScore, LqsGrade);

-- Pipeline run details
CREATE INDEX IX_ScheduledRunDetails_Run_Seller ON ScheduledRunDetails(RunId, SellerId)
    INCLUDE (Status, AsinsCount, ProcessedCount, ErrorMessage);

-- PEMS task queries
CREATE INDEX IX_PemsTaskInstances_Assignee_Due_Status ON PemsTaskInstances(AssigneeId, DueDate, Status)
    INCLUDE (TemplateId, Title, Priority, SlaHours, IsEscalated);

CREATE INDEX IX_PemsTaskInstances_Reviewer_Status ON PemsTaskInstances(ReviewerId, Status)
    INCLUDE (AssigneeId, Title, DueDate);

-- LQS analytics
CREATE INDEX IX_Asins_Seller_LqsScore ON Asins(SellerId, LqsScore DESC)
    INCLUDE (AsinCode, Title, LqsGrade, LqsTitle, LqsBullets, LqsImages);

-- Live sync job queries
CREATE INDEX IX_LiveSyncJobs_Seller_Status ON LiveSyncJobs(SellerId, Status, CreatedAt DESC)
    INCLUDE (JobId, TotalAsins, ProcessedAsins, ProgressPct);
```

---

## 12. Partitioning Strategy (Large Tables)

```sql
-- Partition AsinHistory by month
CREATE PARTITION FUNCTION PF_AsinHistory_Monthly (DATETIME2)
AS RANGE RIGHT FOR VALUES (
    '2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01',
    '2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01',
    '2026-09-01', '2026-10-01', '2026-11-01', '2026-12-01'
);

CREATE PARTITION SCHEME PS_AsinHistory_Monthly
AS PARTITION PF_AsinHistory_Monthly ALL TO ([PRIMARY]);

-- Partition SystemLogs by month
CREATE PARTITION FUNCTION PF_SystemLogs_Monthly (DATETIME2)
AS RANGE RIGHT FOR VALUES (
    '2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01',
    '2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01',
    '2026-09-01', '2026-10-01', '2026-11-01', '2026-12-01'
);

CREATE PARTITION SCHEME PS_SystemLogs_Monthly
AS PARTITION PF_SystemLogs_Monthly ALL TO ([PRIMARY]);
```

---

## 13. Maintenance Procedures

```sql
-- Weekly index maintenance
CREATE PROCEDURE dbo.IndexMaintenance
AS BEGIN
    SET NOCOUNT ON;
    
    -- Rebuild fragmented indexes (>30% fragmentation)
    DECLARE @Sql NVARCHAR(MAX) = '';
    SELECT @Sql = @Sql + 'ALTER INDEX ' + QUOTENAME(i.name) + ' ON ' + 
        QUOTENAME(s.name) + '.' + QUOTENAME(t.name) + ' REBUILD; '
    FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED') ps
    JOIN sys.indexes i ON ps.object_id = i.object_id AND ps.index_id = i.index_id
    JOIN sys.tables t ON ps.object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE ps.avg_fragmentation_in_percent > 30
      AND ps.page_count > 1000
      AND i.type_desc IN ('NONCLUSTERED', 'CLUSTERED')
      AND s.name = 'dbo';
    
    IF @Sql <> '' EXEC sp_executesql @Sql;
    
    -- Reorganize lightly fragmented indexes (5-30%)
    SET @Sql = '';
    SELECT @Sql = @Sql + 'ALTER INDEX ' + QUOTENAME(i.name) + ' ON ' + 
        QUOTENAME(s.name) + '.' + QUOTENAME(t.name) + ' REORGANIZE; '
    FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED') ps
    JOIN sys.indexes i ON ps.object_id = i.object_id AND ps.index_id = i.index_id
    JOIN sys.tables t ON ps.object_id = t.object_id
    JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE ps.avg_fragmentation_in_percent BETWEEN 5 AND 30
      AND ps.page_count > 1000
      AND i.type_desc IN ('NONCLUSTERED', 'CLUSTERED')
      AND s.name = 'dbo';
    
    IF @Sql <> '' EXEC sp_executesql @Sql;
    
    -- Update statistics
    EXEC sp_updatestats;
END;

-- Daily cleanup job
CREATE PROCEDURE dbo.DailyCleanup
AS BEGIN
    SET NOCOUNT ON;
    
    -- Clean expired OTPs
    EXEC dbo.CleanupExpiredOtps;
    
    -- Clean old alert acknowledgments (> 90 days)
    DELETE FROM Alerts WHERE IsAcknowledged = 1 AND AcknowledgedAt < DATEADD(DAY, -90, SYSUTCDATETIME());
    
    -- Clean old webhook logs (> 30 days)
    DELETE FROM WebhookLogs WHERE CreatedAt < DATEADD(DAY, -30, SYSUTCDATETIME());
    
    -- Clean old system logs (> 90 days, keep errors longer)
    DELETE FROM SystemLogs WHERE Severity IN ('DEBUG', 'INFO') AND CreatedAt < DATEADD(DAY, -90, SYSUTCDATETIME());
    DELETE FROM SystemLogs WHERE Severity IN ('WARN') AND CreatedAt < DATEADD(DAY, -180, SYSUTCDATETIME());
END;
```

---

## 14. Performance Baselines

| Query Pattern | Target Latency | Current | Index Strategy |
|---------------|----------------|---------|----------------|
| Seller dashboard load | < 200ms | 180ms | Covering index on Asins |
| Pipeline run details | < 500ms | 420ms | Covering index on ScheduledRunDetails |
| PEMS task list (assignee) | < 150ms | 120ms | Composite index on AssigneeId+DueDate+Status |
| LQS analytics | < 300ms | 280ms | Composite index on SellerId+LqsScore |
| Live sync job status | < 100ms | 80ms | Composite index on SellerId+Status |
| Search sellers | < 200ms | 150ms | Full-text index on Name+Email |

---

*Document Owner: Database Team*  
*Review Cycle: Monthly*  
*Last Updated: September 2026*