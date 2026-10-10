/**
 * Migration 007: AI chat persistence
 * Adds AIConversations + AIChatMessages for the RetailOps AI chat workspace.
 */
const { sql, getPool } = require('../database/db');

async function up() {
    const pool = await getPool();

    await pool.request().query(`
        IF OBJECT_ID(N'dbo.AIConversations', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.AIConversations (
                Id VARCHAR(50) PRIMARY KEY,
                UserId VARCHAR(50) NOT NULL,
                Title NVARCHAR(500) NOT NULL DEFAULT N'New Conversation',
                Metadata NVARCHAR(MAX) NULL,
                CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
                UpdatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()
            );
            CREATE INDEX IX_AIConversations_UserId ON dbo.AIConversations(UserId);
            CREATE INDEX IX_AIConversations_UpdatedAt ON dbo.AIConversations(UpdatedAt);
        END
    `);
    console.log('[Migration 007] ✅ AIConversations table ensured');

    await pool.request().query(`
        IF OBJECT_ID(N'dbo.AIChatMessages', N'U') IS NULL
        BEGIN
            CREATE TABLE dbo.AIChatMessages (
                Id VARCHAR(50) PRIMARY KEY,
                ConversationId VARCHAR(50) NOT NULL,
                Role VARCHAR(20) NOT NULL,
                Content NVARCHAR(MAX) NULL,
                ModelId VARCHAR(100) NULL,
                TokensUsed INT NOT NULL DEFAULT 0,
                Metadata NVARCHAR(MAX) NULL,
                CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate()
            );
            CREATE INDEX IX_AIChatMessages_ConversationId ON dbo.AIChatMessages(ConversationId);
            CREATE INDEX IX_AIChatMessages_CreatedAt ON dbo.AIChatMessages(CreatedAt);
        END
    `);
    console.log('[Migration 007] ✅ AIChatMessages table ensured');

    // FK after both tables exist (idempotent)
    await pool.request().query(`
        IF NOT EXISTS (
            SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_AIChatMessages_Conversation'
        )
        BEGIN
            ALTER TABLE dbo.AIChatMessages
            ADD CONSTRAINT FK_AIChatMessages_Conversation
            FOREIGN KEY (ConversationId) REFERENCES dbo.AIConversations(Id) ON DELETE CASCADE;
        END
    `);
    console.log('[Migration 007] ✅ AIChatMessages FK ensured');
}

module.exports = { up };