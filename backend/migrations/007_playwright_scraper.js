module.exports = {
  async up(pool, sql) {
    const logger = require('../utils/logger');
    // AsinScrapeData table - stores scraped data for ASINs
    await pool.request().query(`
      IF OBJECT_ID(N'dbo.AsinScrapeData', N'U') IS NULL
      BEGIN
        CREATE TABLE AsinScrapeData (
          Id VARCHAR(50) PRIMARY KEY,
          Asin VARCHAR(20) NOT NULL,
          SellerId VARCHAR(50) NOT NULL,
          Rating DECIMAL(3, 2) DEFAULT 0,
          ReviewCount INT DEFAULT 0,
          HasAplus BIT DEFAULT 0,
          AplusDetails NVARCHAR(MAX) NULL,
          VerifiedAsin VARCHAR(20) NULL,
          Title NVARCHAR(MAX) NULL,
          Price DECIMAL(18, 2) DEFAULT 0,
          Mrp DECIMAL(18, 2) DEFAULT 0,
          BSR INT NULL,
          SubBsr INT NULL,
          DiscountPercentage INT DEFAULT 0,
          ImagesCount INT DEFAULT 0,
          MainImage NVARCHAR(MAX) NULL,
          Images NVARCHAR(MAX) NULL,
          BulletPoints NVARCHAR(MAX) NULL,
          BulletPointsText NVARCHAR(MAX) NULL,
          Description NVARCHAR(MAX) NULL,
          Category NVARCHAR(MAX) NULL,
          Brand NVARCHAR(255) NULL,
          Availability NVARCHAR(500) NULL,
          SoldBy NVARCHAR(500) NULL,
          DealBadge NVARCHAR(500) NULL,
          DealPrice DECIMAL(18, 2) DEFAULT 0,
          SavingsAmount DECIMAL(18, 2) DEFAULT 0,
          RatingBreakdown NVARCHAR(MAX) NULL,
          LastScrapedAt DATETIME2 NULL,
          ScrapeDurationMs INT DEFAULT 0,
          CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
          UpdatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()
        );
        
        CREATE UNIQUE INDEX UX_AsinScrapeData_Asin_Seller ON AsinScrapeData(Asin, SellerId);
        CREATE INDEX IX_AsinScrapeData_SellerId ON AsinScrapeData(SellerId);
        CREATE INDEX IX_AsinScrapeData_LastScrapedAt ON AsinScrapeData(LastScrapedAt);
        CREATE INDEX IX_AsinScrapeData_HasAplus ON AsinScrapeData(HasAplus);
      END
    `);

    // ScrapeJobHistory table - tracks scrape job runs
    await pool.request().query(`
      IF OBJECT_ID(N'dbo.ScrapeJobHistory', N'U') IS NULL
      BEGIN
        CREATE TABLE ScrapeJobHistory (
          Id VARCHAR(50) PRIMARY KEY,
          JobId VARCHAR(100) NOT NULL,
          SellerId VARCHAR(50) NOT NULL,
          UserId VARCHAR(50) NULL,
          Status VARCHAR(50) NOT NULL,
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
      END
    `);

    // ScrapeJobDetails table - stores individual ASIN results per job
    await pool.request().query(`
      IF OBJECT_ID(N'dbo.ScrapeJobDetails', N'U') IS NULL
      BEGIN
        CREATE TABLE ScrapeJobDetails (
          Id VARCHAR(50) PRIMARY KEY,
          JobId VARCHAR(100) NOT NULL,
          Asin VARCHAR(20) NOT NULL,
          Success BIT NOT NULL,
          Rating DECIMAL(3, 2) DEFAULT 0,
          ReviewCount INT DEFAULT 0,
          HasAplus BIT DEFAULT 0,
          VerifiedAsin VARCHAR(20) NULL,
          ErrorMessage NVARCHAR(MAX) NULL,
          DurationMs INT DEFAULT 0,
          ScrapedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()
        );
        
        CREATE INDEX IX_ScrapeJobDetails_JobId ON ScrapeJobDetails(JobId);
        CREATE INDEX IX_ScrapeJobDetails_Asin ON ScrapeJobDetails(Asin);
        CREATE INDEX IX_ScrapeJobDetails_Success ON ScrapeJobDetails(Success);
      END
    `);

    // Add columns to Asins table if they don't exist
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = 'Rating' AND Object_ID = OBJECT_ID('Asins'))
        ALTER TABLE Asins ADD Rating DECIMAL(3, 2) DEFAULT 0;
    `);
    
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = 'ReviewCount' AND Object_ID = OBJECT_ID('Asins'))
        ALTER TABLE Asins ADD ReviewCount INT DEFAULT 0;
    `);

    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = 'HasAplus' AND Object_ID = OBJECT_ID('Asins'))
        ALTER TABLE Asins ADD HasAplus BIT DEFAULT 0;
    `);

    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = 'VerifiedAsin' AND Object_ID = OBJECT_ID('Asins'))
        ALTER TABLE Asins ADD VerifiedAsin VARCHAR(20) NULL;
    `);

    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = 'LastScrapedAt' AND Object_ID = OBJECT_ID('Asins'))
        ALTER TABLE Asins ADD LastScrapedAt DATETIME2 NULL;
    `);

    // Add new columns to Asins for full data
    const newColumns = [
        { name: 'Mrp', type: 'DECIMAL(18, 2) DEFAULT 0' },
        { name: 'DiscountPercentage', type: 'INT DEFAULT 0' },
        { name: 'ImagesCount', type: 'INT DEFAULT 0' },
        { name: 'MainImage', type: 'NVARCHAR(MAX) NULL' },
        { name: 'Images', type: 'NVARCHAR(MAX) NULL' },
        { name: 'BulletPoints', type: 'NVARCHAR(MAX) NULL' },
        { name: 'BulletPointsText', type: 'NVARCHAR(MAX) NULL' },
        { name: 'Description', type: 'NVARCHAR(MAX) NULL' },
        { name: 'Category', type: 'NVARCHAR(MAX) NULL' },
        { name: 'Brand', type: 'NVARCHAR(255) NULL' },
        { name: 'Availability', type: 'NVARCHAR(500) NULL' },
        { name: 'SoldBy', type: 'NVARCHAR(500) NULL' },
        { name: 'DealBadge', type: 'NVARCHAR(500) NULL' },
        { name: 'DealPrice', type: 'DECIMAL(18, 2) DEFAULT 0' },
        { name: 'SavingsAmount', type: 'DECIMAL(18, 2) DEFAULT 0' },
        { name: 'SubBsr', type: 'INT NULL' },
    ];

    for (const col of newColumns) {
        await pool.request().query(`
          IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = '${col.name}' AND Object_ID = OBJECT_ID('Asins'))
            ALTER TABLE Asins ADD ${col.name} ${col.type};
        `);
    }

    // Create updated_at trigger for AsinScrapeData
    await pool.request().query(`
      IF OBJECT_ID(N'dbo.trg_AsinScrapeData_UpdatedAt', N'TR') IS NOT NULL
        DROP TRIGGER trg_AsinScrapeData_UpdatedAt;
    `);

    await pool.request().query(`
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
      END
    `);

    logger.info('Playwright scraper migrations applied successfully');
  }
};