const widgetRegistry = new Map();
const viewRegistry = new Map();
const activityRendererRegistry = new Map();

// Must match the backend's trusted ACTIVITY_TYPES list. This registry accepts
// only locally imported React components, never names or code from the server.
const ACTIVITY_TYPES_V2 = new Set([
  'CHECKLIST', 'FORM_INPUT', 'SELECT_SOURCE', 'DATA_REVIEW', 'TABLE_REVIEW',
  'FILE_UPLOAD', 'COMMUNICATION', 'EVIDENCE_REVIEW',
]);


const VIEW_KEY_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;
const WIDGET_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const FORBIDDEN_KEYS = new Set(['component', 'code', 'script', 'src', 'url', 'remote', 'eval', 'render']);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isComponent(value) {
  return typeof value === 'function' || (Boolean(value) && typeof value === 'object');
}

function hasForbiddenKey(value, path = '') {
  if (Array.isArray(value)) {
    return value.some((item, index) => hasForbiddenKey(item, `${path}[${index}]`));
  }
  if (!isPlainObject(value)) return false;

  return Object.entries(value).some(([key, entry]) => {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) return true;
    return hasForbiddenKey(entry, path ? `${path}.${key}` : key);
  });
}

/**
 * Validate the JSON view definition before it is used to resolve a component.
 * Definitions describe local registry keys only; executable or remote code is
 * never accepted from task instances.
 */
export function validateViewDefinition(rawDefinition) {
  if (typeof rawDefinition === 'string') {
    return { valid: false, reason: 'View definitions must be parsed JSON objects, not raw strings.' };
  }
  if (!isPlainObject(rawDefinition)) {
    return { valid: false, reason: 'View definition must be an object.' };
  }
  if (hasForbiddenKey(rawDefinition)) {
    return { valid: false, reason: 'View definition contains executable or remote code fields.' };
  }
  if (typeof rawDefinition.viewKey !== 'string' || !VIEW_KEY_PATTERN.test(rawDefinition.viewKey)) {
    return { valid: false, reason: 'View definition is missing a valid viewKey.' };
  }
  if (rawDefinition.version != null) {
    const versionIsString = typeof rawDefinition.version === 'string' && rawDefinition.version.length <= 64;
    const versionIsNumber = Number.isInteger(rawDefinition.version) && rawDefinition.version >= 0;
    if (!versionIsString && !versionIsNumber) {
      return { valid: false, reason: 'View definition version must be a short string or integer.' };
    }
  }
  if (rawDefinition.tabs != null) {
    if (!Array.isArray(rawDefinition.tabs)) {
      return { valid: false, reason: 'View definition tabs must be an array.' };
    }
    for (const tab of rawDefinition.tabs) {
      if (!isPlainObject(tab)) {
        return { valid: false, reason: 'Every view tab must be an object.' };
      }
      if (typeof tab.key !== 'string' || !WIDGET_KEY_PATTERN.test(tab.key)) {
        return { valid: false, reason: 'Every view tab needs a valid key.' };
      }
      if (typeof tab.label !== 'string' || !tab.label.trim()) {
        return { valid: false, reason: `View tab "${tab.key}" needs a label.` };
      }
      if (tab.widgetKey != null && (typeof tab.widgetKey !== 'string' || !WIDGET_KEY_PATTERN.test(tab.widgetKey))) {
        return { valid: false, reason: `View tab "${tab.key}" has an invalid widgetKey.` };
      }
    }
  }
  if (rawDefinition.widgets != null) {
    if (!Array.isArray(rawDefinition.widgets)) {
      return { valid: false, reason: 'View definition widgets must be an array.' };
    }
    for (const widget of rawDefinition.widgets) {
      const widgetKey = typeof widget === 'string' ? widget : widget?.key;
      if (typeof widgetKey !== 'string' || !WIDGET_KEY_PATTERN.test(widgetKey)) {
        return { valid: false, reason: 'Every view widget needs a valid key.' };
      }
    }
  }
  return { valid: true, definition: rawDefinition };
}

/**
 * Phase 2 shares the existing task view registry. Activity types resolve to
 * trusted application-bundled components only. No dynamic imports, eval or
 * server-provided component paths are permitted.
 */
export function registerActivityRenderer(type, component) {
  if (!ACTIVITY_TYPES_V2.has(type) || !isComponent(component)) {
    console.warn(`[ViewRegistry] Refusing untrusted activity renderer for "${String(type)}"`);
    return false;
  }
  if (activityRendererRegistry.has(type)) return false;
  activityRendererRegistry.set(type, component);
  return true;
}

export function getActivityRenderer(type) {
  return ACTIVITY_TYPES_V2.has(type) ? (activityRendererRegistry.get(type) || null) : null;
}

export function getRegisteredActivityRenderers() {
  return Array.from(activityRendererRegistry.keys());
}

export function registerWidget(key, component) {
  if (typeof key !== 'string' || !WIDGET_KEY_PATTERN.test(key) || !isComponent(component)) {
    console.warn(`[ViewRegistry] Refusing invalid widget registration for "${String(key)}"`);
    return false;
  }
  if (widgetRegistry.has(key)) {
    console.warn(`[ViewRegistry] Widget "${key}" is already registered; keeping the existing registration`);
    return false;
  }
  widgetRegistry.set(key, component);
  return true;
}

export function getWidget(key) {
  return widgetRegistry.get(key) || null;
}

export function registerView(viewKey, viewComponent) {
  if (typeof viewKey !== 'string' || !VIEW_KEY_PATTERN.test(viewKey) || !isComponent(viewComponent)) {
    console.warn(`[ViewRegistry] Refusing invalid view registration for "${String(viewKey)}"`);
    return false;
  }
  if (viewRegistry.has(viewKey)) {
    console.warn(`[ViewRegistry] View "${viewKey}" is already registered; keeping the existing registration`);
    return false;
  }
  viewRegistry.set(viewKey, viewComponent);
  return true;
}

export function getView(viewKey) {
  return viewRegistry.get(viewKey) || null;
}

export function hasView(viewKey) {
  return viewRegistry.has(viewKey);
}

export function getRegisteredViews() {
  return Array.from(viewRegistry.keys());
}

export function getRegisteredWidgets() {
  return Array.from(widgetRegistry.keys());
}

export function resolveViewForTask(task, fallbackViewKey = 'STANDARD_V1') {
  const rawDefinition = task?.viewDefinition?.definition;
  const snapshotVersion = task?.viewDefinition?.version ?? task?.viewDefinition?.snapshotVersion;

  if (rawDefinition == null) {
    return {
      viewKey: fallbackViewKey,
      definition: null,
      fallback: true,
      warning: null,
    };
  }

  const validation = validateViewDefinition(rawDefinition);
  if (!validation.valid) {
    console.warn(`[ViewRegistry] Rejected view definition: ${validation.reason}`);
    return {
      viewKey: fallbackViewKey,
      definition: null,
      fallback: true,
      warning: `View definition rejected: ${validation.reason} Using the standard task view.`,
    };
  }

  const definition = snapshotVersion == null
    ? validation.definition
    : { ...validation.definition, version: snapshotVersion };

  if (!getView(definition.viewKey)) {
    console.warn(`[ViewRegistry] Unknown view "${definition.viewKey}"; using "${fallbackViewKey}"`);
    return {
      viewKey: fallbackViewKey,
      definition,
      fallback: true,
      warning: `View "${definition.viewKey}" is not registered; using the standard task view.`,
    };
  }

  return {
    viewKey: definition.viewKey,
    definition,
    fallback: false,
    warning: null,
  };
}

export function getWidgetForKey(widgetKey) {
  return getWidget(widgetKey);
}

export function clearRegistry() {
  widgetRegistry.clear();
  viewRegistry.clear();
  activityRendererRegistry.clear();
}
