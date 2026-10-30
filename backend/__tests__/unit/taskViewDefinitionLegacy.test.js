'use strict';

let mockTaskRow = null;
let mockPinnedDefinition = null;
let mockQueries = [];

jest.mock('../../database/db', () => ({
  sql: require('../../testUtils/fakePool').FAKE_SQL,
  getPool: async () => ({
    request() {
      const request = {
        input() { return request; },
        async query(query) {
          mockQueries.push(query);
          if (/SELECT TOP 1 TemplateId, ViewDefinitionId, ViewDefinitionSnapshot/.test(query)) {
            return { recordset: mockTaskRow ? [mockTaskRow] : [] };
          }
          if (/SELECT \* FROM PemsTemplateViewDefinitions WHERE Id = @id/.test(query)) {
            return { recordset: mockPinnedDefinition ? [mockPinnedDefinition] : [] };
          }
          throw new Error('Unexpected workflow query: ' + query);
        },
      };
      return request;
    },
  }),
}));

const service = require('../../services/pems/taskViewDefinitionService');
const validView = {
  viewKey: 'STANDARD_V1', schemaVersion: '1.0', definitionVersion: 2, tabs: [],
};

beforeEach(() => {
  mockTaskRow = null;
  mockPinnedDefinition = null;
  mockQueries = [];
});

describe('Historical PEMS view definition resolution', () => {
  test('legacy unpinned tasks never inherit a newer published template view', async () => {
    mockTaskRow = { TemplateId: 'tpl-legacy', ViewDefinitionId: null, ViewDefinitionSnapshot: null };
    const result = await service.getViewDefinitionForTaskInstance('task-legacy');
    expect(result).toMatchObject({ definition: null, legacyUnpinned: true });
    expect(mockQueries).toHaveLength(1);
    expect(mockQueries.some(q => /Status = 'PUBLISHED'/.test(q))).toBe(false);
  });

  test('frozen snapshot overrides later published definitions', async () => {
    mockTaskRow = {
      TemplateId: 'tpl-1', ViewDefinitionId: 'view-old',
      ViewDefinitionSnapshot: JSON.stringify(validView),
    };
    const result = await service.getViewDefinitionForTaskInstance('task-1');
    expect(result).toMatchObject({ fromSnapshot: true, definitionId: 'view-old' });
    expect(result.definition).toEqual(validView);
    expect(mockQueries).toHaveLength(1);
  });

  test('invalid frozen JSON is rejected instead of silently changing the view', async () => {
    mockTaskRow = { TemplateId: 'tpl-1', ViewDefinitionId: 'view-old', ViewDefinitionSnapshot: '{bad' };
    await expect(service.getViewDefinitionForTaskInstance('task-1'))
      .rejects.toMatchObject({ status: 409, code: 'INVALID_VIEW_SNAPSHOT' });
  });

  test('invalid snapshot shape is rejected', async () => {
    mockTaskRow = {
      TemplateId: 'tpl-1', ViewDefinitionId: 'view-old',
      ViewDefinitionSnapshot: JSON.stringify({ viewKey: 'UNKNOWN', schemaVersion: '1.0', definitionVersion: 2, tabs: [] }),
    };
    await expect(service.getViewDefinitionForTaskInstance('task-1'))
      .rejects.toMatchObject({ status: 409, code: 'INVALID_VIEW_SNAPSHOT' });
  });

  test('missing explicitly pinned definition fails closed', async () => {
    mockTaskRow = { TemplateId: 'tpl-1', ViewDefinitionId: 'missing-pin', ViewDefinitionSnapshot: null };
    await expect(service.getViewDefinitionForTaskInstance('task-1'))
      .rejects.toMatchObject({ status: 409, code: 'MISSING_PINNED_VIEW' });
  });

  test('existing explicit pin without a snapshot is returned only if valid', async () => {
    mockTaskRow = { TemplateId: 'tpl-1', ViewDefinitionId: 'view-v2', ViewDefinitionSnapshot: null };
    mockPinnedDefinition = { Id: 'view-v2', DefinitionJson: JSON.stringify(validView) };
    const result = await service.getViewDefinitionForTaskInstance('task-1');
    expect(result).toMatchObject({ fromSnapshot: false, definitionId: 'view-v2', definition: validView });
  });

  test('missing task does not resolve a template view', async () => {
    await expect(service.getViewDefinitionForTaskInstance('missing'))
      .rejects.toMatchObject({ status: 404, code: 'TASK_NOT_FOUND' });
  });
});


describe('Default snapshot generation and decoding must agree', () => {
  const { DEFAULT_VIEW } = require('../../services/pems/taskInstanceSnapshot');

  test('the generated STANDARD_V1 default passes the canonical validator', async () => {
    expect(DEFAULT_VIEW.definitionVersion).toBeGreaterThan(0);
    expect(service.validateDefinitionJson(DEFAULT_VIEW)).toMatchObject({ ok: true });
    mockTaskRow = {
      TemplateId: 'template-no-published-view',
      ViewDefinitionId: null,
      ViewDefinitionSnapshot: JSON.stringify(DEFAULT_VIEW),
    };
    const output = await service.getViewDefinitionForTaskInstance('task-default');
    expect(output).toMatchObject({
      definition: DEFAULT_VIEW,
      definitionId: null,
      fromSnapshot: true,
    });
    expect(output.legacyGeneratedDefault).toBeUndefined();
  });

  test('accepts only the exact historical v0 generated default when no view ID is pinned', async () => {
    const oldDefault = { ...DEFAULT_VIEW, definitionVersion: 0 };
    mockTaskRow = {
      TemplateId: 'template-v0',
      ViewDefinitionId: null,
      ViewDefinitionSnapshot: JSON.stringify(oldDefault),
    };
    const output = await service.getViewDefinitionForTaskInstance('historical-v0');
    expect(output).toMatchObject({
      definition: oldDefault,
      fromSnapshot: true,
      legacyGeneratedDefault: true,
    });
  });

  test('does not exempt arbitrary v0 snapshots or pinned published definitions', async () => {
    const oldDefault = { ...DEFAULT_VIEW, definitionVersion: 0 };
    mockTaskRow = {
      TemplateId: 'tpl',
      ViewDefinitionId: 'published-view-id',
      ViewDefinitionSnapshot: JSON.stringify(oldDefault),
    };
    await expect(service.getViewDefinitionForTaskInstance('published-invalid-v0'))
      .rejects.toMatchObject({ code: 'INVALID_VIEW_SNAPSHOT', status: 409 });

    mockTaskRow = {
      TemplateId: 'tpl',
      ViewDefinitionId: null,
      ViewDefinitionSnapshot: JSON.stringify({
        ...oldDefault, tabs: [{ key: 'unsafe', label: 'Injected step' }],
      }),
    };
    await expect(service.getViewDefinitionForTaskInstance('fabricated-invalid-v0'))
      .rejects.toMatchObject({ code: 'INVALID_VIEW_SNAPSHOT', status: 409 });
  });

  test('rejects zero and noninteger versions for published views', async () => {
    expect(service.validateDefinitionJson({ ...validView, definitionVersion: 0 }).ok).toBe(false);
    expect(service.validateDefinitionJson({ ...validView, definitionVersion: -1 }).ok).toBe(false);
    expect(service.validateDefinitionJson({ ...validView, definitionVersion: 1.5 }).ok).toBe(false);
    await expect(service.createViewDefinition({
      templateId: 'tpl', viewKey: 'STANDARD_V1', schemaVersion: '1.0',
      definitionVersion: 0, definitionJson: { ...validView, definitionVersion: 0 },
    })).rejects.toMatchObject({ code: 'VERSION_REQUIRED', status: 400 });
  });
});
