'use strict';

let mockQueries = [];
const mockPool = () => ({
  request() {
    const request = {
      input() { return request; },
      async query(query) {
        mockQueries.push(query);
        if (/SELECT Id FROM PemsTaskInstances WHERE Status NOT IN/.test(query)) {
          return { recordset: [{ Id: 'task-1' }] };
        }
        if (/SELECT WeightagePct, IsCompleted, SubTaskCode, Title/.test(query)) {
          return { recordset: [{ WeightagePct: 100, IsCompleted: 0 }] };
        }
        return { recordset: [], rowsAffected: [1] };
      },
    };
    return request;
  },
});

jest.mock('../../database/db', () => ({
  sql: require('../../testUtils/fakePool').FAKE_SQL,
  getPool: async () => mockPool(),
  generateId: () => 'mockid',
  withTransaction: async callback => callback(mockPool()),
}));
jest.mock('../../utils/logger', () => ({ info() {},warn() {},error() {},debug() {} }));
jest.mock('../../services/eventBus', () => ({ emit() {},on() {},EVENTS:{} }));
jest.mock('../../services/pems/eventStore', () => ({ append:async()=>{},EVENT_TYPES:{} }));
jest.mock('../../services/cacheService', () => ({}));
jest.mock('../../services/rulesetEngineService', () => ({}));

const guards = require('../../services/pems/taskExecutionGates');
const svc = require('../../services/pems/pemsService');
const previous = process.env.PEMS_STRICT_ACTIVITY_GATES;
afterAll(() => {
  if (previous === undefined) delete process.env.PEMS_STRICT_ACTIVITY_GATES;
  else process.env.PEMS_STRICT_ACTIVITY_GATES = previous;
});

describe('Administrative task progress reconciliation', () => {
  beforeEach(() => { mockQueries = []; jest.restoreAllMocks(); });

  test('strict mode uses the shared transactional activity/brand progress algorithm', async () => {
    process.env.PEMS_STRICT_ACTIVITY_GATES = 'true';
    const lock = jest.spyOn(guards, 'lockTaskForExecution').mockResolvedValue({ Id:'task-1' });
    const progress = jest.spyOn(guards, 'reconcileTaskProgress').mockResolvedValue({ progress:25, weighted:25 });
    const result = await svc.recalculateAllWeightedProgress();
    expect(result).toEqual({ updated:1 });
    expect(lock).toHaveBeenCalledWith(expect.anything(), 'task-1');
    expect(progress).toHaveBeenCalledWith(expect.anything(), 'task-1');
    expect(mockQueries.some(q => /SELECT WeightagePct, IsCompleted, SubTaskCode, Title/.test(q))).toBe(false);
  });

  test('legacy mode retains its existing phase-weighted calculation', async () => {
    delete process.env.PEMS_STRICT_ACTIVITY_GATES;
    const progress = jest.spyOn(guards, 'reconcileTaskProgress').mockResolvedValue({});
    const result = await svc.recalculateAllWeightedProgress();
    expect(result).toEqual({ updated:1 });
    expect(progress).not.toHaveBeenCalled();
    expect(mockQueries.some(q => /SELECT WeightagePct, IsCompleted, SubTaskCode, Title/.test(q))).toBe(true);
  });
});
