/**
 * Migration 043: Ads Intelligence module extensions.
 *
 * Adds tables for:
 *   - UserAdsSavedViews   — per-user saved filter presets for the Ads Manager
 *   - AdsFlags            — per-user ASIN flags (waste, high_acos, watchlist, …)
 *   - UserAdsPreferences  — per-user Ads module UI preferences (columns, theme)
 *
 * All tables are scoped by UserId → Users.Id so a user can only read/write
 * their own rows. Created only when missing, following the repo's migration
 * helper pattern (_helpers.js createTableIfMissing).
 *
 * NOTE: DATETIME2 defaults are set in the controller INSERT statements
 *       (dbo.GetEnvDate()) because the createTableIfMissing helper does not
 *       emit DEFAULT constraints.
 */

const { createTableIfMissing } = require('./_helpers');

module.exports = async (pool, sql) => {
  // ── UserAdsSavedViews ─────────────────────────────────────────────────
  await createTableIfMissing(pool, {
    name: 'UserAdsSavedViews',
    columns: [
      ['Id', { ddl: 'VARCHAR(50)', pk: true }],
      ['UserId', { fk: { table: 'Users', col: 'Id' }, nullable: false }],
      ['Name', { ddl: 'NVARCHAR(200)', nullable: false }],
      ['Filters', { ddl: 'NVARCHAR(MAX)', nullable: false }], // JSON serialised filter set
      ['CreatedAt', { ddl: 'DATETIME2', nullable: false }],
      ['UpdatedAt', { ddl: 'DATETIME2', nullable: false }],
    ],
    indexes: [
      { name: 'IX_UserAdsSavedViews_UserId', cols: ['UserId'] },
    ],
  });

  // ── AdsFlags ──────────────────────────────────────────────────────────
  await createTableIfMissing(pool, {
    name: 'AdsFlags',
    columns: [
      ['Id', { ddl: 'VARCHAR(50)', pk: true }],
      ['UserId', { fk: { table: 'Users', col: 'Id' }, nullable: false }],
      ['Asin', { ddl: 'VARCHAR(50)', nullable: false }],
      ['Flag', { ddl: 'VARCHAR(50)', nullable: false }], // waste | high_acos | watchlist | …
      ['Note', { ddl: 'NVARCHAR(500)', nullable: true }],
      ['CreatedAt', { ddl: 'DATETIME2', nullable: false }],
    ],
    indexes: [
      { name: 'IX_AdsFlags_UserId', cols: ['UserId'] },
      { name: 'IX_AdsFlags_UserId_Asin', cols: ['UserId', 'Asin'], unique: true },
    ],
  });

  // ── UserAdsPreferences ────────────────────────────────────────────────
  await createTableIfMissing(pool, {
    name: 'UserAdsPreferences',
    columns: [
      ['UserId', { fk: { table: 'Users', col: 'Id' }, pk: true, nullable: false }],
      ['Preferences', { ddl: 'NVARCHAR(MAX)', nullable: false }], // JSON serialised prefs
      ['UpdatedAt', { ddl: 'DATETIME2', nullable: false }],
    ],
  });

  console.log('  ✅ migration 043 complete: UserAdsSavedViews, AdsFlags, UserAdsPreferences');
};
