/**
 * Migration 039: OOS review and waiver fields
 *
 * Separates reviewer assignment from reviewer decision:
 *   - ReviewerAssigned: who is assigned to review (submission prerequisite)
 *   - ReviewerDecision: the authenticated approval decision (closure gate)
 *   - Waiver fields: reason, actor, expiry for authorized waivers of open incidents
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const { sequelize } = queryInterface;
    const query = async (sql) => {
      const [results] = await sequelize.query(sql);
      return results;
    };

    // ReviewerAssignment on OosSubmissionReviews - who is assigned to review
    await query(`
      IF COL_LENGTH('dbo.OosSubmissionReviews', 'ReviewerAssigned') IS NULL
        ALTER TABLE dbo.OosSubmissionReviews ADD ReviewerAssigned VARCHAR(50) NULL;
    `);

    // ReviewerDecision - the actual approval/rejection decision
    await query(`
      IF COL_LENGTH('dbo.OosSubmissionReviews', 'ReviewerDecision') IS NULL
        ALTER TABLE dbo.OosSubmissionReviews ADD ReviewerDecision VARCHAR(20) NULL; -- APPROVED | REJECTED | WAIVED
    `);

    // ReviewerDecisionAt - when the decision was made
    await query(`
      IF COL_LENGTH('dbo.OosSubmissionReviews', 'ReviewerDecisionAt') IS NULL
        ALTER TABLE dbo.OosSubmissionReviews ADD ReviewerDecisionAt DATETIME2 NULL;
    `);

    // WaiverReason - reason for waiving an open incident
    await query(`
      IF COL_LENGTH('dbo.OosSubmissionReviews', 'WaiverReason') IS NULL
        ALTER TABLE dbo.OosSubmissionReviews ADD WaiverReason NVARCHAR(1000) NULL;
    `);

    // WaiverActor - who authorized the waiver
    await query(`
      IF COL_LENGTH('dbo.OosSubmissionReviews', 'WaiverActor') IS NULL
        ALTER TABLE dbo.OosSubmissionReviews ADD WaiverActor VARCHAR(50) NULL;
    `);

    // WaiverExpiry - when the waiver expires
    await query(`
      IF COL_LENGTH('dbo.OosSubmissionReviews', 'WaiverExpiry') IS NULL
        ALTER TABLE dbo.OosSubmissionReviews ADD WaiverExpiry DATETIME2 NULL;
    `);

    console.log('[Migration 039] OOS review and waiver fields added');
  },

  down: async (queryInterface, Sequelize) => {
    const { sequelize } = queryInterface;
    const query = async (sql) => {
      const [results] = await sequelize.query(sql);
      return results;
    };

    await query(`IF COL_LENGTH('dbo.OosSubmissionReviews', 'WaiverExpiry') IS NOT NULL ALTER TABLE dbo.OosSubmissionReviews DROP COLUMN WaiverExpiry;`);
    await query(`IF COL_LENGTH('dbo.OosSubmissionReviews', 'WaiverActor') IS NOT NULL ALTER TABLE dbo.OosSubmissionReviews DROP COLUMN WaiverActor;`);
    await query(`IF COL_LENGTH('dbo.OosSubmissionReviews', 'WaiverReason') IS NOT NULL ALTER TABLE dbo.OosSubmissionReviews DROP COLUMN WaiverReason;`);
    await query(`IF COL_LENGTH('dbo.OosSubmissionReviews', 'ReviewerDecisionAt') IS NOT NULL ALTER TABLE dbo.OosSubmissionReviews DROP COLUMN ReviewerDecisionAt;`);
    await query(`IF COL_LENGTH('dbo.OosSubmissionReviews', 'ReviewerDecision') IS NOT NULL ALTER TABLE dbo.OosSubmissionReviews DROP COLUMN ReviewerDecision;`);
    await query(`IF COL_LENGTH('dbo.OosSubmissionReviews', 'ReviewerAssigned') IS NOT NULL ALTER TABLE dbo.OosSubmissionReviews DROP COLUMN ReviewerAssigned;`);

    console.log('[Migration 039] Rolled back OOS review and waiver fields');
  }
};
