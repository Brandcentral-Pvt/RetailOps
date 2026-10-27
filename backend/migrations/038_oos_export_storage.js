/**
 * Migration 038: OOS export storage
 *
 * Adds immutable export storage columns to OosExports:
 *   - TaskInstanceId: binding to the task instance that authorized the export
 *   - FileName: original export file name
 *   - FileSize: byte size of stored export
 *   - StoragePath: path to private storage (outside web root)
 *   - ExportAuditJson: audit metadata (actor, filters, row counts)
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { sequelize } = queryInterface;
    const query = async (sql) => {
      const [results] = await sequelize.query(sql);
      return results;
    };

    // TaskInstanceId - binding to the task instance
    await query(`
      IF COL_LENGTH('dbo.OosExports', 'TaskInstanceId') IS NULL
        ALTER TABLE dbo.OosExports ADD TaskInstanceId VARCHAR(50) NULL;
    `);

    // FileName - original export file name
    await query(`
      IF COL_LENGTH('dbo.OosExports', 'FileName') IS NULL
        ALTER TABLE dbo.OosExports ADD FileName NVARCHAR(260) NULL;
    `);

    // FileSize - byte size of stored export
    await query(`
      IF COL_LENGTH('dbo.OosExports', 'FileSize') IS NULL
        ALTER TABLE dbo.OosExports ADD FileSize BIGINT NULL;
    `);

    // StoragePath - private storage path outside web root
    await query(`
      IF COL_LENGTH('dbo.OosExports', 'StoragePath') IS NULL
        ALTER TABLE dbo.OosExports ADD StoragePath NVARCHAR(500) NULL;
    `);

    // ExportAuditJson - audit metadata
    await query(`
      IF COL_LENGTH('dbo.OosExports', 'ExportAuditJson') IS NULL
        ALTER TABLE dbo.OosExports ADD ExportAuditJson NVARCHAR(MAX) NULL;
    `);

    console.log('[Migration 038] OOS export storage columns added');
  },

  down: async (queryInterface, Sequelize) => {
    const { sequelize } = queryInterface;
    const query = async (sql) => {
      const [results] = await sequelize.query(sql);
      return results;
    };

    await query(`IF COL_LENGTH('dbo.OosExports', 'ExportAuditJson') IS NOT NULL ALTER TABLE dbo.OosExports DROP COLUMN ExportAuditJson;`);
    await query(`IF COL_LENGTH('dbo.OosExports', 'StoragePath') IS NOT NULL ALTER TABLE dbo.OosExports DROP COLUMN StoragePath;`);
    await query(`IF COL_LENGTH('dbo.OosExports', 'FileSize') IS NOT NULL ALTER TABLE dbo.OosExports DROP COLUMN FileSize;`);
    await query(`IF COL_LENGTH('dbo.OosExports', 'FileName') IS NOT NULL ALTER TABLE dbo.OosExports DROP COLUMN FileName;`);
    await query(`IF COL_LENGTH('dbo.OosExports', 'TaskInstanceId') IS NOT NULL ALTER TABLE dbo.OosExports DROP COLUMN TaskInstanceId;`);

    console.log('[Migration 038] Rolled back OOS export storage');
  }
};
