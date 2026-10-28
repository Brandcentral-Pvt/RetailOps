/**
 * Migration 039: OOS review and waiver fields
 *
 * Separates reviewer assignment from reviewer decision:
 *   ReviewerAssigned: who is assigned to review (submission prerequisite)
 *   ReviewerDecision: the authenticated approval decision
 *   ReviewerDecisionAt: when the decision was made
 *   WaiverReason / WaiverActor / WaiverExpiry: authorized waiver fields
 */
module.exports = {
  up: async (pool) => {
    const q = (s) => pool.request().query(s);

    await q(`
      IF COL_LENGTH('dbo.OosSubmissionReviews', 'ReviewerAssigned') IS NULL
        ALTER TABLE dbo.OosSubmissionReviews ADD ReviewerAssigned VARCHAR(50) NULL;
    `);
    await q(`
      IF COL_LENGTH('dbo.OosSubmissionReviews', 'ReviewerDecision') IS NULL
        ALTER TABLE dbo.OosSubmissionReviews ADD ReviewerDecision VARCHAR(20) NULL;
    `);
    await q(`
      IF COL_LENGTH('dbo.OosSubmissionReviews', 'ReviewerDecisionAt') IS NULL
        ALTER TABLE dbo.OosSubmissionReviews ADD ReviewerDecisionAt DATETIME2 NULL;
    `);
    await q(`
      IF COL_LENGTH('dbo.OosSubmissionReviews', 'WaiverReason') IS NULL
        ALTER TABLE dbo.OosSubmissionReviews ADD WaiverReason NVARCHAR(1000) NULL;
    `);
    await q(`
      IF COL_LENGTH('dbo.OosSubmissionReviews', 'WaiverActor') IS NULL
        ALTER TABLE dbo.OosSubmissionReviews ADD WaiverActor VARCHAR(50) NULL;
    `);
    await q(`
      IF COL_LENGTH('dbo.OosSubmissionReviews', 'WaiverExpiry') IS NULL
        ALTER TABLE dbo.OosSubmissionReviews ADD WaiverExpiry DATETIME2 NULL;
    `);

    console.log('[Migration 039] ✅ OOS review and waiver fields');
  },
};