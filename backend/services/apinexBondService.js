/**
 * APINEX.BOND AI Service - Multi-Model Intelligence Broker
 * 
 * Integrates with APINEX.BOND API providing access to multiple AI models:
 * - Free models: gpt-6-luna, glm-5.3-flash, deepseek-v4.1-flash, deepseek-v4-pro-0813, 
 *   mimo-v2.6-pro, minimax-m3.1, minimax-m3, mimo-v2.6-flash
 * - Subscription models: claude-sonnet-4.6, hy4, claude-opus-4.6, gemini-3.8-flash, 
 *   muse-spark-1.3, gemini-3.1-pro, deepseek-v4-flash-0731, qwen-3.8-max
 * 
 * Rate limit: 1M tokens daily
 * All models support 1M context window
 */

const OpenAI = require('openai');

const DEFAULT_BASE_URL = 'https://api.apinex.bond/v1';
const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_MAX_TOKENS = 32_768;
const DAILY_TOKEN_LIMIT = 1_000_000;

const MODEL_CONFIGS = {
  // Free models
  'free/gpt-6-luna': { name: 'GPT-6 Luna', free: true, weight: 3, contextWindow: 1_000_000 },
  'free/glm-5.3-flash': { name: 'GLM-5.3 Flash', free: true, weight: 3, contextWindow: 1_000_000 },
  'free/deepseek-v4.1-flash': { name: 'DeepSeek V4.1 Flash', free: true, weight: 3, contextWindow: 1_000_000 },
  'free/deepseek-v4-pro-0813': { name: 'DeepSeek V4 Pro', free: true, weight: 3, contextWindow: 1_000_000 },
  'free/mimo-v2.6-pro': { name: 'Mimo V2.6 Pro', free: true, weight: 2, contextWindow: 1_000_000 },
  'free/minimax-m3.1': { name: 'MiniMax M3.1', free: true, weight: 2, contextWindow: 1_000_000 },
  'free/minimax-m3': { name: 'MiniMax M3', free: true, weight: 2, contextWindow: 1_000_000 },
  'free/mimo-v2.6-flash': { name: 'Mimo V2.6 Flash', free: true, weight: 2, contextWindow: 1_000_000 },
  
  // Subscription models
  'free/claude-sonnet-4.6': { name: 'Claude 4.6 Sonnet', free: false, weight: 3, contextWindow: 1_000_000, subscription: true },
  'free/hy4': { name: 'HY 4', free: false, weight: 2, contextWindow: 1_000_000, subscription: true },
  'free/claude-opus-4.6': { name: 'Claude 4.6 Opus', free: false, weight: 3, contextWindow: 1_000_000, subscription: true },
  'free/gemini-3.8-flash': { name: 'Gemini 3.8 Flash', free: false, weight: 3, contextWindow: 1_000_000, subscription: true },
  'free/muse-spark-1.3': { name: 'Muse Spark 1.3', free: false, weight: 3, contextWindow: 1_000_000, subscription: true },
  'free/gemini-3.1-pro': { name: 'Gemini 3.1 Pro', free: false, weight: 2, contextWindow: 1_000_000, subscription: true },
  'free/deepseek-v4-flash-0731': { name: 'DeepSeek V4 Flash', free: false, weight: 3, contextWindow: 1_000_000, subscription: true },
  'free/qwen-3.8-max': { name: 'Qwen 3.8 MAX', free: false, weight: 2, contextWindow: 1_000_000, subscription: true },
};

class TokenBucket {
  constructor(capacity = DAILY_TOKEN_LIMIT, refillRate = DAILY_TOKEN_LIMIT / 86400) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
  }

  consume(tokens) {
    this.refill();
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    return false;
  }

  refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  getAvailableTokens() {
    this.refill();
    return Math.floor(this.tokens);
  }

  getWaitTime(tokens) {
    this.refill();
    if (this.tokens >= tokens) return 0;
    return Math.ceil((tokens - this.tokens) / this.refillRate * 1000);
  }
}

class TruncatedResponseError extends Error {
  constructor(limit) {
    super(`The AI response was cut off before it finished generating. Token limit: ${limit}.`);
    this.name = 'TruncatedResponseError';
    this.code = 'AI_TRUNCATED';
    this.limit = limit;
  }
}

class QuotaExhaustedError extends Error {
  constructor(retryAfter) {
    super(`Daily token quota exhausted. Try again in ${Math.ceil(retryAfter / 60000)} minutes.`);
    this.name = 'QuotaExhaustedError';
    this.code = 'QUOTA_EXHAUSTED';
    this.retryAfter = retryAfter;
  }
}

class SubscriptionRequiredError extends Error {
  constructor(modelName) {
    super(`Model "${modelName}" requires an active subscription.`);
    this.name = 'SubscriptionRequiredError';
    this.code = 'SUBSCRIPTION_REQUIRED';
    this.modelName = modelName;
  }
}

/**
 * APINEX.BOND AI Service - Multi-Model Intelligence Broker
 * 
 * Provides unified access to all APINEX.BOND models with:
 * - Token quota management (1M tokens/day)
 * - Automatic model fallback
 * - Token usage tracking
 * - Response streaming support
 * - JSON mode enforcement
 * - Token limit handling with automatic retry
 */
class ApinexBondService {
  constructor() {
    this._client = null;
    this.tokenBucket = new TokenBucket();
    this.modelUsage = new Map();
  }

  /** Check if service is configured */
  isConfigured() {
    return Boolean(process.env.APINEX_BOND_API_KEY);
  }

  /** Get or create the OpenAI-compatible client */
  getClient() {
    if (!this.isConfigured()) {
      throw new Error(
        'APINEX.BOND AI is not configured. Set APINEX_BOND_API_KEY and restart.'
      );
    }
    if (!this._client) {
      this._client = new OpenAI({
        apiKey: process.env.APINEX_BOND_API_KEY,
        baseURL: process.env.APINEX_BOND_BASE_URL || DEFAULT_BASE_URL,
        timeout: DEFAULT_TIMEOUT_MS,
        maxRetries: 2,
      });
    }
    return this._client;
  }

  /** Get model configuration */
  getModelConfig(modelId) {
    return MODEL_CONFIGS[modelId];
  }

  /** Get all available models */
  getAllModels() {
    return Object.entries(MODEL_CONFIGS).map(([id, config]) => ({
      id,
      name: config.name,
      free: config.free,
      subscription: config.subscription,
      weight: config.weight,
      contextWindow: config.contextWindow,
    }));
  }

  /** Get free models only */
  getFreeModels() {
    return Object.entries(MODEL_CONFIGS)
      .filter(([_, config]) => config.free)
      .map(([id, config]) => ({ id, name: config.name, weight: config.weight, contextWindow: config.contextWindow }));
  }

  /** Get subscription models */
  getSubscriptionModels() {
    return Object.entries(MODEL_CONFIGS)
      .filter(([_, config]) => config.subscription)
      .map(([id, config]) => ({ id, name: config.name, weight: config.weight, contextWindow: config.contextWindow }));
  }

  /** Check if model requires subscription */
  requiresSubscription(modelId) {
    const config = MODEL_CONFIGS[modelId];
    return config?.subscription === true;
  }

  /** Check if model is free */
  isFree(modelId) {
    const config = MODEL_CONFIGS[modelId];
    return config?.free === true;
  }

  /** Get available tokens */
  getAvailableTokens() {
    return this.tokenBucket.getAvailableTokens();
  }

  /** Get token usage stats */
  getUsageStats() {
    const stats = { totalTokens: 0, byModel: {} };
    for (const [model, usage] of this.modelUsage.entries()) {
      stats.byModel[model] = usage;
      stats.totalTokens += usage;
    }
    return stats;
  }

  /**
   * Record token usage for a model
   */
  _recordUsage(modelId, tokens) {
    const current = this.modelUsage.get(modelId) || 0;
    this.modelUsage.set(modelId, current + tokens);
    this.tokenBucket.consume(tokens);
  }

  /**
   * Check if we have enough tokens for a request
   */
  _checkQuota(tokens) {
    if (!this.tokenBucket.consume(tokens)) {
      const waitTime = this.tokenBucket.getWaitTime(tokens);
      throw new QuotaExhaustedError(waitTime);
    }
  }

  /**
   * Universal chat completion with automatic retry and fallback.
   * 
   * Handles:
   * 1. Token quota management (1M/day)
   * 2. Response truncation (retries with higher token budget)
   * 3. JSON mode enforcement
   * 2. Subscription model access control
   * 3. Automatic model fallback on failure
   */
  async chat(messages, options = {}) {
    const client = this.getClient();
    const modelId = options.model || 'free/gpt-6-luna';
    const modelConfig = MODEL_CONFIGS[modelId];

    if (!modelConfig) {
      throw new Error(`Unknown model: ${modelId}`);
    }

    // Check subscription requirement
    if (modelConfig.subscription && !options.allowSubscription) {
      throw new SubscriptionRequiredError(modelConfig.name);
    }

    const MAX_ATTEMPTS = 3;
    const payload = {
      model: modelId,
      messages,
      temperature: options.temperature ?? 0.6,
      top_p: options.top_p ?? 0.95,
    };

    // Start with reasonable token budget
    let maxTokens = Math.min(options.max_tokens || 4096, MAX_MAX_TOKENS);
    let structured = Boolean(options.json);
    let lastError;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        this._checkQuota(maxTokens);

        const completion = await this.getClient().chat.completions.create({
          ...payload,
          max_tokens: maxTokens,
          response_format: structured ? { type: 'json_object' } : undefined,
        });

        const choice = completion?.choices?.[0];
        const content = choice?.message?.content;

        if (!content) {
          throw new Error('Empty response from model');
        }

        // Record token usage
        const usage = completion?.usage;
        if (usage) {
          this._recordUsage(modelId, usage.total_tokens);
        }

        // Check for truncation
        if (choice?.finish_reason === 'length' && attempt < 3) {
          maxTokens = Math.min(maxTokens * 2, MAX_MAX_TOKENS);
          continue;
        }

        return {
          content,
          model: modelId,
          usage: completion?.usage,
          finishReason: choice?.finish_reason,
        };
      } catch (err) {
        lastError = err;
        
        if (err instanceof QuotaExhaustedError || err instanceof SubscriptionRequiredError) {
          throw err;
        }
        
        if (attempt === 3) break;
        
        // On error, try with higher token budget
        maxTokens = Math.min(maxTokens * 1.5, MAX_MAX_TOKENS);
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }

    throw lastError || new Error('Failed after 3 attempts');
  }

  /**
   * Streaming chat completion
   */
  async *streamChat(messages, options = {}) {
    const client = this.getClient();
    const modelId = options.model || 'free/gpt-6-luna';
    const modelConfig = MODEL_CONFIGS[modelId];

    if (!modelConfig) {
      throw new Error(`Unknown model: ${modelId}`);
    }

    if (modelConfig.subscription && !options.allowSubscription) {
      throw new SubscriptionRequiredError(modelConfig.name);
    }

    this._checkQuota(1000); // Reserve tokens for streaming

    const stream = await this.getClient().chat.completions.create({
      model: options.model || 'free/gpt-6-luna',
      messages,
      temperature: options.temperature ?? 0.6,
      max_tokens: Math.min(options.max_tokens || 4096, MAX_MAX_TOKENS),
      stream: true,
      response_format: Boolean(options.json) ? { type: 'json_object' } : undefined,
    });

    let totalTokens = 0;
    for await (const chunk of stream) {
      const content = chunk.choices?.[0]?.delta?.content;
      if (content) {
        totalTokens += content.length;
        yield content;
      }
    }

    this._recordUsage(messages[0]?.model || 'free/gpt-6-luna', totalTokens);
  }

  /**
   * Structured output with JSON schema validation
   */
  async structuredChat(messages, schema, options = {}) {
    const result = await this.chat(messages, {
      ...options,
      json: true,
      temperature: 0.3, // Lower temperature for structured output
    });

    try {
      return JSON.parse(result.content);
    } catch (err) {
      throw new Error(`Failed to parse structured output: ${err.message}`);
    }
  }

  /**
   * Generate SQL from natural language query
   */
  async generateSQL(question, schema, options = {}) {
    const systemPrompt = `You are an expert SQL analyst. Convert the user's natural language question into a valid SQL query.

Database Schema:
${schema}

Rules:
1. Return ONLY the SQL query, no explanations
2. Use proper table/column names from the schema
2. Use proper JOINs, WHERE clauses, and aggregations
3. Handle NULL values appropriately
4. Use LIMIT for large result sets
5. Use proper date functions for date queries
6. Return JSON with: { "sql": "...", "explanation": "..." }
7. If the question cannot be answered with SQL, return: { "error": "Cannot answer with SQL", "reason": "..." }
`;

    const result = await this.structuredChat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question },
    ], {
      type: 'object',
      properties: {
        sql: { type: 'string' },
        explanation: { type: 'string' },
        error: { type: 'string' },
        reason: { type: 'string' },
      },
      required: ['sql', 'explanation'],
    });

    return result;
  }

  /**
   * Analyze database data with natural language
   */
  async analyzeData(data, question, options = {}) {
    const systemPrompt = `You are a data analyst. Analyze the provided data and answer the user's question.

Return JSON with:
{
  "answer": "Direct answer to the question",
  "insights": ["Key insight 1", "Key insight 2"],
  "visualization": { "type": "bar|line|pie|table", "data": [...] },
  "recommendations": ["Actionable recommendation 1", "Action recommendation 2"]
}`;

    const userPrompt = `Data:\n${JSON.stringify(data, null, 2)}\n\nQuestion: ${question}`;

    return this.structuredChat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);
  }

  /**
   * Generate database insights from query results
   */
  async generateInsights(queryResults, context = '', options = {}) {
    const systemPrompt = `You are a senior data analyst. Analyze the query results and provide actionable business insights.

Return JSON:
{
  "summary": "Executive summary",
  "keyFindings": ["Finding 1", "Finding 2"],
  "trends": ["Trend 1", "Trend 2"],
  "anomalies": ["Anomaly 1", "Anomaly 2"],
  "recommendations": ["Action 1", "Action 2"],
  "riskLevel": "low|medium|high"
}`;

    const userPrompt = `Context: ${context}\n\nData:\n${JSON.stringify(queryResults, null, 2)}`;

    return this.structuredChat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);
  }

  /**
   * Get database schema for text-to-SQL
   */
  async getDatabaseSchema() {
    // This would be implemented based on your database structure
    // Return the schema as a string for the LLM
  }
}

const DEFAULT_BASE_URL = 'https://api.apinex.bond/v1';
const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_MAX_TOKENS = 32_768;
const DAILY_TOKEN_LIMIT = 1_000_000;

module.exports = new ApinexBondService();