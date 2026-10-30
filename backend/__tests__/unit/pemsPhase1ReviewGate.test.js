'use strict';

let mockTaskStatus = 'SUBMITTED';
let mockSubmissionBlocks = { PendingRequired: 1, PendingPhases: 1, PendingBrands: 0, MissingEvidence: 1 };
let mockQueries = [];

function mockTransaction() {
  return {
    request() {
      const inputs = {};
      const request = {
        input(name, type, value) {
          inputs[name] = value === undefined ? type : value;
          return request;
        },
        async query(text) {
          mockQueries.push({ text, inputs: { ...inputs } });
          if (/SELECT Status, AssignedTo, ReviewerId, SellerId(?:, ViewDefinitionSnapshot)? FROM PemsTaskInstances WITH/.test(text)) {
            return { recordset: [{ Status: mockTaskStatus, AssignedTo: 'worker', ReviewerId: 'reviewer', SellerId: null }] };
          }
          if (/AS PendingRequired/.test(text) && /AS PendingBrands/.test(text)) {
            return { recordset: [mockSubmissionBlocks] };
          }
          if (/SELECT Status, AssignedTo, AssigneeName, ReviewerId, ReviewerName/.test(text)) {
            return { recordset: [{
              Status: mockTaskStatus, AssignedTo: 'worker', AssigneeName: 'Worker',
              ReviewerId: 'reviewer', ReviewerName: 'Reviewer', DueDate: null, SLAHours: 8, Title: 'Task',
            }] };
          }
          if (/UPDATE PemsTaskInstances SET/.test(text)) {
            if (inputs.status) mockTaskStatus = inputs.status;
            return { recordset: [], rowsAffected: [1] };
          }
          return { recordset: [], rowsAffected: [1] };
        },
      };
      return request;
    },
  };
}

jest.mock('../../database/db', () => ({
  sql: require('../../testUtils/fakePool').FAKE_SQL,
  generateId: () => 'review-generated-id',
  getPool: async () => mockTransaction(),
  withTransaction: async callback => callback(mockTransaction()),
}));
jest.mock('../../utils/logger', () => ({ info() {}, warn() {}, error() {}, debug() {} }));
jest.mock('../../services/eventBus', () => ({ emit() {}, on() {}, EVENTS: { TASK_TRANSITIONED: 'TASK_TRANSITIONED' } }));
jest.mock('../../services/pems/eventStore', () => ({
  append: async () => {}, EVENTS: { TASK_UPDATED: 'TASK_UPDATED' },
}));
jest.mock('../../services/cacheService', () => ({}));
jest.mock('../../services/rulesetEngineService', () => ({}));

const svc = require('../../services/pems/pemsService');
const existing = process.env.PEMS_STRICT_ACTIVITY_GATES;
const reviewer = { id: 'reviewer', name: 'Reviewer', role: 'admin', user: { Id: 'reviewer', role: { name: 'admin' } } };

beforeEach(() => {
  process.env.PEMS_STRICT_ACTIVITY_GATES = 'true';
  mockTaskStatus = 'SUBMITTED';
  mockSubmissionBlocks = { PendingRequired: 1, PendingPhases: 1, PendingBrands: 0, MissingEvidence: 1 };
  mockQueries = [];
});
afterAll(() => {
  if (existing === undefined) delete process.env.PEMS_STRICT_ACTIVITY_GATES;
  else process.env.PEMS_STRICT_ACTIVITY_GATES = existing;
});

describe('Strict review authorization and completion gates', () => {
  test('reviewer cannot approve incomplete submitted work', async () => {
    await expect(svc.submitReviewAndTransition({
      taskInstanceId: 'task-1', decision: 'APPROVE',
    }, reviewer)).rejects.toMatchObject({ code: 'TASK_WORK_INCOMPLETE', status: 409 });
    expect(mockQueries.some(q => /INSERT INTO PemsTaskReviews/.test(q.text))).toBe(false);
    expect(mockTaskStatus).toBe('SUBMITTED');
  });

  test('rejection can return incomplete work for rework without claiming verification', async () => {
    const result = await svc.submitReviewAndTransition({
      taskInstanceId: 'task-1', decision: 'REJECT', feedback: 'Evidence not attached',
    }, reviewer);
    expect(result).toMatchObject({ decision: 'REJECT', to: 'REJECTED' });
    expect(mockQueries.some(q => /INSERT INTO PemsTaskReviews/.test(q.text))).toBe(true);
    expect(mockTaskStatus).toBe('REJECTED');
  });

  test('complete evidence and steps permit legitimate approval', async () => {
    mockSubmissionBlocks = { PendingRequired: 0, PendingPhases: 0, PendingBrands: 0, MissingEvidence: 0 };
    const result = await svc.submitReviewAndTransition({
      taskInstanceId: 'task-1', decision: 'APPROVE',
    }, reviewer);
    expect(result).toMatchObject({ decision: 'APPROVE', to: 'APPROVED' });
    expect(mockTaskStatus).toBe('APPROVED');
    expect(mockQueries.some(q => /INSERT INTO PemsTaskReviews/.test(q.text))).toBe(true);
  });
});
