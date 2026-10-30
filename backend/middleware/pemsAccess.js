/**
 * PEMS entity-access middleware — assignee / reviewer / global roles only.
 */
const { sql, getPool } = require('../database/db');
const { canActOnTask, canViewTask, canExecuteTask, canReviewTask, canTransitionTask } = require('../services/pems/pemsPolicy');
const { isGlobalUserRole } = require('../utils/roleUtils');

/**
 * Gate for PEMS endpoints that are estate-wide by nature: SLA recomputation,
 * escalation sweeps, weighted-progress rebuilds and demo seeding. These mutate
 * or expose every seller's tasks, so they cannot be scoped per seller — a
 * restricted user triggering them would be a cross-tenant write. Restricted
 * users get 403 rather than a silently unscoped result.
 */
function requireGlobalPemsRole(req, res, next) {
  const role = String(req.user?.role?.name || req.user?.role || '').toLowerCase();
  if (!isGlobalUserRole(role)) {
    return res.status(403).json({
      success: false,
      error: 'This action affects all sellers and is restricted to global roles.',
    });
  }
  return next();
}

/**
 * Resolve the task instance id from route params / body,
 * following subtask/activity references when needed.
 */
async function resolveTaskId(req, pool) {
  // Child-resource identity MUST come from the database, never from a
  // client-supplied taskInstanceId/id. Otherwise an attacker can authorize
  // against their own task while completing another seller's activity.
  const isActivity = Boolean(req.params.activityId);
  const isPhase = Boolean(req.params.subTaskId);
  if (isActivity || isPhase) {
    const table = isActivity ? 'PemsActivities' : 'PemsSubTasks';
    const childId = isActivity ? req.params.activityId : req.params.subTaskId;
    // Table is selected exclusively from the fixed allow-list above.
    const r = await pool.request().input('id', sql.VarChar, childId)
      .query(`SELECT TaskInstanceId FROM ${table} WHERE Id = @id`);
    const actualTaskId = r.recordset[0]?.TaskInstanceId;
    if (!actualTaskId) return null;

    // Reject mismatched claims instead of ignoring them, so malicious clients
    // and stale UI payloads fail predictably.
    const claimedTaskIds = [req.params.id, req.body?.taskInstanceId, req.body?.id]
      .filter(value => value !== undefined && value !== null && value !== '');
    if (claimedTaskIds.some(value => String(value) !== String(actualTaskId))) {
      const error = new Error('Task identity does not match the requested activity or phase');
      error.status = 403;
      error.code = 'TASK_PARENT_MISMATCH';
      throw error;
    }
    return actualTaskId;
  }

  // Only direct task routes and task-level evidence/review routes may use
  // their path or body task identifier as the resource being authorized.
  return req.params.id || req.body?.taskInstanceId || req.body?.id || null;
}

/**
 * Loads the task, enforces access policy, attaches req.pemsTask.
 *
 * `mode` is 'act' (default) or 'view'. Both enforce seller scope; 'act' also
 * requires the user to be the assignee or reviewer. 'view' is used for detail
 * reads, where seeing a task in your sellers is enough even if someone else
 * owns it.
 */
async function requireTaskAccess(req, res, next, options = {}) {
  const mode = options.mode || 'act';
  try {
    const pool = await getPool();
    const taskId = await resolveTaskId(req, pool);
    if (!taskId) {
      const childReference = req.params.activityId || req.params.subTaskId;
      return res.status(childReference ? 404 : 400).json({
        success: false,
        error: childReference ? 'Activity or phase not found' : 'Task id required',
      });
    }

    // Synthetic ids minted for ruleset tasks live in `Actions`, not
    // PemsTaskInstances, so there is no row to load here. getInstanceById
    // resolves them and applies the same seller scope itself; short-circuiting
    // here would 404 every rule task before it got that far.
    if (mode === 'view' && typeof taskId === 'string' && taskId.startsWith('rule_')) {
      return next();
    }

    const r = await pool.request().input('id', sql.VarChar, taskId)
      .query('SELECT Id, AssignedTo, ReviewerId, SellerId, SellerName, Status FROM PemsTaskInstances WHERE Id = @id');
    const task = r.recordset[0];
    if (!task) return res.status(404).json({ success: false, error: 'Task not found' });

    const allowed = mode === 'view' ? canViewTask(req.user, task)
      : mode === 'execute' ? canExecuteTask(req.user, task)
      : mode === 'review' ? canReviewTask(req.user, task)
      : mode === 'transition' ? canTransitionTask(req.user, task, req.body?.toStatus)
      : canActOnTask(req.user, task);
    if (!allowed) {
      return res.status(403).json({ success: false, error: 'You do not have access to this task' });
    }

    req.pemsTask = task;
    next();
  } catch (err) {
    res.status(err.status || 500).json({
      success: false, code: err.code || undefined,
      error: err.status ? err.message : 'Unable to authorize task',
    });
  }
}

/** View-level variant: seller scope only, no assignment requirement. */
const requireTaskView = (req, res, next) => requireTaskAccess(req, res, next, { mode: 'view' });
const requireTaskExecutor = (req, res, next) => requireTaskAccess(req, res, next, { mode: 'execute' });
const requireTaskReviewer = (req, res, next) => requireTaskAccess(req, res, next, { mode: 'review' });
const requireTaskTransition = (req, res, next) => requireTaskAccess(req, res, next, { mode: 'transition' });

module.exports = {
  requireTaskAccess, requireTaskView, requireTaskExecutor,
  requireTaskReviewer, requireTaskTransition, requireGlobalPemsRole,
};
