/**
 * 020 — recreate tables the f5cdc6b Node code reads but that are missing from
 * the EF-scaffolded live DB (schema derived from the actual SQL in the code).
 *
 * Idempotent: each table is created only when missing; indexes likewise.
 *
 * Referenced PK types in the live DB (resolved at design time):
 *   Users.Id     varchar(50)   Sellers.Id  varchar(50)
 *   Asins.Id     varchar(24)   Pems*.Id    varchar(50)
 */
module.exports = {
  up: async (pool) => {
    const { tableExists } = require('./_helpers');

    async function createIfMissing(name, createSql) {
      if (await tableExists(pool, name)) {
        console.log(`  - skip ${name} (exists)`);
        return false;
      }
      await pool.request().query(createSql);
      console.log(`  + created ${name}`);
      return true;
    }

    await createIfMissing('UserSupervisors', `
      CREATE TABLE UserSupervisors (
        UserId VARCHAR(50) NOT NULL,
        SupervisorId VARCHAR(50) NOT NULL,
        CONSTRAINT PK_UserSupervisors PRIMARY KEY (UserId, SupervisorId),
        CONSTRAINT FK_UserSupervisors_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
        CONSTRAINT FK_UserSupervisors_Supervisor FOREIGN KEY (SupervisorId) REFERENCES Users(Id)
      );
      CREATE INDEX IX_UserSupervisors_Supervisor ON UserSupervisors(SupervisorId);
      CREATE INDEX IX_UserSupervisors_User ON UserSupervisors(UserId);
    `);

    await createIfMissing('UserBrandManagers', `
      CREATE TABLE UserBrandManagers (
        UserId VARCHAR(50) NOT NULL,
        BrandManagerId VARCHAR(50) NOT NULL,
        CONSTRAINT PK_UserBrandManagers PRIMARY KEY (UserId, BrandManagerId),
        CONSTRAINT FK_UserBrandManagers_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
        CONSTRAINT FK_UserBrandManagers_BrandManager FOREIGN KEY (BrandManagerId) REFERENCES Users(Id)
      );
      CREATE INDEX IX_UserBrandManagers_BrandManager ON UserBrandManagers(BrandManagerId);
    `);

    await createIfMissing('Teams', `
      CREATE TABLE Teams (
        Id VARCHAR(50) PRIMARY KEY,
        Name NVARCHAR(255) NOT NULL,
        Description NVARCHAR(MAX) NULL,
        ManagerId VARCHAR(50) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        CONSTRAINT FK_Teams_Manager FOREIGN KEY (ManagerId) REFERENCES Users(Id) ON DELETE SET NULL
      );
    `);

    await createIfMissing('TeamMembers', `
      CREATE TABLE TeamMembers (
        TeamId VARCHAR(50) NOT NULL,
        UserId VARCHAR(50) NOT NULL,
        Role NVARCHAR(50) NOT NULL DEFAULT 'member',
        ResourceAccess NVARCHAR(MAX) NULL,
        UpdatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        CONSTRAINT PK_TeamMembers PRIMARY KEY (TeamId, UserId),
        CONSTRAINT FK_TeamMembers_Team FOREIGN KEY (TeamId) REFERENCES Teams(Id) ON DELETE CASCADE,
        CONSTRAINT FK_TeamMembers_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
      );
      CREATE INDEX IX_TeamMembers_User ON TeamMembers(UserId);
    `);

    await createIfMissing('PredefinedTags', `
      CREATE TABLE PredefinedTags (
        Id VARCHAR(50) PRIMARY KEY,
        Name NVARCHAR(80) NOT NULL,
        Category NVARCHAR(50) NULL DEFAULT 'General',
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        CONSTRAINT UQ_PredefinedTags_Name UNIQUE (Name)
      );
      CREATE INDEX IX_PredefinedTags_Category ON PredefinedTags(Category);
    `);

    await createIfMissing('SystemSettings', `
      CREATE TABLE SystemSettings (
        [Key] NVARCHAR(255) PRIMARY KEY,
        Value NVARCHAR(MAX) NOT NULL,
        Description NVARCHAR(500) NULL,
        UpdatedBy VARCHAR(50) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()
      );
    `);

    await createIfMissing('Rulesets', `
      CREATE TABLE Rulesets (
        Id VARCHAR(50) PRIMARY KEY,
        Name NVARCHAR(255) NOT NULL,
        Description NVARCHAR(MAX) NULL,
        Rules NVARCHAR(MAX) NOT NULL DEFAULT '[]',
        Conditions NVARCHAR(MAX) NOT NULL DEFAULT '{}',
        Actions NVARCHAR(MAX) NOT NULL DEFAULT '[]',
        CreatedBy VARCHAR(50) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        Type VARCHAR(50) NOT NULL DEFAULT 'ASIN',
        SellerId VARCHAR(50) NULL,
        UsingDataFrom VARCHAR(50) NOT NULL DEFAULT 'Last 14 days',
        ExcludeDays VARCHAR(50) NOT NULL DEFAULT 'Latest day',
        IsAutomated BIT NOT NULL DEFAULT 0,
        RunFrequency VARCHAR(50) NOT NULL DEFAULT 'Daily',
        RunTime VARCHAR(50) NOT NULL DEFAULT '08 AM',
        Scope NVARCHAR(MAX) NOT NULL DEFAULT '{"applyTo":"all"}',
        ConflictResolution VARCHAR(50) NOT NULL DEFAULT 'first',
        EmailOnRun BIT NOT NULL DEFAULT 0,
        EmailOnAction BIT NOT NULL DEFAULT 0,
        EmailAddress NVARCHAR(255) NULL,
        LastRunAt DATETIME2 NULL,
        TotalRunCount INT NULL DEFAULT 0,
        LastRunSummary NVARCHAR(MAX) NULL,
        CONSTRAINT FK_Rulesets_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES Users(Id) ON DELETE SET NULL
      );
      CREATE INDEX IX_Rulesets_Seller ON Rulesets(SellerId);
    `);

    await createIfMissing('RulesetExecutionLogs', `
      CREATE TABLE RulesetExecutionLogs (
        Id VARCHAR(50) PRIMARY KEY,
        RulesetId VARCHAR(50) NOT NULL,
        ExecutedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        TriggeredBy NVARCHAR(255) NULL,
        Status NVARCHAR(50) NOT NULL DEFAULT 'SUCCESS',
        MatchedCount INT NULL DEFAULT 0,
        ActionedCount INT NULL DEFAULT 0,
        ErrorMessage NVARCHAR(MAX) NULL,
        CONSTRAINT FK_RulesetExecutionLogs_Ruleset FOREIGN KEY (RulesetId) REFERENCES Rulesets(Id) ON DELETE CASCADE
      );
      CREATE INDEX IX_RulesetExecutionLogs_Ruleset ON RulesetExecutionLogs(RulesetId, ExecutedAt DESC);
    `);

    await createIfMissing('TagsHistory', `
      CREATE TABLE TagsHistory (
        Id VARCHAR(50) PRIMARY KEY,
        AsinId VARCHAR(24) NOT NULL,
        UserId VARCHAR(50) NULL,
        UserName NVARCHAR(255) NULL DEFAULT 'System',
        PreviousTags NVARCHAR(MAX) NULL,
        NewTags NVARCHAR(MAX) NULL,
        AddedTags NVARCHAR(MAX) NULL,
        RemovedTags NVARCHAR(MAX) NULL,
        Action NVARCHAR(100) NULL,
        Source NVARCHAR(100) NULL DEFAULT 'manual',
        Notes NVARCHAR(500) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        CONSTRAINT FK_TagsHistory_Asin FOREIGN KEY (AsinId) REFERENCES Asins(Id) ON DELETE CASCADE,
        CONSTRAINT FK_TagsHistory_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE SET NULL
      );
      CREATE INDEX IX_TagsHistory_Asin_Created ON TagsHistory(AsinId, CreatedAt DESC);
    `);

    await createIfMissing('SetupWizardProgress', `
      CREATE TABLE SetupWizardProgress (
        UserId VARCHAR(50) NOT NULL,
        StepName NVARCHAR(100) NOT NULL,
        Status NVARCHAR(20) NOT NULL DEFAULT 'PENDING',
        CompletedAt DATETIME2 NULL,
        CONSTRAINT PK_SetupWizardProgress PRIMARY KEY (UserId, StepName),
        CONSTRAINT FK_SetupWizardProgress_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
      );
    `);

    await createIfMissing('SubBsrHistory', `
      CREATE TABLE SubBsrHistory (
        Id VARCHAR(50) PRIMARY KEY,
        AsinId VARCHAR(24) NOT NULL,
        Date DATETIME2 NOT NULL,
        SubBsrCategory NVARCHAR(255) NULL,
        SubBsrRank INT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        CONSTRAINT FK_SubBsrHistory_Asin FOREIGN KEY (AsinId) REFERENCES Asins(Id) ON DELETE CASCADE
      );
      CREATE INDEX IX_SubBsrHistory_Asin_Date ON SubBsrHistory(AsinId, Date DESC);
    `);

    await createIfMissing('PemsActivities', `
      CREATE TABLE PemsActivities (
        Id VARCHAR(50) PRIMARY KEY,
        SubTaskId VARCHAR(50) NOT NULL,
        TaskInstanceId VARCHAR(50) NOT NULL,
        StepNo INT NOT NULL DEFAULT 1,
        Title NVARCHAR(300) NOT NULL,
        Instructions NVARCHAR(MAX) NULL,
        ExpectedOutput NVARCHAR(500) NULL,
        SupportDocuments NVARCHAR(MAX) NULL,
        IsMandatory BIT NOT NULL DEFAULT 1,
        IsCompleted BIT NOT NULL DEFAULT 0,
        CompletedAt DATETIME2 NULL,
        CompletedBy VARCHAR(50) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        CONSTRAINT FK_PemsActivity_SubTask FOREIGN KEY (SubTaskId) REFERENCES PemsSubTasks(Id) ON DELETE CASCADE,
        CONSTRAINT FK_PemsActivity_Instance FOREIGN KEY (TaskInstanceId) REFERENCES PemsTaskInstances(Id)
      );
      CREATE NONCLUSTERED INDEX IX_PemsActivity_Instance ON PemsActivities(TaskInstanceId);
    `);

    return {};
  },
};