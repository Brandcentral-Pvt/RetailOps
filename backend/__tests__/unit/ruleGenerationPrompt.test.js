/**
 * The AI prompt is only useful if what the model is told matches what the
 * ruleset engine can execute. These tests lock that contract down.
 */

const {
  ATTRIBUTE_SPEC,
  ACTION_TYPES,
  SOP_PRESETS,
  RULE_GROUP_BY_FIELDS,
  ENGINE_UNSUPPORTED_ATTRIBUTES,
  isValidAttribute,
  isValidOperator,
  validateCondition,
  validateRuleset,
  buildSystemPrompt,
  buildUserPrompt,
} = require('../../prompts/ruleGenerationPrompt');

const {
  RULE_ATTRIBUTE_COLUMNS,
} = require('../../services/rulesetEngineService');

describe('rule generation prompt contract', () => {
  describe('attribute vocabulary matches the engine', () => {
    it('never advertises an attribute the engine cannot map to a column', () => {
      for (const attr of Object.keys(ATTRIBUTE_SPEC)) {
        expect(RULE_ATTRIBUTE_COLUMNS[attr]).toBeDefined();
      }
    });

    it('keeps the known-broken attributes out of the prompt', () => {
      // buildSqlFilter does `if (!col) continue`, so these silently never match.
      for (const attr of ENGINE_UNSUPPORTED_ATTRIBUTES) {
        expect(isValidAttribute(attr)).toBe(false);
        expect(ATTRIBUTE_SPEC[attr]).toBeUndefined();
      }
    });

    it('gives every attribute a resolvable operator set', () => {
      for (const attr of Object.keys(ATTRIBUTE_SPEC)) {
        expect(isValidOperator(attr, '=')).toBe(true);
      }
    });
  });

  describe('prompt assembly', () => {
    const system = buildSystemPrompt();

    it('leaves no unreplaced template placeholders', () => {
      expect(system).not.toMatch(/\{\{[A-Z_]+\}\}/);
    });

    it('lists every attribute in the system prompt', () => {
      for (const attr of Object.keys(ATTRIBUTE_SPEC)) {
        expect(system).toContain(attr);
      }
    });

    it('lists every action type and groupBy value', () => {
      for (const action of ACTION_TYPES) expect(system).toContain(action);
      for (const field of RULE_GROUP_BY_FIELDS) expect(system).toContain(field);
      for (const preset of SOP_PRESETS) expect(system).toContain(preset);
    });

    it('demands bare JSON with no commentary', () => {
      expect(system).toMatch(/no markdown|no commentary/i);
    });

    it('includes the existing rules so the model extends rather than duplicates', () => {
      const user = buildUserPrompt(
        { prompt: 'flag low stock' },
        [{ name: 'Low LQS', conditions: [{ attribute: 'lqs', operator: '<', value: 70 }] }]
      );
      expect(user).toContain('Low LQS');
      expect(user).toContain('flag low stock');
      expect(user).toContain('do not repeat them');
    });

    it('omits the existing-rules block when there is nothing to extend', () => {
      const user = buildUserPrompt({ prompt: 'flag low stock' }, []);
      expect(user).not.toContain('do not repeat them');
    });
  });

  describe('validateCondition', () => {
    it('rejects an unknown attribute instead of letting it through', () => {
      const result = validateCondition({ attribute: 'nope', operator: '>', value: 5 });
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/unknown attribute/i);
    });

    it('rejects an engine-unsupported attribute', () => {
      const result = validateCondition({ attribute: 'totalOrders', operator: '>', value: 5 });
      expect(result.ok).toBe(false);
    });

    it('rejects an operator that is illegal for the attribute type', () => {
      // "contains" is not a number operator — the engine would never match it.
      const result = validateCondition({ attribute: 'lqs', operator: 'contains', value: 70 });
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/not valid for number/i);
    });

    it('rejects a non-numeric value for a number attribute', () => {
      const result = validateCondition({ attribute: 'lqs', operator: '<', value: 'seventy' });
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/numeric/i);
    });

    it('coerces a numeric string to a number', () => {
      const result = validateCondition({ attribute: 'lqs', operator: '<', value: '70' });
      expect(result.ok).toBe(true);
      expect(result.condition.value).toBe(70);
      expect(typeof result.condition.value).toBe('number');
    });

    it('rejects a value outside the attribute range', () => {
      const result = validateCondition({ attribute: 'lqs', operator: '>', value: 500 });
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/outside 0-100/i);
    });

    it('requires value2 for "between"', () => {
      const result = validateCondition({ attribute: 'rating', operator: 'between', value: 3 });
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/value2/i);
    });

    it('rejects "between" with value2 below value', () => {
      const result = validateCondition({
        attribute: 'rating', operator: 'between', value: 4, value2: 3,
      });
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/value2 >= value/i);
    });

    it('accepts a valid "between"', () => {
      const result = validateCondition({
        attribute: 'rating', operator: 'between', value: 3, value2: 4.5,
      });
      expect(result.ok).toBe(true);
      expect(result.condition.value).toBe(3);
      expect(result.condition.value2).toBe(4.5);
    });

    it('requires a "true"/"false" string for booleans', () => {
      const bad = validateCondition({ attribute: 'buyBoxWin', operator: '=', value: 'yes' });
      expect(bad.ok).toBe(false);
      const good = validateCondition({ attribute: 'buyBoxWin', operator: '=', value: 'false' });
      expect(good.ok).toBe(true);
      expect(good.condition.value).toBe('false');
    });

    it('normalises the boolean "is"/"is not" aliases', () => {
      const result = validateCondition({ attribute: 'ads', operator: 'is', value: 'true' });
      expect(result.ok).toBe(true);
      expect(result.condition.operator).toBe('=');
    });

    it('rejects an enum value outside the allowed options', () => {
      const result = validateCondition({
        attribute: 'availabilityStatus', operator: '=', value: 'Backordered',
      });
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/not a valid availabilityStatus/i);
    });

    it('canonicalises enum casing', () => {
      const result = validateCondition({
        attribute: 'bsrTrend', operator: '=', value: 'grow',
      });
      expect(result.ok).toBe(true);
      expect(result.condition.value).toBe('Grow');
    });

    it('clears value for "is empty"', () => {
      const result = validateCondition({ attribute: 'dealBadge', operator: 'is empty', value: 'x' });
      expect(result.ok).toBe(true);
      expect(result.condition.value).toBe('');
    });

    it('defaults a missing logicalOp to AND', () => {
      const result = validateCondition({ attribute: 'lqs', operator: '<', value: 70 });
      expect(result.condition.logicalOp).toBe('AND');
    });
  });

  describe('validateRuleset', () => {
    it('drops only the invalid conditions and reports why', () => {
      const { rules, warnings } = validateRuleset({
        name: 'Quality',
        rules: [
          {
            name: 'Low LQS',
            conditions: [
              { attribute: 'lqs', operator: '<', value: 70 },
              { attribute: 'bogusAttr', operator: '>', value: 1 },
            ],
            action: { actionType: 'create_task', priority: 'High' },
          },
        ],
      });

      expect(rules).toHaveLength(1);
      expect(rules[0].conditions).toHaveLength(1);
      expect(warnings[0]).toMatch(/bogusAttr/);
    });

    it('drops a rule with no valid conditions but keeps the others', () => {
      const { rules, warnings } = validateRuleset({
        rules: [
          { name: 'Broken', conditions: [{ attribute: 'x', operator: '>', value: 1 }], action: {} },
          { name: 'Good', conditions: [{ attribute: 'lqs', operator: '<', value: 70 }], action: {} },
        ],
      });
      expect(rules).toHaveLength(1);
      expect(rules[0].name).toBe('Good');
      expect(warnings.join(' ')).toMatch(/Broken/);
    });

    it('falls back to a safe actionType and priority', () => {
      const { rules, warnings } = validateRuleset({
        rules: [{
          name: 'R',
          conditions: [{ attribute: 'lqs', operator: '<', value: 70 }],
          action: { actionType: 'launch_missiles', priority: 'URGENT' },
        }],
      });
      expect(rules[0].action.actionType).toBe('create_task');
      expect(rules[0].action.priority).toBe('Medium');
      expect(warnings.join(' ')).toMatch(/launch_missiles/);
    });

    it('only keeps groupBy/sopPreset for create_group_task', () => {
      const { rules } = validateRuleset({
        rules: [{
          name: 'R',
          conditions: [{ attribute: 'lqs', operator: '<', value: 70 }],
          action: { actionType: 'create_task', groupBy: 'brand', sopPreset: 'pricing' },
        }],
      });
      expect(rules[0].action.actionType).toBe('create_task');
    });

    it('keeps a valid groupBy for create_group_task', () => {
      const { rules } = validateRuleset({
        rules: [{
          name: 'R',
          conditions: [{ attribute: 'lqs', operator: '<', value: 70 }],
          action: { actionType: 'create_group_task', groupBy: 'bsrRange', sopPreset: 'listing' },
        }],
      });
      expect(rules[0].action.groupBy).toBe('bsrRange');
      expect(rules[0].action.sopPreset).toBe('listing');
    });

    it('numbers rules in output order', () => {
      const { rules } = validateRuleset({
        rules: [
          { name: 'A', conditions: [{ attribute: 'lqs', operator: '<', value: 70 }], action: {} },
          { name: 'B', conditions: [{ attribute: 'rating', operator: '<', value: 3 }], action: {} },
        ],
      });
      expect(rules.map((r) => r.order)).toEqual([0, 1]);
    });

    it('stamps one consistent join across every condition', () => {
      // The model put OR on the first condition only, which the engine ignores.
      const { rules, warnings } = validateRuleset({
        rules: [{
          name: 'Low quality',
          conditions: [
            { attribute: 'lqs', operator: '<', value: 70, logicalOp: 'OR' },
            { attribute: 'rating', operator: '<', value: 3.5, logicalOp: 'AND' },
          ],
          action: { actionType: 'flag_review' },
        }],
      });
      const joins = rules[0].conditions.map((c) => c.logicalOp);
      expect(new Set(joins).size).toBe(1);
      expect(warnings.join(' ')).toMatch(/normalised/i);
    });

    it('keeps an all-OR rule as OR', () => {
      const { rules } = validateRuleset({
        rules: [{
          name: 'Either',
          conditions: [
            { attribute: 'lqs', operator: '<', value: 70, logicalOp: 'OR' },
            { attribute: 'rating', operator: '<', value: 3.5, logicalOp: 'OR' },
          ],
          action: { actionType: 'flag_review' },
        }],
      });
      expect(rules[0].conditions.every((c) => c.logicalOp === 'OR')).toBe(true);
    });

    it('keeps an all-AND rule as AND', () => {
      const { rules } = validateRuleset({
        rules: [{
          name: 'Both',
          conditions: [
            { attribute: 'lqs', operator: '<', value: 70, logicalOp: 'AND' },
            { attribute: 'rating', operator: '<', value: 3.5, logicalOp: 'AND' },
          ],
          action: { actionType: 'flag_review' },
        }],
      });
      expect(rules[0].conditions.every((c) => c.logicalOp === 'AND')).toBe(true);
    });

    it('warns instead of throwing on an empty payload', () => {
      const { rules, warnings } = validateRuleset({});
      expect(rules).toEqual([]);
      expect(warnings.length).toBeGreaterThan(0);
    });
  });
});
