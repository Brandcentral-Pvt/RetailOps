/**
 * AI Chat API Routes
 * 
 * Endpoints:
 * - POST   /api/ai/chat/conversations        - Create conversation
 * - GET    /api/ai/chat/conversations        - List conversations
 * - GET    /api/ai/chat/conversations/:id    - Get conversation with messages
 * - PUT    /api/ai/chat/conversations/:id    - Update conversation title
 * - DELETE /api/ai/chat/conversations/:id    - Delete conversation
 * - POST   /api/ai/chat/conversations/:id/messages - Send message (non-streaming)
 * - POST   /api/ai/chat/conversations/:id/stream   - Stream chat response
 * - GET    /api/ai/models                    - List available models
 * - GET    /api/ai/usage                     - Get token usage stats
 * - GET    /api/ai/stats                     - Get chat statistics
 */

const express = require('express');
const router = express.Router();
const { authenticate, requirePermission } = require('../middleware/auth');
const chatService = require('../services/chatService');
const apinexService = require('../services/apinexBondService');
const { generateId } = require('../database/db');

// All routes require authentication
router.use(authenticate);

// ============ MODELS ============

/**
 * GET /api/ai/models
 * List all available models
 */
router.get('/models', async (req, res) => {
  try {
    const models = apinexService.getAllModels();
    const freeModels = apinexService.getFreeModels();
    const subscriptionModels = apinexService.getSubscriptionModels();
    
    res.json({
      success: true,
      data: {
        all: models,
        free: freeModels,
        subscription: subscriptionModels,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/ai/usage
 * Get token usage statistics
 */
router.get('/usage', async (req, res) => {
  try {
    const stats = apinexService.getUsageStats();
    const available = apinexService.getAvailableTokens();
    
    res.json({
      success: true,
      data: {
        ...stats,
        availableTokens: available,
        dailyLimit: 1_000_000,
        usedPercentage: ((1_000_000 - available) / 1_000_000 * 100).toFixed(2),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ CONVERSATIONS ============

/**
 * POST /api/ai/chat/conversations
 * Create a new conversation
 */
router.post('/conversations', async (req, res) => {
  try {
    const { title, metadata } = req.body;
    const userId = req.user.Id;
    
    const conversationId = await chatService.createConversation(userId, title, metadata);
    const conversation = await chatService.getConversation(conversationId, userId);
    
    res.status(201).json({ success: true, data: conversation });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/ai/chat/conversations
 * List user's conversations
 */
router.get('/conversations', async (req, res) => {
  try {
    const userId = req.user.Id;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    
    const conversations = await chatService.getUserConversations(userId, { limit, offset });
    const stats = await chatService.getConversationStats(userId);
    
    res.json({
      success: true,
      data: { conversations, stats },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/ai/chat/conversations/:id
 * Get conversation with messages
 */
router.get('/conversations/:id', async (req, res) => {
  try {
    const userId = req.user.Id;
    const conversation = await chatService.getConversation(req.params.id, userId, {
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0,
    });
    
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }
    
    res.json({ success: true, data: conversation });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/ai/chat/conversations/:id
 * Update conversation title
 */
router.put('/conversations/:id', async (req, res) => {
  try {
    const { title } = req.body;
    const userId = req.user.Id;
    
    await chatService.updateConversationTitle(req.params.id, userId, title);
    const conversation = await chatService.getConversation(req.params.id, userId);
    
    res.json({ success: true, data: conversation });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/ai/chat/conversations/:id
 * Delete a conversation
 */
router.delete('/conversations/:id', async (req, res) => {
  try {
    const userId = req.user.Id;
    await chatService.deleteConversation(req.params.id, userId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/ai/chat/conversations/search
 * Search conversations
 */
router.get('/conversations/search', async (req, res) => {
  try {
    const userId = req.user.Id;
    const query = req.query.q;
    const limit = parseInt(req.query.limit) || 20;
    
    if (!query) {
      return res.status(400).json({ success: false, error: 'Query parameter required' });
    }
    
    const conversations = await chatService.searchConversations(userId, query, { limit });
    res.json({ success: true, data: conversations });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ MESSAGES ============

/**
 * POST /api/ai/chat/conversations/:id/messages
 * Send message (non-streaming)
 */
router.post('/conversations/:id/messages', async (req, res) => {
  try {
    const userId = req.user.Id;
    const { message, modelId, temperature, maxTokens, options } = req.body;
    
    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }
    
    const result = await chatService.generateChatResponse(req.params.id, userId, message, {
      modelId,
      temperature,
      maxTokens,
      allowSubscription: options?.allowSubscription,
    });
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/ai/chat/conversations/:id/stream
 * Stream chat response
 */
router.post('/conversations/:id/stream', async (req, res) => {
  try {
    const userId = req.user.Id;
    const { message, modelId, temperature, maxTokens, options } = req.body;
    
    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }
    
    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    
    const sendEvent = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    
    const messageText = message;
    
    try {
      const stream = chatService.streamChatResponse(req.params.id, userId, messageText, {
        modelId,
        temperature,
        maxTokens,
        allowSubscription: options?.allowSubscription,
      });
      
      for await (const chunk of stream) {
        sendEvent(chunk);
      }
      
      sendEvent({ type: 'end' });
      res.end();
    } catch (error) {
      sendEvent({ type: 'error', error: error.message });
      res.end();
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ STATS ============

/**
 * GET /api/ai/stats
 * Get chat statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.Id;
    const stats = await chatService.getConversationStats(userId);
    const usage = apinexService.getUsageStats();
    const available = apinexService.getAvailableTokens();
    
    res.json({
      success: true,
      data: {
        conversations: stats,
        tokens: {
          ...usage,
          availableTokens: available,
          dailyLimit: 1_000_000,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;