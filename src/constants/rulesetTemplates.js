/**
 * Starter templates for the Automation Rules empty state.
 *
 * These are prefill payloads only — the shape deliberately matches the builder's
 * state object so a template can be applied without translation. Every
 * attribute / operator / actionType referenced here is validated against
 * src/constants/rulesetAttributes.js and src/constants/rulesetActions.js by
 * tests/rule-sets.spec.js, because a template that renders an empty condition
 * or a blank action is worse than no template at all.
 */

const cond = (attribute, operator, value, logicalOp = 'AND') => ({
  attribute,
  operator,
  value,
  value2: '',
  logicalOp,
});

const rule = (name, conditions, action) => ({
  name,
  isActive: true,
  conditions,
  action,
});

export const STARTER_TEMPLATES = [
  {
    key: 'price-drop-alert',
    name: 'Price drop alert',
    description: 'Flag ASINs where the live marketplace price falls below your listed price.',
    prefill: {
      description: 'Alerts the team when a marketplace price drops below our listed price.',
      isAutomated: true,
      runFrequency: 'Daily',
      runTime: '09 AM',
      rules: [
        rule(
          'Live price below listed price',
          [cond('currentPrice', '<', '')],
          { actionType: 'send_email', value: '' }
        ),
      ],
    },
  },
  {
    key: 'auto-pause-oos',
    name: 'Auto-pause out of stock',
    description: 'Raise an urgent task the moment an ASIN has no stock left.',
    prefill: {
      description: 'Creates an urgent task for any ASIN whose stock has run out.',
      isAutomated: true,
      runFrequency: 'Every 12 hours',
      runTime: '08 AM',
      rules: [
        rule(
          'Stock exhausted',
          [cond('stockLevel', '<=', 0)],
          { actionType: 'create_task_high', value: '' }
        ),
      ],
    },
  },
  {
    key: 'bad-image-quality',
    name: 'Bad image quality fix',
    description: 'Queue a task for listings whose image score is below the marketplace norm.',
    prefill: {
      description: 'Queues a listing-quality task for ASINs with a poor image score.',
      isAutomated: true,
      runFrequency: 'Weekly',
      runTime: '10 AM',
      rules: [
        rule(
          'Image score below threshold',
          [cond('imageScore', '<', 70)],
          { actionType: 'create_task', value: '' }
        ),
      ],
    },
  },
  {
    key: 'low-listing-quality',
    name: 'Low listing quality',
    description: 'Catch degraded listings before they cost you buy box.',
    prefill: {
      description: 'Flags ASINs whose listing quality score has dropped below target.',
      isAutomated: true,
      runFrequency: 'Daily',
      runTime: '11 AM',
      rules: [
        rule(
          'LQS below target',
          [cond('lqs', '<', 80)],
          { actionType: 'create_task', value: '' }
        ),
      ],
    },
  },
  {
    key: 'buybox-lost',
    name: 'Buy box lost',
    description: 'Get a task when we stop winning the buy box on a listing.',
    prefill: {
      description: 'Creates a task for any ASIN where we have lost the buy box.',
      isAutomated: true,
      runFrequency: 'Daily',
      runTime: '06 AM',
      rules: [
        rule(
          'No longer winning buy box',
          [cond('buyBoxWin', '=', false)],
          { actionType: 'create_task', value: '' }
        ),
      ],
    },
  },
];

export const getStarterTemplate = (key) =>
  STARTER_TEMPLATES.find((t) => t.key === key) || null;
