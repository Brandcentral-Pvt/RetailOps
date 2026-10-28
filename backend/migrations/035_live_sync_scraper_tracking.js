const { sql, getPool } = require('../database/db');

async function up() {
    const pool = await getPool();

    // Live Sync Runs table - tracks each global live sync run
    await pool.request().query(`
        IF OBJECT_ID(N'dbo.LiveSyncRuns', N'U') IS NULL
        BEGIN
            CREATE TABLE LiveSyncRuns (
                Id VARCHAR(50) PRIMARY KEY,
                RunDate DATE NOT NULL DEFAULT CAST(dbo.GetEnvDate() AS DATE),
                StartTime DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
                EndTime DATETIME2,
                Status VARCHAR(50) NOT NULL, -- 'STARTING', 'RUNNING', 'COMPLETED', 'FAILED', 'ABORTED', 'TIMEOUT'
                TriggerType VARCHAR(50) DEFAULT 'CRON', -- 'CRON', 'MANUAL', 'API'
                TotalSellers INT DEFAULT 0,
                ProcessedSellers INT DEFAULT 0,
                SuccessfulSellers INT DEFAULT 0,
                FailedSellers INT DEFAULT 0,
                TotalAsins INT DEFAULT 0,
                UpdatedAsins INT DEFAULT 0,
                FailedAsins INT DEFAULT 0,
                SkippedAsins INT DEFAULT 0,
                ErrorMessage NVARCHAR(MAX),
                DetailsJson NVARCHAR(MAX), -- JSON with per-seller details
                CreatedBy VARCHAR(50) DEFAULT 'system',
                CreatedAt DATETIME2 DEFAULT dbo.GetEnvDate(),
                UpdatedAt DATETIME2 DEFAULT dbo.GetEnvDate()
            );
            CREATE INDEX IX_LiveSyncRuns_RunDate ON LiveSyncRuns(RunDate DESC);
            CREATE INDEX IX_LiveSyncRuns_Status ON LiveSyncRuns(Status);
            CREATE INDEX IX_LiveSyncRuns_CreatedAt ON LiveSyncRuns(CreatedAt DESC);
        END
    `);

    // Live Sync Seller Details table - per-seller tracking within a run
    await pool.request().query(`
        IF OBJECT_ID(N'dbo.LiveSyncSellerDetails', N'U') IS NULL
        BEGIN
            CREATE TABLE LiveSyncSellerDetails (
                Id VARCHAR(50) PRIMARY KEY,
                RunId VARCHAR(50) NOT NULL,
                SellerId VARCHAR(50) NOT NULL,
                SellerName NVARCHAR(255),
                Marketplace VARCHAR(100),
                StartTime DATETIME2 DEFAULT dbo.GetEnvDate(),
                EndTime DATETIME2,
                Status VARCHAR(50) NOT NULL, -- 'PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED'
                Attempt INT DEFAULT 1,
                MaxRetries INT DEFAULT 2,
                TotalAsins INT DEFAULT 0,
                UpdatedAsins INT DEFAULT 0,
                FailedAsins INT DEFAULT 0,
                SkippedAsins INT DEFAULT 0,
                ErrorMessage NVARCHAR(MAX),
                AsinsJson NVARCHAR(MAX), -- JSON array of ASINs processed
                CreatedAt DATETIME2 DEFAULT dbo.GetEnvDate(),
                UpdatedAt DATETIME2 DEFAULT dbo.GetEnvDate(),
                CONSTRAINT FK_LiveSyncSellerDetails_Run FOREIGN KEY (RunId) REFERENCES LiveSyncRuns(Id)
            );
            CREATE INDEX IX_LiveSyncSellerDetails_RunId ON LiveSyncSellerDetails(RunId);
            CREATE INDEX IX_LiveSyncSellerDetails_SellerId ON LiveSyncSellerDetails(SellerId);
            CREATE INDEX IX_LiveSyncSellerDetails_Status ON LiveSyncSellerDetails(Status);
        END
    `);

    // Scraper Runs table - tracks Playwright scraper runs
    await pool.request().query(`
        IF OBJECT_ID(N'dbo.ScraperRuns', N'U') IS NULL
        BEGIN
            CREATE TABLE ScraperRuns (
                Id VARCHAR(50) PRIMARY KEY,
                RunDate DATE NOT NULL DEFAULT CAST(dbo.GetEnvDate() AS DATE),
                StartTime DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
                EndTime DATETIME2,
                Status VARCHAR(50) NOT NULL, -- 'STARTING', 'RUNNING', 'COMPLETED', 'FAILED', 'ABORTED', 'TIMEOUT'
                TriggerType VARCHAR(50) DEFAULT 'CRON', -- 'CRON', 'MANUAL', 'API'
                Marketplace VARCHAR(50) DEFAULT 'amazon.in', -- 'amazon.in', 'ajio'
                TotalSellers INT DEFAULT 0,
                ProcessedSellers INT DEFAULT 0,
                CompleteSellers INT DEFAULT 0,
                IncompleteSellers INT DEFAULT 0,
                TotalJobs INT DEFAULT 0,
                TotalAsinsScraped INT DEFAULT 0,
                ErrorMessage NVARCHAR(MAX),
                DetailsJson NVARCHAR(MAX), -- JSON with per-seller details
                CreatedBy VARCHAR(50) DEFAULT 'system',
                CreatedAt DATETIME2 DEFAULT dbo.GetEnvDate(),
                UpdatedAt DATETIME2 DEFAULT dbo.GetEnvDate()
            );
            CREATE INDEX IX_ScraperRuns_RunDate ON ScraperRuns(RunDate DESC);
            CREATE INDEX IX_ScraperRuns_Status ON ScraperRuns(Status);
            CREATE INDEX IX_ScraperRuns_CreatedAt ON ScraperRuns(CreatedAt DESC);
        END
    `);

    // Scraper Seller Details table - per-seller tracking within a scraper run
    await pool.request().query(`
        IF OBJECT_ID(N'dbo.ScraperSellerDetails', N'U') IS NULL
        BEGIN
            CREATE TABLE ScraperSellerDetails (
                Id VARCHAR(50) PRIMARY KEY,
                RunId VARCHAR(50) NOT NULL,
                SellerId VARCHAR(50) NOT NULL,
                SellerName NVARCHAR(255),
                Marketplace VARCHAR(100),
                StartTime DATETIME2 DEFAULT dbo.GetEnvDate(),
                EndTime DATETIME2,
                Status VARCHAR(50) NOT NULL, -- 'PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED'
                Attempt INT DEFAULT 1,
                MaxAttempts INT DEFAULT 3,
                TotalAsins INT DEFAULT 0,
                ScrapedAsins INT DEFAULT 0,
                FailedAsins INT DEFAULT 0,
                CompleteAsins INT DEFAULT 0,
                IncompleteAsins INT DEFAULT 0,
                JobsCount INT DEFAULT 0,
                MissingFieldsJson NVARCHAR(MAX), -- JSON breakdown of missing fields
                ErrorMessage NVARCHAR(MAX),
                AsinsJson NVARCHAR(MAX), -- JSON array of ASINs processed
                CreatedAt DATETIME2 DEFAULT dbo.GetEnvDate(),
                UpdatedAt DATETIME2 DEFAULT dbo.GetEnvDate(),
                CONSTRAINT FK_ScraperSellerDetails_Run FOREIGN KEY (RunId) REFERENCES ScraperRuns(Id)
            );
            CREATE INDEX IX_ScraperSellerDetails_RunId ON ScraperSellerDetails(RunId);
            CREATE INDEX IX_ScraperSellerDetails_SellerId ON ScraperSellerDetails(SellerId);
            CREATE INDEX IX_ScraperSellerDetails_Status ON ScraperSellerDetails(Status);
        END
    `);

    // Scraper Jobs table - individual scraper jobs within a seller
    await pool.request().query(`
        IF OBJECT_ID(N'dbo.ScraperJobs', N'U') IS NULL
        BEGIN
            CREATE TABLE ScraperJobs (
                Id VARCHAR(50) PRIMARY KEY,
                RunId VARCHAR(50) NOT NULL,
                SellerDetailId VARCHAR(50) NOT NULL,
                SellerId VARCHAR(50) NOT NULL,
                JobId VARCHAR(100), -- Playwright job ID
                Attempt INT DEFAULT 1,
                StartTime DATETIME2 DEFAULT dbo.GetEnvDate(),
                EndTime DATETIME2,
                Status VARCHAR(50) NOT NULL, -- 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'
                AsinsRequested INT DEFAULT 0,
                AsinsCompleted INT DEFAULT 0,
                AsinsFailed INT DEFAULT 0,
                ErrorMessage NVARCHAR(MAX),
                CreatedAt DATETIME2 DEFAULT dbo.GetEnvDate(),
                UpdatedAt DATETIME2 DEFAULT dbo.GetEnvDate(),
                CONSTRAINT FK_ScraperJobs_Run FOREIGN KEY (RunId) REFERENCES ScraperRuns(Id),
                CONSTRAINT FK_ScraperJobs_SellerDetail FOREIGN KEY (SellerDetailId) REFERENCES ScraperSellerDetails(Id)
            );
            CREATE INDEX IX_ScraperJobs_RunId ON ScraperJobs(RunId);
            CREATE INDEX IX_ScraperJobs_SellerDetailId ON ScraperJobs(SellerDetailId);
            CREATE INDEX IX_ScraperJobs_JobId ON ScraperJobs(JobId);
            CREATE INDEX IX_ScraperJobs_Status ON ScraperJobs(Status);
        END
    `);

    console.log('✅ LiveSyncRuns, LiveSyncSellerDetails, ScraperRuns, ScraperSellerDetails, ScraperJobs tables created/verified');
}

async function down() {
    const pool = await getPool();
    await pool.request().query(`
        IF OBJECT_ID(N'dbo.ScraperJobs', N'U') IS NOT NULL DROP TABLE ScraperJobs;
        IF OBJECT_ID(N'dbo.ScraperSellerDetails', N'U') IS NOT NULL DROP TABLE ScraperSellerDetails;
        IF OBJECT_ID(N'dbo.ScraperRuns', N'U') IS NOT NULL DROP TABLE ScraperRuns;
        IF OBJECT_ID(N'dbo.LiveSyncSellerDetails', N'U') IS NOT NULL DROP TABLE LiveSyncSellerDetails;
        IF OBJECT_ID(N'dbo.LiveSyncRuns', N'U') IS NOT NULL DROP TABLE LiveSyncRuns;
    `);
    console.log('🗑️ Tracking tables dropped');
}

module.exports = { up, down };