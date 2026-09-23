-- ============================================================
-- RETAILOPS V2.1 - COMPLETE DATABASE INITIALIZATION
-- Run ONCE on fresh SQL Server (idempotent - safe to re-run)
-- ============================================================

USE master;
GO

-- 1. Create Database
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'RetailOps')
BEGIN
    CREATE DATABASE RetailOps
    COLLATE SQL_Latin1_General_CP1_CI_AS;
    PRINT 'Created database: RetailOps';
END
ELSE
BEGIN
    PRINT 'Database RetailOps already exists';
END
GO

USE RetailOps;
GO

-- 2. Helper Function: GetEnvDate (timezone-aware)
IF OBJECT_ID(N'dbo.GetEnvDate', N'FN') IS NULL
BEGIN
    EXEC('CREATE FUNCTION dbo.GetEnvDate() RETURNS DATETIME2 AS BEGIN RETURN GETUTCDATE() END');
    PRINT 'Created stub GetEnvDate';
END
-- Only apply the timezone offset on a genuinely fresh server. When the function
-- already exists (e.g. it was created by the Node API's own connection init and
-- is referenced by default constraints), ALTER FUNCTION would be blocked, so we
-- keep the existing definition.
IF OBJECT_ID(N'dbo.GetEnvDate', N'FN') IS NULL
BEGIN
    -- Update with actual offset (IST = +330 minutes)
    DECLARE @offsetMins INT = 330;
    DECLARE @getEnvDateSql NVARCHAR(MAX) = N'
        ALTER FUNCTION dbo.GetEnvDate()
        RETURNS DATETIME2 AS BEGIN
            RETURN DATEADD(minute, ' + CAST(@offsetMins AS NVARCHAR(10)) + N', GETUTCDATE())
        END
    ';
    EXEC(@getEnvDateSql);
    PRINT 'Updated GetEnvDate with IST offset';
END
GO

-- 3. SchemaMigrations table (for migration tracking)
IF OBJECT_ID(N'dbo.SchemaMigrations', N'U') IS NULL
BEGIN
    CREATE TABLE SchemaMigrations (
        Id VARCHAR(50) PRIMARY KEY,
        Name NVARCHAR(200) NOT NULL,
        AppliedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()
    );
    CREATE UNIQUE INDEX UX_SchemaMigrations_Name ON SchemaMigrations(Name);
    PRINT 'Created SchemaMigrations';
END
GO

-- ============================================================
-- CORE TABLES: USERS, ROLES, PERMISSIONS
-- ============================================================

-- Roles
IF OBJECT_ID(N'dbo.Roles', N'U') IS NULL
BEGIN
    CREATE TABLE Roles (
        Id VARCHAR(50) PRIMARY KEY,
        Name NVARCHAR(100) NOT NULL UNIQUE,
        DisplayName NVARCHAR(200) NOT NULL,
        Description NVARCHAR(MAX),
        Level INT NOT NULL DEFAULT 0,
        Color NVARCHAR(20) DEFAULT '#4F46E5',
        IsSystem BIT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()
    );
    PRINT 'Created Roles';
END
GO

-- Permissions
IF OBJECT_ID(N'dbo.Permissions', N'U') IS NULL
BEGIN
    CREATE TABLE Permissions (
        Id VARCHAR(50) PRIMARY KEY,
        Name NVARCHAR(100) NOT NULL UNIQUE,
        DisplayName NVARCHAR(200) NOT NULL,
        Description NVARCHAR(MAX),
        Category NVARCHAR(50) NOT NULL,
        Action NVARCHAR(50) NOT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()
    );
    PRINT 'Created Permissions';
END
GO

-- RolePermissions
IF OBJECT_ID(N'dbo.RolePermissions', N'U') IS NULL
BEGIN
    CREATE TABLE RolePermissions (
        RoleId VARCHAR(50) NOT NULL,
        PermissionId VARCHAR(50) NOT NULL,
        PRIMARY KEY (RoleId, PermissionId),
        CONSTRAINT FK_RolePermissions_Role FOREIGN KEY (RoleId) REFERENCES Roles(Id) ON DELETE CASCADE,
        CONSTRAINT FK_RolePermissions_Permission FOREIGN KEY (PermissionId) REFERENCES Permissions(Id) ON DELETE CASCADE
    );
    PRINT 'Created RolePermissions';
END
GO

-- Users
IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
BEGIN
    CREATE TABLE Users (
        Id VARCHAR(50) PRIMARY KEY,
        Email NVARCHAR(255) NOT NULL UNIQUE,
        PasswordHash NVARCHAR(500) NULL,
        Password NVARCHAR(500) NULL,
        FirstName NVARCHAR(100) NOT NULL,
        LastName NVARCHAR(100) NOT NULL,
        Avatar NVARCHAR(500),
        Phone NVARCHAR(50),
        RoleId VARCHAR(50),
        IsActive BIT NOT NULL DEFAULT 1,
        IsOnline BIT NOT NULL DEFAULT 0,
        LastSeen DATETIME2,
        LastLoginAt DATETIME2,
        LoginAttempts INT DEFAULT 0,
        LockUntil DATETIME2,
        FailedLoginAttempts INT DEFAULT 0,
        LockedUntil DATETIME2,
        ForcePasswordReset BIT DEFAULT 0,
        PasswordChangedAt DATETIME2 DEFAULT dbo.GetEnvDate(),
        PasswordExpiresAt DATETIME2,
        MustChangePassword BIT DEFAULT 0,
        IsFirstLogin BIT NOT NULL DEFAULT 1,
        FirstLoginAt DATETIME2,
        SetupCompletedAt DATETIME2,
        SecurityPolicyAccepted BIT NOT NULL DEFAULT 0,
        CurrentTeam VARCHAR(50) NULL,
        IsEmailVerified BIT NOT NULL DEFAULT 0,
        Preferences NVARCHAR(MAX) NULL,
        OtpSentCountToday INT NOT NULL DEFAULT 0,
        OtpResetDate DATE NULL,
        LastOtpSentAt DATETIME2 NULL,
        CometChatUid NVARCHAR(100) NULL,
        ExtraPermissions NVARCHAR(MAX) NULL,
        ExcludedPermissions NVARCHAR(MAX) NULL,
        TwoFactorEnabled BIT DEFAULT 0,
        TwoFactorSecret NVARCHAR(100),
        TrustedDevices NVARCHAR(MAX),
        RefreshToken NVARCHAR(500),
        RefreshTokenExpiry DATETIME2,
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        CONSTRAINT FK_Users_Role FOREIGN KEY (RoleId) REFERENCES Roles(Id)
    );
    CREATE INDEX IX_Users_Email ON Users(Email);
    CREATE INDEX IX_Users_RoleId ON Users(RoleId);
    CREATE INDEX IX_Users_IsActive ON Users(IsActive);
    PRINT 'Created Users';
END
GO

-- UserSellers (access control)
IF OBJECT_ID(N'dbo.UserSellers', N'U') IS NULL
BEGIN
    CREATE TABLE UserSellers (
        UserId VARCHAR(50) NOT NULL,
        SellerId VARCHAR(50) NOT NULL,
        PRIMARY KEY (UserId, SellerId),
        CONSTRAINT FK_UserSellers_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
    );
    PRINT 'Created UserSellers';
END
GO

-- PasswordHistory
IF OBJECT_ID(N'dbo.PasswordHistory', N'U') IS NULL
BEGIN
    CREATE TABLE PasswordHistory (
        Id VARCHAR(50) PRIMARY KEY,
        UserId VARCHAR(50) NOT NULL,
        PasswordHash NVARCHAR(500) NOT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        CONSTRAINT FK_PasswordHistory_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_PasswordHistory_UserId ON PasswordHistory(UserId);
    PRINT 'Created PasswordHistory';
END
GO

-- OtpVerifications
IF OBJECT_ID(N'dbo.OtpVerifications', N'U') IS NULL
BEGIN
    CREATE TABLE OtpVerifications (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        UserId VARCHAR(50) NOT NULL,
        Email NVARCHAR(255) NOT NULL,
        OtpHash NVARCHAR(500) NOT NULL,
        Purpose NVARCHAR(20) NOT NULL DEFAULT 'LOGIN',
        IpAddress NVARCHAR(50) NULL,
        UserAgent NVARCHAR(500) NULL,
        Attempts INT NOT NULL DEFAULT 0,
        MaxAttempts INT NOT NULL DEFAULT 3,
        IsUsed BIT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        ExpiresAt DATETIME2 NOT NULL,
        UsedAt DATETIME2 NULL,
        CONSTRAINT FK_OtpVerifications_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_OtpVerifications_UserId ON OtpVerifications(UserId);
    CREATE INDEX IX_OtpVerifications_ExpiresAt ON OtpVerifications(ExpiresAt);
    CREATE INDEX IX_OtpVerifications_Valid ON OtpVerifications(UserId, Purpose, IsUsed, ExpiresAt);
    PRINT 'Created OtpVerifications';
END
GO

-- OtpAuditLog
IF OBJECT_ID(N'dbo.OtpAuditLog', N'U') IS NULL
BEGIN
    CREATE TABLE OtpAuditLog (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        UserId VARCHAR(50) NULL,
        Email NVARCHAR(255) NULL,
        Action NVARCHAR(50) NOT NULL,
        Status NVARCHAR(20) NOT NULL,
        Reason NVARCHAR(500) NULL,
        IpAddress NVARCHAR(50) NULL,
        UserAgent NVARCHAR(500) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()
    );
    CREATE INDEX IX_OtpAuditLog_UserId ON OtpAuditLog(UserId);
    CREATE INDEX IX_OtpAuditLog_CreatedAt ON OtpAuditLog(CreatedAt);
    PRINT 'Created OtpAuditLog';
END
GO

-- TokenBlacklist
IF OBJECT_ID(N'dbo.TokenBlacklist', N'U') IS NULL
BEGIN
    CREATE TABLE TokenBlacklist (
        Id VARCHAR(50) PRIMARY KEY,
        TokenHash NVARCHAR(500) NOT NULL,
        UserId VARCHAR(50) NOT NULL,
        Type NVARCHAR(20) NOT NULL,
        ExpiresAt DATETIME2 NOT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        CONSTRAINT FK_TokenBlacklist_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_TokenBlacklist_UserId ON TokenBlacklist(UserId);
    CREATE INDEX IX_TokenBlacklist_ExpiresAt ON TokenBlacklist(ExpiresAt);
    PRINT 'Created TokenBlacklist';
END
GO

-- TrustedDevices
IF OBJECT_ID(N'dbo.TrustedDevices', N'U') IS NULL
BEGIN
    CREATE TABLE TrustedDevices (
        Id NVARCHAR(100) PRIMARY KEY,
        UserId VARCHAR(50) NOT NULL,
        DeviceId NVARCHAR(400) NOT NULL,
        DeviceFingerprint NVARCHAR(128) NOT NULL,
        DeviceName NVARCHAR(400),
        UserAgent NVARCHAR(1000),
        IpAddress NVARCHAR(100),
        LastUsedAt DATETIME2 NULL,
        ExpiresAt DATETIME2 NOT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        IsRevoked BIT NOT NULL DEFAULT 0,
        CONSTRAINT FK_TrustedDevices_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_TrustedDevices_UserId ON TrustedDevices(UserId);
    CREATE INDEX IX_TrustedDevices_Fingerprint ON TrustedDevices(DeviceFingerprint);
    CREATE INDEX IX_TrustedDevices_DeviceId ON TrustedDevices(DeviceId);
    PRINT 'Created TrustedDevices';
END
GO

-- SystemLogs
IF OBJECT_ID(N'dbo.SystemLogs', N'U') IS NULL
BEGIN
    CREATE TABLE SystemLogs (
        Id VARCHAR(50) PRIMARY KEY,
        Type NVARCHAR(50) NOT NULL,
        EntityType NVARCHAR(50),
        EntityId VARCHAR(50),
        EntityTitle NVARCHAR(500),
        UserId VARCHAR(50),
        Description NVARCHAR(MAX),
        Metadata NVARCHAR(MAX),
        IpAddress NVARCHAR(50),
        UserAgent NVARCHAR(500),
        Severity NVARCHAR(20) DEFAULT 'INFO',
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()
    );
    CREATE INDEX IX_SystemLogs_Type_CreatedAt ON SystemLogs(Type, CreatedAt DESC);
    CREATE INDEX IX_SystemLogs_Entity ON SystemLogs(EntityType, EntityId);
    CREATE INDEX IX_SystemLogs_UserId ON SystemLogs(UserId);
    PRINT 'Created SystemLogs';
END
GO

-- ============================================================
-- SELLERS & MARKETPLACES
-- ============================================================

IF OBJECT_ID(N'dbo.Sellers', N'U') IS NULL
BEGIN
    CREATE TABLE Sellers (
        Id VARCHAR(50) PRIMARY KEY,
        SellerId NVARCHAR(100) NOT NULL UNIQUE,
        Name NVARCHAR(255) NOT NULL,
        Email NVARCHAR(255),
        Marketplace NVARCHAR(50) NOT NULL DEFAULT 'amazon.in',
        OctoparseId NVARCHAR(100),
        OctoparseTaskId NVARCHAR(100),
        OctoparseTaskName NVARCHAR(255),
        IsActive BIT NOT NULL DEFAULT 1,
        IsPriority BIT NULL,
        ScrapeLimit INT NULL,
        LiveSyncClientId NVARCHAR(500) NULL,
        LiveSyncClientSecret NVARCHAR(500) NULL,
        PartnerTag NVARCHAR(200) NULL,
        LiveSyncEnabled BIT NULL,
        [Plan] NVARCHAR(500) NULL,
        LastScrapedAt DATETIME2,
        LastSyncAt DATETIME2,
        SyncStatus NVARCHAR(50) DEFAULT 'PENDING',
        Credentials NVARCHAR(MAX),
        Settings NVARCHAR(MAX),
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()
    );
    CREATE INDEX IX_Sellers_Marketplace_Active ON Sellers(Marketplace, IsActive);
    CREATE INDEX IX_Sellers_OctoparseId ON Sellers(OctoparseId);
    PRINT 'Created Sellers';
END
GO

-- ============================================================
-- ASINS & PRODUCT DATA
-- ============================================================

IF OBJECT_ID(N'dbo.Asins', N'U') IS NULL
BEGIN
    CREATE TABLE Asins (
        Id VARCHAR(50) PRIMARY KEY,
        AsinCode NVARCHAR(30) NOT NULL,
        SellerId VARCHAR(50) NOT NULL,
        Sku NVARCHAR(100),
        Title NVARCHAR(MAX),
        Brand NVARCHAR(255),
        Category NVARCHAR(255),
        SubCategory NVARCHAR(255),
        Price DECIMAL(18,2) DEFAULT 0,
        Mrp DECIMAL(18,2) DEFAULT 0,
        CurrentPrice DECIMAL(18,2) DEFAULT 0,
        Bsr INT,
        SubBsr INT,
        SubBSRCategory NVARCHAR(255),
        LqsScore DECIMAL(5,2) DEFAULT 0,
        LQSGrade NVARCHAR(10) DEFAULT 'F',
        LQSDetails NVARCHAR(MAX),
        TitleScore DECIMAL(5,2) DEFAULT 0,
        BulletScore DECIMAL(5,2) DEFAULT 0,
        ImageScore DECIMAL(5,2) DEFAULT 0,
        DescriptionScore DECIMAL(5,2) DEFAULT 0,
        TitleIssues NVARCHAR(MAX),
        BulletIssues NVARCHAR(MAX),
        ImageIssues NVARCHAR(MAX),
        DescriptionIssues NVARCHAR(MAX),
        Rating DECIMAL(3,2) DEFAULT 0,
        ReviewCount INT DEFAULT 0,
        HasAplus BIT DEFAULT 0,
        AplusDetails NVARCHAR(MAX),
        ImagesCount INT DEFAULT 0,
        MainImageUrl NVARCHAR(1000),
        StockLevel INT,
        SoldBy NVARCHAR(255),
        Status NVARCHAR(30) DEFAULT 'ACTIVE',
        LastScrapedAt DATETIME2,
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        CONSTRAINT FK_Asins_Seller FOREIGN KEY (SellerId) REFERENCES Sellers(Id) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX UX_Asins_AsinCode_Seller ON Asins(AsinCode, SellerId);
    CREATE INDEX IX_Asins_Seller_Status ON Asins(SellerId, Status);
    CREATE INDEX IX_Asins_LastScrapedAt ON Asins(LastScrapedAt);
    PRINT 'Created Asins';
END
GO

-- AsinHistory
IF OBJECT_ID(N'dbo.AsinHistory', N'U') IS NULL
BEGIN
    CREATE TABLE AsinHistory (
        Id VARCHAR(50) PRIMARY KEY,
        AsinId VARCHAR(50) NOT NULL,
        AsinCode NVARCHAR(30) NOT NULL,
        SellerId VARCHAR(50) NOT NULL,
        Date DATETIME2 NOT NULL,
        Price DECIMAL(18,2),
        BSR INT,
        Rating DECIMAL(3,2),
        ReviewCount INT,
        StockLevel INT,
        LQS DECIMAL(5,2),
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        CONSTRAINT FK_AsinHistory_Asin FOREIGN KEY (AsinId) REFERENCES Asins(Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_AsinHistory_AsinId_Date ON AsinHistory(AsinId, Date DESC);
    CREATE INDEX IX_AsinHistory_Seller_Date ON AsinHistory(SellerId, Date DESC);
    PRINT 'Created AsinHistory';
END
GO

-- AsinWeekHistory
IF OBJECT_ID(N'dbo.AsinWeekHistory', N'U') IS NULL
BEGIN
    CREATE TABLE AsinWeekHistory (
        Id VARCHAR(50) PRIMARY KEY,
        AsinId VARCHAR(50) NOT NULL,
        AsinCode NVARCHAR(30) NOT NULL,
        SellerId VARCHAR(50) NOT NULL,
        WeekStartDate DATETIME2 NOT NULL,
        AvgPrice DECIMAL(18,2),
        AvgBSR INT,
        AvgRating DECIMAL(3,2),
        TotalReviews INT,
        AvgLQS DECIMAL(5,2),
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        CONSTRAINT FK_AsinWeekHistory_Asin FOREIGN KEY (AsinId) REFERENCES Asins(Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_AsinWeekHistory_AsinId_Week ON AsinWeekHistory(AsinId, WeekStartDate DESC);
    PRINT 'Created AsinWeekHistory';
END
GO

-- AsinScrapeData
IF OBJECT_ID(N'dbo.AsinScrapeData', N'U') IS NULL
BEGIN
    CREATE TABLE AsinScrapeData (
        Id VARCHAR(50) PRIMARY KEY,
        Asin NVARCHAR(20) NOT NULL,
        SellerId VARCHAR(50) NOT NULL,
        Rating DECIMAL(3, 2) DEFAULT 0,
        ReviewCount INT DEFAULT 0,
        HasAplus BIT DEFAULT 0,
        AplusDetails NVARCHAR(MAX) NULL,
        Title NVARCHAR(MAX) NULL,
        Price DECIMAL(18, 2) DEFAULT 0,
        BSR INT NULL,
        RatingBreakdown NVARCHAR(MAX) NULL,
        LastScrapedAt DATETIME2 NULL,
        ScrapeDurationMs INT DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()
    );
    CREATE UNIQUE INDEX UX_AsinScrapeData_Asin_Seller ON AsinScrapeData(Asin, SellerId);
    CREATE INDEX IX_AsinScrapeData_SellerId ON AsinScrapeData(SellerId);
    CREATE INDEX IX_AsinScrapeData_LastScrapedAt ON AsinScrapeData(LastScrapedAt);
    PRINT 'Created AsinScrapeData';
END
GO

-- AsinTable
IF OBJECT_ID(N'dbo.AsinTable', N'U') IS NULL
BEGIN
    CREATE TABLE AsinTable (
        Id VARCHAR(50) PRIMARY KEY,
        AsinCode NVARCHAR(30) NOT NULL,
        SellerId VARCHAR(50) NOT NULL,
        Title NVARCHAR(MAX),
        Category NVARCHAR(255),
        SubCategory NVARCHAR(255),
        Brand NVARCHAR(255),
        Price DECIMAL(18,2),
        BSR INT,
        LQS DECIMAL(5,2),
        Status NVARCHAR(30),
        ImagesCount INT DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()
    );
    CREATE INDEX IX_AsinTable_Category_Seller ON AsinTable(Category, SellerId);
    PRINT 'Created AsinTable';
END
GO

-- ============================================================
-- ADVERTISING & PERFORMANCE
-- ============================================================

IF OBJECT_ID(N'dbo.AdsPerformance', N'U') IS NULL
BEGIN
    CREATE TABLE AdsPerformance (
        Id VARCHAR(50) PRIMARY KEY,
        Asin NVARCHAR(30) NOT NULL,
        SellerId VARCHAR(50) NOT NULL,
        Date DATETIME2 NOT NULL,
        ReportType NVARCHAR(50) DEFAULT 'SP',
        AdSales DECIMAL(18,2) DEFAULT 0,
        AdSpend DECIMAL(18,2) DEFAULT 0,
        Orders INT DEFAULT 0,
        OrganicSales DECIMAL(18,2) DEFAULT 0,
        Impressions BIGINT DEFAULT 0,
        Clicks BIGINT DEFAULT 0,
        Ctr DECIMAL(5,2) DEFAULT 0,
        Cpc DECIMAL(18,2) DEFAULT 0,
        Roas DECIMAL(18,2) DEFAULT 0,
        Acos DECIMAL(5,2) DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        CONSTRAINT FK_AdsPerformance_Seller FOREIGN KEY (SellerId) REFERENCES Sellers(Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_AdsPerformance_Asin_Date ON AdsPerformance(Asin, Date DESC);
    CREATE INDEX IX_AdsPerformance_Seller_Date ON AdsPerformance(SellerId, Date DESC);
    PRINT 'Created AdsPerformance';
END
GO

IF OBJECT_ID(N'dbo.GmsDailyPerformance', N'U') IS NULL
BEGIN
    CREATE TABLE GmsDailyPerformance (
        Id VARCHAR(50) PRIMARY KEY,
        Asin NVARCHAR(30) NOT NULL,
        SellerId VARCHAR(50) NOT NULL,
        Date DATETIME2 NOT NULL,
        OrderedUnits INT DEFAULT 0,
        OrderedRevenue DECIMAL(18,2) DEFAULT 0,
        ReturnsUnits INT DEFAULT 0,
        ReturnsRevenue DECIMAL(18,2) DEFAULT 0,
        NetUnits INT DEFAULT 0,
        NetRevenue DECIMAL(18,2) DEFAULT 0,
        Sessions BIGINT DEFAULT 0,
        PageViews BIGINT DEFAULT 0,
        ConversionRate DECIMAL(5,2) DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        CONSTRAINT FK_GmsDailyPerformance_Seller FOREIGN KEY (SellerId) REFERENCES Sellers(Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_GmsDailyPerformance_Asin_Date ON GmsDailyPerformance(Asin, Date DESC);
    CREATE INDEX IX_GmsDailyPerformance_Seller_Date ON GmsDailyPerformance(SellerId, Date DESC);
    PRINT 'Created GmsDailyPerformance';
END
GO

-- ============================================================
-- SCHEDULED RUNS & PIPELINE
-- ============================================================

IF OBJECT_ID(N'dbo.ScheduledRuns', N'U') IS NULL
BEGIN
    CREATE TABLE ScheduledRuns (
        Id VARCHAR(50) PRIMARY KEY,
        RunType NVARCHAR(50) NOT NULL,
        Status NVARCHAR(30) NOT NULL DEFAULT 'PENDING',
        TriggeredBy VARCHAR(50),
        TriggeredByName NVARCHAR(255),
        StartedAt DATETIME2,
        CompletedAt DATETIME2,
        TotalSellers INT DEFAULT 0,
        ProcessedSellers INT DEFAULT 0,
        FailedSellers INT DEFAULT 0,
        TotalAsins INT DEFAULT 0,
        ProcessedAsins INT DEFAULT 0,
        ErrorMessage NVARCHAR(MAX),
        Metadata NVARCHAR(MAX),
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()
    );
    CREATE INDEX IX_ScheduledRuns_StartedAt ON ScheduledRuns(StartedAt DESC);
    CREATE INDEX IX_ScheduledRuns_Status ON ScheduledRuns(Status);
    PRINT 'Created ScheduledRuns';
END
GO

IF OBJECT_ID(N'dbo.ScheduledRunDetails', N'U') IS NULL
BEGIN
    CREATE TABLE ScheduledRunDetails (
        Id VARCHAR(50) PRIMARY KEY,
        RunId VARCHAR(50) NOT NULL,
        SellerId VARCHAR(50) NOT NULL,
        Status NVARCHAR(30) NOT NULL DEFAULT 'PENDING',
        AsinsCount INT DEFAULT 0,
        ProcessedCount INT DEFAULT 0,
        ErrorMessage NVARCHAR(MAX),
        StartTime DATETIME2,
        EndTime DATETIME2,
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        CONSTRAINT FK_ScheduledRunDetails_Run FOREIGN KEY (RunId) REFERENCES ScheduledRuns(Id) ON DELETE CASCADE,
        CONSTRAINT FK_ScheduledRunDetails_Seller FOREIGN KEY (SellerId) REFERENCES Sellers(Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_ScheduledRunDetails_RunId ON ScheduledRunDetails(RunId);
    CREATE INDEX IX_ScheduledRunDetails_SellerId ON ScheduledRunDetails(SellerId);
    PRINT 'Created ScheduledRunDetails';
END
GO

-- LiveSyncRunLogs
IF OBJECT_ID(N'dbo.LiveSyncRunLogs', N'U') IS NULL
BEGIN
    CREATE TABLE LiveSyncRunLogs (
        Id VARCHAR(50) PRIMARY KEY,
        BatchId VARCHAR(50) NULL,
        TriggerType NVARCHAR(20) NOT NULL DEFAULT 'MANUAL',
        Source NVARCHAR(30) NOT NULL DEFAULT 'SELLER',
        TriggeredById VARCHAR(50) NULL,
        TriggeredByName NVARCHAR(255) NULL,
        SellerId VARCHAR(50) NULL,
        SellerName NVARCHAR(255) NULL,
        Marketplace NVARCHAR(50) NULL,
        Status NVARCHAR(20) NOT NULL DEFAULT 'RUNNING',
        TotalAsins INT NOT NULL DEFAULT 0,
        SuccessCount INT NOT NULL DEFAULT 0,
        FailedCount INT NOT NULL DEFAULT 0,
        FailedAsinCodes NVARCHAR(MAX) NULL,
        Errors NVARCHAR(MAX) NULL,
        DurationMs INT NULL,
        StartedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        CompletedAt DATETIME2 NULL,
        Metadata NVARCHAR(MAX) NULL
    );
    CREATE INDEX IX_LiveSyncRunLogs_StartedAt ON LiveSyncRunLogs(StartedAt DESC);
    CREATE INDEX IX_LiveSyncRunLogs_Seller ON LiveSyncRunLogs(SellerId);
    CREATE INDEX IX_LiveSyncRunLogs_TriggerType ON LiveSyncRunLogs(TriggerType);
    CREATE INDEX IX_LiveSyncRunLogs_Batch ON LiveSyncRunLogs(BatchId);
    PRINT 'Created LiveSyncRunLogs';
END
GO

IF OBJECT_ID(N'dbo.LiveSyncRunAsinLogs', N'U') IS NULL
BEGIN
    CREATE TABLE LiveSyncRunAsinLogs (
        Id VARCHAR(50) PRIMARY KEY,
        RunId VARCHAR(50) NOT NULL,
        AsinCode NVARCHAR(30) NULL,
        AsinId VARCHAR(50) NULL,
        Status NVARCHAR(20) NOT NULL,
        ErrorMessage NVARCHAR(MAX) NULL,
        LoggedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()
    );
    CREATE INDEX IX_LiveSyncRunAsinLogs_RunId ON LiveSyncRunAsinLogs(RunId);
    CREATE INDEX IX_LiveSyncRunAsinLogs_AsinCode ON LiveSyncRunAsinLogs(AsinCode);
    PRINT 'Created LiveSyncRunAsinLogs';
END
GO

-- ScrapeJobHistory
IF OBJECT_ID(N'dbo.ScrapeJobHistory', N'U') IS NULL
BEGIN
    CREATE TABLE ScrapeJobHistory (
        Id VARCHAR(50) PRIMARY KEY,
        JobId NVARCHAR(100) NOT NULL,
        SellerId VARCHAR(50) NOT NULL,
        UserId VARCHAR(50) NULL,
        Status NVARCHAR(50) NOT NULL,
        TotalAsins INT DEFAULT 0,
        Processed INT DEFAULT 0,
        Successful INT DEFAULT 0,
        Failed INT DEFAULT 0,
        StartTime DATETIME2 NULL,
        EndTime DATETIME2 NULL,
        ErrorMessage NVARCHAR(MAX) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()
    );
    CREATE INDEX IX_ScrapeJobHistory_SellerId ON ScrapeJobHistory(SellerId);
    CREATE INDEX IX_ScrapeJobHistory_JobId ON ScrapeJobHistory(JobId);
    CREATE INDEX IX_ScrapeJobHistory_CreatedAt ON ScrapeJobHistory(CreatedAt);
    PRINT 'Created ScrapeJobHistory';
END
GO

IF OBJECT_ID(N'dbo.ScrapeJobDetails', N'U') IS NULL
BEGIN
    CREATE TABLE ScrapeJobDetails (
        Id VARCHAR(50) PRIMARY KEY,
        JobId NVARCHAR(100) NOT NULL,
        Asin NVARCHAR(20) NOT NULL,
        Success BIT NOT NULL,
        Rating DECIMAL(3, 2) DEFAULT 0,
        ReviewCount INT DEFAULT 0,
        HasAplus BIT DEFAULT 0,
        ErrorMessage NVARCHAR(MAX) NULL,
        DurationMs INT DEFAULT 0,
        ScrapedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()
    );
    CREATE INDEX IX_ScrapeJobDetails_JobId ON ScrapeJobDetails(JobId);
    CREATE INDEX IX_ScrapeJobDetails_Asin ON ScrapeJobDetails(Asin);
    CREATE INDEX IX_ScrapeJobDetails_Success ON ScrapeJobDetails(Success);
    PRINT 'Created ScrapeJobDetails';
END
GO

-- ============================================================
-- PEMS (TaskFlow) - ALL PHASES
-- ============================================================

-- TaskSlaPolicies
IF OBJECT_ID(N'dbo.TaskSlaPolicies', N'U') IS NULL
BEGIN
    CREATE TABLE TaskSlaPolicies (
        Id VARCHAR(50) PRIMARY KEY,
        Name NVARCHAR(255) NOT NULL,
        Description NVARCHAR(MAX) NULL,
        SlaHours INT NOT NULL DEFAULT 48,
        WarningHours NVARCHAR(MAX) NULL,
        BusinessHoursOnly BIT NOT NULL DEFAULT 1,
        Timezone NVARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
        ExcludeWeekends BIT NOT NULL DEFAULT 1,
        HolidayCalendar NVARCHAR(100) NULL,
        EscalationRules NVARCHAR(MAX) NOT NULL,
        NotificationChannels NVARCHAR(MAX) NOT NULL,
        IsDefault BIT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedBy VARCHAR(50) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()
    );
    CREATE UNIQUE INDEX UX_TaskSlaPolicies_Default ON TaskSlaPolicies(IsDefault) WHERE IsDefault = 1;
    CREATE INDEX IX_TaskSlaPolicies_Active ON TaskSlaPolicies(IsActive);
    PRINT 'Created TaskSlaPolicies';
END
GO

-- TaskTemplates
IF OBJECT_ID(N'dbo.TaskTemplates', N'U') IS NULL
BEGIN
    CREATE TABLE TaskTemplates (
        Id VARCHAR(24) PRIMARY KEY,
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
        SubtaskDefinitions NVARCHAR(MAX) NULL,
        ActivityDefinitions NVARCHAR(MAX) NULL,
        Tags NVARCHAR(MAX) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedBy VARCHAR(50) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        TemplateVersion INT NOT NULL DEFAULT 1,
        ExecutionComplexity NVARCHAR(20) DEFAULT 'MEDIUM',
        EstimatedExecutionMinutes INT DEFAULT 60,
        AutoAssignEnabled BIT NOT NULL DEFAULT 0,
        ReviewRequired BIT NOT NULL DEFAULT 1,
        EscalationHours INT DEFAULT 24,
        CriticalityScore INT DEFAULT 5,
        AutomationEligible BIT NOT NULL DEFAULT 0,
        TemplateOwnerId VARCHAR(50),
        LastGeneratedAt DATETIME2 NULL,
        NextScheduledDate DATETIME2 NULL,
        CONSTRAINT FK_TaskTemplates_SlaPolicy FOREIGN KEY (DefaultSlaPolicyId) REFERENCES TaskSlaPolicies(Id)
    );
    CREATE INDEX IX_TaskTemplates_Active ON TaskTemplates(IsActive);
    CREATE INDEX IX_TaskTemplates_Category ON TaskTemplates(Category);
    CREATE INDEX IX_TaskTemplates_Department ON TaskTemplates(Department);
    CREATE INDEX IX_TaskTemplates_FrequencyActive ON TaskTemplates(Frequency, IsActive) INCLUDE (NextScheduledDate);
    PRINT 'Created TaskTemplates';
END
GO

-- TaskInstances
IF OBJECT_ID(N'dbo.TaskInstances', N'U') IS NULL
BEGIN
    CREATE TABLE TaskInstances (
        Id VARCHAR(50) PRIMARY KEY,
        Code NVARCHAR(20) NOT NULL UNIQUE,
        TemplateId VARCHAR(24) NULL,
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
        Frequency NVARCHAR(50) NULL DEFAULT 'ONE_TIME',
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
        Tags NVARCHAR(MAX) NULL,
        CreatedBy VARCHAR(50) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        SubTaskCount INT DEFAULT 0,
        ActivityCount INT DEFAULT 0,
        CompletedSubTasks INT DEFAULT 0,
        ProgressPct DECIMAL(5,2) DEFAULT 0,
        AssigneeName NVARCHAR(200) DEFAULT '',
        ReviewerName NVARCHAR(200) DEFAULT '',
        ApprovalLevel NVARCHAR(20) DEFAULT 'single',
        BackupReviewerId VARCHAR(50),
        ApproverCount INT DEFAULT 0,
        RequiredApprovals INT DEFAULT 1,
        WeightedProgressPct DECIMAL(5,2) DEFAULT 0,
        LastSlaWarningAt DATETIME2 NULL,
        LastSlaBreachAt DATETIME2 NULL,
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
    CREATE INDEX IX_TaskInstances_FrequencyStatus ON TaskInstances(Frequency, Status) INCLUDE (Department, DueDate);
    CREATE INDEX IX_PemsInstance_Status ON TaskInstances(Status) INCLUDE (SellerId, AssigneeId, DueDate);
    CREATE INDEX IX_PemsInstance_Seller ON TaskInstances(SellerId) INCLUDE (Status, DueDate);
    CREATE INDEX IX_PemsInstance_AssignedTo ON TaskInstances(AssigneeId) INCLUDE (Status, DueDate);
    CREATE INDEX IX_PemsInstance_Reviewer ON TaskInstances(ReviewerId) INCLUDE (Status);
    CREATE INDEX IX_PemsInstance_DueDate ON TaskInstances(DueDate) INCLUDE (Status, SlaStatus);
    CREATE INDEX IX_PemsInstance_Template ON TaskInstances(TemplateId);
    CREATE INDEX IX_PemsInstance_Department ON TaskInstances(Department) INCLUDE (Status, DueDate);
    CREATE INDEX IX_PemsInstances_FrequencyStatus ON TaskInstances(Frequency, Status) INCLUDE (Department, DueDate);
    CREATE INDEX IX_TaskInstances_Assignee_Due_Status ON TaskInstances(AssigneeId, DueDate, Status) INCLUDE (TemplateId, Title, Priority, SlaHours, ReviewerId, CreatedAt);
    CREATE INDEX IX_TaskInstances_Reviewer_Status ON TaskInstances(ReviewerId, Status) INCLUDE (AssigneeId, Title, DueDate, Priority, SlaHours, CreatedAt);
    CREATE INDEX IX_TaskInstances_Template_Status ON TaskInstances(TemplateId, Status) INCLUDE (AssigneeId, ReviewerId, DueDate, Priority, SlaHours, CreatedAt);
    PRINT 'Created TaskInstances';
END
GO

-- TaskSubTasks
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
        WeightagePct DECIMAL(5,2) DEFAULT 0,
        IsMandatory BIT NOT NULL DEFAULT 1,
        ReviewRequired BIT NOT NULL DEFAULT 0,
        OwnerType NVARCHAR(50) DEFAULT 'Brand Manager',
        CONSTRAINT FK_TaskSubTasks_Task FOREIGN KEY (TaskId) REFERENCES TaskInstances(Id) ON DELETE CASCADE,
        CONSTRAINT FK_TaskSubTasks_Assignee FOREIGN KEY (AssigneeId) REFERENCES Users(Id)
    );
    CREATE INDEX IX_TaskSubTasks_TaskId ON TaskSubTasks(TaskId);
    CREATE INDEX IX_TaskSubTasks_AssigneeId ON TaskSubTasks(AssigneeId);
    CREATE INDEX IX_TaskSubTasks_Status ON TaskSubTasks(Status);
    CREATE INDEX IX_PemsSubTask_Instance ON TaskSubTasks(TaskId);
    PRINT 'Created TaskSubTasks';
END
GO

-- TaskActivities
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
        CONSTRAINT FK_TaskActivities_SubTask FOREIGN KEY (SubTaskId) REFERENCES TaskSubTasks(Id),
        CONSTRAINT FK_TaskActivities_Task FOREIGN KEY (TaskId) REFERENCES TaskInstances(Id) ON DELETE CASCADE,
        CONSTRAINT FK_TaskActivities_CompletedBy FOREIGN KEY (CompletedBy) REFERENCES Users(Id)
    );
    CREATE INDEX IX_TaskActivities_SubTaskId ON TaskActivities(SubTaskId);
    CREATE INDEX IX_TaskActivities_TaskId ON TaskActivities(TaskId);
    CREATE INDEX IX_TaskActivities_IsCompleted ON TaskActivities(IsCompleted);
    CREATE INDEX IX_PemsActivity_Instance ON TaskActivities(TaskId);
    PRINT 'Created TaskActivities';
END
GO

-- TaskAttachments
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
        CONSTRAINT FK_TaskAttachments_SubTask FOREIGN KEY (SubTaskId) REFERENCES TaskSubTasks(Id),
        CONSTRAINT FK_TaskAttachments_Activity FOREIGN KEY (ActivityId) REFERENCES TaskActivities(Id),
        CONSTRAINT FK_TaskAttachments_UploadedBy FOREIGN KEY (UploadedBy) REFERENCES Users(Id)
    );
    CREATE INDEX IX_TaskAttachments_TaskId ON TaskAttachments(TaskId);
    CREATE INDEX IX_TaskAttachments_SubTaskId ON TaskAttachments(SubTaskId);
    CREATE INDEX IX_TaskAttachments_ActivityId ON TaskAttachments(ActivityId);
    PRINT 'Created TaskAttachments';
END
GO

-- TaskComments
IF OBJECT_ID(N'dbo.TaskComments', N'U') IS NULL
BEGIN
    CREATE TABLE TaskComments (
        Id VARCHAR(50) PRIMARY KEY,
        TaskId VARCHAR(50) NOT NULL,
        SubTaskId VARCHAR(50) NULL,
        AuthorId VARCHAR(50) NOT NULL,
        Content NVARCHAR(MAX) NOT NULL,
        IsInternal BIT NOT NULL DEFAULT 0,
        ParentCommentId VARCHAR(50) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        UpdatedAt DATETIME2 NULL,
        DeletedAt DATETIME2 NULL,
        CONSTRAINT FK_TaskComments_Task FOREIGN KEY (TaskId) REFERENCES TaskInstances(Id) ON DELETE CASCADE,
        CONSTRAINT FK_TaskComments_SubTask FOREIGN KEY (SubTaskId) REFERENCES TaskSubTasks(Id),
        CONSTRAINT FK_TaskComments_Author FOREIGN KEY (AuthorId) REFERENCES Users(Id),
        CONSTRAINT FK_TaskComments_Parent FOREIGN KEY (ParentCommentId) REFERENCES TaskComments(Id)
    );
    CREATE INDEX IX_TaskComments_TaskId ON TaskComments(TaskId);
    CREATE INDEX IX_TaskComments_SubTaskId ON TaskComments(SubTaskId);
    CREATE INDEX IX_TaskComments_AuthorId ON TaskComments(AuthorId);
    CREATE INDEX IX_TaskComments_CreatedAt ON TaskComments(CreatedAt);
    PRINT 'Created TaskComments';
END
GO

-- TaskAuditLogs
IF OBJECT_ID(N'dbo.TaskAuditLogs', N'U') IS NULL
BEGIN
    CREATE TABLE TaskAuditLogs (
        Id VARCHAR(50) PRIMARY KEY,
        TaskId VARCHAR(50) NOT NULL,
        Action NVARCHAR(50) NOT NULL,
        FromStatus NVARCHAR(20) NULL,
        ToStatus NVARCHAR(20) NULL,
        ActorId VARCHAR(50) NULL,
        ActorName NVARCHAR(255) NULL,
        Details NVARCHAR(MAX) NULL,
        Metadata NVARCHAR(MAX) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        CONSTRAINT FK_TaskAuditLogs_Task FOREIGN KEY (TaskId) REFERENCES TaskInstances(Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_TaskAuditLogs_TaskId_CreatedAt ON TaskAuditLogs(TaskId, CreatedAt DESC);
    CREATE INDEX IX_TaskAuditLogs_Action ON TaskAuditLogs(Action);
    CREATE INDEX IX_TaskAuditLogs_ActorId ON TaskAuditLogs(ActorId);
    CREATE INDEX IX_PemsTaskEvents_TaskVersion ON TaskAuditLogs(TaskId, CreatedAt);
    PRINT 'Created TaskAuditLogs';
END
GO

-- TaskWatchers
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
GO

-- TaskRecurrenceLog
IF OBJECT_ID(N'dbo.TaskRecurrenceLog', N'U') IS NULL
BEGIN
    CREATE TABLE TaskRecurrenceLog (
        Id VARCHAR(50) PRIMARY KEY,
        TemplateId VARCHAR(24) NOT NULL,
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
GO

-- PemsRecurrenceLog (legacy PEMS)
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
    PRINT 'Created PemsRecurrenceLog';
END
GO

-- PemsEscalationRules
IF OBJECT_ID(N'dbo.PemsEscalationRules', N'U') IS NULL
BEGIN
    CREATE TABLE PemsEscalationRules (
        Id VARCHAR(50) PRIMARY KEY,
        Name NVARCHAR(200) NOT NULL,
        TriggerHoursBefore INT NOT NULL DEFAULT 24,
        NotifyRole NVARCHAR(50) NOT NULL DEFAULT 'assignee',
        Channel NVARCHAR(20) NOT NULL DEFAULT 'in_app',
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()
    );
    PRINT 'Created PemsEscalationRules';
END
GO

-- PemsNotifications
IF OBJECT_ID(N'dbo.PemsNotifications', N'U') IS NULL
BEGIN
    CREATE TABLE PemsNotifications (
        Id VARCHAR(50) PRIMARY KEY,
        TaskInstanceId VARCHAR(50),
        UserId VARCHAR(50) NOT NULL,
        Type NVARCHAR(50) NOT NULL,
        Title NVARCHAR(300) NOT NULL,
        Message NVARCHAR(MAX),
        IsRead BIT NOT NULL DEFAULT 0,
        ActionUrl NVARCHAR(500),
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        CONSTRAINT FK_PemsNotif_Instance FOREIGN KEY (TaskInstanceId) REFERENCES TaskInstances(Id)
    );
    CREATE INDEX IX_PemsNotif_User ON PemsNotifications(UserId, IsRead, CreatedAt DESC);
    PRINT 'Created PemsNotifications';
END
GO

-- PemsScorecards
IF OBJECT_ID(N'dbo.PemsScorecards', N'U') IS NULL
BEGIN
    CREATE TABLE PemsScorecards (
        Id VARCHAR(50) PRIMARY KEY,
        EntityType NVARCHAR(20) NOT NULL,
        EntityId VARCHAR(50) NOT NULL,
        EntityName NVARCHAR(200),
        Period NVARCHAR(20) NOT NULL,
        TotalTasks INT DEFAULT 0,
        CompletedTasks INT DEFAULT 0,
        RejectedTasks INT DEFAULT 0,
        AvgAchievementPct DECIMAL(7,2) DEFAULT 0,
        AvgVariance DECIMAL(18,2) DEFAULT 0,
        SLACompliancePct DECIMAL(5,2) DEFAULT 0,
        AvgQualityScore DECIMAL(3,2) DEFAULT 0,
        CompletionRatePct DECIMAL(5,2) DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()
    );
    CREATE INDEX IX_PemsScorecard_Entity ON PemsScorecards(EntityType, EntityId, Period);
    PRINT 'Created PemsScorecards';
END
GO

-- TaskEscalationPolicies (Phase 2)
IF OBJECT_ID(N'dbo.TaskEscalationPolicies', N'U') IS NULL
BEGIN
    CREATE TABLE TaskEscalationPolicies (
        Id VARCHAR(50) PRIMARY KEY,
        Name NVARCHAR(255) NOT NULL,
        Description NVARCHAR(MAX) NULL,
        TriggerType NVARCHAR(50) NOT NULL,
        Conditions NVARCHAR(MAX) NOT NULL,
        Actions NVARCHAR(MAX) NOT NULL,
        NotifyRoles NVARCHAR(MAX) NULL,
        NotifyUsers NVARCHAR(MAX) NULL,
        Channels NVARCHAR(MAX) NOT NULL,
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
GO

-- TaskEscalations
IF OBJECT_ID(N'dbo.TaskEscalations', N'U') IS NULL
BEGIN
    CREATE TABLE TaskEscalations (
        Id VARCHAR(50) PRIMARY KEY,
        TaskId VARCHAR(50) NOT NULL,
        RuleId VARCHAR(50) NOT NULL,
        TriggerType NVARCHAR(50) NOT NULL,
        EscalationLevel NVARCHAR(20) NOT NULL,
        TriggeredAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        Metadata NVARCHAR(MAX) NULL,
        NotifiedUsers NVARCHAR(MAX) NULL,
        Status NVARCHAR(20) NOT NULL DEFAULT 'PENDING',
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
GO

-- TaskNotifications
IF OBJECT_ID(N'dbo.TaskNotifications', N'U') IS NULL
BEGIN
    CREATE TABLE TaskNotifications (
        Id VARCHAR(50) PRIMARY KEY,
        UserId VARCHAR(50) NOT NULL,
        Type NVARCHAR(50) NOT NULL,
        Title NVARCHAR(255) NOT NULL,
        Message NVARCHAR(MAX) NOT NULL,
        ActionUrl NVARCHAR(500) NULL,
        Priority NVARCHAR(20) NOT NULL DEFAULT 'normal',
        IsRead BIT NOT NULL DEFAULT 0,
        ReadAt DATETIME2 NULL,
        TaskId VARCHAR(50) NULL,
        Metadata NVARCHAR(MAX) NULL,
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
GO

-- UserNotificationPreferences
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
        DigestFrequency NVARCHAR(20) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        CONSTRAINT FK_UserNotificationPreferences_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
    );
    PRINT 'Created UserNotificationPreferences';
END
GO

-- PemsAssignmentRules
IF OBJECT_ID(N'dbo.PemsAssignmentRules', N'U') IS NULL
BEGIN
    CREATE TABLE PemsAssignmentRules (
        Id VARCHAR(50) PRIMARY KEY,
        TemplateId VARCHAR(50) NOT NULL,
        AssignmentMode NVARCHAR(20) NOT NULL DEFAULT 'manual',
        AutoAssignStrategy NVARCHAR(30) DEFAULT 'lowest_workload',
        ReviewerId VARCHAR(50),
        BackupReviewerId VARCHAR(50),
        EscalationHours INT DEFAULT 24,
        EscalationReviewerId VARCHAR(50),
        ApprovalLevel NVARCHAR(20) DEFAULT 'single',
        QualityScoreRequired BIT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        CONSTRAINT FK_AssignRule_Template FOREIGN KEY (TemplateId) REFERENCES TaskTemplates(Id)
    );
    PRINT 'Created PemsAssignmentRules';
END
GO

-- ============================================================
-- ALERTS & WEBHOOKS
-- ============================================================

IF OBJECT_ID(N'dbo.Alerts', N'U') IS NULL
BEGIN
    CREATE TABLE Alerts (
        Id VARCHAR(50) PRIMARY KEY,
        SellerId VARCHAR(50),
        AsinId VARCHAR(50),
        RuleId VARCHAR(50),
        Severity NVARCHAR(20) NOT NULL,
        Message NVARCHAR(MAX) NOT NULL,
        Status NVARCHAR(20) DEFAULT 'ACTIVE',
        Metadata NVARCHAR(MAX),
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        CONSTRAINT FK_Alerts_Seller FOREIGN KEY (SellerId) REFERENCES Sellers(Id) ON DELETE CASCADE,
        CONSTRAINT FK_Alerts_Asin FOREIGN KEY (AsinId) REFERENCES Asins(Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_Alerts_SellerId_CreatedAt ON Alerts(SellerId, CreatedAt DESC) INCLUDE (Severity, Message);
    CREATE INDEX IX_Alerts_Status ON Alerts(Status);
    PRINT 'Created Alerts';
END
GO

IF OBJECT_ID(N'dbo.AlertRules', N'U') IS NULL
BEGIN
    CREATE TABLE AlertRules (
        Id VARCHAR(50) PRIMARY KEY,
        Name NVARCHAR(255) NOT NULL,
        Description NVARCHAR(MAX),
        Conditions NVARCHAR(MAX) NOT NULL,
        Severity NVARCHAR(20) NOT NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedBy VARCHAR(50),
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()
    );
    PRINT 'Created AlertRules';
END
GO

IF OBJECT_ID(N'dbo.Webhooks', N'U') IS NULL
BEGIN
    CREATE TABLE Webhooks (
        Id VARCHAR(50) PRIMARY KEY,
        Name NVARCHAR(255) NOT NULL,
        Url NVARCHAR(500) NOT NULL,
        Events NVARCHAR(MAX) NOT NULL,
        Secret NVARCHAR(255),
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedBy VARCHAR(50),
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()
    );
    PRINT 'Created Webhooks';
END
GO

IF OBJECT_ID(N'dbo.WebhookLogs', N'U') IS NULL
BEGIN
    CREATE TABLE WebhookLogs (
        Id VARCHAR(50) PRIMARY KEY,
        WebhookId VARCHAR(50) NOT NULL,
        EventType NVARCHAR(100) NOT NULL,
        Payload NVARCHAR(MAX) NOT NULL,
        ResponseCode INT,
        ResponseBody NVARCHAR(MAX),
        DurationMs INT,
        Attempt INT DEFAULT 1,
        Status NVARCHAR(20) NOT NULL,
        ErrorMessage NVARCHAR(MAX),
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        CONSTRAINT FK_WebhookLogs_Webhook FOREIGN KEY (WebhookId) REFERENCES Webhooks(Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_WebhookLogs_WebhookId_CreatedAt ON WebhookLogs(WebhookId, CreatedAt DESC);
    PRINT 'Created WebhookLogs';
END
GO

-- ============================================================
-- ACTIONS (legacy PEMS actions)
-- ============================================================

IF OBJECT_ID(N'dbo.Actions', N'U') IS NULL
BEGIN
    CREATE TABLE Actions (
        Id VARCHAR(50) PRIMARY KEY,
        Title NVARCHAR(500) NOT NULL,
        Description NVARCHAR(MAX),
        Status NVARCHAR(30) NOT NULL DEFAULT 'PENDING',
        Priority NVARCHAR(20) DEFAULT 'MEDIUM',
        AssignedTo VARCHAR(50),
        ReviewerId VARCHAR(50),
        SellerId VARCHAR(50),
        DueDate DATETIME2,
        CreatedBy VARCHAR(50),
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        SubTasks NVARCHAR(MAX) NULL,
        SubTaskProgress NVARCHAR(50) NULL
    );
    CREATE INDEX IX_Actions_AssignedTo_Status ON Actions(AssignedTo, Status) INCLUDE (Title, Description, DueDate, Priority, SellerId, CreatedAt);
    PRINT 'Created Actions';
END
GO

-- ============================================================
-- CHAT / COMETCHAT
-- ============================================================

IF OBJECT_ID(N'dbo.Conversations', N'U') IS NULL
BEGIN
    CREATE TABLE Conversations (
        Id VARCHAR(50) PRIMARY KEY,
        Type NVARCHAR(20) NOT NULL DEFAULT 'DIRECT',
        Name NVARCHAR(255),
        CreatedBy VARCHAR(50) NOT NULL,
        LastMessageId VARCHAR(50),
        UpdatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        CONSTRAINT FK_Conversations_Creator FOREIGN KEY (CreatedBy) REFERENCES Users(Id)
    );
    PRINT 'Created Conversations';
END
GO

IF OBJECT_ID(N'dbo.ConversationParticipants', N'U') IS NULL
BEGIN
    CREATE TABLE ConversationParticipants (
        ConversationId VARCHAR(50) NOT NULL,
        UserId VARCHAR(50) NOT NULL,
        JoinedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        LastReadAt DATETIME2,
        PRIMARY KEY (ConversationId, UserId),
        CONSTRAINT FK_ConvPart_Conv FOREIGN KEY (ConversationId) REFERENCES Conversations(Id) ON DELETE CASCADE,
        CONSTRAINT FK_ConvPart_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
    );
    PRINT 'Created ConversationParticipants';
END
GO

IF OBJECT_ID(N'dbo.Messages', N'U') IS NULL
BEGIN
    CREATE TABLE Messages (
        Id VARCHAR(50) PRIMARY KEY,
        ConversationId VARCHAR(50) NOT NULL,
        SenderId VARCHAR(50) NOT NULL,
        Type NVARCHAR(20) NOT NULL DEFAULT 'TEXT',
        Content NVARCHAR(MAX),
        FileUrl NVARCHAR(500),
        ReplyToId VARCHAR(50),
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        CONSTRAINT FK_Messages_Conversation FOREIGN KEY (ConversationId) REFERENCES Conversations(Id) ON DELETE CASCADE,
        CONSTRAINT FK_Messages_Sender FOREIGN KEY (SenderId) REFERENCES Users(Id)
    );
    CREATE INDEX IX_Messages_ConversationId_CreatedAt ON Messages(ConversationId, CreatedAt DESC);
    CREATE INDEX IX_Messages_SenderId ON Messages(SenderId);
    PRINT 'Created Messages';
END
GO

IF OBJECT_ID(N'dbo.MessageReactions', N'U') IS NULL
BEGIN
    CREATE TABLE MessageReactions (
        Id VARCHAR(50) PRIMARY KEY,
        MessageId VARCHAR(50) NOT NULL,
        UserId VARCHAR(50) NOT NULL,
        Emoji NVARCHAR(50) NOT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        CONSTRAINT FK_MessageReactions_Message FOREIGN KEY (MessageId) REFERENCES Messages(Id) ON DELETE CASCADE,
        CONSTRAINT FK_MessageReactions_User FOREIGN KEY (UserId) REFERENCES Users(Id),
        CONSTRAINT UQ_MessageReactions_Message_User_Emoji UNIQUE (MessageId, UserId, Emoji)
    );
    PRINT 'Created MessageReactions';
END
GO

IF OBJECT_ID(N'dbo.MessageStatus', N'U') IS NULL
BEGIN
    CREATE TABLE MessageStatus (
        MessageId VARCHAR(50) NOT NULL,
        UserId VARCHAR(50) NOT NULL,
        IsRead BIT NOT NULL DEFAULT 0,
        ReadAt DATETIME2 NULL,
        PRIMARY KEY (MessageId, UserId),
        CONSTRAINT FK_MessageStatus_Message FOREIGN KEY (MessageId) REFERENCES Messages(Id) ON DELETE CASCADE,
        CONSTRAINT FK_MessageStatus_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
    );
    PRINT 'Created MessageStatus';
END
GO

IF OBJECT_ID(N'dbo.CallLogs', N'U') IS NULL
BEGIN
    CREATE TABLE CallLogs (
        Id VARCHAR(50) PRIMARY KEY,
        ConversationId VARCHAR(50) NOT NULL,
        CallerId VARCHAR(50) NOT NULL,
        ReceiverId VARCHAR(50) NOT NULL,
        Type NVARCHAR(20) NOT NULL,
        Status NVARCHAR(20) NOT NULL DEFAULT 'INITIATED',
        StartedAt DATETIME2,
        EndedAt DATETIME2,
        Duration INT DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        CONSTRAINT FK_CallLogs_Conversation FOREIGN KEY (ConversationId) REFERENCES Conversations(Id) ON DELETE CASCADE,
        CONSTRAINT FK_CallLogs_Caller FOREIGN KEY (CallerId) REFERENCES Users(Id),
        CONSTRAINT FK_CallLogs_Receiver FOREIGN KEY (ReceiverId) REFERENCES Users(Id)
    );
    CREATE INDEX IX_CallLogs_ConversationId ON CallLogs(ConversationId);
    CREATE INDEX IX_CallLogs_CallerId ON CallLogs(CallerId);
    CREATE INDEX IX_CallLogs_ReceiverId ON CallLogs(ReceiverId);
    PRINT 'Created CallLogs';
END
GO

-- ============================================================
-- FILES & UPLOADS
-- ============================================================

IF OBJECT_ID(N'dbo.UploadedFiles', N'U') IS NULL
BEGIN
    CREATE TABLE UploadedFiles (
        Id VARCHAR(50) PRIMARY KEY,
        OriginalName NVARCHAR(500) NOT NULL,
        StoredName NVARCHAR(500) NOT NULL,
        FilePath NVARCHAR(1000) NOT NULL,
        FileSize BIGINT NOT NULL,
        MimeType NVARCHAR(100),
        UploadedBy VARCHAR(50) NOT NULL,
        EntityType NVARCHAR(50),
        EntityId VARCHAR(50),
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        CONSTRAINT FK_UploadedFiles_User FOREIGN KEY (UploadedBy) REFERENCES Users(Id)
    );
    CREATE INDEX IX_UploadedFiles_Entity ON UploadedFiles(EntityType, EntityId);
    CREATE INDEX IX_UploadedFiles_UploadedBy ON UploadedFiles(UploadedBy);
    PRINT 'Created UploadedFiles';
END
GO

-- ============================================================
-- TARGETS & GOALS
-- ============================================================

IF OBJECT_ID(N'dbo.Targets', N'U') IS NULL
BEGIN
    CREATE TABLE Targets (
        Id VARCHAR(50) PRIMARY KEY,
        SellerId VARCHAR(50) NOT NULL,
        Period NVARCHAR(20) NOT NULL,
        Year INT NOT NULL,
        Month INT,
        Quarter INT,
        RevenueTarget DECIMAL(18,2) DEFAULT 0,
        OrdersTarget INT DEFAULT 0,
        UnitsTarget INT DEFAULT 0,
        CreatedBy VARCHAR(50),
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        CONSTRAINT FK_Targets_Seller FOREIGN KEY (SellerId) REFERENCES Sellers(Id) ON DELETE CASCADE,
        CONSTRAINT UQ_Targets_Seller_Period UNIQUE (SellerId, Period, Year, Month, Quarter)
    );
    CREATE INDEX IX_Targets_Seller_Period ON Targets(SellerId, Period, Year, Month);
    PRINT 'Created Targets';
END
GO

IF OBJECT_ID(N'dbo.Goals', N'U') IS NULL
BEGIN
    CREATE TABLE Goals (
        Id VARCHAR(50) PRIMARY KEY,
        UserId VARCHAR(50) NOT NULL,
        SellerId VARCHAR(50),
        Title NVARCHAR(255) NOT NULL,
        Description NVARCHAR(MAX),
        Type NVARCHAR(50) NOT NULL,
        TargetValue DECIMAL(18,2) NOT NULL,
        CurrentValue DECIMAL(18,2) DEFAULT 0,
        StartDate DATETIME2 NOT NULL,
        EndDate DATETIME2 NOT NULL,
        Status NVARCHAR(20) DEFAULT 'ACTIVE',
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        CONSTRAINT FK_Goals_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
        CONSTRAINT FK_Goals_Seller FOREIGN KEY (SellerId) REFERENCES Sellers(Id) ON DELETE SET NULL
    );
    CREATE INDEX IX_Goals_User_Status ON Goals(UserId, Status);
    CREATE INDEX IX_Goals_Seller_Status ON Goals(SellerId, Status);
    PRINT 'Created Goals';
END
GO

-- ============================================================
-- API KEYS & INTEGRATIONS
-- ============================================================

IF OBJECT_ID(N'dbo.ApiKeys', N'U') IS NULL
BEGIN
    CREATE TABLE ApiKeys (
        Id VARCHAR(50) PRIMARY KEY,
        Name NVARCHAR(255) NOT NULL,
        KeyHash NVARCHAR(500) NOT NULL,
        KeyPrefix NVARCHAR(20) NOT NULL,
        UserId VARCHAR(50) NOT NULL,
        Permissions NVARCHAR(MAX),
        ExpiresAt DATETIME2,
        LastUsedAt DATETIME2,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        CONSTRAINT FK_ApiKeys_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_ApiKeys_UserId ON ApiKeys(UserId);
    CREATE INDEX IX_ApiKeys_KeyPrefix ON ApiKeys(KeyPrefix);
    PRINT 'Created ApiKeys';
END
GO

-- ============================================================
-- DEFAULT DATA INSERTS
-- ============================================================

-- Default Roles
IF NOT EXISTS (SELECT 1 FROM Roles WHERE Name = 'super_admin')
BEGIN
    INSERT INTO Roles (Id, Name, DisplayName, Description, Level, Color, IsSystem, IsActive, CreatedAt, UpdatedAt)
    VALUES ('role-super-admin', 'super_admin', 'Super Admin', 'Full system access', 100, '#DC2626', 1, 1, dbo.GetEnvDate(), dbo.GetEnvDate());
    PRINT 'Inserted Super Admin role';
END
IF NOT EXISTS (SELECT 1 FROM Roles WHERE Name = 'admin')
BEGIN
    INSERT INTO Roles (Id, Name, DisplayName, Description, Level, Color, IsSystem, IsActive, CreatedAt, UpdatedAt)
    VALUES ('role-admin', 'admin', 'Admin', 'Administrative access', 80, '#EA580C', 1, 1, dbo.GetEnvDate(), dbo.GetEnvDate());
    PRINT 'Inserted Admin role';
END
IF NOT EXISTS (SELECT 1 FROM Roles WHERE Name = 'brand_manager')
BEGIN
    INSERT INTO Roles (Id, Name, DisplayName, Description, Level, Color, IsSystem, IsActive, CreatedAt, UpdatedAt)
    VALUES ('role-brand-manager', 'brand_manager', 'Brand Manager', 'Manage brands and sellers', 60, '#2563EB', 1, 1, dbo.GetEnvDate(), dbo.GetEnvDate());
    PRINT 'Inserted Brand Manager role';
END
IF NOT EXISTS (SELECT 1 FROM Roles WHERE Name = 'reviewer')
BEGIN
    INSERT INTO Roles (Id, Name, DisplayName, Description, Level, Color, IsSystem, IsActive, CreatedAt, UpdatedAt)
    VALUES ('role-reviewer', 'reviewer', 'Reviewer', 'Review and approve tasks', 40, '#0891B2', 1, 1, dbo.GetEnvDate(), dbo.GetEnvDate());
    PRINT 'Inserted Reviewer role';
END
IF NOT EXISTS (SELECT 1 FROM Roles WHERE Name = 'viewer')
BEGIN
    INSERT INTO Roles (Id, Name, DisplayName, Description, Level, Color, IsSystem, IsActive, CreatedAt, UpdatedAt)
    VALUES ('role-viewer', 'viewer', 'Viewer', 'Read-only access', 10, '#6B7280', 1, 1, dbo.GetEnvDate(), dbo.GetEnvDate());
    PRINT 'Inserted Viewer role';
END
GO

-- Default SLA Policy
IF NOT EXISTS (SELECT 1 FROM TaskSlaPolicies WHERE IsDefault = 1)
BEGIN
    INSERT INTO TaskSlaPolicies (Id, Name, Description, SlaHours, WarningHours, BusinessHoursOnly, Timezone, ExcludeWeekends, HolidayCalendar, EscalationRules, NotificationChannels, IsDefault, IsActive, CreatedAt, UpdatedAt)
    VALUES (
        'sla-standard-48h',
        'Standard 48h',
        'Standard 48-hour SLA with 24h/12h/6h warnings',
        48,
        '[24, 12, 6]',
        1,
        'Asia/Kolkata',
        1,
        'india',
        '[{"level":"assignee","hoursBeforeDue":24,"notify":["assignee"]},{"level":"reviewer","hoursBeforeDue":12,"notify":["reviewer"]},{"level":"manager","hoursAfterBreach":0,"notify":["manager"]},{"level":"admin","hoursAfterBreach":24,"notify":["admin"]}]',
        '{"email":true,"inApp":true,"slack":false,"webhook":null}',
        1, 1, dbo.GetEnvDate(), dbo.GetEnvDate()
    );
    PRINT 'Inserted default SLA policy';
END
GO

-- Default Template
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
GO

-- Default Escalation Policies
IF NOT EXISTS (SELECT 1 FROM TaskEscalationPolicies WHERE Id = 'esc-sla-warning')
BEGIN
    INSERT INTO TaskEscalationPolicies (Id, Name, Description, TriggerType, Conditions, Actions, NotifyRoles, Channels, DelayMinutes, RepeatIntervalMinutes, MaxEscalations, CooldownMinutes, Priority, IsActive, CreatedAt, UpdatedAt)
    VALUES (
        'esc-sla-warning', 'SLA Warning', 'Notify assignee when task is at risk of SLA breach',
        'SLA_WARNING', '{"atRisk": true}',
        '[{"type": "SEND_NOTIFICATION", "notifyRoles": ["assignee"], "channels": ["in_app", "email"]}]',
        '["assignee"]', '["in_app", "email"]', 0, 360, 3, 360, 10, 1, dbo.GetEnvDate(), dbo.GetEnvDate()
    );
    PRINT 'Inserted default escalation: SLA Warning';
END
IF NOT EXISTS (SELECT 1 FROM TaskEscalationPolicies WHERE Id = 'esc-sla-breach')
BEGIN
    INSERT INTO TaskEscalationPolicies (Id, Name, Description, TriggerType, Conditions, Actions, NotifyRoles, Channels, DelayMinutes, RepeatIntervalMinutes, MaxEscalations, CooldownMinutes, Priority, IsActive, CreatedAt, UpdatedAt)
    VALUES (
        'esc-sla-breach', 'SLA Breach', 'Escalate when task SLA is breached',
        'SLA_BREACH', '{"slaBreached": true}',
        '[{"type": "SEND_NOTIFICATION", "notifyRoles": ["assignee", "reviewer", "manager"], "channels": ["in_app", "email"]}, {"type": "ADD_WATCHER", "targetUserId": "{{reviewerId}}"}, {"type": "ADD_COMMENT", "message": "SLA breached - automatic escalation triggered"}]',
        '["assignee", "reviewer", "manager"]', '["in_app", "email", "slack"]', 0, 120, 3, 60, 5, 1, dbo.GetEnvDate(), dbo.GetEnvDate()
    );
    PRINT 'Inserted default escalation: SLA Breach';
END
IF NOT EXISTS (SELECT 1 FROM TaskEscalationPolicies WHERE Id = 'esc-stalled-task')
BEGIN
    INSERT INTO TaskEscalationPolicies (Id, Name, Description, TriggerType, Conditions, Actions, NotifyRoles, Channels, DelayMinutes, RepeatIntervalMinutes, MaxEscalations, CooldownMinutes, Priority, IsActive, CreatedAt, UpdatedAt)
    VALUES (
        'esc-stalled-task', 'Stalled Task', 'Escalate when task has no activity for 48 hours',
        'STALLED_TASK', '{"stalledHours": 48}',
        '[{"type": "SEND_NOTIFICATION", "notifyRoles": ["assignee", "reviewer"], "channels": ["in_app", "email"]}, {"type": "ADD_COMMENT", "message": "Task appears stalled - no activity for 48 hours"}]',
        '["assignee", "reviewer"]', '["in_app", "email"]', 0, 1440, 2, 1440, 15, 1, dbo.GetEnvDate(), dbo.GetEnvDate()
    );
    PRINT 'Inserted default escalation: Stalled Task';
END
IF NOT EXISTS (SELECT 1 FROM TaskEscalationPolicies WHERE Id = 'esc-overdue-subtask')
BEGIN
    INSERT INTO TaskEscalationPolicies (Id, Name, Description, TriggerType, Conditions, Actions, NotifyRoles, Channels, DelayMinutes, RepeatIntervalMinutes, MaxEscalations, CooldownMinutes, Priority, IsActive, CreatedAt, UpdatedAt)
    VALUES (
        'esc-overdue-subtask', 'Overdue Subtask', 'Escalate when subtask is overdue by 24 hours',
        'OVERDUE_SUBTASK', '{"overdueHours": 24}',
        '[{"type": "CREATE_SUBTASK", "title": "Resolve overdue subtask", "assigneeId": "{{assigneeId}}"}, {"type": "SEND_NOTIFICATION", "notifyRoles": ["assignee"], "channels": ["in_app", "email"]}]',
        '["assignee"]', '["in_app", "email"]', 0, 720, 2, 720, 20, 1, dbo.GetEnvDate(), dbo.GetEnvDate()
    );
    PRINT 'Inserted default escalation: Overdue Subtask';
END
GO

-- ============================================================
-- CRITICAL COVERING INDEXES (Performance)
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Asins_Seller_Status_Synced_Covering' AND object_id = OBJECT_ID('dbo.Asins'))
    CREATE INDEX IX_Asins_Seller_Status_Synced_Covering ON Asins(SellerId, Status, LastScrapedAt DESC) INCLUDE (AsinCode, Title, Price, Bsr, LqsScore, LqsGrade, ImagesCount, MainImageUrl, Category, Brand, Rating, ReviewCount, StockLevel, SoldBy, CurrentPrice, Mrp, SubBsr, SubBSRCategory, TitleScore, BulletScore, ImageScore, DescriptionScore, LQSDetails, TitleIssues, BulletIssues, ImageIssues, DescriptionIssues);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Asins_Seller_Active_Covering' AND object_id = OBJECT_ID('dbo.Asins'))
    CREATE INDEX IX_Asins_Seller_Active_Covering ON Asins(SellerId, Status, CreatedAt DESC) INCLUDE (AsinCode, Title, Price, Bsr, LqsScore, LqsGrade, Category, Sku, MainImageUrl);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ScheduledRunDetails_Run_Seller_Covering' AND object_id = OBJECT_ID('dbo.ScheduledRunDetails'))
    CREATE INDEX IX_ScheduledRunDetails_Run_Seller_Covering ON ScheduledRunDetails(RunId, SellerId) INCLUDE (Status, AsinsCount, ProcessedCount, ErrorMessage, StartTime, EndTime);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AsinHistory_AsinId_Date_Covering' AND object_id = OBJECT_ID('dbo.AsinHistory'))
    CREATE INDEX IX_AsinHistory_AsinId_Date_Covering ON AsinHistory(AsinId, Date DESC) INCLUDE (Price, BSR, Rating, ReviewCount, StockLevel, LQS);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AsinWeekHistory_AsinId_Week_Covering' AND object_id = OBJECT_ID('dbo.AsinWeekHistory'))
    CREATE INDEX IX_AsinWeekHistory_AsinId_Week_Covering ON AsinWeekHistory(AsinId, WeekStartDate DESC) INCLUDE (AvgPrice, AvgBSR, AvgRating, TotalReviews, AvgLQS);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AdsPerformance_Asin_Date_Covering' AND object_id = OBJECT_ID('dbo.AdsPerformance'))
    CREATE INDEX IX_AdsPerformance_Asin_Date_Covering ON AdsPerformance(Asin, Date DESC) INCLUDE (AdSales, AdSpend, Orders, OrganicSales, Impressions, Clicks, ReportType);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_GmsDailyPerformance_Asin_Date_Covering' AND object_id = OBJECT_ID('dbo.GmsDailyPerformance'))
    CREATE INDEX IX_GmsDailyPerformance_Asin_Date_Covering ON GmsDailyPerformance(Asin, Date DESC) INCLUDE (OrderedUnits, OrderedRevenue);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Sellers_Marketplace_Active_Covering' AND object_id = OBJECT_ID('dbo.Sellers'))
    CREATE INDEX IX_Sellers_Marketplace_Active_Covering ON Sellers(Marketplace, IsActive) INCLUDE (Name, Email, OctoparseId, SellerId, LastScrapedAt, CreatedAt);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Actions_AssignedTo_Status_Covering' AND object_id = OBJECT_ID('dbo.Actions'))
    CREATE INDEX IX_Actions_AssignedTo_Status_Covering ON Actions(AssignedTo, Status) INCLUDE (Title, Description, DueDate, Priority, SellerId, CreatedAt);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Alerts_SellerId_CreatedAt_Covering' AND object_id = OBJECT_ID('dbo.Alerts'))
    CREATE INDEX IX_Alerts_SellerId_CreatedAt_Covering ON Alerts(SellerId, CreatedAt DESC) INCLUDE (Severity, Message);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_WebhookLogs_WebhookId_CreatedAt' AND object_id = OBJECT_ID('dbo.WebhookLogs'))
    CREATE INDEX IX_WebhookLogs_WebhookId_CreatedAt ON WebhookLogs(WebhookId, CreatedAt DESC);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Asins_Category_Seller_Covering' AND object_id = OBJECT_ID('dbo.Asins'))
    CREATE INDEX IX_Asins_Category_Seller_Covering ON Asins(Category, SellerId) INCLUDE (AsinCode, Title, Price, BSR, LQS, Status, ImagesCount);

-- Trigger for AsinScrapeData UpdatedAt
IF OBJECT_ID(N'dbo.trg_AsinScrapeData_UpdatedAt', N'TR') IS NOT NULL
    DROP TRIGGER trg_AsinScrapeData_UpdatedAt;
GO

CREATE TRIGGER trg_AsinScrapeData_UpdatedAt
ON AsinScrapeData
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE AsinScrapeData
    SET UpdatedAt = dbo.GetEnvDate()
    FROM AsinScrapeData t
    INNER JOIN inserted i ON t.Id = i.Id;
END;
GO

PRINT '============================================================';
PRINT 'RETAILOPS V2.1 DATABASE INITIALIZATION COMPLETE!';
PRINT '============================================================';
