/**
 * 027 — add Asins.DescLength.
 *
 * The ASIN Manager projection (PR #66) lists `a.DescLength` in its base column
 * set and maps it back as `descLength`, but the column only ever existed in
 * code — no migration created it, so the base SELECT failed with
 * "Invalid column name 'DescLength'".
 *
 * It stores the description length so the grid can render a "Desc Length"
 * column without pulling the NVARCHAR(MAX) ProductDescription on every row
 * (the heavy field only arrives `?columns=productDescription`).
 *
 * Additive + idempotent: skipped when the column already exists. Existing rows
 * are backfilled once from `LEN(ProductDescription)`.
 */
module.exports = {
  up: async (pool) => {
    const exists = await pool.request().query(
      `SELECT COUNT(*) AS n FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Asins') AND name = 'DescLength'`
    );
    if (exists.recordset[0].n > 0) {
      console.log('  - skip Asins.DescLength (exists)');
      return;
    }

    await pool.request().query(
      `ALTER TABLE dbo.Asins ADD DescLength INT NOT NULL CONSTRAINT DF_Asins_DescLength DEFAULT 0`
    );
    console.log('  + added Asins.DescLength');

    const backfill = await pool.request().query(
      `UPDATE dbo.Asins SET DescLength = LEN(ProductDescription) WHERE DescLength = 0 AND ProductDescription IS NOT NULL`
    );
    console.log(`  + backfilled Asins.DescLength (${backfill.rowsAffected[0]} rows)`);
  },
};