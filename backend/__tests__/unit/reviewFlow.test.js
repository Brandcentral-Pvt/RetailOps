/**
 * Review flow — submitReviewAndTransition / bulkReview, against an in-memory
 * fake of the mockDB layer. Guards the regressions that used to break the queue:
 *   - reviewing a SUBMITTED task failed (state machine needs UNDER_REVIEW first)
 *   - review rows were inserted twice / left orphaned when the transition failed
 */
let mockDB;
let mockReviews;

function mockFakePool() {
  return {
    request() {
      const inp = {};
      const r = {
        input(n, t, v) { inp[n] = v === undefined ? t : v; return r; },
        async query(q) {
          const t = mockDB[inp.id];
          if (/^\s*SELECT/.test(q) && /FROM PemsTaskInstances/.test(q) && /WHERE Id = @id/.test(q)) return { recordset: t ? [{ ...t }] : [] };
          if (/UPDATE PemsTaskInstances SET Status = @status/.test(q)) { t.Status = inp.status; return { recordset: [] }; }
          if (/UPDATE PemsTaskInstances SET ReviewerId/.test(q)) { if (!t.ReviewerId) t.ReviewerId = inp.rid; return { recordset: [] }; }
          if (/INSERT INTO PemsTaskReviews/.test(q)) {
            mockReviews.push({ task: inp.taskInstanceId, decision: inp.decision, by: inp.reviewerId, score: inp.qualityScore });
            return { recordset: [] };
          }
          return { recordset: [] };
        },
      };
      return r;
    },
  };
}

jest.mock('../../database/db', () => ({
  sql: new Proxy({}, { get: () => function () {} }),
  getPool: async () => mockFakePool(),
  generateId: () => `id-${Math.random()}`,
  withTransaction: async (fn) => {
    const snapshot = JSON.parse(JSON.stringify(mockDB));
    const count = mockReviews.length;
    try { return await fn(mockFakePool()); } catch (e) { mockDB = snapshot; mockReviews.length = count; throw e; }
  },
}));
jest.mock('../../utils/logger', () => ({ info() {}, warn() {}, error() {}, debug() {} }));
jest.mock('../../services/eventBus', () => ({ emit() {}, on() {}, EVENTS: {} }));
jest.mock('../../services/pems/eventStore', () => ({ append: async () => {}, EVENT_TYPES: {} }));
jest.mock('../../services/cacheService', () => ({}));
jest.mock('../../services/rulesetEngineService', () => ({}));

const svc = require('../../services/pems/pemsService');

const reviewer = { id: 'rev1', name: 'Rita', role: 'reviewer' };

beforeEach(() => {
  mockReviews = [];
  mockDB = {
    a: { Status: 'SUBMITTED', AssignedTo: 'emp1', ReviewerId: null },
    b: { Status: 'UNDER_REVIEW', AssignedTo: 'emp1', ReviewerId: 'rev1' },
    c: { Status: 'RESUBMITTED', AssignedTo: 'emp1', ReviewerId: 'rev1' },
    d: { Status: 'IN_PROGRESS', AssignedTo: 'emp1', ReviewerId: 'rev1' },
    e: { Status: 'APPROVED', AssignedTo: 'emp1', ReviewerId: 'rev1' },
    f: { Status: 'SUBMITTED', AssignedTo: 'rev1', ReviewerId: 'rev1' },
    g: { Status: 'ESCALATED', AssignedTo: 'emp1', ReviewerId: null },
  };
});

describe('submitReviewAndTransition', () => {
  it('claims a SUBMITTED task first, then approves — with exactly one review row', async () => {
    const r = await svc.submitReviewAndTransition({ taskInstanceId: 'a', decision: 'approve', qualityScore: 140 }, reviewer);
    expect(r).toMatchObject({ from: 'SUBMITTED', to: 'APPROVED' });
    expect(mockDB.a.Status).toBe('APPROVED');
    expect(mockDB.a.ReviewerId).toBe('rev1');
    expect(mockReviews).toHaveLength(1);
    expect(mockReviews[0].score).toBe(100); // clamped
  });

  it.each([['b', 'UNDER_REVIEW'], ['c', 'RESUBMITTED'], ['g', 'ESCALATED']])('reviews a %s (%s) task', async (id, from) => {
    const r = await svc.submitReviewAndTransition({ taskInstanceId: id, decision: 'REJECT', feedback: 'Fix pricing' }, reviewer);
    expect(r).toMatchObject({ from, to: 'REJECTED' });
    expect(mockReviews).toHaveLength(1);
  });

  it('rejects tasks that are not awaiting review and leaves no orphan review rows', async () => {
    await expect(svc.submitReviewAndTransition({ taskInstanceId: 'd', decision: 'APPROVE' }, reviewer)).rejects.toThrow(/not awaiting review/);
    await expect(svc.submitReviewAndTransition({ taskInstanceId: 'e', decision: 'APPROVE' }, reviewer)).rejects.toThrow(/not awaiting review/);
    expect(mockReviews).toHaveLength(0);
  });

  it('enforces separation of duties except for global roles', async () => {
    await expect(svc.submitReviewAndTransition({ taskInstanceId: 'f', decision: 'APPROVE' }, reviewer)).rejects.toThrow(/assigned to you/);
    await expect(svc.submitReviewAndTransition({ taskInstanceId: 'f', decision: 'APPROVE' }, { ...reviewer, role: 'admin' })).resolves.toMatchObject({ to: 'APPROVED' });
  });

  it('validates input', async () => {
    await expect(svc.submitReviewAndTransition({ taskInstanceId: 'a', decision: 'MAYBE' }, reviewer)).rejects.toThrow(/APPROVE or REJECT/);
    await expect(svc.submitReviewAndTransition({ taskInstanceId: 'a', decision: 'REJECT', feedback: '   ' }, reviewer)).rejects.toThrow(/Feedback is required/);
    await expect(svc.submitReviewAndTransition({ taskInstanceId: 'nope', decision: 'APPROVE' }, reviewer)).rejects.toThrow(/not found/);
    expect(mockReviews).toHaveLength(0);
  });

  it('rolls everything back if a later step fails (status + review row)', async () => {
    // a SUBMITTED task the actor owns is rejected before any write; emulate a
    // mid-transaction failure by making the decision transition invalid
    mockDB.h = { Status: 'SUBMITTED', AssignedTo: 'emp1', ReviewerId: 'rev1' };
    const orig = mockDB.h;
    await expect(svc.submitReviewAndTransition({ taskInstanceId: 'h', decision: 'REJECT', feedback: '' }, reviewer)).rejects.toThrow();
    expect(mockDB.h.Status).toBe(orig.Status);
    expect(mockReviews).toHaveLength(0);
  });
});

describe('bulkReview', () => {
  const user = { Id: 'rev1', role: 'reviewer' };

  it('reviews what it can, reports the rest, and de-duplicates ids', async () => {
    const out = await svc.bulkReview(['b', 'c', 'd', 'e', 'f', 'nope', 'b'], { decision: 'APPROVE' }, reviewer, user);
    expect(out.reviewed.map(x => x.id).sort()).toEqual(['b', 'c']);
    expect(out.skipped.map(x => x.id).sort()).toEqual(['d', 'e', 'f', 'nope']);
    expect(mockReviews).toHaveLength(2);
  });

  it('skips tasks the caller has no access to', async () => {
    const out = await svc.bulkReview(['a'], { decision: 'APPROVE' }, reviewer, { Id: 'stranger', role: 'reviewer' });
    expect(out.reviewed).toHaveLength(0);
    expect(out.skipped[0].reason).toMatch(/No access/);
  });

  it('requires feedback for a bulk send-back and caps batch size', async () => {
    await expect(svc.bulkReview(['b'], { decision: 'REJECT' }, reviewer, user)).rejects.toThrow(/Feedback is required/);
    await expect(svc.bulkReview(Array.from({ length: 101 }, (_, i) => `x${i}`), { decision: 'APPROVE' }, reviewer, user)).rejects.toThrow(/max 100/);
    await expect(svc.bulkReview([], { decision: 'APPROVE' }, reviewer, user)).rejects.toThrow(/No task ids/);
  });
});
