'use strict';

let mockPublished = [];
const mockQueries = [];
jest.mock('../../database/db', () => ({
  sql: require('../../testUtils/fakePool').FAKE_SQL,
}));
// Use the actual shared view-identity validator, not a permissive test stub.

const snapshots = require('../../services/pems/taskInstanceSnapshot');
const mockTx = () => ({
  request() {
    const inputs = {};
    const req = {
      input(name, type, value) { inputs[name] = value === undefined ? type : value; return req; },
      async query(text) {
        mockQueries.push({ text, inputs });
        return { recordset: mockPublished };
      },
    };
    return req;
  },
});

const ORIGINAL = process.env.PEMS_PIN_VIEW_SNAPSHOTS;
beforeEach(() => {
  mockQueries.length = 0;
  mockPublished = [];
  delete process.env.PEMS_PIN_VIEW_SNAPSHOTS;
});
afterAll(() => {
  if (ORIGINAL === undefined) delete process.env.PEMS_PIN_VIEW_SNAPSHOTS;
  else process.env.PEMS_PIN_VIEW_SNAPSHOTS = ORIGINAL;
});

test('pinning is opt-in and does not query view definitions when disabled', async () => {
  expect(snapshots.viewPinningEnabled()).toBe(false);
  const pin = await snapshots.resolveViewPin(mockTx(), 'tpl1');
  expect(pin).toMatchObject({ pinned: false, snapshotJson: null, viewDefinitionId: null });
  expect(mockQueries).toHaveLength(0);
});

test('published view is bound to its immutable version in creation transaction', async () => {
  process.env.PEMS_PIN_VIEW_SNAPSHOTS = 'true';
  const definition = { viewKey:'STANDARD_V1', schemaVersion:'1.0', definitionVersion:3, tabs:[] };
  mockPublished = [{ Id:'view-v3', ViewKey:'STANDARD_V1', SchemaVersion:'1.0', DefinitionVersion:3, DefinitionJson:JSON.stringify(definition) }];
  const pin = await snapshots.resolveViewPin(mockTx(), 'tpl1');
  expect(pin).toMatchObject({ pinned:true, viewDefinitionId:'view-v3' });
  expect(JSON.parse(pin.snapshotJson)).toEqual(definition);
  expect(mockQueries[0].text).toContain("Status = 'PUBLISHED'");
  expect(mockQueries[0].text).toContain('DefinitionVersion DESC');
});

test('template without published view pins STANDARD_V1 instead of inheriting future versions', async () => {
  process.env.PEMS_PIN_VIEW_SNAPSHOTS = 'true';
  const pin = await snapshots.resolveViewPin(mockTx(), 'tpl1');
  expect(pin.viewDefinitionId).toBeNull();
  expect(JSON.parse(pin.snapshotJson).viewKey).toBe('STANDARD_V1');
  expect(pin.pinned).toBe(true);
});

test('invalid published JSON blocks task creation rather than binding arbitrary code', async () => {
  process.env.PEMS_PIN_VIEW_SNAPSHOTS = 'true';
  mockPublished = [{ Id:'view', ViewKey:'STANDARD_V1', SchemaVersion:'1.0', DefinitionVersion:1, DefinitionJson:'{invalid' }];
  await expect(snapshots.resolveViewPin(mockTx(), 'tpl1')).rejects.toMatchObject({ code:'TASK_VIEW_INVALID', status:409 });
});

test('mismatched published definition identity is rejected', async () => {
  process.env.PEMS_PIN_VIEW_SNAPSHOTS = 'true';
  mockPublished = [{ Id:'view', ViewKey:'STANDARD_V1', SchemaVersion:'1.0', DefinitionVersion:2, DefinitionJson:JSON.stringify({
    viewKey:'OOS_RECON_V1', schemaVersion:'1.0', definitionVersion:1, tabs:[],
  }) }];
  await expect(snapshots.resolveViewPin(mockTx(), 'tpl1')).rejects.toMatchObject({ code:'TASK_VIEW_INVALID' });
});


test('pinning rejects a published row whose schemaVersion conflicts with JSON', async () => {
  process.env.PEMS_PIN_VIEW_SNAPSHOTS = 'true';
  const definition = { viewKey: 'STANDARD_V1', schemaVersion: '1.0', definitionVersion: 3, tabs: [] };
  mockPublished = [{
    Id: 'schema-mismatch', ViewKey: 'STANDARD_V1', SchemaVersion: '2.0',
    DefinitionVersion: 3, DefinitionJson: JSON.stringify(definition),
  }];
  await expect(snapshots.resolveViewPin(mockTx(), 'tpl1'))
    .rejects.toMatchObject({ code: 'TASK_VIEW_INVALID', status: 409 });
});

test('pinning rejects a published row whose definitionVersion conflicts with JSON', async () => {
  process.env.PEMS_PIN_VIEW_SNAPSHOTS = 'true';
  const definition = { viewKey: 'STANDARD_V1', schemaVersion: '1.0', definitionVersion: 1, tabs: [] };
  mockPublished = [{
    Id: 'version-mismatch', ViewKey: 'STANDARD_V1', SchemaVersion: '1.0',
    DefinitionVersion: 2, DefinitionJson: JSON.stringify(definition),
  }];
  await expect(snapshots.resolveViewPin(mockTx(), 'tpl1'))
    .rejects.toMatchObject({ code: 'TASK_VIEW_INVALID', status: 409 });
});


test('published V2 workflow cannot be pinned before its execution persistence is implemented', async () => {
  process.env.PEMS_PIN_VIEW_SNAPSHOTS = 'true';
  const definition = {
    viewKey: 'STANDARD_V1', schemaVersion: '2.0', definitionVersion: 2,
    tabs: [], workflow: { schemaVersion: '2.0', phases: [{
      key: 'p', title: 'Required phase',
      activities: [{
        key: 'check', title: 'Verify source', instructions: 'Confirm the source',
        type: 'CHECKLIST', required: true, evidenceRequired: false,
        validatorKey: 'BOOLEAN_CONFIRMED',
        fields: [{ key: 'checked', type: 'boolean', label: 'Checked', required: true }],
      }],
    }] },
  };
  mockPublished = [{
    Id: 'view-v2', ViewKey: 'STANDARD_V1', SchemaVersion: '2.0',
    DefinitionVersion: 2, DefinitionJson: JSON.stringify(definition),
  }];
  await expect(snapshots.resolveViewPin(mockTx(), 'tpl1'))
    .rejects.toMatchObject({ status: 409, code: 'WORKFLOW_V2_NOT_ACTIVATED' });
});
