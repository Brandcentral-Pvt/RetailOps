'use strict';

/**
 * Pins the render definition used by a new task instance. This is deliberately
 * opt-in until the deployment has confirmed migration 033 and historical view
 * compatibility. It is called INSIDE the same transaction as task creation.
 *
 * PemsSubTasks / PemsActivities are already copied at instance creation, so
 * the snapshot here freezes the UI contract, not the executable SOP.
 */
const { sql } = require('../../database/db');
const { validateDefinitionIdentity } = require('./taskViewDefinitionService');

const DEFAULT_VIEW = Object.freeze({
  viewKey: 'STANDARD_V1',
  schemaVersion: '1.0',
  // This is a valid self-contained renderer snapshot, not a published view ID.
  // Use a positive version so the canonical reader accepts the generated JSON.
  definitionVersion: 1,
  tabs: [],
  widgets: [],
});

function viewPinningEnabled() {
  return process.env.PEMS_PIN_VIEW_SNAPSHOTS === 'true';
}

async function resolveViewPin(tx, templateId) {
  if (!viewPinningEnabled()) {
    return { viewDefinitionId: null, snapshotJson: null, pinned: false };
  }

  if (!templateId) {
    return { viewDefinitionId: null, snapshotJson: JSON.stringify(DEFAULT_VIEW), pinned: true };
  }

  const result = await tx.request()
    .input('templateId', sql.VarChar, templateId)
    .query(`
      SELECT TOP (1) Id, DefinitionJson, ViewKey, SchemaVersion, DefinitionVersion
      FROM PemsTemplateViewDefinitions
      WHERE TemplateId = @templateId AND Status = 'PUBLISHED'
      ORDER BY DefinitionVersion DESC, PublishedAt DESC, Id DESC
    `);
  const row = result.recordset[0];

  if (!row) {
    // Existing template with no published view uses an explicitly pinned
    // standard renderer. It must never silently inherit a future view version.
    return { viewDefinitionId: null, snapshotJson: JSON.stringify(DEFAULT_VIEW), pinned: true };
  }

  let definition;
  try {
    definition = JSON.parse(row.DefinitionJson);
  } catch {
    const error = new Error('Published task view definition contains invalid JSON');
    error.code = 'TASK_VIEW_INVALID';
    error.status = 409;
    throw error;
  }
  // Published V2 workflows are not yet executable by the legacy activity
  // persistence layer. Fail closed instead of creating task instances whose
  // pinned instructions cannot be completed or validated.
  if (definition.workflow) {
    const error = new Error('Workflow V2 execution is not yet activated');
    error.code = 'WORKFLOW_V2_NOT_ACTIVATED';
    error.status = 409;
    throw error;
  }
  const validation = validateDefinitionIdentity({
    viewKey: row.ViewKey,
    schemaVersion: row.SchemaVersion,
    definitionVersion: row.DefinitionVersion,
  }, definition);
  if (!validation.ok) {
    const error = new Error('Published task view definition is invalid or has a mismatched identity');
    error.code = 'TASK_VIEW_INVALID';
    error.status = 409;
    throw error;
  }
  return {
    viewDefinitionId: row.Id,
    snapshotJson: JSON.stringify(definition),
    pinned: true,
  };
}

module.exports = { DEFAULT_VIEW, viewPinningEnabled, resolveViewPin };
