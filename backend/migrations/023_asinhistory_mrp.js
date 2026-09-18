/**
 * Add Mrp column to AsinHistory so daily pricing snapshots (Price, Mrp,
 * BSR, SubBSR, Rating, ReviewCount) capture full historical data.
 * Primary key / Id remains bigint IDENTITY; daily snapshots are upserted
 * keyed on (AsinId, Date) by the sync services.
 */
const { sql } = require('../database/db');

module.exports = {
  up: async (pool) => {
    await pool.request().query(`
      IF OBJECT_ID(N'dbo.AsinHistory', N'U') IS NOT NULL
      BEGIN
        IF COL_LENGTH('dbo.AsinHistory', 'Mrp') IS NULL
          ALTER TABLE AsinHistory ADD Mrp DECIMAL(18, 2) NULL;
      END
    `);
    console.log('023_asinhistory_mrp complete');
  },
};