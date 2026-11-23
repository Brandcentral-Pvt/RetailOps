/**
 * Phase 1 route authorization contract. Keeps executor task writes separate
 * from independent review decisions, including brandless work.
 */
const express = require('express');
const request = require('supertest');
const { makeFakePool, FAKE_SQL } = require('../../testUtils/fakePool');

let mockUser = null;
const mockPool = makeFakePool([
  { match: /SELECT TaskInstanceId FROM PemsActivities WHERE Id = @id/,
    rows: [{ TaskInstanceId: 'task-1' }] },
  { match: /SELECT TaskInstanceId FROM PemsSubTasks WHERE Id = @id/,
    rows: [{ TaskInstanceId: 'task-1' }] },
  { match: /SELECT Id, AssignedTo, ReviewerId, SellerId, SellerName, Status FROM PemsTaskInstances/,
    rows: [{ Id:'task-1', AssignedTo:'worker', ReviewerId:'reviewer', SellerId:'seller-1', SellerName:'Seller One', Status:'SUBMITTED' }] },
]);

jest.mock('../../database/db', () => ({
  sql: require('../../testUtils/fakePool').FAKE_SQL,
  getPool: async () => mockPool,
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
  new Proxy({}, { get: () => (req, res) => res.json({ success:true }) })
);
jest.mock('../../controllers/pems/dashboardController', () =>
  new Proxy({}, { get: () => (req, res) => res.json({ success:true }) })
);

const routes = require('../../routes/pems/pemsRoutes');
const app = express();
app.use(express.json());
app.use('/api/pems', routes);
const employee = (id) => ({ Id:id, role:{ name:'brand_manager' }, assignedSellers:['seller-1'] });

beforeEach(() => { mockUser = employee('worker'); });

test('executor can complete their activity', async () => {
  const res = await request(app).post('/api/pems/activities/activity-1/complete');
  expect(res.status).toBe(200);
});
test('assigned reviewer cannot execute an employee activity', async () => {
  mockUser = employee('reviewer');
  const res = await request(app).post('/api/pems/activities/activity-1/complete');
  expect(res.status).toBe(403);
});
test('assigned reviewer can make an independent review decision', async () => {
  mockUser = employee('reviewer');
  const res = await request(app).post('/api/pems/reviews').send({ taskInstanceId:'task-1', decision:'APPROVE' });
  expect(res.status).toBe(200);
});
test('executor cannot approve their own task', async () => {
  const res = await request(app).post('/api/pems/reviews').send({ taskInstanceId:'task-1', decision:'APPROVE' });
  expect(res.status).toBe(403);
});
test('even a global admin assigned to a task cannot review it', async () => {
  mockUser = { Id:'worker', role:{ name:'admin' } };
  const res = await request(app).post('/api/pems/reviews').send({ taskInstanceId:'task-1', decision:'APPROVE' });
  expect(res.status).toBe(403);
});
test('standalone approval transitions are disallowed', async () => {
  mockUser = { Id:'manager', role:{ name:'operational_manager' } };
  const res = await request(app).post('/api/pems/instances/task-1/transition').send({ toStatus:'APPROVED' });
  expect(res.status).toBe(403);
});
test('employee can transition their own task into progress', async () => {
  const res = await request(app).post('/api/pems/instances/task-1/transition').send({ toStatus:'IN_PROGRESS' });
  expect(res.status).toBe(200);
});
test('unauthorized seller cannot execute cross-seller tasks', async () => {
  mockUser = { Id:'worker', role:{ name:'brand_manager' }, assignedSellers:['seller-secret'] };
  const res = await request(app).post('/api/pems/activities/activity-1/complete');
  expect(res.status).toBe(403);
});
