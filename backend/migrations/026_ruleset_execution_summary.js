/**
 * Migration 026: Add Summary column to RulesetExecutionLogs
 *
 * The engine was storing the execution summary JSON in ErrorMessage (abuse)
 * and the frontend was looking for a `Summary` column that didn't exist,
 * so execution history drawers rendered "0 matched · 0 actioned" even
 * after a successful run.
 */
module.exports = {
  up: async (pool) => {
    await pool.request().query(`
      IF COL_LENGTH('dbo.RulesetExecutionLogs', 'Summary') IS NULL
      BEGIN
        ALTER TABLE dbo.RulesetExecutionLogs
          ADD Summary NVARCHAR(MAX) NULL;
      END
    `);

    // Backfill Summary from ErrorMessage for any rows that were logged
    // before this migration (the JSON summary was wrongly stuffed into ErrorMessage).
    await pool.request().query(`
      UPDATE dbo.RulesetExecutionLogs
         SET Summary = ErrorMessage
       WHERE Summary IS NULL
         AND ErrorMessage IS NOT NULL
         AND (ErrorMessage LIKE N'{%' OR ErrorMessage LIKE N'[%')
    `);

    console.log('[Migration 026] ✅ Added Summary column to RulesetExecutionLogs (with backfill)');
  },
};
