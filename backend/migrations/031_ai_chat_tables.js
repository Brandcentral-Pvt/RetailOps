/**
 * Migration 031: AI Chat Tables
 * Creates AIConversations and AIMessages tables for the AI Assistant feature
 */
module.exports = {
  up: async (pool) => {
    const q = (s) => pool.request().query(s);

    // AI Conversations table
    await q(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='AIConversations' AND xtype='U')
      CREATE TABLE AIConversations (
        Id VARCHAR(50) NOT NULL PRIMARY KEY,
        UserId VARCHAR(50) NOT NULL,
        Title NVARCHAR(500) NULL,
        Metadata NVARCHAR(MAX) NULL,
        Status VARCHAR(20) NOT NULL DEFAULT 'active',
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        CONSTRAINT FK_AIConversations_UserId FOREIGN KEY (UserId) REFERENCES Users(Id)
      );
      
      CREATE INDEX IX_AIConversations_UserId ON AIConversations(UserId);
      CREATE INDEX IX_AIConversations_UpdatedAt ON AIConversations(UpdatedAt);
    `);

    // AI Messages table
    await q(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='AIChatMessages' AND xtype='U')
      CREATE TABLE AIChatMessages (
        Id VARCHAR(50) NOT NULL PRIMARY KEY,
        ConversationId VARCHAR(50) NOT NULL,
        Role VARCHAR(20) NOT NULL,
        Content NVARCHAR(MAX) NOT NULL,
        ModelId VARCHAR(100) NULL,
        TokensUsed INT NULL,
        Metadata NVARCHAR(MAX) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT dbo.GetEnvDate(),
        Streaming BIT NOT NULL DEFAULT 0,
        CONSTRAINT FK_AIChatMessages_ConversationId FOREIGN KEY (ConversationId) REFERENCES AIConversations(Id) ON DELETE CASCADE
      );
      
      CREATE INDEX IX_AIChatMessages_ConversationId ON AIChatMessages(ConversationId);
      CREATE INDEX IX_AIChatMessages_CreatedAt ON AIChatMessages(CreatedAt);
    `);

    console.log('[Migration 031] ✅ AI Chat tables created');
  },

  down: async (pool) => {
    const q = (s) => pool.request().query(s);
    
    await q(`DROP TABLE IF EXISTS AIChatMessages`);
    await q(`DROP TABLE IF EXISTS AIConversations`);
    
    console.log('[Migration 031] 🔄 AI Chat tables dropped');
  },
};