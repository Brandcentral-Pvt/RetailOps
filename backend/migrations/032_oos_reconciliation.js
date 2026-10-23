/**
 * Migration 032: OOS monitoring & reconciliation engine (draft, seller-scoped).
 *
 * Backs the OOS-RECON-001 workflow. Every durable table is seller scoped. Raw
 * observations keep nullable quantity/status/source/timestamp exactly as
 * received — the engine never converts unknown to zero or blank to "available".
 *
 * Idempotency is enforced in the schema where it matters:
 *   - one run per (RunDate, SellerId)
 *   - one import per legacy (RunId, Channel, SourceType)
 *   - one observation per (RunId, SellerId, Channel, AsinCode, Source)
 *   - one resync job per IdempotencyKey
 *   - one OPEN incident per (SellerId, Channel, AsinCode, EpisodeKey) [filtered]
 *
 * This migration only creates storage. It never activates the template or
 * schedules work.
 */
module.exports = {
  up: async (pool) => {
    const q = (s) => pool.request().query(s);

    // ── Versioned policy ────────────────────────────────────────────────
    await q(`
      IF OBJECT_ID(N'dbo.OosWorkflowPolicies', N'U') IS NULL
      BEGIN
        CREATE TABLE dbo.OosWorkflowPolicies (
          Id VARCHAR(50) NOT NULL PRIMARY KEY,
          Version VARCHAR(20) NOT NULL,
          Name NVARCHAR(200) NOT NULL,
          IsActive BIT NOT NULL DEFAULT 0,
          FreshnessHoursRetailOps INT NOT NULL DEFAULT 24,
          FreshnessHoursUpload INT NOT NULL DEFAULT 48,
          GmsWindowDays INT NOT NULL DEFAULT 30,
          GmsParetoPct DECIMAL(5,2) NOT NULL DEFAULT 80.00,
          OosVocabulary NVARCHAR(MAX) NOT NULL,
          ChannelPolicy NVARCHAR(MAX) NOT NULL,
          CreatedBy VARCHAR(50) NULL,
          CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()
        );
        CREATE UNIQUE INDEX UX_OosWorkflowPolicies_Version ON dbo.OosWorkflowPolicies(Version);
      END
    `);
    // Separate guard so the single-active index is created on existing tables too.
    await q(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_OosWorkflowPolicies_Active' AND object_id = OBJECT_ID('dbo.OosWorkflowPolicies'))
        CREATE UNIQUE INDEX UX_OosWorkflowPolicies_Active ON dbo.OosWorkflowPolicies(IsActive) WHERE IsActive = 1;
    `);

    // ── Runs ────────────────────────────────────────────────────────────
    await q(`
      IF OBJECT_ID(N'dbo.OosRuns', N'U') IS NULL
      BEGIN
        CREATE TABLE dbo.OosRuns (
          Id VARCHAR(50) NOT NULL PRIMARY KEY,
          RunDate DATE NOT NULL,
          MonitoredDate DATE NOT NULL,
          SellerId VARCHAR(50) NOT NULL,
          SellerName NVARCHAR(200) NOT NULL DEFAULT '',
          Channel VARCHAR(30) NOT NULL,
          Status VARCHAR(20) NOT NULL DEFAULT 'OPEN',       -- OPEN | SUBMITTED | CLOSED
          PolicyId VARCHAR(50) NULL,
          PolicyVersion VARCHAR(20) NULL,
          ManifestJson NVARCHAR(MAX) NULL,
          CreatedBy VARCHAR(50) NULL,
          CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
          UpdatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()
        );
        CREATE UNIQUE INDEX UX_OosRuns_Date_Seller ON dbo.OosRuns(RunDate, SellerId);
        CREATE INDEX IX_OosRuns_Seller ON dbo.OosRuns(SellerId);
        CREATE INDEX IX_OosRuns_Status ON dbo.OosRuns(Status);
      END
    `);

    // ── Imports (original uploads) ──────────────────────────────────────
    await q(`
      IF OBJECT_ID(N'dbo.OosImports', N'U') IS NULL
      BEGIN
        CREATE TABLE dbo.OosImports (
          Id VARCHAR(50) NOT NULL PRIMARY KEY,
          RunId VARCHAR(50) NOT NULL,
          SellerId VARCHAR(50) NOT NULL,
          Channel VARCHAR(30) NOT NULL,
          SourceType VARCHAR(30) NOT NULL,                  -- BRANDCENTRAL | VENDORCENTRAL
          FileName NVARCHAR(300) NULL,
          FileHash VARCHAR(128) NULL,
          TotalRows INT NOT NULL DEFAULT 0,
          AcceptedCount INT NOT NULL DEFAULT 0,
          RejectedCount INT NOT NULL DEFAULT 0,
          Status VARCHAR(20) NOT NULL DEFAULT 'RECEIVED',   -- RECEIVED | VALIDATED | REJECTED
          MappingJson NVARCHAR(MAX) NULL,
          ValidationJson NVARCHAR(MAX) NULL,
          CreatedBy VARCHAR(50) NULL,
          CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()
        );
        CREATE UNIQUE INDEX UX_OosImports_Run_Channel_Source ON dbo.OosImports(RunId, Channel, SourceType);
        CREATE INDEX IX_OosImports_Seller ON dbo.OosImports(SellerId);
      END
    `);

    // ── Raw observations (never coerced) ────────────────────────────────
    await q(`
      IF OBJECT_ID(N'dbo.OosObservations', N'U') IS NULL
      BEGIN
        CREATE TABLE dbo.OosObservations (
          Id VARCHAR(50) NOT NULL PRIMARY KEY,
          RunId VARCHAR(50) NOT NULL,
          SellerId VARCHAR(50) NOT NULL,
          Channel VARCHAR(30) NOT NULL,
          AsinCode VARCHAR(50) NOT NULL,
          Sku NVARCHAR(100) NULL,
          FulfillmentType VARCHAR(20) NULL,                 -- FBA | FBF | VENDOR | RETAILOPS
          RawQuantity DECIMAL(18, 4) NULL,                  -- NULL means unknown, never 0
          RawAvailability NVARCHAR(500) NULL,
          RawStatus NVARCHAR(100) NULL,
          Source VARCHAR(30) NOT NULL,                      -- RETAILOPS | BRANDCENTRAL | VENDORCENTRAL
          SourceTimestamp DATETIME2 NULL,
          ImportId VARCHAR(50) NULL,
          LineNumber INT NULL,
          IsValid BIT NOT NULL DEFAULT 1,
          InvalidReason NVARCHAR(500) NULL,
          CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()
        );
        CREATE UNIQUE INDEX UX_OosObservations_Run_Seller_Channel_Asin_Source
          ON dbo.OosObservations(RunId, SellerId, Channel, AsinCode, Source);
        CREATE INDEX IX_OosObservations_Run ON dbo.OosObservations(RunId);
      END
    `);

    // ── Reconciliation decisions ────────────────────────────────────────
    await q(`
      IF OBJECT_ID(N'dbo.OosDecisions', N'U') IS NULL
      BEGIN
        CREATE TABLE dbo.OosDecisions (
          Id VARCHAR(50) NOT NULL PRIMARY KEY,
          RunId VARCHAR(50) NOT NULL,
          SellerId VARCHAR(50) NOT NULL,
          Channel VARCHAR(30) NOT NULL,
          AsinCode VARCHAR(50) NOT NULL,
          Category VARCHAR(40) NOT NULL,
          RuleId VARCHAR(60) NULL,
          Confidence DECIMAL(5,2) NULL,
          IsManual BIT NOT NULL DEFAULT 0,
          Reason NVARCHAR(1000) NULL,
          Revision INT NOT NULL DEFAULT 1,
          EvidenceJson NVARCHAR(MAX) NULL,
          DecidedBy VARCHAR(50) NULL,
          CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
          UpdatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()
        );
        CREATE UNIQUE INDEX UX_OosDecisions_Run_Seller_Channel_Asin
          ON dbo.OosDecisions(RunId, SellerId, Channel, AsinCode);
        CREATE INDEX IX_OosDecisions_Run_Category ON dbo.OosDecisions(RunId, Category);
      END
    `);

    // ── Durable incidents ───────────────────────────────────────────────
    await q(`
      IF OBJECT_ID(N'dbo.OosIncidents', N'U') IS NULL
      BEGIN
        CREATE TABLE dbo.OosIncidents (
          Id VARCHAR(50) NOT NULL PRIMARY KEY,
          SellerId VARCHAR(50) NOT NULL,
          SellerName NVARCHAR(200) NOT NULL DEFAULT '',
          Channel VARCHAR(30) NOT NULL,
          AsinCode VARCHAR(50) NOT NULL,
          EpisodeKey VARCHAR(100) NOT NULL,
          Status VARCHAR(20) NOT NULL DEFAULT 'OPEN',       -- OPEN | RESOLVED | WAIVED
          OwnerId VARCHAR(50) NULL,
          OwnerName NVARCHAR(200) NULL,
          CommunicationStatus VARCHAR(30) NULL,             -- NOT_REQUIRED | PENDING | APPROVED | SENT
          NextAction NVARCHAR(500) NULL,
          EtaDate DATE NULL,
          FollowUpDate DATE NULL,
          OpenedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
          ResolvedAt DATETIME2 NULL,
          ResolvedBy VARCHAR(50) NULL,
          CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
          UpdatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()
        );
        CREATE INDEX IX_OosIncidents_Seller_Status ON dbo.OosIncidents(SellerId, Status);
        CREATE INDEX IX_OosIncidents_Key ON dbo.OosIncidents(SellerId, Channel, AsinCode, EpisodeKey);
      END
    `);
    // One OPEN incident per episode (filtered unique index).
    await q(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_OosIncidents_Open_Episode' AND object_id = OBJECT_ID('dbo.OosIncidents'))
        CREATE UNIQUE INDEX UX_OosIncidents_Open_Episode
          ON dbo.OosIncidents(SellerId, Channel, AsinCode, EpisodeKey) WHERE Status = 'OPEN';
    `);

    // ── Incident events (append-only evidence) ──────────────────────────
    await q(`
      IF OBJECT_ID(N'dbo.OosIncidentEvents', N'U') IS NULL
      BEGIN
        CREATE TABLE dbo.OosIncidentEvents (
          Id VARCHAR(50) NOT NULL PRIMARY KEY,
          IncidentId VARCHAR(50) NOT NULL,
          RunId VARCHAR(50) NULL,
          EventType VARCHAR(40) NOT NULL,                   -- OPENED | EVIDENCE | RESYNC | RESOLVED | WAIVED | NOTE
          DetailJson NVARCHAR(MAX) NULL,
          ActorId VARCHAR(50) NULL,
          CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()
        );
        CREATE INDEX IX_OosIncidentEvents_Incident ON dbo.OosIncidentEvents(IncidentId);
      END
    `);

    // ── Privileged resync jobs ──────────────────────────────────────────
    await q(`
      IF OBJECT_ID(N'dbo.OosResyncJobs', N'U') IS NULL
      BEGIN
        CREATE TABLE dbo.OosResyncJobs (
          Id VARCHAR(50) NOT NULL PRIMARY KEY,
          RunId VARCHAR(50) NOT NULL,
          SellerId VARCHAR(50) NOT NULL,
          Channel VARCHAR(30) NOT NULL,
          AsinCode VARCHAR(50) NOT NULL,
          DiscrepancyRevision INT NOT NULL DEFAULT 1,
          IdempotencyKey VARCHAR(200) NOT NULL,
          Status VARCHAR(30) NOT NULL DEFAULT 'QUEUED',     -- QUEUED | RUNNING | VERIFIED_RECOVERED | OPEN_DISCREPANCY | BLOCKED
          RequestedBy VARCHAR(50) NULL,
          PreStatus NVARCHAR(100) NULL,
          PostStatus NVARCHAR(100) NULL,
          ObservationTime DATETIME2 NULL,
          ResultJson NVARCHAR(MAX) NULL,
          CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
          UpdatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()
        );
        CREATE UNIQUE INDEX UX_OosResyncJobs_Idempotency ON dbo.OosResyncJobs(IdempotencyKey);
        CREATE INDEX IX_OosResyncJobs_Run ON dbo.OosResyncJobs(RunId);
      END
    `);

    // ── Immutable exports ───────────────────────────────────────────────
    await q(`
      IF OBJECT_ID(N'dbo.OosExports', N'U') IS NULL
      BEGIN
        CREATE TABLE dbo.OosExports (
          Id VARCHAR(50) NOT NULL PRIMARY KEY,
          RunId VARCHAR(50) NOT NULL,
          SellerId VARCHAR(50) NOT NULL,
          Version INT NOT NULL DEFAULT 1,
          SheetCount INT NOT NULL DEFAULT 4,
          FileHash VARCHAR(128) NOT NULL,
          ContentJson NVARCHAR(MAX) NOT NULL,
          CreatedBy VARCHAR(50) NULL,
          CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()
        );
        CREATE UNIQUE INDEX UX_OosExports_Run_Version ON dbo.OosExports(RunId, Version);
      END
    `);

    // ── Submission reviews (independent approval) ───────────────────────
    await q(`
      IF OBJECT_ID(N'dbo.OosSubmissionReviews', N'U') IS NULL
      BEGIN
        CREATE TABLE dbo.OosSubmissionReviews (
          Id VARCHAR(50) NOT NULL PRIMARY KEY,
          RunId VARCHAR(50) NOT NULL,
          ReviewerId VARCHAR(50) NOT NULL,
          Status VARCHAR(20) NOT NULL,                      -- APPROVED | REJECTED
          ChecklistJson NVARCHAR(MAX) NULL,
          BlockingReasonsJson NVARCHAR(MAX) NULL,
          CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()
        );
        CREATE INDEX IX_OosSubmissionReviews_Run ON dbo.OosSubmissionReviews(RunId);
      END
    `);

    // ── Seed the default (inactive) policy v1 once ─────────────────────
    await q(`
      IF NOT EXISTS (SELECT 1 FROM dbo.OosWorkflowPolicies)
      BEGIN
        INSERT INTO dbo.OosWorkflowPolicies
          (Id, Version, Name, IsActive, FreshnessHoursRetailOps, FreshnessHoursUpload, GmsWindowDays, GmsParetoPct, OosVocabulary, ChannelPolicy)
        VALUES (
          SUBSTRING(LOWER(REPLACE(CAST(NEWID() AS VARCHAR(36)), '-', '')), 1, 24),
          'v1', 'OOS reconciliation policy v1', 1, 24, 48, 30, 80.00,
          N'{"oosStatuses":["currently unavailable","out of stock","temporarily out of stock","available_date"],"inStockStatuses":["in stock","add to bag"],"lowStockPattern":"^only\\\\s+\\\\d+\\\\s+left in stock"}',
          N'{"amazon.in":{"vendorApplicable":true},"ajio":{"vendorApplicable":false}}'
        );
      END
    `);

    console.log('[Migration 032] ✅ OOS reconciliation tables + policy v1');
  },
};
