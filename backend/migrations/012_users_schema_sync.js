/**
 * Users schema sync : align the (EF-scaffolded) live Users table with the
 * schema the auth code expects, and resync the Password / PasswordHash pair.
 *
 * Runtime queries depend on:
 *   - middleware/auth.js  -> PasswordHash, Password, LoginAttempts, LockUntil,
 *                            LastLoginAt, FailedLoginAttempts, LockedUntil,
 *                            UserStatus, CometChatUid (all exist), plus
 *                            ExtraPermissions / ExcludedPermissions (added here)
 *   - setupWizardService   -> SecurityPolicyAccepted, IsFirstLogin, SetupCompletedAt
 *   - userController       -> ExtraPermissions, ExcludedPermissions, CurrentTeam,
 *                             IsEmailVerified, FirstLoginAt, Preferences
 *
 * Also makes PasswordHash NULL-able (registration INSERTs in userController omit
 * it until password setup), and backfills Password <-> PasswordHash so no
 * account is locked out by an empty/mismatched pairing.
 *
 * Idempotent — safe to run multiple times.
 */
const { sql } = require('../database/db');

// Column-name -> DDL, applied with COL_LENGTH guards (adds only if missing).
const ADD_COLUMNS = [
  ['ExtraPermissions', 'NVARCHAR(MAX) NULL'],
  ['ExcludedPermissions', 'NVARCHAR(MAX) NULL'],
  ['SecurityPolicyAccepted', 'BIT NOT NULL DEFAULT 0'],
  ['CurrentTeam', 'VARCHAR(50) NULL'],
  ['IsEmailVerified', 'BIT NOT NULL DEFAULT 0'],
  ['FirstLoginAt', 'DATETIME2 NULL'],
  ['Preferences', 'NVARCHAR(MAX) NULL'],
];

module.exports = {
  up: async (pool) => {
    // ── 1. Add columns (guard each with COL_LENGTH; names/DDL are static literals) ──
    for (const [name, ddl] of ADD_COLUMNS) {
      await pool.request()
        .input('name', sql.NVarChar, name)
        .query(`
          IF COL_LENGTH('dbo.Users', @name) IS NULL
            ALTER TABLE Users ADD ${name} ${ddl};
        `);
    }

    // ── 2. Make PasswordHash nullable (registration inserts omit it) ──
    await pool.request().query(`
      IF EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='Users' AND COLUMN_NAME='PasswordHash'
          AND IS_NULLABLE='NO'
      )
      BEGIN
        ALTER TABLE Users ALTER COLUMN PasswordHash NVARCHAR(MAX) NULL;
      END
    `);

    // ── 3. Backfill empty / mismatched credential pairs ──
    await pool.request().query(`
      -- hash-only accounts: make them able to log in via Password
      UPDATE Users
      SET Password = PasswordHash
      WHERE Password IS NULL OR LTRIM(RTRIM(Password)) = ''
         AND PasswordHash IS NOT NULL;

      -- password-only accounts: keep hash in sync for compat / future use
      UPDATE Users
      SET PasswordHash = Password
      WHERE PasswordHash IS NULL OR LTRIM(RTRIM(PasswordHash)) = ''
         AND Password IS NOT NULL;
    `);
  },
};