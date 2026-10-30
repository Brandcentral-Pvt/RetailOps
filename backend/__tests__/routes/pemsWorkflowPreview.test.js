'use strict';
const express = require('express');
const request = require('supertest');

jest.mock('../../database/db', () => ({
  sql: require('../../testUtils/fakePool').FAKE_SQL,
  getPool: async () => { throw new Error('Read-only workflow preview must not access database'); },
}));
let mockActor = null;
jest.mock('../../services/pems/pemsService', () => ({}));
jest.mock('../../middleware/auth', () => ({
  auth: (req, res, next) => {
    if (!mockActor) return res.status(401).json({ success: false, error: 'Unauthenticated' });
    req.user = mockActor; next();
  },
  requirePermission: key => (req, res, next) => {
    if (!req.user?.permissions?.includes(key)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    next();
  },
}));
jest.mock('../../middleware/pemsAccess', () => ({
  requireTaskAccess: (_, __, next) => next(),
  requireTaskView: (_, __, next) => next(),
  requireTaskExecutor: (_, __, next) => next(),
  requireTaskReviewer: (_, __, next) => next(),
  requireTaskTransition: (_, __, next) => next(),
  requireGlobalPemsRole: (_, __, next) => next(),
}));
jest.mock('../../middleware/cache', () => ({
  cacheRoute: () => (_, __, next) => next(),
  invalidateCache: () => (_, __, next) => next(),
}));
jest.mock('../../controllers/pems/dashboardController', () =>
  new Proxy({}, { get: () => (req, res) => res.json({ success: true }) })
);

const router = require('../../routes/pems/pemsRoutes');
const app = express();
app.use(express.json());
app.use('/api/pems', router);

const valid = () => ({
  schemaVersion: '2.0',
  phases: [{
    key: 'first', title: 'Prepare',
    activities: [{
      key: 'confirm', title: 'Verify selection',
      instructions: 'Confirm the seller report is ready',
      type: 'CHECKLIST', required: true, evidenceRequired: false,
      validatorKey: 'BOOLEAN_CONFIRMED',
      fields: [{ key: 'checked', type: 'boolean', required: true, label: 'Confirmed' }],
    }],
  }],
});

beforeEach(() => {
  mockActor = { Id: 'author', permissions: ['tasks_manage'] };
});

describe('Workflow V2 validation route on existing PEMS router', () => {
  test('requires an authenticated caller', async () => {
    mockActor = null;
    const res = await request(app).post('/api/pems/templates/workflow/validate').send({ workflow: valid() });
    expect(res.status).toBe(401);
  });
  test('requires tasks_manage, not ordinary employee permission', async () => {
    mockActor = { Id: 'employee', permissions: ['tasks_view', 'tasks_execute'] };
    const res = await request(app).post('/api/pems/templates/workflow/validate').send({ workflow: valid() });
    expect(res.status).toBe(403);
  });
  test('returns an accurate read-only execution preview', async () => {
    const res = await request(app).post('/api/pems/templates/workflow/validate').send({ workflow: valid() });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ phaseCount: 1, activityCount: 1, validation: { ok: true } });
    expect(res.body.data.preview.phases[0].activities[0])
      .toMatchObject({ key: 'confirm', type: 'CHECKLIST', visibility: 'VISIBLE' });
    expect(res.body.data.legacySopPreview[0].activities[0]).toMatchObject({ title: 'Verify selection' });
  });
  test('returns actionable errors for unsupported remote validation', async () => {
    const workflow = valid();
    workflow.phases[0].activities[0].validatorKey = 'javascript:eval';
    const res = await request(app).post('/api/pems/templates/workflow/validate').send({ workflow });
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ success: false, code: 'INVALID_WORKFLOW_V2', validation: { ok: false } });
  });
});
