/**
 * Migration 033: Task View Definitions + OOS Task/Run Bindings
 *
 * Adds versioned Task View Definitions tied to templates, immutable snapshots on task
 * instances, and durable PEMS task <-> OOS run bindings for multi-brand tasks.
 *
 * Idempotent forward-only; existing data preserved.
 */

module.exports = {
  up: async (pool) => {
    const q = (s) => pool.request().query(s);

    // ── Task View Definitions ──────────────────────────────────────────
    await q(`
      IF OBJECT_ID(N'dbo.PemsTemplateViewDefinitions', N'U') IS NULL
      BEGIN
        CREATE TABLE dbo.PemsTemplateViewDefinitions (
          Id VARCHAR(50) NOT NULL PRIMARY KEY,
          TemplateId VARCHAR(50) NOT NULL,
          ViewKey VARCHAR(50) NOT NULL,
          SchemaVersion VARCHAR(20) NOT NULL,
          DefinitionVersion INT NOT NULL,
          DefinitionJson NVARCHAR(MAX) NOT NULL,
          Status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',  -- DRAFT | PUBLISHED
          CreatedBy VARCHAR(50) NULL,
          CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
          PublishedAt DATETIME2 NULL,
          PublishedBy VARCHAR(50) NULL
        );
        CREATE UNIQUE INDEX UX_PemsTemplateViewDef_Template_Key_Version
          ON dbo.PemsTemplateViewDefinitions(TemplateId, ViewKey, DefinitionVersion);
        CREATE INDEX IX_PemsTemplateViewDef_Template_Status
          ON dbo.PemsTemplateViewDefinitions(TemplateId, Status);
      END
    `);

    // ── Task Instance View Definition Link ─────────────────────────────
    // Add columns to PemsTaskInstances if they don't exist
    await q(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.PemsTaskInstances') AND name = 'ViewDefinitionId')
        ALTER TABLE dbo.PemsTaskInstances ADD ViewDefinitionId VARCHAR(50) NULL;
    `);
    await q(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.PemsTaskInstances') AND name = 'ViewDefinitionSnapshot')
        ALTER TABLE dbo.PemsTaskInstances ADD ViewDefinitionSnapshot NVARCHAR(MAX) NULL;
    `);

    // ── OOS Task/Run Bindings ──────────────────────────────────────────
    await q(`
      IF OBJECT_ID(N'dbo.OosTaskBindings', N'U') IS NULL
      BEGIN
        CREATE TABLE dbo.OosTaskBindings (
          Id VARCHAR(50) NOT NULL PRIMARY KEY,
          TaskInstanceId VARCHAR(50) NOT NULL,
          OosRunId VARCHAR(50) NOT NULL,
          SellerId VARCHAR(50) NOT NULL,
          Channel VARCHAR(30) NOT NULL,
          State VARCHAR(20) NOT NULL DEFAULT 'OPEN',  -- OPEN | RECONCILED | SUBMITTED | CLOSED
          CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
          UpdatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()
        );
        CREATE UNIQUE INDEX UX_OosTaskBindings_Task_Seller_Channel
          ON dbo.OosTaskBindings(TaskInstanceId, SellerId, Channel);
        CREATE INDEX IX_OosTaskBindings_Task ON dbo.OosTaskBindings(TaskInstanceId);
        CREATE INDEX IX_OosTaskBindings_Run ON dbo.OosTaskBindings(OosRunId);
      END
    `);

    // ── Extend OosRuns with TaskInstanceId ─────────────────────────────
    await q(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.OosRuns') AND name = 'TaskInstanceId')
        ALTER TABLE dbo.OosRuns ADD TaskInstanceId VARCHAR(50) NULL;
    `);
    await q(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_OosRuns_TaskInstance' AND object_id = OBJECT_ID('dbo.OosRuns'))
        CREATE INDEX IX_OosRuns_TaskInstance ON dbo.OosRuns(TaskInstanceId);
    `);

    // ── Extend OosUploads with original file metadata ──────────────────
    await q(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.OosImports') AND name = 'OriginalFileHash')
        ALTER TABLE dbo.OosImports ADD OriginalFileHash VARCHAR(128) NULL;
    `);
    await q(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.OosImports') AND name = 'OriginalFileName')
        ALTER TABLE dbo.OosImports ADD OriginalFileName NVARCHAR(500) NULL;
    `);
    await q(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.OosImports') AND name = 'OriginalFileSize')
        ALTER TABLE dbo.OosImports ADD OriginalFileSize BIGINT NULL;
    `);
    await q(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.OosImports') AND name = 'OriginalFileContentType')
        ALTER TABLE dbo.OosImports ADD OriginalFileContentType NVARCHAR(100) NULL;
    `);
    await q(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.OosImports') AND name = 'OriginalFileStoragePath')
        ALTER TABLE dbo.OosImports ADD OriginalFileStoragePath NVARCHAR(500) NULL;
    `);
    await q(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.OosImports') AND name = 'ParserVersion')
        ALTER TABLE dbo.OosImports ADD ParserVersion VARCHAR(20) NULL;
    `);
    await q(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.OosImports') AND name = 'UploadRevision')
        ALTER TABLE dbo.OosImports ADD UploadRevision INT NOT NULL DEFAULT 1;
    `);
    await q(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.OosImports') AND name = 'ParentImportId')
        ALTER TABLE dbo.OosImports ADD ParentImportId VARCHAR(50) NULL;
    `);

    // ── Extend OosExports with task binding and manifest ───────────────
    await q(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.OosExports') AND name = 'TaskInstanceId')
        ALTER TABLE dbo.OosExports ADD TaskInstanceId VARCHAR(50) NULL;
    `);
    await q(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.OosExports') AND name = 'ExportManifestJson')
        ALTER TABLE dbo.OosExports ADD ExportManifestJson NVARCHAR(MAX) NULL;
    `);
    await q(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_OosExports_TaskInstance' AND object_id = OBJECT_ID('dbo.OosExports'))
        CREATE INDEX IX_OosExports_TaskInstance ON dbo.OosExports(TaskInstanceId);
    `);

    // ── Extend OosSubmissionReviews for independent reviewer flow ──────
    await q(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.OosSubmissionReviews') AND name = 'ReviewerUserId')
        ALTER TABLE dbo.OosSubmissionReviews ADD ReviewerUserId VARCHAR(50) NULL;
    `);
    await q(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.OosSubmissionReviews') AND name = 'DecisionActorId')
        ALTER TABLE dbo.OosSubmissionReviews ADD DecisionActorId VARCHAR(50) NULL;
    `);

    // ── Seed default STANDARD_V1 view definition for existing templates ─
    await q(`
      IF NOT EXISTS (SELECT 1 FROM dbo.PemsTemplateViewDefinitions)
      BEGIN
        DECLARE @templateIds TABLE (Id VARCHAR(50));
        INSERT INTO @templateIds
        SELECT Id FROM PemsTaskTemplates WHERE IsActive = 1;

        DECLARE @id VARCHAR(50), @tid VARCHAR(50);
        DECLARE cur CURSOR FOR SELECT Id FROM @templateIds;
        OPEN cur;
        FETCH NEXT FROM cur INTO @tid;
        WHILE @@FETCH_STATUS = 0
        BEGIN
          SET @id = SUBSTRING(LOWER(REPLACE(CAST(NEWID() AS VARCHAR(36)), '-', '')), 1, 24);
          INSERT INTO dbo.PemsTemplateViewDefinitions
            (Id, TemplateId, ViewKey, SchemaVersion, DefinitionVersion, DefinitionJson, Status, CreatedAt)
          VALUES (
            @id, @tid, 'STANDARD_V1', '1.0', 1,
            N'{"viewKey":"STANDARD_V1","schemaVersion":"1.0","definitionVersion":1,"tabs":[{"key":"overview","label":"Overview","widgetKey":null},{"key":"sop","label":"SOP","widgetKey":"SopExecution"},{"key":"asins","label":"Affected ASINs","widgetKey":null},{"key":"evidence","label":"Evidence","widgetKey":null},{"key":"comments","label":"Discussion","widgetKey":null},{"key":"activity","label":"Activity","widgetKey":null},{"key":"review","label":"Review","widgetKey":"ReviewPanel"}],"roleViews":{"executor":{"tabs":["overview","sop","asins","evidence","comments","activity","review"]},"reviewer":{"tabs":["overview","sop","asins","evidence","comments","activity","review"]},"manager":{"tabs":["overview","sop","asins","evidence","comments","activity","review"]}},"requiredOutputs":["sop_completion","evidence_upload"]}',
            'PUBLISHED', GETUTCDATE()
          );
          FETCH NEXT FROM cur INTO @tid;
        END
        CLOSE cur;
        DEALLOCATE cur;
      END
    `);

    console.log('[Migration 033] ✅ Task View Definitions + OOS Task/Run Bindings');
  },
};