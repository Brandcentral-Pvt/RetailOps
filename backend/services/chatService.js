/**
 * Chat Service - Conversation Management & Multi-Model Chat
 * 
 * Handles:
 * - Conversation persistence
 * - Multi-model chat with context
 * - Database-aware responses
 * - Message history & search
 */

const apinexService = require('./apinexBondService');
const databaseAnalysisService = require('./databaseAnalysisService');
const contentOptimizationService = require('./contentOptimizationService');
const { sql, getPool } = require('../database/db');

const MAX_CONTEXT_MESSAGES = 20;
const MAX_CONTEXT_TOKENS = 8000;

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
 * Build context for chat - includes relevant messages and database context
 */
async function buildChatContext(conversationId, userId, currentMessage, options = {}) {
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
  
  // Get database context if needed
  let dbContext = '';
  if (options.includeDatabase) {
    const schema = await databaseAnalysisService.getDatabaseSchema();
    dbContext = `\n\nDATABASE SCHEMA:\n${schema}\n\n`;
  }
  
  // Build system prompt
  const systemPrompt = `You are RetailOps AI Assistant - an expert business analyst for e-commerce operations.
  
${dbContext}

Your capabilities:
1. Answer questions about RetailOps data using natural language (text-to-SQL)
2. Analyze data and provide insights
3. Generate reports and visualizations
4. Help with task management and operations
5. Multi-model AI responses with model selection
6. Run the Content Optimization tool to prioritize listings by content-quality urgency (CDQ grade, title grade, LQS grade, A+ presence, description length) and produce fix plans with concrete rewrites

Guidelines:
- Be concise but thorough
- Use data to back up answers
- Offer to run SQL queries when appropriate
- Suggest relevant visualizations
- Ask clarifying questions when ambiguous`;

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
 * Compact query results for prompt injection - bounds rows, columns, and cell size.
 */
function compactResultRows(rows) {
  const source = Array.isArray(rows) ? rows : [];
  const trimCell = (v) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return s.length > 140 ? `${s.slice(0, 140)}…` : s;
  };
  const trimRow = (row) => {
    const out = {};
    Object.entries(row || {}).slice(0, 16).forEach(([k, v]) => {
      out[k] = trimCell(v);
    });
    return out;
  };

  let rows2 = source.slice(0, 30).map(trimRow);
  let json = JSON.stringify(rows2);
  let truncated = source.length > rows2.length;
  while (json.length > 12000 && rows2.length > 1) {
    rows2 = rows2.slice(0, Math.floor(rows2.length / 2));
    json = JSON.stringify(rows2);
    truncated = true;
  }
  return { rows: rows2, truncated, json };
}

/**
 * Plan and execute a database query from a natural language message.
 * Returns null when the question is not SQL-answerable (fall back to normal chat).
 * Only read-only (SELECT/WITH) single statements are ever executed.
 */
async function runDatabaseTool(message, options = {}) {
  try {
    const { sql } = await databaseAnalysisService.naturalLanguageToSQL(message, {
      model: options.modelId,
      allowSubscription: options.allowSubscription,
    });

    const clean = String(sql || '')
      .trim()
      .replace(/^```(?:sql)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()
      .replace(/;+$/, '');

    if (!clean || /^\s*--\s*ERROR/i.test(clean)) {
      return null;
    }

    // Safety: automatic analysis may only issue a single read-only statement.
    if (!/^\s*(SELECT|WITH)\b/i.test(clean) || clean.includes(';') || clean.includes('/*') || /\bINTO\b/i.test(clean)) {
      return {
        sql: clean,
        error: 'Only a single read-only SELECT/WITH query is allowed for automatic analysis.',
      };
    }

    const result = await databaseAnalysisService.executeQuery(clean);
    if (!result.success) {
      return { sql: clean, error: result.error };
    }

    const { rows, truncated, json } = compactResultRows(result.data);
    return { sql: clean, data: rows, truncated, json };
  } catch (error) {
    return null;
  }
}

/**
 * Route a user turn to the right tool, then fall back to normal chat.
 *  - content-optimization intent  -> deterministic Content Optimization tool
 *  - otherwise                     -> generic read-only text-to-SQL tool
 */
async function runTurnTool(message, options) {
  if (contentOptimizationService.detectContentIntent(message)) {
    return contentOptimizationService.runContentPriorityTool(message);
  }
  return runDatabaseTool(message, options);
}

/**
 * Build the context wrapper shown to the model after a tool has run.
 */
function buildToolContext(systemPrompt, toolResult) {
  const base = `${systemPrompt}\n\n`;

  if (toolResult.tool === 'content_priority') {
    const scope = toolResult.sellerId
      ? `\nSCOPE: Seller ${toolResult.sellerName || toolResult.sellerId}${toolResult.sellerName && toolResult.sellerId && toolResult.sellerName !== toolResult.sellerId ? ` (id ${toolResult.sellerId})` : ''} only.\n`
      : toolResult.sellerMatches && toolResult.sellerMatches.length
        ? `\nSCOPE: Ambiguous seller (matches: ${toolResult.sellerMatches.join(', ')}). Present the cross-seller ranking, then ask the user which seller to scope the fix plan to.\n`
        : '\nSCOPE: All sellers.\n';

    const dataNotes = toolResult.dataNotes ? `DATA NOTE: ${toolResult.dataNotes}\n` : '';
    const weights = toolResult.weights && toolResult.weights.length
      ? `ACTIVE SCORING PILLARS: ${toolResult.weights.map((w) => `${w.label} (${w.weight})`).join(', ')}.\n`
      : 'ACTIVE SCORING PILLARS: none.\n';

    let health = '';
    if (toolResult.health && Number(toolResult.health.total) > 0) {
      const h = toolResult.health;
      health =
        `HEALTH & COVERAGE (scope):\n` +
        `- Total listed ASINs: ${h.total}\n` +
        `- Scored: title ${h.withTitle}, LQS ${h.withLqs}, bullets ${h.withBullets}, images ${h.withImages}, description ${h.withDescription}, CDQ ${h.withCdq}\n` +
        `- A+ known: ${h.withAplus} (missing ${h.missingAplus}), full descriptions: ${h.fullDesc}, buy box known: ${h.withBuyBox}\n` +
        `- Poor LQS (D/F): ${h.poorLqs}, avg title ${h.avgTitle != null ? Number(h.avgTitle).toFixed(1) : 'N/A'}, avg bullets ${h.avgBullets != null ? Number(h.avgBullets).toFixed(1) : 'N/A'}, avg images ${h.avgImages != null ? Number(h.avgImages).toFixed(1) : 'N/A'}, avg description ${h.avgDescription != null ? Number(h.avgDescription).toFixed(1) : 'N/A'}, avg CDQ ${h.avgCdq != null ? Number(h.avgCdq).toFixed(1) : 'N/A'}\n`;
    } else if (toolResult.health) {
      health = `HEALTH & COVERAGE: no scored listings found in this scope.\n`;
    }

    const tiers = toolResult.tiers
      ? `URGENCY TIERS (full scope): critical ${toolResult.tiers.critical}, high ${toolResult.tiers.high}, medium ${toolResult.tiers.medium}, low ${toolResult.tiers.low}.\n`
      : '';

    const detail = toolResult.deepDive
      ? `\n\nDEEP-DIVE ASIN ${toolResult.deepDive.asin} (issues + recommendations):\n${toolResult.deepDiveJson}`
      : '\n\nNo ASIN detail could be resolved for this turn.';

    return {
      role: 'system',
      content:
        `${base}` +
        `A Content Optimization tool already ran for this turn and computed everything — coverage, tiers, rankings, deep-dive. Do NOT provide SQL or ask the user to run anything; deliver the finished report directly.\n` +
        `It scored ASINs on a 0-100 UrgencyScore built from whichever pillars are populated (weights auto-normalized).\n` +
        scope +
        '\n' +
        dataNotes +
        weights +
        (tiers || '') +
        health +
        `\nRANKED URGENCY (${toolResult.rowCount} listings):\n${toolResult.json}${detail}\n\n` +
        'Respond with the final report:\n' +
        '1. Heading "Top listings needing content optimization" (+ seller when scoped).\n' +
        '2. A short health summary line(s) sourced only from the health & coverage data, and one line stating which pillars were unavailable (from DATA NOTE).\n' +
        '3. A markdown table sorted by rank: Rank | ASIN | Title (short) | CDQ | Title | LQS | A+ | Desc | Urgency (band).\n' +
        '4. A "Fix order" list grouped by band (🔴 CRITICAL, 🟠 HIGH, 🟡 MEDIUM, 🟢 LOW), most urgent first, naming the section to fix first (title / bullets / images / description / A+) for each ASIN.\n' +
        '5. For the deep-dive ASIN, a concrete optimization plan: a rewritten title, 2-3 rewritten bullets, and a description outline — grounded ONLY in its Issues and Recommendations.\n' +
        'Never invent numbers or fields that are not in the results.',
    };
  }

  const context = toolResult.error
    ? `You attempted the following SQL query but it failed: ${toolResult.error}\n\nAttempted SQL:\n${toolResult.sql}`
    : `You queried the database with this SQL:\n${toolResult.sql}` +
      (toolResult.data
        ? `\n\nResults (first ${toolResult.data.length} rows${toolResult.truncated ? ', truncated' : ''}):\n${toolResult.json}`
        : '');

  return {
    role: 'system',
    content:
      `${base}` +
      `A database tool already ran for this conversation turn. ${context}\n\n` +
      'Answer the user precisely using ONLY the query results. Format numbers cleanly and use a markdown table when it improves readability. Never invent data that is not in the results.',
  };
}

/**
 * Generate AI response with streaming
 */
async function* streamChatResponse(conversationId, userId, message, options = {}) {
  const { messages, systemPrompt } = await buildChatContext(conversationId, userId, message, options);
  
  // Save user message
  const userMsgId = await saveMessage(conversationId, 'user', message, {
    modelId: options.modelId,
  });
  
  const modelId = options.modelId || 'free/gpt-6-luna';
  let fullResponse = '';
  let tokensUsed = 0;

try {
    // Tool phase: if database context is enabled, route + run a tool before answering.
    let toolResult = null;
    if (options.includeDatabase) {
      toolResult = await runTurnTool(message, options);
      if (toolResult) {
        yield {
          type: 'tool',
          tool: toolResult.tool,
          sql: toolResult.sql,
          rowCount: toolResult.error ? 0 : toolResult.rowCount || toolResult.data?.length || 0,
          error: toolResult.error,
        };
      }
    }

    // Build the message set shown to the model for the final answer.
    let answerMessages = messages;
    if (toolResult) {
      const toolContext = buildToolContext(systemPrompt, toolResult);
      answerMessages = [
        toolContext,
        ...messages.filter((m) => m.role === 'system').slice(1),
        ...messages.filter((m) => m.role !== 'system'),
      ];
    }

    // Stream the response
    for await (const chunk of apinexService.streamChat(answerMessages, {
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
      toolUsed: toolResult
        ? { tool: toolResult.tool, rowCount: toolResult.error ? 0 : toolResult.rowCount || toolResult.data?.length || 0, error: toolResult.error }
        : null,
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
  const { messages, systemPrompt } = await buildChatContext(conversationId, userId, message, options);
  
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