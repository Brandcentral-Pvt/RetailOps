// Run with:  node --test src/modules/tasks/view-registry/__tests__/taskViewRegistry.test.js
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  clearRegistry,
  getActivityRenderer,
  getRegisteredActivityRenderers,
  registerActivityRenderer,
  getRegisteredViews,
  getView,
  registerView,
  registerWidget,
  resolveViewForTask,
  validateViewDefinition,
} from '../taskViewRegistry.js';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, '..', '..', '..', '..', '..');
const ViewA = () => null;
const ViewB = () => null;

function captureWarnings(fn) {
  const warnings = [];
  const original = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    return { result: fn(), warnings };
  } finally {
    console.warn = original;
  }
}

beforeEach(() => clearRegistry());

test('validateViewDefinition accepts a local definition with tabs and widgets', () => {
  const definition = {
    viewKey: 'OOS_RECON_V1',
    version: 3,
    tabs: [{ key: 'overview', label: 'Overview', widgetKey: 'OosOverviewTab' }],
    widgets: ['OosAffectedAsinsGrid', { key: 'OosExportPanel' }],
  };

  const result = validateViewDefinition(definition);
  assert.equal(result.valid, true);
  assert.equal(result.definition, definition);
});

test('validateViewDefinition rejects raw JSON strings, non-objects and invalid keys', () => {
  assert.equal(validateViewDefinition('{"viewKey":"OOS_RECON_V1"}').valid, false);
  assert.equal(validateViewDefinition(null).valid, false);
  assert.equal(validateViewDefinition([]).valid, false);
  assert.equal(validateViewDefinition({ version: 1 }).valid, false);
  assert.equal(validateViewDefinition({ viewKey: 'lowercase' }).valid, false);
  assert.equal(validateViewDefinition({ viewKey: 'OOS_RECON_V1', version: 1.5 }).valid, false);
  assert.equal(validateViewDefinition({ viewKey: 'OOS_RECON_V1', tabs: 'overview' }).valid, false);
  assert.equal(validateViewDefinition({ viewKey: 'OOS_RECON_V1', tabs: [{ key: 'overview' }] }).valid, false);
  assert.equal(validateViewDefinition({ viewKey: 'OOS_RECON_V1', widgets: [{ key: '1invalid' }] }).valid, false);
});

test('validateViewDefinition rejects executable and remote fields at any depth', () => {
  const cases = [
    { viewKey: 'OOS_RECON_V1', component: './Remote.jsx' },
    { viewKey: 'OOS_RECON_V1', tabs: [{ key: 'overview', label: 'Overview', url: 'https://example.test/view.js' }] },
    { viewKey: 'OOS_RECON_V1', widgets: [{ key: 'Grid', options: { script: 'alert(1)' } }] },
  ];

  for (const definition of cases) {
    const result = validateViewDefinition(definition);
    assert.equal(result.valid, false);
    assert.match(result.reason, /executable or remote/);
  }
});

test('duplicate view and widget registration keep the first registration', () => {
  assert.equal(registerView('TEST_VIEW', ViewA), true);
  const duplicate = captureWarnings(() => registerView('TEST_VIEW', ViewB));
  assert.equal(duplicate.result, false);
  assert.equal(getView('TEST_VIEW'), ViewA);
  assert.match(duplicate.warnings.join('\n'), /already registered/);

  const WidgetA = () => null;
  const WidgetB = () => null;
  assert.equal(registerWidget('TestWidget', WidgetA), true);
  const duplicateWidget = captureWarnings(() => registerWidget('TestWidget', WidgetB));
  assert.equal(duplicateWidget.result, false);
  assert.match(duplicateWidget.warnings.join('\n'), /already registered/);
});

test('invalid registrations fail safely without replacing valid entries', () => {
  assert.equal(registerView('invalid', ViewA), false);
  assert.equal(registerView('VALID_VIEW', null), false);
  assert.equal(registerWidget('1invalid', ViewA), false);
  assert.equal(registerWidget('ValidWidget', null), false);
  assert.deepEqual(getRegisteredViews(), []);
});

test('missing definitions fall back without a warning', () => {
  const resolved = resolveViewForTask({});
  assert.deepEqual(resolved, {
    viewKey: 'STANDARD_V1',
    definition: null,
    fallback: true,
    warning: null,
  });
});

test('invalid definitions fall back with a visible warning', () => {
  const { result, warnings } = captureWarnings(() => resolveViewForTask({
    viewDefinition: { definition: { viewKey: 'OOS_RECON_V1', component: 'remote.js' } },
  }));

  assert.equal(result.viewKey, 'STANDARD_V1');
  assert.equal(result.fallback, true);
  assert.match(result.warning, /View definition rejected/);
  assert.match(warnings.join('\n'), /Rejected view definition/);
});

test('unknown view definitions fall back with a visible warning', () => {
  const { result } = captureWarnings(() => resolveViewForTask({
    viewDefinition: { definition: { viewKey: 'UNKNOWN_VIEW', version: 1 } },
  }));

  assert.equal(result.viewKey, 'STANDARD_V1');
  assert.equal(result.definition.viewKey, 'UNKNOWN_VIEW');
  assert.equal(result.fallback, true);
  assert.match(result.warning, /not registered/);
});

test('registered definitions resolve and use the instance snapshot version', () => {
  registerView('OOS_RECON_V1', ViewA);
  const resolved = resolveViewForTask({
    viewDefinition: {
      definition: { viewKey: 'OOS_RECON_V1', version: 99, tabs: [{ key: 'overview', label: 'Overview' }] },
      version: 7,
    },
  });

  assert.equal(resolved.viewKey, 'OOS_RECON_V1');
  assert.equal(resolved.fallback, false);
  assert.equal(resolved.warning, null);
  assert.equal(resolved.definition.version, 7);
});

test('application boot imports the OOS registration module', () => {
  const mainSource = readFileSync(join(projectRoot, 'src', 'main.jsx'), 'utf8');
  const oosSource = readFileSync(join(projectRoot, 'src', 'modules', 'tasks', 'views', 'oos', 'index.js'), 'utf8');

  assert.match(mainSource, /import\s+['"]\.\/modules\/tasks\/views\/oos['"]/);
  assert.match(oosSource, /registerView\('OOS_RECON_V1',\s*OosTaskView\)/);
  assert.match(oosSource, /registerWidget\('OosAffectedAsinsGrid',\s*OosAffectedAsinsGrid\)/);
});


test('Phase 2 activity renderer registration is local and allow-listed', () => {
  assert.equal(registerActivityRenderer('CHECKLIST', ViewA), true);
  assert.equal(getActivityRenderer('CHECKLIST'), ViewA);
  assert.deepEqual(getRegisteredActivityRenderers(), ['CHECKLIST']);
  assert.equal(registerActivityRenderer('CHECKLIST', ViewB), false);
  assert.equal(getActivityRenderer('CHECKLIST'), ViewA);
  assert.equal(registerActivityRenderer('REMOTE_JS', ViewB), false);
  assert.equal(registerActivityRenderer('../Remote', ViewB), false);
  assert.equal(registerActivityRenderer('SELECT_SOURCE', 'https://remote.example/component'), false);
  assert.equal(getActivityRenderer('REMOTE_JS'), null);
  clearRegistry();
  assert.deepEqual(getRegisteredActivityRenderers(), []);
});
