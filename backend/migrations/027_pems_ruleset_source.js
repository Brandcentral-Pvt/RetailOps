/**
 * Migration 027: Ruleset source tracking on PEMS task instances.
 *
 * When a ruleset fires and creates a PEMS task, we tag the instance with:
 *   - Source       = 'RULESET' (vs 'MANUAL', 'TEMPLATE', 'IMPORT')
 *   - SourceId     = RulesetId
 *   - SourceRef    = Rule name or rule index
 * These columns let the Tasks page surface automation-generated work, filter
 * by it, and link back to the originating ruleset.
 */
module.exports = {
  up: async (pool) => {
    // Source (RULESET/MANUAL/TEMPLATE/IMPORT)
    await pool.request().query(`
      IF COL_LENGTH('dbo.PemsTaskInstances', 'Source') IS NULL
        ALTER TABLE dbo.PemsTaskInstances ADD Source NVARCHAR(30) NULL;
    `);
    await pool.request().query(`
      IF COL_LENGTH('dbo.PemsTaskInstances', 'SourceId') IS NULL
        ALTER TABLE dbo.PemsTaskInstances ADD SourceId VARCHAR(50) NULL;
    `);
    await pool.request().query(`
      IF COL_LENGTH('dbo.PemsTaskInstances', 'SourceRef') IS NULL
        ALTER TABLE dbo.PemsTaskInstances ADD SourceRef NVARCHAR(200) NULL;
    `);

    // Asins + Category — help ruleset-generated tasks carry the ASIN list and
    // category forward (Listing/Pricing/Inventory/etc.) so the tasks page can
    // filter/group on it.
    await pool.request().query(`
      IF COL_LENGTH('dbo.PemsTaskInstances', 'Asins') IS NULL
        ALTER TABLE dbo.PemsTaskInstances ADD Asins NVARCHAR(MAX) NULL;
    `);
    await pool.request().query(`
      IF COL_LENGTH('dbo.PemsTaskInstances', 'Category') IS NULL
        ALTER TABLE dbo.PemsTaskInstances ADD Category NVARCHAR(50) NULL;
    `);

    // Backfill existing rows created by the legacy rules engine
    // (they were written to the legacy Actions table, not PemsTaskInstances, so
    // PemsTaskInstances defaults to NULL/MANUAL which is correct).

    // Index for fast "all automation-generated tasks" queries.
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PemsTaskInstances_Source')
        CREATE NONCLUSTERED INDEX IX_PemsTaskInstances_Source
          ON dbo.PemsTaskInstances (Source, CreatedAt DESC);
    `);
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PemsTaskInstances_Category')
        CREATE NONCLUSTERED INDEX IX_PemsTaskInstances_Category
          ON dbo.PemsTaskInstances (Category, CreatedAt DESC);
    `);

    console.log('[Migration 027] ✅ Added Source/SourceId/SourceRef to PemsTaskInstances');
  },
};
