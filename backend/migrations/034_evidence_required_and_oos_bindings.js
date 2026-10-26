/**
 * Migration 034: Add EvidenceRequired to PemsActivities and OOS task binding enhancements
 *
 * - Adds EvidenceRequired column to PemsActivities
 * - Adds CompletionPolicyKey to PemsSubTasks
 * - Adds OosTaskBindingId to OosIncidents for traceability
 */
module.exports = {
  up: async (pool) => {
    const q = (s) => pool.request().query(s);

    // Add EvidenceRequired to PemsActivities
    await q(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.PemsActivities') AND name = 'EvidenceRequired')
        ALTER TABLE dbo.PemsActivities ADD EvidenceRequired BIT NOT NULL DEFAULT 0;
    `);

    // Add CompletionPolicyKey to PemsSubTasks
    await q(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.PemsSubTasks') AND name = 'CompletionPolicyKey')
        ALTER TABLE dbo.PemsSubTasks ADD CompletionPolicyKey NVARCHAR(100) NULL;
    `);

    // Add OosTaskBindingId to OosIncidents for traceability
    await q(`
      IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.OosIncidents') AND name = 'OosTaskBindingId')
        ALTER TABLE dbo.OosIncidents ADD OosTaskBindingId VARCHAR(50) NULL;
    `);
    await q(`
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_OosIncidents_TaskBinding' AND object_id = OBJECT_ID('dbo.OosIncidents'))
        CREATE INDEX IX_OosIncidents_TaskBinding ON dbo.OosIncidents(OosTaskBindingId);
    `);

    // Note: evidenceRequired population from template JSON is handled in application code
    // when creating new task instances. Existing activities default to 0.

    console.log('[Migration 034] ✅ EvidenceRequired + OOS binding enhancements');
  },
};