/**
 * POST /api/strategy/rules/generate
 *
 * The "AI rules" feature was dead in two independent ways, both covered here:
 *
 *  1. The client called /api/ai/rules/generate but aiRoutes is mounted at
 *     /api/strategy, so every request 404'd and the modal only ever showed
 *     "AI generation failed".
 *  2. The route was authenticated but had no permission check, unlike every
 *     other ruleset write route.
 *
 * The model is stubbed, so this asserts routing, auth/permission, the strict
 * output contract and the error surface — with no network or database.
 */
const express = require('express');
const request = require('supertest');

let mockState = { user: null, permissions: ['rules_manage', 'rules_view'] };
let mockModelReply = null;
let mockModelError = null;
let mockChatCalls = [];

jest.mock('../../middleware/auth', () => ({
  authenticate: (req, res, next) => {
    if (!mockState.user) return res.status(401).json({ message: 'Not authenticated' });
    req.user = mockState.user;
    next();
  },
  requirePermission: (perm) => (req, res, next) => {
    if (!mockState.permissions.includes(perm)) {
      return res.status(403).json({ success: false, message: `Missing permission: ${perm}` });
    }
    next();
  },
}));

jest.mock('../../services/nimService', () => ({
  isConfigured: () => mockState.configured !== false,
  chat: async (messages, options) => {
    mockChatCalls.push({ messages, options });
    if (mockModelError) throw mockModelError;
    return mockModelReply;
  },
  cleanJSON: (content) => JSON.parse(content),
}));

const VALID_REPLY = JSON.stringify({
  name: 'Low Quality Alerts',
  description: 'Catches poor listings',
  isAutomated: true,
  runFrequency: 'Daily',
  runTime: '08 AM',
  rules: [
    {
      name: 'Low LQS',
      isActive: true,
      conditions: [
        { attribute: 'lqs', operator: '<', value: 70, value2: '', logicalOp: 'AND' },
      ],
      action: { actionType: 'create_task', priority: 'High' },
    },
  ],
  reasoning: 'LQS under 70 is poor listing quality.',
});

function buildApp() {
  const app = express();
  app.use(express.json());
  // Must match the real mount point in server.js.
  app.use('/api/strategy', require('../../routes/aiRoutes'));
  return app;
}

describe('POST /api/strategy/rules/generate', () => {
  let app;

  beforeAll(() => {
    app = buildApp();
  });

  beforeEach(() => {
    mockState.user = { id: 1, name: 'Tester' };
    mockState.permissions = ['rules_manage', 'rules_view'];
    mockState.configured = true;
    mockModelReply = VALID_REPLY;
    mockModelError = null;
    mockChatCalls = [];
  });

  it('is reachable at the path the client actually calls', async () => {
    // The regression: the client used to call /api/ai/rules/generate, which is
    // not mounted anywhere, so every request 404'd.
    await request(app)
      .post('/api/ai/rules/generate')
      .send({ prompt: 'flag low LQS' })
      .expect(404);

    const res = await request(app)
      .post('/api/strategy/rules/generate')
      .send({ prompt: 'flag low LQS' })
      .expect(200);

    expect(res.body.success).toBe(true);
  });

  it('returns executable rules the builder can apply', async () => {
    const res = await request(app)
      .post('/api/strategy/rules/generate')
      .send({ prompt: 'flag low LQS' })
      .expect(200);

    const { data } = res.body;
    expect(data.name).toBe('Low Quality Alerts');
    expect(data.rules).toHaveLength(1);
    expect(data.rules[0].conditions[0]).toMatchObject({
      attribute: 'lqs',
      operator: '<',
      value: 70,
      logicalOp: 'AND',
    });
    expect(typeof data.rules[0].conditions[0].value).toBe('number');
    expect(data.rules[0].action).toMatchObject({ actionType: 'create_task', priority: 'High' });
  });

  it('instructs the model with the strict attribute contract', async () => {
    await request(app).post('/api/strategy/rules/generate').send({ prompt: 'x' }).expect(200);

    const system = mockChatCalls[0].messages[0].content;
    expect(system).toMatch(/PERMITTED ATTRIBUTES/);
    expect(system).toMatch(/PERMITTED OPERATORS/);
    expect(system).toMatch(/OUTPUT CONTRACT/);
    expect(system).toContain('lqs');
    // Must not offer attributes the engine cannot execute.
    expect(system).not.toMatch(/\btotalOrders\b/);
  });

  it('uses a low temperature for a constrained generation task', async () => {
    await request(app).post('/api/strategy/rules/generate').send({ prompt: 'x' }).expect(200);
    expect(mockChatCalls[0].options.temperature).toBeLessThanOrEqual(0.3);
  });

  it('requires rules_manage', async () => {
    mockState.permissions = ['rules_view'];
    await request(app)
      .post('/api/strategy/rules/generate')
      .send({ prompt: 'flag low LQS' })
      .expect(403);
  });

  it('requires authentication', async () => {
    mockState.user = null;
    await request(app)
      .post('/api/strategy/rules/generate')
      .send({ prompt: 'flag low LQS' })
      .expect(401);
  });

  it('rejects an empty prompt', async () => {
    const res = await request(app)
      .post('/api/strategy/rules/generate')
      .send({ prompt: '   ' })
      .expect(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects an over-long prompt', async () => {
    await request(app)
      .post('/api/strategy/rules/generate')
      .send({ prompt: 'x'.repeat(2001) })
      .expect(400);
  });

  it('reports unconfigured AI as 503 with a code, not a crash', async () => {
    mockState.configured = false;
    const res = await request(app)
      .post('/api/strategy/rules/generate')
      .send({ prompt: 'flag low LQS' })
      .expect(503);
    expect(res.body.code).toBe('AI_NOT_CONFIGURED');
  });

  it('drops unusable conditions but still returns the good ones', async () => {
    mockModelReply = JSON.stringify({
      name: 'Mixed',
      rules: [{
        name: 'Partly bad',
        conditions: [
          { attribute: 'lqs', operator: '<', value: 70 },
          { attribute: 'notAnAttribute', operator: '>', value: 1 },
          { attribute: 'rating', operator: 'contains', value: 'good' },
        ],
        action: { actionType: 'create_task' },
      }],
    });

    const res = await request(app)
      .post('/api/strategy/rules/generate')
      .send({ prompt: 'x' })
      .expect(200);

    expect(res.body.data.rules[0].conditions).toHaveLength(1);
    expect(res.body.data.warnings.join(' ')).toMatch(/notAnAttribute/);
    expect(res.body.data.warnings.join(' ')).toMatch(/not valid for number/);
  });

  it('returns 502 with guidance when nothing valid could be produced', async () => {
    mockModelReply = JSON.stringify({
      name: 'Bad',
      rules: [{ name: 'R', conditions: [{ attribute: 'nope', operator: '>', value: 1 }], action: {} }],
    });

    const res = await request(app)
      .post('/api/strategy/rules/generate')
      .send({ prompt: 'do something vague' })
      .expect(502);

    expect(res.body.code).toBe('NO_VALID_RULES');
    expect(res.body.message).toMatch(/specific metric and threshold/i);
  });

  it('normalises a mixed AND/OR rule to one join', async () => {
    mockModelReply = JSON.stringify({
      name: 'Either',
      rules: [{
        name: 'R',
        conditions: [
          { attribute: 'lqs', operator: '<', value: 70, logicalOp: 'OR' },
          { attribute: 'rating', operator: '<', value: 3.5, logicalOp: 'AND' },
        ],
        action: { actionType: 'flag_review' },
      }],
    });

    const res = await request(app)
      .post('/api/strategy/rules/generate')
      .send({ prompt: 'x' })
      .expect(200);

    const joins = res.body.data.rules[0].conditions.map((c) => c.logicalOp);
    expect(new Set(joins).size).toBe(1);
  });

  it('surfaces a model failure as a 500 with a readable message', async () => {
    mockModelError = new Error('AI inference failed: upstream 503');
    const res = await request(app)
      .post('/api/strategy/rules/generate')
      .send({ prompt: 'x' })
      .expect(500);
    expect(res.body.message).toMatch(/upstream 503/);
  });
});

describe('POST /api/strategy/rules/explain', () => {
  let app;

  beforeAll(() => {
    app = buildApp();
  });

  beforeEach(() => {
    mockState.user = { id: 1 };
    mockState.permissions = ['rules_view'];
    mockState.configured = true;
    mockModelReply = 'This flags low LQS ASINs and opens a task.';
    mockModelError = null;
    mockChatCalls = [];
  });

  it('only needs rules_view', async () => {
    await request(app)
      .post('/api/strategy/rules/explain')
      .send({ rules: [{ name: 'r', conditions: [], action: {} }] })
      .expect(200);
  });

  it('falls back to a plain summary when AI is unconfigured', async () => {
    mockState.configured = false;
    const res = await request(app)
      .post('/api/strategy/rules/explain')
      .send({ rules: [{ name: 'Low LQS', conditions: [{ attribute: 'lqs', operator: '<', value: 70 }], action: { actionType: 'create_task' } }] })
      .expect(200);

    expect(res.body.data.degraded).toBe(true);
    expect(res.body.data.explanation).toMatch(/lqs < 70/);
  });

  it('rejects an empty rules array', async () => {
    await request(app)
      .post('/api/strategy/rules/explain')
      .send({ rules: [] })
      .expect(400);
  });
});
