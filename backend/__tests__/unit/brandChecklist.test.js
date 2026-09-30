/** Brand checklist on multi-brand tasks: ticking rules + list visibility for brand-less tasks. */
const mockQueries = [];
let mockStatus = 'IN_PROGRESS';
let mockRowsAffected = 1;

function mockPool() {
  return {
    request() {
      const inp = {};
      const r = {
        input(n, t, v) { inp[n] = v === undefined ? t : v; return r; },
        async query(q) {
          mockQueries.push({ q, inp: { ...inp } });
          if (/SELECT Id, Status FROM PemsTaskInstances/.test(q)) return { recordset: mockStatus ? [{ Id: 't1', Status: mockStatus }] : [] };
          if (/UPDATE PemsTaskBrands/.test(q)) return { recordset: [], rowsAffected: [mockRowsAffected] };
          if (/FROM PemsTaskBrands/.test(q)) return { recordset: [{ total: 3, done: 2 }] };
          if (/COUNT\(\*\) as total/i.test(q)) return { recordset: [{ total: 0 }] };
          return { recordset: [] };
        },
      };
      return r;
    },
  };
}
jest.mock('../../database/db', () => ({
  sql: new Proxy({}, { get: () => function () {} }),
  getPool: async () => mockPool(),
  generateId: () => 'id',
  withTransaction: async (fn) => fn(mockPool()),
}));
jest.mock('../../utils/logger', () => ({ info() {}, warn() {}, error() {}, debug() {} }));
jest.mock('../../services/eventBus', () => ({ emit() {}, on() {}, EVENTS: {} }));
jest.mock('../../services/pems/eventStore', () => ({ append: async () => {}, EVENT_TYPES: {} }));
jest.mock('../../services/cacheService', () => ({}));
jest.mock('../../services/rulesetEngineService', () => ({}));

const svc = require('../../services/pems/pemsService');
beforeEach(() => { mockQueries.length = 0; mockStatus = 'IN_PROGRESS'; mockRowsAffected = 1; });

describe('setBrandCheck', () => {
  it('ticks one brand and returns the running count', async () => {
    const out = await svc.setBrandCheck('t1', 'row1', true, 'u1');
    expect(out).toEqual({ total: 3, done: 2 });
    const upd = mockQueries.find(x => /UPDATE PemsTaskBrands/.test(x.q));
    expect(upd.q).toMatch(/TaskInstanceId = @taskId AND Id = @rowId/);   // scoped to THIS task
  });
  it('ticks every brand when no row is given', async () => {
    await svc.setBrandCheck('t1', undefined, true, 'u1');
    expect(mockQueries.find(x => /UPDATE PemsTaskBrands/.test(x.q)).q).not.toMatch(/@rowId/);
  });
  it.each(['ASSIGNED', 'SUBMITTED', 'APPROVED'])('refuses while the task is %s', async (st) => {
    mockStatus = st;
    await expect(svc.setBrandCheck('t1', 'row1', true, 'u1')).rejects.toMatchObject({ status: 409 });
    expect(mockQueries.some(x => /UPDATE PemsTaskBrands/.test(x.q))).toBe(false);
  });
  it('404s for an unknown task or a brand that is not on this task', async () => {
    mockStatus = null;
    await expect(svc.setBrandCheck('nope', 'row1', true, 'u1')).rejects.toMatchObject({ status: 404 });
    mockStatus = 'IN_PROGRESS'; mockRowsAffected = 0;
    await expect(svc.setBrandCheck('t1', 'other-tasks-row', true, 'u1')).rejects.toMatchObject({ status: 404 });
  });
});

describe('getInstances visibility for brand-less tasks', () => {
  const dataQuery = () => mockQueries.filter(x => /FROM PemsTaskInstances i/.test(x.q)).map(x => x.q).join('\n');

  it('restricted users also see brand-less tasks assigned to / reviewed by THEM (and only them)', async () => {
    await svc.getInstances({}, { Id: 'bm1', role: { name: 'brand_manager' }, assignedSellers: ['s1', 's2'] });
    const q = dataQuery();
    expect(q).toMatch(/i\.SellerId IN \(@scopeSeller_0,@scopeSeller_1\)/);
    expect(q).toMatch(/i\.SellerId IS NULL AND \(i\.AssignedTo = @scopeMe OR i\.ReviewerId = @scopeMe\)/);
    expect(mockQueries.some(x => x.inp.scopeMe === 'bm1')).toBe(true);
  });
  it('a user with no brands still sees their own brand-less tasks, nothing else', async () => {
    await svc.getInstances({}, { Id: 'bm2', role: { name: 'brand_manager' }, assignedSellers: [] });
    const q = dataQuery();
    expect(q).not.toMatch(/1=0/);
    expect(q).toMatch(/i\.SellerId IS NULL AND \(i\.AssignedTo = @scopeMe/);
  });
  it('an explicit brand filter does not widen the scope', async () => {
    await svc.getInstances({ sellerId: 's1' }, { Id: 'bm1', role: { name: 'brand_manager' }, assignedSellers: ['s1'] });
    expect(dataQuery()).not.toMatch(/scopeMe/);
  });
  it('global roles are unaffected', async () => {
    await svc.getInstances({}, { Id: 'adm', role: { name: 'admin' } });
    expect(dataQuery()).not.toMatch(/scopeMe|scopeSeller/);
  });
});
