'use strict';

/**
 * Phase 2.2 persistence adapter over existing PemsTaskInstances, PemsSubTasks
 * and PemsActivities. No second task engine or user-authored runtime code.
 *
 * The Phase 2.3 conditional skip/reopen engine is not yet implemented. This
 * adapter therefore rejects conditional templates for publication/execution.
 */
const { sql, getPool, withTransaction, generateId } = require('../../database/db');
const gates = require('./taskExecutionGates');
const {
  validateWorkflowDefinition, validateActivityOutput, buildExecutionPlan,
} = require('./templateWorkflow');

const EXECUTABLE_STATUSES = new Set(['ACCEPTED', 'IN_PROGRESS', 'REWORK']);

function error(code, message, status = 409, details = null) {
  const e = new Error(message);
  e.code = code;
  e.status = status;
  if (details) e.validation = details;
  return e;
}

function v2Enabled() {
  return process.env.PEMS_V2_EXECUTION_ENABLED === 'true'
    && process.env.PEMS_PIN_VIEW_SNAPSHOTS === 'true'
    && gates.strictGatesEnabled();
}

function hasConditionalBranches(workflow) {
  return workflow.phases.some(phase => phase.activities.some(activity => Boolean(activity.visibleWhen)));
}

function assertExecutableWorkflow(workflow) {
  const validation = validateWorkflowDefinition(workflow);
  if (!validation.ok) throw error('INVALID_WORKFLOW_V2', 'Pinned V2 workflow is invalid', 409, validation);
  if (!v2Enabled()) {
    throw error('WORKFLOW_V2_NOT_ACTIVATED',
      'V2 execution requires snapshot pinning, strict task gates and explicit development activation');
  }
  // Conditional skipping, reopening and completion reconciliation are Phase
  // 2.3 requirements. Block these templates rather than mark hidden steps done.
  if (hasConditionalBranches(workflow)) {
    throw error('WORKFLOW_V2_CONDITIONS_PENDING',
      'Conditional workflow execution is not available before Phase 2.3');
  }
  return workflow;
}

function parseSnapshot(value) {
  let snapshot;
  try { snapshot = typeof value === 'string' ? JSON.parse(value) : value; }
  catch { throw error('INVALID_VIEW_SNAPSHOT', 'Pinned task view snapshot is malformed'); }
  if (!snapshot || typeof snapshot !== 'object' || !snapshot.workflow) {
    throw error('WORKFLOW_V2_NOT_FOUND', 'This task does not use a V2 workflow', 404);
  }
  if (snapshot.viewKey !== 'STANDARD_V1' || snapshot.schemaVersion !== '2.0') {
    throw error('INVALID_VIEW_SNAPSHOT', 'Pinned workflow view identity is invalid');
  }
  const validation = validateWorkflowDefinition(snapshot.workflow);
  if (!validation.ok) throw error('INVALID_VIEW_SNAPSHOT', 'Pinned task workflow is invalid', 409, validation);
  return snapshot.workflow;
}

function isV2Snapshot(value) {
  if (!value) return false;
  try { return Boolean((typeof value === 'string' ? JSON.parse(value) : value)?.workflow); }
  catch { return true; } // Fail closed for malformed pinned execution snapshots.
}

function activityDefinition(workflow, activityKey) {
  return workflow.phases.flatMap(p => p.activities).find(a => a.key === activityKey) || null;
}

async function lockTask(tx, taskId) {
  const task = await tx.request()
    .input('taskId', sql.VarChar, taskId)
    .query(`
      SELECT Id, Status, ViewDefinitionId, ViewDefinitionSnapshot
      FROM PemsTaskInstances WITH (UPDLOCK, HOLDLOCK)
      WHERE Id = @taskId
    `);
  const row = task.recordset[0];
  if (!row) throw error('TASK_NOT_FOUND', 'Task instance not found', 404);
  const workflow = parseSnapshot(row.ViewDefinitionSnapshot);
  assertExecutableWorkflow(workflow);
  return { task: row, workflow };
}

async function saveActivityOutput({ taskId, activityId, output, expectedRevision, actorId, actorName }) {
  if (!taskId || !activityId) throw error('INVALID_RESOURCE_ID', 'Task and activity IDs are required', 400);
  if (!actorId) throw error('ACTOR_REQUIRED', 'Authenticated executor required', 403);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    throw error('INVALID_REVISION', 'Provide a non-negative expectedRevision', 400);
  }

  return withTransaction(async tx => {
    // Caller must already be authorized on the actual task via
    // requireTaskExecutor. The child query below ALSO scopes the activity to
    // the parent ID, so a forged child ID cannot access another seller.
    const { task, workflow } = await lockTask(tx, taskId);
    if (!EXECUTABLE_STATUSES.has(task.Status)) {
      throw error('TASK_NOT_EXECUTABLE', 'Start or resume this task before saving its outputs');
    }
    const child = await tx.request()
      .input('taskId', sql.VarChar, taskId)
      .input('activityId', sql.VarChar, activityId)
      .query(`
        SELECT Id, TaskInstanceId, WorkflowActivityKey, ActivityType,
               OutputJson, OutputRevision, IsCompleted
        FROM PemsActivities WITH (UPDLOCK, ROWLOCK)
        WHERE Id = @activityId AND TaskInstanceId = @taskId
      `);
    const row = child.recordset[0];
    if (!row || !row.WorkflowActivityKey) {
      throw error('ACTIVITY_NOT_FOUND', 'V2 activity not found on this task', 404);
    }
    const def = activityDefinition(workflow, row.WorkflowActivityKey);
    if (!def || row.ActivityType !== def.type) {
      throw error('ACTIVITY_SCHEMA_MISMATCH', 'Stored activity does not match its pinned definition');
    }
    if (row.IsCompleted) throw error('ACTIVITY_ALREADY_COMPLETED', 'Completed activities cannot be edited');

    // Input and validator checks run against the immutable task snapshot, not
    // client-submitted schema. Evidence is enforced at completeActivity time.
    const validation = validateActivityOutput(def, output, 0, { requireEvidence: false });
    if (!validation.ok) {
      throw error('ACTIVITY_OUTPUT_INVALID', 'Activity output does not satisfy its pinned schema', 422, validation);
    }
    const encoded = JSON.stringify(output);
    if (encoded.length > 16000) throw error('ACTIVITY_OUTPUT_TOO_LARGE', 'Output is too large', 413);

    const currentRevision = Number(row.OutputRevision || 0);
    if (currentRevision !== expectedRevision) {
      if (row.OutputJson === encoded) {
        return { activityId, taskId, revision: currentRevision, alreadySaved: true };
      }
      throw error('ACTIVITY_REVISION_CONFLICT', 'Activity changed. Refresh before saving again', 409, {
        currentRevision,
      });
    }
    if (row.OutputJson === encoded) {
      return { activityId, taskId, revision: currentRevision, alreadySaved: true };
    }

    const change = await tx.request()
      .input('taskId', sql.VarChar, taskId)
      .input('activityId', sql.VarChar, activityId)
      .input('expectedRevision', sql.Int, expectedRevision)
      .input('outputJson', sql.NVarChar(sql.MAX), encoded)
      .input('actorId', sql.VarChar, actorId)
      .query(`
        UPDATE PemsActivities SET OutputJson = @outputJson,
          OutputRevision = OutputRevision + 1,
          OutputUpdatedAt = dbo.GetEnvDate(), OutputUpdatedBy = @actorId
        WHERE Id = @activityId AND TaskInstanceId = @taskId
          AND WorkflowActivityKey IS NOT NULL AND OutputRevision = @expectedRevision
          AND IsCompleted = 0
      `);
    if (Number(change.rowsAffected?.[0] || 0) !== 1) {
      throw error('ACTIVITY_REVISION_CONFLICT', 'Activity changed while saving', 409);
    }

    // Do not persist raw output values in audit logs; some workflows may
    // contain seller-sensitive business observations.
    await tx.request()
      .input('auditId', sql.VarChar, generateId())
      .input('taskId', sql.VarChar, taskId)
      .input('actorId', sql.VarChar, actorId)
      .input('actorName', sql.NVarChar, String(actorName || '').slice(0, 200))
      .input('details', sql.NVarChar(sql.MAX),
        JSON.stringify({ activityId, activityKey: row.WorkflowActivityKey, revision: expectedRevision + 1 }))
      .query(`
        INSERT INTO PemsTaskAuditLogs
          (Id, TaskInstanceId, Action, ActorId, ActorName, Details)
        VALUES (@auditId, @taskId, 'ACTIVITY_OUTPUT_SAVED',
          @actorId, @actorName, @details)
      `);
    return { activityId, taskId, revision: expectedRevision + 1, alreadySaved: false };
  });
}

async function assertStepReady(tx, taskId, activityId) {
  const { workflow } = await lockTask(tx, taskId);
  const child = await tx.request()
    .input('taskId', sql.VarChar, taskId)
    .input('activityId', sql.VarChar, activityId)
    .query(`
      SELECT Id, WorkflowActivityKey, ActivityType, OutputJson
      FROM PemsActivities WITH (UPDLOCK, ROWLOCK)
      WHERE Id = @activityId AND TaskInstanceId = @taskId
    `);
  const row = child.recordset[0];
  if (!row || !row.WorkflowActivityKey) throw error('ACTIVITY_NOT_FOUND', 'Workflow activity not found', 404);
  const def = activityDefinition(workflow, row.WorkflowActivityKey);
  if (!def || row.ActivityType !== def.type) {
    throw error('ACTIVITY_SCHEMA_MISMATCH', 'Stored activity differs from its frozen definition');
  }
  if (!row.OutputJson) throw error('ACTIVITY_OUTPUT_REQUIRED', 'Save the required activity output first');

  let output;
  try { output = JSON.parse(row.OutputJson); }
  catch { throw error('ACTIVITY_OUTPUT_INVALID', 'Saved activity output is corrupted'); }

  const proof = await tx.request()
    .input('taskId', sql.VarChar, taskId)
    .input('activityId', sql.VarChar, activityId)
    .query('SELECT COUNT(*) AS EvidenceCount FROM PemsEvidence WHERE TaskInstanceId = @taskId AND ActivityId = @activityId');
  const validated = validateActivityOutput(def, output, Number(proof.recordset[0]?.EvidenceCount || 0));
  if (!validated.ok) {
    throw error('ACTIVITY_OUTPUT_INVALID', 'Activity is missing required outputs or linked evidence', 422, validated);
  }
  return { activityKey: row.WorkflowActivityKey, output };
}

async function getWorkflowExecution(taskId) {
  if (!taskId) throw error('TASK_NOT_FOUND', 'Task ID required', 400);
  const pool = await getPool();
  const taskResult = await pool.request()
    .input('taskId', sql.VarChar, taskId)
    .query('SELECT Id, Status, ViewDefinitionId, ViewDefinitionSnapshot FROM PemsTaskInstances WHERE Id = @taskId');
  const task = taskResult.recordset[0];
  if (!task) throw error('TASK_NOT_FOUND', 'Task not found', 404);
  const workflow = parseSnapshot(task.ViewDefinitionSnapshot);
  const result = await pool.request().input('taskId', sql.VarChar, taskId)
    .query(`
      SELECT Id, WorkflowActivityKey, ActivityType, SubTaskId, OutputJson,
             OutputRevision, OutputUpdatedAt, IsCompleted
      FROM PemsActivities WHERE TaskInstanceId = @taskId
      ORDER BY SubTaskId, StepNo
    `);
  const entries = new Map();
  for (const row of result.recordset) {
    if (!row.WorkflowActivityKey || entries.has(row.WorkflowActivityKey)) {
      throw error('WORKFLOW_STATE_INCOMPLETE', 'Task activities do not match their immutable template');
    }
    entries.set(row.WorkflowActivityKey, row);
  }
  const expected = workflow.phases.flatMap(p => p.activities);
  if (entries.size !== expected.length || expected.some(a => !entries.has(a.key) || entries.get(a.key).ActivityType !== a.type)) {
    throw error('WORKFLOW_STATE_INCOMPLETE', 'Missing or mismatched persisted workflow activities');
  }
  const outputs = {};
  for (const activity of expected) {
    const row = entries.get(activity.key);
    if (row.OutputJson) {
      try { outputs[activity.key] = JSON.parse(row.OutputJson); }
      catch { throw error('ACTIVITY_OUTPUT_INVALID', 'Stored activity output is invalid'); }
    }
  }
  const plan = buildExecutionPlan(workflow, outputs);
  if (!plan.ok) throw error('INVALID_VIEW_SNAPSHOT', 'Workflow definition cannot be rendered', 409, plan);
  return {
    taskId, status: task.Status, viewDefinitionId: task.ViewDefinitionId,
    schemaVersion: '2.0',
    phases: plan.phases.map(phase => ({
      ...phase,
      activities: phase.activities.map(a => ({
        ...a,
        activityId: entries.get(a.key).Id,
        output: outputs[a.key] || null,
        outputRevision: Number(entries.get(a.key).OutputRevision || 0),
        isCompleted: Boolean(entries.get(a.key).IsCompleted),
      })),
    })),
  };
}

module.exports = {
  v2Enabled, hasConditionalBranches, assertExecutableWorkflow, isV2Snapshot,
  saveActivityOutput, getWorkflowExecution, assertStepReady,
};
