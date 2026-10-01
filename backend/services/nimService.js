const OpenAI = require('openai');

const DEFAULT_MODEL = 'openai/gpt-oss-20b';
const DEFAULT_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_MAX_TOKENS = 16_384;

class TruncatedResponseError extends Error {
  constructor(limit) {
    super(
      'The AI response was cut off before it finished generating. Please try again.'
    );
    this.name = 'TruncatedResponseError';
    this.code = 'AI_TRUNCATED';
    this.limit = limit;
  }
}

/**
 * NIM Service - Centralized Intelligence Broker
 * Standardizes access to NVIDIA NIM infrastructure.
 *
 * The client is built lazily. Constructing it eagerly made `require()` of this
 * module throw when NVIDIA_NIM_API_KEY was absent, which crashed the entire
 * server at boot (server.js requires aiRoutes unconditionally) — an AI feature
 * being unconfigured must never take the API down.
 */
class NIMService {
  constructor() {
    this._client = null;
  }

  /** True when the NIM key is present. */
  isConfigured() {
    return Boolean(process.env.NVIDIA_NIM_API_KEY);
  }

  /**
   * Lazily built client. Throws a clear, actionable error when unconfigured.
   *
   * The key is read strictly from NVIDIA_NIM_API_KEY. The OpenAI SDK would
   * otherwise fall back to OPENAI_API_KEY and silently send this traffic to
   * api.openai.com instead of NVIDIA.
   */
  getClient() {
    if (!this.isConfigured()) {
      throw new Error(
        'AI is not configured on this server. Set NVIDIA_NIM_API_KEY and restart.'
      );
    }
    if (!this._client) {
      this._client = new OpenAI({
        apiKey: process.env.NVIDIA_NIM_API_KEY,
        baseURL: process.env.NVIDIA_NIM_BASE_URL || DEFAULT_BASE_URL,
        timeout: DEFAULT_TIMEOUT_MS,
        maxRetries: 2,
      });
    }
    return this._client;
  }

  /**
   * Universal chat completion.
   *
   * Handles the two failure modes that actually bite on this endpoint:
   *
   * 1. Truncation. The hosted models are reasoning models, and `reasoning_content`
   *    is billed against `max_tokens`. A budget that looks generous for the
   *    visible answer can be exhausted before the answer is finished, which
   *    returns `finish_reason: 'length'` and half a JSON object. That is
   *    retried once with a doubled budget.
   * 2. Unsupported `response_format`. Not every NIM-hosted model accepts it, so
   *    a rejection caused by that parameter alone is retried without it.
   */
  async chat(messages, options = {}) {
    const client = this.getClient();
    const MAX_ATTEMPTS = 3;

    const payload = {
      model: options.model || DEFAULT_MODEL,
      messages,
      temperature: options.temperature ?? 0.6,
    };

    // Start high enough to leave room for the model's reasoning tokens; grows on truncation.
    let maxTokens = Math.min(options.max_tokens || 4096, MAX_MAX_TOKENS);
    let structured = Boolean(options.json);
    let lastError;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const completion = await client.chat.completions.create({
          ...payload,
          max_tokens: maxTokens,
          response_format: structured ? { type: 'json_object' } : undefined,
        });

        const choice = completion?.choices?.[0];
        const content = choice?.message?.content;

        if (choice?.finish_reason === 'length') {
          lastError = new TruncatedResponseError(maxTokens);
          if (maxTokens >= MAX_MAX_TOKENS) throw lastError;
          maxTokens = Math.min(maxTokens * 3, MAX_MAX_TOKENS);
          console.warn(
            `[NIM Service] Truncated at max_tokens; retrying with ${maxTokens} (attempt ${attempt + 1}).`
          );
          continue;
        }

        if (!content || !content.trim()) {
          throw new Error('AI returned an empty response.');
        }
        return content;
      } catch (error) {
        if (error instanceof TruncatedResponseError) throw error;
        lastError = error;

        // Only drop response_format if the model rejected that parameter.
        const rejectedStructuredOutput =
          structured && [400, 404, 422].includes(error?.status);
        if (rejectedStructuredOutput && attempt < MAX_ATTEMPTS) {
          structured = false;
          console.warn('[NIM Service] Model rejected response_format, retrying without it.');
          continue;
        }
        throw new Error(`AI inference failed: ${error?.message || 'unknown error'}`);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('AI inference failed.');
  }

  /**
   * Tolerates the fenced / chatty JSON that instruction-following models
   * sometimes emit despite being told to return bare JSON.
   */
  cleanJSON(content) {
    const raw = String(content ?? '').trim();
    if (!raw) throw new Error('AI returned an empty response.');

    // Strip a markdown fence if present.
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = (fenced ? fenced[1] : raw).trim();

    try {
      return JSON.parse(candidate);
    } catch { /* fall through to extraction */ }

    // Fall back to the outermost {...} or [...] span.
    const firstObj = candidate.indexOf('{');
    const firstArr = candidate.indexOf('[');
    let start = -1;
    let endChar = '}';
    if (firstObj !== -1 && (firstArr === -1 || firstObj < firstArr)) {
      start = firstObj;
    } else if (firstArr !== -1) {
      start = firstArr;
      endChar = ']';
    }

    if (start !== -1) {
      const end = candidate.lastIndexOf(endChar);
      if (end > start) {
        try {
          return JSON.parse(candidate.slice(start, end + 1));
        } catch { /* fall through to the error below */ }
      }
    }

    console.error('[NIM Service] JSON Parse Error. Raw content was:', candidate.slice(0, 500));
    throw new Error('AI returned malformed JSON.');
  }
}

module.exports = new NIMService();
module.exports.NIMService = NIMService;
