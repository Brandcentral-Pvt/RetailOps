/**
 * Migration 036: OOS decision metrics / read model
 *
 * Keeps immutable decision facts in OosDecisions and puts recomputable
 * classification metrics in OosDecisionMetrics (1:1 by DecisionId).
 * Exposed by vw_OosAffectedAsins for the affected-ASIN grid.
 */
module.exports = {
  up: async (pool) => {
    const q = (s) => pool.request().query(s);

    // ── OosDecisionMetrics ─────────────────────────────────────────────
    await q(`
      IF OBJECT_ID(N'dbo.OosDecisionMetrics', N'U') IS NULL
      BEGIN
        CREATE TABLE dbo.OosDecisionMetrics (
          Id VARCHAR(50) NOT NULL PRIMARY KEY,
          DecisionId VARCHAR(50) NOT NULL,
          Sku NVARCHAR(100) NULL,
          PriorityGroup VARCHAR(20) NULL CHECK (PriorityGroup IN ('80%', '20%', 'GMS_UNVERIFIED')),
          IsNewAsin BIT NOT NULL DEFAULT 0,
          FirstSeenAt DATETIME2 NULL,
          GmsVerified BIT NOT NULL DEFAULT 0,
          Gms DECIMAL(18,2) NULL,
          GmsSharePct DECIMAL(9,4) NULL,
          CumulativePct DECIMAL(9,4) NULL,
          RetailOpsState VARCHAR(40) NULL,
          BrandCentralState VARCHAR(40) NULL,
          VendorCentralState VARCHAR(40) NULL,
          ClassificationVersion VARCHAR(20) NOT NULL DEFAULT 'v1',
          ComputedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()
        );
        CREATE UNIQUE INDEX UX_OosDecisionMetrics_Decision ON dbo.OosDecisionMetrics(DecisionId);
        CREATE INDEX IX_OosDecisionMetrics_PriorityGroup ON dbo.OosDecisionMetrics(PriorityGroup);
        CREATE INDEX IX_OosDecisionMetrics_IsNewAsin ON dbo.OosDecisionMetrics(IsNewAsin);
        CREATE INDEX IX_OosDecisionMetrics_GmsVerified ON dbo.OosDecisionMetrics(GmsVerified);
      END
    `);

    // ── View: vw_OosAffectedAsins ──────────────────────────────────────
    await q(`
      IF OBJECT_ID(N'dbo.vw_OosAffectedAsins', N'V') IS NOT NULL
        DROP VIEW dbo.vw_OosAffectedAsins;
      CREATE VIEW dbo.vw_OosAffectedAsins AS
      SELECT
        d.Id AS DecisionId,
        d.RunId,
        d.SellerId,
        d.Channel,
        d.AsinCode,
        d.Category AS Classification,
        d.RuleId,
        d.Confidence,
        d.Revision,
        m.Sku,
        m.PriorityGroup,
        m.IsNewAsin,
        m.FirstSeenAt,
        m.GmsVerified,
        m.Gms,
        m.GmsSharePct,
        m.CumulativePct,
        m.RetailOpsState,
        m.BrandCentralState,
        m.VendorCentralState,
        m.ClassificationVersion,
        m.ComputedAt,
        i.Id AS IncidentId,
        i.Status AS IncidentStatus,
        i.OwnerId AS IncidentOwnerId,
        rj.Id AS ResyncJobId,
        rj.Status AS ResyncStatus
      FROM dbo.OosDecisions d
      INNER JOIN dbo.OosDecisionMetrics m ON m.DecisionId = d.Id
      LEFT JOIN dbo.OosIncidents i
        ON i.SellerId = d.SellerId AND i.Channel = d.Channel AND i.AsinCode = d.AsinCode AND i.Status = 'OPEN'
      LEFT JOIN dbo.OosResyncJobs rj
        ON rj.RunId = d.RunId AND rj.SellerId = d.SellerId AND rj.Channel = d.Channel AND rj.AsinCode = d.AsinCode
    `);

    console.log('[Migration 036] ✅ OOS decision metrics table + vw_OosAffectedAsins view');
  },
};