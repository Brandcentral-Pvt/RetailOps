/**
 * getMyDay — who's day is returned, and that it is scoped to the assignee / reviewer.
 */
const mockQueries = [];

function mockPool() {
  return {
    request() {
      const inp = {};
      const r = {
        input(n, t, v) { inp[n] = v === undefined ? t : v; return r; },
        async query(q) { mockQueries.push({ q, uid: inp.uid }); return { recordset: [{ Id: 'x' }] }; },
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

beforeEach(() => { mockQueries.length = 0; });

describe('getMyDay', () => {
  it('returns the caller\'s own day in four scoped queries', async () => {
    const out = await svc.getMyDay({ Id: 'emp1', role: { name: 'brand_manager' } });
    expect(out.userId).toBe('emp1');
    expect(mockQueries).toHaveLength(4);
    expect(mockQueries.every(x => x.uid === 'emp1')).toBe(true);
    expect(out.actionable).toHaveLength(1);
    const [actionable, waiting, reviews, done] = mockQueries.map(x => x.q);
    expect(actionable).toMatch(/AssignedTo = @uid/);
    expect(actionable).toMatch(/IN \('ASSIGNED','ACCEPTED','IN_PROGRESS','REWORK','REJECTED','ESCALATED'\)/);
    expect(actionable).toMatch(/EstimatedExecutionMinutes/);
    expect(waiting).toMatch(/'SUBMITTED','RESUBMITTED','UNDER_REVIEW'/);
    expect(reviews).toMatch(/ReviewerId = @uid/);
    expect(reviews).toMatch(/AssignedTo <> @uid/); // never your own work
    expect(done).toMatch(/CAST\(i\.SubmittedAt AS DATE\)/);
  });

  it('ignores targetUserId for non-global roles (no peeking at colleagues)', async () => {
    const out = await svc.getMyDay({ Id: 'emp1', role: { name: 'brand_manager' } }, 'someoneElse');
    expect(out.userId).toBe('emp1');
    expect(mockQueries.every(x => x.uid === 'emp1')).toBe(true);
  });

  it('lets global roles view a teammate\'s day', async () => {
    const out = await svc.getMyDay({ Id: 'boss', role: { name: 'operational_manager' } }, 'emp9');
    expect(out.userId).toBe('emp9');
    expect(mockQueries.every(x => x.uid === 'emp9')).toBe(true);
  });

  it('requires an identity', async () => {
    await expect(svc.getMyDay({ role: 'x' })).rejects.toThrow(/identity/);
  });
});
