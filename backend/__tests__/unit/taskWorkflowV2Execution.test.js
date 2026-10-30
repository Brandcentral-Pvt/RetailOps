'use strict';

let mockTask, mockActivity, mockEvidenceCount, mockQueries, mockOtherActivities, mockAudit;
let mockNextId = 0;

const workflow = {
  schemaVersion: '2.0',
  phases: [{
    key: 'verify_inventory', title: 'Verify inventory source',
    activities: [
      {
        key: 'source', title: 'Choose a source',
        instructions: 'Choose a verified inventory source',
        type: 'SELECT_SOURCE', required: true, evidenceRequired: false,
        validatorKey: 'SOURCE_SELECTED',
        fields: [{ key: 'selected', type: 'select', label: 'Source', required: true,
          options: ['RETAILOPS', 'BRANDCENTRAL'] }],
      },
      {
        key: 'verify', title: 'Verify results',
        instructions: 'Verify the inventory and provide supporting proof',
        type: 'CHECKLIST', required: true, evidenceRequired: true,
        validatorKey: 'BOOLEAN_CONFIRMED',
        fields: [{ key: 'checked', type: 'boolean', label: 'Verified', required: true }],
      },
    ],
  }],
};
const snapshot = JSON.stringify({
  viewKey: 'STANDARD_V1', schemaVersion: '2.0',
  definitionVersion: 2, tabs: [], workflow,
});

function connection() {
  return {
    request() {
      const inputs = {};
      const rq = {
        input(name, type, value) {
          inputs[name] = value === undefined ? type : value;
          return rq;
        },
        async query(sqlText) {
          mockQueries.push({ sql: sqlText, inputs: { ...inputs } });
          if (/FROM PemsTaskInstances WITH \(UPDLOCK, HOLDLOCK\)/.test(sqlText) ||
              /SELECT Id, Status, ViewDefinitionId, ViewDefinitionSnapshot FROM PemsTaskInstances/.test(sqlText)) {
            return { recordset: mockTask && inputs.taskId === mockTask.Id ? [mockTask] : [] };
          }
          if (/FROM PemsActivities WITH \(UPDLOCK, ROWLOCK\)/.test(sqlText)) {
            const matches = mockActivity && inputs.taskId === mockActivity.TaskInstanceId
              && inputs.activityId === mockActivity.Id;
            return { recordset: matches ? [{ ...mockActivity }] : [] };
          }
          if (/SELECT COUNT\(\*\) AS EvidenceCount FROM PemsEvidence/.test(sqlText)) {
            return { recordset: [{ EvidenceCount: mockEvidenceCount }] };
          }
          if (/UPDATE PemsActivities SET OutputJson = @outputJson/.test(sqlText)) {
            if (inputs.expectedRevision !== mockActivity.OutputRevision ||
                inputs.taskId !== mockActivity.TaskInstanceId || mockActivity.IsCompleted) {
              return { recordset: [], rowsAffected: [0] };
            }
            mockActivity.OutputJson = inputs.outputJson;
            mockActivity.OutputRevision++;
            mockActivity.OutputUpdatedBy = inputs.actorId;
            return { recordset: [], rowsAffected: [1] };
          }
          if (/INSERT INTO PemsTaskAuditLogs/.test(sqlText)) {
            mockAudit.push({ ...inputs });
            return { recordset: [], rowsAffected: [1] };
          }
          if (/FROM PemsActivities WHERE TaskInstanceId = @taskId/.test(sqlText)) {
            return { recordset: mockOtherActivities };
          }
          throw new Error('Unexpected V2 output SQL: ' + sqlText);
        },
      };
      return rq;
    },
  };
}

jest.mock('../../database/db', () => ({
  sql: require('../../testUtils/fakePool').FAKE_SQL,
  getPool: async () => connection(),
  withTransaction: async fn => fn(connection()),
  generateId: () => 'audit-' + (++mockNextId),
}));
const svc = require('../../services/pems/taskWorkflowV2Execution');
const previous = {
  PEMS_V2_EXECUTION_ENABLED: process.env.PEMS_V2_EXECUTION_ENABLED,
  PEMS_STRICT_ACTIVITY_GATES: process.env.PEMS_STRICT_ACTIVITY_GATES,
  PEMS_PIN_VIEW_SNAPSHOTS: process.env.PEMS_PIN_VIEW_SNAPSHOTS,
};
beforeEach(() => {
  process.env.PEMS_V2_EXECUTION_ENABLED = 'true';
  process.env.PEMS_STRICT_ACTIVITY_GATES = 'true';
  process.env.PEMS_PIN_VIEW_SNAPSHOTS = 'true';
  mockNextId = 0;
  mockQueries = [];
  mockAudit = [];
  mockTask = { Id: 'task-a', Status: 'IN_PROGRESS', ViewDefinitionId: 'view-v2', ViewDefinitionSnapshot: snapshot };
  mockActivity = {
    Id: 'act-source', TaskInstanceId: 'task-a', SubTaskId: 'phase-a',
    WorkflowActivityKey: 'source', ActivityType: 'SELECT_SOURCE',
    OutputJson: null, OutputRevision: 0, IsCompleted: 0,
  };
  mockOtherActivities = [
    mockActivity,
    {
      Id: 'act-verify', TaskInstanceId: 'task-a', SubTaskId: 'phase-a',
      WorkflowActivityKey: 'verify', ActivityType: 'CHECKLIST',
      OutputJson: null, OutputRevision: 0, IsCompleted: 0,
    },
  ];
  mockEvidenceCount = 0;
});
afterAll(() => {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

const save = (overrides = {}) => svc.saveActivityOutput({
  taskId: 'task-a', activityId: 'act-source',
  output: { selected: 'RETAILOPS' }, expectedRevision: 0,
  actorId: 'employee', actorName: 'Employee One',
  ...overrides,
});

describe('Phase 2.2 persisted activity outputs', () => {
  test('serializes parent lock, validated typed output, CAS revision and audit in one transaction', async () => {
    expect(await save()).toMatchObject({ taskId: 'task-a', activityId: 'act-source', revision: 1, alreadySaved: false });
    expect(JSON.parse(mockActivity.OutputJson)).toEqual({ selected: 'RETAILOPS' });
    expect(mockAudit).toHaveLength(1);
    expect(mockAudit[0].details).not.toContain('RETAILOPS');
    const sql = mockQueries.find(x => /UPDATE PemsActivities SET OutputJson = @outputJson/.test(x.sql)).sql;
    expect(sql).toContain('TaskInstanceId = @taskId');
    expect(sql).toContain('OutputRevision = @expectedRevision');
    expect(sql).toContain('IsCompleted = 0');
    expect(mockQueries[0].sql).toContain('UPDLOCK, HOLDLOCK');
  });

  test('exact retry returns current revision without a second audit write', async () => {
    await save();
    const again = await save();
    expect(again).toMatchObject({ revision: 1, alreadySaved: true });
    expect(mockAudit).toHaveLength(1);
  });

  test('stale writer receives a conflict rather than overwriting another saved output', async () => {
    await save();
    await expect(save({ output: { selected: 'BRANDCENTRAL' } }))
      .rejects.toMatchObject({ status: 409, code: 'ACTIVITY_REVISION_CONFLICT' });
    expect(JSON.parse(mockActivity.OutputJson)).toEqual({ selected: 'RETAILOPS' });
  });

  test('another seller activity id cannot be stored against the authorized parent task', async () => {
    mockActivity.TaskInstanceId = 'other-seller-task';
    await expect(save()).rejects.toMatchObject({ status: 404, code: 'ACTIVITY_NOT_FOUND' });
    expect(mockAudit).toHaveLength(0);
  });

  test('schema comes from pinned snapshot, not caller-provided fields or activities', async () => {
    await expect(save({ output: { selected: 'UNTRUSTED' } }))
      .rejects.toMatchObject({ status: 422, code: 'ACTIVITY_OUTPUT_INVALID' });
    await expect(save({ output: { selected: 'RETAILOPS', elevated: true } }))
      .rejects.toMatchObject({ status: 422, code: 'ACTIVITY_OUTPUT_INVALID' });
    expect(mockAudit).toHaveLength(0);
  });

  test('rejects missing revision, nonexecutor, completed or submitted task', async () => {
    await expect(save({ expectedRevision: undefined })).rejects.toMatchObject({ code: 'INVALID_REVISION' });
    await expect(save({ actorId: null })).rejects.toMatchObject({ code: 'ACTOR_REQUIRED' });
    mockActivity.IsCompleted = 1;
    await expect(save()).rejects.toMatchObject({ code: 'ACTIVITY_ALREADY_COMPLETED' });
    mockActivity.IsCompleted = 0;
    mockTask.Status = 'SUBMITTED';
    await expect(save()).rejects.toMatchObject({ code: 'TASK_NOT_EXECUTABLE' });
  });

  test('refuses V2 writes when any required execution flag is disabled', async () => {
    process.env.PEMS_V2_EXECUTION_ENABLED = 'false';
    await expect(save()).rejects.toMatchObject({ code: 'WORKFLOW_V2_NOT_ACTIVATED' });
    process.env.PEMS_V2_EXECUTION_ENABLED = 'true';
    process.env.PEMS_STRICT_ACTIVITY_GATES = 'false';
    await expect(save()).rejects.toMatchObject({ code: 'WORKFLOW_V2_NOT_ACTIVATED' });
  });

  test('evidence can follow an already-validated output, but is required to complete', async () => {
    mockActivity.Id = 'act-verify';
    mockActivity.WorkflowActivityKey = 'verify';
    mockActivity.ActivityType = 'CHECKLIST';
    await expect(save({
      activityId: 'act-verify', output: { checked: true },
    })).resolves.toMatchObject({ revision: 1 });
    await expect(svc.assertStepReady(connection(), 'task-a', 'act-verify'))
      .rejects.toMatchObject({ status: 422, code: 'ACTIVITY_OUTPUT_INVALID' });
    mockEvidenceCount = 1;
    await expect(svc.assertStepReady(connection(), 'task-a', 'act-verify'))
      .resolves.toMatchObject({ activityKey: 'verify', output: { checked: true } });
  });

  test('completion rejects an activity without any persisted output', async () => {
    await expect(svc.assertStepReady(connection(), 'task-a', 'act-source'))
      .rejects.toMatchObject({ code: 'ACTIVITY_OUTPUT_REQUIRED' });
  });

  test('workflow state reads only saved outputs and stable IDs from existing activity rows', async () => {
    const result = await svc.getWorkflowExecution('task-a');
    expect(result).toMatchObject({ taskId: 'task-a', schemaVersion: '2.0', status: 'IN_PROGRESS' });
    expect(result.phases[0].activities).toEqual([
      expect.objectContaining({ key: 'source', activityId: 'act-source', output: null, outputRevision: 0 }),
      expect.objectContaining({ key: 'verify', activityId: 'act-verify', output: null, outputRevision: 0 }),
    ]);
    mockOtherActivities = [mockActivity];
    await expect(svc.getWorkflowExecution('task-a'))
      .rejects.toMatchObject({ code: 'WORKFLOW_STATE_INCOMPLETE' });
  });
});
