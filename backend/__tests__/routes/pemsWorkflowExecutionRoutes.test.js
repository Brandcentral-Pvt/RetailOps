'use strict';
const express = require('express');
const request = require('supertest');
let mockActor, mockActions = [];
const mockTasks = {
  owned: { Id:'owned', AssignedTo:'worker', ReviewerId:'reviewer',
    SellerId:'seller-owned', SellerName:'Owned', Status:'IN_PROGRESS' },
  foreign: { Id:'foreign', AssignedTo:'other', ReviewerId:'other-reviewer',
    SellerId:'seller-foreign', SellerName:'Foreign', Status:'IN_PROGRESS' },
};
jest.mock('../../database/db', () => ({
  sql: require('../../testUtils/fakePool').FAKE_SQL,
  getPool: async () => ({
    request() {
      const params = {};
      const q = {
        input(name, type, value) { params[name] = value === undefined ? type : value; return q; },
        async query(text) {
          if (/SELECT TaskInstanceId FROM PemsActivities WHERE Id = @id/.test(text)) {
            const actual = { act1: 'owned', 'foreign-act': 'foreign' }[params.id];
            return { recordset: actual ? [{ TaskInstanceId: actual }] : [] };
          }
          if (/SELECT Id, AssignedTo, ReviewerId, SellerId, SellerName, Status FROM PemsTaskInstances WHERE Id = @id/.test(text)) {
            return { recordset: mockTasks[params.id] ? [mockTasks[params.id]] : [] };
          }
          throw new Error('Unexpected SQL');
        },
      };
      return q;
    },
  }),
}));
jest.mock('../../middleware/auth', () => ({
  auth: (req, res, next) => { req.user = mockActor; next(); },
  requirePermission: () => (req, res, next) => next(),
}));
jest.mock('../../middleware/cache', () => ({
  cacheRoute: () => (req, res, next) => next(),
  invalidateCache: () => (req, res, next) => next(),
}));
jest.mock('../../controllers/pems/pemsController', () =>
  new Proxy({}, { get: (_, name) => (req, res) => {
    if (name === 'getWorkflowExecution' || name === 'saveWorkflowActivityOutput')
      mockActions.push({ name, taskId: req.pemsTask?.Id });
    res.json({ success: true });
  } })
);
jest.mock('../../controllers/pems/dashboardController', () =>
  new Proxy({}, { get: () => (req, res) => res.json({ success: true }) })
);
const app = express();
app.use(express.json());
app.use('/api/pems', require('../../routes/pems/pemsRoutes'));
const actor = (id, sellers = ['seller-owned']) =>
  ({ Id:id, role:{name:'brand_manager'}, assignedSellers:sellers });
beforeEach(() => { mockActor = actor('worker'); mockActions = []; });

describe('Phase 2.2 output API seller authorization', () => {
  const read = () => request(app).get('/api/pems/instances/owned/workflow');
  const write = () => request(app).put('/api/pems/instances/owned/activities/act1/output')
    .send({ output:{ value:true }, expectedRevision:0 });

  test('assigned executor can read and save outputs', async () => {
    expect((await read()).status).toBe(200);
    expect((await write()).status).toBe(200);
    expect(mockActions).toEqual([
      { name:'getWorkflowExecution', taskId:'owned' },
      { name:'saveWorkflowActivityOutput', taskId:'owned' },
    ]);
  });
  test('reviewer may read but cannot change activity outputs', async () => {
    mockActor = actor('reviewer');
    expect((await read()).status).toBe(200);
    expect((await write()).status).toBe(403);
    expect(mockActions).toHaveLength(1);
  });
  test('unrelated seller cannot read or write task data', async () => {
    mockActor = actor('worker', ['seller-foreign']);
    expect((await read()).status).toBe(403);
    expect((await write()).status).toBe(403);
    expect(mockActions).toHaveLength(0);
  });
  test('forged activity ID from another seller is rejected before controller access', async () => {
    const r = await request(app).put('/api/pems/instances/owned/activities/foreign-act/output')
      .send({ output: { value: true }, expectedRevision: 0 });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('TASK_PARENT_MISMATCH');
    expect(mockActions).toHaveLength(0);
  });

  test('missing task returns 404 before invoking the controller', async () => {
    expect((await request(app).get('/api/pems/instances/missing/workflow')).status).toBe(404);
    expect((await request(app).put('/api/pems/instances/missing/activities/missing-act/output')).status).toBe(404);
    expect(mockActions).toHaveLength(0);
  });
});
