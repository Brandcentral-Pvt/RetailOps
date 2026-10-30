'use strict';

/**
 * Security regression: the resource identity for activity/phase execution
 * must be resolved from the child row in SQL, not req.body.taskInstanceId.
 * This test exercises the actual Express route and authorization middleware;
 * the controller is intentionally a recording stub to detect any invocation.
 */
const express = require('express');
const request = require('supertest');

let mockUser;
let mockExecutions = [];
const taskRows = {
  'task-owned': {
    Id: 'task-owned', AssignedTo: 'worker', ReviewerId: 'reviewer',
    SellerId: 'seller-owned', SellerName: 'Owned', Status: 'IN_PROGRESS',
  },
  'task-foreign': {
    Id: 'task-foreign', AssignedTo: 'worker', ReviewerId: 'other-reviewer',
    SellerId: 'seller-foreign', SellerName: 'Foreign', Status: 'IN_PROGRESS',
  },
};
const activities = { 'activity-owned': 'task-owned', 'activity-foreign': 'task-foreign' };
const phases = { 'phase-owned': 'task-owned', 'phase-foreign': 'task-foreign' };
let mockQueries = [];

jest.mock('../../database/db', () => ({
  sql: require('../../testUtils/fakePool').FAKE_SQL,
  getPool: async () => ({
    request() {
      const inputs = {};
      const queryRequest = {
        input(name, type, value) {
          inputs[name] = value === undefined ? type : value;
          return queryRequest;
        },
        async query(query) {
          mockQueries.push({ query, inputs: { ...inputs } });
          if (/SELECT TaskInstanceId FROM PemsActivities WHERE Id = @id/.test(query)) {
            return { recordset: activities[inputs.id] ? [{ TaskInstanceId: activities[inputs.id] }] : [] };
          }
          if (/SELECT TaskInstanceId FROM PemsSubTasks WHERE Id = @id/.test(query)) {
            return { recordset: phases[inputs.id] ? [{ TaskInstanceId: phases[inputs.id] }] : [] };
          }
          if (/SELECT Id, AssignedTo, ReviewerId, SellerId, SellerName, Status FROM PemsTaskInstances/.test(query)) {
            return { recordset: taskRows[inputs.id] ? [taskRows[inputs.id]] : [] };
          }
          return { recordset: [] };
        },
      };
      return queryRequest;
    },
  }),
}));

jest.mock('../../middleware/auth', () => ({
  auth: (req, res, next) => { req.user = mockUser; next(); },
  requirePermission: () => (req, res, next) => next(),
}));
jest.mock('../../middleware/cache', () => ({
  cacheRoute: () => (req, res, next) => next(),
  invalidateCache: () => (req, res, next) => next(),
}));
jest.mock('../../controllers/pems/pemsController', () =>
  new Proxy({}, {
    get: (_, action) => (req, res) => {
      if (action === 'completeActivity' || action === 'completeSubTask') {
        mockExecutions.push({ action, taskId: req.pemsTask?.Id, params: req.params });
      }
      res.json({ success: true });
    },
  })
);
jest.mock('../../controllers/pems/dashboardController', () =>
  new Proxy({}, { get: () => (req, res) => res.json({ success: true }) })
);

const routes = require('../../routes/pems/pemsRoutes');
const app = express();
app.use(express.json());
app.use('/api/pems', routes);

const priorFlag = process.env.PEMS_STRICT_ACTIVITY_GATES;
beforeEach(() => {
  mockUser = { Id: 'worker', role: { name: 'brand_manager' }, assignedSellers: ['seller-owned'] };
  mockQueries = [];
  mockExecutions = [];
});
afterAll(() => {
  if (priorFlag === undefined) delete process.env.PEMS_STRICT_ACTIVITY_GATES;
  else process.env.PEMS_STRICT_ACTIVITY_GATES = priorFlag;
});

describe.each(['false', 'true'])('Child authorization independent of strict gates (%s)', flag => {
  beforeEach(() => { process.env.PEMS_STRICT_ACTIVITY_GATES = flag; });

  test.each([
    ['/api/pems/activities/activity-foreign/complete', 'activity'],
    ['/api/pems/subtasks/phase-foreign/complete', 'phase'],
  ])('rejects cross-seller %s even with a forged own task ID', async (url, childType) => {
    const forged = await request(app).post(url).send({ taskInstanceId: 'task-owned' });
    expect(forged.status).toBe(403);
    expect(forged.body.code).toBe('TASK_PARENT_MISMATCH');
    expect(mockExecutions).toHaveLength(0);
    expect(mockQueries.some(e => e.inputs.id === 'task-foreign'
      && /FROM PemsTaskInstances/.test(e.query))).toBe(false);
    expect(mockQueries.some(e => e.inputs.id === (childType === 'activity' ? 'activity-foreign' : 'phase-foreign'))).toBe(true);
  });

  test.each([
    ['/api/pems/activities/activity-foreign/complete'],
    ['/api/pems/subtasks/phase-foreign/complete'],
  ])('rejects foreign child even when no task ID is supplied in the body', async url => {
    const response = await request(app).post(url).send({});
    expect(response.status).toBe(403);
    expect(mockExecutions).toHaveLength(0);
  });

  test.each([
    ['/api/pems/activities/activity-foreign/complete'],
    ['/api/pems/subtasks/phase-foreign/complete'],
  ])('does not accept body.id as an alternate authorization target', async url => {
    const response = await request(app).post(url).send({ id: 'task-owned' });
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('TASK_PARENT_MISMATCH');
    expect(mockExecutions).toHaveLength(0);
  });

  test.each([
    ['/api/pems/activities/activity-owned/complete', 'completeActivity'],
    ['/api/pems/subtasks/phase-owned/complete', 'completeSubTask'],
  ])('preserves authorized execution for an owned child', async (url, action) => {
    const response = await request(app).post(url).send({ taskInstanceId: 'task-owned' });
    expect(response.status).toBe(200);
    expect(mockExecutions).toHaveLength(1);
    expect(mockExecutions[0]).toMatchObject({ action, taskId: 'task-owned' });
  });

  test('returns 404 for a nonexistent activity, not permission for a claimed parent', async () => {
    const response = await request(app).post('/api/pems/activities/missing/complete')
      .send({ taskInstanceId: 'task-owned' });
    expect(response.status).toBe(404);
    expect(mockExecutions).toHaveLength(0);
  });
});
