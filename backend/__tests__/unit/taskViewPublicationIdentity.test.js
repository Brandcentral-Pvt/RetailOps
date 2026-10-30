'use strict';

/**
 * Regression for a template whose SQL metadata said v2 while its JSON said v1.
 * Such a draft used to publish successfully and then block task creation with
 * TASK_VIEW_INVALID when PEMS_PIN_VIEW_SNAPSHOTS=true.
 *
 * Exercise the actual create, publish and pin service entry points together.
 */
let mockRecords = [];
let mockCalls = [];
let mockNextId = 0;
let mockTransactions = 0;
let mockFailUpdate = false;

function mockPool() {
  return {
    request() {
      const bindings = {};
      const request = {
        input(name, type, value) {
          bindings[name] = value === undefined ? type : value;
          return request;
        },
        async query(query) {
          mockCalls.push({ query, bindings: { ...bindings } });
          if (/SELECT Id FROM PemsTemplateViewDefinitions\s+WHERE TemplateId = @templateId AND ViewKey = @viewKey/.test(query)) {
            return {
              recordset: mockRecords.filter(r => r.TemplateId === bindings.templateId
                && r.ViewKey === bindings.viewKey && r.DefinitionVersion === bindings.definitionVersion)
                .map(r => ({ Id: r.Id })),
            };
          }
          if (/INSERT INTO PemsTemplateViewDefinitions/.test(query)) {
            mockRecords.push({
              Id: bindings.id,
              TemplateId: bindings.templateId,
              ViewKey: bindings.viewKey,
              SchemaVersion: bindings.schemaVersion,
              DefinitionVersion: bindings.definitionVersion,
              DefinitionJson: bindings.definitionJson,
              Status: bindings.status,
            });
            return { recordset: [], rowsAffected: [1] };
          }
          if (/SELECT \* FROM PemsTemplateViewDefinitions WITH \(UPDLOCK, HOLDLOCK\) WHERE Id = @id/.test(query)) {
            const row = mockRecords.find(r => r.Id === bindings.id);
            return { recordset: row ? [{ ...row }] : [] };
          }
          if (/UPDATE PemsTemplateViewDefinitions\s+SET Status = @status/.test(query)) {
            const row = mockRecords.find(r => r.Id === bindings.id && r.Status === 'DRAFT');
            if (!row || mockFailUpdate) return { recordset: [], rowsAffected: [0] };
            row.Status = bindings.status;
            row.PublishedAt = bindings.publishedAt;
            row.PublishedBy = bindings.publishedBy;
            return { recordset: [], rowsAffected: [1] };
          }
          if (/SELECT TOP \(1\) Id, DefinitionJson, ViewKey, SchemaVersion, DefinitionVersion/.test(query)) {
            const row = mockRecords.filter(r => r.TemplateId === bindings.templateId && r.Status === 'PUBLISHED')
              .sort((a, b) => b.DefinitionVersion - a.DefinitionVersion)[0];
            return { recordset: row ? [{ ...row }] : [] };
          }
          throw new Error('Unexpected SQL in view identity regression: ' + query);
        },
      };
      return request;
    },
  };
}

jest.mock('../../database/db', () => ({
  sql: require('../../testUtils/fakePool').FAKE_SQL,
  generateId: () => 'view-' + (++mockNextId),
  getPool: async () => mockPool(),
  withTransaction: async callback => {
    mockTransactions++;
    return callback(mockPool());
  },
}));

const viewService = require('../../services/pems/taskViewDefinitionService');
const snapshots = require('../../services/pems/taskInstanceSnapshot');

const baseDefinition = () => ({
  viewKey: 'STANDARD_V1',
  schemaVersion: '1.0',
  definitionVersion: 2,
  tabs: [],
  widgets: [],
});
const createArgs = (definitionJson = baseDefinition(), metadata = {}) => ({
  templateId: 'tpl-1',
  viewKey: 'STANDARD_V1',
  schemaVersion: '1.0',
  definitionVersion: 2,
  definitionJson,
  status: 'DRAFT',
  createdBy: 'creator',
  ...metadata,
});
function seedExisting(id, definition, metadata = {}) {
  const row = {
    Id: id,
    TemplateId: 'tpl-1',
    ViewKey: 'STANDARD_V1',
    SchemaVersion: '1.0',
    DefinitionVersion: 2,
    DefinitionJson: JSON.stringify(definition),
    Status: 'DRAFT',
    ...metadata,
  };
  mockRecords.push(row);
  return row;
}

const oldFlag = process.env.PEMS_PIN_VIEW_SNAPSHOTS;
beforeEach(() => {
  mockRecords = [];
  mockCalls = [];
  mockNextId = 0;
  mockTransactions = 0;
  mockFailUpdate = false;
  process.env.PEMS_PIN_VIEW_SNAPSHOTS = 'true';
});
afterAll(() => {
  if (oldFlag === undefined) delete process.env.PEMS_PIN_VIEW_SNAPSHOTS;
  else process.env.PEMS_PIN_VIEW_SNAPSHOTS = oldFlag;
});

describe('View definition metadata identity lifecycle', () => {
  test.each([
    ['version', { definitionVersion: 1 }],
    ['schema', { schemaVersion: '2.0' }],
    ['view key', { viewKey: 'OOS_RECON_V1' }],
  ])('creation rejects JSON with conflicting %s metadata before database access', async (_, overrides) => {
    await expect(viewService.createViewDefinition(createArgs({
      ...baseDefinition(), ...overrides,
    }))).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_DEFINITION_IDENTITY',
    });
    expect(mockCalls).toHaveLength(0);
    expect(mockRecords).toHaveLength(0);
  });

  test.each([
    ['version', { definitionVersion: 1 }],
    ['schema', { schemaVersion: '2.0' }],
    ['view key', { viewKey: 'OOS_RECON_V1' }],
  ])('publication rejects legacy persisted drafts with conflicting %s metadata', async (_, overrides) => {
    seedExisting('old-broken', { ...baseDefinition(), ...overrides });
    await expect(viewService.publishViewDefinition('old-broken', 'publisher'))
      .rejects.toMatchObject({ status: 409, code: 'INVALID_DEFINITION_IDENTITY' });
    expect(mockRecords[0].Status).toBe('DRAFT');
    expect(mockTransactions).toBe(1);
    expect(mockCalls.some(c => /UPDATE PemsTemplateViewDefinitions/.test(c.query))).toBe(false);
  });

  test('invalid stored JSON cannot be published', async () => {
    seedExisting('broken-json', baseDefinition(), { DefinitionJson: '{bad json' });
    await expect(viewService.publishViewDefinition('broken-json', 'publisher'))
      .rejects.toMatchObject({ status: 409, code: 'INVALID_DEFINITION' });
    expect(mockCalls.some(c => /UPDATE PemsTemplateViewDefinitions/.test(c.query))).toBe(false);
  });

  test('already published but corrupted definitions must not pass idempotent publication', async () => {
    seedExisting('bad-published', { ...baseDefinition(), definitionVersion: 1 }, { Status: 'PUBLISHED' });
    await expect(viewService.publishViewDefinition('bad-published', 'publisher'))
      .rejects.toMatchObject({ status: 409, code: 'INVALID_DEFINITION_IDENTITY' });
  });

  test('complete create, publish, pin lifecycle uses identical metadata and version', async () => {
    const definition = baseDefinition();
    const created = await viewService.createViewDefinition(createArgs(definition));
    expect(created).toMatchObject({ id: 'view-1', viewKey: 'STANDARD_V1', definitionVersion: 2 });
    const published = await viewService.publishViewDefinition(created.id, 'publisher');
    expect(published).toMatchObject({ Status: 'PUBLISHED', status: 'PUBLISHED' });
    const pinned = await snapshots.resolveViewPin(mockPool(), 'tpl-1');
    expect(pinned).toMatchObject({ pinned: true, viewDefinitionId: created.id });
    expect(JSON.parse(pinned.snapshotJson)).toEqual(definition);
    const lock = mockCalls.find(c => /SELECT \* FROM PemsTemplateViewDefinitions WITH \(UPDLOCK, HOLDLOCK\)/.test(c.query));
    expect(lock).toBeTruthy();
    expect(mockTransactions).toBe(1);
  });

  test('re-publishing an already valid published definition is idempotent', async () => {
    seedExisting('published-good', baseDefinition(), { Status: 'PUBLISHED' });
    const result = await viewService.publishViewDefinition('published-good', 'publisher');
    expect(result).toMatchObject({ alreadyPublished: true, Status: 'PUBLISHED' });
    expect(mockCalls.some(c => /UPDATE PemsTemplateViewDefinitions/.test(c.query))).toBe(false);
  });

  test('a failed publication update does not produce false success', async () => {
    seedExisting('stale', baseDefinition());
    mockFailUpdate = true;
    await expect(viewService.publishViewDefinition('stale', 'publisher'))
      .rejects.toMatchObject({ status: 409, code: 'VIEW_PUBLISH_CONFLICT' });
    expect(mockRecords[0].Status).toBe('DRAFT');
  });

  test('non-draft and non-published state is not reported as published', async () => {
    seedExisting('archived', baseDefinition(), { Status: 'ARCHIVED' });
    await expect(viewService.publishViewDefinition('archived', 'publisher'))
      .rejects.toMatchObject({ status: 409, code: 'INVALID_VIEW_STATUS' });
    expect(mockCalls.some(c => /UPDATE PemsTemplateViewDefinitions/.test(c.query))).toBe(false);
  });

  test('missing definition fails closed without trying to publish', async () => {
    await expect(viewService.publishViewDefinition('not-found', 'publisher'))
      .rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });
});


test('V2 workflow cannot be published until its activity execution and storage adapter is ready', async () => {
  const validWorkflow = {
    schemaVersion: '2.0',
    phases: [{
      key: 'p', title: 'Phase',
      activities: [{
        key: 'a', title: 'Confirm', instructions: 'Review the source',
        type: 'CHECKLIST', required: true, evidenceRequired: false,
        validatorKey: 'BOOLEAN_CONFIRMED',
        fields: [{ key: 'checked', type: 'boolean', label: 'Checked', required: true }],
      }],
    }],
  };
  seedExisting('view-pending', {
    ...baseDefinition(), schemaVersion: '2.0', workflow: validWorkflow,
  }, { SchemaVersion: '2.0' });
  await expect(viewService.publishViewDefinition('view-pending', 'publisher'))
    .rejects.toMatchObject({ status: 409, code: 'WORKFLOW_V2_NOT_ACTIVATED' });
  expect(mockRecords[0].Status).toBe('DRAFT');
  expect(mockCalls.some(c => /UPDATE PemsTemplateViewDefinitions/.test(c.query))).toBe(false);
});


describe('Phase 2.2 controlled V2 publication', () => {
  const keys = ['PEMS_V2_EXECUTION_ENABLED', 'PEMS_STRICT_ACTIVITY_GATES', 'PEMS_PIN_VIEW_SNAPSHOTS'];
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  afterAll(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const v2 = () => ({
    viewKey: 'STANDARD_V1', schemaVersion: '2.0', definitionVersion: 2, tabs: [],
    workflow: {
      schemaVersion: '2.0', phases: [{
        key: 'check', title: 'Check',
        activities: [{
          key: 'source', title: 'Select source', instructions: 'Choose approved report',
          type: 'SELECT_SOURCE', required: true, evidenceRequired: false,
          validatorKey: 'SOURCE_SELECTED',
          fields: [{ key: 'value', label: 'Source', type: 'select', required: true,
            options: ['RETAILOPS', 'BRANDCENTRAL'] }],
        }],
      }],
    },
  });
  beforeEach(() => {
    for (const key of keys) process.env[key] = 'true';
  });

  test('publishes conditional-free V2 only with all development gates enabled', async () => {
    seedExisting('v2-ready', v2(), { SchemaVersion: '2.0' });
    const result = await viewService.publishViewDefinition('v2-ready', 'approver');
    expect(result.status).toBe('PUBLISHED');
    const pin = await snapshots.resolveViewPin(mockPool(), 'tpl-1');
    expect(pin).toMatchObject({ pinned: true, viewDefinitionId: 'v2-ready' });
    expect(JSON.parse(pin.snapshotJson).workflow.phases[0].activities[0].key).toBe('source');
  });

  test('conditional templates cannot be published until Phase 2.3 skip semantics', async () => {
    const def = v2();
    def.workflow.phases[0].activities.push({
      key: 'dependent', title: 'Dependent step', instructions: 'Wait for source',
      type: 'CHECKLIST', required: true, evidenceRequired: false,
      validatorKey: 'BOOLEAN_CONFIRMED',
      visibleWhen: { field: 'source.value', operator: 'equals', value: 'RETAILOPS' },
      fields: [{ key: 'verified', label: 'Verified', type: 'boolean', required: true }],
    });
    seedExisting('v2-conditional', def, { SchemaVersion: '2.0' });
    await expect(viewService.publishViewDefinition('v2-conditional', 'approver'))
      .rejects.toMatchObject({ code: 'WORKFLOW_V2_CONDITIONS_PENDING', status: 409 });
    expect(mockRecords[0].Status).toBe('DRAFT');
  });

  test('strict-mode flag is mandatory for new V2 publications', async () => {
    process.env.PEMS_STRICT_ACTIVITY_GATES = 'false';
    seedExisting('v2-disabled', v2(), { SchemaVersion: '2.0' });
    await expect(viewService.publishViewDefinition('v2-disabled', 'approver'))
      .rejects.toMatchObject({ code: 'WORKFLOW_V2_NOT_ACTIVATED', status: 409 });
  });
});
