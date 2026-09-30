const nimService = require('../services/nimService');

/**
 * POST /api/ai/rules/generate
 * Body: { prompt: string, type?: 'ASIN', existingRules?: array }
 * Uses NVIDIA NIM to generate ruleset rules from natural language.
 */
exports.generateRules = async (req, res) => {
  try {
    const { prompt, type = 'ASIN', existingRules = [] } = req.body;

    if (!prompt || !String(prompt).trim()) {
      return res.status(400).json({ success: false, message: 'Prompt is required' });
    }

    if (!process.env.NVIDIA_NIM_API_KEY) {
      return res.status(503).json({
        success: false,
        message: 'NVIDIA NIM API key not configured. Set NVIDIA_NIM_API_KEY to enable AI rule generation.'
      });
    }

    const systemPrompt = `You are RetailOps AI — an expert e-commerce operations assistant that creates automation rules for Amazon ASINs.

The user will describe what they want to monitor or automate (in plain English). You must return a JSON object describing one or more rules that will evaluate against ASIN data and trigger actions.

AVAILABLE ATTRIBUTES (case-sensitive, use EXACTLY these values):
- Listing Quality: lqs (0-100), titleScore (0-100), bulletScore (0-100), imageScore (0-100), descriptionScore (0-100), imagesCount, bulletPoints, hasAplus (true/false)
- Price & Buybox: priceDispute (true/false), uploadedPrice, currentPrice, mrp, discountPercentage (0-100), buyBoxWin (true/false), hasDeal (true/false), dealBadge (text)
- Inventory: stockLevel (number), availabilityStatus (enum: In stock/Out of Stock/Available/Currently unavailable)
- Performance: bsr, subBsr, bsrTrend (enum: Grow/Down/Stable), rating (1-5), reviewCount, ratingTrend (enum: Grow/Down/Stable), totalOrders
- Ads: ads (true/false)
- Filters: tags (list), category (text), brand (text), seller (text), asinStatus (enum: Active/Error/Archived)

AVAILABLE OPERATORS:
- Numbers: =, ≠, <, <=, >, >=, between, is empty, is not empty
- Text/enum: =, ≠, contains, not contains, starts with, is empty, is not empty
- Boolean: = (use value "true" or "false")
- List (tags): contains, not contains, =, ≠

AVAILABLE ACTIONS (use EXACTLY these actionType values):
- create_task (auto-create task, supports priority: Critical/High/Medium/Low)
- create_task_high (urgent task)
- create_group_task (groups into one task per seller/category/brand; set groupBy, priority, sopPreset: pricing|listing|inventory|auto)
- send_notification (in-app)
- send_email (email alert)
- add_tag (set value to the tag name)
- remove_tag (set value to the tag name)
- flag_review (mark for manual review)

Return ONLY a valid JSON object (no markdown, no commentary) with this exact shape:
{
  "name": "<short, descriptive ruleset name, e.g. 'Low LQS Alert'>",
  "description": "<one-sentence description>",
  "isAutomated": <true|false>,
  "runFrequency": "<Daily|Weekly|Hourly>",
  "runTime": "<e.g. '08 AM'>",
  "rules": [
    {
      "name": "<short rule name>",
      "isActive": true,
      "conditions": [
        { "attribute": "<attr>", "operator": "<op>", "value": "<value>", "value2": "<for between>", "logicalOp": "AND" }
      ],
      "action": { "actionType": "<action>", "priority": "<Medium|High|Critical>", "value": "<for add/remove tag>" }
    }
  ],
  "reasoning": "<brief 1-2 sentence explanation of what this ruleset does and why the thresholds were chosen>"
}

Use sensible thresholds (e.g. LQS below 70 is poor, rating below 3.5 is bad, BSR under 5000 is top-ranked). Use between for ranges. Use group tasks for widespread issues so they don't spam one-task-per-ASIN.`;

    const userContent = `${existingRules && existingRules.length ? `The user already has these rules, avoid duplicating them: ${JSON.stringify(existingRules.slice(0, 5))}\n\n` : ''}Create automation rules for this request:\n\n"${prompt}"`;

    const response = await nimService.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ], {
      model: 'openai/gpt-oss-20b',
      temperature: 0.4,
      max_tokens: 2048,
      json: true,
    });

    const generated = nimService.cleanJSON(response);

    // Validate and sanitize
    if (!generated.rules || !Array.isArray(generated.rules)) {
      return res.status(502).json({ success: false, message: 'AI returned invalid response (no rules array)' });
    }

    // Normalize: ensure each rule has expected shape
    const validOps = new Set(['=', '≠', '<', '<=', '>', '>=', 'between', 'contains', 'not contains', 'starts with', 'is empty', 'is not empty']);
    const validActions = new Set(['create_task', 'create_task_high', 'create_group_task', 'send_notification', 'send_email', 'add_tag', 'remove_tag', 'flag_review']);

    generated.rules = generated.rules.map((r, i) => ({
      order: i,
      name: r.name || `Rule ${i + 1}`,
      isActive: r.isActive !== false,
      conditions: Array.isArray(r.conditions) ? r.conditions
        .filter(c => c && c.attribute && validOps.has(c.operator))
        .map(c => ({
          attribute: c.attribute,
          operator: c.operator,
          value: c.value ?? '',
          value2: c.value2 ?? '',
          logicalOp: c.logicalOp === 'OR' ? 'OR' : 'AND',
        })) : [],
      action: {
        actionType: validActions.has(r.action?.actionType) ? r.action.actionType : 'create_task',
        value: r.action?.value || '',
        priority: r.action?.priority || 'Medium',
        groupBy: r.action?.groupBy || 'seller',
        sopPreset: r.action?.sopPreset || 'auto',
      },
    })).filter(r => r.conditions.length > 0);

    if (generated.rules.length === 0) {
      return res.status(502).json({ success: false, message: 'AI could not create valid rules from that prompt. Try being more specific.' });
    }

    res.json({
      success: true,
      data: {
        name: generated.name || 'AI Generated Rule',
        description: generated.description || '',
        type: type,
        isAutomated: generated.isAutomated !== false,
        runFrequency: generated.runFrequency || 'Daily',
        runTime: generated.runTime || '08 AM',
        rules: generated.rules,
        reasoning: generated.reasoning || '',
      }
    });
  } catch (error) {
    console.error('[AI Rules] Generation error:', error);
    res.status(500).json({ success: false, message: error.message || 'AI generation failed' });
  }
};

/**
 * POST /api/ai/rules/explain
 * Body: { rules: array }
 * Returns a human-readable explanation of what a ruleset will do.
 */
exports.explainRules = async (req, res) => {
  try {
    const { rules } = req.body;
    if (!rules || !Array.isArray(rules)) {
      return res.status(400).json({ success: false, message: 'rules array required' });
    }

    if (!process.env.NVIDIA_NIM_API_KEY) {
      // Graceful fallback: generate a simple text explanation
      const simple = rules.map((r, i) => `Rule ${i + 1}: ${r.name} — ${r.conditions?.map(c => `${c.attribute} ${c.operator} ${c.value}${c.value2 ? '–' + c.value2 : ''}`).join(' AND ')} → ${r.action?.actionType}`).join('\n');
      return res.json({ success: true, data: { explanation: simple } });
    }

    const response = await nimService.chat([
      { role: 'system', content: 'You explain automation rules in plain English for non-technical operations managers. Keep it concise (3–5 lines). Mention thresholds and what action will be taken.' },
      { role: 'user', content: `Explain this ruleset simply:\n${JSON.stringify(rules)}` }
    ], { temperature: 0.3, max_tokens: 400 });

    res.json({ success: true, data: { explanation: response.trim() } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
