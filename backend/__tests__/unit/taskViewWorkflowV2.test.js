'use strict';

jest.mock('../../database/db', () => ({ sql: require('../../testUtils/fakePool').FAKE_SQL }));
const { validateDefinitionJson, validateDefinitionIdentity } = require('../../services/pems/taskViewDefinitionService');
const { validateWorkflowDefinition } = require('../../services/pems/templateWorkflow');

function validDefinition() {
  return {
    viewKey: 'STANDARD_V1',
    schemaVersion: '2.0',
    definitionVersion: 2,
    tabs: [],
    workflow: {
      schemaVersion: '2.0',
      phases: [{
        key: 'inventory', title: 'Inventory review',
        activities: [{
          key: 'source', title: 'Choose inventory source',
          instructions: 'Choose where you obtained the inventory report.',
          type: 'SELECT_SOURCE', required: true, evidenceRequired: false,
          validatorKey: 'SOURCE_SELECTED',
          fields: [{
            key: 'selection', type: 'select', label: 'Source', required: true,
            options: ['RETAILOPS', 'BRANDCENTRAL'],
          }],
        }],
      }],
    },
  };
}

describe('Phase 2 integration into published PEMS views', () => {
  test('accepts a versioned workflow inside the existing STANDARD_V1 definition', () => {
    const def = validDefinition();
    expect(validateWorkflowDefinition(def.workflow).ok).toBe(true);
    expect(validateDefinitionJson(def)).toMatchObject({ ok: true });
    expect(validateDefinitionIdentity({
      viewKey: def.viewKey, schemaVersion: def.schemaVersion,
      definitionVersion: def.definitionVersion,
    }, def).ok).toBe(true);
  });

  test('rejects workflows attached to V1 legacy schema or OOS renderer', () => {
    const legacy = validDefinition();
    legacy.schemaVersion = '1.0';
    expect(validateDefinitionJson(legacy).ok).toBe(false);

    const oos = validDefinition();
    oos.viewKey = 'OOS_RECON_V1';
    expect(validateDefinitionJson(oos).ok).toBe(false);
  });

  test('rejects an invalid embedded workflow rather than publishing a broken task', () => {
    const def = validDefinition();
    def.workflow.phases[0].activities[0].validatorKey = 'REMOTE_SCRIPT';
    const validation = validateDefinitionJson(def);
    expect(validation.ok).toBe(false);
    expect(validation.errors.join(' ')).toMatch(/validatorKey/);
  });

  test('legacy view definitions without workflow preserve their old contract', () => {
    expect(validateDefinitionJson({
      viewKey: 'STANDARD_V1', schemaVersion: '1.0',
      definitionVersion: 1, tabs: [],
    }).ok).toBe(true);
    expect(validateDefinitionJson({
      viewKey: 'OOS_RECON_V1', schemaVersion: '1.0',
      definitionVersion: 1, tabs: [],
    }).ok).toBe(true);
  });

  test('changing only the metadata schemaVersion fails the shared identity check', () => {
    const def = validDefinition();
    const result = validateDefinitionIdentity({
      viewKey: def.viewKey, schemaVersion: '1.0',
      definitionVersion: def.definitionVersion,
    }, def);
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/schemaVersion/);
  });
});


test('directly creating a PUBLISHED V2 workflow is blocked before any database write', async () => {
  const workflow = validDefinition();
  const service = require('../../services/pems/taskViewDefinitionService');
  await expect(service.createViewDefinition({
    templateId: 'tpl1', viewKey: 'STANDARD_V1',
    schemaVersion: '2.0', definitionVersion: 2,
    definitionJson: workflow, status: 'PUBLISHED',
  })).rejects.toMatchObject({ status: 409, code: 'WORKFLOW_V2_NOT_ACTIVATED' });
});
