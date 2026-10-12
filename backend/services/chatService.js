/**
 * Chat Service - Conversation Management & Multi-Model Chat
 * 
 * Handles:
 * - Conversation persistence
 * - Multi-model chat with context
 * - Message history & search
 */

const apinexService = require('./apinexBondService');
const { sql, getPool } = require('../database/db');

const MAX_CONTEXT_MESSAGES = 20;

/**
 * Save a message to the conversation
 */
async function saveMessage(conversationId, role, content, metadata = {}) {
  const pool = await getPool();
  const id = require('../database/db').generateId();
  
  await pool.request()
    .input('id', sql.VarChar, id)
    .input('conversationId', sql.VarChar, conversationId)
    .input('role', sql.VarChar, role)
    .input('content', sql.NVarChar(sql.MAX), content)
    .input('modelId', sql.VarChar, metadata.modelId || null)
    .input('tokensUsed', sql.Int, metadata.tokensUsed || 0)
    .input('metadata', sql.NVarChar(sql.MAX), JSON.stringify(metadata))
    .query(`
      INSERT INTO AIChatMessages (Id, ConversationId, Role, Content, ModelId, TokensUsed, Metadata, CreatedAt)
      VALUES (@id, @conversationId, @role, @content, @modelId, @tokensUsed, @metadata, dbo.GetEnvDate())
    `);
  
  return id;
}

/**
 * Create a new conversation
 */
async function createConversation(userId, title = null, metadata = {}) {
  const pool = await getPool();
  const id = require('../database/db').generateId();
  
  await pool.request()
    .input('id', sql.VarChar, id)
    .input('userId', sql.VarChar, userId)
    .input('title', sql.NVarChar, title || 'New Conversation')
    .input('metadata', sql.NVarChar(sql.MAX), JSON.stringify(metadata))
    .query(`
      INSERT INTO AIConversations (Id, UserId, Title, Metadata, CreatedAt, UpdatedAt)
      VALUES (@id, @userId, @title, @metadata, dbo.GetEnvDate(), dbo.GetEnvDate())
    `);
  
  return id;
}

/**
 * Get conversation with messages
 */
async function getConversation(conversationId, userId, options = {}) {
  const pool = await getPool();
  
  // Verify ownership
  const convResult = await pool.request()
    .input('id', sql.VarChar, conversationId)
    .input('userId', sql.VarChar, userId)
    .query('SELECT * FROM AIConversations WHERE Id = @id AND UserId = @userId');
  
  if (!convResult.recordset.length) {
    return null;
  }
  
  const conversation = convResult.recordset[0];
  
  // Get messages
  const limit = options.limit || 50;
  const offset = options.offset || 0;
  
  const messagesResult = await pool.request()
    .input('conversationId', sql.VarChar, conversationId)
    .input('limit', sql.Int, limit)
    .input('offset', sql.Int, offset)
    .query(`
      SELECT * FROM AIChatMessages 
      WHERE ConversationId = @conversationId
      ORDER BY CreatedAt DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);
  
  return {
    ...conversation,
    messages: messagesResult.recordset.reverse(),
  };
}

/**
 * Get user's conversations list
 */
async function getUserConversations(userId, options = {}) {
  const pool = await getPool();
  const limit = options.limit || 20;
  const offset = options.offset || 0;
  
  const result = await pool.request()
    .input('userId', sql.VarChar, userId)
    .input('limit', sql.Int, limit)
    .input('offset', sql.Int, offset)
    .query(`
      SELECT c.*, 
        (SELECT TOP 1 Content FROM AIChatMessages WHERE ConversationId = c.Id ORDER BY CreatedAt DESC) as LastMessage,
        (SELECT COUNT(*) FROM AIChatMessages WHERE ConversationId = c.Id) as MessageCount
      FROM AIConversations c
      WHERE c.UserId = @userId
      ORDER BY c.UpdatedAt DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);
  
  return result.recordset;
}

/**
 * Update conversation title
 */
async function updateConversationTitle(conversationId, userId, title) {
  const pool = await getPool();
  await pool.request()
    .input('id', sql.VarChar, conversationId)
    .input('userId', sql.VarChar, userId)
    .input('title', sql.NVarChar, title)
    .query('UPDATE AIConversations SET Title = @title, UpdatedAt = dbo.GetEnvDate() WHERE Id = @id AND UserId = @userId');
}

/**
 * Delete a conversation
 */
async function deleteConversation(conversationId, userId) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  
  try {
    // Delete messages first
    await transaction.request()
      .input('conversationId', sql.VarChar, conversationId)
      .query('DELETE FROM AIChatMessages WHERE ConversationId = @conversationId');
    
    // Delete conversation
    await transaction.request()
      .input('id', sql.VarChar, conversationId)
      .input('userId', sql.VarChar, userId)
      .query('DELETE FROM AIConversations WHERE Id = @id AND UserId = @userId');
    
    await transaction.commit();
    return true;
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

/**
 * Build context for chat - includes relevant messages
 */
async function buildChatContext(conversationId, userId, currentMessage) {
  const pool = await getPool();
  
  // Get recent messages for context
  const messagesResult = await pool.request()
    .input('conversationId', sql.VarChar, conversationId)
    .query(`
      SELECT TOP 20 Role, Content, ModelId, CreatedAt
      FROM AIChatMessages
      WHERE ConversationId = @conversationId
      ORDER BY CreatedAt DESC
    `);
  
  const recentMessages = messagesResult.recordset.reverse().map(m => ({
    role: m.Role,
    content: m.Content,
    modelId: m.ModelId,
  }));
  
  // Build system prompt
  const systemPrompt = `You are RetailOps AI Assistant - a helpful and friendly assistant for the RetailOps e-commerce operations platform.

Guidelines:
- Be concise but thorough
- Use clear markdown formatting when it improves readability
- Ask clarifying questions when the request is ambiguous
- If you don't know something, say so rather than guessing`;

  return {
    systemPrompt,
    messages: [
      { role: 'system', content: systemPrompt },
      ...recentMessages.slice(-MAX_CONTEXT_MESSAGES),
      { role: 'user', content: currentMessage }
    ]
  };
}

/**
 * Generate AI response with streaming
 */
async function* streamChatResponse(conversationId, userId, message, options = {}) {
  const { messages } = await buildChatContext(conversationId, userId, message);
  
  // Save user message
  await saveMessage(conversationId, 'user', message, {
    modelId: options.modelId,
  });
  
  const modelId = options.modelId || 'free/gpt-6-luna';
  let fullResponse = '';
  let tokensUsed = 0;

  try {
    // Stream the response
    for await (const chunk of apinexService.streamChat(messages, {
      model: options.modelId,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
      allowSubscription: options.allowSubscription,
    })) {
      fullResponse += chunk;
      tokensUsed++;
      yield { type: 'chunk', content: chunk };
    }
    
    // Save assistant message
    await saveMessage(conversationId, 'assistant', fullResponse, {
      modelId,
      tokensUsed,
    });
    
    // Update conversation timestamp
    await updateConversationTimestamp(conversationId);
    
    yield { type: 'complete', messageId: null, tokensUsed };
  } catch (error) {
    yield { type: 'error', error: error.message };
  }
}

/**
 * Generate non-streaming AI response
 */
async function generateChatResponse(conversationId, userId, message, options = {}) {
  const { messages } = await buildChatContext(conversationId, userId, message);
  
  // Save user message
  await saveMessage(conversationId, 'user', message, {
    modelId: options.modelId,
  });
  
  const modelId = options.modelId || 'free/gpt-6-luna';
  
  try {
    const result = await apinexService.chat(messages, {
      model: options.modelId,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
      allowSubscription: options.allowSubscription,
    });
    
    // Save assistant message
    await saveMessage(conversationId, 'assistant', result.content, {
      modelId,
      tokensUsed: result.usage?.total_tokens || 0,
    });
    
    // Update conversation timestamp
    await updateConversationTimestamp(conversationId);
    
    return {
      success: true,
      content: result.content,
      model: result.model,
      usage: result.usage,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Update conversation timestamp
 */
async function updateConversationTimestamp(conversationId) {
  const pool = await getPool();
  await pool.request()
    .input('id', sql.VarChar, conversationId)
    .query('UPDATE AIConversations SET UpdatedAt = dbo.GetEnvDate() WHERE Id = @id');
}

/**
 * Search conversations
 */
async function searchConversations(userId, query, options = {}) {
  const pool = await getPool();
  const limit = options.limit || 20;
  
  const result = await pool.request()
    .input('userId', sql.VarChar, userId)
    .input('query', sql.NVarChar, `%${query}%`)
    .input('limit', sql.Int, limit)
    .query(`
      SELECT c.*, 
        (SELECT TOP 1 Content FROM AIChatMessages WHERE ConversationId = c.Id ORDER BY CreatedAt DESC) as LastMessage
      FROM AIConversations c
      WHERE c.UserId = @userId 
        AND (c.Title LIKE @query OR EXISTS (
          SELECT 1 FROM AIChatMessages m WHERE m.ConversationId = c.Id AND m.Content LIKE @query
        ))
      ORDER BY c.UpdatedAt DESC
    `);
  
  return result.recordset;
}

/**
 * Get conversation stats
 */
async function getConversationStats(userId) {
  const pool = await getPool();
  
  const result = await pool.request()
    .input('userId', sql.VarChar, userId)
    .query(`
      SELECT 
        COUNT(DISTINCT c.Id) as TotalConversations,
        COUNT(m.Id) as TotalMessages,
        MAX(c.UpdatedAt) as LastActivity
      FROM AIConversations c
      LEFT JOIN AIChatMessages m ON m.ConversationId = c.Id
      WHERE c.UserId = @userId
    `);
  
  return result.recordset[0] || { TotalConversations: 0, TotalMessages: 0, LastActivity: null };
}

module.exports = {
  saveMessage,
  createConversation,
  getConversation,
  getUserConversations,
  updateConversationTitle,
  deleteConversation,
  buildChatContext,
  streamChatResponse,
  generateChatResponse,
  updateConversationTimestamp,
  searchConversations,
  getConversationStats,
};