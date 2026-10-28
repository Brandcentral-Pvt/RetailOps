const { getPool, sql, generateId } = require('../../database/db');

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
  if (!definition.definitionVersion || typeof definition.definitionVersion !== 'number') {
    errors.push('definitionVersion is required and must be a number');
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

  return { ok: errors.length === 0, errors };
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
  if (!schemaVersion) throw httpError(400, 'schemaVersion is required', 'SCHEMA_VERSION_REQUIRED');
  if (typeof definitionVersion !== 'number') throw httpError(400, 'definitionVersion must be a number', 'VERSION_REQUIRED');

  const validation = validateDefinitionJson(definitionJson);
  if (!validation.ok) {
    throw httpError(400, `Invalid definition: ${validation.errors.join('; ')}`, 'INVALID_DEFINITION');
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
  const pool = await getPool();
  const existing = await pool
    .request()
    .input('id', sql.VarChar, id)
    .query('SELECT * FROM PemsTemplateViewDefinitions WHERE Id = @id');
  const def = existing.recordset[0];
  if (!def) throw httpError(404, 'View definition not found', 'NOT_FOUND');
  if (def.Status === 'PUBLISHED') return { ...def, alreadyPublished: true };

  await pool
    .request()
    .input('id', sql.VarChar, id)
    .input('status', sql.VarChar, 'PUBLISHED')
    .input('publishedAt', sql.DateTime2, new Date())
    .input('publishedBy', sql.VarChar, createdBy || null)
    .query(`
      UPDATE PemsTemplateViewDefinitions
      SET Status = @status, PublishedAt = @publishedAt, PublishedBy = @publishedBy
      WHERE Id = @id
    `);

  return { ...def, status: 'PUBLISHED', publishedAt: new Date(), publishedBy: createdBy };
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

async function getViewDefinitionForTaskInstance(taskInstanceId) {
  const pool = await getPool();
  const taskResult = await pool
    .request()
    .input('id', sql.VarChar, taskInstanceId)
    .query('SELECT TOP 1 TemplateId, ViewDefinitionId, ViewDefinitionSnapshot FROM PemsTaskInstances WHERE Id = @id');
  const task = taskResult.recordset[0];
  if (!task) throw httpError(404, 'Task instance not found', 'TASK_NOT_FOUND');

  if (task.ViewDefinitionSnapshot) {
    return { definition: JSON.parse(task.ViewDefinitionSnapshot), fromSnapshot: true };
  }
  if (task.ViewDefinitionId) {
    const def = await pool
      .request()
      .input('id', sql.VarChar, task.ViewDefinitionId)
      .query('SELECT * FROM PemsTemplateViewDefinitions WHERE Id = @id');
    if (def.recordset[0]) {
      return { definition: JSON.parse(def.recordset[0].DefinitionJson), fromSnapshot: false, definitionId: task.ViewDefinitionId };
    }
  }
  const templateResult = await pool
    .request()
    .input('templateId', sql.VarChar, task.TemplateId)
    .query('SELECT TOP 1 * FROM PemsTemplateViewDefinitions WHERE TemplateId = @templateId AND Status = \'PUBLISHED\' ORDER BY DefinitionVersion DESC');
  if (templateResult.recordset[0]) {
    return { definition: JSON.parse(templateResult.recordset[0].DefinitionJson), fromSnapshot: false };
  }
  return { definition: null, fromSnapshot: false };
}

module.exports = {
  ALLOWED_VIEW_KEYS,
  ALLOWED_WIDGET_KEYS,
  validateDefinitionJson,
  createViewDefinition,
  getViewDefinitionByTemplate,
  getPublishedViewDefinition,
  publishViewDefinition,
  listViewDefinitions,
  getViewDefinitionForTaskInstance,
};