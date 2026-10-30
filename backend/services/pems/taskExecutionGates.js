'use strict';

/**
 * Transaction-scoped PEMS execution invariants.
 *
 * Phase 1 rollout is opt-in via PEMS_STRICT_ACTIVITY_GATES=true. Existing
 * production tasks keep their current behavior until staging backfill and
 * end-to-end checks are approved. All checks MUST use the caller's transaction.
 */
const { sql } = require('../../database/db');

const ACTIVE_EXECUTION_STATUSES = new Set(['ACCEPTED', 'IN_PROGRESS', 'REWORK']);

function strictGatesEnabled() {
  return process.env.PEMS_STRICT_ACTIVITY_GATES === 'true';
}

function gateError(code, message, details = {}) {
  const error = new Error(message);
  error.status = code === 'TASK_NOT_FOUND' || code === 'ACTIVITY_NOT_FOUND' || code === 'PHASE_NOT_FOUND' ? 404 : 409;
  error.code = code;
  error.gate = details;
  return error;
}

function ensureExecutable(status) {
  if (!ACTIVE_EXECUTION_STATUSES.has(status)) {
    throw gateError('TASK_NOT_EXECUTABLE', 'Start or resume the task before completing its activities.', { status });
  }
}

async function assertActivityReady(tx, activityId) {
  const result = await tx.request()
    .input('activityId', sql.VarChar, activityId)
    .query(`
      SELECT a.Id, a.TaskInstanceId, a.SubTaskId, a.IsCompleted,
             a.EvidenceRequired, i.Status
      FROM PemsActivities a WITH (UPDLOCK, ROWLOCK)
      JOIN PemsTaskInstances i ON i.Id = a.TaskInstanceId
      WHERE a.Id = @activityId
    `);
  const activity = result.recordset[0];
  if (!activity) throw gateError('ACTIVITY_NOT_FOUND', 'Activity not found');
  if (activity.IsCompleted) return { ...activity, alreadyCompleted: true };
  ensureExecutable(activity.Status);

  if (activity.EvidenceRequired) {
    const proof = await tx.request()
      .input('activityId', sql.VarChar, activityId)
      .input('taskId', sql.VarChar, activity.TaskInstanceId)
      .query(`
        SELECT TOP (1) Id FROM PemsEvidence
        WHERE TaskInstanceId = @taskId AND ActivityId = @activityId
      `);
    if (!proof.recordset.length) {
      throw gateError('ACTIVITY_EVIDENCE_REQUIRED', 'Attach evidence to this activity before marking it complete.', {
        activityId, taskId: activity.TaskInstanceId,
      });
    }
  }
  return activity;
}

async function assertPhaseReady(tx, subTaskId) {
  const result = await tx.request()
    .input('subTaskId', sql.VarChar, subTaskId)
    .query(`
      SELECT st.Id, st.TaskInstanceId, st.IsCompleted, i.Status
      FROM PemsSubTasks st WITH (UPDLOCK, ROWLOCK)
      JOIN PemsTaskInstances i ON i.Id = st.TaskInstanceId
      WHERE st.Id = @subTaskId
    `);
  const phase = result.recordset[0];
  if (!phase) throw gateError('PHASE_NOT_FOUND', 'Phase not found');
  if (phase.IsCompleted) return { ...phase, alreadyCompleted: true };
  ensureExecutable(phase.Status);

  const check = await tx.request()
    .input('subTaskId', sql.VarChar, subTaskId)
    .query(`
      SELECT
        SUM(CASE WHEN a.IsMandatory = 1 AND a.IsCompleted = 0 THEN 1 ELSE 0 END) AS PendingRequired,
        SUM(CASE WHEN a.IsMandatory = 1 AND a.EvidenceRequired = 1
                  AND NOT EXISTS (
                    SELECT 1 FROM PemsEvidence e
                    WHERE e.TaskInstanceId = a.TaskInstanceId AND e.ActivityId = a.Id
                  ) THEN 1 ELSE 0 END) AS MissingEvidence
      FROM PemsActivities a WHERE a.SubTaskId = @subTaskId
    `);
  const row = check.recordset[0];
  if (!row) throw gateError('PHASE_VALIDATION_UNAVAILABLE', 'Cannot verify phase requirements');
  if (Number(row.PendingRequired || 0) > 0 || Number(row.MissingEvidence || 0) > 0) {
    throw gateError('PHASE_INCOMPLETE', 'Finish the required activities and evidence before completing this phase.', {
      pendingRequired: Number(row.PendingRequired || 0),
      missingEvidence: Number(row.MissingEvidence || 0),
    });
  }
  return phase;
}

async function assertSubmissionReady(tx, taskId) {
  const check = await tx.request().input('taskId', sql.VarChar, taskId)
    .query(`
      SELECT
        (SELECT COUNT(*) FROM PemsActivities
         WHERE TaskInstanceId = @taskId AND IsMandatory = 1 AND IsCompleted = 0) AS PendingRequired,
        (SELECT COUNT(*) FROM PemsSubTasks
         WHERE TaskInstanceId = @taskId AND IsCompleted = 0) AS PendingPhases,
        (SELECT COUNT(*) FROM PemsTaskBrands
         WHERE TaskInstanceId = @taskId AND IsCompleted = 0) AS PendingBrands,
        (SELECT COUNT(*) FROM PemsActivities a
         WHERE a.TaskInstanceId = @taskId AND a.IsMandatory = 1 AND a.EvidenceRequired = 1
         AND NOT EXISTS (
           SELECT 1 FROM PemsEvidence e
           WHERE e.TaskInstanceId = a.TaskInstanceId AND e.ActivityId = a.Id
         )) AS MissingEvidence
    `);
  const row = check.recordset[0];
  if (!row) throw gateError('TASK_VALIDATION_UNAVAILABLE', 'Cannot validate task completion');
  const issues = {
    pendingRequired: Number(row.PendingRequired || 0),
    pendingPhases: Number(row.PendingPhases || 0),
    pendingBrands: Number(row.PendingBrands || 0),
    missingEvidence: Number(row.MissingEvidence || 0),
  };
  if (Object.values(issues).some(value => value > 0)) {
    throw gateError('TASK_WORK_INCOMPLETE', 'Finish required steps, phases, assigned brands and evidence before submitting.', issues);
  }
  return issues;
}

async function autoCompleteReadyPhase(tx, subTaskId, taskId) {
  const result = await tx.request().input('subTaskId', sql.VarChar, subTaskId)
    .query(`
      SELECT COUNT(*) AS Total,
        SUM(CASE WHEN IsMandatory = 1 THEN 1 ELSE 0 END) AS Required,
        SUM(CASE WHEN IsMandatory = 1 AND IsCompleted = 0 THEN 1 ELSE 0 END) AS PendingRequired,
        SUM(CASE WHEN IsCompleted = 0 THEN 1 ELSE 0 END) AS PendingAll
      FROM PemsActivities WHERE SubTaskId = @subTaskId
    `);
  const row = result.recordset[0];
  if (!row || !Number(row.Total || 0)) return false;
  const ready = Number(row.PendingRequired || 0) === 0
    && (Number(row.Required || 0) > 0 || Number(row.PendingAll || 0) === 0);
  if (!ready) return false;

  const update = await tx.request()
    .input('subTaskId', sql.VarChar, subTaskId)
    .input('taskId', sql.VarChar, taskId)
    .query(`
      UPDATE PemsSubTasks
      SET IsCompleted = 1, Status = 'COMPLETED', CompletedAt = dbo.GetEnvDate()
      WHERE Id = @subTaskId AND TaskInstanceId = @taskId AND IsCompleted = 0
    `);
  return Number(update.rowsAffected?.[0] || 0) > 0;
}

async function reconcileTaskProgress(tx, taskId) {
  const result = await tx.request().input('taskId', sql.VarChar, taskId)
    .query('SELECT Id, IsCompleted, WeightagePct FROM PemsSubTasks WHERE TaskInstanceId = @taskId');
  const phases = result.recordset;
  const total = phases.length;
  const completed = phases.filter(p => Boolean(p.IsCompleted)).length;
  const progress = total ? Math.round(completed * 100 / total) : 0;
  const weight = phases.reduce((sum, p) => sum + Number(p.WeightagePct || 0), 0);
  const completedWeight = phases.filter(p => p.IsCompleted).reduce((sum, p) => sum + Number(p.WeightagePct || 0), 0);
  const weighted = weight > 0 ? Math.round(completedWeight * 100 / weight) : progress;
  await tx.request()
    .input('taskId', sql.VarChar, taskId)
    .input('done', sql.Int, completed)
    .input('progress', sql.Decimal(5, 2), progress)
    .input('weighted', sql.Decimal(5, 2), weighted)
    .query(`
      UPDATE PemsTaskInstances
      SET CompletedSubTasks = @done, ProgressPct = @progress, WeightedProgressPct = @weighted,
          UpdatedAt = dbo.GetEnvDate()
      WHERE Id = @taskId
    `);
  return { total, completed, progress, weighted };
}

module.exports = {
  strictGatesEnabled,
  gateError,
  assertActivityReady,
  assertPhaseReady,
  assertSubmissionReady,
  autoCompleteReadyPhase,
  reconcileTaskProgress,
};
