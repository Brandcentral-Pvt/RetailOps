/**
 * Migration 030: Affected-ASIN signal table (PemsTaskAsins).
 *
 * One row per (TaskInstanceId, AsinCode, SignalCode) so a single ASIN can carry
 * multiple signals for the same task (e.g. price dispute + LQS fail).
 *
 * SignalCode is the stable code the classifier produces:
 *   PRICE_DISPUTE, BUYBOX_LOST, MRP_OVER_70, HAS_DEAL,
 *   TITLE_F, BULLET_F, IMAGE_F, DESC_F, LQS_F, CDQ_F,
 *   TITLE_ISSUE, BULLET_ISSUE, IMAGE_ISSUE, DESC_ISSUE,
 *   OOS, LOW_STOCK, SUPPRESSED, TICKET_OPEN
 *
 * The table is intentionally narrow — the raw label/value that triggered it
 * lives in the JSON Remarks column so the UI can show the exact message.
 */
module.exports = {
  up: async (pool) => {
    const q = (s) => pool.request().query(s);

    await q(`
      IF OBJECT_ID(N'dbo.PemsTaskAsins', N'U') IS NULL
      BEGIN
        CREATE TABLE dbo.PemsTaskAsins (
          Id VARCHAR(50) NOT NULL PRIMARY KEY,
          TaskInstanceId VARCHAR(50) NOT NULL,
          AsinCode VARCHAR(50) NOT NULL,
          SellerId VARCHAR(50) NOT NULL,
          SellerName NVARCHAR(200) NOT NULL,
          SignalCode VARCHAR(40) NOT NULL,
          SignalLabel NVARCHAR(500) NULL,
          Severity VARCHAR(10) NOT NULL,         -- minor | major | critical
          NumericValue DECIMAL(18, 4) NULL,      -- delta, MRP%, BSR, etc.
          StringValue NVARCHAR(500) NULL,        -- raw label, bucket, etc.
          Remarks NVARCHAR(MAX) NULL,            -- full human sentence for UI
          Status VARCHAR(20) NOT NULL DEFAULT 'OPEN',   -- OPEN | RESOLVED | WAIVED
          Resolution VARCHAR(200) NULL,           -- how it was resolved
          WaiveReason NVARCHAR(500) NULL,
          ResolvedAt DATETIME2 NULL,
          ResolvedBy VARCHAR(50) NULL,
          CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
          UpdatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
          CONSTRAINT FK_PemsTaskAsins_Instance FOREIGN KEY (TaskInstanceId) REFERENCES dbo.PemsTaskInstances(Id) ON DELETE CASCADE,
          CONSTRAINT FK_PemsTaskAsins_Seller FOREIGN KEY (SellerId) REFERENCES dbo.Sellers(Id)
        );
        CREATE UNIQUE INDEX UX_PemsTaskAsins_Instance_Asin_Signal
          ON dbo.PemsTaskAsins(TaskInstanceId, AsinCode, SignalCode);
        CREATE INDEX IX_PemsTaskAsins_Seller ON dbo.PemsTaskAsins(SellerId);
        CREATE INDEX IX_PemsTaskAsins_Status ON dbo.PemsTaskAsins(Status);
      END
    `);

    console.log('[Migration 030] ✅ PemsTaskAsins');
  },
};