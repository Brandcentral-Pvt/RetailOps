/**
 * Migration 006: Playwright Scraper schema
 * Adds persistent storage for the in-house Playwright scraper that replaces Octoparse.
 */
const { sql, getPool } = require('../database/db');

async function up() {
    const pool = await getPool();
    const request = pool.request();

    // 1. AsinScrapeData — latest captured snapshot per ASIN (idempotent upsert in runner)
    // NOTE: schema must match the live table (Asin/Price/AplusDetails…) that the
    // runner + Live Data Inspector persist into — do not rename columns.
    await request.query(`
        IF OBJECT_ID(N'dbo.AsinScrapeData', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.AsinScrapeData (
                Id NVARCHAR(50) PRIMARY KEY,
                Asin NVARCHAR(20) NOT NULL,
                SellerId NVARCHAR(50) NOT NULL,
                Rating DECIMAL(3, 2) NULL,
                ReviewCount INT NULL,
                HasAplus BIT NULL,
                AplusDetails NVARCHAR(MAX) NULL,
                VerifiedAsin NVARCHAR(20) NULL,
                Title NVARCHAR(MAX) NULL,
                Price DECIMAL(18, 2) NULL,
                Mrp DECIMAL(18, 2) NULL,
                BSR INT NULL,
                SubBsr INT NULL,
                RatingBreakdown NVARCHAR(MAX) NULL,
                LastScrapedAt DATETIME2 NULL,
                ScrapeDurationMs INT NULL,
                SavingsAmount DECIMAL(18, 2) NULL,
                DealPrice DECIMAL(18, 2) NULL,
                DealBadge NVARCHAR(1000) NULL,
                SoldBy NVARCHAR(1000) NULL,
                Brand NVARCHAR(510) NULL,
                Category NVARCHAR(MAX) NULL,
                Description NVARCHAR(MAX) NULL,
                BulletPointsText NVARCHAR(MAX) NULL,
                BulletPoints NVARCHAR(MAX) NULL,
                Images NVARCHAR(MAX) NULL,
                MainImage NVARCHAR(MAX) NULL,
                ImagesCount INT NULL,
                DiscountPercentage INT NULL,
                Availability NVARCHAR(MAX) NULL,
                CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
                UpdatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()
            );
            CREATE INDEX IX_AsinScrapeData_Asin ON dbo.AsinScrapeData(Asin);
            CREATE INDEX IX_AsinScrapeData_SellerId ON dbo.AsinScrapeData(SellerId);
        END
    `);
    console.log('[Migration 006] ✅ AsinScrapeData table ensured');

    // 2. ScrapeJobHistory — one row per scrape job
    await request.query(`
        IF OBJECT_ID(N'dbo.ScrapeJobHistory', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.ScrapeJobHistory (
                Id NVARCHAR(50) PRIMARY KEY,
                JobType NVARCHAR(50) NOT NULL DEFAULT 'SCRAPE',
                Status NVARCHAR(20) NOT NULL DEFAULT 'QUEUED',
                TargetType NVARCHAR(20) NOT NULL DEFAULT 'SELLER',
                TargetId NVARCHAR(50) NULL,
                InitiatedBy NVARCHAR(50) NULL,
                TotalAsins INT NOT NULL DEFAULT 0,
                CompletedAsins INT NOT NULL DEFAULT 0,
                FailedAsins INT NOT NULL DEFAULT 0,
                StartedAt DATETIME2 NULL,
                FinishedAt DATETIME2 NULL,
                Error NVARCHAR(MAX) NULL,
                CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
                UpdatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()
            );
            CREATE INDEX IX_ScrapeJobHistory_Status ON dbo.ScrapeJobHistory(Status);
            CREATE INDEX IX_ScrapeJobHistory_TargetId ON dbo.ScrapeJobHistory(TargetId);
            CREATE INDEX IX_ScrapeJobHistory_InitiatedBy ON dbo.ScrapeJobHistory(InitiatedBy);
        END
    `);
    console.log('[Migration 006] ✅ ScrapeJobHistory table ensured');

    // 3. ScrapeJobDetails — per-ASIN results inside a job
    await request.query(`
        IF OBJECT_ID(N'dbo.ScrapeJobDetails', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.ScrapeJobDetails (
                Id NVARCHAR(50) PRIMARY KEY,
                JobId NVARCHAR(50) NOT NULL,
                AsinId NVARCHAR(50) NOT NULL,
                AsinCode NVARCHAR(20) NOT NULL,
                Status NVARCHAR(20) NOT NULL DEFAULT 'PENDING',
                Attempts INT NOT NULL DEFAULT 0,
                Error NVARCHAR(MAX) NULL,
                ScrapedAt DATETIME2 NULL,
                CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
                UpdatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()
            );
            CREATE INDEX IX_ScrapeJobDetails_JobId ON dbo.ScrapeJobDetails(JobId);
            CREATE INDEX IX_ScrapeJobDetails_Status ON dbo.ScrapeJobDetails(Status);
        END
    `);
    console.log('[Migration 006] ✅ ScrapeJobDetails table ensured');

    // 4. Additional Asins columns used by the Playwright scraper (IF NOT EXISTS)
    const columns = [
        ['HasAplus', 'BIT NULL'],
        ['DealPrice', 'DECIMAL(18,2) NULL'],
        ['SavingsAmount', 'DECIMAL(18,2) NULL'],
        ['LastScrapeStatus', 'NVARCHAR(50) NULL'],
        ['LastScrapeError', 'NVARCHAR(MAX) NULL'],
    ];
    for (const [colName, colDef] of columns) {
        await pool.request().query(`
            IF NOT EXISTS (
                SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME = 'Asins' AND COLUMN_NAME = '${colName}'
            )
            BEGIN
                ALTER TABLE Asins ADD ${colName} ${colDef};
            END
        `);
    }
    console.log('[Migration 006] ✅ Asins scraper columns ensured');
}

module.exports = { up };