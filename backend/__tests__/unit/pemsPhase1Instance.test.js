/**
 * Template instance creation must pin the view definition in the SAME SQL
 * transaction as the copied SOP activity rows.
 */
let mockCalls = [];
let mockPublished = [];
let mockInstanceCount = 0;
let mockTemplateSop = [];
let mockNextId = 0;

function fakePool() {
  return {
    request() {
      const inputs = {};
      const req = {
        input(name, type, value) { inputs[name] = value === undefined ? type : value; return req; },
        async query(sqlText) {
          mockCalls.push({ sql:sqlText, inputs:{...inputs} });
          if (/COUNT\(\*\) as c FROM PemsTaskInstances/.test(sqlText)) return { recordset:[{c:mockInstanceCount}], rowsAffected:[1] };
          if (/SELECT Department, SubTaskDefinitions FROM PemsTaskTemplates/.test(sqlText))
            return { recordset:[{Department:'Operations',SubTaskDefinitions:JSON.stringify(mockTemplateSop)}], rowsAffected:[1] };
          if (/FROM PemsTemplateViewDefinitions/.test(sqlText))
            return { recordset:mockPublished, rowsAffected:[mockPublished.length] };
          if (/COUNT\(\*\) as stCount FROM PemsSubTasks/.test(sqlText))
            return { recordset:[{stCount:mockTemplateSop.length}], rowsAffected:[1] };
          if (/COUNT\(\*\) as actCount FROM PemsActivities/.test(sqlText))
            return { recordset:[{actCount:mockTemplateSop.reduce((n,p)=>n+(p.activities||[]).length,0)}], rowsAffected:[1] };
          return {recordset:[], rowsAffected:[1]};
        },
      };
      return req;
    },
  };
}

jest.mock('../../database/db', () => ({
  sql: require('../../testUtils/fakePool').FAKE_SQL,
  getPool: async () => fakePool(),
  generateId: () => 'id-' + (++mockNextId),
  withTransaction: async (fn) => fn(fakePool()),
}));
jest.mock('../../utils/logger', () => ({ info() {},warn() {},error() {},debug() {} }));
jest.mock('../../services/eventBus', () => ({emit() {},on() {},EVENTS:{} }));
jest.mock('../../services/pems/eventStore', () => ({append:async()=>{},EVENT_TYPES:{} }));
jest.mock('../../services/cacheService', () => ({}));
jest.mock('../../services/rulesetEngineService', () => ({}));

const svc = require('../../services/pems/pemsService');
const original = process.env.PEMS_PIN_VIEW_SNAPSHOTS;

beforeEach(() => {
  mockCalls = [];
  mockPublished = [];
  mockInstanceCount = 0;
  mockNextId = 0;
  mockTemplateSop = [{title:'Verify inventory',activities:[
    {title:'Check stock',instructions:'Inspect source',isMandatory:true,evidenceRequired:true},
  ]}];
  process.env.PEMS_PIN_VIEW_SNAPSHOTS = 'true';
});
afterAll(() => {
  if (original === undefined) delete process.env.PEMS_PIN_VIEW_SNAPSHOTS;
  else process.env.PEMS_PIN_VIEW_SNAPSHOTS = original;
});

test('new task pins published view and copies effective SOP from the locked template', async () => {
  const view = {viewKey:'STANDARD_V1',schemaVersion:'1.0',definitionVersion:1,tabs:[]};
  mockPublished = [{
    Id:'view-1',ViewKey:'STANDARD_V1',DefinitionVersion:1,DefinitionJson:JSON.stringify(view),
  }];
  await svc.createInstance({
    templateId:'tpl-1',title:'Daily check',status:'ASSIGNED',frequency:'DAILY',
    subTaskDefinitions:[{title:'Tampered client activity',activities:[]}],
  });
  const created = mockCalls.find(c => /INSERT INTO PemsTaskInstances/.test(c.sql));
  expect(created.sql).toContain('ViewDefinitionSnapshot');
  expect(created.inputs.viewDefinitionId).toBe('view-1');
  expect(JSON.parse(created.inputs.viewDefinitionSnapshot)).toEqual(view);
  const subtasks = mockCalls.filter(c => /INSERT INTO PemsSubTasks/.test(c.sql));
  expect(subtasks).toHaveLength(1);
  expect(subtasks[0].inputs.title).toBe('Verify inventory');
  const activities = mockCalls.filter(c => /INSERT INTO PemsActivities/.test(c.sql));
  expect(activities[0].inputs.evidenceRequired).toBe(1);
});

test('legacy mode leaves new view columns out of the INSERT', async () => {
  delete process.env.PEMS_PIN_VIEW_SNAPSHOTS;
  await svc.createInstance({templateId:'tpl-1',title:'Legacy',status:'DRAFT'});
  const insert = mockCalls.find(c => /INSERT INTO PemsTaskInstances/.test(c.sql));
  expect(insert.sql).not.toContain('ViewDefinitionSnapshot');
});

test('invalid published view aborts before task creation', async () => {
  mockPublished = [{ Id:'bad',ViewKey:'STANDARD_V1',DefinitionVersion:2,DefinitionJson:'{not json' }];
  await expect(svc.createInstance({templateId:'tpl-1',title:'Blocked'})).rejects.toMatchObject({code:'TASK_VIEW_INVALID'});
  expect(mockCalls.some(c => /INSERT INTO PemsTaskInstances/.test(c.sql))).toBe(false);
});
