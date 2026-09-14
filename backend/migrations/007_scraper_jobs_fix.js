/**
 * Migration 007: Fix scraper job tables
 * Legacy ScrapeJobHistory/ScrapeJobDetails (pre-reset Octoparse-era schema)
 * survived the reset. Migration 006's IF NOT EXISTS guards skipped them
 * because the tables already existed. Drop the empty legacy tables and
 * recreate with the Playwright-runner schema (006 definition).
 */
const { sql, getPool } = require('../database/db');

async function up() {
    const pool = await getPool();

    // Only fix if the table does not have the runner's columns (CompletedAsins on history).
    const exists = await pool.request().query(`
        SELECT 1 AS found FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'ScrapeJobHistory' AND COLUMN_NAME = 'CompletedAsins'
    `);
    if (!exists.recordset.length) {
        await pool.request().query(`
            IF OBJECT_ID(N'dbo.ScrapeJobDetails', N'U') IS NOT NULL DROP TABLE dbo.ScrapeJobDetails;
            IF OBJECT_ID(N'dbo.ScrapeJobHistory', N'U') IS NOT NULL DROP TABLE dbo.ScrapeJobHistory;

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
        `);
        console.log('[Migration 007] ✅ Recreated ScrapeJobHistory + ScrapeJobDetails with Playwright schema');
    } else {
        console.log('[Migration 007] ⏭️  ScrapeJobHistory already has Playwright schema');
    }
}

module.exports = { up };