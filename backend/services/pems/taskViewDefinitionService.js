const { getPool, sql, generateId } = require('../../database/db');
const { validateWorkflowDefinition } = require('./templateWorkflow');

const ALLOWED_VIEW_KEYS = new Set([
  'STANDARD_V1',
  'OOS_RECON_V1',
]);

const ALLOWED_WIDGET_KEYS = new Set([
  'AffectedAsinGrid',
  'SourceUploader',
  'AsinDetailDrawer',
  'ResyncStatus',
  'ExportPanel',
  'BrandChecklist',
  'SopExecution',
  'IncidentFollowups',
  'ExportPanel',
  'ReviewPanel',
]);

function httpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code || message;
  return err;
}

function validateDefinitionJson(definition) {
  if (!definition || typeof definition !== 'object') {
    return { ok: false, errors: ['Definition must be an object'] };
  }
  const errors = [];

  if (!definition.viewKey || !ALLOWED_VIEW_KEYS.has(definition.viewKey)) {
    errors.push(`Invalid viewKey: must be one of ${[...ALLOWED_VIEW_KEYS].join(', ')}`);
  }
  if (!definition.schemaVersion || typeof definition.schemaVersion !== 'string') {
    errors.push('schemaVersion is required and must be a string');
  }
  if (!Number.isSafeInteger(definition.definitionVersion) || definition.definitionVersion < 1) {
    errors.push('definitionVersion must be a positive integer');
  }
  if (!Array.isArray(definition.tabs)) {
    errors.push('tabs must be an array');
  } else {
    definition.tabs.forEach((tab, i) => {
      if (!tab.key || typeof tab.key !== 'string') {
        errors.push(`tabs[${i}].key is required and must be a string`);
      }
      if (!tab.label || typeof tab.label !== 'string') {
        errors.push(`tabs[${i}].label is required and must be a string`);
      }
      if (tab.widgetKey && !ALLOWED_WIDGET_KEYS.has(tab.widgetKey)) {
        errors.push(`tabs[${i}].widgetKey must be one of ${[...ALLOWED_WIDGET_KEYS].join(', ')}`);
      }
    });
  }
  if (definition.roleViews) {
    ['executor', 'reviewer', 'manager'].forEach(role => {
      if (definition.roleViews[role] && !Array.isArray(definition.roleViews[role].tabs)) {
        errors.push(`roleViews.${role}.tabs must be an array`);
      }
    });
  }
  if (definition.requiredOutputs && !Array.isArray(definition.requiredOutputs)) {
    errors.push('requiredOutputs must be an array');
  }

  // Phase 2 is additive. Historical STANDARD_V1 and OOS_RECON_V1 published
  // layouts without a workflow keep their original rendering and validation.
  if (definition.workflow !== undefined) {
    if (definition.schemaVersion !== '2.0' || definition.viewKey !== 'STANDARD_V1') {
      errors.push('Workflow V2 requires STANDARD_V1 and schemaVersion 2.0');
    }
    const v2 = validateWorkflowDefinition(definition.workflow);
    if (!v2.ok) errors.push(...v2.errors.map(err => `${err.field}: ${err.message}`));
  }

  return { ok: errors.length === 0, errors };
}

/**
 * The SQL row and the persisted definition JSON represent one immutable view
 * identity. Validate them together at every boundary that accepts or publishes
 * a definition, and again before pinning it to a task instance.
 *
 * Pure helper: safe to call before opening a DB transaction.
 */
function validateDefinitionIdentity(metadata, definition) {
  const result = validateDefinitionJson(definition);
  const errors = [...result.errors];
  if (metadata?.viewKey !== definition?.viewKey) {
    errors.push('viewKey does not match definitionJson.viewKey');
  }
  if (metadata?.schemaVersion !== definition?.schemaVersion) {
    errors.push('schemaVersion does not match definitionJson.schemaVersion');
  }
  if (metadata?.definitionVersion !== definition?.definitionVersion) {
    errors.push('definitionVersion does not match definitionJson.definitionVersion');
  }
  return { ok: errors.length === 0, errors };
}

function validatePersistedDefinition(row, errorStatus = 409) {
  let definition;
  try {
    definition = JSON.parse(row.DefinitionJson);
  } catch {
    throw httpError(errorStatus, 'Stored view definition is not valid JSON', 'INVALID_DEFINITION');
  }
  const validation = validateDefinitionIdentity({
    viewKey: row.ViewKey,
    schemaVersion: row.SchemaVersion,
    definitionVersion: row.DefinitionVersion,
  }, definition);
  if (!validation.ok) {
    throw httpError(errorStatus,
      `Stored view identity is inconsistent: ${validation.errors.join('; ')}`,
      'INVALID_DEFINITION_IDENTITY');
  }
  return definition;
}

async function createViewDefinition({
  templateId,
  viewKey,
  schemaVersion,
  definitionVersion,
  definitionJson,
  status = 'DRAFT',
  createdBy,
} = {}) {
  if (!templateId) throw httpError(400, 'templateId is required', 'TEMPLATE_REQUIRED');
  if (!viewKey || !ALLOWED_VIEW_KEYS.has(viewKey)) {
    throw httpError(400, `viewKey must be one of ${[...ALLOWED_VIEW_KEYS].join(', ')}`, 'INVALID_VIEW_KEY');
  }
  if (typeof schemaVersion !== 'string' || !schemaVersion.trim()) {
    throw httpError(400, 'schemaVersion must be a nonempty string', 'SCHEMA_VERSION_REQUIRED');
  }
  if (!Number.isSafeInteger(definitionVersion) || definitionVersion < 1) {
    throw httpError(400, 'definitionVersion must be a positive integer', 'VERSION_REQUIRED');
  }

  const shapeValidation = validateDefinitionJson(definitionJson);
  if (!shapeValidation.ok) {
    throw httpError(400, `Invalid definition: ${shapeValidation.errors.join('; ')}`, 'INVALID_DEFINITION');
  }
  const identityValidation = validateDefinitionIdentity(
    { viewKey, schemaVersion, definitionVersion }, definitionJson);
  if (!identityValidation.ok) {
    throw httpError(400, `Conflicting view metadata: ${identityValidation.errors.join('; ')}`,
      'INVALID_DEFINITION_IDENTITY');
  }

  const pool = await getPool();
  const existing = await pool
    .request()
    .input('templateId', sql.VarChar, templateId)
    .input('viewKey', sql.VarChar, viewKey)
    .input('definitionVersion', sql.Int, definitionVersion)
    .query(`
      SELECT Id FROM PemsTemplateViewDefinitions
      WHERE TemplateId = @templateId AND ViewKey = @viewKey AND DefinitionVersion = @definitionVersion
    `);
  if (existing.recordset[0]) {
    throw httpError(409, 'View definition with this template/key/version already exists', 'VERSION_EXISTS');
  }

  const id = generateId();
  await pool
    .request()
    .input('id', sql.VarChar, id)
    .input('templateId', sql.VarChar, templateId)
    .input('viewKey', sql.VarChar, viewKey)
    .input('schemaVersion', sql.VarChar, schemaVersion)
    .input('definitionVersion', sql.Int, definitionVersion)
    .input('definitionJson', sql.NVarChar(sql.MAX), JSON.stringify(definitionJson))
    .input('status', sql.VarChar, status)
    .input('createdBy', sql.VarChar, createdBy || null)
    .query(`
      INSERT INTO PemsTemplateViewDefinitions
        (Id, TemplateId, ViewKey, SchemaVersion, DefinitionVersion, DefinitionJson, Status, CreatedBy, CreatedAt)
      VALUES
        (@id, @templateId, @viewKey, @schemaVersion, @definitionVersion, @definitionJson, @status, @createdBy, GETUTCDATE())
    `);

  return { id, templateId, viewKey, schemaVersion, definitionVersion, status };
}

async function getViewDefinitionByTemplate(templateId, viewKey, definitionVersion) {
  const pool = await getPool();
  const request = pool.request().input('templateId', sql.VarChar, templateId);
  let query = 'SELECT TOP 1 * FROM PemsTemplateViewDefinitions WHERE TemplateId = @templateId';
  const params = { templateId };
  if (viewKey) {
    request.input('viewKey', sql.VarChar, viewKey);
    query += ' AND ViewKey = @viewKey';
    params.viewKey = viewKey;
  }
  if (definitionVersion != null) {
    request.input('definitionVersion', sql.Int, definitionVersion);
    query += ' AND DefinitionVersion = @definitionVersion';
    params.definitionVersion = definitionVersion;
  } else {
    query += ' AND Status = \'PUBLISHED\'';
  }
  query += ' ORDER BY DefinitionVersion DESC';
  const result = await request.query(query);
  return result.recordset[0] || null;
}

async function getPublishedViewDefinition(templateId, viewKey) {
  return getViewDefinitionByTemplate(templateId, viewKey, null);
}

async function publishViewDefinition(id, createdBy) {
  // Lock the draft and publish within one transaction. Do not permit edits
  // between validating the persisted JSON and updating the publication state.
  const { withTransaction } = require('../../database/db');
  return withTransaction(async (tx) => {
    const existing = await tx
      .request()
      .input('id', sql.VarChar, id)
      .query('SELECT * FROM PemsTemplateViewDefinitions WITH (UPDLOCK, HOLDLOCK) WHERE Id = @id');
    const def = existing.recordset[0];
    if (!def) throw httpError(404, 'View definition not found', 'NOT_FOUND');

    // Validate even an already-published row: idempotency must not disguise
    // historical invalid data as a successful publication.
    validatePersistedDefinition(def);
    if (def.Status === 'PUBLISHED') return { ...def, alreadyPublished: true };
    if (def.Status !== 'DRAFT') {
      throw httpError(409, 'Only a draft view can be published', 'INVALID_VIEW_STATUS');
    }

    const publishedAt = new Date();
    const publishedBy = createdBy || null;
    const updated = await tx
      .request()
      .input('id', sql.VarChar, id)
      .input('status', sql.VarChar, 'PUBLISHED')
      .input('publishedAt', sql.DateTime2, publishedAt)
      .input('publishedBy', sql.VarChar, publishedBy)
      .query(`
        UPDATE PemsTemplateViewDefinitions
        SET Status = @status, PublishedAt = @publishedAt, PublishedBy = @publishedBy
        WHERE Id = @id AND Status = 'DRAFT'
      `);
    if (Number(updated.rowsAffected?.[0] || 0) !== 1) {
      throw httpError(409, 'View changed while publishing; reload and retry', 'VIEW_PUBLISH_CONFLICT');
    }

    return { ...def, Status: 'PUBLISHED', status: 'PUBLISHED', PublishedAt: publishedAt,
      PublishedBy: publishedBy, publishedAt, publishedBy };
  });
}

async function listViewDefinitions(templateId) {
  const pool = await getPool();
  const request = pool.request();
  if (templateId) request.input('templateId', sql.VarChar, templateId);
  const query = templateId
    ? 'SELECT * FROM PemsTemplateViewDefinitions WHERE TemplateId = @templateId ORDER BY DefinitionVersion DESC'
    : 'SELECT * FROM PemsTemplateViewDefinitions ORDER BY CreatedAt DESC';
  const result = await request.query(query);
  return result.recordset;
}

/**
 * Compatibility with the original Phase 1 generated fallback snapshot, which
 * used definitionVersion=0 even though the canonical validator requires a
 * positive version. Only this exact, non-published STANDARD_V1 shape is allowed.
 * Never use this exception for an actual published definition or arbitrary v0.
 */
function isLegacyGeneratedDefaultSnapshot(definition, definitionId) {
  if (definitionId || !definition || typeof definition !== 'object' || Array.isArray(definition)) return false;
  const allowedKeys = ['viewKey', 'schemaVersion', 'definitionVersion', 'tabs', 'widgets'];
  return Object.keys(definition).length === allowedKeys.length
    && Object.keys(definition).every(key => allowedKeys.includes(key))
    && definition.viewKey === 'STANDARD_V1'
    && definition.schemaVersion === '1.0'
    && definition.definitionVersion === 0
    && Array.isArray(definition.tabs) && definition.tabs.length === 0
    && Array.isArray(definition.widgets) && definition.widgets.length === 0;
}

async function getViewDefinitionForTaskInstance(taskInstanceId) {
  const pool = await getPool();
  const taskResult = await pool
    .request()
    .input('id', sql.VarChar, taskInstanceId)
    .query('SELECT TOP 1 TemplateId, ViewDefinitionId, ViewDefinitionSnapshot FROM PemsTaskInstances WHERE Id = @id');
  const task = taskResult.recordset[0];
  if (!task) throw httpError(404, 'Task instance not found', 'TASK_NOT_FOUND');

  if (task.ViewDefinitionSnapshot) {
    let definition;
    try { definition = JSON.parse(task.ViewDefinitionSnapshot); }
    catch (error) { throw httpError(409, 'Pinned task view snapshot is malformed', 'INVALID_VIEW_SNAPSHOT'); }
    const validation = validateDefinitionJson(definition);
    const legacyGeneratedDefault = isLegacyGeneratedDefaultSnapshot(definition, task.ViewDefinitionId);
    if (!validation.ok && !legacyGeneratedDefault) {
      throw httpError(409, 'Pinned task view snapshot does not match the registered schema', 'INVALID_VIEW_SNAPSHOT');
    }
    return {
      definition, fromSnapshot: true,
      definitionId: task.ViewDefinitionId || null,
      ...(legacyGeneratedDefault ? { legacyGeneratedDefault: true } : {}),
    };
  }
  if (task.ViewDefinitionId) {
    const def = await pool
      .request()
      .input('id', sql.VarChar, task.ViewDefinitionId)
      .query('SELECT * FROM PemsTemplateViewDefinitions WHERE Id = @id');
    if (def.recordset[0]) {
      const definition = validatePersistedDefinition(def.recordset[0]);
      return { definition, fromSnapshot: false, definitionId: task.ViewDefinitionId };
    }
    throw httpError(409, 'Pinned task view definition no longer exists', 'MISSING_PINNED_VIEW');
  }
  // A pre-Phase-1 instance with no explicit pin must not silently inherit
  // whatever template view was most recently published. Legacy task execution
  // remains in the historical standard renderer until an approved migration.
  return { definition: null, fromSnapshot: false, legacyUnpinned: true };
}

module.exports = {
  ALLOWED_VIEW_KEYS,
  ALLOWED_WIDGET_KEYS,
  validateDefinitionJson,
  validateDefinitionIdentity,
  createViewDefinition,
  getViewDefinitionByTemplate,
  getPublishedViewDefinition,
  publishViewDefinition,
  listViewDefinitions,
  getViewDefinitionForTaskInstance,
};