'use strict';

let mockStatus = 'IN_PROGRESS';
let mockChildTask = 'task-1';
let mockDuplicate = false;
let mockQueries = [];
let mockId = 0;

jest.mock('../../database/db', () => ({
  sql: require('../../testUtils/fakePool').FAKE_SQL,
  generateId: () => 'proof-id-' + (++mockId),
  getPool: async () => mockConnection(),
  withTransaction: async callback => callback(mockConnection()),
}));

function mockConnection() {
  return {
    request() {
      let inputs = {};
      const request = {
        input(name, type, value) {
          inputs[name] = value === undefined ? type : value;
          return request;
        },
        async query(query) {
          mockQueries.push({ query, inputs: { ...inputs } });
          if (/FROM PemsTaskInstances WITH \(UPDLOCK, HOLDLOCK\)/.test(query)) {
            return { recordset: [{ Id: 'task-1', Status: mockStatus }] };
          }
          if (/SELECT Id, TaskInstanceId, SubTaskId FROM PemsActivities/.test(query)) {
            return { recordset: [{ Id: 'act-1', TaskInstanceId: mockChildTask, SubTaskId: 'phase-1' }] };
          }
          if (/SELECT Id, TaskInstanceId FROM PemsSubTasks/.test(query)) {
            return { recordset: [{ Id: 'phase-1', TaskInstanceId: mockChildTask }] };
          }
          if (/SELECT TOP \(1\) Id FROM PemsEvidence/.test(query)) {
            return { recordset: mockDuplicate ? [{ Id: 'proof-existing' }] : [] };
          }
          return { recordset: [], rowsAffected: [1] };
        },
      };
      return request;
    },
  };
}

jest.mock('../../utils/logger', () => ({ info() {}, warn() {}, error() {}, debug() {} }));
jest.mock('../../services/eventBus', () => ({ emit() {}, on() {}, EVENTS: {} }));
jest.mock('../../services/pems/eventStore', () => ({ append: async () => {}, EVENT_TYPES: {} }));
jest.mock('../../services/cacheService', () => ({}));
jest.mock('../../services/rulesetEngineService', () => ({}));

const svc = require('../../services/pems/pemsService');
const previousFlag = process.env.PEMS_STRICT_ACTIVITY_GATES;
beforeEach(() => {
  mockStatus = 'IN_PROGRESS';
  mockChildTask = 'task-1';
  mockDuplicate = false;
  mockId = 0;
  mockQueries = [];
  process.env.PEMS_STRICT_ACTIVITY_GATES = 'true';
});
afterAll(() => {
  if (previousFlag === undefined) delete process.env.PEMS_STRICT_ACTIVITY_GATES;
  else process.env.PEMS_STRICT_ACTIVITY_GATES = previousFlag;
});

function proof(overrides = {}) {
  return {
    taskInstanceId: 'task-1', subTaskId: 'phase-1', activityId: 'act-1',
    fileName: 'Inventory check', fileUrl: 'https://drive.google.com/file/example',
    fileType: 'LINK', uploadedBy: 'worker-1', uploadedByName: 'Worker One', ...overrides,
  };
}

describe('Activity-linked PEMS evidence end-to-end service contract', () => {
  it('stores activity and phase identity on one evidence record', async () => {
    const result = await svc.uploadEvidence(proof());
    expect(result).toMatchObject({ id: 'proof-id-1' });
    const insert = mockQueries.find(q => /INSERT INTO PemsEvidence/.test(q.query));
    expect(insert.inputs).toMatchObject({
      taskInstanceId: 'task-1', subTaskId: 'phase-1',
      activityId: 'act-1', uploadedBy: 'worker-1',
    });
    expect(mockQueries.some(q => /INSERT INTO PemsTaskAuditLogs/.test(q.query))).toBe(true);
  });

  it('rejects evidence attached to an activity from another task', async () => {
    mockChildTask = 'other-seller-task';
    await expect(svc.uploadEvidence(proof())).rejects.toMatchObject({ status: 400 });
    expect(mockQueries.some(q => /INSERT INTO PemsEvidence/.test(q.query))).toBe(false);
  });

  it('does not let submitted work gain new execution evidence', async () => {
    mockStatus = 'SUBMITTED';
    await expect(svc.uploadEvidence(proof())).rejects.toMatchObject({ status: 409 });
    expect(mockQueries.some(q => /INSERT INTO PemsEvidence/.test(q.query))).toBe(false);
  });

  it('returns an existing proof for the same activity, source and uploader', async () => {
    mockDuplicate = true;
    expect(await svc.uploadEvidence(proof())).toMatchObject({
      id: 'proof-existing', alreadyExists: true,
    });
    expect(mockQueries.some(q => /INSERT INTO PemsEvidence/.test(q.query))).toBe(false);
  });

  it('allows general task evidence but never counts it as activity-linked proof', async () => {
    await svc.uploadEvidence(proof({ activityId: null, subTaskId: null }));
    const insert = mockQueries.find(q => /INSERT INTO PemsEvidence/.test(q.query));
    expect(insert.inputs.activityId).toBeNull();
    expect(insert.inputs.subTaskId).toBeNull();
  });
});
