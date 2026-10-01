const nimService = require('../services/nimService');
const {
  buildSystemPrompt,
  buildUserPrompt,
  validateRuleset,
  RUN_FREQUENCIES,
} = require('../prompts/ruleGenerationPrompt');

const MAX_PROMPT_LENGTH = 2000;
const MAX_EXISTING_RULES = 8;

/**
 * POST /api/strategy/rules/generate
 * Body: { prompt: string, type?: 'ASIN', existingRules?: array, context?: { seller?, category? } }
 *
 * Turns a plain-English operations request into an executable ruleset. The
 * model's output is validated against the engine's real attribute/operator
 * contract before it is returned, so an unusable ruleset is reported rather
 * than silently saved.
 */
exports.generateRules = async (req, res) => {
  try {
    const { prompt, type = 'ASIN', existingRules = [], context = {} } = req.body || {};

    const cleanPrompt = typeof prompt === 'string' ? prompt.trim() : '';
    if (!cleanPrompt) {
      return res.status(400).json({
        success: false,
        message: 'Describe what you want to automate before generating a ruleset.',
      });
    }
    if (cleanPrompt.length > MAX_PROMPT_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Request is too long. Keep it under ${MAX_PROMPT_LENGTH} characters.`,
      });
    }

    // Unconfigured AI is a deployment state, not a user error: report it
    // plainly instead of failing the whole AI module on boot.
    if (!nimService.isConfigured()) {
      return res.status(503).json({
        success: false,
        code: 'AI_NOT_CONFIGURED',
        message: 'AI rule generation is not configured on this server. Ask an admin to set NVIDIA_NIM_API_KEY.',
      });
    }

    const userContent = buildUserPrompt(
      { prompt: cleanPrompt, seller: context?.seller, category: context?.category },
      Array.isArray(existingRules) ? existingRules.slice(0, MAX_EXISTING_RULES) : []
    );

    const raw = await nimService.chat(
      [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: userContent },
      ],
      {
        temperature: 0.2, // low: this is a constrained generation task, not creative writing
        max_tokens: 2048,
        json: true,
      }
    );

    const generated = nimService.cleanJSON(raw);
    const { rules, warnings } = validateRuleset(generated);

    if (!rules.length) {
      return res.status(502).json({
        success: false,
        code: 'NO_VALID_RULES',
        message:
          'The AI could not produce any valid rules from that request. Try naming a specific metric and threshold, e.g. "flag ASINs where LQS is below 70".',
        warnings,
      });
    }

    const runFrequency = RUN_FREQUENCIES.includes(generated.runFrequency)
      ? generated.runFrequency
      : 'Daily';

    res.json({
      success: true,
      data: {
        name: typeof generated.name === 'string' && generated.name.trim()
          ? generated.name.trim()
          : 'AI Generated Ruleset',
        description: typeof generated.description === 'string' ? generated.description : '',
        type,
        isAutomated: generated.isAutomated !== false,
        runFrequency,
        runTime: typeof generated.runTime === 'string' && generated.runTime.trim()
          ? generated.runTime.trim()
          : '08 AM',
        rules,
        reasoning: typeof generated.reasoning === 'string' ? generated.reasoning : '',
        warnings,
      },
    });
  } catch (error) {
    console.error('[AI Rules] Generation error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'AI rule generation failed. Please try again.',
    });
  }
};

const EXPLAIN_SYSTEM_PROMPT = `You explain Amazon operations automation rules to non-technical operations managers.

Rules in plain words:
- "is empty" / "is not empty" means the field has no value / has a value.
- BSR: a LOWER number is a better rank.
- A group task creates ONE task per group (seller, category, brand, BSR band or price band) instead of one task per ASIN.

Rules of your reply:
- 3 to 5 short lines. No preamble, no headings, no markdown.
- Say what will be monitored, which threshold triggers it, and what happens next.
- If a rule looks like it would fire very often, say so in one line.`;

const MAX_EXPLAIN_RULES = 20;

/**
 * POST /api/strategy/rules/explain
 * Body: { rules: array }
 * Returns a human-readable explanation of what a ruleset will do.
 */
exports.explainRules = async (req, res) => {
  try {
    const { rules } = req.body || {};
    if (!Array.isArray(rules) || !rules.length) {
      return res.status(400).json({ success: false, message: 'rules array required' });
    }

    if (!nimService.isConfigured()) {
      // Graceful fallback: a plain text summary so the UI still works.
      const summary = rules
        .slice(0, MAX_EXPLAIN_RULES)
        .map((r, i) => {
          const conditions = (r.conditions || [])
            .map((c) => `${c.attribute} ${c.operator} ${c.value ?? ''}${c.value2 ? ' and ' + c.value2 : ''}`)
            .join(' AND ');
          return `Rule ${i + 1}: ${r.name || 'Untitled'} — ${conditions} → ${r.action?.actionType || 'create_task'}`;
        })
        .join('\n');
      return res.json({
        success: true,
        data: { explanation: summary, degraded: true },
      });
    }

    const content = await nimService.chat(
      [
        { role: 'system', content: EXPLAIN_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Explain this ruleset:\n${JSON.stringify(rules.slice(0, MAX_EXPLAIN_RULES), null, 2)}`,
        },
      ],
      { temperature: 0.3, max_tokens: 500 }
    );

    res.json({ success: true, data: { explanation: content.trim() } });
  } catch (error) {
    console.error('[AI Rules] Explain error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};
