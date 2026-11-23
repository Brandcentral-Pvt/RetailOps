'use strict';

const records = [];
let updates = 0;
let transactions = 0;
jest.mock('../../database/db', () => {
  const request = () => {
    const bindings = {};
    const api = {
      input(key, type, value) {
        bindings[key] = value === undefined ? type : value;
        return api;
      },
      async query(query) {
        if (query.includes('SELECT * FROM PemsTemplateViewDefinitions WITH (UPDLOCK, HOLDLOCK)')) {
          return { recordset: records };
        }
        if (query.includes('UPDATE PemsTemplateViewDefinitions')) {
          updates += 1;
          return { rowsAffected: [1] };
        }
        throw new Error('Unexpected SQL: ' + query);
      },
    };
    return api;
  };
  return {
    getPool: jest.fn(() => { throw new Error('Database must not be accessed for invalid create input'); }),
    sql: { VarChar: 'VarChar', Int: 'Int', DateTime2: 'DateTime2', NVarChar: () => 'NVarChar', MAX: 'MAX' },
    generateId: () => 'test-id',
    withTransaction: async callback => {
      transactions += 1;
      return callback({ request });
    },
  };
});

const svc = require('../../services/pems/taskViewDefinitionService');
const definition = (viewKey = 'GUIDED_V1') => ({
  viewKey,
  schemaVersion: '1.0',
  definitionVersion: 2,
  tabs: [{ key: 'work', label: 'Work', widgetKey: 'ChecklistRenderer' }],
});
const row = (json, overrides = {}) => ({
  Id: 'view-1', ViewKey: 'GUIDED_V1', SchemaVersion: '1.0',
  DefinitionVersion: 2, DefinitionJson: JSON.stringify(json), Status: 'DRAFT', ...overrides,
});

beforeEach(() => {
  records.length = 0;
  updates = 0;
  transactions = 0;
});

test('preserves the guided renderer allowlist while checking identity', () => {
  expect(svc.validateDefinitionIdentity({
    viewKey: 'GUIDED_V1', schemaVersion: '1.0', definitionVersion: 2,
  }, definition()).ok).toBe(true);
  expect(svc.ALLOWED_WIDGET_KEYS.has('FileUploadRenderer')).toBe(true);
});

test('rejects conflicting metadata before any SQL is accessed', async () => {
  await expect(svc.createViewDefinition({
    templateId: 'template', viewKey: 'GUIDED_V1', schemaVersion: '1.0',
    definitionVersion: 3, definitionJson: definition(),
  })).rejects.toMatchObject({ code: 'INVALID_DEFINITION_IDENTITY', status: 400 });
});

test('rejects zero and fractional persisted view versions', () => {
  expect(svc.validateDefinitionJson({ ...definition(), definitionVersion: 0 }).ok).toBe(false);
  expect(svc.validateDefinitionJson({ ...definition(), definitionVersion: 1.5 }).ok).toBe(false);
});

test('refuses publication of inconsistent stored metadata under a task-safe transaction', async () => {
  records.push(row(definition(), { DefinitionVersion: 3 }));
  await expect(svc.publishViewDefinition('view-1', 'reviewer'))
    .rejects.toMatchObject({ code: 'INVALID_DEFINITION_IDENTITY', status: 409 });
  expect(transactions).toBe(1);
  expect(updates).toBe(0);
});

test('publishes a matching draft exactly once', async () => {
  records.push(row(definition()));
  const result = await svc.publishViewDefinition('view-1', 'reviewer');
  expect(result.status).toBe('PUBLISHED');
  expect(updates).toBe(1);
});

test('does not write for an invalid or already published state', async () => {
  records.push(row(definition(), { Status: 'ARCHIVED' }));
  await expect(svc.publishViewDefinition('view-1', 'reviewer'))
    .rejects.toMatchObject({ code: 'INVALID_VIEW_STATUS' });
  expect(updates).toBe(0);
  records[0].Status = 'PUBLISHED';
  expect((await svc.publishViewDefinition('view-1', 'reviewer')).alreadyPublished).toBe(true);
  expect(updates).toBe(0);
});
