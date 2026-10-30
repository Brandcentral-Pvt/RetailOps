'use strict';

const {
  SCHEMA_VERSION,
  validateWorkflowDefinition, buildExecutionPlan, validateActivityOutput,
  materializeWorkflowSop,
} = require('../../services/pems/templateWorkflow');

function example() {
  return {
    schemaVersion: SCHEMA_VERSION,
    phases: [{
      key: 'inventory', title: 'Inventory monitoring',
      description: 'Review current seller inventory',
      activities: [
        {
          key: 'choose_source', title: 'Choose report source',
          instructions: 'Select a valid inventory source',
          type: 'SELECT_SOURCE', required: true, evidenceRequired: false,
          validatorKey: 'SOURCE_SELECTED',
          fields: [{ key: 'selected', type: 'select', label: 'Source', required: true,
            options: ['RETAILOPS', 'BRANDCENTRAL', 'VENDOR_CENTRAL'] }],
        },
        {
          key: 'confirm_inventory', title: 'Confirm inventory',
          instructions: 'Review availability for assigned ASINs',
          type: 'CHECKLIST', required: true, evidenceRequired: true,
          validatorKey: 'BOOLEAN_CONFIRMED',
          visibleWhen: { field: 'choose_source.selected', operator: 'in',
            value: ['RETAILOPS', 'BRANDCENTRAL'] },
          fields: [{ key: 'verified', type: 'boolean', label: 'Reviewed', required: true }],
        },
        {
          key: 'fallback_note', title: 'Record backup report',
          instructions: 'Document the backup inventory source',
          type: 'FORM_INPUT', required: false, evidenceRequired: false,
          validatorKey: 'NONEMPTY_TEXT',
          visibleWhen: { field: 'choose_source.selected', operator: 'equals', value: 'VENDOR_CENTRAL' },
          fields: [{ key: 'note', type: 'text', label: 'Backup observation', required: true,
            minLength: 5, maxLength: 120 }],
        },
      ],
    }],
  };
}

describe('Phase 2 workflow template contract', () => {
  test('validates typed, conditional multi-activity template', () => {
    expect(validateWorkflowDefinition(example())).toMatchObject({ ok: true, errors: [] });
  });

  test('rejects executable code properties including nested script fields', () => {
    const workflow = example();
    workflow.phases[0].activities[0].fields[0].script = 'alert(1)';
    expect(validateWorkflowDefinition(workflow).ok).toBe(false);
    expect(validateWorkflowDefinition(workflow).errors.some(e => /script/.test(e.field))).toBe(true);
  });

  test('rejects unregistered activity types and backend validators', () => {
    const w = example();
    w.phases[0].activities[1].type = 'REMOTE_JS';
    w.phases[0].activities[1].validatorKey = 'CUSTOM_EVAL';
    const v = validateWorkflowDefinition(w);
    expect(v.ok).toBe(false);
    expect(v.errors.some(e => e.field.endsWith('.type'))).toBe(true);
    expect(v.errors.some(e => e.field.endsWith('.validatorKey'))).toBe(true);
  });

  test('rejects arbitrary server adapters until a trusted adapter is implemented', () => {
    const w = example();
    w.phases[0].activities[0].adapterKey = 'https://other-seller.example/data';
    expect(validateWorkflowDefinition(w).errors.some(e => e.field.endsWith('.adapterKey'))).toBe(true);
  });

  test('requires unique phase and activity keys', () => {
    const w = example();
    w.phases.push({ ...w.phases[0] });
    w.phases[1].activities[0].key = 'confirm_inventory';
    const v = validateWorkflowDefinition(w);
    expect(v.errors.some(e => e.field.endsWith('.key'))).toBe(true);
  });

  test('rejects circular or forward references in conditional visibility', () => {
    const w = example();
    w.phases[0].activities[0].visibleWhen =
      { field: 'confirm_inventory.verified', operator: 'equals', value: true };
    expect(validateWorkflowDefinition(w).errors.some(e => e.field.endsWith('.visibleWhen.field'))).toBe(true);
  });

  test('rejects unbounded workflows and unsupported schema versions', () => {
    const w = example();
    w.phases = Array.from({ length: 31 }, (_, i) => ({ key: 'p' + i, title: 'T', activities: [] }));
    expect(validateWorkflowDefinition(w).ok).toBe(false);
    w.phases = example().phases;
    w.schemaVersion = '3.0';
    expect(validateWorkflowDefinition(w).ok).toBe(false);
  });

  test('selection controls require unique allow-listed options', () => {
    const w = example();
    w.phases[0].activities[0].fields[0].options = ['RETAILOPS', 'RETAILOPS'];
    expect(validateWorkflowDefinition(w).ok).toBe(false);
  });

  test('only earlier activity outputs can drive conditional visibility', () => {
    const w = example();
    expect(buildExecutionPlan(w, {}).phases[0].activities.map(a => a.visibility))
      .toEqual(['VISIBLE', 'WAITING', 'WAITING']);
    expect(buildExecutionPlan(w, { choose_source: { selected: 'RETAILOPS' } })
      .phases[0].activities.map(a => a.visibility)).toEqual(['VISIBLE', 'VISIBLE', 'HIDDEN']);
    expect(buildExecutionPlan(w, { choose_source: { selected: 'VENDOR_CENTRAL' } })
      .phases[0].activities.map(a => a.visibility)).toEqual(['VISIBLE', 'HIDDEN', 'VISIBLE']);
  });

  test('source selection is validated with explicit allowed choices', () => {
    const act = example().phases[0].activities[0];
    expect(validateActivityOutput(act, { selected: 'RETAILOPS' }).ok).toBe(true);
    expect(validateActivityOutput(act, { selected: 'UNTRUSTED_SOURCE' }).ok).toBe(false);
    expect(validateActivityOutput(act, { selected: 'RETAILOPS', isAdmin: true }).ok).toBe(false);
  });

  test('confirmation requires true, not merely a present false value', () => {
    const act = example().phases[0].activities[1];
    expect(validateActivityOutput(act, { verified: false }, 1).ok).toBe(false);
    expect(validateActivityOutput(act, { verified: true }, 0).ok).toBe(false);
    expect(validateActivityOutput(act, { verified: true }, 1).ok).toBe(true);
  });

  test('text field minimum and maximum bounds are enforced', () => {
    const act = example().phases[0].activities[2];
    expect(validateActivityOutput(act, { note: 'hi' }).ok).toBe(false);
    expect(validateActivityOutput(act, { note: 'Backup source confirmed' }).ok).toBe(true);
  });

  test('rejects outputs that include executable values or unknown fields', () => {
    const act = example().phases[0].activities[0];
    expect(validateActivityOutput(act, { selected: () => true }).ok).toBe(false);
    expect(validateActivityOutput(act, { selected: 'RETAILOPS', component: 'Remote' }).ok).toBe(false);
  });

  test('cannot fake attached evidence inside an output payload', () => {
    const act = example().phases[0].activities[1];
    expect(validateActivityOutput(act, { verified: true, evidenceCount: 100 }, 0).ok).toBe(false);
  });

  test('materialization preserves stable activity keys and evidence requirements', () => {
    const defs = materializeWorkflowSop(example());
    expect(defs).toHaveLength(1);
    expect(defs[0].key).toBe('inventory');
    expect(defs[0].activities).toHaveLength(3);
    expect(defs[0].activities[1]).toMatchObject({
      key: 'confirm_inventory', title: 'Confirm inventory',
      isMandatory: true, evidenceRequired: true, type: 'CHECKLIST',
    });
  });
});


test('inventory example fixture stays compatible with the canonical V2 schema', () => {
  const fixture = require('../fixtures/taskWorkflowV2.inventory.sample.json');
  expect(validateWorkflowDefinition(fixture)).toMatchObject({ ok: true, errors: [] });
  const plan = buildExecutionPlan(fixture, { source_selection: { source: 'VENDOR_CENTRAL' } });
  expect(plan.ok).toBe(true);
  expect(plan.phases[0].activities.map(a => a.visibility))
    .toEqual(['VISIBLE', 'HIDDEN', 'VISIBLE']);
});
