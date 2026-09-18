/**
 * TrustedDevices schema sync : make any legacy-shaped table (older
 * init-database.sql: no DeviceId / IsRevoked) match the live EF schema the
 * auth stack (Node trustedDeviceService + .NET TrustedDeviceService) reads
 * and writes: Id nvarchar, DeviceId NOT NULL, IsRevoked NOT NULL, plus
 * UserAgent / CreatedAt when missing. Idempotent.
 */
const { sql } = require('../database/db');

module.exports = {
  up: async (pool) => {
    await pool.request().query(`
      IF OBJECT_ID(N'dbo.TrustedDevices', N'U') IS NOT NULL
      BEGIN
        IF COL_LENGTH('dbo.TrustedDevices', 'DeviceId') IS NULL
          ALTER TABLE TrustedDevices ADD DeviceId NVARCHAR(400) NOT NULL DEFAULT '';

        IF COL_LENGTH('dbo.TrustedDevices', 'IsRevoked') IS NULL
          ALTER TABLE TrustedDevices ADD IsRevoked BIT NOT NULL DEFAULT 0;

        IF COL_LENGTH('dbo.TrustedDevices', 'UserAgent') IS NULL
          ALTER TABLE TrustedDevices ADD UserAgent NVARCHAR(1000) NULL;

        IF COL_LENGTH('dbo.TrustedDevices', 'CreatedAt') IS NULL
          ALTER TABLE TrustedDevices ADD CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate();

        -- Backfill: legacy rows have no DeviceId — derive a stable one.
        UPDATE TrustedDevices
        SET DeviceId = 'dev_' + LEFT(CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', ISNULL(DeviceFingerprint, CONVERT(NVARCHAR(100), NEWID()))), 2), 32)
        WHERE DeviceId IS NULL OR LTRIM(RTRIM(DeviceId)) = '';
      END
    `);
    console.log('013_trusted_devices_schema_sync complete');
  },
};