'use strict';

/**
 * Phase 2 declarative task-workflow contract.
 *
 * Templates contain DATA, never executable callbacks, arbitrary HTML, URLs to
 * remote components, or JS snippets. Validators are trusted local keys.
 * All operations are pure so template preview and persisted instances use the
 * exact same semantics.
 */
const SCHEMA_VERSION = '2.0';
const KEY = /^[a-z][a-z0-9_]{0,47}$/;
const ACTIVITY_TYPES = Object.freeze([
  'CHECKLIST', 'FORM_INPUT', 'SELECT_SOURCE', 'DATA_REVIEW', 'TABLE_REVIEW',
  'FILE_UPLOAD', 'COMMUNICATION', 'EVIDENCE_REVIEW',
]);
const FIELD_TYPES = Object.freeze(['text', 'number', 'boolean', 'select', 'date', 'url']);
const VALIDATOR_KEYS = Object.freeze([
  'FIELDS_VALID', 'BOOLEAN_CONFIRMED', 'NONEMPTY_TEXT',
  'SOURCE_SELECTED', 'EVIDENCE_LINKED',
]);
const CONDITION_OPERATORS = Object.freeze(['equals', 'notEquals', 'in', 'truthy']);
const ALLOWED_ADAPTERS = Object.freeze([]); // Expand only with implemented, audited server adapters.

const allowed = {
  workflow: ['schemaVersion', 'phases'],
  phase: ['key', 'title', 'description', 'activities'],
  activity: ['key', 'title', 'instructions', 'type', 'required', 'evidenceRequired',
    'fields', 'visibleWhen', 'validatorKey', 'adapterKey', 'expectedOutput'],
  field: ['key', 'type', 'label', 'required', 'options', 'min', 'max',
    'minLength', 'maxLength'],
  condition: ['field', 'operator', 'value'],
};
const owns = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const plain = x => Boolean(x) && typeof x === 'object' && !Array.isArray(x)
  && (Object.getPrototypeOf(x) === Object.prototype || Object.getPrototypeOf(x) === null);

function validJsonValue(value, depth = 0) {
  if (depth > 12) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.length <= 200 && value.every(v => validJsonValue(v, depth + 1));
  if (!plain(value) || Object.keys(value).length > 50) return false;
  return Object.entries(value).every(([k, v]) => !['__proto__', 'prototype', 'constructor'].includes(k)
    && validJsonValue(v, depth + 1));
}
function cleanKeys(node, kind, path, errors) {
  if (!plain(node)) { errors.push({ field: path, message: 'Must be a plain JSON object' }); return false; }
  for (const key of Object.keys(node)) {
    if (!allowed[kind].includes(key)) {
      errors.push({ field: path + '.' + key, message: 'Unsupported workflow property' });
    }
  }
  return true;
}
function text(value, max = 200) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}
function issue(errors, field, message) { errors.push({ field, message }); }
function isKey(key) { return typeof key === 'string' && KEY.test(key); }

function validateWorkflowDefinition(workflow) {
  const errors = [];
  if (!validJsonValue(workflow)) {
    return { ok: false, errors: [{ field: 'workflow', message: 'Workflow must be bounded JSON data' }] };
  }
  if (!cleanKeys(workflow, 'workflow', 'workflow', errors)) return { ok: false, errors };
  if (workflow.schemaVersion !== SCHEMA_VERSION) issue(errors, 'workflow.schemaVersion', 'Expected schema version 2.0');
  if (!Array.isArray(workflow.phases) || workflow.phases.length < 1 || workflow.phases.length > 30) {
    issue(errors, 'workflow.phases', 'A workflow requires between 1 and 30 phases');
    return { ok: false, errors };
  }
  const used = new Set();
  const previousFields = new Set();
  let totalActivities = 0;

  workflow.phases.forEach((phase, pi) => {
    const base = `workflow.phases.${pi}`;
    if (!cleanKeys(phase, 'phase', base, errors)) return;
    if (!isKey(phase.key) || used.has('phase:' + phase.key)) issue(errors, base + '.key', 'Unique phase key required');
    else used.add('phase:' + phase.key);
    if (!text(phase.title, 160)) issue(errors, base + '.title', 'Phase title required (max 160 chars)');
    if (phase.description != null && typeof phase.description !== 'string')
      issue(errors, base + '.description', 'Description must be text');
    if (!Array.isArray(phase.activities) || phase.activities.length < 1 || phase.activities.length > 50) {
      issue(errors, base + '.activities', 'Each phase needs 1 to 50 activities');
      return;
    }
    totalActivities += phase.activities.length;
    phase.activities.forEach((activity, ai) => {
      const path = `${base}.activities.${ai}`;
      if (!cleanKeys(activity, 'activity', path, errors)) return;
      if (!isKey(activity.key) || used.has('activity:' + activity.key))
        issue(errors, path + '.key', 'Activity keys must be unique across the workflow');
      else used.add('activity:' + activity.key);
      if (!text(activity.title, 180)) issue(errors, path + '.title', 'Activity title required (max 180 chars)');
      if (!text(activity.instructions, 3000)) issue(errors, path + '.instructions', 'Instructions required (max 3000 chars)');
      if (!ACTIVITY_TYPES.includes(activity.type)) issue(errors, path + '.type', 'Unregistered activity type');
      if (typeof activity.required !== 'boolean') issue(errors, path + '.required', 'Explicit boolean required');
      if (typeof activity.evidenceRequired !== 'boolean') issue(errors, path + '.evidenceRequired', 'Explicit boolean required');
      if (activity.expectedOutput != null && typeof activity.expectedOutput !== 'string')
        issue(errors, path + '.expectedOutput', 'Expected output must be text');
      if (!VALIDATOR_KEYS.includes(activity.validatorKey))
        issue(errors, path + '.validatorKey', 'Trusted validator key required');
      if (activity.adapterKey != null && !ALLOWED_ADAPTERS.includes(activity.adapterKey))
        issue(errors, path + '.adapterKey', 'Unimplemented server data adapter');

      if (!Array.isArray(activity.fields) || activity.fields.length > 20) {
        issue(errors, path + '.fields', 'Fields must be an array of at most 20 inputs');
      } else {
        const fieldKeys = new Set();
        for (const [fi, field] of activity.fields.entries()) {
          const fpath = `${path}.fields.${fi}`;
          if (!cleanKeys(field, 'field', fpath, errors)) continue;
          if (!isKey(field.key) || fieldKeys.has(field.key)) issue(errors, fpath + '.key', 'Unique field key required');
          else fieldKeys.add(field.key);
          if (!FIELD_TYPES.includes(field.type)) issue(errors, fpath + '.type', 'Unsupported field type');
          if (!text(field.label, 140)) issue(errors, fpath + '.label', 'Field label required');
          if (typeof field.required !== 'boolean') issue(errors, fpath + '.required', 'Explicit boolean required');
          if (field.type === 'select') {
            if (!Array.isArray(field.options) || field.options.length === 0 || field.options.length > 30 ||
              field.options.some(opt => !text(opt, 100)) || new Set(field.options).size !== field.options.length) {
              issue(errors, fpath + '.options', 'Select needs 1 to 30 unique string options');
            }
          } else if (field.options != null) issue(errors, fpath + '.options', 'Options allowed only for select');
          for (const n of ['min', 'max', 'minLength', 'maxLength']) {
            if (field[n] != null && (!Number.isFinite(field[n]) || (n.endsWith('Length') && (!Number.isInteger(field[n]) || field[n] < 0)))) {
              issue(errors, fpath + '.' + n, 'Invalid numeric constraint');
            }
          }
          if (field.min != null && field.max != null && field.min > field.max) issue(errors, fpath, 'min exceeds max');
          if (field.minLength != null && field.maxLength != null && field.minLength > field.maxLength)
            issue(errors, fpath, 'minLength exceeds maxLength');
        }
      }
      const refs = Array.isArray(activity.fields)
        ? activity.fields.filter(f => plain(f) && isKey(f.key)) : [];
      // Conditions may only depend on a field of a strictly earlier activity.
      // This prevents circular dependencies and cross-task information reads.
      if (activity.visibleWhen != null) {
        const c = activity.visibleWhen;
        if (cleanKeys(c, 'condition', path + '.visibleWhen', errors)) {
          if (typeof c.field !== 'string' || !previousFields.has(c.field))
            issue(errors, path + '.visibleWhen.field', 'Condition must reference a preceding activity field');
          if (!CONDITION_OPERATORS.includes(c.operator))
            issue(errors, path + '.visibleWhen.operator', 'Unsupported condition operator');
          const primitive = v => v === null || typeof v === 'string' ||
            typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v));
          if (c.operator === 'in') {
            if (!Array.isArray(c.value) || !c.value.length || c.value.length > 20 ||
                !c.value.every(primitive)) {
              issue(errors, path + '.visibleWhen.value', 'in requires 1 to 20 scalar options');
            }
          } else if (!primitive(c.value)) {
            issue(errors, path + '.visibleWhen.value', 'Condition value must be a scalar literal');
          }
          if (c.operator === 'truthy' && typeof c.value !== 'boolean') {
            issue(errors, path + '.visibleWhen.value', 'truthy requires a boolean target');
          }
        }
      }
      if (activity.type === 'SELECT_SOURCE' && !refs.some(f => f.type === 'select' && f.required))
        issue(errors, path + '.fields', 'Source selection requires a required select input');
      if (activity.validatorKey === 'BOOLEAN_CONFIRMED' && !refs.some(f => f.type === 'boolean' && f.required))
        issue(errors, path + '.fields', 'Confirmation requires a required boolean field');
      if (activity.validatorKey === 'EVIDENCE_LINKED' && !activity.evidenceRequired)
        issue(errors, path + '.evidenceRequired', 'Evidence validator requires evidenceRequired=true');
      if (activity.required && !activity.evidenceRequired && refs.length === 0)
        issue(errors, path + '.fields', 'Mandatory activity requires an input or evidence');
      if (isKey(activity.key)) {
        for (const f of refs) previousFields.add(activity.key + '.' + f.key);
      }
    });
  });
  if (totalActivities > 150) issue(errors, 'workflow.phases', 'Maximum 150 activities in one workflow');
  return { ok: errors.length === 0, errors };
}

function resolveActivityVisibility(activity, outputs) {
  const c = activity.visibleWhen;
  if (!c) return 'VISIBLE';
  const [activityKey, fieldKey] = c.field.split('.');
  const output = outputs?.[activityKey];
  if (!plain(output) || !owns(output, fieldKey)) return 'WAITING';
  const value = output[fieldKey];
  const equals = (a, b) => a === b && (a == null || typeof a !== 'object');
  switch (c.operator) {
    case 'equals': return equals(value, c.value) ? 'VISIBLE' : 'HIDDEN';
    case 'notEquals': return equals(value, c.value) ? 'HIDDEN' : 'VISIBLE';
    case 'in': return c.value.some(v => equals(value, v)) ? 'VISIBLE' : 'HIDDEN';
    case 'truthy': return Boolean(value) === Boolean(c.value) ? 'VISIBLE' : 'HIDDEN';
    default: return 'WAITING';
  }
}

function buildExecutionPlan(workflow, outputs = {}) {
  const validation = validateWorkflowDefinition(workflow);
  if (!validation.ok) return { ok: false, errors: validation.errors };
  return {
    ok: true,
    phases: workflow.phases.map(phase => ({
      key: phase.key,
      title: phase.title,
      activities: phase.activities.map(activity => ({
        ...activity,
        visibility: resolveActivityVisibility(activity, outputs),
      })),
    })),
  };
}

function validateActivityOutput(activity, output, evidenceCount = 0) {
  const errors = [];
  if (!plain(output) || !validJsonValue(output) || JSON.stringify(output).length > 16000) {
    return { ok: false, errors: [{ field: 'output', message: 'Output must be a bounded JSON object' }] };
  }
  const fields = activity.fields || [];
  const defined = new Map(fields.map(f => [f.key, f]));
  for (const key of Object.keys(output)) if (!defined.has(key)) issue(errors, 'output.' + key, 'Undeclared output field');
  for (const field of fields) {
    const value = output[field.key], empty = value === undefined || value === null || value === '';
    if (empty) {
      if (field.required) issue(errors, 'output.' + field.key, 'Required input missing');
      continue;
    }
    const typeCheck = {
      text: () => typeof value === 'string' && value.length <= 2000,
      number: () => typeof value === 'number' && Number.isFinite(value),
      boolean: () => typeof value === 'boolean',
      select: () => typeof value === 'string' && field.options.includes(value),
      date: () => typeof value === 'string' && /^\d{4}-\d\d-\d\d$/.test(value)
        && !Number.isNaN(Date.parse(value + 'T00:00:00Z'))
        && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value,
      url: () => {
        if (typeof value !== 'string' || value.length > 2048) return false;
        try {
          const parsed = new URL(value);
          return parsed.protocol === 'https:' && Boolean(parsed.hostname);
        } catch { return false; }
      },
    };
    if (!typeCheck[field.type]?.()) { issue(errors, 'output.' + field.key, 'Invalid input type or value'); continue; }
    if (typeof value === 'number' && ((field.min != null && value < field.min) || (field.max != null && value > field.max)))
      issue(errors, 'output.' + field.key, 'Outside permitted range');
    if (typeof value === 'string' && ((field.minLength != null && value.length < field.minLength) ||
      (field.maxLength != null && value.length > field.maxLength))) issue(errors, 'output.' + field.key, 'Invalid length');
  }
  switch (activity.validatorKey) {
    case 'BOOLEAN_CONFIRMED':
      if (!fields.some(f => f.type === 'boolean' && f.required && output[f.key] === true)) issue(errors, 'output', 'Confirmation required');
      break;
    case 'NONEMPTY_TEXT':
      if (!fields.some(f => f.type === 'text' && typeof output[f.key] === 'string' && output[f.key].trim()))
        issue(errors, 'output', 'A written observation is required');
      break;
    case 'SOURCE_SELECTED':
      if (!fields.some(f => f.type === 'select' && f.required && f.options.includes(output[f.key])))
        issue(errors, 'output', 'Select an authorized source');
      break;
    case 'EVIDENCE_LINKED':
      if (evidenceCount <= 0) issue(errors, 'evidence', 'Attach activity-level evidence');
      break;
    case 'FIELDS_VALID': break;
    default: issue(errors, 'validatorKey', 'Unregistered validator');
  }
  if (activity.evidenceRequired && evidenceCount <= 0)
    issue(errors, 'evidence', 'Attach activity-level evidence before completing this activity');
  return { ok: errors.length === 0, errors };
}

function materializeWorkflowSop(workflow) {
  const v = validateWorkflowDefinition(workflow);
  if (!v.ok) throw Object.assign(new Error('Invalid published workflow'), { code: 'INVALID_WORKFLOW', validation: v });
  return workflow.phases.map(phase => ({
    key: phase.key, title: phase.title, description: phase.description || '',
    activities: phase.activities.map(activity => ({
      key: activity.key, title: activity.title, instructions: activity.instructions,
      expectedOutput: activity.expectedOutput || '', evidenceRequired: activity.evidenceRequired,
      isMandatory: activity.required, type: activity.type,
    })),
  }));
}

module.exports = {
  SCHEMA_VERSION, ACTIVITY_TYPES, FIELD_TYPES, VALIDATOR_KEYS, CONDITION_OPERATORS,
  validateWorkflowDefinition, buildExecutionPlan, validateActivityOutput,
  materializeWorkflowSop, resolveActivityVisibility,
};
