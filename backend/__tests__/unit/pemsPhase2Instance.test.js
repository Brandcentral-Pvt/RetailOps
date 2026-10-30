'use strict';

let mockCalls, mockNextId, mockPublished, mockSop;

const inventory = {
  viewKey: 'STANDARD_V1', schemaVersion: '2.0', definitionVersion: 2, tabs: [],
  workflow: {
    schemaVersion: '2.0', phases: [
      { key: 'inventory', title: 'Verify stock', activities: [
        { key: 'choose_source', title: 'Select source', instructions: 'Choose inventory source',
          type: 'SELECT_SOURCE', required: true, evidenceRequired: false,
          validatorKey: 'SOURCE_SELECTED',
          fields: [{ key: 'source', label: 'Source', type: 'select', required: true, options: ['RETAILOPS','BRANDCENTRAL'] }] },
        { key: 'confirm_stock', title: 'Confirm stock', instructions: 'Verify stock evidence',
          type: 'CHECKLIST', required: true, evidenceRequired: true,
          validatorKey: 'BOOLEAN_CONFIRMED',
          fields: [{ key: 'checked', label: 'Checked', type: 'boolean', required: true }] },
      ] },
      { key: 'resolution', title: 'Describe findings', activities: [
        { key: 'notes', title: 'Document stock issues', instructions: 'Describe the results',
          type: 'FORM_INPUT', required: true, evidenceRequired: false,
          validatorKey: 'NONEMPTY_TEXT',
          fields: [{ key: 'finding', label: 'Finding', type: 'text', required: true }] },
      ] },
    ],
  },
};

function mockConnection() {
  return {
    request() {
      const inputs = {};
      const request = {
        input(name, type, value) { inputs[name] = value === undefined ? type : value; return request; },
        async query(sqlText) {
          mockCalls.push({ sql: sqlText, inputs: { ...inputs } });
          if (/COUNT\(\*\) as c FROM PemsTaskInstances/.test(sqlText)) return { recordset: [{ c: 0 }], rowsAffected: [1] };
          if (/SELECT Department, SubTaskDefinitions FROM PemsTaskTemplates/.test(sqlText))
            return { recordset: [{ Department: 'Operations', SubTaskDefinitions: JSON.stringify(mockSop) }] };
          if (/FROM PemsTemplateViewDefinitions/.test(sqlText))
            return { recordset: mockPublished ? [mockPublished] : [] };
          if (/COUNT\(\*\) as stCount FROM PemsSubTasks/.test(sqlText))
            return { recordset: [{ stCount: mockCalls.filter(c => /INSERT INTO PemsSubTasks/.test(c.sql)).length }] };
          if (/COUNT\(\*\) as actCount FROM PemsActivities/.test(sqlText))
            return { recordset: [{ actCount: mockCalls.filter(c => /INSERT INTO PemsActivities/.test(c.sql)).length }] };
          return { recordset: [], rowsAffected: [1] };
        },
      };
      return request;
    },
  };
}

jest.mock('../../database/db', () => ({
  sql: require('../../testUtils/fakePool').FAKE_SQL,
  getPool: async () => mockConnection(),
  generateId: () => 'id-' + (++mockNextId),
  withTransaction: async fn => fn(mockConnection()),
}));
jest.mock('../../utils/logger', () => ({ info() {}, warn() {}, error() {}, debug() {} }));
jest.mock('../../services/eventBus', () => ({ emit() {}, on() {}, EVENTS: {} }));
jest.mock('../../services/pems/eventStore', () => ({ append: async () => {}, EVENT_TYPES: {} }));
jest.mock('../../services/cacheService', () => ({}));
jest.mock('../../services/rulesetEngineService', () => ({}));

const pems = require('../../services/pems/pemsService');
const original = {
  PEMS_PIN_VIEW_SNAPSHOTS: process.env.PEMS_PIN_VIEW_SNAPSHOTS,
  PEMS_STRICT_ACTIVITY_GATES: process.env.PEMS_STRICT_ACTIVITY_GATES,
  PEMS_V2_EXECUTION_ENABLED: process.env.PEMS_V2_EXECUTION_ENABLED,
};
beforeEach(() => {
  process.env.PEMS_PIN_VIEW_SNAPSHOTS = 'true';
  process.env.PEMS_STRICT_ACTIVITY_GATES = 'true';
  process.env.PEMS_V2_EXECUTION_ENABLED = 'true';
  mockCalls = [];
  mockNextId = 0;
  mockSop = [{ title: 'Legacy SOP', activities: [{ title: 'Legacy step' }] }];
  mockPublished = {
    Id: 'view-inventory-v2', ViewKey: 'STANDARD_V1',
    SchemaVersion: '2.0', DefinitionVersion: 2,
    DefinitionJson: JSON.stringify(inventory),
  };
});
afterAll(() => {
  for (const [name, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe('Phase 2.2 task-instance materialization in existing PEMS', () => {
  test('pins V2 and inserts stable phase and activity identities instead of client SOP', async () => {
    await pems.createInstance({
      templateId: 'tpl1', title: 'Inventory', status: 'ASSIGNED',
      subTaskDefinitions: [{ title: 'Forged client phase', activities: [] }],
    });
    const instance = mockCalls.find(c => /INSERT INTO PemsTaskInstances/.test(c.sql));
    expect(JSON.parse(instance.inputs.viewDefinitionSnapshot)).toEqual(inventory);
    const phases = mockCalls.filter(c => /INSERT INTO PemsSubTasks/.test(c.sql));
    expect(phases.map(p => p.inputs.workflowPhaseKey)).toEqual(['inventory', 'resolution']);
    expect(phases.map(p => p.inputs.title)).toEqual(['Verify stock', 'Describe findings']);
    expect(phases.every(p => p.sql.includes('WorkflowPhaseKey'))).toBe(true);
    const activities = mockCalls.filter(c => /INSERT INTO PemsActivities/.test(c.sql));
    expect(activities.map(a => a.inputs.workflowActivityKey))
      .toEqual(['choose_source', 'confirm_stock', 'notes']);
    expect(activities.map(a => a.inputs.activityType))
      .toEqual(['SELECT_SOURCE', 'CHECKLIST', 'FORM_INPUT']);
    expect(activities[1].inputs.evidenceRequired).toBe(1);
    expect(activities.every(a => a.sql.includes('WorkflowActivityKey'))).toBe(true);
  });

  test('conditional snapshots fail before creating task rows (Phase 2.3)', async () => {
    const conditional = JSON.parse(JSON.stringify(inventory));
    conditional.workflow.phases[0].activities[1].visibleWhen =
      { field: 'choose_source.source', operator: 'equals', value: 'RETAILOPS' };
    mockPublished.DefinitionJson = JSON.stringify(conditional);
    await expect(pems.createInstance({ templateId: 'tpl1', title: 'Blocked' }))
      .rejects.toMatchObject({ code: 'WORKFLOW_V2_CONDITIONS_PENDING' });
    expect(mockCalls.some(c => /INSERT INTO PemsTaskInstances/.test(c.sql))).toBe(false);
  });

  test('feature flag off fails closed rather than falling back to legacy steps', async () => {
    process.env.PEMS_V2_EXECUTION_ENABLED = 'false';
    await expect(pems.createInstance({ templateId: 'tpl1', title: 'Blocked' }))
      .rejects.toMatchObject({ code: 'WORKFLOW_V2_NOT_ACTIVATED' });
    expect(mockCalls.some(c => /INSERT INTO PemsSubTasks/.test(c.sql))).toBe(false);
  });

  test('legacy V1 pinned task keeps the original SOP insert shape', async () => {
    const def = { viewKey: 'STANDARD_V1', schemaVersion: '1.0', definitionVersion: 2, tabs: [] };
    mockPublished = { Id: 'v1', ViewKey: 'STANDARD_V1', SchemaVersion: '1.0',
      DefinitionVersion: 2, DefinitionJson: JSON.stringify(def) };
    await pems.createInstance({ templateId: 'tpl1', title: 'Legacy', status: 'ASSIGNED' });
    const phases = mockCalls.filter(c => /INSERT INTO PemsSubTasks/.test(c.sql));
    expect(phases).toHaveLength(1);
    expect(phases[0].inputs.title).toBe('Legacy SOP');
    expect(phases[0].sql).not.toContain('WorkflowPhaseKey');
    const activity = mockCalls.find(c => /INSERT INTO PemsActivities/.test(c.sql));
    expect(activity.sql).not.toContain('WorkflowActivityKey');
  });
});
