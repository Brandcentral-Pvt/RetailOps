const widgetRegistry = new Map();
const viewRegistry = new Map();

export function registerWidget(key, component) {
  if (widgetRegistry.has(key)) {
    console.warn(`[ViewRegistry] Widget "${key}" already registered, overwriting`);
  }
  widgetRegistry.set(key, component);
}

export function getWidget(key) {
  return widgetRegistry.get(key) || null;
}

export function registerView(viewKey, viewComponent) {
  if (viewRegistry.has(viewKey)) {
    console.warn(`[ViewRegistry] View "${viewKey}" already registered, overwriting`);
  }
  viewRegistry.set(viewKey, viewComponent);
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
  const viewDef = task?.viewDefinition?.definition;
  if (!viewDef?.viewKey) {
    return { viewKey: fallbackViewKey, definition: null, fallback: true };
  }
  const viewComponent = getView(viewDef.viewKey);
  if (!viewComponent) {
    return { viewKey: fallbackViewKey, definition: viewDef, fallback: true };
  }
  return { viewKey: viewDef.viewKey, definition: viewDef, fallback: false };
}

export function getWidgetForKey(widgetKey) {
  return getWidget(widgetKey);
}

export function clearRegistry() {
  widgetRegistry.clear();
  viewRegistry.clear();
}