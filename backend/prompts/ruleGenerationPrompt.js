/**
 * Single source of truth for AI-generated rulesets.
 *
 * Everything the model is told about attributes, operators and actions is
 * derived from the same tables the ruleset engine executes against. An
 * attribute the engine cannot map is silently dropped at rule time, so the
 * prompt and the engine must never drift apart — hence the assertions at the
 * bottom of this file.
 */

const {
  RULE_ATTRIBUTE_COLUMNS,
  RULE_GROUP_BY_FIELDS,
} = require('../services/rulesetEngineService');

// ── Typed attribute spec ────────────────────────────────────────────────────
// `type` drives which operators are legal (see OPERATORS_BY_TYPE).
// `range` is [min, max] and is enforced server-side on the model's output.
const ATTRIBUTE_SPEC = {
  // Listing Quality
  lqs: { type: 'number', range: [0, 100], desc: 'Listing Quality Score (0-100)' },
  titleScore: { type: 'number', range: [0, 100], desc: 'Title quality score (0-100)' },
  bulletScore: { type: 'number', range: [0, 100], desc: 'Bullet points quality score (0-100)' },
  imageScore: { type: 'number', range: [0, 100], desc: 'Image quality score (0-100)' },
  descriptionScore: { type: 'number', range: [0, 100], desc: 'Description quality score (0-100)' },
  imagesCount: { type: 'number', range: [0, 1000], desc: 'Number of product images' },
  bulletPoints: { type: 'number', range: [0, 20], desc: 'Number of bullet points' },
  hasAplus: { type: 'boolean', desc: 'Whether A+ Content is present' },

  // Price & Buybox
  priceDispute: { type: 'boolean', desc: 'Channel price differs from marketplace price by over ₹5' },
  uploadedPrice: { type: 'number', range: [0, 1000000], desc: 'Channel price set by the team (₹)' },
  currentPrice: { type: 'number', range: [0, 1000000], desc: 'Live marketplace price (₹)' },
  mrp: { type: 'number', range: [0, 1000000], desc: 'Maximum Retail Price (₹)' },
  discountPercentage: { type: 'number', range: [0, 100], desc: 'Discount from MRP (%)' },
  buyBoxWin: { type: 'boolean', desc: 'Our seller is winning the BuyBox' },
  hasDeal: { type: 'boolean', desc: 'Has an active deal badge' },
  dealBadge: { type: 'text', desc: 'Type of active deal, e.g. Lightning Deal' },

  // Inventory
  stockLevel: { type: 'number', range: [0, 1000000], desc: 'Current stock on hand (units)' },
  availabilityStatus: {
    type: 'enum',
    options: ['In stock', 'Out of Stock', 'Available', 'Currently unavailable'],
    desc: 'Marketplace availability status',
  },

  // Performance
  bsr: { type: 'number', range: [0, 10000000], desc: 'Best Seller Rank in main category (lower is better)' },
  subBsr: { type: 'number', range: [0, 10000000], desc: 'Best Seller Rank in sub-category (lower is better)' },
  bsrTrend: { type: 'enum', options: ['Grow', 'Down', 'Stable'], desc: 'BSR movement direction' },
  rating: { type: 'number', range: [0, 5], desc: 'Average customer rating (1-5)' },
  ratingTrend: { type: 'enum', options: ['Grow', 'Down', 'Stable'], desc: 'Rating movement direction' },
  reviewCount: { type: 'number', range: [0, 10000000], desc: 'Total customer reviews' },

  // Ads & filters
  ads: { type: 'boolean', desc: 'An ads campaign is running' },
  asinStatus: { type: 'enum', options: ['Active', 'Error', 'Archived'], desc: 'ASIN sync state' },
  category: { type: 'text', desc: 'Product category' },
  brand: { type: 'text', desc: 'Product brand' },
  seller: { type: 'text', desc: 'Seller or brand account' },
};

/**
 * Attributes the rule builder UI offers but the engine cannot execute in its
 * primary (SQL prefilter) path — `buildSqlFilter` does `if (!col) continue`,
 * so a condition on these is discarded with no error and the rule looks set up
 * but never fires. `totalOrders` is a computed subquery and `tags` is a JSON
 * string column, so neither can be added to the column map as-is.
 *
 * They are deliberately NOT advertised to the model: offering an attribute
 * that silently never matches is worse than not offering it. Fixing the SQL
 * path is an engine change, tracked separately.
 */
const ENGINE_UNSUPPORTED_ATTRIBUTES = ['totalOrders', 'tags'];

// Operators the engine actually implements, per data type.
// Anything outside these lists makes the condition evaluate to false forever.
const OPERATORS_BY_TYPE = {
  number: ['=', '≠', '<', '<=', '>', '>=', 'between', 'is empty', 'is not empty'],
  text: ['=', '≠', 'contains', 'not contains', 'starts with', 'is empty', 'is not empty'],
  enum: ['=', '≠'],
  boolean: ['=', '≠'],
  list: ['contains', 'not contains', '=', '≠', 'is empty', 'is not empty'],
};

const ACTION_TYPES = [
  'create_task',
  'create_task_high',
  'create_group_task',
  'send_notification',
  'send_email',
  'add_tag',
  'remove_tag',
  'flag_review',
];

const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];
const SOP_PRESETS = ['auto', 'pricing', 'listing', 'inventory', 'custom'];
const RUN_FREQUENCIES = ['Daily', 'Every 12 hours', 'Weekly'];
const LOGICAL_OPS = ['AND', 'OR'];

// Default thresholds, so the model stops inventing its own on every run.
const THRESHOLD_GUIDE = [
  'lqs < 70 — poor listing quality; 70-84 acceptable; 85+ good',
  'rating < 3.5 — customers are unhappy; < 3.0 is a reputation risk',
  'bsr < 5000 — top ranking; > 50000 — losing visibility',
  'imagesCount < 5 — thin gallery, Amazon expects 7+',
  'bulletPoints < 4 — under-optimised listing',
  'stockLevel < 10 — low stock risk for any active ad',
  'discountPercentage > 60 — margin pressure, verify against MRP',
  'buyBoxWin = false — losing the BuyBox to a competitor',
];

// ── Drift guards ───────────────────────────────────────────────────────────
// Fail loudly at boot rather than let the model learn an unusable vocabulary.
(function assertNoDrift() {
  const promptOnly = Object.keys(ATTRIBUTE_SPEC).filter((a) => !RULE_ATTRIBUTE_COLUMNS[a]);
  if (promptOnly.length) {
    throw new Error(
      `[ruleGenerationPrompt] attributes not executable by the engine: ${promptOnly.join(', ')}`
    );
  }
  // The inverse is not fatal: the engine may legitimately support attributes the
  // AI is not allowed to emit. But anything in that bucket that we believe is
  // broken must be listed in ENGINE_UNSUPPORTED_ATTRIBUTES so it stays visible.
  const engineOnly = Object.keys(RULE_ATTRIBUTE_COLUMNS).filter((a) => !ATTRIBUTE_SPEC[a]);
  if (engineOnly.length) {
    throw new Error(
      `[ruleGenerationPrompt] engine attributes missing from the prompt spec: ${engineOnly.join(', ')}`
    );
  }
  for (const excluded of ENGINE_UNSUPPORTED_ATTRIBUTES) {
    if (RULE_ATTRIBUTE_COLUMNS[excluded]) {
      throw new Error(
        `[ruleGenerationPrompt] "${excluded}" is listed as engine-unsupported but now maps to a column — remove it from ENGINE_UNSUPPORTED_ATTRIBUTES and add a spec.`
      );
    }
  }
  for (const [attr, spec] of Object.entries(ATTRIBUTE_SPEC)) {
    if (!OPERATORS_BY_TYPE[spec.type]) {
      throw new Error(`[ruleGenerationPrompt] unknown type "${spec.type}" for attribute "${attr}"`);
    }
  }
})();

function isValidAttribute(attr) {
  return Object.prototype.hasOwnProperty.call(ATTRIBUTE_SPEC, attr);
}

function isValidOperator(attr, operator) {
  const spec = ATTRIBUTE_SPEC[attr];
  if (!spec) return false;
  return OPERATORS_BY_TYPE[spec.type].includes(operator);
}

/**
 * Validates and normalises one condition.
 * Returns { ok: true, condition } or { ok: false, reason }.
 */
function validateCondition(raw) {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'condition is not an object' };

  const { attribute, operator } = raw;
  if (!attribute) return { ok: false, reason: 'missing attribute' };
  if (!isValidAttribute(attribute)) {
    return { ok: false, reason: `unknown attribute "${attribute}"` };
  }

  const spec = ATTRIBUTE_SPEC[attribute];

  // `is` / `is not` are engine aliases of `=` / `≠` for booleans; normalise.
  let op = operator;
  if (op === 'is') op = '=';
  if (op === 'is not') op = '≠';

  if (!isValidOperator(attribute, op)) {
    return {
      ok: false,
      reason: `operator "${operator}" is not valid for ${spec.type} attribute "${attribute}"`,
    };
  }

  const needsNoValue = op === 'is empty' || op === 'is not empty';
  let value = raw.value;
  let value2 = raw.value2;

  if (needsNoValue) {
    value = '';
    value2 = '';
  } else if (spec.type === 'number') {
    // Bare JSON numbers only — the engine does Number(value) and a string
    // that is not numeric makes the condition permanently false.
    const num = Number(value);
    if (value === '' || value === null || value === undefined || Number.isNaN(num)) {
      return { ok: false, reason: `attribute "${attribute}" requires a numeric value` };
    }
    if (spec.range) {
      const [min, max] = spec.range;
      if (num < min || num > max) {
        return { ok: false, reason: `value ${num} for "${attribute}" is outside ${min}-${max}` };
      }
    }
    value = num;
    if (op === 'between') {
      const num2 = Number(value2);
      if (value2 === '' || value2 === null || value2 === undefined || Number.isNaN(num2)) {
        return { ok: false, reason: `"between" on "${attribute}" requires a numeric value2` };
      }
      if (spec.range) {
        const [min, max] = spec.range;
        if (num2 < min || num2 > max) {
          return { ok: false, reason: `value2 ${num2} for "${attribute}" is outside ${min}-${max}` };
        }
      }
      if (num2 < num) {
        return { ok: false, reason: `"between" on "${attribute}" needs value2 >= value` };
      }
      value2 = num2;
    } else {
      value2 = '';
    }
  } else if (spec.type === 'boolean') {
    const normalised = String(value ?? '').toLowerCase();
    if (!['true', 'false'].includes(normalised)) {
      return { ok: false, reason: `attribute "${attribute}" requires value "true" or "false"` };
    }
    value = normalised;
    value2 = '';
  } else if (spec.type === 'enum') {
    const match = spec.options.find((o) => o.toLowerCase() === String(value ?? '').toLowerCase());
    if (!match) {
      return {
        ok: false,
        reason: `"${value}" is not a valid ${attribute}; allowed: ${spec.options.join(', ')}`,
      };
    }
    value = match; // engine compares case-insensitively; store the canonical casing
    value2 = '';
  } else if (spec.type === 'list') {
    if (value === '' || value === null || value === undefined) {
      return { ok: false, reason: `attribute "${attribute}" requires a non-empty value` };
    }
    value = String(value);
    value2 = '';
  } else {
    if (value === null || value === undefined) value = '';
    value = String(value);
    value2 = '';
  }

  return {
    ok: true,
    condition: {
      attribute,
      operator: op,
      value,
      value2,
      logicalOp: LOGICAL_OPS.includes(raw.logicalOp) ? raw.logicalOp : 'AND',
    },
  };
}

/**
 * The engine folds a rule's conditions left-to-right using each condition's
 * own `logicalOp`, and therefore IGNORES the first condition's operator
 * (see `evaluateRule` in rulesetEngineService). A model that labels only the
 * first condition "OR" gets AND semantics, and the builder UI would display
 * "OR" while the engine runs "AND".
 *
 * So resolve one join per rule and stamp it on every condition, which makes
 * the stored rule self-consistent and the UI honest.
 */
function resolveRuleLogicalOp(conditions) {
  const ops = conditions.map((c) => c.logicalOp);
  const orCount = ops.filter((o) => o === 'OR').length;

  if (orCount === 0) return { join: 'AND', mixed: false };
  if (orCount === ops.length) return { join: 'OR', mixed: false };

  // Mixed AND/OR in one rule is ambiguous. Prefer OR only if it dominates,
  // otherwise fall back to the stricter AND and report it.
  return {
    join: orCount * 2 > ops.length ? 'OR' : 'AND',
    mixed: true,
  };
}

/**
 * Validates a whole generated ruleset, dropping only the bad conditions and
 * reporting why. Returns rules plus a warnings array — nothing fails silently.
 */
function validateRuleset(generated) {
  const warnings = [];
  const rules = [];

  const rawRules = Array.isArray(generated?.rules) ? generated.rules : [];
  if (!rawRules.length) warnings.push('Model returned no rules.');

  rawRules.forEach((raw, i) => {
    const name = typeof raw?.name === 'string' && raw.name.trim() ? raw.name.trim() : `Rule ${i + 1}`;
    const rawConditions = Array.isArray(raw?.conditions) ? raw.conditions : [];

    if (!rawConditions.length) {
      warnings.push(`${name}: dropped, it had no conditions.`);
      return;
    }

    const conditions = [];
    rawConditions.forEach((c, ci) => {
      const result = validateCondition(c);
      if (result.ok) conditions.push(result.condition);
      else warnings.push(`${name}, condition ${ci + 1}: ${result.reason}.`);
    });

    if (!conditions.length) {
      warnings.push(`${name}: dropped, none of its conditions were valid.`);
      return;
    }

    // One join per rule, stamped on every condition (see resolveRuleLogicalOp).
    const { join, mixed } = resolveRuleLogicalOp(conditions);
    if (mixed) {
      warnings.push(`${name}: mixed AND/OR conditions were normalised to ${join}.`);
    }
    conditions.forEach((c) => { c.logicalOp = join; });

    const rawAction = raw.action || {};
    const actionType = ACTION_TYPES.includes(rawAction.actionType)
      ? rawAction.actionType
      : 'create_task';

    if (!ACTION_TYPES.includes(rawAction.actionType)) {
      warnings.push(`${name}: unknown action "${rawAction.actionType}", defaulted to create_task.`);
    }

    const priority = PRIORITIES.includes(rawAction.priority) ? rawAction.priority : 'Medium';

    // groupBy / sopPreset only mean anything for create_group_task.
    const groupBy =
      actionType === 'create_group_task' && RULE_GROUP_BY_FIELDS.includes(rawAction.groupBy)
        ? rawAction.groupBy
        : 'seller';
    if (actionType === 'create_group_task' && !RULE_GROUP_BY_FIELDS.includes(rawAction.groupBy)) {
      warnings.push(`${name}: unknown groupBy "${rawAction.groupBy}", defaulted to seller.`);
    }
    const sopPreset = SOP_PRESETS.includes(rawAction.sopPreset) ? rawAction.sopPreset : 'auto';

    rules.push({
      order: rules.length,
      name,
      isActive: raw.isActive !== false,
      conditions,
      action: {
        actionType,
        priority,
        value: typeof rawAction.value === 'string' ? rawAction.value : rawAction.value != null ? String(rawAction.value) : '',
        groupBy,
        sopPreset,
      },
    });
  });

  return { rules, warnings };
}

// ── Prompt assembly ────────────────────────────────────────────────────────

function buildAttributeTable() {
  const groups = new Map();
  for (const [attr, spec] of Object.entries(ATTRIBUTE_SPEC)) {
    const group = ATTRIBUTE_SPEC_GROUPS[attr];
    if (!groups.has(group)) groups.set(group, []);
    const parts = [`${attr} (${spec.type})`];
    if (spec.options) parts.push(`allowed values: ${spec.options.map((o) => `"${o}"`).join(' | ')}`);
    if (spec.range) parts.push(`range ${spec.range[0]}-${spec.range[1]}`);
    if (spec.desc) parts.push(`- ${spec.desc}`);
    groups.get(group).push(parts.join(' '));
  }
  let out = '';
  for (const [group, lines] of groups) {
    out += `\n${group}:\n`;
    for (const line of lines) out += `  - ${line}\n`;
  }
  return out;
}

// Display grouping only; the attribute keys are what the model must emit.
const ATTRIBUTE_SPEC_GROUPS = {
  lqs: 'LISTING QUALITY (scores are 0-100)', titleScore: 'LISTING QUALITY (scores are 0-100)',
  bulletScore: 'LISTING QUALITY (scores are 0-100)', imageScore: 'LISTING QUALITY (scores are 0-100)',
  descriptionScore: 'LISTING QUALITY (scores are 0-100)', imagesCount: 'LISTING QUALITY (scores are 0-100)',
  bulletPoints: 'LISTING QUALITY (scores are 0-100)', hasAplus: 'LISTING QUALITY (scores are 0-100)',

  priceDispute: 'PRICE & BUYBOX', uploadedPrice: 'PRICE & BUYBOX', currentPrice: 'PRICE & BUYBOX',
  mrp: 'PRICE & BUYBOX', discountPercentage: 'PRICE & BUYBOX', buyBoxWin: 'PRICE & BUYBOX',
  hasDeal: 'PRICE & BUYBOX', dealBadge: 'PRICE & BUYBOX',

  stockLevel: 'INVENTORY', availabilityStatus: 'INVENTORY',

  bsr: 'PERFORMANCE (BSR: lower number = better rank)', subBsr: 'PERFORMANCE (BSR: lower number = better rank)',
  bsrTrend: 'PERFORMANCE (BSR: lower number = better rank)', rating: 'PERFORMANCE (BSR: lower number = better rank)',
  ratingTrend: 'PERFORMANCE (BSR: lower number = better rank)', reviewCount: 'PERFORMANCE (BSR: lower number = better rank)',

  ads: 'ADS & FILTERS', asinStatus: 'ADS & FILTERS', category: 'ADS & FILTERS',
  brand: 'ADS & FILTERS', seller: 'ADS & FILTERS',
};

function buildOperatorTable() {
  let out = '';
  for (const [type, ops] of Object.entries(OPERATORS_BY_TYPE)) {
    out += `  ${type.padEnd(8)} → ${ops.join(', ')}\n`;
  }
  return out;
}

const SYSTEM_PROMPT = `You are RetailOps AI, an expert Amazon e-commerce operations automation engineer. You convert an operations manager's plain-English request into ONE ruleset of automation rules that this platform can actually execute.

The ruleset will be evaluated server-side against live ASIN data. Conditions you get wrong do not error — they silently never match, so precision matters more than creativity.

=== 1. PERMITTED ATTRIBUTES ===
You may ONLY use these attribute keys. Copy them exactly, including camelCase. Any other key is rejected and the condition is discarded.
{{ATTRIBUTE_TABLE}}

=== 2. PERMITTED OPERATORS (by data type) ===
{{OPERATOR_TABLE}}
Using an operator outside a type's list makes the condition permanently false. There is no error message at runtime.

=== 3. VALUE RULES (these are enforced) ===
  - number: emit a bare JSON number (70, not "70" and not "70 pts"). Inside the stated range.
  - "between": REQUIRES both value and value2, with value2 >= value. A between without value2 never matches.
  - boolean: value must be the string "true" or "false" with operator "=" or "≠".
  - enum: value must be one of the listed options, spelled as listed.
  - text: operator must be one of =, ≠, contains, not contains, starts with, is empty, is not empty.
  - list (tags): use contains / not contains. Do not use < or >.
  - is empty / is not empty: send value as an empty string.
  - Never write units or currency symbols into a value — 500, not "₹500".

=== 4. RULESET SHAPE ===
  - Generate 1 to 4 rules. Split distinct intentions into separate rules; do not invent extras the user did not ask for.
  - Every rule needs at least 1 condition. A rule with no conditions is discarded.
  - A rule is either all-AND or all-OR. Never mix them inside one rule.
  - Set logicalOp on EVERY condition of a rule to the same value, including the first.
    The engine ignores the first condition's logicalOp, so if you write "OR" only on
    the first condition the rule silently behaves as AND.
  - logicalOp is "AND" unless the user explicitly asks for "or". If they do, every
    condition in that rule must be "OR".
  - Do not add a filter on brand, category, seller or tags unless the user names it. Guessing a brand name guarantees zero matches.

=== 5. ACTIONS ===
  Choose exactly one actionType per rule from:
  - create_task        → standard task
  - create_task_high   → urgent task
  - create_group_task  → ONE task per group instead of one per ASIN. Use this whenever the
                         condition is likely to match many ASINs, otherwise you flood the team.
                         groupBy: {{GROUP_BY}}
                         sopPreset: {{SOP_PRESETS}}
  - send_notification  → in-app alert
  - send_email         → email alert
  - add_tag / remove_tag → set value to the tag name
  - flag_review        → queue for manual review
  priority: {{PRIORITIES}}
  groupBy, sopPreset and value are only meaningful for the actions noted above; omit the rest.

=== 6. THRESHOLDS ===
Unless the user gives an exact number, use these defaults rather than inventing your own:
{{THRESHOLDS}}

=== 7. SCHEDULE ===
  runFrequency: {{RUN_FREQUENCIES}}
  runTime: a time like "08 AM" (24-hour clock, AM/PM suffix, leading zero omitted).
  isAutomated: true when the user wants it to run without review; false when they want a draft.

=== OUTPUT CONTRACT (non-negotiable) ===
Return ONE JSON object and nothing else. No markdown fences, no commentary, no trailing text.
{
  "name": "<short descriptive name, Title Case, max 6 words>",
  "description": "<one sentence, present tense, no trailing period>",
  "isAutomated": true,
  "runFrequency": "Daily",
  "runTime": "08 AM",
  "rules": [
    {
      "name": "<short rule name, max 8 words>",
      "isActive": true,
      "conditions": [
        { "attribute": "<from the table above>", "operator": "<from the operator table>", "value": <number or string>, "value2": <number or empty string>, "logicalOp": "AND" }
      ],
      "action": { "actionType": "<from section 5>", "priority": "High", "groupBy": "seller", "sopPreset": "auto", "value": "" }
    }
  ],
  "reasoning": "<2 sentences: what this catches and why these thresholds were chosen>"
}`;

function buildSystemPrompt() {
  return SYSTEM_PROMPT.replace('{{ATTRIBUTE_TABLE}}', buildAttributeTable())
    .replace('{{OPERATOR_TABLE}}', buildOperatorTable())
    .replace('{{GROUP_BY}}', RULE_GROUP_BY_FIELDS.join(' | '))
    .replace('{{SOP_PRESETS}}', SOP_PRESETS.join(' | '))
    .replace('{{PRIORITIES}}', PRIORITIES.join(' | '))
    .replace('{{RUN_FREQUENCIES}}', RUN_FREQUENCIES.join(' | '))
    .replace('{{THRESHOLDS}}', THRESHOLD_GUIDE.map((t) => `  - ${t}`).join('\n'));
}

const EXISTING_RULES_LIMIT = 8;

/**
 * Builds the user turn. Existing rules are included so the model extends the
 * ruleset rather than duplicating what is already there.
 */
function buildUserPrompt(request, existingRules = []) {
  const lines = [];

  const existing = Array.isArray(existingRules) ? existingRules.slice(0, EXISTING_RULES_LIMIT) : [];
  if (existing.length) {
    lines.push('Rules that already exist in this ruleset — do not repeat them, only add what is missing:');
    lines.push(JSON.stringify(existing, null, 2));
    lines.push('');
  }

  if (request && request.seller) lines.push(`Seller context: ${request.seller}`);
  if (request && request.category) lines.push(`Category context: ${request.category}`);
  if (existing.length || (request && (request.seller || request.category))) lines.push('');

  lines.push('Request from the operations manager:');
  lines.push(`"""${String(request?.prompt ?? '').trim()}"""`);
  lines.push('');
  lines.push('Produce the single ruleset JSON object described by the output contract. No other text.');

  return lines.join('\n');
}

module.exports = {
  ATTRIBUTE_SPEC,
  OPERATORS_BY_TYPE,
  ACTION_TYPES,
  PRIORITIES,
  SOP_PRESETS,
  RUN_FREQUENCIES,
  THRESHOLD_GUIDE,
  RULE_GROUP_BY_FIELDS,
  ENGINE_UNSUPPORTED_ATTRIBUTES,
  isValidAttribute,
  isValidOperator,
  resolveRuleLogicalOp,
  validateCondition,
  validateRuleset,
  buildSystemPrompt,
  buildUserPrompt,
};
