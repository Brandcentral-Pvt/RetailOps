/**
 * Migration 038: OOS export storage
 *
 * Adds immutable export storage columns to OosExports:
 *   TaskInstanceId: binding to the task instance that authorized the export
 *   FileName: original export file name
 *   FileSize: byte size of stored export
 *   StoragePath: path to private storage (outside web root)
 *   ExportAuditJson: audit metadata (actor, filters, hash, version)
 */
module.exports = {
  up: async (pool) => {
    const q = (s) => pool.request().query(s);

    await q(`
      IF COL_LENGTH('dbo.OosExports', 'TaskInstanceId') IS NULL
        ALTER TABLE dbo.OosExports ADD TaskInstanceId VARCHAR(50) NULL;
    `);
    await q(`
      IF COL_LENGTH('dbo.OosExports', 'FileName') IS NULL
        ALTER TABLE dbo.OosExports ADD FileName NVARCHAR(260) NULL;
    `);
    await q(`
      IF COL_LENGTH('dbo.OosExports', 'FileSize') IS NULL
        ALTER TABLE dbo.OosExports ADD FileSize BIGINT NULL;
    `);
    await q(`
      IF COL_LENGTH('dbo.OosExports', 'StoragePath') IS NULL
        ALTER TABLE dbo.OosExports ADD StoragePath NVARCHAR(500) NULL;
    `);
    await q(`
      IF COL_LENGTH('dbo.OosExports', 'ExportAuditJson') IS NULL
        ALTER TABLE dbo.OosExports ADD ExportAuditJson NVARCHAR(MAX) NULL;
    `);

    console.log('[Migration 038] ✅ OOS export storage columns');
  },
};